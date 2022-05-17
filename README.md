# Gemeente Nijmegen Session

A dynamodb-backed Session module. Used for applications requiring managing session and login state. Currently in development.

## How to use
Quickstart:

Install using npm: 

```npm i @gemeentenijmegen/session```

```
// dynamoDBClient is an instance of DynamoDBClient in @aws-sdk/client-dynamodb
// create session object
const session = new Session('', dynamoDBClient);
// initialize
await session.init();
// create a new session, passing in the session data
await session.createSession({'user': 'john'});
```

The session returns a cookie-header string value when `session.getCookie()` is called. this string will contain a cookie named 'session' with a random UUID4 as its value. This acts as the session identifier.

## Using an existing session
After initializing the session, call `getSession` on the session instance passing the cookie header as the parameter. The cookie will be parsed and the identifier used to retrieve session Data.

## Checking for login state
To check login state, the `isLoggedin` convenience method can be called. If this field is not set or false, this method will return false. It will only return true if the field is set in session data, and is (boolean) true.

## Setting session state
call the async method `createSession` or `updateSession` on the session instance, passing in an object containing session state. It must be of the form expected by dynamodb. For example:
```
const data = {
    loggedin: { BOOL: true },
    user: { S: 'John' }
}
```
The only 'special' field in the data object is the loggedin-field. If this is present the `loggedIn`-method is available. All methods that set session state automatically reset the TTL for the session. Session length is currently hardcoded to 15 minutes.

## Retrieving session state
after calling `getSession`, individual fields can be retrieved by calling `getValue(key, type)`, where `key` is the key for the field you want (i.e. `user`) and type defaults to `S`, and is required to be the dynamoDB data type. For example:
```
session.getValue('user') // => 'John'
session.getValue('loggedin', 'BOOL') // => true
```