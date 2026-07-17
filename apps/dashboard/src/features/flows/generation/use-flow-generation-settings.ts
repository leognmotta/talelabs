/** Generation settings inspector state and commands for one selected node. */

import type { CanvasNode } from '../editor/flow-canvas-types'
import type {
  FlowGenerationConfigurationChange,
} from './flow-generation-configuration'
import {
  evaluateGenerationContract,
  getActiveGenerationSettings,
  getGenerationOperation,
  isCurrentGenerationModelContract,
} from '@talelabs/flows'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCanvasStoreApi } from '../editor/canvas-state/canvas-store-context'
import { useFlowCanvasRuntime } from '../editor/flow-canvas-runtime-context'
import { createFlowGenerationCanvasBridge } from './flow-generation-canvas-bridge'
import {
  applyFlowGenerationConfiguration,
} from './flow-generation-configuration'
import { getCanvasGenerationModel } from './flow-generation-contract'
import { createFlowGenerationModelActions } from './flow-generation-model-actions'
import { createFlowGenerationOperationActions } from './flow-generation-operation-actions'

function nodeMediaType(node: CanvasNode) {
  if (node.type === 'audioGeneration')
    return 'audio'
  if (node.type === 'videoGeneration')
    return 'video'
  return 'image'
}

/** Resolves settings presentation and direct store commands for one node. */
export function useFlowGenerationSettings(node: CanvasNode) {
  const { t } = useTranslation()
  const store = useCanvasStoreApi()
  const runtime = useFlowCanvasRuntime()
  const canvas = useMemo(() => createFlowGenerationCanvasBridge({
    referenceData: runtime.referenceData,
    store,
  }), [runtime.referenceData, store])
  const mediaType = nodeMediaType(node)
  const mediaModels = runtime.generationConfig.models.filter(
    model => model.mediaType === mediaType,
  )
  const availableModels = mediaModels.filter(model => model.enabled)
  const model = getCanvasGenerationModel(node)
  const savedConfigModel = mediaModels.find(
    item => item.id === node.data.modelId,
  )
  const modelOptions = availableModels.map(item => ({
    capabilities: item.capabilities.operations.map(operation =>
      t(operation.labelKey),
    ),
    category: {
      id: item.mediaType,
      label: t(`assets.types.${item.mediaType}`),
    },
    description: t(item.presentation.descriptionKey),
    disabled: false,
    id: item.id,
    label: t(item.labelKey),
    logoId: item.presentation.logoId,
    recommended: item.recommended,
  }))
  const operation = model
    ? (getGenerationOperation(model, node.data.operationId)
      ?? getGenerationOperation(model, model.defaultOperationId))
    : undefined
  const connectedSlotIds = new Set(
    model?.inputSlots
      .filter(
        slot =>
          (canvas.getInputState(node.id, slot.id)?.connectionCount ?? 0) > 0,
      )
      .map(slot => slot.id) ?? [],
  )
  const contractEvaluation
    = model && operation
      ? evaluateGenerationContract({
          connectionCounts: Object.fromEntries(
            [...connectedSlotIds].map(id => [id, 1]),
          ),
          model,
          operationId: operation.id,
          settings: node.data.settings ?? {},
        })
      : undefined
  const visibleSettingIds = new Set(
    contractEvaluation?.visibleSettingIds ?? [],
  )
  const activeSettings
    = model && operation
      ? getActiveGenerationSettings(model, operation.id).filter(setting =>
          visibleSettingIds.has(setting.id),
        )
      : []

  const upgradeConfigModel
    = savedConfigModel
      && !isCurrentGenerationModelContract(
        savedConfigModel.id,
        node.data.modelContractVersion,
      )
      ? savedConfigModel
      : undefined

  const applyConfiguration = (change: FlowGenerationConfigurationChange) =>
    applyFlowGenerationConfiguration({
      canvas,
      change,
      connectedSlotIds,
      currentModel: model,
      node,
    })
  const { updateModel, upgradeModelContract } = createFlowGenerationModelActions({
    applyConfiguration,
    availableModels,
    currentContractVersion: node.data.modelContractVersion,
    currentModel: model,
    operation,
    upgradeConfigModel,
  })
  const { updateOperation, updateSetting } = createFlowGenerationOperationActions({
    applyConfiguration,
    canvas,
    connectedSlotIds,
    model,
    node,
    operation,
  })

  return {
    activeSettings,
    canUpgradeModelContract: Boolean(upgradeConfigModel),
    model,
    modelOptions,
    operation,
    updateModel,
    updateOperation,
    updateSetting,
    upgradeModelContract,
  }
}
