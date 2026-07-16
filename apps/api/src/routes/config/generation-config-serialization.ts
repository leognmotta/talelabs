import type {
  FlowValueType,
  GENERATION_MODELS,
  GenerationConditionDefinition,
} from '@talelabs/flows'

import { getGenerationModelPresentation } from '@talelabs/flows'

type ActiveFlowValueType = Exclude<FlowValueType, 'ElementContext'>

export function serializeGenerationCondition(
  condition: GenerationConditionDefinition,
) {
  if (condition.field === 'operation')
    return { ...condition }
  if (condition.field === 'slot')
    return { ...condition }
  if (condition.operator === 'equals')
    return { ...condition }
  return { ...condition, values: [...condition.values] }
}

export function serializeGenerationModelPresentation(
  model: (typeof GENERATION_MODELS)[number],
) {
  const presentation = getGenerationModelPresentation(model.id)
  if (!presentation) {
    throw new Error(
      `Current generation model ${model.id} is missing presentation metadata`,
    )
  }
  return { ...presentation }
}

export function serializeActiveFlowValueTypes(
  valueTypes: readonly FlowValueType[],
): ActiveFlowValueType[] {
  return valueTypes.map((valueType) => {
    if (valueType === 'ElementContext') {
      throw new Error(
        'Current generation models cannot expose deferred Element context inputs',
      )
    }
    return valueType
  })
}
