import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

import { z } from 'zod'

const UploadGrantSchema = z.object({
  version: z.literal(1),
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
})

export type UploadGrant = z.infer<typeof UploadGrantSchema>

function getAppSecret() {
  const secret = process.env.APP_SECRET

  if (!secret)
    throw new Error('APP_SECRET is required.')

  return secret
}

function signPayload(payload: string) {
  return createHmac('sha256', getAppSecret()).update(payload).digest('base64url')
}

export function createUploadGrant(input: Omit<
  UploadGrant,
  'expiresAt' | 'version'
>, expiresInSeconds: number) {
  const grant: UploadGrant = {
    ...input,
    version: 1,
    expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }
  const payload = Buffer.from(JSON.stringify(grant), 'utf8').toString('base64url')

  return {
    grant,
    token: `${payload}.${signPayload(payload)}`,
  }
}

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
