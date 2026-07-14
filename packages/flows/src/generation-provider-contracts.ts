import type {
  GenerationOutputType,
  GenerationSelectedProviderInput,
  GenerationSettingValue,
} from './generation-registry-types.js'

export type GenerationProviderDelivery = 'bytes' | 'stream' | 'text' | 'url'
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

export interface NormalizedGenerationRequest {
  context?: string
  inputs: readonly GenerationSelectedProviderInput[]
  modelContractVersion: string
  operationId: string
  outputCount: number
  productModelId: string
  prompt?: string
  requestId: string
  settings: Readonly<Record<string, GenerationSettingValue>>
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
    delivery: 'url'
    expiresAt?: string
    mimeType: string
    url: string
  }

export interface NormalizedGenerationOutput {
  mediaType: GenerationOutputType
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
