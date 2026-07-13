import type { FlowNodeType } from '@talelabs/flows'
import type { NodeTypes } from '@xyflow/react'

import {
  IconComponents,
  IconMusic,
  IconPhotoSpark,
  IconTextCaption,
  IconVideo,
} from '@tabler/icons-react'
import { AssetIcon } from '../../shared/domain-icons'
import { AssetFlowNode } from './nodes/asset-flow-node'
import { ElementFlowNode } from './nodes/element-flow-node'
import { GenerationFlowNode } from './nodes/generation-flow-node'
import { TextFlowNode } from './nodes/text-flow-node'

export interface FlowDashboardNodeDefinition {
  component: NodeTypes[string]
  descriptionKey: string
  icon: typeof IconTextCaption
  inspector?: 'assetMetadata' | 'generationSettings'
  labelKey: string
  pickerGroup: FlowNodePickerGroup
  pickerOrder: number
  pickerVisible: boolean
  type: FlowNodeType
}

export type FlowNodePickerGroup = 'generation' | 'inputs'

export const FLOW_NODE_PICKER_GROUPS = [
  {
    id: 'inputs',
    labelKey: 'flows.nodePicker.groups.inputs',
  },
  {
    id: 'generation',
    labelKey: 'flows.nodePicker.groups.generation',
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
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.audioGeneration',
    pickerGroup: 'generation',
    pickerOrder: 30,
    pickerVisible: true,
    type: 'audioGeneration',
  },
  element: {
    component: ElementFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.element',
    icon: IconComponents,
    labelKey: 'flows.nodes.element',
    pickerGroup: 'inputs',
    pickerOrder: 30,
    pickerVisible: true,
    type: 'element',
  },
  imageGeneration: {
    component: GenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.imageGeneration',
    icon: IconPhotoSpark,
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.imageGeneration',
    pickerGroup: 'generation',
    pickerOrder: 10,
    pickerVisible: true,
    type: 'imageGeneration',
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
    component: GenerationFlowNode,
    descriptionKey: 'flows.nodePicker.descriptions.videoGeneration',
    icon: IconVideo,
    inspector: 'generationSettings',
    labelKey: 'flows.nodes.videoGeneration',
    pickerGroup: 'generation',
    pickerOrder: 20,
    pickerVisible: true,
    type: 'videoGeneration',
  },
} as const satisfies Record<FlowNodeType, FlowDashboardNodeDefinition>

export const FLOW_REACT_NODE_TYPES = Object.fromEntries(
  Object.values(FLOW_DASHBOARD_NODE_REGISTRY).map(definition => [
    definition.type,
    definition.component,
  ]),
) satisfies NodeTypes

export const FLOW_NODE_PICKER_DEFINITIONS = Object.freeze(
  Object.values(FLOW_DASHBOARD_NODE_REGISTRY).filter(
    definition => definition.pickerVisible,
  ).toSorted((left, right) => left.pickerOrder - right.pickerOrder),
)

export function getFlowDashboardNodeDefinition(
  type: FlowNodeType,
): FlowDashboardNodeDefinition {
  return FLOW_DASHBOARD_NODE_REGISTRY[type]
}
