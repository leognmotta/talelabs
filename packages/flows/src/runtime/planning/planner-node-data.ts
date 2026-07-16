import type { FlowGraphNode } from '../../graph/types.js'
import {
  getGenerationModel,
  getGenerationOperation,
} from '../../generation/registry/index.js'

export function executableFlowNodeData(data: Record<string, unknown>) {
  const { locked: _locked, ...contractData } = data
  return contractData
}

export function generationOutputCount(node: FlowGraphNode) {
  const model = getGenerationModel(
    String(node.data.modelId ?? ''),
    node.data.modelContractVersion,
  )
  const operation = model
    ? getGenerationOperation(model, node.data.operationId)
    : undefined
  const count = operation?.output?.count
  if (!count)
    return 1
  const configured = count.settingId
    ? (node.data.settings as Record<string, unknown>)[count.settingId]
    : count.default
  return typeof configured === 'number' && Number.isSafeInteger(configured)
    ? configured
    : count.default
}

export function normalizedGenerationSettings(node: FlowGraphNode) {
  return Object.freeze({
    ...(node.data.settings as Record<string, boolean | number | string>),
  })
}
