/** Fail-closed serialization from generation contracts to public API values. */

import type {
  FlowValueType,
  GenerationConditionDefinition,
} from '@talelabs/flows'

type ActiveFlowValueType = Exclude<FlowValueType, 'ElementContext'>

/** Serializes one provider-neutral catalog condition without private facts. */
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

/** Rejects deferred value types before public generation serialization. */
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
