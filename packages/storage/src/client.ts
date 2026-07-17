/** Storage client operations for signed object transfer and object metadata. */

import type { CopyObjectCommandInput } from '@aws-sdk/client-s3'
import type { Buffer } from 'node:buffer'

import type { Readable } from 'node:stream'
import process from 'node:process'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import './env.js'

type SignedUrlOptions = NonNullable<Parameters<typeof getSignedUrl>[2]>

/** Environment key containing the Cloudflare account identifier. */
export const R2_ACCOUNT_ID_ENV = 'R2_ACCOUNT_ID'
/** Environment key containing the object-storage access-key identifier. */
export const R2_ACCESS_KEY_ID_ENV = 'R2_ACCESS_KEY_ID'
/** Environment key containing the object-storage secret access key. */
export const R2_SECRET_ACCESS_KEY_ENV = 'R2_SECRET_ACCESS_KEY'

/** Region token required by the R2 S3-compatible endpoint. */
export const R2_DEFAULT_REGION = 'auto'
/** Private bucket containing tenant-scoped source and generated objects. */
export const TALELABS_PRIVATE_BUCKET = 'talelabs-private'
/** Public bucket reserved for intentionally public objects. */
export const TALELABS_PUBLIC_BUCKET = 'talelabs-public'
/** Default validity in seconds for upload grants. */
export const DEFAULT_SIGNED_URL_EXPIRES_IN = 60 * 5
/** Default validity in seconds for download grants. */
export const DEFAULT_DOWNLOAD_URL_EXPIRES_IN = 60 * 60

/** Optional secret-bearing values accepted by object-storage composition. */
export type ObjectStorageEnv = Partial<
  Record<
    | typeof R2_ACCOUNT_ID_ENV
    | typeof R2_ACCESS_KEY_ID_ENV
    | typeof R2_SECRET_ACCESS_KEY_ENV,
    string
  >
>

/** Explicit client composition options, primarily used by deployment and checks. */
export interface ObjectStorageClientOptions {
  /** Access-key identifier; defaults to the process secret. */
  accessKeyId?: string
  /** Cloudflare account identifier; defaults to the process secret. */
  accountId?: string
  /** S3-compatible endpoint override used by local checks. */
  endpoint?: string
  /** Secret source override used without mutating global process state. */
  env?: ObjectStorageEnv
  /** S3 region token; R2 normally uses `auto`. */
  region?: string
  /** Secret access key; defaults to the process secret. */
  secretAccessKey?: string
}

/** Tenant-resolved object coordinates within one bucket. */
export interface ObjectStorageObjectInput {
  /** Bucket containing the object. */
  bucket: string
  /** Fully resolved, tenant-prefixed object key. */
  key: string
}

/** Constraints captured into a short-lived signed upload grant. */
export interface CreateUploadUrlInput extends ObjectStorageObjectInput {
  /** Optional digest for buffered uploads; streaming browser uploads omit it. */
  contentMd5?: string
  /** Expected byte length when the caller can determine it in advance. */
  contentLength?: number
  /** Media type signed into the upload request. */
  contentType?: string
  /** Signed grant lifetime in seconds. */
  expiresIn?: number
  /** Create-only precondition; null permits idempotent replacement of one exact key. */
  ifNoneMatch?: '*' | null
  /** Non-secret metadata attached to the uploaded object. */
  metadata?: Record<string, string>
}

/** Response overrides captured into a short-lived signed download grant. */
export interface CreateDownloadUrlInput extends ObjectStorageObjectInput {
  /** Signed grant lifetime in seconds. */
  expiresIn?: number
  /** Optional browser-facing content-disposition override. */
  responseContentDisposition?: string
  /** Optional browser-facing media-type override. */
  responseContentType?: string
}

/** Coordinates for deleting one exact object. */
export interface DeleteObjectInput extends ObjectStorageObjectInput {}

