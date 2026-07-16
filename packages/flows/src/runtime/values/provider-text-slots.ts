import type {
  NormalizedGenerationTextPart,
  NormalizedGenerationTextSlot,
} from '../../generation/contracts/provider.js'
import type { PlannedJobRequestPayload } from '../planning/planner-contracts.js'

import { compareStableStrings } from '../../graph/ordering/stable.js'
import { GenerationProviderRequestMaterializationError } from './provider-request-error.js'

export function normalizedTextSlots(
  requestPayload: PlannedJobRequestPayload,
): readonly NormalizedGenerationTextSlot[] {
  const connectedParts = new Map<string, NormalizedGenerationTextPart[]>()
  for (const [inputOrder, input] of requestPayload.inputs.entries()) {
    for (const [itemOrder, item] of input.items.entries()) {
      if (item.value.kind !== 'text')
        continue
      if (item.value.text === null) {
        throw new GenerationProviderRequestMaterializationError(
          'provider_request_text_unresolved',
        )
      }
      connectedParts.set(input.targetHandleId, [
        ...(connectedParts.get(input.targetHandleId) ?? []),
        Object.freeze({
          edgeId: input.edgeId,
          itemKey: item.key,
          order: inputOrder * 1_000_000 + itemOrder,
          source: 'connected' as const,
          sourceNodeId: input.sourceNodeId,
          text: item.value.text,
        }),
      ])
    }
  }

  const slotIds = new Set([
    ...Object.keys(requestPayload.inline),
    ...connectedParts.keys(),
  ])
  return Object.freeze([...slotIds]
    .toSorted(compareStableStrings)
    .map((slotId) => {
      const connected = connectedParts.get(slotId) ?? []
      if (connected.length > 0) {
        return Object.freeze({
          parts: Object.freeze(connected),
          resolvedText: connected.map(part => part.text).join('\n'),
          slotId,
          source: 'connected' as const,
        })
      }
      const inline = requestPayload.inline[slotId] ?? ''
      return Object.freeze({
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
