/** Exact model-input selection shared by provenance, prompts, and adapters. */

import type { PromptTemplateInput } from '../../prompts/contracts.js'
import type { GenerationJobRequestInput } from '../compilation/request-accessors.js'
import type { PlannedJobRequestPayload } from '../planning/planner-contracts.js'
import {
  generationJobInputSourceId,
  generationJobInputTargetSlotId,
} from '../compilation/request-accessors.js'

function selectedMediaInput(
  input: GenerationJobRequestInput,
  selectedAssetIds: ReadonlySet<string> | null,
  selection: { remaining: number, seen: null | Set<string> },
): GenerationJobRequestInput {
  return Object.freeze({
    ...input,
    items: Object.freeze(input.items.flatMap((item) => {
      if (item.value.kind === 'text')
        return [item]
      const assets = item.value.assets.filter((asset) => {
        if (selection.remaining <= 0)
          return false
        if (
          selectedAssetIds
          && (!('assetId' in asset) || !selectedAssetIds.has(asset.assetId))
        ) {
          return false
        }
        const identity = 'assetId' in asset
          ? `asset:${asset.assetId}`
          : `same-run:${asset.nodeId}:${asset.itemKey}:${asset.outputIndex}`
        if (selection.seen?.has(identity))
          return false
        selection.seen?.add(identity)
        selection.remaining -= 1
        return true
      })
      return assets.length > 0
        ? [Object.freeze({
            ...item,
            value: Object.freeze({ ...item.value, assets: Object.freeze(assets) }),
          })]
        : []
    })),
  })
}

/** Applies the node's existing manual/automatic policy and per-slot limits. */
export function selectedProviderRequestInputs(
  payload: PlannedJobRequestPayload,
): readonly GenerationJobRequestInput[] {
  const selectionBySlot = new Map<
    string,
    { remaining: number, seen: null | Set<string> }
  >()
  return Object.freeze(payload.inputs.map((input) => {
    const targetSlotId = generationJobInputTargetSlotId(input)
    const limit = payload.inputLimits?.[targetSlotId]
      ?? Number.POSITIVE_INFINITY
    const selection = selectionBySlot.get(targetSlotId) ?? {
      remaining: limit,
      seen: payload.requestPayloadVersion >= 5 ? null : new Set<string>(),
    }
    selectionBySlot.set(targetSlotId, selection)
    const manualAssetIds = payload.inputSelections[targetSlotId]
    return selectedMediaInput(
      input,
      manualAssetIds ? new Set(manualAssetIds) : null,
      selection,
    )
  }))
}

/** Flattens exact selected media inputs into prompt-addressable slot order. */
export function promptTemplateInputsFromRequest(
  payload: PlannedJobRequestPayload,
): readonly PromptTemplateInput[] {
  const result: PromptTemplateInput[] = []
  for (const input of selectedProviderRequestInputs(payload)) {
    for (const item of input.items) {
      if (item.value.kind === 'text')
        continue
      for (const asset of item.value.assets) {
        if (asset.mediaType === 'document')
          continue
        result.push(Object.freeze({
          assetId: 'assetId' in asset ? asset.assetId : null,
          itemKey: item.key,
          mediaType: asset.mediaType,
          slotId: generationJobInputTargetSlotId(input),
          sourceNodeId: generationJobInputSourceId(input),
        }))
      }
    }
  }
  return Object.freeze(result)
}
