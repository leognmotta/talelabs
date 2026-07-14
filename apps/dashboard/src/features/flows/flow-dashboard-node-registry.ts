import type { FlowNodeType } from '@talelabs/flows'
import type { NodeTypes } from '@xyflow/react'
import type { FlowGenerationSettingsInspector } from './flow-generation-settings-inspector'

import {
  IconArrowsExchange,
  IconFilter,
  IconMicrophone,
  IconMusic,
  IconPhotoSpark,
  IconSparkles,
  IconTextCaption,
  IconVideo,
} from '@tabler/icons-react'
import { AssetIcon } from '../../shared/domain-icons'
import { AssetFlowNode } from './nodes/asset-flow-node'
import { MusicGenerationFlowNode } from './nodes/audio/music-generation/music-generation-flow-node'
import { AudioSettingsCard } from './nodes/audio/shared/audio-settings-card'
import { SoundEffectGenerationFlowNode } from './nodes/audio/sound-effect-generation/sound-effect-generation-flow-node'
import { SpeechGenerationFlowNode } from './nodes/audio/speech-generation/speech-generation-flow-node'
import { VoiceChangerFlowNode } from './nodes/audio/voice-changer/voice-changer-flow-node'
import { VoiceIsolationFlowNode } from './nodes/audio/voice-isolation/voice-isolation-flow-node'
import { GenerationFlowNode } from './nodes/generation-flow-node'
import { ImageGenerationFlowNode } from './nodes/image-generation/image-generation-flow-node'
import { ImageGenerationSettingsCard } from './nodes/image-generation/image-generation-settings-card'
import { LlmFlowNode } from './nodes/llm/llm-flow-node'
import { LlmSettingsCard } from './nodes/llm/llm-settings-card'
import { StandardGenerationSettingsCard } from './nodes/standard-generation-settings-card'
import { TextFlowNode } from './nodes/text-flow-node'
import { VideoGenerationFlowNode } from './nodes/video-generation/video-generation-flow-node'
import { VideoGenerationSettingsCard } from './nodes/video-generation/video-generation-settings-card'

export interface FlowDashboardNodeDefinition {
  component: NodeTypes[string]
  descriptionKey: string
  icon: typeof IconTextCaption
  inspector?: 'assetMetadata' | 'generationSettings'
  generationSettings?: FlowGenerationSettingsInspector
  generationToolbar?: {
    actions: readonly FlowGenerationToolbarAction[]
  }
  labelKey: string
  pickerGroup: FlowNodePickerGroup
  pickerOrder: number
  pickerVisible: boolean
  type: FlowNodeType
}

export type FlowGenerationToolbarAction = 'copyOutput' | 'download'

export type FlowNodePickerGroup = 'generation' | 'inputs' | 'transform'

export const FLOW_NODE_PICKER_GROUPS = [
  {
    id: 'inputs',
    labelKey: 'flows.nodePicker.groups.inputs',
  },
  {
    id: 'generation',
    labelKey: 'flows.nodePicker.groups.generation',
  },
  {
    id: 'transform',
    labelKey: 'flows.nodePicker.groups.transform',
  },
] as const satisfies readonly {
  id: FlowNodePickerGroup
  labelKey: string
}[]

