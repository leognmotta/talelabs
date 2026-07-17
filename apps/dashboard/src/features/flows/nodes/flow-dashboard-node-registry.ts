/** Stable React component projections derived from canonical Flow node metadata. */

import type { FlowNodeType } from '@talelabs/flows'
import type { NodeTypes } from '@xyflow/react'
import type { FlowGenerationSettingsInspector } from '../generation/flow-generation-settings-inspector'
import type {
  FlowGenerationSettingsKind,
  FlowNodeMetadata,
} from './flow-node-metadata'

import { MusicGenerationFlowNode } from './audio/music-generation/music-generation-flow-node'
import { AudioSettingsCard } from './audio/shared/audio-settings-card'
import { SoundEffectGenerationFlowNode } from './audio/sound-effect-generation/sound-effect-generation-flow-node'
import { SpeechGenerationFlowNode } from './audio/speech-generation/speech-generation-flow-node'
import { VoiceChangerFlowNode } from './audio/voice-changer/voice-changer-flow-node'
import { VoiceIsolationFlowNode } from './audio/voice-isolation/voice-isolation-flow-node'
import { FLOW_NODE_METADATA } from './flow-node-metadata'
import { ImageGenerationFlowNode } from './image-generation/image-generation-flow-node'
import { ImageGenerationSettingsCard } from './image-generation/image-generation-settings-card'
import { AssetFlowNode } from './inputs/asset-flow-node'
import { TextFlowNode } from './inputs/text-flow-node'
import { LlmFlowNode } from './llm/llm-flow-node'
import { LlmSettingsCard } from './llm/llm-settings-card'
import { GenerationFlowNode } from './shared/generation-node/generation-flow-node'
import { StandardGenerationSettingsCard } from './shared/settings/standard-generation-settings-card'
import { VideoGenerationFlowNode } from './video-generation/video-generation-flow-node'
import { VideoGenerationSettingsCard } from './video-generation/video-generation-settings-card'

/** Metadata plus the React components required by editor and inspector composition. */
export interface FlowDashboardNodeDefinition extends FlowNodeMetadata {
  /** Stable React Flow component registered for this persisted node type. */
  component: NodeTypes[string]
  /** Settings component selected by the metadata renderer family, when present. */
  generationSettings?: FlowGenerationSettingsInspector
}

const FLOW_REACT_NODE_COMPONENTS = {
  asset: AssetFlowNode,
  audioGeneration: GenerationFlowNode,
  imageGeneration: ImageGenerationFlowNode,
  llm: LlmFlowNode,
  musicGeneration: MusicGenerationFlowNode,
  soundEffectGeneration: SoundEffectGenerationFlowNode,
  speechGeneration: SpeechGenerationFlowNode,
  text: TextFlowNode,
  videoGeneration: VideoGenerationFlowNode,
  voiceChanger: VoiceChangerFlowNode,
  voiceIsolation: VoiceIsolationFlowNode,
} satisfies Record<FlowNodeType, NodeTypes[string]>

const FLOW_GENERATION_SETTINGS_RENDERERS = {
  audio: AudioSettingsCard,
  image: ImageGenerationSettingsCard,
  llm: LlmSettingsCard,
  standard: StandardGenerationSettingsCard,
  video: VideoGenerationSettingsCard,
} satisfies Record<FlowGenerationSettingsKind, FlowGenerationSettingsInspector>

/** Full dashboard definitions derived from the canonical metadata table. */
export const FLOW_DASHBOARD_NODE_REGISTRY = Object.fromEntries(
  Object.values(FLOW_NODE_METADATA).map((metadata) => {
    const generationSettings = metadata.generationSettingsKind
      ? FLOW_GENERATION_SETTINGS_RENDERERS[metadata.generationSettingsKind]
      : undefined
    return [
      metadata.type,
      {
        ...metadata,
        component: FLOW_REACT_NODE_COMPONENTS[metadata.type],
        ...(generationSettings ? { generationSettings } : {}),
      },
    ]
  }),
) as unknown as Record<FlowNodeType, FlowDashboardNodeDefinition>

/** Referentially stable React Flow `nodeTypes` map derived by node type. */
export const FLOW_REACT_NODE_TYPES = Object.fromEntries(
  Object.values(FLOW_NODE_METADATA).map(metadata => [
    metadata.type,
    FLOW_REACT_NODE_COMPONENTS[metadata.type],
  ]),
) satisfies NodeTypes

/** Returns the dashboard component projection for one persisted node type. */
export function getFlowDashboardNodeDefinition(
  type: FlowNodeType,
): FlowDashboardNodeDefinition {
  return FLOW_DASHBOARD_NODE_REGISTRY[type]
}
