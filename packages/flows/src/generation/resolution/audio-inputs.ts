import type { GenerationInputAvailability } from '../registry/types.js'

export function withInlineAudioText(
  counts: Readonly<Record<string, number>>,
  input: { inlineLyrics?: string, inlinePrompt?: string },
) {
  const effective = { ...counts }
  if ((input.inlinePrompt ?? '').trim())
    effective.prompt = Math.max(1, effective.prompt ?? 0)
  if ((input.inlineLyrics ?? '').trim())
    effective.lyrics = Math.max(1, effective.lyrics ?? 0)
  return effective
}

export function audioInputAvailability(input: {
  connectionCounts: Readonly<Record<string, number>>
  itemCounts: Readonly<Record<string, number>>
  maxConnections: number
  maxItems: number
  slotId: string
}): GenerationInputAvailability {
  const connectionCount = Math.max(0, input.connectionCounts[input.slotId] ?? 0)
  const itemCount = Math.max(0, input.itemCounts[input.slotId] ?? 0)
  if (connectionCount >= input.maxConnections || itemCount >= input.maxItems) {
    return {
      reasonKey: 'flows.audio.inputs.limitReached',
      state: 'full',
    }
  }
  if (connectionCount > 0 || itemCount > 0)
    return { connectionCount, itemCount, state: 'connected' }
  return { state: 'available' }
}
