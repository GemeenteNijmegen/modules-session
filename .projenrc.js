const { typescript } = require('projen');
const { NpmAccess } = require('projen/lib/javascript');
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: 'nijmegen-session',
  npmAccess: NpmAccess.PUBLIC,
  deps: [
    'cookie',
    '@aws-sdk/client-dynamodb',
    '@types/cookie',
  ],
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'jest-aws-client-mock',
  ], /* Build dependencies for this module. */
  packageName: 'gemeentenijmegen-session', /* The "name" in package.json. */
});
project.synth();