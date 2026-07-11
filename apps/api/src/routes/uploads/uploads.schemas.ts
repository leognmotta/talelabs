import { z } from '@hono/zod-openapi'

export const UploadChecksumSchema = z.object({
  algorithm: z.literal('md5'),
  // JSON Schema patterns cannot carry JavaScript regex flags.
  // eslint-disable-next-line regexp/use-ignore-case
  value: z.string().regex(/^[A-Za-z0-9+/]{22}==$/, 'Expected a base64 MD5 digest'),
}).openapi('UploadChecksum')

export const CreateUploadRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  checksum: UploadChecksumSchema,
}).openapi('CreateUploadRequest')

export const CreateUploadResponseSchema = z.object({
  uploadUrl: z.url(),
  uploadId: z.string(),
}).openapi('CreateUploadResponse')
