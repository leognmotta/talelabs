/** Music-intent specialization of the shared audio node controller. */

import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'
import { useAudioIntentNode } from '../use-audio-intent-node'

/** Specializes the shared audio-intent controller for music generation. */
export function useMusicGenerationNode(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
}) {
  return useAudioIntentNode({ ...input, nodeType: 'musicGeneration' })
}
