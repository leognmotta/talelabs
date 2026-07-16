import type { FlowHandleDefinition } from '@talelabs/flows'
import type { TFunction } from 'i18next'
import type { FlowCanvasContextValue } from './flow-canvas-context'
import type { CanvasNode } from './flow-canvas-types'
import type { PortPreviewItem } from './flow-node-port-preview'

import { isGenerationNodeType } from '@talelabs/flows'
import { flowNodeName } from './flow-node-port-preview'

function generationOutputPreviewItems(
  handle: FlowHandleDefinition,
  node: CanvasNode,
  canvas: FlowCanvasContextValue,
): PortPreviewItem[] {
  const preview = canvas.getGenerationPreview(node.id)
  const valueType = handle.valueTypes[0]
  if (!preview?.output || !valueType)
    return []

  const outputs = preview.resultSets?.length
    ? preview.resultSets.flatMap(resultSet => resultSet.outputs.map(result => ({
        id: `${handle.id}:preview:${resultSet.jobId}:${result.outputIndex}`,
        output: result.output,
      })))
    : [{
        id: `${handle.id}:preview:${preview.fingerprint}`,
        output: preview.output,
      }]

  return outputs
    .filter(item => item.output.valueType === valueType)
    .map(({ id, output }) => ({
      ...(output.kind === 'media'
        ? {
            ...(output.assetId ? { assetId: output.assetId } : {}),
            mediaType: output.mediaType,
            mimeType: output.download.mimeType,
            previewUrl: output.download.content,
          }
        : {}),
      id,
      name: output.name,
      ...(output.kind === 'text' ? { text: output.text } : {}),
      valueType,
    }))
}

export function outputPortPreviewItems(
  handle: FlowHandleDefinition,
  node: CanvasNode,
  canvas: FlowCanvasContextValue,
  t: TFunction,
): PortPreviewItem[] {
  const valueType = handle.valueTypes[0]
  if (!valueType)
    return []

  if (node.type === 'asset' && node.assetId) {
    const asset = canvas.referenceData.assetsById.get(node.assetId)
    return asset
      ? [{ asset, id: `${handle.id}:asset:${asset.id}`, name: asset.name, valueType }]
      : []
  }

  if (node.type === 'text') {
    return [{
      id: `${handle.id}:text:${node.id}`,
      name: flowNodeName(node, t, canvas),
      text: typeof node.data.text === 'string' ? node.data.text : '',
      valueType,
    }]
  }

  return isGenerationNodeType(node.type)
    ? generationOutputPreviewItems(handle, node, canvas)
    : []
}
