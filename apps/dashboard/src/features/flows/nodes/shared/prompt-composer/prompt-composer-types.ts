/** Presentation-only contracts for structured generation-prompt references. */

import type { PromptTemplateMediaType } from '@talelabs/flows'

/** One effective selected media input addressable from the prompt composer. */
export interface PromptComposerInput {
  /** Zero-based position within the selected values for the owning slot. */
  index: number
  /** Media family rendered in the stable inline reference label. */
  mediaType: PromptTemplateMediaType
  /** Current Asset or generated-output name, never persisted in the prompt. */
  name: string
  /** Optional current preview used only by the local suggestion menu. */
  previewUrl: null | string
  /** Durable semantic generation-input identity. */
  slotId: string
}

/** Local suggestion item enriched with its current localized chip label. */
export interface PromptComposerSuggestion extends PromptComposerInput {
  /** Presentation label without the leading `@`. */
  displayLabel: string
}

/** Localized copy supplied to the non-React Tiptap suggestion renderer. */
export interface PromptComposerSuggestionCopy {
  /** Message shown when no selected input matches the query. */
  empty: string
  /** Current group labels keyed by media family. */
  groups: Readonly<Record<PromptTemplateMediaType, string>>
}
