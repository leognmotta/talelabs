const SAFE_RUN_FAILURE_MESSAGES = Object.freeze({
  invalid_job_request: 'The generation request could not be validated.',
  invalid_snapshot: 'Run snapshot validation failed.',
  generation_failed: 'Generation could not be completed.',
  /** Historical M5 code retained so existing rows remain presentable. */
  mock_generation_failed: 'Generation could not be completed.',
  run_execution_failed: 'The run could not be completed.',
  trigger_job_stale: 'The generation worker stopped before completion.',
  trigger_parent_failed: 'The run worker stopped before completion.',
  trigger_parent_terminal: 'The run worker stopped before completion.',
  trigger_run_missing: 'The run worker could not be found.',
} as const)

export type SafeRunFailureCode = keyof typeof SAFE_RUN_FAILURE_MESSAGES

export interface SafeRunFailure {
  code: SafeRunFailureCode
  message: string
}

export interface SafeRunFailureBoundary extends SafeRunFailure {
  internal: {
    message: string
    name: string
  }
}

function redactInternalMessage(value: string) {
  return value
    .replaceAll(/https?:\/\/[^\s,)]+/gi, '[redacted-url]')
    .replaceAll(
      /((?:api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*)[^\s,;]+/gi,
      '$1[redacted]',
    )
    .replaceAll(
      /((?:storage[_-]?key|object[_-]?key)\s*[:=]\s*)[^\s,;]+/gi,
      '$1[redacted]',
    )
    .slice(0, 1_000)
}

/** Maps arbitrary worker failures to one stable product-safe persistence shape. */
export function toSafeRunFailure(
  error: unknown,
  code: SafeRunFailureCode = 'run_execution_failed',
): SafeRunFailureBoundary {
  const name = error instanceof Error ? error.name : 'UnknownError'
  const message = error instanceof Error ? error.message : String(error)
  return {
    code,
    internal: {
      message: redactInternalMessage(message),
      name,
    },
    message: SAFE_RUN_FAILURE_MESSAGES[code],
  }
}

/**
 * Presents historical persisted failures through the same allowlist so a raw
 * legacy message can never cross the product API boundary.
 */
export function safeRunFailureForResponse(input: {
  code: null | string
  message: null | string
}): null | SafeRunFailure {
  if (!input.code && !input.message)
    return null
  const code = input.code && input.code in SAFE_RUN_FAILURE_MESSAGES
    ? input.code as SafeRunFailureCode
    : 'run_execution_failed'
  return {
    code,
    message: SAFE_RUN_FAILURE_MESSAGES[code],
  }
}
