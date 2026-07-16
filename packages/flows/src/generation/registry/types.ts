/**
 * Flow-facing generation capability and model-definition contracts that exclude
 * private provider bindings and credentials.
 */

import type { FlowValueType } from '../../graph/types.js'

/** Asset-backed media that can participate in generation reference selection. */
export type GenerationMediaType = 'audio' | 'image' | 'video'
/** Every output family supported by the curated creative-model catalog. */
export type GenerationOutputType = GenerationMediaType | 'text'
/** Canvas generation-node intents supported by current model operations. */
export type GenerationNodeType
  = | 'audioGeneration'
    | 'imageGeneration'
    | 'llm'
    | 'musicGeneration'
    | 'soundEffectGeneration'
    | 'speechGeneration'
    | 'videoGeneration'
    | 'voiceChanger'
    | 'voiceIsolation'

/** Scalar setting values persisted in Flow drafts and immutable snapshots. */
export type GenerationSettingValue = boolean | number | string

/** Resolved UI and validation availability for one model input slot. */
export type GenerationInputAvailability
  = | { state: 'unsupported' }
    | { state: 'available' }
    | { connectionCount: number, itemCount: number, state: 'connected' }
    | {
      conflictingSlotIds: readonly string[]
      reasonKey: string
      state: 'blocked'
    }
    | { reasonKey: string, state: 'full' }

/** Fixed condition vocabulary for visibility and cross-field constraints. */
export type GenerationConditionDefinition
  = | {
    field: 'operation'
    operator: 'equals'
    value: string
  }
  | {
    field: 'setting'
    id: string
    operator: 'equals'
    value: GenerationSettingValue
  }
  | {
    field: 'setting'
    id: string
    operator: 'in'
    values: readonly GenerationSettingValue[]
  }
  | {
    field: 'slot'
    id: string
    operator: 'connected'
  }

/** One provider-neutral cross-field rule owned by a model contract. */
export interface GenerationConstraintDefinition {
  forbid?: readonly GenerationConditionDefinition[]
  id: string
  messageKey: string
  require?: readonly GenerationConditionDefinition[]
  when: readonly GenerationConditionDefinition[]
}

/** Typed setting definition with a stable persisted identifier and default. */
export type GenerationSettingDefinition
  = | {
    advanced?: boolean
    default: boolean
    descriptionKey?: string
    id: string
    kind: 'boolean'
    labelKey: string
    visibleWhen?: readonly GenerationConditionDefinition[]
  }
  | {
    advanced?: boolean
    default: string
    descriptionKey?: string
    id: string
    kind: 'string'
    labelKey: string
    maxLength: number
    visibleWhen?: readonly GenerationConditionDefinition[]
  }
  | {
    advanced?: boolean
    default: number
    descriptionKey?: string
    id: string
    kind: 'number'
    labelKey: string
    max: number
    min: number
    step: number
    visibleWhen?: readonly GenerationConditionDefinition[]
  }
  | {
    advanced?: boolean
    default: string
    descriptionKey?: string
    id: string
    kind: 'enum'
    labelKey: string
    options: readonly { labelKey: string, value: string }[]
    visibleWhen?: readonly GenerationConditionDefinition[]
  }

/** Creative roles that an accepted reference Asset may serve. */
export type GenerationReferencePurpose
  = | 'audioGuidance'
    | 'composition'
    | 'firstFrame'
    | 'identity'
    | 'lastFrame'
    | 'motion'
    | 'style'
    | 'subject'
    | 'videoExtension'

/** Evidence-backed provider support for keeping several subjects distinct. */
export type GenerationMultipleSubjectSupport
  = | 'not-applicable'
    | 'supported'
    | 'unknown'
    | 'unsupported'

/** Product policy for combining several visual references into one input. */
export type GenerationContactSheetPolicy
  = | 'never'
    | 'not-applicable'
    | 'preferred'
    | 'supported'

/** Creative-reference semantics attached to one model input slot. */
export interface GenerationReferenceProfile {
  contactSheetPolicy: GenerationContactSheetPolicy
  multipleSubjectSupport: GenerationMultipleSubjectSupport
  purposes: readonly GenerationReferencePurpose[]
  /** A researched guidance limit. Omitted when no lower limit than maxItems is evidenced. */
  recommendedMaxItems?: number
}

/** Provider-reviewed restrictions for Asset media accepted by one slot. */
export interface GenerationAcceptedMediaConstraints {
  aspectRatios?: readonly string[]
  durationSeconds?: { max: number, min: number }
  framesPerSecond?: readonly number[]
  maxBytes?: number
  mimeTypes: readonly string[]
  resolutions?: readonly string[]
}

/** One typed input handle exposed by a generation model contract. */
export interface GenerationInputSlotDefinition {
  accepts: readonly FlowValueType[]
  acceptedMedia?: GenerationAcceptedMediaConstraints
  descriptionKey: string
  id: string
  labelKey: string
  maxConnections: number
  /** Provider-declared or deliberately narrowed hard limit for one runtime item. */
  maxItems: number
  minConnections: number
  referenceProfile?: GenerationReferenceProfile
}

/** Aggregate reference limit spanning the listed slot identities. */
export interface GenerationReferenceLimit {
  maxItems: number
  slotIds: readonly string[]
}

/** Provider-neutral media family and bounded output count for an operation. */
export interface GenerationOutputDefinition {
  count: {
    default: number
    max: number
    min: number
    settingId?: string
  }
  mediaType: GenerationOutputType
}

