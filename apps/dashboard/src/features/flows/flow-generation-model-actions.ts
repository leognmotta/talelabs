import type {
  GenerationModelDefinition,
  GenerationOperationDefinition,
} from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type { FlowGenerationConfigurationChange } from './flow-generation-configuration'

import { getGenerationModel } from '@talelabs/flows'

type ConfigModel = GenerationConfigResponse['models'][number]

export function createFlowGenerationModelActions(input: {
  applyConfiguration: (change: FlowGenerationConfigurationChange) => void
  availableModels: ConfigModel[]
  currentContractVersion: unknown
  currentModel?: GenerationModelDefinition
  operation?: GenerationOperationDefinition
  upgradeConfigModel?: ConfigModel
}) {
  function updateModel(modelId: string) {
    const nextConfigModel = input.availableModels.find(item => item.id === modelId)
    if (
      !nextConfigModel
      || (nextConfigModel.id === input.currentModel?.id
        && nextConfigModel.contractVersion === input.currentContractVersion)
    ) {
      return
    }
    input.applyConfiguration({
      modelContractVersion: nextConfigModel.contractVersion,
      modelId,
      operationId: nextConfigModel.defaultOperationId,
    })
  }

  function upgradeModelContract() {
    if (!input.upgradeConfigModel)
      return
    const nextModel = getGenerationModel(
      input.upgradeConfigModel.id,
      input.upgradeConfigModel.contractVersion,
    )
    if (!nextModel)
      return
    input.applyConfiguration({
      modelContractVersion: input.upgradeConfigModel.contractVersion,
      modelId: input.upgradeConfigModel.id,
      operationId:
        input.operation
        && nextModel.operations.some(item => item.id === input.operation?.id)
          ? input.operation.id
          : nextModel.defaultOperationId,
    })
  }

  return { updateModel, upgradeModelContract }
}
