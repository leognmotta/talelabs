/**
 * Domain contracts for the checked-in generation model catalog.
 *
 * These types document every JSON field while runtime parsing remains in
 * `catalog-schema.ts`. They are provider-client neutral and contain no
 * credentials or mutable runtime state.
 *
 */

/** Media families emitted by current generation models. */
export type CatalogMediaType = 'audio' | 'image' | 'text' | 'video'

/** Canvas node intents that may select a catalog operation. */
export type CatalogNodeType
  = | 'audioGeneration'
    | 'imageGeneration'
    | 'llm'
    | 'musicGeneration'
    | 'soundEffectGeneration'
    | 'speechGeneration'
    | 'videoGeneration'
    | 'voiceChanger'
    | 'voiceIsolation'

/** Product lifecycle of a model record. */
export type CatalogModelStatus = 'active' | 'deprecated' | 'retired'

/** Provider protocols implemented by the OpenRouter boundary. */
export type CatalogProtocol = 'chat' | 'image' | 'speech' | 'video'

/** Provider-neutral graph values accepted by model input slots. */
export type CatalogFlowValueType
  = 'Asset' | 'AudioSet' | 'ImageSet' | 'Text' | 'VideoSet'

/** Scalar values accepted by model settings and conditions. */
export type CatalogSettingValue = boolean | number | string

/** Stable presentation metadata safe to expose to clients. */
export type CatalogModelLogoId
  = | 'alibaba'
    | 'bytedance'
    | 'claude'
    | 'deepseek'
    | 'elevenlabs'
    | 'flux'
    | 'gemini'
    | 'google'
    | 'kling'
    | 'lightricks'
    | 'llm'
    | 'microsoft'
    | 'minimax'
    | 'mistral'
    | 'moonshot'
    | 'nanobanana'
    | 'openai'
    | 'qwen'
    | 'recraft'
    | 'stability'
    | 'xai'
    | 'zai'

/** Stable presentation metadata safe to expose to clients. */
export interface CatalogModelPresentation {
  /** Translation key for the model's user-facing description. */
  descriptionKey: string
  /** Code-owned logo identifier rendered by the dashboard. */
  logoId: CatalogModelLogoId
}

/** One conditional expression used by visibility and constraint rules. */
export type CatalogCondition
  = | CatalogOperationCondition
    | CatalogSettingEqualsCondition
    | CatalogSettingInCondition
    | CatalogSlotCondition

interface CatalogOperationCondition {
  /** Operation discriminator. */
  field: 'operation'
  /** Equality comparison used for operation identity. */
  operator: 'equals'
  /** Stable operation ID being compared. */
  value: string
}

interface CatalogSettingEqualsCondition {
  /** Setting discriminator. */
  field: 'setting'
  /** Stable setting ID being compared. */
  id: string
  /** Equality comparison used for one scalar value. */
  operator: 'equals'
  /** Scalar value required by the condition. */
  value: CatalogSettingValue
}

interface CatalogSettingInCondition {
  /** Setting discriminator. */
  field: 'setting'
  /** Stable setting ID being compared. */
  id: string
  /** Membership comparison used for several allowed values. */
  operator: 'in'
  /** Scalar values accepted by the condition. */
  values: readonly CatalogSettingValue[]
}

interface CatalogSlotCondition {
  /** Input-slot discriminator. */
  field: 'slot'
  /** Stable input slot ID being inspected. */
  id: string
  /** Connectivity comparison used by graph-time rules. */
  operator: 'connected'
}

/** Cross-field model rule evaluated after operation and setting resolution. */
export interface CatalogConstraint {
  /** Conditions that must be false while the rule is active. */
  forbid?: readonly CatalogCondition[]
  /** Stable code identity for diagnostics and snapshots. */
  id: string
  /** Translation key used when the rule is violated. */
  messageKey: string
  /** Conditions that must be true while the rule is active. */
  require?: readonly CatalogCondition[]
  /** Conditions that activate this rule. */
  when: readonly CatalogCondition[]
}

/** Provider-reviewed constraints for one accepted media input. */
export interface CatalogAcceptedMedia {
  /** Accepted width-to-height ratios when the provider constrains them. */
  aspectRatios?: readonly string[]
  /** Accepted duration range in seconds. */
  durationSeconds?: CatalogDurationRange
  /** Accepted frame rates in frames per second. */
  framesPerSecond?: readonly number[]
  /** Maximum byte size for one input item. */
  maxBytes?: number
  /** Accepted MIME types. */
  mimeTypes: readonly string[]
  /** Accepted provider resolution labels. */
  resolutions?: readonly string[]
}

