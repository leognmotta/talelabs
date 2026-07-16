import type { FlowValueType } from '../../graph/types.js'

/** Asset-backed media that can participate in generation reference selection. */
export type GenerationMediaType = 'audio' | 'image' | 'video'
/** Every output family supported by the curated creative-model catalog. */
export type GenerationOutputType = GenerationMediaType | 'text'
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

export type GenerationSettingValue = boolean | number | string

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

export interface GenerationConstraintDefinition {
  forbid?: readonly GenerationConditionDefinition[]
  id: string
  messageKey: string
  require?: readonly GenerationConditionDefinition[]
  when: readonly GenerationConditionDefinition[]
}

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

export type GenerationMultipleSubjectSupport
  = | 'not-applicable'
    | 'supported'
    | 'unknown'
    | 'unsupported'

export type GenerationContactSheetPolicy
  = | 'never'
    | 'not-applicable'
    | 'preferred'
    | 'supported'

export interface GenerationReferenceProfile {
  contactSheetPolicy: GenerationContactSheetPolicy
  multipleSubjectSupport: GenerationMultipleSubjectSupport
  purposes: readonly GenerationReferencePurpose[]
  /** A researched guidance limit. Omitted when no lower limit than maxItems is evidenced. */
  recommendedMaxItems?: number
}

export interface GenerationAcceptedMediaConstraints {
  aspectRatios?: readonly string[]
  durationSeconds?: { max: number, min: number }
  framesPerSecond?: readonly number[]
  maxBytes?: number
  mimeTypes: readonly string[]
  resolutions?: readonly string[]
}

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

export interface GenerationReferenceLimit {
  maxItems: number
  slotIds: readonly string[]
}

export interface GenerationOutputDefinition {
  count: {
    default: number
    max: number
    min: number
    settingId?: string
  }
  mediaType: GenerationOutputType
}

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

export interface GenerationModelPresentationDefinition {
  descriptionKey: string
  logoId: GenerationModelLogoId
}

export type LlmReasoningMode
  = | 'off'
    | 'auto'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'max'
    | 'xhigh'

export interface LlmReasoningCapability {
  default: LlmReasoningMode
  mandatory: boolean
  options: readonly LlmReasoningMode[]
}

export interface LlmGenerationCapability {
  reasoning?: LlmReasoningCapability
}

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
  settings: readonly GenerationSettingDefinition[]
}

export type HardenedGenerationOperationDefinition = Omit<
  GenerationOperationDefinition,
  'output' | 'referenceLimit'
> & {
  output: GenerationOutputDefinition
  referenceLimit: GenerationReferenceLimit
}

export type HardenedGenerationModelDefinition = Omit<
  GenerationModelDefinition,
  'capabilitySchemaVersion' | 'operations' | 'provider'
> & {
  capabilitySchemaVersion: 2 | 3
  operations: readonly HardenedGenerationOperationDefinition[]
  provider?: never
}

export type GenerationCandidateOrigin
  = | {
    kind: 'asset'
  }
  | {
    kind: 'nodeOutput'
    nodeId: string
    outputIndex: number
  }

export interface GenerationReferenceCandidate {
  assetId: string
  candidateId: string
  mediaType: GenerationMediaType
  order: number
  origin: GenerationCandidateOrigin
  slotId: string
}

export interface GenerationConsideredCandidate {
  candidate: GenerationReferenceCandidate
  exclusionReasons: readonly string[]
  selected: boolean
}

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
