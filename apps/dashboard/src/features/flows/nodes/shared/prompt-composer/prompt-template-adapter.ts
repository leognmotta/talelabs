/** Lossless conversion between the persisted prompt template and Tiptap JSON. */

import type {
  PromptTemplate,
  PromptTemplateMediaType,
  PromptTemplatePart,
} from '@talelabs/flows'
import type { Editor, JSONContent } from '@tiptap/core'
import type { PromptComposerInput } from './prompt-composer-types'

import { resolvePromptTemplate } from '@talelabs/flows'

/** Tiptap node name reserved for one atomic prompt input reference. */
export const INPUT_REFERENCE_NODE_NAME = 'inputReference'

function inputKey(slotId: string, index: number): string {
  return `${slotId}\u0000${index}`
}

function inputMap(inputs: readonly PromptComposerInput[]) {
  return new Map(inputs.map(input => [inputKey(input.slotId, input.index), input]))
}

function appendText(parts: PromptTemplatePart[], text: string) {
  if (!text)
    return
  const previous = parts.at(-1)
  if (previous?.type === 'text') {
    parts[parts.length - 1] = { type: 'text', text: previous.text + text }
    return
  }
  parts.push({ type: 'text', text })
}

/** Creates a stable comparison key for editor synchronization. */
export function promptTemplateKey(template: PromptTemplate): string {
  return JSON.stringify(template)
}

/** Converts the narrow editor document back into the persisted template. */
export function promptTemplateFromEditorJson(content: JSONContent): PromptTemplate {
  const parts: PromptTemplatePart[] = []
  for (const [blockIndex, block] of (content.content ?? []).entries()) {
    if (blockIndex > 0)
      parts.push({ type: 'break' })
    for (const child of block.content ?? []) {
      if (child.type === 'text') {
        appendText(parts, child.text ?? '')
        continue
      }
      if (child.type === 'hardBreak') {
        parts.push({ type: 'break' })
        continue
      }
      if (child.type !== INPUT_REFERENCE_NODE_NAME)
        continue
      const { index, mediaType, slotId } = child.attrs ?? {}
      if (
        !Number.isInteger(index)
        || index < 0
        || !['audio', 'image', 'video'].includes(mediaType)
        || typeof slotId !== 'string'
        || !slotId
      ) {
        continue
      }
      parts.push({
        index,
        mediaType: mediaType as PromptTemplateMediaType,
        slotId,
        type: 'input',
      })
    }
  }
  return { parts, version: 1 }
}

/** Returns whether every persisted token still resolves to its exact slot index. */
export function promptTemplateIsValid(
  template: PromptTemplate,
  inputs: readonly PromptComposerInput[],
): boolean {
  return resolvePromptTemplate({
    inputs: inputs.map(input => ({
      ...input,
      assetId: null,
      itemKey: null,
      sourceNodeId: null,
    })),
    template,
  }).ok
}

/** Builds one presentation-rich Tiptap document from the narrow template. */
export function promptTemplateToEditorJson(input: {
  inputs: readonly PromptComposerInput[]
  invalidTooltip: string
  label: (mediaType: PromptTemplateMediaType, index: number) => string
  template: PromptTemplate
}): JSONContent {
  const liveInputs = inputMap(input.inputs)
  const content: JSONContent[] = input.template.parts.map((part) => {
    if (part.type === 'text')
      return { text: part.text, type: 'text' }
    if (part.type === 'break')
      return { type: 'hardBreak' }
    const liveInput = liveInputs.get(inputKey(part.slotId, part.index))
    const valid = liveInput?.mediaType === part.mediaType
    const displayLabel = `@${input.label(part.mediaType, part.index)}`
    return {
      attrs: {
        displayLabel,
        index: part.index,
        inputName: valid && liveInput ? liveInput.name : '',
        invalid: !valid,
        mediaType: part.mediaType,
        slotId: part.slotId,
        tooltip: valid
          ? `${displayLabel} · ${liveInput?.name ?? ''}`
          : input.invalidTooltip,
      },
      type: INPUT_REFERENCE_NODE_NAME,
    }
  })
  return {
    content: [{ ...(content.length > 0 ? { content } : {}), type: 'paragraph' }],
    type: 'doc',
  }
}

/** Refreshes names, labels, tooltips, and invalid state without replacing the document. */
export function refreshPromptInputPresentations(input: {
  editor: Editor
  inputs: readonly PromptComposerInput[]
  invalidTooltip: string
  label: (mediaType: PromptTemplateMediaType, index: number) => string
}) {
  const liveInputs = inputMap(input.inputs)
  const transaction = input.editor.state.tr
  input.editor.state.doc.descendants((node, position) => {
    if (node.type.name !== INPUT_REFERENCE_NODE_NAME)
      return
    const liveInput = liveInputs.get(inputKey(node.attrs.slotId, node.attrs.index))
    const valid = liveInput?.mediaType === node.attrs.mediaType
    const displayLabel = `@${input.label(node.attrs.mediaType, node.attrs.index)}`
    const nextAttributes = {
      ...node.attrs,
      displayLabel,
      inputName: valid && liveInput ? liveInput.name : '',
      invalid: !valid,
      tooltip: valid
        ? `${displayLabel} · ${liveInput?.name ?? ''}`
        : input.invalidTooltip,
    }
    if (JSON.stringify(node.attrs) !== JSON.stringify(nextAttributes))
      transaction.setNodeMarkup(position, undefined, nextAttributes)
  })
  if (transaction.docChanged) {
    transaction.setMeta('addToHistory', false)
    input.editor.view.dispatch(transaction)
  }
}