/** Inclusive duration range for one accepted media item. */
export interface CatalogDurationRange {
  /** Maximum duration in seconds. */
  max: number
  /** Minimum duration in seconds. */
  min: number
}

/** Creative guidance attached to a reference input slot. */
export type CatalogReferencePurpose
  = | 'audioGuidance'
    | 'composition'
    | 'firstFrame'
    | 'identity'
    | 'lastFrame'
    | 'motion'
    | 'style'
    | 'subject'
    | 'videoExtension'

/** Creative guidance attached to a reference input slot. */
export interface CatalogReferenceProfile {
  /** Whether TaleLabs should combine references into a contact sheet. */
  contactSheetPolicy: 'never' | 'not-applicable' | 'preferred' | 'supported'
  /** Provider evidence for keeping several subjects distinct. */
  multipleSubjectSupport: 'not-applicable' | 'supported' | 'unknown' | 'unsupported'
  /** Supported creative purposes for this reference slot. */
  purposes: readonly CatalogReferencePurpose[]
  /** Recommended product limit when lower than the provider hard limit. */
  recommendedMaxItems?: number
}

/** One typed input handle exposed by a model record. */
export interface CatalogInputSlot {
  /** Graph value types accepted by the slot. */
  accepts: readonly CatalogFlowValueType[]
  /** Optional provider-reviewed media restrictions. */
  acceptedMedia?: CatalogAcceptedMedia
  /** Translation key for explanatory copy. */
  descriptionKey: string
  /** Stable handle identifier used by graphs and snapshots. */
  id: string
  /** Translation key for the slot label. */
  labelKey: string
  /** Maximum number of connected graph edges. */
  maxConnections: number
  /** Maximum number of runtime collection items consumed together. */
  maxItems: number
  /** Minimum number of connected graph edges. */
  minConnections: number
  /** Optional creative-reference behavior. */
  referenceProfile?: CatalogReferenceProfile
}

/** One selectable enum option for a model setting. */
export interface CatalogSettingOption {
  /** Translation key for the option label. */
  labelKey: string
  /** Stable provider-neutral value persisted in Flows and snapshots. */
  value: string
}

interface CatalogSettingBase {
  /** Whether the dashboard places the setting in advanced controls. */
  advanced?: boolean
  /** Optional translation key for setting guidance. */
  descriptionKey?: string
  /** Stable setting ID persisted in Flows and snapshots. */
  id: string
  /** Translation key for the setting label. */
  labelKey: string
  /** Conditions controlling whether the setting is visible. */
  visibleWhen?: readonly CatalogCondition[]
}

interface CatalogBooleanSetting extends CatalogSettingBase {
  /** Default boolean value. */
  default: boolean
  /** Boolean setting discriminator. */
  kind: 'boolean'
}

interface CatalogEnumSetting extends CatalogSettingBase {
  /** Default stable enum value. */
  default: string
  /** Enum setting discriminator. */
  kind: 'enum'
  /** Complete allowed value set. */
  options: readonly CatalogSettingOption[]
}

interface CatalogNumberSetting extends CatalogSettingBase {
  /** Default numeric value. */
  default: number
  /** Number setting discriminator. */
  kind: 'number'
  /** Inclusive maximum value. */
  max: number
  /** Inclusive minimum value. */
  min: number
  /** UI and validation increment. */
  step: number
}

interface CatalogStringSetting extends CatalogSettingBase {
  /** Default string value. */
  default: string
  /** String setting discriminator. */
  kind: 'string'
  /** Maximum UTF-16 string length accepted by the product contract. */
  maxLength: number
}

/** Model setting with a typed default and validation contract. */
export type CatalogSetting
  = | CatalogBooleanSetting
    | CatalogEnumSetting
    | CatalogNumberSetting
    | CatalogStringSetting

/** Input requirement for one operation slot. */
export interface CatalogOperationInput {
  /** Alternative slots of which at least one must be connected. */
  atLeastOne?: readonly string[]
  /** Mutually exclusive slots grouped with this input. */
  oneOf?: readonly string[]
  /** Whether this slot is always required for the operation. */
  required?: boolean
}

/** Bounded provider output count for one operation. */
export interface CatalogOutputCount {
  /** Default output count when no setting overrides it. */
  default: number
  /** Maximum output count admitted for one job. */
  max: number
  /** Minimum output count admitted for one job. */
  min: number
  /** Optional setting that controls the output count. */
  settingId?: string
}

