/** Generation model and operation transitions applied to canvas node state. */

import type { FlowValueType, GenerationModelDefinition } from '@talelabs/flows'
import type { CanvasNode } from '../editor/flow-canvas-types'

import {
  applyGenerationSettingRequirements,
  getGenerationModel,
} from '@talelabs/flows'

/** Minimal generation input contract used when reconciling model transitions. */
export interface GenerationInputContract {
  /** Mutually exclusive input family, when the operation declares one. */
  exclusiveGroup?: string
  /** Stable semantic input handle ID. */
  id: string
  /** Maximum number of incoming edges accepted by the input. */
  maxConnections: number
  /** Operations compatible with this input when operation intersection applies. */
  operationIds?: readonly string[]
  /** Graph value types accepted by the input. */
  valueTypes: readonly FlowValueType[]
}

/** Complete generation configuration applied atomically to one canvas node. */
export interface GenerationConfigurationUpdate {
  /** Input contracts active for the selected model and operation. */
  activeInputContracts: readonly GenerationInputContract[]
  /** Stable input IDs retained in the node's selection map. */
  inputSlotIds: readonly string[]
  /** One-time legacy handle rewrites applied before compatibility filtering. */
  inputHandleAliases?: Readonly<Record<string, string>>
  /** Per-input maximum used to bound retained explicit selections. */
  inputMaximums?: Readonly<Record<string, number>>
  /** Immutable contract version selected for the node. */
  modelContractVersion: string
  /** Canonical creative model ID selected for the node. */
  modelId: string
  /** Operation derived for the selected model and connected inputs. */
  operationId: string
  /** Normalized model settings persisted with the node. */
  settings: Readonly<Record<string, boolean | number | string>>
}

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
