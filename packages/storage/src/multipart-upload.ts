import type { S3Client } from '@aws-sdk/client-s3'

import { Readable } from 'node:stream'
import { Upload } from '@aws-sdk/lib-storage'

import { getObjectStorageBucket, r2Client } from './client.js'

const STREAM_UPLOAD_PART_BYTES = 8 * 1024 * 1024

export interface PutObjectStreamInput {
  body: AsyncIterable<Uint8Array>
  bucket: string
  contentType?: string
  key: string
  metadata?: Record<string, string>
}

/** Uploads an unknown-length source with bounded-memory multipart buffering. */
export async function putObjectStream(
  input: PutObjectStreamInput,
  client: S3Client = r2Client,
) {
  const upload = new Upload({
    client,
    leavePartsOnError: false,
    params: {
      Body: Readable.from(input.body),
      Bucket: getObjectStorageBucket(input.bucket),
      ContentType: input.contentType,
      Key: input.key,
      Metadata: input.metadata,
    },
    partSize: STREAM_UPLOAD_PART_BYTES,
    queueSize: 1,
  })
  await upload.done()
}
