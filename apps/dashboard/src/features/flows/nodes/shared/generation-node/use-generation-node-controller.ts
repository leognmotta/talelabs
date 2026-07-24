/** Per-node generation controller over narrow runtime and scoped store access. */

import type {
  AudioIntentNodeType,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasEdge, CanvasNode, FlowInputState } from '../../../editor/flow-canvas-types'
import type { GenerationConfigurationUpdate, GenerationInputContract } from '../../../generation/flow-generation-configuration'
import {
  coercePromptTemplate,
  getGenerationInputSlotsForNodeType,
  isCurrentGenerationModelContract,
} from '@talelabs/flows'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { promptTemplateIsValid } from '../../../../generation/prompt-composer/prompt-template-adapter'
import { useCanvasStoreApi } from '../../../editor/canvas-state/canvas-store-context'
import { setCanvasSelection } from '../../../editor/canvas-state/canvas-ui-actions'
import { useFlowCanvasRuntime, useFlowGenerationPreview } from '../../../editor/flow-canvas-runtime-context'
import { createFlowGenerationCanvasBridge } from '../../../generation/flow-generation-canvas-bridge'
import { getCanvasGenerationModel } from '../../../generation/flow-generation-contract'
import { generationConnectionCounts } from './generation-node-controller-values'
import { useGenerationPromptInputs } from './generation-prompt-input-context'

export * from './generation-node-controller-values'

type GenerationNodeScope
  = | {
    categoryId: string
    categoryLabelKey: string
    kind: 'mediaType'
    mediaType: 'image' | 'text' | 'video'
  }
  | {
    categoryId: string
    categoryLabelKey: string
    kind: 'nodeType'
    nodeType: AudioIntentNodeType
  }

/** Graph commands and runtime queries scoped to one generation-node controller. */
export interface GenerationNodeCanvas {
  /** Server-owned generation catalog projection. */
  generationConfig: ReturnType<typeof useFlowCanvasRuntime>['generationConfig']
  /** Reads the executable item count for one input slot. */
  getExecutableInputCount: ReturnType<typeof useFlowCanvasRuntime>['getExecutableInputCount']
  /** Reads the latest durable run preview for one node. */
  getGenerationPreview: ReturnType<typeof useFlowCanvasRuntime>['getGenerationPreview']
  /** Computes the current immutable run-input fingerprint for one node. */
  getGenerationPreviewFingerprint: ReturnType<typeof useFlowCanvasRuntime>['getGenerationPreviewFingerprint']
  /** Finds incoming edges rejected by a proposed generation contract. */
  getIncompatibleGenerationEdges: (
    nodeId: string,
    inputContracts: readonly GenerationInputContract[],
  ) => readonly CanvasEdge[]
  /** Resolves the current input selection and availability state. */
  getInputState: (
    nodeId: string,
    slotId: string,
  ) => FlowInputState | null
  /** Selects one node and focuses its output connection inspector. */
  openNodeOutputInspector: (nodeId: string) => void
  /** Atomically applies one complete generation model configuration. */
  updateGenerationConfiguration: (
    nodeId: string,
    configuration: GenerationConfigurationUpdate,
  ) => void
  /** Applies one persistent node-data mutation. */
  updateNodeData: (
    nodeId: string,
    update: (data: Record<string, any>) => Record<string, any>,
  ) => void
}

