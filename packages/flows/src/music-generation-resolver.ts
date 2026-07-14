import type { ResolveAudioNodeStateInput } from './audio-node-resolver.js'
import {
  isAudioNodeConnectionAdmissible,
  resolveAudioNodeState,
} from './audio-node-resolver.js'

export function resolveMusicGenerationState(input: ResolveAudioNodeStateInput) {
  return resolveAudioNodeState('musicGeneration', input)
}

export function isMusicGenerationConnectionAdmissible(
  input: ResolveAudioNodeStateInput & { slotId: string },
) {
  return isAudioNodeConnectionAdmissible('musicGeneration', input)
}
