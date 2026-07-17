/** Referentially stable React Flow registries, defaults, and connection options. */

import type { EdgeTypes } from '@xyflow/react'

import { FlowCanvasEdge } from './flow-canvas-edge'

/** Module-stable default edge options passed to React Flow. */
export const FLOW_CANVAS_DEFAULT_EDGE_OPTIONS = {
  animated: false,
  style: { strokeWidth: 1.75 },
  type: 'flow',
}
/** Module-stable custom edge registry passed to React Flow. */
export const FLOW_CANVAS_EDGE_TYPES: EdgeTypes = { flow: FlowCanvasEdge }
/** Keyboard key accepted by React Flow for deleting selected graph elements. */
export const FLOW_CANVAS_DELETE_KEY_CODE = ['Backspace', 'Delete']
/** React Flow attribution option retained outside render for referential stability. */
export const FLOW_CANVAS_PRO_OPTIONS = { hideAttribution: true }
/** Canvas snap interval in Flow coordinates, retained as a stable tuple. */
export const FLOW_CANVAS_SNAP_GRID: [number, number] = [16, 16]
