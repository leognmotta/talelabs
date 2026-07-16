import type {
  GenerationModelDefinition,
  GenerationOperationDefinition,
} from '../registry/types.js'
import { effectiveVideoInputCount } from './video-inputs.js'
import { connectedVideoSlotIds, videoSlotFamily } from './video-intent.js'

function operationMissingRequirementCount(input: {
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  operation: GenerationOperationDefinition
}) {
  let missing = 0
  for (const [slotId, contract] of Object.entries(input.operation.inputs)) {
    if (contract.required) {
      if (effectiveVideoInputCount({ ...input, slotId }) < 1)
        missing += 1
      continue
    }
    const group = contract.atLeastOne ?? contract.oneOf
    if (
      group
      && !group.some(groupSlotId => effectiveVideoInputCount({
        ...input,
        slotId: groupSlotId,
      }) > 0)
    ) {
      missing += 1
    }
  }
  return missing
}

export function compatibleVideoOperations(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
}) {
  const connected = connectedVideoSlotIds(
    input.model,
    input.connectionCounts,
    input.itemCounts,
  )
  const hasFrameIntent = connected.some(slotId => videoSlotFamily(slotId) === 'frame')
  const hasReferenceIntent = connected.some(slotId => videoSlotFamily(slotId) === 'reference')
  if (hasFrameIntent && hasReferenceIntent)
    return []
  return input.model.operations.filter(operation => (
    connected.every(slotId => operation.inputSlotIds.includes(slotId))
  ))
}

export function resolveVideoOperation(input: {
  candidates: readonly GenerationOperationDefinition[]
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
}) {
  const connected = connectedVideoSlotIds(
    input.model,
    input.connectionCounts,
    input.itemCounts,
  )
  const hasMediaIntent = connected.some(slotId => videoSlotFamily(slotId) !== null)
  if (!hasMediaIntent) {
    return input.candidates.find(operation => (
      operation.id === input.model.defaultOperationId
    )) ?? (input.candidates.length === 1 ? input.candidates[0] : undefined)
  }

  const ranked = input.candidates.map((operation, index) => ({
    index,
    missing: operationMissingRequirementCount({
      connectionCounts: input.connectionCounts,
      inlinePrompt: input.inlinePrompt,
      itemCounts: input.itemCounts,
      operation,
    }),
    operation,
  })).toSorted((left, right) => (
    left.missing - right.missing || left.index - right.index
  ))
  if (!ranked.length)
    return undefined
  const best = ranked.filter(item => item.missing === ranked[0]!.missing)
  if (best.length === 1)
    return best[0]!.operation
  return best.find(item => item.operation.id === input.model.defaultOperationId)?.operation
}
