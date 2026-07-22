/** Model-aware resolution and connection admission for five distinct audio node intents. */

import type {
  GenerationInputAvailability,
  GenerationModelDefinition,
  GenerationNodeType,
  GenerationSettingValue,
} from '../registry/types.js'
import type { GenerationContractIssue } from './evaluator.js'

import {
  getGenerationInputSlotsForNodeType,
  getGenerationOperationsForNodeType,
  isGenerationSettingValueValid,
} from '../registry/index.js'
import {
  audioInputAvailability,
  withInlineAudioText,
} from './audio-inputs.js'
import { evaluateGenerationContract } from './evaluator.js'
import { applyGenerationSettingRequirements } from './setting-requirements.js'

/** Node kinds whose independent creative intents share the audio resolver. */
export type AudioIntentNodeType = Extract<
  GenerationNodeType,
  | 'musicGeneration'
  | 'soundEffectGeneration'
  | 'speechGeneration'
  | 'voiceChanger'
  | 'voiceIsolation'
>

/** Contract or operation issue preventing a fully ready audio request. */
export interface AudioNodeStateIssue extends Omit<GenerationContractIssue, 'code'> {
  /** Stable issue code used by validation and localized presentation. */
  code: GenerationContractIssue['code'] | 'audio_operation_unresolved'
}

/** Model-derived readiness and presentation state for one audio intent node. */
export interface AudioNodeState {
  /** Per-slot connection state, including mutually exclusive input conflicts. */
  inputAvailability: Readonly<Record<string, GenerationInputAvailability>>
  /** Contract and setting issues explaining any non-ready state. */
  issues: readonly AudioNodeStateIssue[]
  /** Active operation settings after defaults and cross-field constraints. */
  normalizedSettings: Readonly<Record<string, GenerationSettingValue>>
  /** Whether the node is runnable, missing required values, or invalid. */
  readiness: 'incomplete' | 'invalid' | 'ready'
  /** Selected operation ID, or null when the model cannot serve the intent. */
  resolvedOperationId: null | string
  /** Setting IDs that the selected operation and current constraints expose. */
  visibleSettingIds: readonly string[]
}

/** Persisted and graph-derived values evaluated for an audio intent node. */
export interface ResolveAudioNodeStateInput {
  /** Incoming edge count by slot; omitted slots are treated as disconnected. */
  connectionCounts?: Readonly<Record<string, number>>
  /** Inline lyrics treated as a supplied lyrics input when non-empty. */
  inlineLyrics?: string
  /** Inline prompt treated as a supplied prompt input when non-empty. */
  inlinePrompt?: string
  /** Runtime item count by slot, defaulting to the corresponding edge count. */
  itemCounts?: Readonly<Record<string, number>>
  /** Selected catalog model whose operation contract governs resolution. */
  model: GenerationModelDefinition
  /** Persisted node settings before defaults and constraints are applied. */
  settings: Readonly<Record<string, GenerationSettingValue>>
}

/** Canonical node state produced when adopting a selected audio model. */
export interface ReconciledAudioNodeModel {
  /** Connected slots absent from the selected model and requiring removal. */
  incompatibleConnectedSlotIds: readonly string[]
  /** Ordered input slot IDs exposed by the selected model for this intent. */
  inputSlotIds: readonly string[]
  /** Saved setting IDs replaced because their values violate the new model. */
  resetSettingIds: readonly string[]
  /** Resolved readiness and availability after model reconciliation. */
  resolution: AudioNodeState
  /** Canonical settings retained or defaulted for the selected model. */
  settings: Readonly<Record<string, GenerationSettingValue>>
}

function audioInputCount(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  slotId: string
}) {
  return Math.max(
    0,
    input.connectionCounts[input.slotId] ?? 0,
    input.itemCounts[input.slotId] ?? 0,
  )
}

function audioExactOneConflicts(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  operation: NonNullable<ReturnType<typeof getGenerationOperationsForNodeType>[number]>
  slotId: string
}) {
  for (const contract of Object.values(input.operation.inputs)) {
    if (!contract.oneOf?.includes(input.slotId))
      continue
    return contract.oneOf.filter(slotId => (
      slotId !== input.slotId
      && audioInputCount({ ...input, slotId }) > 0
    ))
  }
  return []
}

function isIncompleteAudioIssue(input: {
  issue: AudioNodeStateIssue
  itemCounts: Readonly<Record<string, number>>
  operation: NonNullable<ReturnType<typeof getGenerationOperationsForNodeType>[number]>
}) {
  if (
    input.issue.code === 'generation_input_required'
    || input.issue.code === 'generation_setting_required'
  ) {
    return true
  }
  if (!input.issue.inputId)
    return false
  const contract = input.operation.inputs[input.issue.inputId]
  const group = input.issue.code === 'generation_input_one_of'
    ? contract?.oneOf
    : input.issue.code === 'generation_input_at_least_one'
      ? contract?.atLeastOne
      : undefined
  return Boolean(
    group
    && group.every(slotId => (input.itemCounts[slotId] ?? 0) < 1),
  )
}

