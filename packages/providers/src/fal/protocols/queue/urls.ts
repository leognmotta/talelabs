/** Canonical fal queue URLs derived from an immutable binding and request ID. */

/** Complete queue lifecycle URL set for one submitted fal request. */
export interface FalQueueRequestUrls {
  /** Best-effort cancellation endpoint. */
  cancel: string
  /** Completed result endpoint. */
  result: string
  /** Queue status endpoint. */
  status: string
}

/** Builds documented fal queue paths without trusting response-supplied URLs. */
export function falQueueRequestUrls(input: {
  nativeModelId: string
  queueOrigin: string
  requestId: string
}): FalQueueRequestUrls {
  const origin = input.queueOrigin.replace(/\/$/, '')
  const base = `${origin}/${input.nativeModelId}/requests/${encodeURIComponent(input.requestId)}`
  return {
    cancel: `${base}/cancel`,
    result: base,
    status: `${base}/status`,
  }
}
