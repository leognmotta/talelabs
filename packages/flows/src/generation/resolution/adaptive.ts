/** Shared dispatch across model-adaptive generation-node resolution contracts. */

import type { FlowNodeType } from '../../graph/types.js'
import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from '../registry/types.js'
import { promptTemplateResolvedText } from '../../prompts/resolve.js'
import { coercePromptTemplate } from '../../prompts/schema.js'
import {
  isImageGenerationConnectionAdmissible,
  resolveImageGenerationState,
} from './image.js'
import {
  isLlmConnectionAdmissible,
  resolveLlmState,
} from './llm.js'
import {
  isMusicGenerationConnectionAdmissible,
  resolveMusicGenerationState,
} from './music.js'
import {
  isSoundEffectGenerationConnectionAdmissible,
  resolveSoundEffectGenerationState,
} from './sound-effect.js'
import {
  isSpeechGenerationConnectionAdmissible,
  resolveSpeechGenerationState,
} from './speech.js'
import {
  isVideoGenerationConnectionAdmissible,
  resolveVideoGenerationState,
} from './video.js'
import {
  isVoiceChangerConnectionAdmissible,
  resolveVoiceChangerState,
} from './voice-changer.js'
import {
  isVoiceIsolationConnectionAdmissible,
  resolveVoiceIsolationState,
} from './voice-isolation.js'

/** Shared inputs accepted by every model-adaptive node resolver. */
export interface ResolveAdaptiveGenerationStateInput {
  /** Incoming connection counts keyed by semantic slot. */
  connectionCounts?: Readonly<Record<string, number>>
  /** Inline instruction text used only while its slot is disconnected. */
  inlineInstructions?: string
  /** Inline lyrics used only while their slot is disconnected. */
  inlineLyrics?: string
  /** Provider-facing resolved prompt used only while its slot is disconnected. */
  inlinePrompt?: string
  /** Executable input item counts keyed by semantic slot. */
  itemCounts?: Readonly<Record<string, number>>
  /** Pinned creative model contract resolved for the node. */
  model: GenerationModelDefinition
  /** Persisted generation node family selecting the concrete resolver. */
  nodeType: FlowNodeType
  /** Current model setting values subject to operation normalization. */
  settings: Readonly<Record<string, GenerationSettingValue>>
}

/** Projects persisted inline node values into provider-facing resolver strings. */
export function getAdaptiveGenerationInlineValues(
  data: Readonly<Record<string, unknown>>,
) {
  return {
    inlineInstructions: String(data.instructions ?? ''),
    inlineLyrics: String(data.lyrics ?? ''),
    inlinePrompt: data.prompt === undefined
      ? ''
      : promptTemplateResolvedText(coercePromptTemplate(data.prompt)),
  }
}

/** Dispatches state resolution to the concrete model-adaptive node family. */
export function resolveAdaptiveGenerationState(
  input: ResolveAdaptiveGenerationStateInput,
) {
  if (input.nodeType === 'imageGeneration')
    return resolveImageGenerationState(input)
  if (input.nodeType === 'llm')
    return resolveLlmState(input)
  if (input.nodeType === 'musicGeneration')
    return resolveMusicGenerationState(input)
  if (input.nodeType === 'soundEffectGeneration')
    return resolveSoundEffectGenerationState(input)
  if (input.nodeType === 'speechGeneration')
    return resolveSpeechGenerationState(input)
  if (input.nodeType === 'videoGeneration')
    return resolveVideoGenerationState(input)
  if (input.nodeType === 'voiceChanger')
    return resolveVoiceChangerState(input)
  if (input.nodeType === 'voiceIsolation')
    return resolveVoiceIsolationState(input)
  return null
}

/** Checks one proposed connection against its concrete adaptive-node contract. */
export function isAdaptiveGenerationConnectionAdmissible(
  input: ResolveAdaptiveGenerationStateInput & { slotId: string },
) {
  const normalized = { ...input, connectionCounts: input.connectionCounts ?? {} }
  if (input.nodeType === 'imageGeneration')
    return isImageGenerationConnectionAdmissible(normalized)
  if (input.nodeType === 'llm')
    return isLlmConnectionAdmissible(normalized)
  if (input.nodeType === 'musicGeneration')
    return isMusicGenerationConnectionAdmissible(normalized)
  if (input.nodeType === 'soundEffectGeneration')
    return isSoundEffectGenerationConnectionAdmissible(normalized)
  if (input.nodeType === 'speechGeneration')
    return isSpeechGenerationConnectionAdmissible(normalized)
  if (input.nodeType === 'videoGeneration')
    return isVideoGenerationConnectionAdmissible(normalized)
  if (input.nodeType === 'voiceChanger')
    return isVoiceChangerConnectionAdmissible(normalized)
  if (input.nodeType === 'voiceIsolation')
    return isVoiceIsolationConnectionAdmissible(normalized)
  return false
}