/** Provider-neutral output contract for one operation. */
export interface CatalogOutput {
  /** Bounded number of outputs created by one job. */
  count: CatalogOutputCount
  /** Media family emitted by the operation. */
  mediaType: CatalogMediaType
}

/** Combined reference budget across operation input slots. */
export interface CatalogReferenceLimit {
  /** Maximum collection items consumed together by one job. */
  maxItems: number
  /** Input slots that share the combined limit. */
  slotIds: readonly string[]
}

/** One creative operation exposed by a product model. */
export interface CatalogOperation {
  /** Translation key for operation guidance. */
  descriptionKey: string
  /** Stable operation identifier persisted in Flows and snapshots. */
  id: string
  /** Per-slot readiness rules keyed by stable slot ID. */
  inputs: Readonly<Record<string, CatalogOperationInput>>
  /** Ordered input slots exposed for this operation. */
  inputSlotIds: readonly string[]
  /** Translation key for the operation label. */
  labelKey: string
  /** Product node intent allowed to select this operation. */
  nodeType: CatalogNodeType
  /** Provider-neutral output contract. */
  output: CatalogOutput
  /** Combined reference budget for one runtime item. */
  referenceLimit: CatalogReferenceLimit
  /** Settings that must be explicitly resolved before execution. */
  requiredSettingIds?: readonly string[]
  /** Ordered settings accepted by the operation. */
  settingIds: readonly string[]
}

/** LLM reasoning modes supported by current text models. */
export type CatalogReasoningMode
  = 'auto' | 'high' | 'low' | 'max' | 'medium' | 'minimal' | 'off' | 'xhigh'

/** Optional text-model capabilities that do not apply to media models. */
export interface CatalogLlmCapability {
  /** Reasoning controls exposed by the text model. */
  reasoning?: CatalogReasoningCapability
}

/** Reasoning controls exposed by a text model. */
export interface CatalogReasoningCapability {
  /** Default reasoning mode for new nodes. */
  default: CatalogReasoningMode
  /** Whether the model always reasons even when controls are hidden. */
  mandatory: boolean
  /** Ordered reasoning modes exposed by the product. */
  options: readonly CatalogReasoningMode[]
}

/** Immutable provider lifecycle captured in an admitted run binding. */
export interface CatalogProviderLifecycle {
  /** Whether the provider supports remote cancellation. */
  cancellation: 'supported' | 'unsupported'
  /** Durable completion signals accepted by the adapter. */
  completions: readonly ('poll' | 'response' | 'webhook')[]
  /** Output delivery forms returned by the adapter. */
  deliveries: readonly ('bytes' | 'stream' | 'text' | 'url')[]
  /** Whether submission completes immediately or creates provider work. */
  submission: 'asynchronous' | 'immediate'
}

