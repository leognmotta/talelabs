/**
 * Product-safe Flow-run failure persistence and response projection.
 *
 */

import {
  GenerationProviderError,
  sanitizeProviderPublicMessage,
} from '../../generation/adapters/errors.js'
import {
  isGenerationProviderFailureCode,
  serializedErrorProperty,
  serializedProviderFailure,
} from './provider-decoder.js'

const SAFE_RUN_FAILURE_MESSAGES = Object.freeze({
  invalid_job_request: 'The generation request could not be validated.',
  invalid_snapshot: 'Run snapshot validation failed.',
  generation_failed: 'Generation could not be completed.',
  /** Historical M5 code retained so existing rows remain presentable. */
  mock_generation_failed: 'Generation could not be completed.',
  provider_authentication: 'The generation provider could not be authenticated.',
  provider_insufficient_balance: 'Something went wrong. Contact support.',
  provider_rate_limited: 'The generation provider is busy. Try again shortly.',
  provider_rejected: 'The generation provider rejected this request.',
  provider_response_invalid: 'The generation provider returned an invalid response.',
  provider_submission_uncertain: 'The generation submission could not be safely retried.',
  provider_timeout: 'The generation provider took too long to respond.',
  provider_unavailable: 'The generation provider is temporarily unavailable.',
  run_execution_failed: 'The run could not be completed.',
  trigger_job_stale: 'The generation worker stopped before completion.',
  trigger_parent_failed: 'The run worker stopped before completion.',
  trigger_parent_terminal: 'The run worker stopped before completion.',
  trigger_run_missing: 'The run worker could not be found.',
} as const)

/** Stable public failure codes persisted for Flow runs and jobs. */
export type SafeRunFailureCode = keyof typeof SAFE_RUN_FAILURE_MESSAGES

/** Product-safe failure fields exposed outside the worker boundary. */
export interface SafeRunFailure {
  code: SafeRunFailureCode
  message: string
}

/** Safe public fields plus redacted diagnostics retained for internal logging. */
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
  const serializedFailure = error instanceof GenerationProviderError
    ? null
    : serializedProviderFailure(error)
  const resolvedCode = error instanceof GenerationProviderError
    ? error.code
    : serializedFailure?.code ?? code
  const name = error instanceof Error
    ? error.name
    : serializedErrorProperty(error, 'name') ?? 'UnknownError'
  const message = error instanceof Error
    ? error.message
    : serializedErrorProperty(error, 'message') ?? String(error)
  const providerPublicMessage = error instanceof GenerationProviderError
    ? error.publicMessage
    : serializedFailure?.publicMessage
      ?? serializedErrorProperty(error, 'publicMessage')
  return {
    code: resolvedCode,
    internal: {
      message: redactInternalMessage(message),
      name,
    },
    message: isGenerationProviderFailureCode(resolvedCode)
      && resolvedCode !== 'provider_insufficient_balance'
      ? sanitizeProviderPublicMessage(providerPublicMessage)
      ?? SAFE_RUN_FAILURE_MESSAGES[resolvedCode]
      : SAFE_RUN_FAILURE_MESSAGES[resolvedCode],
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
    message: isGenerationProviderFailureCode(code)
      && code !== 'provider_insufficient_balance'
      ? sanitizeProviderPublicMessage(input.message)
      ?? SAFE_RUN_FAILURE_MESSAGES[code]
      : SAFE_RUN_FAILURE_MESSAGES[code],
  }
}
