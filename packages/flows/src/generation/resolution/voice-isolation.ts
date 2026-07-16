import type { ResolveAudioNodeStateInput } from './audio.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio.js'

export function resolveVoiceIsolationState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('voiceIsolation', input)
}

export function isVoiceIsolationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('voiceIsolation', input)
}
