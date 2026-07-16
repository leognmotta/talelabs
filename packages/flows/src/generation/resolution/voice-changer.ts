import type { ResolveAudioNodeStateInput } from './audio.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio.js'

export function resolveVoiceChangerState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('voiceChanger', input)
}

export function isVoiceChangerConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('voiceChanger', input)
}