/** Coordinates for reading metadata for one exact object. */
export interface HeadObjectInput extends ObjectStorageObjectInput {}

/** Server-side object body and metadata written to exact coordinates. */
export interface PutObjectInput extends ObjectStorageObjectInput {
  /** Complete object body or readable stream. */
  body: Buffer | Readable | Uint8Array
  /** Stored object media type. */
  contentType?: string
  /** Non-secret metadata attached to the stored object. */
  metadata?: Record<string, string>
}

/** Exact source and destination coordinates for a server-side object copy. */
export interface CopyObjectInput {
  /** Default bucket used when source or destination overrides are absent. */
  bucket: string
  /** Optional bucket receiving the copied object. */
  destinationBucket?: string
  /** Exact destination object key. */
  destinationKey: string
  /** Replacement metadata applied when populated. */
  metadata?: Record<string, string>
  /** Optional bucket containing the source object. */
  sourceBucket?: string
  /** Exact source object key. */
  sourceKey: string
}

/** Browser CORS policy inputs for the private object bucket. */
export interface ConfigureBucketCorsInput {
  /** Exact origins allowed to transfer signed objects. */
  allowedOrigins: string[]
  /** Bucket override; defaults to the private TaleLabs bucket. */
  bucket?: string
}

function requireEnvValue(
  env: ObjectStorageEnv,
  name:
    | typeof R2_ACCOUNT_ID_ENV
    | typeof R2_ACCESS_KEY_ID_ENV
    | typeof R2_SECRET_ACCESS_KEY_ENV,
) {
  const value = env[name]

  if (!value)
    throw new Error(`${name} is required to use object storage.`)

  return value
}

function encodeCopySource(bucket: string, key: string) {
  return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** Builds the account-specific R2 S3-compatible endpoint. */
export function getR2Endpoint(accountId: string) {
  return `https://${accountId}.r2.cloudflarestorage.com`
}

/** Preserves the explicit bucket name at the storage boundary. */
export function getObjectStorageBucket(bucket: string) {
  return bucket
}

function assertKeyPart(value: string, name: string) {
  if (!/^[\w-]+$/.test(value))
    throw new Error(`${name} contains unsupported object-key characters.`)

  return value
}

function organizationPrefix(organizationId: string) {
  return `organizations/${assertKeyPart(organizationId, 'organizationId')}`
}

/** Builds tenant-scoped coordinates for a pending upload. */
export function buildUploadObjectKey(organizationId: string, uploadId: string) {
  return `${organizationPrefix(organizationId)}/uploads/${assertKeyPart(uploadId, 'uploadId')}`
}

/** Builds tenant-scoped coordinates for an Asset original. */
export function buildOriginalObjectKey(organizationId: string, assetId: string) {
  return `${organizationPrefix(organizationId)}/originals/${assertKeyPart(assetId, 'assetId')}`
}

/** Builds deterministic tenant and output-index coordinates for generated media. */
export function buildGeneratedObjectKey(
  organizationId: string,
  jobId: string,
  outputIndex: number,
) {
  if (!Number.isSafeInteger(outputIndex) || outputIndex < 0)
    throw new Error('outputIndex must be a non-negative integer.')

  return `${organizationPrefix(organizationId)}/generated/${assertKeyPart(jobId, 'jobId')}/${outputIndex}`
}

/** Builds tenant-scoped coordinates for an Asset thumbnail. */
export function buildThumbnailObjectKey(organizationId: string, assetId: string) {
  return `${organizationPrefix(organizationId)}/thumbnails/${assertKeyPart(assetId, 'assetId')}`
}

/** Creates the shared S3-compatible client from injected or process credentials. */
export function createObjectStorageClient(
  options: ObjectStorageClientOptions = {},
) {
  const env = options.env ?? process.env
  const accountId = options.accountId ?? requireEnvValue(env, R2_ACCOUNT_ID_ENV)
  const accessKeyId = options.accessKeyId
    ?? requireEnvValue(env, R2_ACCESS_KEY_ID_ENV)
  const secretAccessKey = options.secretAccessKey
    ?? requireEnvValue(env, R2_SECRET_ACCESS_KEY_ENV)

  return new S3Client({
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: options.endpoint ?? getR2Endpoint(accountId),
    region: options.region ?? R2_DEFAULT_REGION,
  })
}

/** Process-composed object-storage client reused by server operations. */
export const r2Client = createObjectStorageClient()

/** Signs a create-only PUT grant with the requested transfer constraints. */
export async function createUploadUrl(
  input: CreateUploadUrlInput,
  client = r2Client,
) {
  const command = new PutObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    ContentMD5: input.contentMd5,
    ContentLength: input.contentLength,
    ContentType: input.contentType,
    IfNoneMatch: input.ifNoneMatch === null ? undefined : '*',
    Key: input.key,
    Metadata: input.metadata,
  })
  const presignOptions: SignedUrlOptions = {
    expiresIn: input.expiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_IN,
  }

  return getSignedUrl(client, command, presignOptions)
}

