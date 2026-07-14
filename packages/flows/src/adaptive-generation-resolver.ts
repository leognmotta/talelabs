import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from './generation-registry-types.js'
import type { FlowNodeType } from './types.js'
import {
  isImageGenerationConnectionAdmissible,
  resolveImageGenerationState,
} from './image-generation-resolver.js'
import {
  isLlmConnectionAdmissible,
  resolveLlmState,
} from './llm-resolver.js'
import {
  isMusicGenerationConnectionAdmissible,
  resolveMusicGenerationState,
} from './music-generation-resolver.js'
import {
  isSoundEffectGenerationConnectionAdmissible,
  resolveSoundEffectGenerationState,
} from './sound-effect-generation-resolver.js'
import {
  isSpeechGenerationConnectionAdmissible,
  resolveSpeechGenerationState,
} from './speech-generation-resolver.js'
import {
  isVideoGenerationConnectionAdmissible,
  resolveVideoGenerationState,
} from './video-generation-resolver.js'
import {
  isVoiceChangerConnectionAdmissible,
  resolveVoiceChangerState,
} from './voice-changer-resolver.js'
import {
  isVoiceIsolationConnectionAdmissible,
  resolveVoiceIsolationState,
} from './voice-isolation-resolver.js'

export interface ResolveAdaptiveGenerationStateInput {
  connectionCounts?: Readonly<Record<string, number>>
  inlineInstructions?: string
  inlineLyrics?: string
  inlinePrompt?: string
  itemCounts?: Readonly<Record<string, number>>
  model: GenerationModelDefinition
  nodeType: FlowNodeType
  settings: Readonly<Record<string, GenerationSettingValue>>
}

export function getAdaptiveGenerationInlineValues(
  data: Readonly<Record<string, unknown>>,
) {
  return {
    inlineInstructions: String(data.instructions ?? ''),
    inlineLyrics: String(data.lyrics ?? ''),
    inlinePrompt: String(data.prompt ?? ''),
  }
}

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
