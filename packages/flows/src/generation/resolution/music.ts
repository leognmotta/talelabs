import type { ResolveAudioNodeStateInput } from './audio.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio.js'

export function resolveMusicGenerationState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('musicGeneration', input)
}

export function isMusicGenerationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('musicGeneration', input)
}
