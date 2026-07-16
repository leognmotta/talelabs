import type {
  FlowRuntimeValue,
  RuntimeAssetReference,
} from '@talelabs/flows'

import {
  resolveSameRunAsset,
  resolveSameRunText,
} from './same-run-outputs.js'

export function assetReferencesFromValue(value: FlowRuntimeValue) {
  return value.kind === 'text' ? [] : value.assets
}

export async function materializeRuntimeValue(input: {
  flowRunId: string
  organizationId: string
  value: FlowRuntimeValue
}): Promise<FlowRuntimeValue> {
  if (input.value.kind === 'text') {
    if (input.value.origin.source !== 'sameRunOutput')
      return input.value
    const text = await resolveSameRunText({
      flowRunId: input.flowRunId,
      itemKey: input.value.origin.itemKey,
      nodeId: input.value.origin.nodeId,
      organizationId: input.organizationId,
    })
    return {
      ...input.value,
      origin: {
        generationJobId: text.generationJobId,
        outputIndex: text.outputIndex,
        source: 'priorOutput',
      },
      text: text.text,
    }
  }

  const assets: RuntimeAssetReference[] = []
  for (const assetRef of input.value.assets) {
    if (assetRef.source !== 'sameRunOutput') {
      assets.push(assetRef)
      continue
    }
    const asset = await resolveSameRunAsset({
      flowRunId: input.flowRunId,
      itemKey: assetRef.itemKey,
      nodeId: assetRef.nodeId,
      organizationId: input.organizationId,
      outputIndex: assetRef.outputIndex,
    })
    if (asset.mediaType === 'document')
      throw new Error('same_run_generated_document_not_supported')
    assets.push({
      assetId: asset.assetId,
      generationJobId: asset.generationJobId,
      mediaType: asset.mediaType,
      outputIndex: asset.outputIndex ?? 0,
      source: 'priorOutput',
    })
  }
  return { ...input.value, assets }
}
