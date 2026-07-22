/**
 * Deterministic current audio-catalog capability scenarios.
 *
 */

import {
  GENERATION_MODEL_REGISTRY,
  getGenerationModelsForNodeType,
} from '../registry/index.js'
import { resolveSpeechGenerationState } from '../resolution/speech.js'
import {
  isVoiceIsolationConnectionAdmissible,
  resolveVoiceIsolationState,
} from '../resolution/voice-isolation.js'

const EXPECTED_AUDIO_PICKER_MODELS = [
  {
    modelIds: [
      'google/lyria-3-clip-preview',
      'google/lyria-3-pro-preview',
      'elevenlabs/music',
    ],
    nodeType: 'musicGeneration',
  },
  {
    modelIds: ['elevenlabs/sound-effects-v2'],
    nodeType: 'soundEffectGeneration',
  },
  {
    modelIds: [
      'google/gemini-3.1-flash-tts-preview',
      'elevenlabs/eleven-v3',
      'elevenlabs/multilingual-v2',
      'elevenlabs/turbo-v2.5',
    ],
    nodeType: 'speechGeneration',
  },
  {
    modelIds: ['elevenlabs/voice-changer'],
    nodeType: 'voiceChanger',
  },
  {
    modelIds: ['elevenlabs/audio-isolation'],
    nodeType: 'voiceIsolation',
  },
] as const

/** Validates the current speech resolver and all five audio picker surfaces. */
export function validateGenerationAudioCapabilityScenarios() {
  const errors: string[] = []
  const speech = GENERATION_MODEL_REGISTRY[
    'google/gemini-3.1-flash-tts-preview'
  ]
  const settings = Object.fromEntries(
    speech.settings.map(setting => [setting.id, setting.default]),
  )
  const resolved = resolveSpeechGenerationState({
    inlinePrompt: 'Welcome to TaleLabs',
    model: speech,
    settings,
  })
  if (
    resolved.resolvedOperationId !== 'textToSpeech'
    || resolved.readiness !== 'ready'
  ) {
    errors.push('current speech model must resolve a ready inline script')
  }

  const isolation = GENERATION_MODEL_REGISTRY['elevenlabs/audio-isolation']
  const audioIsolation = resolveVoiceIsolationState({
    connectionCounts: { sourceAudio: 1 },
    itemCounts: { sourceAudio: 1 },
    model: isolation,
    settings: {},
  })
  const videoIsolation = resolveVoiceIsolationState({
    connectionCounts: { sourceVideo: 1 },
    itemCounts: { sourceVideo: 1 },
    model: isolation,
    settings: {},
  })
  if (
    audioIsolation.readiness !== 'ready'
    || audioIsolation.inputAvailability.sourceVideo?.state !== 'blocked'
    || videoIsolation.readiness !== 'ready'
    || videoIsolation.inputAvailability.sourceAudio?.state !== 'blocked'
  ) {
    errors.push('voice isolation must block the unused typed source input')
  }
  if (
    !isVoiceIsolationConnectionAdmissible({
      connectionCounts: {},
      itemCounts: {},
      model: isolation,
      settings: {},
      slotId: 'sourceAudio',
    })
    || isVoiceIsolationConnectionAdmissible({
      connectionCounts: { sourceAudio: 1 },
      itemCounts: { sourceAudio: 1 },
      model: isolation,
      settings: {},
      slotId: 'sourceVideo',
    })
  ) {
    errors.push('voice isolation must admit exactly one typed source connection')
  }

  for (const expected of EXPECTED_AUDIO_PICKER_MODELS) {
    const modelIds = getGenerationModelsForNodeType(expected.nodeType)
      .map(model => model.id)
    if (JSON.stringify(modelIds) !== JSON.stringify(expected.modelIds)) {
      errors.push(
        `current ${expected.nodeType} picker must match the reviewed catalog`,
      )
    }
  }
  return errors
}
