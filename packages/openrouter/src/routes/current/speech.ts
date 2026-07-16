import type { GenerationModelContractVersion } from '@talelabs/flows'

import { providerRoute } from '../builders/media.js'
import {
  IMMEDIATE_BYTES_LIFECYCLE,
  OPENROUTER_PROVIDER,
  OPENROUTER_SPEECH_ADAPTER_VERSION,
  OPENROUTER_SPEECH_GUIDE_URL,
} from '../contracts.js'

export function currentSpeechRoutes(input: {
  modelContractVersion: GenerationModelContractVersion
  routeVersion: string
}) {
  return [providerRoute({
    adapterVersion: OPENROUTER_SPEECH_ADAPTER_VERSION,
    lifecycle: IMMEDIATE_BYTES_LIFECYCLE,
    modelContractVersion: input.modelContractVersion,
    operationId: 'textToSpeech',
    outputType: 'audio',
    productModelId: 'talelabs/gemini-3.1-flash-tts-preview',
    providerRoute: {
      endpoint: '/api/v1/audio/speech',
      nativeModelId: 'google/gemini-3.1-flash-tts-preview',
      policy: 'pinned',
      provider: OPENROUTER_PROVIDER,
      providerTag: 'google-vertex',
      supportedParameters: [
        'input',
        'model',
        'response_format',
        'voice',
      ],
    },
    requestProfile: {
      kind: 'speech',
      outputFormats: ['mp3'],
      settingIds: ['voice', 'outputFormat'],
      voiceValues: { 'gemini-alloy': 'alloy' },
    },
    routeVersion: input.routeVersion,
    sources: [
      OPENROUTER_SPEECH_GUIDE_URL,
      'https://openrouter.ai/google/gemini-3.1-flash-tts-preview',
    ],
  })]
}
