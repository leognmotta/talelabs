import type { ResolveAudioNodeStateInput } from './audio-node-resolver.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio-node-resolver.js'

export function resolveVoiceChangerState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('voiceChanger', input)
}

export function isVoiceChangerConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('voiceChanger', input)
}
