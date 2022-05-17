const { typescript } = require('projen');
const { NpmAccess } = require('projen/lib/javascript');
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: '@gemeentenijmegen/session',
  license: 'EUPL-1.2',
  release: true,
  releaseToNpm: true,
  npmAccess: NpmAccess.PUBLIC,
  deps: [
    'cookie',
    '@aws-sdk/client-dynamodb',
  ],
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [
    'jest-aws-client-mock',
    '@types/cookie',
  ], /* Build dependencies for this module. */
  packageName: '@gemeentenijmegen/session', /* The "name" in package.json. */
});
project.synth();