/** Canonical non-component metadata for every dashboard Flow node type. */

import type { FlowNodeType } from '@talelabs/flows'

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
import { AssetIcon } from '../../../shared/domain-icons'

/** Output actions supported by a generation node's selected-state toolbar. */
export type FlowGenerationToolbarAction = 'copyOutput' | 'crop' | 'download'

/** Shared settings renderer selected by generation-node metadata. */
export type FlowGenerationSettingsKind
  = | 'audio'
    | 'image'
    | 'llm'
    | 'standard'
    | 'video'

/** Product grouping used by picker and canvas-context-menu projections. */
export type FlowNodePickerGroup = 'generation' | 'inputs' | 'transform'

/**
 * Canonical presentation and capability metadata for one Flow node type.
 * React node and settings components are attached separately to avoid cycles
 * from shared node UI back into component registration.
 */
export interface FlowNodeMetadata {
  /** Translation key describing the node in add-node surfaces. */
  descriptionKey: string
  /** Icon rendered by picker and context-menu projections. */
  icon: typeof IconTextCaption
  /** Inspector capability exposed when this node is selected. */
  inspector?: 'assetMetadata' | 'generationSettings'
  /** Settings renderer family used by generation inspector composition. */
  generationSettingsKind?: FlowGenerationSettingsKind
  /** Translation key naming the node when no model-specific name applies. */
  labelKey: string
  /** Product group containing the node in add-node surfaces. */
  pickerGroup: FlowNodePickerGroup
  /** Stable order within the node's picker group. */
  pickerOrder: number
  /** Whether users may currently add this node from picker surfaces. */
  pickerVisible: boolean
  /** Ordered output actions shown after common generation run commands. */
  toolbarActions?: readonly FlowGenerationToolbarAction[]
  /** Persisted Flow graph node type. */
  type: FlowNodeType
}

/** Picker group order and translation keys shared by add-node surfaces. */
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

/**
 * Authoritative dashboard metadata keyed by persisted Flow node type.
 * Picker visibility, inspector ownership, and toolbar capabilities must be
 * changed here rather than in separate UI registries.
 */
export const FLOW_NODE_METADATA: Record<FlowNodeType, FlowNodeMetadata> = {
  asset: {
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
    descriptionKey: 'flows.nodePicker.descriptions.audioGeneration',
    icon: IconMusic,
    generationSettingsKind: 'standard',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.audioGeneration',
    pickerGroup: 'generation',
    pickerOrder: 999,
    pickerVisible: false,
    toolbarActions: ['download'],
    type: 'audioGeneration',
  },
  imageGeneration: {
    descriptionKey: 'flows.nodePicker.descriptions.imageGeneration',
    icon: IconPhotoSpark,
    generationSettingsKind: 'image',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.imageGeneration',
    pickerGroup: 'generation',
    pickerOrder: 10,
    pickerVisible: true,
    toolbarActions: ['crop', 'download'],
    type: 'imageGeneration',
  },
  llm: {
    descriptionKey: 'flows.nodePicker.descriptions.llm',
    icon: IconSparkles,
    generationSettingsKind: 'llm',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.llm',
    pickerGroup: 'generation',
    pickerOrder: 60,
    pickerVisible: true,
    toolbarActions: ['copyOutput', 'download'],
    type: 'llm',
  },
  musicGeneration: {
    descriptionKey: 'flows.nodePicker.descriptions.musicGeneration',
    icon: IconMusic,
    generationSettingsKind: 'audio',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.musicGeneration',
    pickerGroup: 'generation',
    pickerOrder: 40,
    pickerVisible: true,
    toolbarActions: ['download'],
    type: 'musicGeneration',
  },
  soundEffectGeneration: {
    descriptionKey: 'flows.nodePicker.descriptions.soundEffectGeneration',
    icon: IconSparkles,
    generationSettingsKind: 'audio',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.soundEffectGeneration',
    pickerGroup: 'generation',
    pickerOrder: 50,
    pickerVisible: true,
    toolbarActions: ['download'],
    type: 'soundEffectGeneration',
  },
  speechGeneration: {
    descriptionKey: 'flows.nodePicker.descriptions.speechGeneration',
    icon: IconMicrophone,
    generationSettingsKind: 'audio',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.speechGeneration',
    pickerGroup: 'generation',
    pickerOrder: 30,
    pickerVisible: true,
    toolbarActions: ['download'],
    type: 'speechGeneration',
  },
  text: {
    descriptionKey: 'flows.nodePicker.descriptions.text',
    icon: IconTextCaption,
    labelKey: 'flows.nodes.text',
    pickerGroup: 'inputs',
    pickerOrder: 10,
    pickerVisible: true,
    type: 'text',
  },
  videoGeneration: {
    descriptionKey: 'flows.nodePicker.descriptions.videoGeneration',
    icon: IconVideo,
    generationSettingsKind: 'video',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.videoGeneration',
    pickerGroup: 'generation',
    pickerOrder: 20,
    pickerVisible: true,
    toolbarActions: ['download'],
    type: 'videoGeneration',
  },
  voiceChanger: {
    descriptionKey: 'flows.nodePicker.descriptions.voiceChanger',
    icon: IconArrowsExchange,
    generationSettingsKind: 'audio',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.voiceChanger',
    pickerGroup: 'transform',
    pickerOrder: 10,
    pickerVisible: true,
    toolbarActions: ['download'],
    type: 'voiceChanger',
  },
  voiceIsolation: {
    descriptionKey: 'flows.nodePicker.descriptions.voiceIsolation',
    icon: IconFilter,
    generationSettingsKind: 'audio',
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.voiceIsolation',
    pickerGroup: 'transform',
    pickerOrder: 20,
    pickerVisible: true,
    toolbarActions: ['download'],
    type: 'voiceIsolation',
  },
}

/** Visible node definitions sorted into stable picker order. */
export const FLOW_NODE_PICKER_DEFINITIONS = Object.freeze(
  Object.values(FLOW_NODE_METADATA)
    .filter(definition => definition.pickerVisible)
    .toSorted((left, right) => left.pickerOrder - right.pickerOrder),
)

/** Returns canonical metadata for one persisted Flow node type. */
export function getFlowNodeMetadata(type: FlowNodeType): FlowNodeMetadata {
  return FLOW_NODE_METADATA[type]
}
