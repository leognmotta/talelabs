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

export const R2_ACCOUNT_ID_ENV = 'R2_ACCOUNT_ID'
export const R2_ACCESS_KEY_ID_ENV = 'R2_ACCESS_KEY_ID'
export const R2_SECRET_ACCESS_KEY_ENV = 'R2_SECRET_ACCESS_KEY'

export const R2_DEFAULT_REGION = 'auto'
export const TALELABS_PRIVATE_BUCKET = 'talelabs-private'
export const TALELABS_PUBLIC_BUCKET = 'talelabs-public'
export const DEFAULT_SIGNED_URL_EXPIRES_IN = 60 * 5
export const DEFAULT_DOWNLOAD_URL_EXPIRES_IN = 60 * 60

export type ObjectStorageEnv = Partial<
  Record<
    | typeof R2_ACCOUNT_ID_ENV
    | typeof R2_ACCESS_KEY_ID_ENV
    | typeof R2_SECRET_ACCESS_KEY_ENV,
    string
  >
>

export interface ObjectStorageClientOptions {
  accessKeyId?: string
  accountId?: string
  endpoint?: string
  env?: ObjectStorageEnv
  region?: string
  secretAccessKey?: string
}

export interface ObjectStorageObjectInput {
  bucket: string
  key: string
}

export interface CreateUploadUrlInput extends ObjectStorageObjectInput {
  contentMd5: string
  contentLength?: number
  contentType?: string
  expiresIn?: number
  ifNoneMatch?: '*'
  metadata?: Record<string, string>
}

export interface CreateDownloadUrlInput extends ObjectStorageObjectInput {
  expiresIn?: number
  responseContentDisposition?: string
  responseContentType?: string
}

export interface DeleteObjectInput extends ObjectStorageObjectInput {}

export interface HeadObjectInput extends ObjectStorageObjectInput {}

export interface PutObjectInput extends ObjectStorageObjectInput {
  body: Buffer | Readable | Uint8Array
  contentType?: string
  metadata?: Record<string, string>
}

export interface CopyObjectInput {
  bucket: string
  destinationBucket?: string
  destinationKey: string
  metadata?: Record<string, string>
  sourceBucket?: string
  sourceKey: string
}

export interface ConfigureBucketCorsInput {
  allowedOrigins: string[]
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

export function getR2Endpoint(accountId: string) {
  return `https://${accountId}.r2.cloudflarestorage.com`
}

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

export function buildUploadObjectKey(organizationId: string, uploadId: string) {
  return `${organizationPrefix(organizationId)}/uploads/${assertKeyPart(uploadId, 'uploadId')}`
}

export function buildOriginalObjectKey(organizationId: string, assetId: string) {
  return `${organizationPrefix(organizationId)}/originals/${assertKeyPart(assetId, 'assetId')}`
}

export function buildGeneratedObjectKey(
  organizationId: string,
  jobId: string,
  outputIndex: number,
) {
  if (!Number.isSafeInteger(outputIndex) || outputIndex < 0)
    throw new Error('outputIndex must be a non-negative integer.')

  return `${organizationPrefix(organizationId)}/generated/${assertKeyPart(jobId, 'jobId')}/${outputIndex}`
}

export function buildThumbnailObjectKey(organizationId: string, assetId: string) {
  return `${organizationPrefix(organizationId)}/thumbnails/${assertKeyPart(assetId, 'assetId')}`
}

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

export const r2Client = createObjectStorageClient()

export async function createUploadUrl(
  input: CreateUploadUrlInput,
  client = r2Client,
) {
  const command = new PutObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    ContentMD5: input.contentMd5,
    ContentLength: input.contentLength,
    ContentType: input.contentType,
    IfNoneMatch: input.ifNoneMatch ?? '*',
    Key: input.key,
    Metadata: input.metadata,
  })
  const presignOptions: SignedUrlOptions = {
    expiresIn: input.expiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_IN,
  }

  return getSignedUrl(client, command, presignOptions)
}

export async function headObject(
  input: HeadObjectInput,
  client = r2Client,
) {
  return client.send(new HeadObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
  }))
}

export async function getObject(
  input: ObjectStorageObjectInput,
  client = r2Client,
) {
  return client.send(new GetObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
  }))
}

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

export async function deleteObject(
  input: DeleteObjectInput,
  client = r2Client,
) {
  await client.send(new DeleteObjectCommand({
    Bucket: getObjectStorageBucket(input.bucket),
    Key: input.key,
  }))
}

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
