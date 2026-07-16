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

export type AudioIntentNodeType = Extract<
  GenerationNodeType,
  | 'musicGeneration'
  | 'soundEffectGeneration'
  | 'speechGeneration'
  | 'voiceChanger'
  | 'voiceIsolation'
>

export interface AudioNodeStateIssue extends Omit<GenerationContractIssue, 'code'> {
  code: GenerationContractIssue['code'] | 'audio_operation_unresolved'
}

export interface AudioNodeState {
  inputAvailability: Readonly<Record<string, GenerationInputAvailability>>
  issues: readonly AudioNodeStateIssue[]
  normalizedSettings: Readonly<Record<string, GenerationSettingValue>>
  readiness: 'incomplete' | 'invalid' | 'ready'
  resolvedOperationId: null | string
  visibleSettingIds: readonly string[]
}

export interface ResolveAudioNodeStateInput {
  connectionCounts?: Readonly<Record<string, number>>
  inlineLyrics?: string
  inlinePrompt?: string
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  settings: Readonly<Record<string, GenerationSettingValue>>
}

export interface ReconciledAudioNodeModel {
  incompatibleConnectedSlotIds: readonly string[]
  inputSlotIds: readonly string[]
  resetSettingIds: readonly string[]
  resolution: AudioNodeState
  settings: Readonly<Record<string, GenerationSettingValue>>
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
    slots.map(slot => [
      slot.id,
      audioInputAvailability({
        connectionCounts,
        itemCounts,
        maxConnections: slot.maxConnections,
        maxItems: slot.maxItems,
        slotId: slot.id,
      }),
    ]),
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
    : issues.every(issue => issue.code === 'generation_input_required'
      || issue.code === 'generation_setting_required')
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
  return evaluateGenerationContract({
    connectionCounts: {
      ...connectionCounts,
      [slot.id]: (connectionCounts[slot.id] ?? 0) + 1,
    },
    itemCounts: input.itemCounts,
    model: input.model,
    operationId: operation.id,
    settings: input.settings,
  }).issues.length === 0
}
