import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../../../flow-canvas-types'
import { useAudioIntentNode } from '../use-audio-intent-node'

export function useVoiceChangerNode(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
}) {
  return useAudioIntentNode({ ...input, nodeType: 'voiceChanger' })
}
