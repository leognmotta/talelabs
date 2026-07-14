import type {
  GenerationContractIssue,
} from './generation-evaluator.js'
import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationOperationDefinition,
  GenerationSettingValue,
} from './generation-registry-types.js'

import { evaluateGenerationContract } from './generation-evaluator.js'

export const VIDEO_GENERATION_INPUT_SLOT_IDS = [
  'prompt',
  'firstFrame',
  'lastFrame',
  'imageReferences',
  'videoReferences',
  'audioReferences',
] as const

export type VideoGenerationInputSlotId
  = typeof VIDEO_GENERATION_INPUT_SLOT_IDS[number]

export type VideoInputAvailability = GenerationInputAvailability

export interface VideoGenerationStateIssue {
  code:
    | GenerationContractIssue['code']
    | 'video_input_family_conflict'
    | 'video_operation_ambiguous'
    | 'video_operation_unresolved'
  constraintId?: string
  inputId?: string
  messageKey?: string
  settingId?: string
}

export interface VideoGenerationState {
  candidateOperationIds: readonly string[]
  inputAvailability: Readonly<Record<string, VideoInputAvailability>>
  issues: readonly VideoGenerationStateIssue[]
  readiness: 'incomplete' | 'invalid' | 'ready'
  resolvedOperationId: null | string
  visibleSettingIds: readonly string[]
}

export interface ResolveVideoGenerationStateInput {
  connectionCounts?: Readonly<Record<string, number>>
  inlinePrompt?: string
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
}

const FRAME_SLOT_IDS = new Set(['firstFrame', 'lastFrame'])
const REFERENCE_SLOT_IDS = new Set([
  'audioReferences',
  'imageReferences',
  'videoReferences',
])
const LEGACY_SLOT_ALIASES: Readonly<Record<string, VideoGenerationInputSlotId>> = {
  referenceAudio: 'audioReferences',
  references: 'imageReferences',
  referenceVideo: 'videoReferences',
}

export function normalizeVideoGenerationInputSlotId(slotId: string) {
  return LEGACY_SLOT_ALIASES[slotId] ?? slotId
}

function countForSlot(
  counts: Readonly<Record<string, number>>,
  slotId: string,
) {
  return Math.max(0, counts[slotId] ?? 0)
}

function effectiveCount(input: {
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  slotId: string
}) {
  const count = Math.max(
    countForSlot(input.connectionCounts, input.slotId),
    countForSlot(input.itemCounts, input.slotId),
  )
  return normalizeVideoGenerationInputSlotId(input.slotId) === 'prompt'
    && input.inlinePrompt.trim().length > 0
    ? Math.max(1, count)
    : count
}

function connectedSlotIds(
  model: GenerationModelDefinition,
  connectionCounts: Readonly<Record<string, number>>,
  itemCounts: Readonly<Record<string, number>>,
) {
  return model.inputSlots
    .filter(slot => Math.max(
      countForSlot(connectionCounts, slot.id),
      countForSlot(itemCounts, slot.id),
    ) > 0)
    .map(slot => slot.id)
}

function slotFamily(slotId: string) {
  const normalized = normalizeVideoGenerationInputSlotId(slotId)
  if (FRAME_SLOT_IDS.has(normalized))
    return 'frame'
  if (REFERENCE_SLOT_IDS.has(normalized))
    return 'reference'
  return null
}

function operationMissingRequirementCount(input: {
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  operation: GenerationOperationDefinition
}) {
  let missing = 0
  for (const [slotId, contract] of Object.entries(input.operation.inputs)) {
    if (contract.required) {
      if (effectiveCount({ ...input, slotId }) < 1)
        missing += 1
      continue
    }
    const group = contract.atLeastOne ?? contract.oneOf
    if (
      group
      && !group.some(groupSlotId => effectiveCount({
        ...input,
        slotId: groupSlotId,
      }) > 0)
    ) {
      missing += 1
    }
  }
  return missing
}

