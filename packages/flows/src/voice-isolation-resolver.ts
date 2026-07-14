import type { ResolveAudioNodeStateInput } from './audio-node-resolver.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio-node-resolver.js'

export function resolveVoiceIsolationState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('voiceIsolation', input)
}

export function isVoiceIsolationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('voiceIsolation', input)
}
