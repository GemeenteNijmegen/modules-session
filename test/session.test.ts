import { DynamoDBClient, GetItemCommandOutput } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'jest-aws-client-mock';
import { Session } from '../src';

beforeAll(() => {
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
});

const ddbMock = mockClient(DynamoDBClient);
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-1' });
const sessionId = '12345';

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
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    await session.init();
    await session.createSession('test');
    expect(ddbMock).toHaveBeenCalledTimes(2);
    expect(session.getCookie()).toContain('session=');
  });
});

describe('Given a valid loggedin Session', () => {

  test('Session id is equal to cookie session id', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    if (await session.init()) {
      expect(session.sessionId).toBe('12345');
      expect(session.getValue('bsn')).toBe('12345678');
    }
  });

  test('Session is logged in', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
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

    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    await session.init();
    expect(session.isLoggedIn()).toBe(false);
    expect(ddbMock).toHaveBeenCalled();
  });
});

describe('Given a session cookie', () => {
  test('for a loggedin user calls session store', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    if (await session.init()) {
      expect(session.sessionId).toBe('12345');
    }

    expect(ddbMock).toHaveBeenCalled();
  });

  test('for existing session will update session', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    if (await session.init()) {
      await session.updateSession({ loggedin: { B: false } });
    }

    expect(ddbMock).toHaveBeenCalled();
  });

  test('that is empty will not update session', async () => {
    const session = new Session('session=;', dynamoDBClient);
    if (await session.init()) {
      await session.updateSession({ loggedin: { B: false } });
    }

    expect(ddbMock).toHaveBeenCalledTimes(0);
  });

  test('that is empty trying to update session will throw', async () => {
    const session = new Session('session=;', dynamoDBClient);
    await session.init();
    expect(ddbMock).toHaveBeenCalledTimes(0);
    return expect(async () => {
      await session.updateSession({ loggedin: { B: false } });
    }).rejects.toThrow();

  });

  test('No session cookie will not update session', async () => {
    const session = new Session('', dynamoDBClient);
    await session.init();
    if (session.sessionId !== false) {
      await session.updateSession({ loggedin: { B: false } });
    }
    expect(ddbMock).toHaveBeenCalledTimes(0);
  });
});

describe('Setting options', () => {
  test('default session length is 15 minutes', async () => {
    const session = new Session('', dynamoDBClient);
    expect(session.ttl).toBe(15);
  });

  test('Providing a ttl in constructor updates ttl', async () => {
    const session = new Session('', dynamoDBClient, { ttlInMinutes: 30 });
    expect(session.ttl).toBe(30);
  });

  test('Providing a ttl in constructor passes ttl in request to dynamoDB', async () => {
    const session = new Session('', dynamoDBClient, { ttlInMinutes: 30 });
    await session.init();

    const now = new Date();
    const ThirtyMinutesFromNow = Math.floor((now.getTime() / 1000) + 30 * 60);

    await session.createSession({ test: { S: 'tst' } });

    // Grab the PutItemInput from the createSession call.
    const putItemInput = ddbMock.mock.calls[0][0].input as any;
    const ttl = putItemInput.Item.ttl.N;

    // To prevent failing the test because both timestamps are calculated at different times
    // allow a second of difference.
    expect(Math.abs(parseInt(ttl) - ThirtyMinutesFromNow)).toBeLessThanOrEqual(1);

    expect(session.ttl).toBe(30);
  });
});

describe('Updating a session', () => {
  test('will also update the session object', async () => {
    const session = new Session(`session=${sessionId}`, dynamoDBClient);
    await session.init();
    expect(session.getValue('state')).toBe('12345');

    const newState = 'newState';
    await session.updateSession({
      state: { S: newState },
    });

    expect(session.getValue('state')).toBe(newState);
  });

  test('that was not valid throws', async () => {
    const session = new Session(`session=${sessionId}`, dynamoDBClient);
    // await session.init();
    // expect(session.getValue('state')).toBe('12345');

    const newState = 'newState';

    return expect(async () => {
      await session.updateSession({
        state: { S: newState },
      });
    }).rejects.toThrow();
  });
});


test('creating a loggedin Session generates a new session id', async () => {
  const session = new Session(`session=${sessionId}`, dynamoDBClient);
  await session.createSession('12345');
  expect(session.sessionId == sessionId).toBeFalsy();
  expect(session.sessionId).toBeTruthy();
});

describe('Session cookie', () => {
  test('Cookies have the path set to /', async () => {
    const session = new Session(`session=${sessionId}`, dynamoDBClient);
    expect(session.getCookie()).toContain('Path=/');
  });
});


describe('Setting data in the session', () => {

  test('Set data add data to the sessions', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    await session.init();
    expect(session.sessionId).toBe('12345');
    expect(session.getValue('bsn')).toBe('12345678');

    await session.setValue('bsn', '123');
    expect(session.getValue('bsn')).toBe('123');

    expect(ddbMock).toHaveBeenCalledTimes(2);
  });

  test('Set data add data to the sessions', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    await session.init();
    expect(session.sessionId).toBe('12345');
    expect(session.getValue('bsn')).toBe('12345678');

    await session.setValues({
      bsn: '123',
      abc: 'def',
    });
    expect(session.getValue('bsn')).toBe('123');
    expect(session.getValue('abc')).toBe('def');

    expect(ddbMock).toHaveBeenCalledTimes(2);
  });

  test('Leaves data unaffected when not changed', async () => {
    const session = new Session(`session=${sessionId};`, dynamoDBClient);
    await session.init();
    expect(session.sessionId).toBe('12345');
    expect(session.getValue('bsn')).toBe('12345678');

    await session.setValues({
      abc: 'def',
      ghi: 'jkl',
    });
    expect(session.getValue('bsn')).toBe('12345678');
    expect(session.getValue('abc')).toBe('def');

    expect(ddbMock).toHaveBeenCalledTimes(2);
  });
});