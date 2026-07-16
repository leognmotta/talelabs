import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationOperationDefinition,
} from '../registry/types.js'
import { effectiveVideoInputCount, videoInputCount } from './video-inputs.js'
import { videoSlotFamily } from './video-intent.js'
import { compatibleVideoOperations } from './video-operations.js'

export function hasInvalidVideoExactOne(input: {
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  operation: GenerationOperationDefinition
}) {
  return Object.values(input.operation.inputs).some(contract => (
    contract.oneOf
    && contract.oneOf.filter(slotId => effectiveVideoInputCount({ ...input, slotId }) > 0).length > 1
  ))
}

export function videoAvailabilityForSlot(input: {
  connectedIds: readonly string[]
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  slotId: string
}): GenerationInputAvailability {
  const slot = input.model.inputSlots.find(item => item.id === input.slotId)
  if (!slot)
    return { state: 'unsupported' }

  const connectionCount = videoInputCount(input.connectionCounts, slot.id)
  const itemCount = videoInputCount(input.itemCounts, slot.id)
  if (connectionCount > 0) {
    if (connectionCount >= slot.maxConnections || itemCount >= slot.maxItems) {
      return {
        reasonKey: 'flows.video.inputs.limitReached',
        state: 'full',
      }
    }
    return { connectionCount, itemCount, state: 'connected' }
  }

  const family = videoSlotFamily(slot.id)
  const conflictingFamily = family === 'frame'
    ? 'reference'
    : family === 'reference'
      ? 'frame'
      : null
  const familyConflicts = input.connectedIds.filter(connectedId => (
    videoSlotFamily(connectedId) === conflictingFamily
  ))
  if (familyConflicts.length) {
    return {
      conflictingSlotIds: familyConflicts,
      reasonKey: family === 'frame'
        ? 'flows.video.inputs.disconnectReferences'
        : 'flows.video.inputs.disconnectFrames',
      state: 'blocked',
    }
  }

  const proposedConnectionCounts = {
    ...input.connectionCounts,
    [slot.id]: connectionCount + 1,
  }
  if (!compatibleVideoOperations({
    connectionCounts: proposedConnectionCounts,
    itemCounts: input.itemCounts,
    model: input.model,
  }).length) {
    return {
      conflictingSlotIds: input.connectedIds.filter(id => videoSlotFamily(id) !== null),
      reasonKey: 'flows.video.inputs.disconnectIncompatible',
      state: 'blocked',
    }
  }

  return { state: 'available' }
}
