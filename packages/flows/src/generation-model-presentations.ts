import type { CURRENT_GENERATION_MODEL_REGISTRY } from './generation-registry-current.js'
import type { GenerationModelPresentationDefinition } from './generation-registry-types.js'

/**
 * Public, code-versioned model presentation. This stays separate from immutable
 * execution contracts so copy and brand assets never rewrite saved provenance.
 */
export const GENERATION_MODEL_PRESENTATIONS = {
  'talelabs/claude-sonnet-4.6': {
    descriptionKey: 'flows.modelDescriptions.claudeSonnet46',
    logoId: 'claude',
  },
  'talelabs/deepseek-v3.2': {
    descriptionKey: 'flows.modelDescriptions.deepseekV32',
    logoId: 'deepseek',
  },
  'talelabs/eleven-multilingual-v2': {
    descriptionKey: 'flows.modelDescriptions.elevenMultilingualV2',
    logoId: 'elevenlabs',
  },
  'talelabs/eleven-music-v2': {
    descriptionKey: 'flows.modelDescriptions.elevenMusicV2',
    logoId: 'elevenlabs',
  },
  'talelabs/eleven-sound-effects-v2': {
    descriptionKey: 'flows.modelDescriptions.elevenSoundEffectsV2',
    logoId: 'elevenlabs',
  },
  'talelabs/eleven-voice-changer': {
    descriptionKey: 'flows.modelDescriptions.elevenVoiceChanger',
    logoId: 'elevenlabs',
  },
  'talelabs/eleven-voice-isolator': {
    descriptionKey: 'flows.modelDescriptions.elevenVoiceIsolator',
    logoId: 'elevenlabs',
  },
  'talelabs/flux-2-pro': {
    descriptionKey: 'flows.modelDescriptions.flux2Pro',
    logoId: 'flux',
  },
  'talelabs/gpt-image-2': {
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    logoId: 'openai',
  },
  'talelabs/gemini-3.1-flash-lite': {
    descriptionKey: 'flows.modelDescriptions.gemini31FlashLite',
    logoId: 'gemini',
  },
  'talelabs/gemini-3.1-pro': {
    descriptionKey: 'flows.modelDescriptions.gemini31Pro',
    logoId: 'gemini',
  },
  'talelabs/gpt-5.4': {
    descriptionKey: 'flows.modelDescriptions.gpt54',
    logoId: 'openai',
  },
  'talelabs/gpt-4o-mini-tts': {
    descriptionKey: 'flows.modelDescriptions.gpt4oMiniTts',
    logoId: 'openai',
  },
  'talelabs/grok-imagine-video': {
    descriptionKey: 'flows.modelDescriptions.grokImagineVideo',
    logoId: 'xai',
  },
  'talelabs/ltx-2.3-pro': {
    descriptionKey: 'flows.modelDescriptions.ltx23Pro',
    logoId: 'lightricks',
  },
  'talelabs/mistral-large-3': {
    descriptionKey: 'flows.modelDescriptions.mistralLarge3',
    logoId: 'mistral',
  },
  'talelabs/nano-banana-2': {
    descriptionKey: 'flows.modelDescriptions.nanoBanana2',
    logoId: 'nanobanana',
  },
  'talelabs/nano-banana-2-lite': {
    descriptionKey: 'flows.modelDescriptions.nanoBanana2Lite',
    logoId: 'nanobanana',
  },
  'talelabs/nano-banana-pro': {
    descriptionKey: 'flows.modelDescriptions.nanoBananaPro',
    logoId: 'nanobanana',
  },
  'talelabs/recraft-4.1': {
    descriptionKey: 'flows.modelDescriptions.recraft41',
    logoId: 'recraft',
  },
  'talelabs/seedance-2.0': {
    descriptionKey: 'flows.modelDescriptions.seedance20',
    logoId: 'bytedance',
  },
  'talelabs/seedream-4.5': {
    descriptionKey: 'flows.modelDescriptions.seedream45',
    logoId: 'bytedance',
  },
  'talelabs/stable-audio-2.5': {
    descriptionKey: 'flows.modelDescriptions.stableAudio25',
    logoId: 'stability',
  },
  'talelabs/veo-3.1': {
    descriptionKey: 'flows.modelDescriptions.veo31',
    logoId: 'google',
  },
  'talelabs/veo-3.1-lite': {
    descriptionKey: 'flows.modelDescriptions.veo31Lite',
    logoId: 'google',
  },
} as const satisfies Readonly<Record<
  keyof typeof CURRENT_GENERATION_MODEL_REGISTRY,
  GenerationModelPresentationDefinition
>>

export function getGenerationModelPresentation(modelId: string) {
  return GENERATION_MODEL_PRESENTATIONS[
    modelId as keyof typeof GENERATION_MODEL_PRESENTATIONS
  ] as GenerationModelPresentationDefinition | undefined
}
