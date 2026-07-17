/** Reads the selected catalog model and operation from persisted generation nodes. */

import type { CanvasNode } from '../editor/flow-canvas-types'

import {
  getGenerationModel,
  getGenerationOperation,
  isGenerationNodeType,
} from '@talelabs/flows'

/** Resolves the node's pinned model only when its catalog contract still matches. */
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

/** Resolves the node's operation from its validated pinned model. */
export function getCanvasGenerationOperation(
  node: Pick<CanvasNode, 'data' | 'type'> | undefined,
) {
  const model = getCanvasGenerationModel(node)
  return model
    ? getGenerationOperation(model, node?.data.operationId)
    ?? getGenerationOperation(model, model.defaultOperationId)
    : undefined
}
