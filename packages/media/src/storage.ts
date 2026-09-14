import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type MediaStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type UploadGrantInput = {
  familyId: string;
  mediaId: string;
  mimeType: string;
  byteSize: number;
  expiresInSeconds?: number;
};

export type UploadGrant = {
  url: string;
  method: 'PUT';
  headers: Readonly<Record<string, string>>;
  expiresAt: string;
  objectKey: string;
};

export type ReadGrant = { url: string; expiresAt: string };
export type StoredObjectMetadata = { byteSize: number; mimeType?: string; etag?: string };

export interface MediaStorage {
  createUploadGrant(input: UploadGrantInput): Promise<UploadGrant>;
  createReadGrant(objectKey: string, expiresInSeconds?: number): Promise<ReadGrant>;
  headObject(objectKey: string): Promise<StoredObjectMetadata | null>;
  getObject(objectKey: string): Promise<Uint8Array>;
  putObject(objectKey: string, body: Uint8Array, mimeType: string): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
}

type Presign = (
  client: S3Client,
  command: PutObjectCommand | GetObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

type StorageDependencies = {
  client?: Pick<S3Client, 'send'>;
  presign?: Presign;
  now?: () => Date;
};

function requireValue(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function readMediaStorageConfig(
  env: Record<string, string | undefined>,
): MediaStorageConfig {
  const endpoint = requireValue(env, 'MEDIA_STORAGE_ENDPOINT');
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('MEDIA_STORAGE_ENDPOINT must be a valid HTTP URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('MEDIA_STORAGE_ENDPOINT must use HTTP or HTTPS');
  }
  return {
    endpoint,
    region: requireValue(env, 'MEDIA_STORAGE_REGION'),
    bucket: requireValue(env, 'MEDIA_STORAGE_BUCKET'),
    accessKeyId: requireValue(env, 'MEDIA_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: requireValue(env, 'MEDIA_STORAGE_SECRET_ACCESS_KEY'),
    forcePathStyle: env.MEDIA_STORAGE_FORCE_PATH_STYLE !== 'false',
  };
}

export class S3MediaStorage implements MediaStorage {
  readonly #client: Pick<S3Client, 'send'>;
  readonly #presign: Presign;
  readonly #now: () => Date;

  constructor(
    private readonly config: MediaStorageConfig,
    dependencies: StorageDependencies = {},
  ) {
    this.#client =
      dependencies.client ??
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    this.#presign = dependencies.presign ?? getSignedUrl;
    this.#now = dependencies.now ?? (() => new Date());
  }

  async createUploadGrant(input: UploadGrantInput): Promise<UploadGrant> {
    const expiresIn = Math.min(Math.max(input.expiresInSeconds ?? 600, 1), 600);
    const objectKey = `quarantine/${input.familyId}/${input.mediaId}`;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: input.mimeType,
      ContentLength: input.byteSize,
    });
    const url = await this.#presign(this.#client as S3Client, command, { expiresIn });
    return {
      url,
      method: 'PUT',
      headers: { 'content-type': input.mimeType },
      expiresAt: new Date(this.#now().getTime() + expiresIn * 1000).toISOString(),
      objectKey,
    };
  }

  async createReadGrant(objectKey: string, expiresInSeconds = 60): Promise<ReadGrant> {
    const expiresIn = Math.min(Math.max(expiresInSeconds, 1), 60);
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: objectKey });
    const url = await this.#presign(this.#client as S3Client, command, { expiresIn });
    return {
      url,
      expiresAt: new Date(this.#now().getTime() + expiresIn * 1000).toISOString(),
    };
  }

  async headObject(objectKey: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.#client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
        }),
      );
      return {
        byteSize: result.ContentLength ?? 0,
        ...(result.ContentType ? { mimeType: result.ContentType } : {}),
        ...(result.ETag ? { etag: result.ETag } : {}),
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  async getObject(objectKey: string): Promise<Uint8Array> {
    const result = (await this.#client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    )) as GetObjectOutput;
    if (!result.Body) throw new Error('Stored media object has no body');
    const body = result.Body as unknown as {
      transformToByteArray?: () => Promise<Uint8Array>;
      [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | Buffer | string>;
    };
    if (body.transformToByteArray) return body.transformToByteArray();
    if (!body[Symbol.asyncIterator]) throw new Error('Stored media body is not readable');
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : new Uint8Array(chunk));
    }
    return Buffer.concat(chunks);
  }

  async putObject(objectKey: string, body: Uint8Array, mimeType: string): Promise<void> {
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: body,
        ContentType: mimeType,
      }),
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.#client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    );
  }
}
