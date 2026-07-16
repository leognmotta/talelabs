import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
} from '@talelabs/flows'
import type { NodeConnection } from '@xyflow/react'
import type { GenerationInputContract } from '../flow-canvas-context'

export function generationConnectionCounts(
  connections: readonly NodeConnection[],
) {
  const counts: Record<string, number> = {}
  for (const connection of connections) {
    if (!connection.targetHandle)
      continue
    counts[connection.targetHandle]
      = (counts[connection.targetHandle] ?? 0) + 1
  }
  return counts
}

export function generationInlineValue(input: {
  connectionCounts: Readonly<Record<string, number>>
  data: Readonly<Record<string, unknown>>
  slotId: string
}) {
  return (input.connectionCounts[input.slotId] ?? 0) > 0
    ? ''
    : String(input.data[input.slotId] ?? '')
}

export function generationInputContracts(input: {
  model: GenerationModelDefinition
  normalizeSlotId?: (slotId: string) => string
  operations?: GenerationModelDefinition['operations']
  slots?: readonly GenerationInputSlotDefinition[]
}): GenerationInputContract[] {
  const operations = input.operations ?? input.model.operations
  const slots = input.slots ?? input.model.inputSlots
  return slots.map(slot => ({
    id: input.normalizeSlotId?.(slot.id) ?? slot.id,
    maxConnections: slot.maxConnections,
    operationIds: operations
      .filter(operation => operation.inputSlotIds.includes(slot.id))
      .map(operation => operation.id),
    valueTypes: slot.accepts,
  }))
}
