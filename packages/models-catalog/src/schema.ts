/**
 * Domain contracts for the checked-in generation model catalog.
 *
 * These types document every JSON field while runtime parsing remains in
 * `catalog-schema.ts`. They are provider-client neutral and contain no
 * credentials or mutable runtime state.
 *
 */

import type { CatalogProviderBinding } from './providers/schema.js'

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