/** Shared media-contract evaluator used by five focused intent resolvers. */
export function resolveAudioNodeState(
  nodeType: AudioIntentNodeType,
  input: ResolveAudioNodeStateInput,
): AudioNodeState {
  const connectionCounts = input.connectionCounts ?? {}
  const itemCounts = input.itemCounts ?? connectionCounts
  const effectiveConnections = withInlineAudioText(connectionCounts, input)
  const effectiveItems = withInlineAudioText(itemCounts, input)
  const operations = getGenerationOperationsForNodeType(input.model, nodeType)
  const operation = operations.find(item => item.id === input.model.defaultOperationId)
    ?? operations[0]
  const slots = getGenerationInputSlotsForNodeType(input.model, nodeType)
  const inputAvailability = Object.fromEntries(
    slots.map((slot) => {
      const conflictingSlotIds = operation
        ? audioExactOneConflicts({
            connectionCounts,
            itemCounts,
            operation,
            slotId: slot.id,
          })
        : []
      return [
        slot.id,
        conflictingSlotIds.length
        && audioInputCount({ connectionCounts, itemCounts, slotId: slot.id }) < 1
          ? {
              conflictingSlotIds,
              reasonKey: 'flows.audio.inputs.disconnectAlternative',
              state: 'blocked' as const,
            }
          : audioInputAvailability({
              connectionCounts,
              itemCounts,
              maxConnections: slot.maxConnections,
              maxItems: slot.maxItems,
              slotId: slot.id,
            }),
      ]
    }),
  )

  if (!operation) {
    return {
      inputAvailability,
      issues: [{
        code: 'audio_operation_unresolved',
        messageKey: 'flows.audio.readiness.unsupportedCombination',
      }],
      normalizedSettings: {},
      readiness: 'invalid',
      resolvedOperationId: null,
      visibleSettingIds: [],
    }
  }

  const activeSettingIds = new Set(operation.settingIds)
  const normalizedSettings: Record<string, GenerationSettingValue> = {}
  const invalidSettings: AudioNodeStateIssue[] = []
  for (const setting of input.model.settings) {
    if (!activeSettingIds.has(setting.id))
      continue
    const saved = input.settings[setting.id]
    if (saved !== undefined && isGenerationSettingValueValid(setting, saved)) {
      normalizedSettings[setting.id] = saved
    }
    else {
      normalizedSettings[setting.id] = setting.default
      if (saved !== undefined) {
        invalidSettings.push({
          code: 'generation_setting_invalid',
          settingId: setting.id,
        })
      }
    }
  }

  const connectedSlotIds = new Set(
    slots
      .filter(slot => Math.max(
        effectiveConnections[slot.id] ?? 0,
        effectiveItems[slot.id] ?? 0,
      ) > 0)
      .map(slot => slot.id),
  )
  const constrainedSettings = applyGenerationSettingRequirements({
    connectedSlotIds,
    model: input.model,
    operationId: operation.id,
    settings: normalizedSettings,
  })
  const evaluation = evaluateGenerationContract({
    connectionCounts: effectiveConnections,
    itemCounts: effectiveItems,
    model: input.model,
    operationId: operation.id,
    requireComplete: true,
    settings: constrainedSettings,
  })
  const issues = [...evaluation.issues, ...invalidSettings]
  const readiness = issues.length === 0
    ? 'ready'
    : issues.every(issue => isIncompleteAudioIssue({
      issue,
      itemCounts: effectiveItems,
      operation,
    }))
      ? 'incomplete'
      : 'invalid'

  return {
    inputAvailability,
    issues,
    normalizedSettings: constrainedSettings,
    readiness,
    resolvedOperationId: operation.id,
    visibleSettingIds: evaluation.visibleSettingIds,
  }
}

/** Pure model-switch reconciliation shared by canvas code and validation checks. */
export function reconcileAudioNodeModel(
  nodeType: AudioIntentNodeType,
  input: ResolveAudioNodeStateInput,
): ReconciledAudioNodeModel {
  const slots = getGenerationInputSlotsForNodeType(input.model, nodeType)
  const slotIds = new Set(slots.map(slot => slot.id))
  const configuredSettings: Record<string, GenerationSettingValue> = {}
  const resetSettingIds: string[] = []
  for (const setting of input.model.settings) {
    const saved = input.settings[setting.id]
    if (saved !== undefined && isGenerationSettingValueValid(setting, saved)) {
      configuredSettings[setting.id] = saved
    }
    else {
      configuredSettings[setting.id] = setting.default
      if (saved !== undefined)
        resetSettingIds.push(setting.id)
    }
  }

  const resolution = resolveAudioNodeState(nodeType, {
    ...input,
    settings: configuredSettings,
  })
  return {
    incompatibleConnectedSlotIds: Object.entries(input.connectionCounts ?? {})
      .filter(([slotId, count]) => count > 0 && !slotIds.has(slotId))
      .map(([slotId]) => slotId)
      .toSorted(),
    inputSlotIds: slots.map(slot => slot.id),
    resetSettingIds: resetSettingIds.toSorted(),
    resolution,
    settings: {
      ...configuredSettings,
      ...resolution.normalizedSettings,
    },
  }
}

/** Checks whether adding one edge preserves the selected audio operation contract. */
export function isAudioNodeConnectionAdmissible(
  nodeType: AudioIntentNodeType,
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  const operation = getGenerationOperationsForNodeType(input.model, nodeType)[0]
  const slot = getGenerationInputSlotsForNodeType(input.model, nodeType)
    .find(item => item.id === input.slotId)
  if (!operation || !slot)
    return false
  const connectionCounts = input.connectionCounts ?? {}
  if ((connectionCounts[slot.id] ?? 0) >= slot.maxConnections)
    return false
  const proposedConnectionCount = (connectionCounts[slot.id] ?? 0) + 1
  const proposedItemCounts = {
    ...(input.itemCounts ?? connectionCounts),
    [slot.id]: Math.max(
      input.itemCounts?.[slot.id] ?? 0,
      proposedConnectionCount,
    ),
  }
  return evaluateGenerationContract({
    connectionCounts: {
      ...connectionCounts,
      [slot.id]: proposedConnectionCount,
    },
    itemCounts: proposedItemCounts,
    model: input.model,
    operationId: operation.id,
    settings: input.settings,
  }).issues.length === 0
}
