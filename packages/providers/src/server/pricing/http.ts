/** Bounded server-only HTTP primitives for provider pricing metadata. */

const MAX_PRICING_RESPONSE_BYTES = 2_000_000

/** Reads one successful provider metadata response within a fixed byte bound. */
export async function readProviderPricingJson(response: Response): Promise<unknown> {
  if (!response.ok)
    throw new Error(`provider_pricing_http_${response.status}`)
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_PRICING_RESPONSE_BYTES)
    throw new Error('provider_pricing_response_too_large')
  if (!response.body)
    throw new Error('provider_pricing_response_missing_body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done)
        break
      size += next.value.byteLength
      if (size > MAX_PRICING_RESPONSE_BYTES) {
        await reader.cancel()
        throw new Error('provider_pricing_response_too_large')
      }
      chunks.push(next.value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

/** Combines an optional caller cancellation signal with a bounded timeout. */
export function providerPricingSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}
