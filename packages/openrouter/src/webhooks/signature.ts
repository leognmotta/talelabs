import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

/** Verifies OpenRouter's HMAC against the exact request bytes. */
export function verifyOpenRouterWebhookSignature(input: {
  body: Uint8Array
  now?: Date
  secret: string
  signature: string
}) {
  const parts = input.signature.split(',').map(part => part.trim())
  const timestamp = parts.find(part => part.startsWith('t='))?.slice(2)
  const signatures = parts
    .filter(part => part.startsWith('v1='))
    .map(part => part.slice(3))
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp))
    return false
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1_000)
  const age = nowSeconds - Number(timestamp)
  if (
    !Number.isFinite(age)
    || age < -SIGNATURE_TOLERANCE_SECONDS
    || age > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false
  }

  const hmac = createHmac('sha256', input.secret)
  hmac.update(`${timestamp},`)
  hmac.update(input.body)
  const expected = hmac.digest()
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature))
      return false
    const actual = Buffer.from(signature, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  })
}
