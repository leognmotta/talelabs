/**
 * Server-only fal billing-event lookup for authoritative managed-run costs.
 */

import type { FalRuntimeCredential } from '../../contracts.js'

import { z } from 'zod'
import { readBoundedFalBytes } from '../transport/body.js'
import { FalHttpError } from '../transport/contracts.js'
import {
  falErrorForStatus,
  falRetryAfterMs,
  falTransportError,
} from '../transport/errors.js'

const FAL_BILLING_EVENTS_URL = 'https://api.fal.ai/v1/models/billing-events'
const FAL_BILLING_LOOKBACK_GRACE_MS = 5 * 60 * 1_000
const FAL_BILLING_MAX_RESPONSE_BYTES = 256 * 1_024
const FAL_BILLING_TIMEOUT_MS = 5_000
const FAL_BILLING_MAX_FILTER_VALUES = 50
const falBillingEventsSchema = z.object({
  billing_events: z.array(z.object({
    cost_estimate_nano_usd: z.union([z.number(), z.string()]),
    endpoint_id: z.string(),
    request_id: z.string(),
  }).loose()).max(100),
}).loose()

/** Exact Fal request identity used for durable billing-event reconciliation. */
export interface FalGenerationCostQuery {
  /** Immutable provider-native endpoint captured at run admission. */
  endpointId: string
  /** Fal queue request ID persisted immediately after submission. */
  requestId: string
  /** Write-ahead submission instant bounding the billing-event search. */
  submittedAt: Date
}

/** Exact Fal billing-event lookup used by durable accounting reconciliation. */
export interface FalGenerationCostLookup {
  /** Returns one actual discounted USD cost when Fal has published the event. */
  lookup: (input: FalGenerationCostQuery) => Promise<number | undefined>
  /**
   * Returns costs in input order for up to 50 exact requests using one Fal
   * billing-events query. Missing or invalid events remain `undefined`.
   */
  lookupMany: (
    input: readonly FalGenerationCostQuery[],
  ) => Promise<readonly (number | undefined)[]>
}

function falNanoUsdCost(value: number | string) {
  const nanoUsd = Number(value)
  if (
    !Number.isSafeInteger(nanoUsd)
    || nanoUsd < 0
  ) {
    return undefined
  }
  return nanoUsd / 1_000_000_000
}

function falBillingEventKey(input: {
  endpointId: string
  requestId: string
}) {
  return `${input.endpointId}\u0000${input.requestId}`
}

/** Creates a bounded Fal Platform API accounting lookup with injected auth. */
export function createFalGenerationCostLookup(input: {
  /** Runtime-only Fal credential; its plaintext value is never returned. */
  credential: FalRuntimeCredential
  /** Optional fake fetch used by offline provider verification. */
  fetch?: typeof globalThis.fetch
  /** Optional request timeout override used by bounded reconciliation checks. */
  timeoutMs?: number
}): FalGenerationCostLookup {
  const fetchImplementation = input.fetch ?? globalThis.fetch
  const lookupMany = async (
    queries: readonly FalGenerationCostQuery[],
  ): Promise<readonly (number | undefined)[]> => {
    if (queries.length === 0)
      return []
    if (queries.length > FAL_BILLING_MAX_FILTER_VALUES)
      throw new TypeError('fal_billing_filter_limit_exceeded')

    let apiKey: string
    try {
      apiKey = (input.credential.resolveApiKey() ?? '').trim()
      if (!apiKey)
        throw new TypeError('fal_api_key_missing')
    }
    catch {
      throw new FalHttpError({ code: 'authentication', retryable: false })
    }
    const endpointIds = [...new Set(queries.map(query => query.endpointId))]
    const requestIds = [...new Set(queries.map(query => query.requestId))]
    const earliestSubmittedAt = Math.min(
      ...queries.map(query => query.submittedAt.getTime()),
    )
    const url = new URL(FAL_BILLING_EVENTS_URL)
    for (const endpointId of endpointIds)
      url.searchParams.append('endpoint_id', endpointId)
    url.searchParams.set('limit', String(queries.length))
    for (const requestId of requestIds)
      url.searchParams.append('request_id', requestId)
    url.searchParams.set(
      'start',
      new Date(
        earliestSubmittedAt - FAL_BILLING_LOOKBACK_GRACE_MS,
      ).toISOString(),
    )
    const signal = AbortSignal.timeout(input.timeoutMs ?? FAL_BILLING_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetchImplementation(url, {
        headers: { Authorization: `Key ${apiKey}` },
        method: 'GET',
        signal,
      })
    }
    catch (error) {
      throw falTransportError(error, signal)
    }
    const bytes = await readBoundedFalBytes(
      response,
      FAL_BILLING_MAX_RESPONSE_BYTES,
    )
    if (!response.ok) {
      throw falErrorForStatus(
        response.status,
        falRetryAfterMs(response.headers.get('retry-after')),
        null,
      )
    }
    let payload: z.infer<typeof falBillingEventsSchema>
    try {
      payload = falBillingEventsSchema.parse(
        JSON.parse(new TextDecoder().decode(bytes)),
      )
    }
    catch {
      throw new FalHttpError({
        code: 'malformed_response',
        retryable: false,
        status: response.status,
      })
    }
    const costByRequest = new Map<string, number>()
    for (const event of payload.billing_events) {
      const cost = falNanoUsdCost(event.cost_estimate_nano_usd)
      if (cost !== undefined) {
        costByRequest.set(falBillingEventKey({
          endpointId: event.endpoint_id,
          requestId: event.request_id,
        }), cost)
      }
    }
    return queries.map(query => costByRequest.get(falBillingEventKey(query)))
  }
  return {
    lookup: async query => (await lookupMany([query]))[0],
    lookupMany,
  }
}
