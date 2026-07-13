import type { CanvasNode } from './flow-canvas-types'

import {
  getGenerationModel,
  getGenerationOperation,
  isGenerationNodeType,
} from '@talelabs/flows'

export function getCanvasGenerationModel(
  node: Pick<CanvasNode, 'data' | 'type'> | undefined,
) {
  if (!node || !isGenerationNodeType(node.type))
    return undefined
  return getGenerationModel(
    String(node.data.modelId ?? ''),
    node.data.modelContractVersion,
  )
}

export function getCanvasGenerationOperation(
  node: Pick<CanvasNode, 'data' | 'type'> | undefined,
) {
  const model = getCanvasGenerationModel(node)
  return model
    ? getGenerationOperation(model, node?.data.operationId)
    ?? getGenerationOperation(model, model.defaultOperationId)
    : undefined
}
