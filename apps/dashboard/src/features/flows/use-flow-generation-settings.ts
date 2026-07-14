import type { GenerationModelDefinition } from '@talelabs/flows'
import type { GenerationInputContract } from './flow-canvas-context'

import type { CanvasNode } from './flow-canvas-types'
import {
  applyGenerationSettingRequirements,
  evaluateGenerationContract,
  getActiveGenerationSettings,
  getGenerationModel,
  getGenerationOperation,
  isCurrentGenerationModelContract,
} from '@talelabs/flows'
import { useTranslation } from 'react-i18next'
import { useFlowCanvas } from './flow-canvas-context'
import { getCanvasGenerationModel } from './flow-generation-contract'

interface ConfigurationChange {
  modelContractVersion: string
  modelId: string
  operationId: string
}

function nodeMediaType(node: CanvasNode) {
  if (node.type === 'audioGeneration')
    return 'audio'
  if (node.type === 'videoGeneration')
    return 'video'
  return 'image'
}

export function useFlowGenerationSettings(node: CanvasNode) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const mediaType = nodeMediaType(node)
  const mediaModels = canvas.generationConfig.models.filter(
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

  function targetInputContracts(
    targetModel: GenerationModelDefinition,
    operationId: string,
  ): GenerationInputContract[] {
    const operation = targetModel.operations.find(
      item => item.id === operationId,
    )
    const activeIds = new Set(operation?.inputSlotIds ?? [])
    const exclusiveGroups = new Map<string, string>()
    for (const [groupId, contract] of Object.entries(operation?.inputs ?? {})) {
      for (const slotId of contract.oneOf ?? [])
        exclusiveGroups.set(slotId, groupId)
    }
    return targetModel.inputSlots
      .filter(slot => activeIds.has(slot.id))
      .map(slot => ({
        ...(exclusiveGroups.has(slot.id)
          ? { exclusiveGroup: exclusiveGroups.get(slot.id)! }
          : {}),
        id: slot.id,
        maxConnections: slot.maxConnections,
        valueTypes: slot.accepts,
      }))
  }

  function applyConfiguration(change: ConfigurationChange) {
    const nextModel = getGenerationModel(
      change.modelId,
      change.modelContractVersion,
    )
    if (!nextModel)
      return
    const modelChanged
      = nextModel.id !== model?.id
        || change.modelContractVersion !== node.data.modelContractVersion
    const configuredSettings = Object.fromEntries(
      nextModel.settings.map(setting => [
        setting.id,
        modelChanged
          ? setting.default
          : (node.data.settings?.[setting.id] ?? setting.default),
      ]),
    )
    const settings = applyGenerationSettingRequirements({
      connectedSlotIds,
      model: nextModel,
      operationId: change.operationId,
      settings: configuredSettings,
    })
    canvas.updateGenerationConfiguration(node.id, {
      activeInputContracts: targetInputContracts(nextModel, change.operationId),
      inputSlotIds: nextModel.inputSlots.map(slot => slot.id),
      modelContractVersion: change.modelContractVersion,
      modelId: nextModel.id,
      operationId: change.operationId,
      settings,
    })
  }

  function updateModel(modelId: string) {
    const nextConfigModel = availableModels.find(item => item.id === modelId)
    if (
      !nextConfigModel
      || (nextConfigModel.id === model?.id
        && nextConfigModel.contractVersion === node.data.modelContractVersion)
    ) {
      return
    }
    applyConfiguration({
      modelContractVersion: nextConfigModel.contractVersion,
      modelId,
      operationId: nextConfigModel.defaultOperationId,
    })
  }

  const upgradeConfigModel
    = savedConfigModel
      && !isCurrentGenerationModelContract(
        savedConfigModel.id,
        node.data.modelContractVersion,
      )
      ? savedConfigModel
      : undefined

  function upgradeModelContract() {
    if (!upgradeConfigModel)
      return
    const nextModel = getGenerationModel(
      upgradeConfigModel.id,
      upgradeConfigModel.contractVersion,
    )
    if (!nextModel)
      return
    applyConfiguration({
      modelContractVersion: upgradeConfigModel.contractVersion,
      modelId: upgradeConfigModel.id,
      operationId:
        operation
        && nextModel.operations.some(item => item.id === operation.id)
          ? operation.id
          : nextModel.defaultOperationId,
    })
  }

  function updateOperation(operationId: string) {
    if (!model || operationId === operation?.id)
      return
    applyConfiguration({
      modelContractVersion: node.data.modelContractVersion,
      modelId: model.id,
      operationId,
    })
  }

  function updateSetting(settingId: string, value: boolean | number | string) {
    if (!model || !operation)
      return
    const settings = applyGenerationSettingRequirements({
      connectedSlotIds,
      model,
      operationId: operation.id,
      settings: { ...node.data.settings, [settingId]: value },
    })
    canvas.updateNodeData(node.id, current => ({ ...current, settings }))
  }

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