/** Builds localized generation configuration and commands for one node. */
export function useGenerationNodeController(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
  scope: GenerationNodeScope
}) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const preview = useFlowGenerationPreview(input.node.id)
  const promptInputs = useGenerationPromptInputs(input.node.id)
  const updateNodeInternals = useUpdateNodeInternals()
  const model = getCanvasGenerationModel(input.node)
  const scopedNodeType = input.scope.kind === 'nodeType'
    ? input.scope.nodeType
    : null
  const scopedMediaType = input.scope.kind === 'mediaType'
    ? input.scope.mediaType
    : null
  const scopeCategoryId = input.scope.categoryId
  const scopeCategoryLabelKey = input.scope.categoryLabelKey
  const slots = useMemo(() => {
    if (!model)
      return []
    return scopedNodeType
      ? getGenerationInputSlotsForNodeType(model, scopedNodeType)
      : model.inputSlots
  }, [model, scopedNodeType])
  const connectionCounts = useMemo(
    () => generationConnectionCounts(input.incomingConnections),
    [input.incomingConnections],
  )
  const handleSignature = slots.map(slot => slot.id).join(':')

  useEffect(() => {
    const frame = requestAnimationFrame(() => updateNodeInternals(input.node.id))
    return () => cancelAnimationFrame(frame)
  }, [
    handleSignature,
    input.node.data.modelContractVersion,
    input.node.id,
    updateNodeInternals,
  ])

  const configModels = useMemo(
    () => runtime.generationConfig.models.filter((config) => {
      if (!config.enabled)
        return false
      if (scopedMediaType)
        return config.mediaType === scopedMediaType
      const nodeType = scopedNodeType
      return config.capabilities.operations.some(
        operation => operation.nodeType === nodeType,
      )
    }),
    [runtime.generationConfig.models, scopedMediaType, scopedNodeType],
  )
  const modelOptions = useMemo(
    () => configModels.map((config) => {
      const operations = scopedNodeType
        ? config.capabilities.operations.filter((operation) => {
            return operation.nodeType === scopedNodeType
          })
        : config.capabilities.operations
      return {
        capabilities: operations.map(operation => t(operation.labelKey)),
        category: {
          id: scopeCategoryId,
          label: t(scopeCategoryLabelKey),
        },
        description: t(config.presentation.descriptionKey),
        disabled: false,
        id: config.id,
        label: t(config.labelKey),
        logoId: config.presentation.logoId,
        recommended: config.recommended,
      }
    }),
    [configModels, scopeCategoryId, scopeCategoryLabelKey, scopedNodeType, t],
  )
  const currentConfigModel = configModels.find(config => config.id === model?.id)
  const canUpgradeModelContract = Boolean(
    currentConfigModel
    && !isCurrentGenerationModelContract(
      currentConfigModel.id,
      input.node.data.modelContractVersion,
    ),
  )
  const generationCanvas = useMemo(() => createFlowGenerationCanvasBridge({
    referenceData: runtime.referenceData,
    store,
  }), [runtime.referenceData, store])
  const promptReferencesValid = input.node.data.prompt === undefined
    || (connectionCounts.prompt ?? 0) > 0
    || promptTemplateIsValid(
      coercePromptTemplate(input.node.data.prompt),
      promptInputs,
    )
  const canvas = useMemo<GenerationNodeCanvas>(() => ({
    generationConfig: runtime.generationConfig,
    getExecutableInputCount: runtime.getExecutableInputCount,
    getGenerationPreview: nodeId => nodeId === input.node.id
      ? preview
      : runtime.getGenerationPreview(nodeId),
    getGenerationPreviewFingerprint: runtime.getGenerationPreviewFingerprint,
    getIncompatibleGenerationEdges:
      generationCanvas.getIncompatibleGenerationEdges,
    getInputState: generationCanvas.getInputState,
    openNodeOutputInspector: (nodeId) => {
      setCanvasSelection(store, { nodeIds: [nodeId] })
      requestAnimationFrame(() => {
        document.getElementById(`flow-node-connections-${nodeId}`)?.focus()
      })
    },
    updateGenerationConfiguration:
      generationCanvas.updateGenerationConfiguration,
    updateNodeData: generationCanvas.updateNodeData,
  }), [generationCanvas, input.node.id, preview, runtime, store])

  return {
    canvas,
    canUpgradeModelContract,
    configModels,
    connectionCounts,
    model,
    modelOptions,
    promptInputs,
    promptReferencesValid,
    slots,
  }
}
