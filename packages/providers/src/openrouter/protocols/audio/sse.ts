/**
 * Bounded OpenRouter SSE decoding for chat-completions audio output.
 */

import { throwProviderResponseInvalid } from '../../errors.js'

/** Maximum decoded audio size shared by managed and browser execution. */
export const OPENROUTER_MAX_AUDIO_BYTES = 64 * 1024 * 1024

/** Maximum encoded SSE envelope size for one bounded audio output. */
export const OPENROUTER_MAX_AUDIO_SSE_BYTES
  = OPENROUTER_MAX_AUDIO_BYTES * 2
const BASE64_PATTERN = /^(?:[a-z\d+/]{4})*(?:[a-z\d+/]{2}==|[a-z\d+/]{3}=)?$/i

interface OpenRouterAudioSseResult {
  /** Fully decoded provider audio. */
  bytes: Uint8Array
  /** Safe provider generation ID observed in the stream. */
  generationId?: string
  /** Untrusted provider cost normalized by the provider-facts boundary. */
  providerCostUsd?: unknown
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : undefined
}

function decodeBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string')
    throwProviderResponseInvalid()
  const normalized = value.trim()
  if (!normalized || !BASE64_PATTERN.test(normalized))
    throwProviderResponseInvalid()
  try {
    const binary = atob(normalized)
    return Uint8Array.from(binary, character => character.charCodeAt(0))
  }
  catch {
    throwProviderResponseInvalid()
  }
}

/** Decodes one complete, bounded OpenRouter audio SSE response. */
export async function decodeOpenRouterAudioSse(
  stream: ReadableStream<Uint8Array>,
): Promise<OpenRouterAudioSseResult> {
  const audioChunks: Uint8Array[] = []
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  const dataLines: string[] = []
  let audioBytes = 0
  let buffer = ''
  let completed = false
  let generationId: string | undefined
  let providerCostUsd: unknown
  let streamBytes = 0

  function consumeEvent() {
    if (dataLines.length === 0)
      return
    const data = dataLines.splice(0).join('\n').trim()
    if (data === '[DONE]') {
      completed = true
      return
    }
    if (completed)
      throwProviderResponseInvalid()
    let payload: Record<string, unknown>
    try {
      payload = record(JSON.parse(data)) ?? throwProviderResponseInvalid()
    }
    catch {
      throwProviderResponseInvalid()
    }
    if (payload.error)
      throwProviderResponseInvalid()
    if (typeof payload.id === 'string')
      generationId = payload.id
    const usage = record(payload.usage)
    if (usage && 'cost' in usage)
      providerCostUsd = usage.cost
    if (!Array.isArray(payload.choices))
      return
    for (const choiceValue of payload.choices) {
      const choice = record(choiceValue)
      if (!choice || choice.error || choice.finish_reason === 'error')
        throwProviderResponseInvalid()
      const audio = record(record(choice.delta)?.audio)
      if (!audio || audio.data === undefined)
        continue
      const chunk = decodeBase64(audio.data)
      audioBytes += chunk.byteLength
      if (audioBytes > OPENROUTER_MAX_AUDIO_BYTES)
        throwProviderResponseInvalid()
      audioChunks.push(chunk)
    }
  }

  function consumeLine(line: string) {
    const normalized = line.endsWith('\r') ? line.slice(0, -1) : line
    if (!normalized) {
      consumeEvent()
      return
    }
    if (normalized.startsWith(':'))
      return
    if (!normalized.startsWith('data:'))
      return
    const value = normalized.slice(5)
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
  }

  let reachedEnd = false
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        reachedEnd = true
        break
      }
      streamBytes += next.value.byteLength
      if (streamBytes > OPENROUTER_MAX_AUDIO_SSE_BYTES)
        throwProviderResponseInvalid()
      buffer += decoder.decode(next.value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        consumeLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
      }
    }
    buffer += decoder.decode()
    if (buffer)
      consumeLine(buffer)
    consumeEvent()
  }
  finally {
    if (!reachedEnd)
      await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  if (!completed || audioChunks.length === 0)
    throwProviderResponseInvalid()
  const bytes = new Uint8Array(audioBytes)
  let offset = 0
  for (const chunk of audioChunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return {
    bytes,
    ...(generationId ? { generationId } : {}),
    ...(providerCostUsd === undefined ? {} : { providerCostUsd }),
  }
}
