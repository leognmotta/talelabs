/** Connected and inline prompt resolution into normalized provider text slots. */

import type {
  NormalizedGenerationPromptInputReference,
  NormalizedGenerationTextPart,
  NormalizedGenerationTextSlot,
} from '../../generation/contracts/provider.js'
import type { PlannedJobRequestPayload } from '../planning/planner-contracts.js'

import { compareStableStrings } from '../../graph/ordering/stable.js'
import { resolvePromptTemplate } from '../../prompts/resolve.js'
import {
  generationJobInputBindingId,
  generationJobInputSourceId,
  generationJobInputTargetSlotId,
} from '../compilation/request-accessors.js'
import { promptTemplateInputsFromRequest } from './provider-input-selections.js'
import { GenerationProviderRequestMaterializationError } from './provider-request-error.js'

/** Resolves connected text and structured inline prompts into adapter slots. */
export function normalizedTextSlots(
  requestPayload: PlannedJobRequestPayload,
): readonly NormalizedGenerationTextSlot[] {
  const connectedParts = new Map<string, NormalizedGenerationTextPart[]>()
  for (const [inputOrder, input] of requestPayload.inputs.entries()) {
    const targetSlotId = generationJobInputTargetSlotId(input)
    for (const [itemOrder, item] of input.items.entries()) {
      if (item.value.kind !== 'text')
        continue
      if (item.value.text === null) {
        throw new GenerationProviderRequestMaterializationError(
          'provider_request_text_unresolved',
        )
      }
      connectedParts.set(targetSlotId, [
        ...(connectedParts.get(targetSlotId) ?? []),
        Object.freeze({
          edgeId: generationJobInputBindingId(input),
          itemKey: item.key,
          order: inputOrder * 1_000_000 + itemOrder,
          source: 'connected' as const,
          sourceNodeId: generationJobInputSourceId(input),
          text: item.value.text,
        }),
      ])
    }
  }

  const slotIds = new Set([
    ...Object.keys(requestPayload.inline),
    ...Object.keys(requestPayload.promptTemplates ?? {}),
    ...connectedParts.keys(),
  ])
  return Object.freeze([...slotIds]
    .toSorted(compareStableStrings)
    .map((slotId) => {
      const connected = connectedParts.get(slotId) ?? []
      if (connected.length > 0) {
        return Object.freeze({
          inputReferences: Object.freeze([]),
          parts: Object.freeze(connected),
          resolvedText: connected.map(part => part.text).join('\n'),
          slotId,
          source: 'connected' as const,
        })
      }
      const template = requestPayload.promptTemplates?.[slotId]
      if (template) {
        const resolution = resolvePromptTemplate({
          inputs: promptTemplateInputsFromRequest(requestPayload),
          template,
        })
        if (!resolution.ok) {
          throw new GenerationProviderRequestMaterializationError(
            'provider_request_prompt_reference_invalid',
          )
        }
        const inputReferences = resolution.references.map((reference) => {
          if (
            !reference.assetId
            || !reference.itemKey
            || !reference.sourceNodeId
          ) {
            throw new GenerationProviderRequestMaterializationError(
              'provider_request_asset_unresolved',
            )
          }
          return Object.freeze({
            ...reference,
            assetId: reference.assetId,
            itemKey: reference.itemKey,
            sourceNodeId: reference.sourceNodeId,
          }) satisfies NormalizedGenerationPromptInputReference
        })
        return Object.freeze({
          inputReferences: Object.freeze(inputReferences),
          parts: Object.freeze([Object.freeze({
            edgeId: null,
            itemKey: null,
            order: 0,
            source: 'inline' as const,
            sourceNodeId: null,
            text: resolution.resolvedText,
          })]),
          resolvedText: resolution.resolvedText,
          slotId,
          source: 'inline' as const,
        })
      }
      const inline = requestPayload.inline[slotId] ?? ''
      return Object.freeze({
        inputReferences: Object.freeze([]),
        parts: Object.freeze([Object.freeze({
          edgeId: null,
          itemKey: null,
          order: 0,
          source: 'inline' as const,
          sourceNodeId: null,
          text: inline,
        })]),
        resolvedText: inline,
        slotId,
        source: 'inline' as const,
      })
    }))
}