/** One executable creative operation supported by a model. */
export interface GenerationOperationDefinition {
  descriptionKey: string
  id: string
  inputs: Readonly<
    Record<
      string,
      {
        atLeastOne?: readonly string[]
        oneOf?: readonly string[]
        required?: boolean
      }
    >
  >
  inputSlotIds: readonly string[]
  labelKey: string
  /**
   * Stable TaleLabs product intent. Historical capability-v2 contracts omit
   * this field; every current capability-v3 operation must declare it.
   */
  nodeType?: GenerationNodeType
  /** Present on hardened contracts. Historical contracts intentionally omit it. */
  output?: GenerationOutputDefinition
  /** Present on hardened contracts, including an explicit zero-reference limit. */
  referenceLimit?: GenerationReferenceLimit
  requiredSettingIds?: readonly string[]
  settingIds: readonly string[]
}

/** @deprecated Provider presentation is retained only inside historical contracts. */
export interface GenerationModelProviderDefinition {
  displayName: string
  id: string
}

/** Code-owned visual identity used by the public model presentation layer. */
export type GenerationModelLogoId
  = | 'alibaba'
    | 'bytedance'
    | 'claude'
    | 'deepseek'
    | 'elevenlabs'
    | 'flux'
    | 'gemini'
    | 'google'
    | 'lightricks'
    | 'llm'
    | 'mistral'
    | 'microsoft'
    | 'minimax'
    | 'moonshot'
    | 'nanobanana'
    | 'openai'
    | 'qwen'
    | 'recraft'
    | 'stability'
    | 'xai'
    | 'zai'
    | 'kling'

/** Stable public display metadata for one catalog model. */
export interface GenerationModelPresentationDefinition {
  descriptionKey: string
  logoId: GenerationModelLogoId
}

/** Provider-neutral reasoning effort options supported by text models. */
export type LlmReasoningMode
  = | 'off'
    | 'auto'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'max'
    | 'xhigh'

/** Allowed reasoning modes and default behavior for one text model. */
export interface LlmReasoningCapability {
  default: LlmReasoningMode
  mandatory: boolean
  options: readonly LlmReasoningMode[]
}

/** Text-generation capabilities that do not apply to media models. */
export interface LlmGenerationCapability {
  reasoning?: LlmReasoningCapability
}

/** Complete provider-neutral model contract consumed by Flow readers. */
export interface GenerationModelDefinition {
  /**
   * Version 2 hardened outputs/references. Version 3 additionally tags every
   * operation with its authoritative TaleLabs node intent.
   */
  capabilitySchemaVersion?: 2 | 3
  constraints: readonly GenerationConstraintDefinition[]
  defaultOperationId: string
  displayName: string
  enabled: boolean
  /** Provider-neutral admission availability for newly planned executions. */
  executionAvailable?: boolean
  id: string
  inputSlots: readonly GenerationInputSlotDefinition[]
  labelKey: string
  /** The canonical output family, not a provider or asset-storage identifier. */
  mediaType: GenerationOutputType
  /** Present only for text-output LLM contracts. */
  llm?: LlmGenerationCapability
  operations: readonly GenerationOperationDefinition[]
  /** Curated public presentation metadata. Historical contracts may omit it. */
  presentation?: GenerationModelPresentationDefinition
  /** @deprecated Not populated by current provider-independent contracts. */
  provider?: GenerationModelProviderDefinition
  recommended: boolean
  /** Monotonic catalog revision captured by newly admitted runs. */
  revision?: number
  settings: readonly GenerationSettingDefinition[]
}

/** Current operation shape with mandatory output and reference contracts. */
export type HardenedGenerationOperationDefinition = Omit<
  GenerationOperationDefinition,
  'output' | 'referenceLimit'
> & {
  output: GenerationOutputDefinition
  referenceLimit: GenerationReferenceLimit
}

/** Current catalog model shape with mandatory revision and schema version. */
export type HardenedGenerationModelDefinition = Omit<
  GenerationModelDefinition,
  'capabilitySchemaVersion' | 'operations' | 'provider'
> & {
  capabilitySchemaVersion: 2 | 3
  operations: readonly HardenedGenerationOperationDefinition[]
  provider?: never
  revision: number
}

/** Source classification used while resolving model reference candidates. */
export type GenerationCandidateOrigin
  = | {
    kind: 'asset'
  }
  | {
    kind: 'nodeOutput'
    nodeId: string
    outputIndex: number
  }

/** One candidate reference value considered by model-adaptive resolution. */
export interface GenerationReferenceCandidate {
  assetId: string
  candidateId: string
  mediaType: GenerationMediaType
  order: number
  origin: GenerationCandidateOrigin
  slotId: string
}

/** Candidate plus the deterministic reason it was accepted or rejected. */
export interface GenerationConsideredCandidate {
  candidate: GenerationReferenceCandidate
  exclusionReasons: readonly string[]
  selected: boolean
}

/** Final provider input selection for one model slot. */
export interface GenerationSelectedProviderInput {
  assetId: string
  candidateId: string
  order: number
  slotId: string
}

/**
 * Planner-facing provenance shape only. E-040 defines what must be preserved;
 * the planner and persistence mapping intentionally ship in later milestones.
 */
export interface GenerationCandidateSelectionSnapshot {
  considered: readonly GenerationConsideredCandidate[]
  selectedInputs: readonly GenerationSelectedProviderInput[]
}
