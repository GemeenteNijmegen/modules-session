import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import { Session } from '../src';

beforeAll(() => {
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
});

const ddbMock = mockClient(DynamoDBClient);

beforeEach(() => {
  ddbMock.mockReset();
  const getItemOutput: Partial<GetItemCommandOutput> = {
    Item: {
      data: {
        M: {
          loggedin: { BOOL: true },
          bsn: { S: '12345678' },
          state: { S: '12345' },
        },
      },
    },
  };
  ddbMock.mockImplementation(() => getItemOutput);
});

describe('Given a new request', () => {
  test('creating a new session succeeds', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=12345;', dynamoDBClient);
    await session.init();
    await session.createSession('test');
    expect(ddbMock).toHaveBeenCalledTimes(2);
    expect(session.getCookie()).toContain('session=');
  });
});

describe('Given a valid loggedin Session', () => {

  test('Session id is equal to cookie session id', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=12345;', dynamoDBClient);
    if (await session.init()) {
      expect(session.sessionId).toBe('12345');
      expect(session.getValue('bsn')).toBe('12345678');
    }
  });

  test('Session is logged in', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=12345;', dynamoDBClient);
    await session.init();
    expect(session.isLoggedIn()).toBe(true);
  });
});


describe('Given a valid not loggedin session', () => {

  test('Session is logged out', async () => {

    const getItemOutput: Partial<GetItemCommandOutput> = {
      Item: {
        data: {
          M: {
            loggedin: { BOOL: false },
            bsn: { S: '12345678' },
            state: { S: '12345' },
          },
        },
      },
    };
    ddbMock.mockImplementation(() => getItemOutput);

    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=12345;', dynamoDBClient);
    await session.init();
    expect(session.isLoggedIn()).toBe(false);
    expect(ddbMock).toHaveBeenCalled();
  });
});

describe('Given a session cookie', () => {
  test('for a loggedin user calls session store', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=12345;', dynamoDBClient);
    if (await session.init()) {
      expect(session.sessionId).toBe('12345');
    }

    expect(ddbMock).toHaveBeenCalled();
  });

  test('for existing session will update session', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=12345;', dynamoDBClient);
    if (await session.init()) {
      await session.updateSession({ loggedin: { B: false } });
    }

    expect(ddbMock).toHaveBeenCalled();
  });

  test('that is empty will not update session', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=;', dynamoDBClient);
    if (await session.init()) {
      await session.updateSession({ loggedin: { B: false } });
    }

    expect(ddbMock).toHaveBeenCalledTimes(0);
  });

  test('that is empty trying to update session will throw', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('session=;', dynamoDBClient);
    await session.init();
    expect(ddbMock).toHaveBeenCalledTimes(0);
    return expect(async () => {
      await session.updateSession({ loggedin: { B: false } });
    }).rejects.toThrow();

  });

  test('No session cookie will not update session', async () => {
    const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
    const session = new Session('', dynamoDBClient);
    await session.init();
    if (session.sessionId !== false) {
      await session.updateSession({ loggedin: { B: false } });
    }
    expect(ddbMock).toHaveBeenCalledTimes(0);
  });
});


test('creating a loggedin Session generates a new session id', async () => {
  const sessionId = '12345';
  const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
  const session = new Session(`session=${sessionId}`, dynamoDBClient);
  await session.createSession('12345');
  expect(session.sessionId == sessionId).toBeFalsy();
  expect(session.sessionId).toBeTruthy();
});