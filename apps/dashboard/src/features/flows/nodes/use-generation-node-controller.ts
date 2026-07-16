import type {
  AudioIntentNodeType,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { CanvasNode } from '../flow-canvas-types'

import {
  getGenerationInputSlotsForNodeType,
  isCurrentGenerationModelContract,
} from '@talelabs/flows'
import { useUpdateNodeInternals } from '@xyflow/react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from '../flow-canvas-context'
import { getCanvasGenerationModel } from '../flow-generation-contract'
import { generationConnectionCounts } from './generation-node-controller-values'

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

export function useGenerationNodeController(input: {
  incomingConnections: readonly NodeConnection[]
  node: Pick<CanvasNode, 'data' | 'id' | 'type'>
  scope: GenerationNodeScope
}) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
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
    () => canvas.generationConfig.models.filter((config) => {
      if (!config.enabled)
        return false
      if (scopedMediaType)
        return config.mediaType === scopedMediaType
      const nodeType = scopedNodeType
      return config.capabilities.operations.some(
        operation => operation.nodeType === nodeType,
      )
    }),
    [canvas.generationConfig.models, scopedMediaType, scopedNodeType],
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

  return {
    canvas,
    canUpgradeModelContract,
    configModels,
    connectionCounts,
    model,
    modelOptions,
    slots,
  }
}
