/** Exact fake-HTTP request scenarios for the current ElevenLabs Fal routes. */

import assert from 'node:assert/strict'

import { createFalProviderAdapter } from '@talelabs/providers/core'
import {
  mediaInput,
  providerRequest,
  resolvedAsset,
} from '../openrouter-provider-verifier/requests.js'
import { defaultSettings } from '../openrouter-provider-verifier/settings.js'
import { fakeFalProvider } from './fake-provider.js'
import { currentFalRoutes } from './routes.js'

async function captureFalSubmission(input: {
  mediaType?: 'audio' | 'video'
  route: ReturnType<typeof currentFalRoutes>[number]
  settings?: Record<string, boolean | number | string>
}) {
  const provider = fakeFalProvider({ mediaType: 'audio' })
  const orderedInputs = input.route.binding.requestProfile.inputMappings.map(
    mapping => mediaInput(
      mapping.targetSlotId,
      input.mediaType ?? mapping.mediaType,
    ),
  )
  await createFalProviderAdapter({
    binding: input.route.binding,
    client: provider.client,
    resolveAsset: resolvedAsset,
  }).submit(providerRequest({
    orderedInputs,
    route: input.route,
    settings: {
      ...defaultSettings(input.route),
      ...input.settings,
    },
  }))
  const body = provider.calls.find(call => call.method === 'POST')?.body
  assert.ok(body)
  return body
}

/** Verifies every current ElevenLabs Fal endpoint and its nontrivial request rules. */
export async function verifyElevenLabsRequestProfiles() {
  const routes = currentFalRoutes().filter(
    route => route.model.id.startsWith('elevenlabs/'),
  )
  assert.equal(routes.length, 7)
  assert.deepEqual(
    routes.map(route => route.binding.nativeModelId).toSorted(),
    [
      'fal-ai/elevenlabs/audio-isolation',
      'fal-ai/elevenlabs/music',
      'fal-ai/elevenlabs/sound-effects/v2',
      'fal-ai/elevenlabs/tts/eleven-v3',
      'fal-ai/elevenlabs/tts/multilingual-v2',
      'fal-ai/elevenlabs/tts/turbo-v2.5',
      'fal-ai/elevenlabs/voice-changer',
    ],
  )

  const route = (modelId: string) => {
    const match = routes.find(candidate => candidate.model.id === modelId)
    assert.ok(match)
    return match
  }

  const v3 = await captureFalSubmission({
    route: route('elevenlabs/eleven-v3'),
  })
  assert.equal(v3.text, 'A safe verification prompt.')
  assert.equal(v3.voice, 'Rachel')
  assert.equal(v3.stability, 0.5)
  assert.equal('speed' in v3, false)
  assert.equal('output_format' in v3, false)

  const musicRoute = route('elevenlabs/music')
  const automaticMusic = await captureFalSubmission({ route: musicRoute })
  assert.equal('music_length_ms' in automaticMusic, false)
  const customMusic = await captureFalSubmission({
    route: musicRoute,
    settings: { duration: 42, durationMode: 'custom' },
  })
  assert.equal(customMusic.music_length_ms, 42_000)
  assert.equal(customMusic.output_format, 'mp3_44100_128')

  const effectsRoute = route('elevenlabs/sound-effects-v2')
  const automaticEffect = await captureFalSubmission({ route: effectsRoute })
  assert.equal('duration_seconds' in automaticEffect, false)
  const customEffect = await captureFalSubmission({
    route: effectsRoute,
    settings: { duration: 6.5, durationMode: 'custom' },
  })
  assert.equal(customEffect.duration_seconds, 6.5)
  assert.equal(customEffect.prompt_influence, 0.3)

  const voiceChange = await captureFalSubmission({
    route: route('elevenlabs/voice-changer'),
  })
  assert.equal(
    voiceChange.audio_url,
    'https://signed.invalid/asset-audio-sourceMedia',
  )
  assert.equal('text' in voiceChange, false)
  assert.equal('video_url' in voiceChange, false)

  const isolationRoute = route('elevenlabs/audio-isolation')
  const audioIsolation = await captureFalSubmission({ route: isolationRoute })
  assert.equal(
    audioIsolation.audio_url,
    'https://signed.invalid/asset-audio-sourceMedia',
  )
  assert.equal('video_url' in audioIsolation, false)
  const videoIsolation = await captureFalSubmission({
    mediaType: 'video',
    route: isolationRoute,
  })
  assert.equal(
    videoIsolation.video_url,
    'https://signed.invalid/asset-video-sourceMedia',
  )
  assert.equal('audio_url' in videoIsolation, false)
}