export const FLOW_DASHBOARD_NODE_REGISTRY = {
  asset: {
    component: AssetFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.asset',
    icon: AssetIcon,
    inspector: 'assetMetadata',
    labelKey: 'flows.nodes.asset',
    pickerGroup: 'inputs',
    pickerOrder: 20,
    pickerVisible: true,
    type: 'asset',
  },
  audioGeneration: {
    component: GenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.audioGeneration',
    icon: IconMusic,
    generationToolbar: { actions: ['download'] },
    generationSettings: StandardGenerationSettingsCard,
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.audioGeneration',
    pickerGroup: 'generation',
    pickerOrder: 999,
    pickerVisible: false,
    type: 'audioGeneration',
  },
  imageGeneration: {
    component: ImageGenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.imageGeneration',
    icon: IconPhotoSpark,
    generationToolbar: {
      actions: ['download'],
    },
    generationSettings: ImageGenerationSettingsCard,
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.imageGeneration',
    pickerGroup: 'generation',
    pickerOrder: 10,
    pickerVisible: true,
    type: 'imageGeneration',
  },
  llm: {
    component: LlmFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.llm',
    icon: IconSparkles,
    generationSettings: LlmSettingsCard,
    generationToolbar: { actions: ['copyOutput', 'download'] },
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.llm',
    pickerGroup: 'generation',
    pickerOrder: 60,
    pickerVisible: true,
    type: 'llm',
  },
  musicGeneration: {
    component: MusicGenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.musicGeneration',
    icon: IconMusic,
    generationSettings: AudioSettingsCard,
    generationToolbar: { actions: ['download'] },
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.musicGeneration',
    pickerGroup: 'generation',
    pickerOrder: 40,
    pickerVisible: true,
    type: 'musicGeneration',
  },
  soundEffectGeneration: {
    component: SoundEffectGenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.soundEffectGeneration',
    icon: IconSparkles,
    generationSettings: AudioSettingsCard,
    generationToolbar: { actions: ['download'] },
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.soundEffectGeneration',
    pickerGroup: 'generation',
    pickerOrder: 50,
    pickerVisible: true,
    type: 'soundEffectGeneration',
  },
  speechGeneration: {
    component: SpeechGenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.speechGeneration',
    icon: IconMicrophone,
    generationSettings: AudioSettingsCard,
    generationToolbar: { actions: ['download'] },
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.speechGeneration',
    pickerGroup: 'generation',
    pickerOrder: 30,
    pickerVisible: true,
    type: 'speechGeneration',
  },
  text: {
    component: TextFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.text',
    icon: IconTextCaption,
    labelKey: 'flows.nodes.text',
    pickerGroup: 'inputs',
    pickerOrder: 10,
    pickerVisible: true,
    type: 'text',
  },
  videoGeneration: {
    component: VideoGenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.videoGeneration',
    icon: IconVideo,
    generationToolbar: {
      actions: ['download'],
    },
    generationSettings: VideoGenerationSettingsCard,
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.videoGeneration',
    pickerGroup: 'generation',
    pickerOrder: 20,
    pickerVisible: true,
    type: 'videoGeneration',
  },
  voiceChanger: {
    component: VoiceChangerFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.voiceChanger',
    icon: IconArrowsExchange,
    generationSettings: AudioSettingsCard,
    generationToolbar: { actions: ['download'] },
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.voiceChanger',
    pickerGroup: 'transform',
    pickerOrder: 10,
    pickerVisible: true,
    type: 'voiceChanger',
  },
  voiceIsolation: {
    component: VoiceIsolationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.voiceIsolation',
    icon: IconFilter,
    generationSettings: AudioSettingsCard,
    generationToolbar: { actions: ['download'] },
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.voiceIsolation',
    pickerGroup: 'transform',
    pickerOrder: 20,
    pickerVisible: true,
    type: 'voiceIsolation',
  },
} as const satisfies Record<FlowNodeType, FlowDashboardNodeDefinition>

export const FLOW_REACT_NODE_TYPES = Object.fromEntries(
  Object.values(FLOW_DASHBOARD_NODE_REGISTRY).map(definition => [
    definition.type,
    definition.component,
  ]),
) satisfies NodeTypes

export const FLOW_NODE_PICKER_DEFINITIONS = Object.freeze(
  Object.values(FLOW_DASHBOARD_NODE_REGISTRY)
    .filter(definition => definition.pickerVisible)
    .toSorted((left, right) => left.pickerOrder - right.pickerOrder),
)

export function getFlowDashboardNodeDefinition(
  type: FlowNodeType,
): FlowDashboardNodeDefinition {
  return FLOW_DASHBOARD_NODE_REGISTRY[type]
}
