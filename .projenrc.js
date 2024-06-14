const { GemeenteNijmegenTsPackage } = require('@gemeentenijmegen/projen-project-type');

const packageName = '@gemeentenijmegen/session';

const project = new GemeenteNijmegenTsPackage({
  defaultReleaseBranch: 'main',
  name: '@gemeentenijmegen/session',
  repository: 'https://github.com/GemeenteNijmegen/modules-session.git',
  depsUpgradeOptions: {
    workflowOptions: {
      branches: ['main'], // No acceptance branch
    },
  },
  deps: [
    'cookie',
    '@aws-sdk/client-dynamodb',
  ],
  devDeps: [
    'jest-aws-client-mock',
    '@types/cookie',
    '@gemeentenijmegen/projen-project-type',
    'testcontainers',
    '@testcontainers/localstack',
  ],
  packageName: packageName,
  enableAutoMergeDependencies: false, // No acceptance branch
});
project.synth();
