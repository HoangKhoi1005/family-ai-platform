import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { readMediaStorageConfig, S3MediaStorage } from '../dist/index.js';

const config = readMediaStorageConfig(process.env);
const client = new S3Client({
  endpoint: config.endpoint,
  region: config.region,
  forcePathStyle: config.forcePathStyle,
  credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
});
try {
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
} catch (error) {
  const status = error?.$metadata?.httpStatusCode;
  if (status !== 404) throw error;
  await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
}
const storage = new S3MediaStorage(config);
const familyId = randomUUID();
const mediaId = randomUUID();
const body = new TextEncoder().encode(`private-media-${randomUUID()}`);
const processedKey = `ready/${familyId}/${mediaId}`;
let quarantineKey = '';

try {
  const upload = await storage.createUploadGrant({
    familyId,
    mediaId,
    mimeType: 'image/jpeg',
    byteSize: body.byteLength,
  });
  quarantineKey = upload.objectKey;
  assert.ok(new Date(upload.expiresAt).getTime() - Date.now() <= 600_000);
  const uploaded = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body,
  });
  assert.equal(uploaded.status, 200);

  const metadata = await storage.headObject(quarantineKey);
  assert.equal(metadata?.byteSize, body.byteLength);
  assert.equal(metadata?.mimeType, 'image/jpeg');
  assert.deepEqual(await storage.getObject(quarantineKey), body);

  await storage.putObject(processedKey, body, 'image/jpeg');
  const read = await storage.createReadGrant(processedKey);
  assert.ok(new Date(read.expiresAt).getTime() - Date.now() <= 60_000);
  const response = await fetch(read.url);
  assert.equal(response.status, 200);
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), body);

  console.log('Private media storage integration checks passed.');
} finally {
  if (quarantineKey) await storage.deleteObject(quarantineKey);
  await storage.deleteObject(processedKey);
}
