import type { ResolveAudioNodeStateInput } from './audio.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio.js'

export function resolveSpeechGenerationState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('speechGeneration', input)
}

export function isSpeechGenerationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('speechGeneration', input)
}