/** Request shaping policy for the shared image protocol. */
export interface CatalogImageRequestProfile {
  /** Protocol discriminator. */
  kind: 'image'
  /** Maximum image references sent in one request. */
  maxReferences: number
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Request shaping policy for the shared chat protocol. */
export interface CatalogChatRequestProfile {
  /** Protocol discriminator. */
  kind: 'chat'
  /** Maximum image references sent in one request. */
  maxImageReferences: number
  /** Provider parameter used for the output token bound. */
  maxTokensParameter: 'max_completion_tokens' | 'max_tokens'
  /** Whether the adapter may send reasoning controls. */
  reasoning: boolean
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Request shaping policy for the shared speech protocol. */
export interface CatalogSpeechRequestProfile {
  /** Protocol discriminator. */
  kind: 'speech'
  /** Output formats supported by the reviewed route. */
  outputFormats: readonly ['mp3']
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
  /** TaleLabs voice values mapped to provider-native voice IDs. */
  voiceValues: Readonly<Record<string, string>>
}

/** Request shaping policy for the shared video protocol. */
export interface CatalogVideoRequestProfile {
  /** Whether the protocol sends no frame, a first frame, or first and last frames. */
  frameMode: 'first' | 'first-last' | 'none'
  /** Whether the reviewed operation can request native audio. */
  generateAudio: boolean
  /** Protocol discriminator. */
  kind: 'video'
  /** Additional reference limits by media family. */
  referenceLimits: CatalogVideoReferenceLimits
  /** Named provider-specific input validator, or `none`. */
  referenceValidationPolicy: 'none' | 'seedance-2-reference-v1'
  /** Ordered TaleLabs setting IDs mapped into the request. */
  settingIds: readonly string[]
}

/** Additional non-frame reference limits for a video request. */
export interface CatalogVideoReferenceLimits {
  /** Maximum audio guidance items. */
  audio: number
  /** Maximum image reference items outside frame inputs. */
  image: number
  /** Maximum video reference items. */
  video: number
}

/** Protocol-specific request-shaping policy captured with a binding. */
export type CatalogRequestProfile
  = | CatalogChatRequestProfile
    | CatalogImageRequestProfile
    | CatalogSpeechRequestProfile
    | CatalogVideoRequestProfile

/** Reviewed evidence for a private provider binding. */
export interface CatalogBindingEvidence {
  /** ISO date on which the binding facts were reviewed. */
  reviewedAt: string
  /** Non-empty HTTPS sources used during the review. */
  sources: readonly [string, ...string[]]
}

/** Cost fields recorded by the current provider result boundary. */
export interface CatalogCostCapture {
  /** M5 credit estimate behavior while balances remain deferred. */
  creditCost: 'unknown'
  /** Source and nullability policy for provider cost. */
  providerCostUsd: 'response-or-unknown'
  /** Provider result as the authoritative cost source. */
  source: 'provider-result'
}

/** Private, operation-specific provider route selected during admission. */
export interface CatalogProviderBinding {
  /** Shared protocol adapter version executed by a worker. */
  adapterVersion: string
  /** Provider-cost capture policy preserved from the current route. */
  costCapture: CatalogCostCapture
  /** Reviewed sources for route and capability facts. */
  evidence: CatalogBindingEvidence
  /** Provider endpoint path pinned into a new run snapshot. */
  endpoint:
    | '/api/v1/audio/speech'
    | '/api/v1/chat/completions'
    | '/api/v1/images'
    | '/api/v1/videos'
  /** Durable provider lifecycle executed by Trigger.dev. */
  lifecycle: CatalogProviderLifecycle
  /** Provider-native model identity sent over the wire. */
  nativeModelId: string
  /** Model operation executed by this binding. */
  operationId: string
  /** Ordered fallback priority; higher values are preferred. */
  priority: number
  /** Provider implementation owning the transport. */
  provider: 'openrouter'
  /** Reviewed provider endpoint tag pinned with fallback disabled. */
  providerTag: string
  /** Shared wire protocol used by this route. */
  protocol: CatalogProtocol
  /** Provider request-shaping policy for this operation. */
  requestProfile: CatalogRequestProfile
  /** Whether admission must persist before a paid network submission. */
  requiresDurableSubmissionBoundary: true
  /** Immutable route revision captured for diagnostics and retries. */
  routeVersion: string
  /** Provider routing policy; current OpenRouter routes are pinned. */
  routingPolicy: 'pinned'
  /** Parameters verified on the reviewed provider endpoint. */
  supportedParameters: readonly [string, ...string[]]
}

/** Complete current product model and its private provider bindings. */
export interface CatalogModelRecord {
  /** Binding contracts available when a new run is admitted. */
  bindings: readonly CatalogProviderBinding[]
  /** Capability schema understood by the provider-neutral Flow resolver. */
  capabilitySchemaVersion: 3
  /** Cross-field capability rules. */
  constraints: readonly CatalogConstraint[]
  /** Operation selected before connected inputs derive a more specific mode. */
  defaultOperationId: string
  /** Stable non-localized model name used in product presentation. */
  displayName: string
  /** Canonical `vendor/model` creative identity. */
  id: string
  /** Typed handles exposed across the model's operations. */
  inputSlots: readonly CatalogInputSlot[]
  /** Translation key for the model label. */
  labelKey: string
  /** Optional text-model capability contract. */
  llm?: CatalogLlmCapability
  /** Canonical output media family. */
  mediaType: CatalogMediaType
  /** Creative operations supported by this model revision. */
  operations: readonly CatalogOperation[]
  /** Public presentation metadata. */
  presentation: CatalogModelPresentation
  /** Whether pickers should highlight the model. */
  recommended: boolean
  /** Monotonic per-model capability revision. */
  revision: number
  /** Current selection lifecycle. */
  status: CatalogModelStatus
  /** Typed user settings accepted across operations. */
  settings: readonly CatalogSetting[]
}

/** Root document assembled from the checked-in catalog JSON sources. */
export interface ModelCatalog {
  /** Catalog JSON format version, changed only for structural migrations. */
  catalogVersion: 1
  /** Deterministic SHA-256 identity of every catalog field except this one. */
  catalogRevision: string
  /** Canonical default model IDs by output media family. */
  defaults: Readonly<Record<CatalogMediaType, string>>
  /** Complete current model records. */
  models: readonly CatalogModelRecord[]
}
