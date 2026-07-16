import type { EdgeTypes } from '@xyflow/react'

import { FlowCanvasEdge } from './flow-canvas-edge'

export const FLOW_CANVAS_DEFAULT_EDGE_OPTIONS = {
  animated: false,
  style: { strokeWidth: 1.75 },
  type: 'flow',
}
export const FLOW_CANVAS_EDGE_TYPES: EdgeTypes = { flow: FlowCanvasEdge }
export const FLOW_CANVAS_DELETE_KEY_CODE = ['Backspace', 'Delete']
export const FLOW_CANVAS_PRO_OPTIONS = { hideAttribution: true }
export const FLOW_CANVAS_SNAP_GRID: [number, number] = [16, 16]