/** Reads authoritative object metadata without downloading the body. */
export async function headObject(
  input: HeadObjectInput,
  client = r2Client,
) {
  return client.send(new HeadObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
  }))
}

/** Downloads one exact object through the server storage client. */
export async function getObject(
  input: ObjectStorageObjectInput,
  client = r2Client,
) {
  return client.send(new GetObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
  }))
}

/** Writes an object directly from a trusted server context. */
export async function putObject(
  input: PutObjectInput,
  client = r2Client,
) {
  await client.send(new PutObjectCommand({
    Body: input.body,
    Bucket: getObjectStorageBucket(input.bucket),
    ContentType: input.contentType,
    Key: input.key,
    Metadata: input.metadata,
  }))
}

/** Signs a short-lived GET grant for one exact object. */
export async function createDownloadUrl(
  input: CreateDownloadUrlInput,
  client = r2Client,
) {
  const command = new GetObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
    ResponseContentDisposition: input.responseContentDisposition,
    ResponseContentType: input.responseContentType,
  })
  const presignOptions: SignedUrlOptions = {
    expiresIn: input.expiresIn ?? DEFAULT_DOWNLOAD_URL_EXPIRES_IN,
  }

  return getSignedUrl(client, command, presignOptions)
}

/** Deletes one exact object from a trusted server context. */
export async function deleteObject(
  input: DeleteObjectInput,
  client = r2Client,
) {
  await client.send(new DeleteObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
  }))
}

/** Copies one object server-side, optionally replacing its metadata. */
export async function copyObject(
  input: CopyObjectInput,
  client = r2Client,
) {
  const bucket = getObjectStorageBucket(input.bucket)
  const sourceBucket = input.sourceBucket ?? bucket
  const destinationBucket = input.destinationBucket ?? bucket
  const commandInput: CopyObjectCommandInput = {
    Bucket: destinationBucket,
    CopySource: encodeCopySource(sourceBucket, input.sourceKey),
    Key: input.destinationKey,
    Metadata: input.metadata,
  }

  if (input.metadata)
    commandInput.MetadataDirective = 'REPLACE'

  await client.send(new CopyObjectCommand(commandInput))
}

/** Applies the minimal signed-transfer CORS policy to an object bucket. */
export async function configureBucketCors(
  input: ConfigureBucketCorsInput,
  client = r2Client,
) {
  await client.send(new PutBucketCorsCommand({
    Bucket: input.bucket ?? TALELABS_PRIVATE_BUCKET,
    CORSConfiguration: {
      CORSRules: [{
        AllowedHeaders: ['content-md5', 'content-type', 'if-none-match'],
        AllowedMethods: ['GET', 'HEAD', 'PUT'],
        AllowedOrigins: input.allowedOrigins,
        ExposeHeaders: ['etag'],
        MaxAgeSeconds: 3600,
      }],
    },
  }))
}
