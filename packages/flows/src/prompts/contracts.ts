/** Provider-neutral structured prompt contracts owned by Flow node data. */

/** Media families that an inline prompt may reference by selected position. */
export type PromptTemplateMediaType = 'audio' | 'image' | 'video'

/** One plain-text run inside a structured prompt. */
export interface PromptTemplateTextPart {
  /** Literal user-authored text preserved exactly. */
  text: string
  /** Part discriminator. */
  type: 'text'
}

/** One selected media input referenced by stable slot and zero-based position. */
export interface PromptTemplateInputPart {
  /** Zero-based position within the effective selected inputs for `slotId`. */
  index: number
  /** Expected media family at the referenced position. */
  mediaType: PromptTemplateMediaType
  /** Stable generation input-slot identifier. */
  slotId: string
  /** Part discriminator. */
  type: 'input'
}

/** One explicit line break inside a structured prompt. */
export interface PromptTemplateBreakPart {
  /** Part discriminator. */
  type: 'break'
}

/** Narrow persisted prompt vocabulary; no editor-specific JSON is durable. */
export type PromptTemplatePart
  = | PromptTemplateBreakPart
    | PromptTemplateInputPart
    | PromptTemplateTextPart

/** Versioned prompt value persisted in generation-node JSON data. */
export interface PromptTemplate {
  /** Ordered text, input-reference, and line-break parts. */
  parts: PromptTemplatePart[]
  /** Prompt contract version. */
  version: 1
}

/** One effective selected input exposed to prompt resolution. */
export interface PromptTemplateInput {
  /** Canonical Asset ID after runtime materialization, otherwise null. */
  assetId: null | string
  /** Runtime item identity that carried this input, when available. */
  itemKey: null | string
  /** Media family of the selected input. */
  mediaType: PromptTemplateMediaType
  /** Stable generation input-slot identifier. */
  slotId: string
  /** Upstream Flow node that supplied the input, when available. */
  sourceNodeId: null | string
}

/** Exact token-to-input mapping produced while resolving one prompt. */
export interface ResolvedPromptTemplateInputReference {
  /** Canonical Asset ID after runtime materialization, otherwise null. */
  assetId: null | string
  /** Zero-based selected position within the referenced slot. */
  index: number
  /** Runtime item identity that carried the selected input, when available. */
  itemKey: null | string
  /** Media family verified by the resolver. */
  mediaType: PromptTemplateMediaType
  /** Zero-based position of the input token in the prompt's parts. */
  partIndex: number
  /** Stable generation input-slot identifier. */
  slotId: string
  /** Upstream Flow node that supplied the selected input, when available. */
  sourceNodeId: null | string
}

/** Stable invalid-reference issue returned without silently redirecting a token. */
export interface PromptTemplateResolutionIssue {
  /** Actual media family found at the position, when one exists. */
  actualMediaType?: PromptTemplateMediaType
  /** Stable failure code. */
  code: 'prompt_input_media_mismatch' | 'prompt_input_missing'
  /** Zero-based selected position requested by the token. */
  index: number
  /** Media family expected by the token. */
  mediaType: PromptTemplateMediaType
  /** Zero-based position of the invalid token in the prompt's parts. */
  partIndex: number
  /** Stable generation input-slot identifier requested by the token. */
  slotId: string
}

/** Deterministic prompt resolution result shared by planning and execution. */
export interface PromptTemplateResolution {
  /** Every invalid token in prompt order. */
  issues: readonly PromptTemplateResolutionIssue[]
  /** Whether every input token mapped to the exact requested position. */
  ok: boolean
  /** Exact successful token-to-input mappings in prompt order. */
  references: readonly ResolvedPromptTemplateInputReference[]
  /** Plain provider-facing text produced from the structured prompt. */
  resolvedText: string
}
