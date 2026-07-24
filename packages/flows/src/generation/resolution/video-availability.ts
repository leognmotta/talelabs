/** Resolves catalog-owned video input availability, limits, and conflicts. */
import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationOperationDefinition,
} from '../registry/types.js'
import { effectiveVideoInputCount, videoInputCount } from './video-inputs.js'
import { videoSlotFamily } from './video-intent.js'
import { compatibleVideoOperations } from './video-operations.js'

function hasReferenceCapacity(input: {
  itemCounts: Readonly<Record<string, number>>
  operations: readonly GenerationOperationDefinition[]
  slotId: string
}) {
  return input.operations.some((operation) => {
    const limit = operation.referenceLimit
    if (!limit || !limit.slotIds.includes(input.slotId)) {
      return true
    }
    const itemCount = limit.slotIds.reduce(
      (total, slotId) => total + videoInputCount(input.itemCounts, slotId),
      0,
    )
    return itemCount < limit.maxItems
  })
}

/** Returns whether one operation has more than one populated exact-one input. */
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

/**
 * Resolves whether one video input can accept another item under the catalog's
 * per-slot, family-conflict, operation-compatibility, and combined-limit rules.
 */
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
  if (connectionCount >= slot.maxConnections || itemCount >= slot.maxItems) {
    return {
      reasonKey: 'flows.video.inputs.limitReached',
      state: 'full',
    }
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
    [slot.id]: Math.max(1, connectionCount),
  }
  const compatibleOperations = compatibleVideoOperations({
    connectionCounts: proposedConnectionCounts,
    itemCounts: input.itemCounts,
    model: input.model,
  })
  if (!compatibleOperations.length) {
    return {
      conflictingSlotIds: input.connectedIds.filter(id => videoSlotFamily(id) !== null),
      reasonKey: 'flows.video.inputs.disconnectIncompatible',
      state: 'blocked',
    }
  }

  if (!hasReferenceCapacity({
    itemCounts: input.itemCounts,
    operations: compatibleOperations,
    slotId: slot.id,
  })) {
    return {
      reasonKey: 'flows.video.inputs.limitReached',
      state: 'full',
    }
  }

  if (connectionCount > 0)
    return { connectionCount, itemCount, state: 'connected' }

  return { state: 'available' }
}
