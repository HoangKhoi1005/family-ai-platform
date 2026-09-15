import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDeploymentConfig, readDeploymentFiles } from './check-deployment-config.mjs';

const safeDockerfile = `
FROM node:24.18.0-bookworm-slim AS api
USER node
FROM node:24.18.0-bookworm-slim AS web
USER node
FROM node:24.18.0-bookworm-slim AS worker
USER node
FROM node:24.18.0-bookworm-slim AS tools
USER node
`;

const safeCompose = `
services:
  postgres:
    image: postgres:17.6-alpine
  api:
    image: family-api:\${IMAGE_TAG:?Set IMAGE_TAG}
    security_opt: [no-new-privileges:true]
    environment:
      AUTH_DATABASE_URL: value
      RUNTIME_DATABASE_URL: value
  worker:
    image: family-worker:\${IMAGE_TAG:?Set IMAGE_TAG}
    security_opt: [no-new-privileges:true]
    environment:
      WORKER_DATABASE_URL: value
  web:
    image: family-web:\${IMAGE_TAG:?Set IMAGE_TAG}
    security_opt: [no-new-privileges:true]
    ports: ['127.0.0.1:3200:3200']
  migrate:
    image: family-tools:\${IMAGE_TAG:?Set IMAGE_TAG}
    profiles: [tools]
    security_opt: [no-new-privileges:true]
    environment:
      DATABASE_URL: value
`;

const safeEnv = `
APP_ENV=staging
WEB_ORIGIN=https://REPLACE_WITH_TS_NET_HOST
R2_BUCKET_PUBLIC_ACCESS=false
`;

const safeCors = JSON.stringify([
  {
    AllowedOrigins: ['https://REPLACE_WITH_TS_NET_HOST'],
    AllowedMethods: ['PUT', 'GET', 'HEAD'],
    AllowedHeaders: ['content-type'],
    ExposeHeaders: ['etag'],
  },
]);

function safeFiles() {
  return {
    dockerfile: safeDockerfile,
    compose: safeCompose,
    envTemplate: safeEnv,
    cors: safeCors,
  };
}

test('accepts the committed staging deployment package', async () => {
  const files = await readDeploymentFiles();
  assert.doesNotThrow(() => assertDeploymentConfig(files));
});

test('rejects published database and application ports', () => {
  for (const service of ['postgres', 'api', 'worker']) {
    const files = safeFiles();
    files.compose = files.compose.replace(
      `  ${service}:\n`,
      `  ${service}:\n    ports: ['0.0.0.0:9999:9999']\n`,
    );
    assert.throws(() => assertDeploymentConfig(files), new RegExp(`${service}.*ports`, 'i'));
  }
});

test('rejects owner credentials in long-running application services', () => {
  for (const service of ['api', 'worker', 'web']) {
    const files = safeFiles();
    files.compose = files.compose.replace(
      `  ${service}:\n`,
      `  ${service}:\n    environment:\n      DATABASE_URL: forbidden\n`,
    );
    assert.throws(() => assertDeploymentConfig(files), new RegExp(`${service}.*DATABASE_URL`));
  }
});

test('rejects wildcard R2 access and unsafe runtime settings', () => {
  const wildcard = safeFiles();
  wildcard.cors = wildcard.cors.replace('https://REPLACE_WITH_TS_NET_HOST', '*');
  assert.throws(() => assertDeploymentConfig(wildcard), /wildcard/i);

  const publicBucket = safeFiles();
  publicBucket.envTemplate = publicBucket.envTemplate.replace('false', 'true');
  assert.throws(() => assertDeploymentConfig(publicBucket), /public/i);

  const missingSecurity = safeFiles();
  missingSecurity.compose = missingSecurity.compose.replace(
    '    security_opt: [no-new-privileges:true]\n',
    '',
  );
  assert.throws(() => assertDeploymentConfig(missingSecurity), /no-new-privileges/i);

  const rootRuntime = safeFiles();
  rootRuntime.dockerfile = rootRuntime.dockerfile.replace(
    'FROM node:24.18.0-bookworm-slim AS api\nUSER node',
    'FROM node:24.18.0-bookworm-slim AS api\nUSER root',
  );
  assert.throws(() => assertDeploymentConfig(rootRuntime), /api.*non-root/i);

  const latest = safeFiles();
  latest.compose = latest.compose.replace('postgres:17.6-alpine', 'postgres:latest');
  assert.throws(() => assertDeploymentConfig(latest), /latest/i);
});

test('requires the narrow R2 methods and headers used by private media', () => {
  for (const [needle, replacement, expected] of [
    ['"PUT",', '', /PUT/],
    ['"content-type"', '"x-any-header"', /content-type/],
    ['"etag"', '"x-any-header"', /etag/],
  ]) {
    const files = safeFiles();
    files.cors = files.cors.replace(needle, replacement);
    assert.throws(() => assertDeploymentConfig(files), expected);
  }
});

test('keeps owner credentials behind the explicit tools profile', () => {
  const files = safeFiles();
  files.compose = files.compose.replace('    profiles: [tools]\n', '');
  assert.throws(() => assertDeploymentConfig(files), /tools profile/i);
});
