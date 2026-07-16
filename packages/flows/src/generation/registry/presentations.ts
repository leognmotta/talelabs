import type { CURRENT_GENERATION_MODEL_REGISTRY } from './current/index.js'
import type { GenerationModelPresentationDefinition } from './types.js'

/**
 * Public, code-versioned model presentation. This stays separate from immutable
 * execution contracts so copy and brand assets never rewrite saved provenance.
 */
export const GENERATION_MODEL_PRESENTATIONS = {
  'talelabs/claude-opus-4.8': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'claude',
  },
  'talelabs/claude-sonnet-4.6': {
    descriptionKey: 'flows.modelDescriptions.claudeSonnet46',
    logoId: 'claude',
  },
  'talelabs/claude-sonnet-5': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'claude',
  },
  'talelabs/deepseek-v3.2': {
    descriptionKey: 'flows.modelDescriptions.deepseekV32',
    logoId: 'deepseek',
  },
  'talelabs/deepseek-v4-pro': {
    descriptionKey: 'flows.modelDescriptions.majorTextLlm',
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
  'talelabs/flux-2-max': {
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
  'talelabs/gemini-3.1-flash-tts-preview': {
    descriptionKey: 'flows.modelDescriptions.gemini31FlashTtsPreview',
    logoId: 'gemini',
  },
  'talelabs/gemini-3.1-pro': {
    descriptionKey: 'flows.modelDescriptions.gemini31Pro',
    logoId: 'gemini',
  },
  'talelabs/gemini-3.5-flash': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'gemini',
  },
  'talelabs/glm-5.2': {
    descriptionKey: 'flows.modelDescriptions.majorTextLlm',
    logoId: 'zai',
  },
  'talelabs/gpt-5.4': {
    descriptionKey: 'flows.modelDescriptions.gpt54',
    logoId: 'openai',
  },
  'talelabs/gpt-5.4-image-2': {
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    logoId: 'openai',
  },
  'talelabs/gpt-5.5': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'openai',
  },
  'talelabs/gpt-5.6-sol': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'openai',
  },
  'talelabs/grok-4.5': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'xai',
  },
  'talelabs/grok-imagine-image-quality': {
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    logoId: 'xai',
  },
  'talelabs/gpt-4o-mini-tts': {
    descriptionKey: 'flows.modelDescriptions.gpt4oMiniTts',
    logoId: 'openai',
  },
  'talelabs/grok-imagine-video': {
    descriptionKey: 'flows.modelDescriptions.grokImagineVideo',
    logoId: 'xai',
  },
  'talelabs/hailuo-2.3': {
    descriptionKey: 'flows.modelDescriptions.frameVideo',
    logoId: 'minimax',
  },
  'talelabs/happyhorse-1.1': {
    descriptionKey: 'flows.modelDescriptions.frameVideo',
    logoId: 'alibaba',
  },
  'talelabs/kimi-k2.5': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'moonshot',
  },
  'talelabs/kling-3.0-pro': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    logoId: 'kling',
  },
  'talelabs/kling-3.0-standard': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    logoId: 'kling',
  },
  'talelabs/kling-video-o1': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    logoId: 'kling',
  },
  'talelabs/ltx-2.3-pro': {
    descriptionKey: 'flows.modelDescriptions.ltx23Pro',
    logoId: 'lightricks',
  },
  'talelabs/mistral-large-3': {
    descriptionKey: 'flows.modelDescriptions.mistralLarge3',
    logoId: 'mistral',
  },
  'talelabs/mai-image-2.5': {
    descriptionKey: 'flows.modelDescriptions.gptImage2',
    logoId: 'microsoft',
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
  'talelabs/qwen3.7-plus': {
    descriptionKey: 'flows.modelDescriptions.majorVisionLlm',
    logoId: 'qwen',
  },
  'talelabs/recraft-4.1-pro': {
    descriptionKey: 'flows.modelDescriptions.recraft41',
    logoId: 'recraft',
  },
  'talelabs/seedance-2.0': {
    descriptionKey: 'flows.modelDescriptions.seedance20',
    logoId: 'bytedance',
  },
  'talelabs/seedance-2.0-fast': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
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
  'talelabs/sora-2-pro': {
    descriptionKey: 'flows.modelDescriptions.textAudioVideo',
    logoId: 'openai',
  },
  'talelabs/veo-3.1': {
    descriptionKey: 'flows.modelDescriptions.veo31',
    logoId: 'google',
  },
  'talelabs/veo-3.1-lite': {
    descriptionKey: 'flows.modelDescriptions.veo31Lite',
    logoId: 'google',
  },
  'talelabs/veo-3.1-fast': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    logoId: 'google',
  },
  'talelabs/wan-2.6': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    logoId: 'alibaba',
  },
  'talelabs/wan-2.7': {
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    logoId: 'alibaba',
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
