import crypto from 'crypto';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import cookie from 'cookie';

export interface SessionOptions {
  ttlInMinutes: number; //default 15 minutes
}

export class Session {
  sessionId: string | false;
  sessionHash: string | false = false;
  session?: any;
  dbClient: DynamoDBClient;
  state?: string; // state parameter to validate OpenIDConnect response
  ttl: number;
  /**
     * Session handler
     *
     * Construct a session object and pass the lambda event object.
     * call init() to get the current session state. create or update
     * sessions as needed.
     * @param {string} cookieString the event object provided to the lambda
     */
  constructor(cookieString: string, dynamoDBClient: DynamoDBClient, options?: SessionOptions) {
    this.sessionId = this.getSessionId(cookieString);
    this.dbClient = dynamoDBClient;
    if (this.sessionId) {
      this.sessionHash = this.hash(this.sessionId);
    }
    this.ttl = options?.ttlInMinutes ?? 15;
  }

  /**
     * Parses the cookie string for the session id.
     * @param {object} cookieString a standard cookie header value
     * @returns {string|false}
     */
  getSessionId(cookieString: string): string | false {
    if (!cookieString) { return false; }
    const cookies = cookie.parse(cookieString);
    if (cookies?.session != '') {
      return cookies.session;
    }
    return false;
  }

  hash(hashString: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(hashString);
    return hash.digest('base64');
  }

  /**
     * Get the current session state from dynamodb,
     * set instance variables on the Session object.
     *
     * @returns dynamodb record | false
     */
  async init() {
    if (!this.sessionHash) { return false; }
    const getItemCommand = new GetItemCommand({
      TableName: process.env.SESSION_TABLE,
      Key: {
        sessionid: { S: this.sessionHash },
      },
    });
    try {
      const session = await this.dbClient.send(getItemCommand);
      if (session?.Item?.data !== undefined) {
        this.session = session;
        return session;
      } else {
        return false;
      }
    } catch (err) {
      console.error('Error getting session from DynamoDB: ' + err);
      throw err;
    }
  }
  /**
     * Check the current session state for login state. Call after init()
     * @returns bool
     */
  isLoggedIn() {
    return this.getValue('loggedin', 'BOOL') ?? false;
  }

  /**
   * Get a value from the session store by key
   *
   * @param key key for the element in sessionData requested
   * @param type type of data (https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes)
   * @returns {any} the value for the provided key or undefined if not found
   */
  getValue(key: string, type = 'S'): any {
    return this.session?.Item?.data?.M[key]?.[type];
  }

  /** Update the session with a single value
   * The new data object will be written to the session
   * immediately.
   */
  async setValue(key: string, value: string) {
    if (!this.session?.Item?.data) {
      await this.init();
    }
    const data = this.session?.Item?.data;
    data.M[key] = {
      S: value,
    };
    return this.updateSession(data.M);
  }

  /**
     * Update the session with session data
     *
     * @param {any} sessionData set the session data
     */
  async updateSession(sessionData: any) {
    if (!this.sessionHash) {
      throw new Error('no sessionid, cannot update empty session');
    }
    const ttl = this.ttlFromMinutes(this.ttl);

    /**
         * ttl is a reserved keyword in dynamodb, so we need to set
         * an alias in the ExpressionAttributeNames
         */
    const command = new UpdateItemCommand({
      TableName: process.env.SESSION_TABLE,
      Key: {
        sessionid: { S: this.sessionHash },
      },
      UpdateExpression: 'SET #ttl = :ttl, #data = :data',
      ExpressionAttributeNames: {
        '#ttl': 'ttl',
        '#data': 'data',
      },
      ExpressionAttributeValues: {
        ':ttl': { N: ttl },
        ':data': { M: sessionData },
      },
    });
    try {
      await this.dbClient.send(command);
    } catch (err) {
      console.error('Error updating session in DynamoDB: ' + err);
      throw err;
    }
    if (!this?.session?.Item?.data?.M) { throw Error('Session had no data before, was this a valid session?'); }
    this.session.Item.data.M = sessionData;
  }

  /**
     * Create a new session, store in dynamodb
     */
  async createSession(sessionData: any): Promise<string> {
    const sessionId = crypto.randomUUID();
    this.sessionHash = this.hash(sessionId);
    const ttl = this.ttlFromMinutes(this.ttl);

    const command = new PutItemCommand({
      TableName: process.env.SESSION_TABLE,
      Item: {
        sessionid: { S: this.sessionHash },
        data: { M: sessionData },
        ttl: { N: ttl },
      },
    });
    await this.dbClient.send(command);
    this.sessionId = sessionId;
    return sessionId;
  }

  private ttlFromMinutes(minutes: number): string {
    const now = new Date();
    const ttl = Math.floor((now.getTime() / 1000) + minutes * 60).toString(); // ttl is 15 minutes
    return ttl;
  }

  getCookie(): string {
    const value = (this.sessionId != false) ? this.sessionId : '';
    const cookieString = cookie.serialize('session', value, {
      httpOnly: true,
      secure: true,
      path: '/', //make sure the cookie is set for all paths in the domain
    });
    return cookieString;
  }
}

exports.Session = Session;
