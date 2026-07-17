/** Confirmation-aware generation model transition commands for one node. */

import type { GenerationModelDefinition } from '@talelabs/flows'
import type { GenerationConfigResponse } from '@talelabs/sdk'
import type { GenerationConfigurationUpdate } from '../../../generation/flow-generation-configuration'

import { getGenerationModel } from '@talelabs/flows'
import { useCallback } from 'react'

type ConfigModel = GenerationConfigResponse['models'][number]

/** Coordinates confirmed model changes and current-contract upgrades. */
export function useGenerationModelTransition(input: {
  applyConfiguration: (
    nodeId: string,
    configuration: GenerationConfigurationUpdate,
  ) => void
  configModels: readonly ConfigModel[]
  currentContractVersion: unknown
  currentModel: GenerationModelDefinition | undefined
  nodeId: string
  resolveConfiguration: (
    targetModel: GenerationModelDefinition,
    targetContractVersion: string,
  ) => GenerationConfigurationUpdate | null
}) {
  const {
    applyConfiguration,
    configModels,
    currentContractVersion,
    currentModel,
    nodeId,
    resolveConfiguration,
  } = input
  const requestModelChange = useCallback((modelId: string) => {
    const config = configModels.find(item => item.id === modelId)
    if (!config)
      return
    if (
      config.id === currentModel?.id
      && config.contractVersion === currentContractVersion
    ) {
      return
    }
    const targetModel = getGenerationModel(config.id, config.contractVersion)
    if (!targetModel)
      return
    const configuration = resolveConfiguration(
      targetModel,
      config.contractVersion,
    )
    if (configuration)
      applyConfiguration(nodeId, configuration)
  }, [
    applyConfiguration,
    configModels,
    currentContractVersion,
    currentModel?.id,
    nodeId,
    resolveConfiguration,
  ])

  const upgradeModelContract = useCallback(() => {
    if (currentModel)
      requestModelChange(currentModel.id)
  }, [currentModel, requestModelChange])

  return { requestModelChange, upgradeModelContract }
}
