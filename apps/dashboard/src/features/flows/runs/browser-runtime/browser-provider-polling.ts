/** Abort-safe browser polling delay for asynchronous generation providers. */

const MIN_PROVIDER_POLL_DELAY_MS = 5_000
const MAX_PROVIDER_POLL_DELAY_MS = 2 * 60 * 1_000
const DEFAULT_PROVIDER_POLL_DELAY_MS = 30_000

function boundedProviderPollDelay(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value))
    return DEFAULT_PROVIDER_POLL_DELAY_MS
  return Math.min(
    MAX_PROVIDER_POLL_DELAY_MS,
    Math.max(MIN_PROVIDER_POLL_DELAY_MS, Math.ceil(value)),
  )
}

/**
 * Waits for one bounded provider-directed polling interval. The abort listener
 * is removed after both normal timeout completion and cancellation, so a long
 * browser generation cannot accumulate listeners between status requests.
 */
export function waitForBrowserProviderPoll(input: {
  /** Provider-supplied delay in milliseconds, or `undefined` after recovery. */
  delayMs: number | undefined
  /** Run-scoped cancellation signal that interrupts the pending wait. */
  signal: AbortSignal
}) {
  const delayMs = boundedProviderPollDelay(input.delayMs)
  return new Promise<void>((resolve, reject) => {
    let timeout: null | ReturnType<typeof globalThis.setTimeout> = null
    function cleanup() {
      if (timeout !== null)
        globalThis.clearTimeout(timeout)
      input.signal.removeEventListener('abort', abort)
    }
    function finish() {
      cleanup()
      resolve()
    }
    function abort() {
      cleanup()
      reject(
        input.signal.reason
        ?? new DOMException('Provider polling canceled', 'AbortError'),
      )
    }

    if (input.signal.aborted) {
      abort()
      return
    }
    timeout = globalThis.setTimeout(finish, delayMs)
    input.signal.addEventListener('abort', abort, { once: true })
  })
}
