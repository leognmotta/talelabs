/**
 * Provider-neutral lifecycle, request, result, and adapter contracts shared by
 * durable orchestration and provider packages.
 */

import type {
  GenerationOutputType,
  GenerationSettingValue,
} from '../registry/types.js'

/** Supported output delivery mechanisms at the normalized adapter boundary. */
export type GenerationProviderDelivery
  = | 'bytes'
    | 'storage'
    | 'stream'
    | 'text'
    | 'url'
/** Supported provider completion notification mechanisms. */
export type GenerationProviderCompletion = 'poll' | 'response' | 'webhook'
/** Cancellation behavior promised by one immutable provider binding. */
export type GenerationProviderCancellation
  = | 'best-effort'
    | 'supported'
    | 'unsupported'

interface GenerationProviderLifecycleBase {
  cancellation: GenerationProviderCancellation
  deliveries: readonly [GenerationProviderDelivery, ...GenerationProviderDelivery[]]
}

/** Valid completion combinations for asynchronous provider submissions. */
export type GenerationProviderAsyncCompletions
  = | readonly ['poll']
    | readonly ['poll', 'webhook']
    | readonly ['webhook']
    | readonly ['webhook', 'poll']

/** Lifecycle contract for a provider call completed by its initial response. */
export type ImmediateGenerationProviderLifecycle
  = GenerationProviderLifecycleBase & {
    completions: readonly ['response']
    submission: 'immediate'
  }

/** Lifecycle contract for a durably submitted asynchronous provider job. */
export type AsyncGenerationProviderLifecycle
  = GenerationProviderLifecycleBase & {
    completions: GenerationProviderAsyncCompletions
    submission: 'asynchronous'
  }

/** Provider-independent execution behavior advertised by one private route. */
export type GenerationProviderLifecycle
  = | AsyncGenerationProviderLifecycle
    | ImmediateGenerationProviderLifecycle

const GENERATION_PROVIDER_LIFECYCLE_KEYS = [
  'cancellation',
  'completions',
  'deliveries',
  'submission',
] as const

function lifecycleValuesEqual(
  expected: readonly string[],
  actual: unknown,
) {
  return Array.isArray(actual)
    && expected.length === actual.length
    && expected.every((value, index) => value === actual[index])
}

/** Compares lifecycle JSON structurally without depending on object key order. */
export function generationProviderLifecyclesEqual(
  expected: GenerationProviderLifecycle | null | undefined,
  actual: unknown,
) {
  if (expected == null)
    return actual == null
  if (!actual || typeof actual !== 'object' || Array.isArray(actual))
    return false
  const candidate = actual as Record<string, unknown>
  if (
    Object.keys(candidate).length !== GENERATION_PROVIDER_LIFECYCLE_KEYS.length
    || !GENERATION_PROVIDER_LIFECYCLE_KEYS.every(key => Object.hasOwn(candidate, key))
  ) {
    return false
  }
  return expected.cancellation === candidate.cancellation
    && expected.submission === candidate.submission
    && lifecycleValuesEqual(expected.completions, candidate.completions)
    && lifecycleValuesEqual(expected.deliveries, candidate.deliveries)
}

/** One ordered inline or connected text fragment retained for provenance. */
export interface NormalizedGenerationTextPart {
  edgeId: null | string
  itemKey: null | string
  order: number
  source: 'connected' | 'inline'
  sourceNodeId: null | string
  text: string
}

/** One structured prompt token resolved to an exact provider Asset input. */
export interface NormalizedGenerationPromptInputReference {
  /** Canonical Asset ID supplied to the provider request. */
  assetId: string
  /** Zero-based selected position within the semantic input slot. */
  index: number
  /** Runtime item identity that carried the Asset. */
  itemKey: string
  /** Media family verified against the prompt token. */
  mediaType: 'audio' | 'image' | 'video'
  /** Zero-based position of the token in the structured prompt. */
  partIndex: number
  /** Stable semantic input slot referenced by the token. */
  slotId: string
  /** Upstream Flow node that supplied the Asset. */
  sourceNodeId: string
}

/**
 * One semantic text field as seen by a provider adapter. Connected text is
 * authoritative while the inline draft remains frozen for provenance.
 */
export interface NormalizedGenerationTextSlot {
  /** Exact input mappings used while resolving a structured inline prompt. */
  inputReferences: readonly NormalizedGenerationPromptInputReference[]
  parts: readonly NormalizedGenerationTextPart[]
  resolvedText: string
  slotId: string
  source: 'connected' | 'inline'
}

