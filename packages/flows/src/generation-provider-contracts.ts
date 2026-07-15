import type {
  GenerationOutputType,
  GenerationSettingValue,
} from './generation-registry-types.js'

export type GenerationProviderDelivery
  = | 'bytes'
    | 'storage'
    | 'stream'
    | 'text'
    | 'url'
export type GenerationProviderCompletion = 'poll' | 'response' | 'webhook'
export type GenerationProviderCancellation
  = | 'best-effort'
    | 'supported'
    | 'unsupported'

interface GenerationProviderLifecycleBase {
  cancellation: GenerationProviderCancellation
  deliveries: readonly [GenerationProviderDelivery, ...GenerationProviderDelivery[]]
}

export type GenerationProviderAsyncCompletions
  = | readonly ['poll']
    | readonly ['poll', 'webhook']
    | readonly ['webhook']
    | readonly ['webhook', 'poll']

export type ImmediateGenerationProviderLifecycle
  = GenerationProviderLifecycleBase & {
    completions: readonly ['response']
    submission: 'immediate'
  }

export type AsyncGenerationProviderLifecycle
  = GenerationProviderLifecycleBase & {
    completions: GenerationProviderAsyncCompletions
    submission: 'asynchronous'
  }

/** Provider-independent execution behavior advertised by one private route. */
export type GenerationProviderLifecycle
  = | AsyncGenerationProviderLifecycle
    | ImmediateGenerationProviderLifecycle

export interface NormalizedGenerationTextPart {
  edgeId: null | string
  itemKey: null | string
  order: number
  source: 'connected' | 'inline'
  sourceNodeId: null | string
  text: string
}

/**
 * One semantic text field as seen by a provider adapter. Connected text is
 * authoritative while the inline draft remains frozen for provenance.
 */
export interface NormalizedGenerationTextSlot {
  parts: readonly NormalizedGenerationTextPart[]
  resolvedText: string
  slotId: string
  source: 'connected' | 'inline'
}

export interface NormalizedGenerationMediaAsset {
  assetId: string
  mediaType: 'audio' | 'document' | 'image' | 'video'
  order: number
}

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

export interface NormalizedGenerationRequest {
  adapterRequestVersion: 1
  itemKey: string
  modelContractVersion: string
  nodeId: string
  operationId: string
  orderedInputs: readonly NormalizedGenerationOrderedInput[]
  outputCount: number
  productModelId: string
  requestId: string
  requestIndex: number
  requestPayloadHash: string
  settings: Readonly<Record<string, GenerationSettingValue>>
  textSlots: readonly NormalizedGenerationTextSlot[]
}

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

export interface NormalizedGenerationOutput {
  mediaType: GenerationOutputType
  metadata?: Readonly<Record<string, boolean | number | string>>
  outputIndex: number
  payload: NormalizedGenerationMediaPayload
}

export type NormalizedGenerationSubmission
  = | {
    outputs: readonly NormalizedGenerationOutput[]
    status: 'completed'
  }
  | {
    externalJobId: string
    pollAfterMs?: number
    status: 'submitted'
  }

export type NormalizedGenerationCompletionResult
  = | {
    pollAfterMs?: number
    status: 'pending'
  }
  | {
    outputs: readonly NormalizedGenerationOutput[]
    status: 'completed'
  }
  | {
    code: string
    message: string
    retryable: boolean
    status: 'failed'
  }

export type NormalizedGenerationPollResult = NormalizedGenerationCompletionResult

/** Terminal, signature-verified output of a provider-specific webhook parser. */
export interface NormalizedGenerationWebhookCompletion {
  eventId?: string
  externalJobId: string
  result: Exclude<NormalizedGenerationCompletionResult, { status: 'pending' }>
}

export interface NormalizedGenerationWebhookRequest {
  body: Uint8Array
  headers: Readonly<Record<string, string>>
}

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
) => Promise<Result>
type GenerationPoll = (
  externalJobId: string,
) => Promise<NormalizedGenerationPollResult>
type GenerationWebhookNormalizer = (
  request: NormalizedGenerationWebhookRequest,
) => Promise<NormalizedGenerationWebhookCompletion>
type GenerationCancel = (
  externalJobId: string,
) => Promise<NormalizedGenerationCancellationResult>

interface ImmediateGenerationAdapter {
  lifecycle: ImmediateGenerationProviderLifecycle
  normalizeWebhook?: never
  poll?: never
  submit: GenerationSubmit<CompletedGenerationSubmission>
}

interface PollGenerationAdapter {
  lifecycle: AsyncGenerationProviderLifecycle & {
    completions: readonly ['poll']
  }
  normalizeWebhook?: never
  poll: GenerationPoll
  submit: GenerationSubmit<SubmittedGenerationSubmission>
}

interface WebhookGenerationAdapter {
  lifecycle: AsyncGenerationProviderLifecycle & {
    completions: readonly ['webhook']
  }
  normalizeWebhook: GenerationWebhookNormalizer
  poll?: never
  submit: GenerationSubmit<SubmittedGenerationSubmission>
}

interface PollAndWebhookGenerationAdapter {
  lifecycle: AsyncGenerationProviderLifecycle & {
    completions: readonly ['poll', 'webhook'] | readonly ['webhook', 'poll']
  }
  normalizeWebhook: GenerationWebhookNormalizer
  poll: GenerationPoll
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
  )

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
