import type {
  AudioIntentNodeType,
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { GenerationInputContract } from '../flow-canvas-context'
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

export function generationConnectionCounts(
  connections: readonly NodeConnection[],
) {
  const counts: Record<string, number> = {}
  for (const connection of connections) {
    if (!connection.targetHandle)
      continue
    counts[connection.targetHandle]
      = (counts[connection.targetHandle] ?? 0) + 1
  }
  return counts
}

export function generationInlineValue(input: {
  connectionCounts: Readonly<Record<string, number>>
  data: Readonly<Record<string, unknown>>
  slotId: string
}) {
  return (input.connectionCounts[input.slotId] ?? 0) > 0
    ? ''
    : String(input.data[input.slotId] ?? '')
}

export function generationInputContracts(input: {
  model: GenerationModelDefinition
  normalizeSlotId?: (slotId: string) => string
  operations?: GenerationModelDefinition['operations']
  slots?: readonly GenerationInputSlotDefinition[]
}): GenerationInputContract[] {
  const operations = input.operations ?? input.model.operations
  const slots = input.slots ?? input.model.inputSlots
  return slots.map(slot => ({
    id: input.normalizeSlotId?.(slot.id) ?? slot.id,
    maxConnections: slot.maxConnections,
    operationIds: operations
      .filter(operation => operation.inputSlotIds.includes(slot.id))
      .map(operation => operation.id),
    valueTypes: slot.accepts,
  }))
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

  const configModels = canvas.generationConfig.models.filter((config) => {
    if (!config.enabled)
      return false
    if (input.scope.kind === 'mediaType')
      return config.mediaType === input.scope.mediaType
    const nodeType = input.scope.nodeType
    return config.capabilities.operations.some(
      operation => operation.nodeType === nodeType,
    )
  })
  const modelOptions = configModels.map((config) => {
    const operations = input.scope.kind === 'nodeType'
      ? config.capabilities.operations.filter((operation) => {
          const nodeType = input.scope.kind === 'nodeType'
            ? input.scope.nodeType
            : undefined
          return operation.nodeType === nodeType
        })
      : config.capabilities.operations
    return {
      capabilities: operations.map(operation => t(operation.labelKey)),
      category: {
        id: input.scope.categoryId,
        label: t(input.scope.categoryLabelKey),
      },
      description: t(config.presentation.descriptionKey),
      id: config.id,
      label: t(config.labelKey),
      logoId: config.presentation.logoId,
      recommended: config.recommended,
    }
  })
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