/** One ordered, tenant-validated Asset reference passed to a provider adapter. */
export interface NormalizedGenerationMediaAsset {
  assetId: string
  mediaType: 'audio' | 'document' | 'image' | 'video'
  order: number
}

/** One materialized runtime item with its dimensions, text, and Assets. */
export interface NormalizedGenerationInputItem {
  assets: readonly NormalizedGenerationMediaAsset[]
  dimensions: Readonly<Record<string, string>>
  itemKey: string
  text: null | string
}

/** Exact edge, slot, item, and Asset ordering presented to the adapter. */
export interface NormalizedGenerationOrderedInput {
  edgeId: string
  items: readonly NormalizedGenerationInputItem[]
  order: number
  sourceHandleId: string
  sourceNodeId: string
  targetSlotId: string
}

/** Immutable provider-neutral request derived from one admitted job payload. */
export interface NormalizedGenerationRequest {
  adapterRequestVersion: 3
  catalogRevision: string
  catalogVersion: number
  itemKey: string
  modelContractVersion: string
  nodeId: string
  operationId: string
  orderedInputs: readonly NormalizedGenerationOrderedInput[]
  outputCount: number
  productModelId: string
  modelRevision: number
  requestId: string
  requestIndex: number
  requestPayloadHash: string
  settings: Readonly<Record<string, GenerationSettingValue>>
  textSlots: readonly NormalizedGenerationTextSlot[]
}

/** Valid normalized output deliveries returned by provider implementations. */
export type NormalizedGenerationMediaPayload
  = | {
    bytes: Uint8Array
    delivery: 'bytes'
    mimeType: string
  }
  | {
    delivery: 'text'
    mimeType: 'text/plain'
    text: string
  }
  | {
    chunks: AsyncIterable<Uint8Array>
    delivery: 'stream'
    mimeType: string
  }
  | {
    bucket: string
    delivery: 'storage'
    key: string
    mimeType: string
  }
  | {
    delivery: 'url'
    expiresAt?: string
    mimeType: string
    url: string
  }

/** One deterministically indexed provider output awaiting Asset finalization. */
export interface NormalizedGenerationOutput {
  mediaType: GenerationOutputType
  metadata?: Readonly<Record<string, boolean | number | string>>
  outputIndex: number
  payload: NormalizedGenerationMediaPayload
}

/** Safe provider facts that may be persisted independently from output bytes. */
export interface NormalizedGenerationProviderFacts {
  providerCostUsd?: number
  providerGenerationId?: string
}

/** Trusted execution context supplied by the run engine, never by a Flow. */
export interface NormalizedGenerationSubmissionContext {
  callbackUrl?: string
}

/** Initial provider result before durable orchestration continues or completes. */
export type NormalizedGenerationSubmission
  = | {
    facts?: NormalizedGenerationProviderFacts
    outputs: readonly NormalizedGenerationOutput[]
    status: 'completed'
  }
  | {
    externalJobId: string
    facts?: NormalizedGenerationProviderFacts
    pollAfterMs?: number
    status: 'submitted'
  }

/** Normalized terminal or pending result from poll or webhook completion. */
export type NormalizedGenerationCompletionResult
  = | {
    facts?: NormalizedGenerationProviderFacts
    pollAfterMs?: number
    status: 'pending'
  }
  | {
    facts?: NormalizedGenerationProviderFacts
    outputs: readonly NormalizedGenerationOutput[]
    status: 'completed'
  }
  | {
    code: string
    facts?: NormalizedGenerationProviderFacts
    message: string
    retryable: boolean
    status: 'failed'
  }

/** Result contract returned by one provider polling attempt. */
export type NormalizedGenerationPollResult = NormalizedGenerationCompletionResult

/** Terminal, signature-verified output of a provider-specific webhook parser. */
export interface NormalizedGenerationWebhookCompletion {
  eventId?: string
  externalJobId: string
  result: Exclude<NormalizedGenerationCompletionResult, { status: 'pending' }>
}

/** Raw signature-bearing webhook input passed to a provider normalizer. */
export interface NormalizedGenerationWebhookRequest {
  body: Uint8Array
  headers: Readonly<Record<string, string>>
}

/** Provider cancellation acknowledgement and terminality. */
export interface NormalizedGenerationCancellationResult {
  accepted: boolean
  final: boolean
}

type CompletedGenerationSubmission = Extract<
  NormalizedGenerationSubmission,
  { status: 'completed' }
>
type SubmittedGenerationSubmission = Extract<
  NormalizedGenerationSubmission,
  { status: 'submitted' }
