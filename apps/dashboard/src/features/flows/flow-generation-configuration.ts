import type { GenerationModelDefinition } from '@talelabs/flows'
import type {
  FlowCanvasContextValue,
  GenerationInputContract,
} from './flow-canvas-context'
import type { CanvasNode } from './flow-canvas-types'

import {
  applyGenerationSettingRequirements,
  getGenerationModel,
} from '@talelabs/flows'

export interface FlowGenerationConfigurationChange {
  modelContractVersion: string
  modelId: string
  operationId: string
}

export function generationTargetInputContracts(
  targetModel: GenerationModelDefinition,
  operationId: string,
): GenerationInputContract[] {
  const operation = targetModel.operations.find(item => item.id === operationId)
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

export function applyFlowGenerationConfiguration(input: {
  canvas: FlowCanvasContextValue
  change: FlowGenerationConfigurationChange
  connectedSlotIds: ReadonlySet<string>
  currentModel?: GenerationModelDefinition
  node: CanvasNode
}) {
  const nextModel = getGenerationModel(
    input.change.modelId,
    input.change.modelContractVersion,
  )
  if (!nextModel)
    return
  const modelChanged = nextModel.id !== input.currentModel?.id
    || input.change.modelContractVersion !== input.node.data.modelContractVersion
  const configuredSettings = Object.fromEntries(
    nextModel.settings.map(setting => [
      setting.id,
      modelChanged
        ? setting.default
        : (input.node.data.settings?.[setting.id] ?? setting.default),
    ]),
  )
  const settings = applyGenerationSettingRequirements({
    connectedSlotIds: input.connectedSlotIds,
    model: nextModel,
    operationId: input.change.operationId,
    settings: configuredSettings,
  })
  input.canvas.updateGenerationConfiguration(input.node.id, {
    activeInputContracts: generationTargetInputContracts(
      nextModel,
      input.change.operationId,
    ),
    inputSlotIds: nextModel.inputSlots.map(slot => slot.id),
    modelContractVersion: input.change.modelContractVersion,
    modelId: nextModel.id,
    operationId: input.change.operationId,
    settings,
  })
}
