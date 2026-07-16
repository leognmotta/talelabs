import type { ResolveAudioNodeStateInput } from './audio.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio.js'

export function resolveSoundEffectGenerationState(
  input: ResolveAudioNodeStateInput,
) {
  return resolveAudioNodeState('soundEffectGeneration', input)
}

export function isSoundEffectGenerationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('soundEffectGeneration', input)
}