>
type GenerationSubmit<Result extends NormalizedGenerationSubmission> = (
  request: NormalizedGenerationRequest,
  context?: NormalizedGenerationSubmissionContext,
) => Promise<Result>
type GenerationPrepare<Result extends NormalizedGenerationSubmission> = (
  request: NormalizedGenerationRequest,
  context?: NormalizedGenerationSubmissionContext,
) => Promise<() => Promise<Result>>
type GenerationPoll = (
  externalJobId: string,
) => Promise<NormalizedGenerationPollResult>
type GenerationWebhookNormalizer = (
  request: NormalizedGenerationWebhookRequest,
) => Promise<NormalizedGenerationWebhookCompletion>
type GenerationCancel = (
  externalJobId: string,
) => Promise<NormalizedGenerationCancellationResult>
type GenerationFactsReconciler = (
  facts: NormalizedGenerationProviderFacts,
) => Promise<NormalizedGenerationProviderFacts | undefined>

interface ImmediateGenerationAdapter {
  lifecycle: ImmediateGenerationProviderLifecycle
  normalizeWebhook?: never
  poll?: never
  prepare?: GenerationPrepare<CompletedGenerationSubmission>
  submit: GenerationSubmit<CompletedGenerationSubmission>
}

interface PollGenerationAdapter {
  lifecycle: AsyncGenerationProviderLifecycle & {
    completions: readonly ['poll']
  }
  normalizeWebhook?: never
  poll: GenerationPoll
  prepare?: GenerationPrepare<SubmittedGenerationSubmission>
  submit: GenerationSubmit<SubmittedGenerationSubmission>
}

interface WebhookGenerationAdapter {
  lifecycle: AsyncGenerationProviderLifecycle & {
    completions: readonly ['webhook']
  }
  normalizeWebhook: GenerationWebhookNormalizer
  poll?: never
  prepare?: GenerationPrepare<SubmittedGenerationSubmission>
  submit: GenerationSubmit<SubmittedGenerationSubmission>
}

interface PollAndWebhookGenerationAdapter {
  lifecycle: AsyncGenerationProviderLifecycle & {
    completions: readonly ['poll', 'webhook'] | readonly ['webhook', 'poll']
  }
  normalizeWebhook: GenerationWebhookNormalizer
  poll: GenerationPoll
  prepare?: GenerationPrepare<SubmittedGenerationSubmission>
  submit: GenerationSubmit<SubmittedGenerationSubmission>
}

interface UnsupportedCancellationAdapter {
  cancel?: never
  lifecycle: GenerationProviderLifecycle & { cancellation: 'unsupported' }
}

interface CancellableGenerationAdapter {
  cancel: GenerationCancel
  lifecycle: GenerationProviderLifecycle & {
    cancellation: 'best-effort' | 'supported'
  }
}

/**
 * Normalized adapter boundary. Its discriminants require every method promised
 * by lifecycle metadata. It knows nothing about graph planning, persistence,
 * native routes, or credentials.
 */
export type NormalizedGenerationProviderAdapter
  = (
    | ImmediateGenerationAdapter
    | PollAndWebhookGenerationAdapter
    | PollGenerationAdapter
    | WebhookGenerationAdapter
  ) & (
    | CancellableGenerationAdapter
    | UnsupportedCancellationAdapter
  ) & {
    /** Best-effort accounting enrichment performed after output checkpointing. */
    reconcileFacts?: GenerationFactsReconciler
  }

/** Validates lifecycle combinations before they are admitted or executed. */
export function validateGenerationProviderLifecycle(
  lifecycle: GenerationProviderLifecycle,
) {
  const errors: string[] = []
  const completions = lifecycle.completions as readonly GenerationProviderCompletion[]
  if (!lifecycle.deliveries.length || new Set(lifecycle.deliveries).size !== lifecycle.deliveries.length)
    errors.push('delivery modes must be non-empty and unique')
  if (!lifecycle.completions.length || new Set(lifecycle.completions).size !== lifecycle.completions.length)
    errors.push('completion modes must be non-empty and unique')
  if (
    lifecycle.submission === 'immediate'
    && (lifecycle.completions.length !== 1 || lifecycle.completions[0] !== 'response')
  ) {
    errors.push('immediate submissions must complete in the response')
  }
  if (
    lifecycle.submission === 'asynchronous'
    && completions.includes('response')
  ) {
    errors.push('asynchronous submissions must complete through poll or webhook')
  }
  return errors
}
