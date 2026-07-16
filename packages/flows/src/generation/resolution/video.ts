import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'
import type {
  GenerationContractIssue,
} from './evaluator.js'

import { evaluateGenerationContract } from './evaluator.js'
import {
  hasInvalidVideoExactOne,
  videoAvailabilityForSlot,
} from './video-availability.js'
import {
  effectiveVideoInputCount,
  VIDEO_GENERATION_INPUT_SLOT_IDS,
  videoInputCount,
} from './video-inputs.js'
import { connectedVideoSlotIds, videoSlotFamily } from './video-intent.js'
import {
  compatibleVideoOperations,
  resolveVideoOperation,
} from './video-operations.js'

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
  const connectedIds = connectedVideoSlotIds(input.model, connectionCounts, itemCounts)
  const candidates = input.model.mediaType === 'video'
    ? compatibleVideoOperations({ connectionCounts, itemCounts, model: input.model })
    : []
  const resolvedOperation = resolveVideoOperation({
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
    inputAvailability[slotId] = videoAvailabilityForSlot({
      connectedIds,
      connectionCounts,
      itemCounts,
      model: input.model,
      slotId,
    })
  }

  const issues: VideoGenerationStateIssue[] = []
  const frameIds = connectedIds.filter(slotId => videoSlotFamily(slotId) === 'frame')
  const referenceIds = connectedIds.filter(slotId => videoSlotFamily(slotId) === 'reference')
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
    ? hasInvalidVideoExactOne({
        connectionCounts: effectiveConnectionCounts,
        inlinePrompt,
        itemCounts,
        operation: resolvedOperation,
      })
    : false
  const incompleteConstraintIds = new Set(input.model.constraints.flatMap((constraint) => {
    const missingRequiredSlot = constraint.require?.some(condition => (
      condition.field === 'slot'
      && effectiveVideoInputCount({
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
    [slot.id]: videoInputCount(input.connectionCounts, slot.id) + 1,
  }
  return compatibleVideoOperations({
    connectionCounts: proposedCounts,
    itemCounts: input.itemCounts ?? proposedCounts,
    model: input.model,
  }).length > 0
}
