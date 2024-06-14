import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DockerComposeEnvironment, StartedDockerComposeEnvironment, Wait } from 'testcontainers';
import { describeIntegration } from './describeIntegration';
import { Session } from '../src';
beforeAll(() => {
  process.env.SESSION_TABLE = 'mijnuitkering-sessions';
});

describeIntegration('Adding a value to the session object', () =>{
  const composeFile = 'docker-compose-dynamodb.yaml';
  let environment: StartedDockerComposeEnvironment;

  const dbClient = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy',
    },
  });


  beforeAll(async() => {
    if (!process.env.DEBUG) {
      console.debug = jest.fn();
    }

    environment = await new DockerComposeEnvironment('test', composeFile)
      .withWaitStrategy('dynamodb-local', Wait.forLogMessage('CorsParams: null'))
      .up();
  }, 60000); // long timeout, can start docker image

  afterAll(async() => {
    console.debug('bringing environment down');
    await environment.down({ timeout: 10000 });
  });

  beforeEach( async () => {
    const command = new CreateTableCommand({
      TableName: process.env.SESSION_TABLE,
      AttributeDefinitions: [
        {
          AttributeName: 'sessionid',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'sessionid',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    });

    console.debug('making table', await dbClient.send(command));
  });

  afterEach(async () => {
    const command = new DeleteTableCommand({
      TableName: process.env.SESSION_TABLE,
    });

    console.debug('removing table');
    console.debug(await dbClient.send(command));
  });

  test('Adding to an existing object adds the value', async() => {
    const session = new Session('session=12345', dbClient);
    await session.init();
    console.debug(await session.createSession({
      test: { S: 'ok' },
    }));
    await session.init();
    expect(session.getValue('test')).toBe('ok');


    await session.setValue('newkey', 'newvalue');
    expect(session.getValue('test')).toBe('ok');

    expect(session.getValue('newkey')).toBe('newvalue');
  });
});
