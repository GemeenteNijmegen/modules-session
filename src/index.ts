import crypto from 'crypto';
import { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import cookie from 'cookie';

export class Session {
  sessionId: string | false;
  session?: any;
  dbClient: DynamoDBClient;
  state?: string; // state parameter to validate OpenIDConnect response

  /**
     * Session handler
     *
     * Construct a session object and pass the lambda event object.
     * call init() to get the current session state. create or update
     * sessions as needed.
     * @param {string} cookieString the event object provided to the lambda
     */
  constructor(cookieString: string, dynamoDBClient: DynamoDBClient) {
    this.sessionId = this.getSessionId(cookieString);
    this.dbClient = dynamoDBClient;
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

  /**
     * Get the current session state from dynamodb,
     * set instance variables on the Session object.
     *
     * @returns dynamodb record | false
     */
  async init() {
    if (!this.sessionId) { return false; }
    const getItemCommand = new GetItemCommand({
      TableName: process.env.SESSION_TABLE,
      Key: {
        sessionid: { S: this.sessionId },
      },
    });
    try {
      const session = await this.dbClient.send(getItemCommand);
      if (session.Item?.data !== undefined) {
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

  /**
     * Update the session with login state and / or BSN
     *
     * @param {any} sessionData set the session data
     */
  async updateSession(sessionData: any) {
    if (!this.sessionId) {
      throw new Error('no sessionid, cannot update empty session');
    }
    const ttl = this.ttlFromMinutes(15);

    /**
         * ttl is a reserved keyword in dynamodb, so we need to set
         * an alias in the ExpressionAttributeNames
         */
    const command = new UpdateItemCommand({
      TableName: process.env.SESSION_TABLE,
      Key: {
        sessionid: { S: this.sessionId },
      },
      UpdateExpression: 'SET #ttl = :ttl, #loggedin = :loggedin, #bsn = :bsn',
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
  }

  /**
     * Create a new session, store in dynamodb
     */
  async createSession(sessionData: any): Promise<string> {
    const sessionId = crypto.randomUUID();
    const ttl = this.ttlFromMinutes(15);

    const command = new PutItemCommand({
      TableName: process.env.SESSION_TABLE,
      Item: {
        sessionid: { S: sessionId },
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
    });
    return cookieString;
  }
}
exports.Session = Session;