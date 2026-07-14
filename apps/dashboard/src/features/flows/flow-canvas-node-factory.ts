import type { FlowNodeType } from '@talelabs/flows'
import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from './flow-canvas-types'

import { createId } from '@paralleldrive/cuid2'
import {
  getDefaultNodeData,
  getFlowNodeTypeDefinition,
} from '@talelabs/flows'

export function createCanvasNode(input: {
  assetId?: null | string
  id?: string
  position: XYPosition
  transient?: CanvasNode['transient']
  type: FlowNodeType
}): CanvasNode {
  return {
    assetId: input.assetId ?? null,
    data: getDefaultNodeData(input.type),
    id: input.id ?? createId(),
    position: input.position,
    schemaVersion: getFlowNodeTypeDefinition(input.type).currentVersion,
    selected: true,
    transient: input.transient,
    type: input.type,
  }
}
