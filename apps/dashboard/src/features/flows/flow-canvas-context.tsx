import type { FlowValueType } from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type {
  CanvasEdge,
  CanvasNode,
  FlowCanvasAssetUpload,
  FlowGenerationPreview,
  FlowInputState,
  FlowReferenceData,
} from './flow-canvas-types'
import type { FlowGenerationPreviewScope } from './flow-mock-runtime-planner'

import { createContext, use } from 'react'

export interface GenerationInputContract {
  exclusiveGroup?: string
  id: string
  maxConnections: number
  operationIds?: readonly string[]
  valueTypes: readonly FlowValueType[]
}

export interface GenerationConfigurationUpdate {
  activeInputContracts: readonly GenerationInputContract[]
  inputSlotIds: readonly string[]
  inputHandleAliases?: Readonly<Record<string, string>>
  inputMaximums?: Readonly<Record<string, number>>
  modelContractVersion: string
  modelId: string
  operationId: string
  settings: Readonly<Record<string, boolean | number | string>>
}

export interface FlowCanvasContextValue {
  deleteNodes: (nodeIds: string[]) => void
  duplicateNodes: (nodeIds: string[]) => void
  editingImageCropNodeId: null | string
  generationConfig: GenerationConfigResponse
  getExecutableInputCount: (nodeId: string, slotId: string) => number
  getAssetUpload: (nodeId: string) => FlowCanvasAssetUpload | undefined
  getInputState: (nodeId: string, slotId: string) => FlowInputState | null
  getIncompatibleGenerationEdgeCount: (
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
    inputHandleAliases?: Readonly<Record<string, string>>,
  ) => number
  getIncompatibleGenerationEdges: (
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => readonly CanvasEdge[]
  getGenerationPreview: (nodeId: string) => FlowGenerationPreview | undefined
  getGenerationPreviewFingerprint: (nodeId: string) => null | string
  getNode: (nodeId: string) => CanvasNode | undefined
  openAssetPicker: (nodeId: string) => void
  openInputInspector: (nodeId: string, slotId: string) => void
  openNodeOutputInspector: (nodeId: string) => void
  referenceData: FlowReferenceData
  runGenerationPreview: (
    nodeId: string,
    scope?: FlowGenerationPreviewScope,
  ) => Promise<void>
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
    configuration: GenerationConfigurationUpdate,
  ) => void
  updateNodeReference: (
    nodeId: string,
    reference: { assetId: null | string },
  ) => void
}

export const FlowCanvasContext = createContext<FlowCanvasContextValue | null>(
  null,
)

export function useFlowCanvas() {
  const value = use(FlowCanvasContext)
  if (!value)
    throw new Error('FlowCanvasContext is unavailable.')
  return value
}
