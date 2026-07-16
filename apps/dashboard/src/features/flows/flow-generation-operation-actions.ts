import type {
  GenerationModelDefinition,
  GenerationOperationDefinition,
} from '@talelabs/flows'
import type { FlowCanvasContextValue } from './flow-canvas-context'
import type { CanvasNode } from './flow-canvas-types'
import type { FlowGenerationConfigurationChange } from './flow-generation-configuration'

import { applyGenerationSettingRequirements } from '@talelabs/flows'

export function createFlowGenerationOperationActions(input: {
  applyConfiguration: (change: FlowGenerationConfigurationChange) => void
  canvas: FlowCanvasContextValue
  connectedSlotIds: ReadonlySet<string>
  model?: GenerationModelDefinition
  node: CanvasNode
  operation?: GenerationOperationDefinition
}) {
  function updateOperation(operationId: string) {
    if (!input.model || operationId === input.operation?.id)
      return
    input.applyConfiguration({
      modelContractVersion: input.node.data.modelContractVersion,
      modelId: input.model.id,
      operationId,
    })
  }

  function updateSetting(settingId: string, value: boolean | number | string) {
    if (!input.model || !input.operation)
      return
    const settings = applyGenerationSettingRequirements({
      connectedSlotIds: input.connectedSlotIds,
      model: input.model,
      operationId: input.operation.id,
      settings: { ...input.node.data.settings, [settingId]: value },
    })
    input.canvas.updateNodeData(input.node.id, current => ({
      ...current,
      settings,
    }))
  }

  return { updateOperation, updateSetting }
}
