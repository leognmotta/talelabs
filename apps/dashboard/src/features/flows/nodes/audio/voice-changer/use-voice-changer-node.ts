/** Voice-change specialization of the shared audio node controller. */

import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../../editor/flow-canvas-types'
import { useAudioIntentNode } from '../use-audio-intent-node'

/** Specializes the shared audio-intent controller for voice transformation. */
export function useVoiceChangerNode(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
}) {
  return useAudioIntentNode({ ...input, nodeType: 'voiceChanger' })
}
