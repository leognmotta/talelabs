import type { FlowValueType } from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type {
  CanvasNode,
  FlowInputState,
  FlowReferenceData,
} from './flow-canvas-types'

import { createContext, use } from 'react'

export interface GenerationInputContract {
  exclusiveGroup?: string
  id: string
  maxConnections: number
  valueTypes: readonly FlowValueType[]
}

export interface FlowCanvasContextValue {
  deleteNodes: (nodeIds: string[]) => void
  duplicateNodes: (nodeIds: string[]) => void
  editingImageCropNodeId: null | string
  generationConfig: GenerationConfigResponse
  getInputState: (nodeId: string, slotId: string) => FlowInputState | null
  getIncompatibleGenerationEdgeCount: (
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => number
  getNode: (nodeId: string) => CanvasNode | undefined
  openAssetPicker: (nodeId: string) => void
  openElementPicker: (nodeId: string) => void
  openInputInspector: (nodeId: string, slotId: string) => void
  referenceData: FlowReferenceData
  setInputSelection: (
    nodeId: string,
    slotId: string,
    selection: { mode: 'auto' } | { assetIds: string[], mode: 'manual' },
  ) => void
  setEditingImageCropNodeId: (nodeId: null | string) => void
  updateNodeData: (
    nodeId: string,
    update: (data: Record<string, any>) => Record<string, any>,
  ) => void
  updateGenerationConfiguration: (
    nodeId: string,
    configuration: {
      activeInputContracts: readonly GenerationInputContract[]
      inputSlotIds: readonly string[]
      modelContractVersion: string
      modelId: string
      operationId: string
      settings: Readonly<Record<string, boolean | number | string>>
    },
  ) => void
  updateNodeReference: (
    nodeId: string,
    reference: { assetId?: null | string, elementId?: null | string },
  ) => void
}

export const FlowCanvasContext = createContext<FlowCanvasContextValue | null>(null)

export function useFlowCanvas() {
  const value = use(FlowCanvasContext)
  if (!value)
    throw new Error('FlowCanvasContext is unavailable.')
  return value
}
