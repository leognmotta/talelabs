import type { ResolveAudioNodeStateInput } from './audio-node-resolver.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio-node-resolver.js'

export function resolveSpeechGenerationState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('speechGeneration', input)
}

export function isSpeechGenerationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('speechGeneration', input)
}