function compatibleOperations(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
}) {
  const connected = connectedSlotIds(
    input.model,
    input.connectionCounts,
    input.itemCounts,
  )
  const hasFrameIntent = connected.some(slotId => slotFamily(slotId) === 'frame')
  const hasReferenceIntent = connected.some(slotId => slotFamily(slotId) === 'reference')
  if (hasFrameIntent && hasReferenceIntent)
    return []
  return input.model.operations.filter(operation => (
    connected.every(slotId => operation.inputSlotIds.includes(slotId))
  ))
}

function resolveOperation(input: {
  candidates: readonly GenerationOperationDefinition[]
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
}) {
  const connected = connectedSlotIds(
    input.model,
    input.connectionCounts,
    input.itemCounts,
  )
  const hasMediaIntent = connected.some(slotId => slotFamily(slotId) !== null)
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

function hasInvalidExactOne(input: {
  connectionCounts: Readonly<Record<string, number>>
  inlinePrompt: string
  itemCounts: Readonly<Record<string, number>>
  operation: GenerationOperationDefinition
}) {
  return Object.values(input.operation.inputs).some(contract => (
    contract.oneOf
    && contract.oneOf.filter(slotId => effectiveCount({ ...input, slotId }) > 0).length > 1
  ))
}

function availabilityForSlot(input: {
  connectedIds: readonly string[]
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  slotId: string
}): VideoInputAvailability {
  const slot = input.model.inputSlots.find(item => item.id === input.slotId)
  if (!slot)
    return { state: 'unsupported' }

  const connectionCount = countForSlot(input.connectionCounts, slot.id)
  const itemCount = countForSlot(input.itemCounts, slot.id)
  if (connectionCount > 0) {
    if (connectionCount >= slot.maxConnections || itemCount >= slot.maxItems) {
      return {
        reasonKey: 'flows.video.inputs.limitReached',
        state: 'full',
      }
    }
    return { connectionCount, itemCount, state: 'connected' }
  }

  const family = slotFamily(slot.id)
  const conflictingFamily = family === 'frame'
    ? 'reference'
    : family === 'reference'
      ? 'frame'
      : null
  const familyConflicts = input.connectedIds.filter(connectedId => (
    slotFamily(connectedId) === conflictingFamily
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
  if (!compatibleOperations({
    connectionCounts: proposedConnectionCounts,
    itemCounts: input.itemCounts,
    model: input.model,
  }).length) {
    return {
      conflictingSlotIds: input.connectedIds.filter(id => slotFamily(id) !== null),
      reasonKey: 'flows.video.inputs.disconnectIncompatible',
      state: 'blocked',
    }
  }

  return { state: 'available' }
}

/**
 * Resolves a video node from curated capability data and current inputs. This
 * module is intentionally free of React, browser, database, and provider code.
 */
export function resolveVideoGenerationState(
  input: ResolveVideoGenerationStateInput,
): VideoGenerationState {
  const connectionCounts = input.connectionCounts ?? {}
  const itemCounts = input.itemCounts ?? connectionCounts
  const inlinePrompt = input.inlinePrompt ?? ''
  const connectedIds = connectedSlotIds(input.model, connectionCounts, itemCounts)
  const candidates = input.model.mediaType === 'video'
    ? compatibleOperations({ connectionCounts, itemCounts, model: input.model })
    : []
  const resolvedOperation = resolveOperation({
    candidates,
    connectionCounts,
    inlinePrompt,
    itemCounts,
    model: input.model,
  })
  const inputAvailability: Record<string, VideoInputAvailability> = {}
  for (const slotId of new Set([
    ...VIDEO_GENERATION_INPUT_SLOT_IDS,
    ...input.model.inputSlots.map(slot => slot.id),
  ])) {
    inputAvailability[slotId] = availabilityForSlot({
      connectedIds,
      connectionCounts,
      itemCounts,
      model: input.model,
      slotId,
    })
  }

  const issues: VideoGenerationStateIssue[] = []
  const frameIds = connectedIds.filter(slotId => slotFamily(slotId) === 'frame')
  const referenceIds = connectedIds.filter(slotId => slotFamily(slotId) === 'reference')
  if (frameIds.length && referenceIds.length) {
    issues.push({
      code: 'video_input_family_conflict',
      messageKey: 'flows.video.readiness.frameReferenceConflict',
    })
  }
  if (!resolvedOperation) {
    issues.push({
      code: candidates.length > 1
        ? 'video_operation_ambiguous'
        : 'video_operation_unresolved',
      messageKey: candidates.length > 1
        ? 'flows.video.readiness.ambiguous'
        : 'flows.video.readiness.unsupportedCombination',
    })
  }

  const effectiveConnectionCounts = { ...connectionCounts }
  const effectiveItemCounts = { ...itemCounts }
  if (inlinePrompt.trim().length > 0) {
    effectiveConnectionCounts.prompt = Math.max(1, effectiveConnectionCounts.prompt ?? 0)
    effectiveItemCounts.prompt = Math.max(1, effectiveItemCounts.prompt ?? 0)
  }
  const presentationOperation = resolvedOperation
    ?? input.model.operations.find(operation => operation.id === input.model.defaultOperationId)
  const evaluation = presentationOperation
    ? evaluateGenerationContract({
        connectionCounts: effectiveConnectionCounts,
        itemCounts: effectiveItemCounts,
        model: input.model,
        operationId: presentationOperation.id,
        requireComplete: Boolean(resolvedOperation),
        settings: input.settings,
      })
    : { activeInputSlotIds: [], issues: [], visibleSettingIds: [] }
  issues.push(...evaluation.issues)

  const incompleteIssueCodes = new Set<GenerationContractIssue['code']>([
    'generation_input_at_least_one',
    'generation_input_one_of',
    'generation_input_required',
    'generation_setting_required',
  ])
  const exactOneInvalid = resolvedOperation
    ? hasInvalidExactOne({
        connectionCounts: effectiveConnectionCounts,
        inlinePrompt,
        itemCounts,
        operation: resolvedOperation,
      })
    : false
  const incompleteConstraintIds = new Set(input.model.constraints.flatMap((constraint) => {
    const missingRequiredSlot = constraint.require?.some(condition => (
      condition.field === 'slot'
      && effectiveCount({
        connectionCounts: effectiveConnectionCounts,
        inlinePrompt,
        itemCounts,
        slotId: condition.id,
      }) < 1
    ))
    return missingRequiredSlot ? [constraint.id] : []
  }))
  const invalid = !resolvedOperation
    || exactOneInvalid
    || issues.some(issue => (
      issue.code === 'video_input_family_conflict'
      || (
        !incompleteIssueCodes.has(issue.code as GenerationContractIssue['code'])
        && !(
          issue.code === 'generation_constraint'
          && issue.constraintId
          && incompleteConstraintIds.has(issue.constraintId)
        )
      )
    ))
  const readiness = invalid
    ? 'invalid'
    : issues.length
      ? 'incomplete'
      : 'ready'

  return {
    candidateOperationIds: candidates.map(operation => operation.id),
    inputAvailability,
    issues,
    readiness,
    resolvedOperationId: resolvedOperation?.id ?? null,
    visibleSettingIds: evaluation.visibleSettingIds,
  }
}

export function isVideoGenerationConnectionAdmissible(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
  slotId: string
}) {
  const current = resolveVideoGenerationState(input)
  const availability = current.inputAvailability[input.slotId]
  if (!availability || ['blocked', 'full', 'unsupported'].includes(availability.state))
    return false
  const slot = input.model.inputSlots.find(item => item.id === input.slotId)
  if (!slot)
    return false
  const proposedCounts = {
    ...input.connectionCounts,
    [slot.id]: countForSlot(input.connectionCounts, slot.id) + 1,
  }
  return compatibleOperations({
    connectionCounts: proposedCounts,
    itemCounts: input.itemCounts ?? proposedCounts,
    model: input.model,
  }).length > 0
}
