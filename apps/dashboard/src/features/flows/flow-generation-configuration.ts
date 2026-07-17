/** Generation model and operation transitions applied to canvas node state. */

import type { GenerationModelDefinition } from '@talelabs/flows'
import type { GenerationConfigurationUpdate, GenerationInputContract } from './canvas-state/canvas-generation-actions'
import type { CanvasNode } from './flow-canvas-types'

import {
  applyGenerationSettingRequirements,
  getGenerationModel,
} from '@talelabs/flows'

/** Model and operation identity requested by a settings transition. */
export interface FlowGenerationConfigurationChange {
  /** Immutable catalog contract version selected for the node. */
  modelContractVersion: string
  /** Canonical creative model ID selected for the node. */
  modelId: string
  /** Operation exposed by the selected model. */
  operationId: string
}

/** Canvas command required to apply one complete generation configuration. */
export interface FlowGenerationConfigurationCanvas {
  /** Atomically applies the resolved model contract to one node. */
  updateGenerationConfiguration: (
    nodeId: string,
    configuration: GenerationConfigurationUpdate,
  ) => void
}

/** Resolves the input contracts exposed by one model operation. */
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

/** Normalizes and applies a complete model or operation transition. */
export function applyFlowGenerationConfiguration(input: {
  canvas: FlowGenerationConfigurationCanvas
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
