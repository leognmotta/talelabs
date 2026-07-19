/** Fail-closed serialization from generation contracts to public API values. */

import type { GenerationConditionDefinition } from '@talelabs/flows'

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
