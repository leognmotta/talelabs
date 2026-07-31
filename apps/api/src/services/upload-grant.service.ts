/** Signs and verifies versioned Asset upload registration grants. */

import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

import { z } from 'zod'

const UploadGrantFields = {
  grantId: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  key: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  checksum: z.object({
    algorithm: z.literal('md5'),
    value: z.string(),
  }),
  expiresAt: z.number().int().positive(),
}

const UploadGrantSchema = z.discriminatedUnion('version', [
  z.object({ ...UploadGrantFields, version: z.literal(1) }),
  z.object({ ...UploadGrantFields, version: z.literal(2) }),
])

/** Verified legacy or durable upload-grant claims. */
export type UploadGrant = z.infer<typeof UploadGrantSchema>
type DurableUploadGrant = Extract<UploadGrant, { version: 2 }>

function getAppSecret() {
  const secret = process.env.APP_SECRET

  if (!secret)
    throw new Error('APP_SECRET is required.')

  return secret
}

function signPayload(payload: string) {
  return createHmac('sha256', getAppSecret()).update(payload).digest('base64url')
}

/** Creates a durable v2 token whose matching database intent is authoritative. */
export function createUploadGrant(input: Omit<
  DurableUploadGrant,
  'expiresAt' | 'version'
>, expiresInSeconds: number) {
  const grant: DurableUploadGrant = {
    ...input,
    version: 2,
    expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const payload = Buffer.from(JSON.stringify(grant), 'utf8').toString('base64url')

  return {
    grant,
    token: `${payload}.${signPayload(payload)}`,
  }
}

/** Verifies signature, shape, and expiry for legacy v1 and durable v2 tokens. */
export function verifyUploadGrant(token: string) {
  const [payload, signature, ...extra] = token.split('.')

  if (!payload || !signature || extra.length > 0)
    return null

  const expected = signPayload(payload)
  const providedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (
    providedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    )
    const result = UploadGrantSchema.safeParse(decoded)

    if (!result.success || result.data.expiresAt < Math.floor(Date.now() / 1000))
      return null

    return result.data
  }
  catch {
    return null
  }
}
