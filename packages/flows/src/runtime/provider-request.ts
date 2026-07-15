import type {
  NormalizedGenerationInputItem,
  NormalizedGenerationMediaAsset,
  NormalizedGenerationRequest,
  NormalizedGenerationTextPart,
  NormalizedGenerationTextSlot,
} from '../generation-provider-contracts.js'
import type { PlannedJobRequestPayload } from './planner.js'
import type { RuntimeAssetReference } from './runtime-values.js'

import { compareStableStrings } from '../stable-order.js'
import { hashFlowRunJob } from './canonical-json.js'

export class GenerationProviderRequestMaterializationError extends TypeError {
  readonly code:
    | 'provider_request_asset_unresolved'
    | 'provider_request_text_unresolved'

  constructor(code: GenerationProviderRequestMaterializationError['code']) {
    super(code)
    this.code = code
    this.name = 'GenerationProviderRequestMaterializationError'
  }
}

function normalizedMediaAssets(
  assets: readonly RuntimeAssetReference[],
): readonly NormalizedGenerationMediaAsset[] {
  return Object.freeze(assets.map((asset, order) => {
    if (!('assetId' in asset)) {
      throw new GenerationProviderRequestMaterializationError(
        'provider_request_asset_unresolved',
      )
    }
    return Object.freeze({
      assetId: asset.assetId,
      mediaType: asset.mediaType,
      order,
    })
  }))
}

function normalizedInputItem(
  item: PlannedJobRequestPayload['inputs'][number]['items'][number],
): NormalizedGenerationInputItem {
  if (item.value.kind === 'text') {
    if (item.value.text === null) {
      throw new GenerationProviderRequestMaterializationError(
        'provider_request_text_unresolved',
      )
    }
    return Object.freeze({
      assets: Object.freeze([]),
      dimensions: item.dimensions,
      itemKey: item.key,
      text: item.value.text,
    })
  }
  return Object.freeze({
    assets: normalizedMediaAssets(item.value.assets),
    dimensions: item.dimensions,
    itemKey: item.key,
    text: null,
  })
}

function textSlots(
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

/**
 * Builds the single adapter-facing request exclusively from one validated,
 * immutable job payload. Same-run placeholders must be materialized first.
 */
export function materializeGenerationProviderRequest(input: {
  requestId: string
  requestPayload: PlannedJobRequestPayload
}): NormalizedGenerationRequest {
  return Object.freeze({
    adapterRequestVersion: 1 as const,
    itemKey: input.requestPayload.itemKey,
    modelContractVersion: input.requestPayload.modelContractVersion,
    nodeId: input.requestPayload.nodeId,
    operationId: input.requestPayload.operationId,
    orderedInputs: Object.freeze(input.requestPayload.inputs.map(
      (plannedInput, order) => Object.freeze({
        edgeId: plannedInput.edgeId,
        items: Object.freeze(plannedInput.items.map(normalizedInputItem)),
        order,
        sourceHandleId: plannedInput.sourceHandleId,
        sourceNodeId: plannedInput.sourceNodeId,
        targetSlotId: plannedInput.targetHandleId,
      }),
    )),
    outputCount: input.requestPayload.outputCount,
    productModelId: input.requestPayload.modelId,
    requestId: input.requestId,
    requestIndex: input.requestPayload.requestIndex,
    requestPayloadHash: hashFlowRunJob(input.requestPayload),
    settings: input.requestPayload.settings,
    textSlots: textSlots(input.requestPayload),
  })
}
