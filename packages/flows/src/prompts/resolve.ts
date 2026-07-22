/** Deterministic structured-prompt serialization and input resolution. */

import type {
  PromptTemplate,
  PromptTemplateInput,
  PromptTemplateResolution,
} from './contracts.js'

/** Renders the compact editor-facing form without depending on current labels. */
export function promptTemplateDisplayText(template: PromptTemplate): string {
  return template.parts.map((part) => {
    if (part.type === 'text')
      return part.text
    if (part.type === 'break')
      return '\n'
    return `@${part.mediaType} ${part.index + 1}`
  }).join('')
}

/** Renders deterministic provider wording for one valid or unresolved token. */
export function promptTemplateResolvedText(template: PromptTemplate): string {
  return template.parts.map((part) => {
    if (part.type === 'text')
      return part.text
    if (part.type === 'break')
      return '\n'
    return `reference ${part.mediaType} ${part.index + 1}`
  }).join('')
}

/** Whether a prompt contains provider-visible text or an input reference. */
export function isPromptTemplateEmpty(template: PromptTemplate): boolean {
  return promptTemplateResolvedText(template).trim().length === 0
}

/** Resolves every input token against exact ordered inputs without fallback. */
export function resolvePromptTemplate(input: {
  inputs: readonly PromptTemplateInput[]
  template: PromptTemplate
}): PromptTemplateResolution {
  const bySlot = new Map<string, PromptTemplateInput[]>()
  for (const selectedInput of input.inputs) {
    bySlot.set(selectedInput.slotId, [
      ...(bySlot.get(selectedInput.slotId) ?? []),
      selectedInput,
    ])
  }

  const issues: PromptTemplateResolution['issues'][number][] = []
  const references: PromptTemplateResolution['references'][number][] = []
  for (const [partIndex, part] of input.template.parts.entries()) {
    if (part.type !== 'input')
      continue
    const selectedInput = bySlot.get(part.slotId)?.[part.index]
    if (!selectedInput) {
      issues.push({
        code: 'prompt_input_missing',
        index: part.index,
        mediaType: part.mediaType,
        partIndex,
        slotId: part.slotId,
      })
      continue
    }
    if (selectedInput.mediaType !== part.mediaType) {
      issues.push({
        actualMediaType: selectedInput.mediaType,
        code: 'prompt_input_media_mismatch',
        index: part.index,
        mediaType: part.mediaType,
        partIndex,
        slotId: part.slotId,
      })
      continue
    }
    references.push({
      assetId: selectedInput.assetId,
      index: part.index,
      itemKey: selectedInput.itemKey,
      mediaType: part.mediaType,
      partIndex,
      slotId: part.slotId,
      sourceNodeId: selectedInput.sourceNodeId,
    })
  }

  return Object.freeze({
    issues: Object.freeze(issues),
    ok: issues.length === 0,
    references: Object.freeze(references),
    resolvedText: promptTemplateResolvedText(input.template),
  })
}
