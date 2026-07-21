/**
 * Deterministic current audio-catalog capability scenarios.
 *
 */

import {
  GENERATION_MODEL_REGISTRY,
  getGenerationModelsForNodeType,
} from '../registry/index.js'
import { resolveSpeechGenerationState } from '../resolution/speech.js'

/** Validates the current speech resolver and audio picker membership. */
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

  const speechModelIds = getGenerationModelsForNodeType('speechGeneration')
    .map(model => model.id)
  if (
    JSON.stringify(speechModelIds)
    !== JSON.stringify([
      'google/gemini-3.1-flash-tts-preview',
      'elevenlabs/eleven-v3',
      'elevenlabs/multilingual-v2',
      'elevenlabs/turbo-v2.5',
    ])
  ) {
    errors.push('current speech picker must be driven by the catalog')
  }
  return errors
}
