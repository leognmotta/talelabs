import type { GenerationModelDefinition } from '../registry/types.js'

import {
  GENERATION_MODEL_CONTRACTS,
  getGenerationModelsForNodeType,
} from '../registry/index.js'
import { reconcileAudioNodeModel } from '../resolution/audio.js'
import { resolveMusicGenerationState } from '../resolution/music.js'
import { resolveSoundEffectGenerationState } from '../resolution/sound-effect.js'
import { resolveSpeechGenerationState } from '../resolution/speech.js'
import { resolveVoiceChangerState } from '../resolution/voice-changer.js'
import { resolveVoiceIsolationState } from '../resolution/voice-isolation.js'

function defaultSettings(model: GenerationModelDefinition) {
  return Object.fromEntries(
    model.settings.map(setting => [setting.id, setting.default]),
  )
}

const historicalCurrentRegistry = GENERATION_MODEL_CONTRACTS['2026-07-15.14']
const elevenSpeech = historicalCurrentRegistry['talelabs/eleven-multilingual-v2']
const openAiSpeech = historicalCurrentRegistry['talelabs/gpt-4o-mini-tts']
const elevenMusic = historicalCurrentRegistry['talelabs/eleven-music-v2']
const elevenSoundEffects = historicalCurrentRegistry['talelabs/eleven-sound-effects-v2']
const elevenVoiceChanger = historicalCurrentRegistry['talelabs/eleven-voice-changer']
const elevenVoiceIsolator = historicalCurrentRegistry['talelabs/eleven-voice-isolator']
const stableAudio25 = historicalCurrentRegistry['talelabs/stable-audio-2.5']

export function validateGenerationAudioCapabilityScenarios() {
  const errors: string[] = []
  const audioResolverScenarios = [
    {
      actual: resolveSpeechGenerationState({
        inlinePrompt: 'Welcome to TaleLabs',
        model: elevenSpeech,
        settings: defaultSettings(elevenSpeech),
      }),
      expectedOperationId: 'textToSpeech',
      expectedReadiness: 'ready',
      name: 'speech inline script resolves speech intent',
    },
    {
      actual: resolveMusicGenerationState({
        inlinePrompt: 'Warm cinematic strings with a gentle build',
        model: elevenMusic,
        settings: {
          ...defaultSettings(elevenMusic),
          durationMode: 'custom',
          durationSeconds: 45,
        },
      }),
      expectedOperationId: 'textToMusic',
      expectedReadiness: 'ready',
      expectedVisibleSetting: 'durationSeconds',
      name: 'music custom duration becomes visible',
    },
    {
      actual: resolveSoundEffectGenerationState({
        inlinePrompt: 'A heavy metal door closes in a concrete hall',
        model: elevenSoundEffects,
        settings: defaultSettings(elevenSoundEffects),
      }),
      expectedOperationId: 'textToSoundEffect',
      expectedReadiness: 'ready',
      name: 'sound effect prompt resolves sound-design intent',
    },
    {
      actual: resolveVoiceChangerState({
        model: elevenVoiceChanger,
        settings: defaultSettings(elevenVoiceChanger),
      }),
      expectedOperationId: 'changeVoice',
      expectedReadiness: 'incomplete',
      name: 'voice changer requires source media',
    },
    {
      actual: resolveVoiceChangerState({
        connectionCounts: { sourceMedia: 1 },
        itemCounts: { sourceMedia: 2 },
        model: elevenVoiceChanger,
        settings: defaultSettings(elevenVoiceChanger),
      }),
      expectedOperationId: 'changeVoice',
      expectedReadiness: 'invalid',
      name: 'voice changer rejects more than one source item',
    },
    {
      actual: resolveVoiceIsolationState({
        connectionCounts: { sourceMedia: 1 },
        itemCounts: { sourceMedia: 1 },
        model: elevenVoiceIsolator,
        settings: defaultSettings(elevenVoiceIsolator),
      }),
      expectedOperationId: 'isolateVoice',
      expectedReadiness: 'ready',
      name: 'voice isolation accepts exactly one source item',
    },
    {
      actual: resolveSoundEffectGenerationState({
        inlinePrompt: 'A short glassy transition',
        model: stableAudio25,
        settings: defaultSettings(stableAudio25),
      }),
      expectedOperationId: 'textToSoundEffect',
      expectedReadiness: 'ready',
      name: 'multi-intent Stable Audio resolves only sound-effect operation',
    },
  ] as const
  for (const scenario of audioResolverScenarios) {
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
      || ('expectedVisibleSetting' in scenario
        && !scenario.actual.visibleSettingIds.includes(
          scenario.expectedVisibleSetting,
        ))
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}`,
      )
    }
  }

  const connectedSpeech = resolveSpeechGenerationState({
    connectionCounts: { prompt: 1 },
    inlinePrompt:
        'This preserved draft is not concatenated with connected text',
    model: elevenSpeech,
    settings: defaultSettings(elevenSpeech),
  })
  if (
    connectedSpeech.resolvedOperationId !== 'textToSpeech'
    || connectedSpeech.readiness !== 'ready'
  ) {
    errors.push(
      'Connected Speech text must satisfy Script while the inline draft stays independently persisted',
    )
  }

  const speechWithoutSpeed: GenerationModelDefinition = {
    ...elevenSpeech,
    operations: elevenSpeech.operations.map(operation => ({
      ...operation,
      settingIds: operation.settingIds.filter(id => id !== 'speed'),
    })),
    settings: elevenSpeech.settings.filter(setting => setting.id !== 'speed'),
  }
  const noSpeedSpeech = resolveSpeechGenerationState({
    inlinePrompt: 'A model-specific settings check',
    model: speechWithoutSpeed,
    settings: defaultSettings(speechWithoutSpeed),
  })
  if (noSpeedSpeech.visibleSettingIds.includes('speed')) {
    errors.push('Speech speed must be absent when the reviewed model omits it')
  }

  const speechSwitch = reconcileAudioNodeModel('speechGeneration', {
    inlinePrompt: 'Preserve this script',
    model: openAiSpeech,
    settings: {
      outputFormat: 'wav',
      speed: 1,
      voice: 'eleven-rachel',
    },
  })
  if (
    speechSwitch.settings.outputFormat !== 'mp3'
    || speechSwitch.settings.speed !== 1
    || speechSwitch.settings.voice !== 'openai-coral'
    || !speechSwitch.resetSettingIds.includes('outputFormat')
    || !speechSwitch.resetSettingIds.includes('voice')
    || speechSwitch.incompatibleConnectedSlotIds.length !== 0
  ) {
    errors.push(
      'Speech model reconciliation must preserve compatible settings and report route-specific format and voice resets',
    )
  }

  const audioPromptOnlyModels = [
    elevenMusic,
    elevenSoundEffects,
    stableAudio25,
  ]
  if (
    audioPromptOnlyModels.some(model =>
      model.inputSlots.some(
        slot => slot.id === 'lyrics' || slot.id === 'imageReferences',
      ),
    )
  ) {
    errors.push(
      'Lyrics and image guidance must stay absent until an enabled audio route documents those inputs',
    )
  }
  const automaticSoundEffect = resolveSoundEffectGenerationState({
    inlinePrompt: 'A short bright notification',
    model: elevenSoundEffects,
    settings: defaultSettings(elevenSoundEffects),
  })
  if (automaticSoundEffect.visibleSettingIds.includes('durationSeconds')) {
    errors.push(
      'Automatic Sound Effect duration must hide the custom duration',
    )
  }

  const stableSoundEffect = resolveSoundEffectGenerationState({
    inlinePrompt: 'A deep mechanical pulse',
    model: stableAudio25,
    settings: defaultSettings(stableAudio25),
  })
  if (
    stableSoundEffect.visibleSettingIds.includes('loop')
    || !stableSoundEffect.visibleSettingIds.includes('promptInfluence')
  ) {
    errors.push(
      'Sound Effect controls must come only from the selected operation contract',
    )
  }

  const sourceMediaSlot = elevenVoiceChanger.inputSlots.find(
    slot => slot.id === 'sourceMedia',
  )
  const validVoiceChange = resolveVoiceChangerState({
    connectionCounts: { sourceMedia: 1 },
    itemCounts: { sourceMedia: 1 },
    model: elevenVoiceChanger,
    settings: defaultSettings(elevenVoiceChanger),
  })
  if (
    validVoiceChange.readiness !== 'ready'
    || !sourceMediaSlot?.accepts.includes('AudioSet')
    || !sourceMediaSlot.accepts.includes('VideoSet')
    || elevenVoiceChanger.inputSlots.some(slot => slot.id === 'prompt')
    || elevenVoiceIsolator.inputSlots.some(slot => slot.id === 'prompt')
  ) {
    errors.push(
      'Voice transforms must accept exactly one AudioSet or VideoSet source and must not expose a prompt',
    )
  }

  const musicModelIds = getGenerationModelsForNodeType('musicGeneration').map(
    model => model.id,
  )
  const soundEffectModelIds = getGenerationModelsForNodeType(
    'soundEffectGeneration',
  ).map(model => model.id)
  const speechModelIds = getGenerationModelsForNodeType('speechGeneration').map(
    model => model.id,
  )
  if (
    musicModelIds.length !== 0
    || soundEffectModelIds.length !== 0
    || JSON.stringify(speechModelIds)
    !== JSON.stringify(['talelabs/gemini-3.1-flash-tts-preview'])
  ) {
    errors.push(
      'Current audio pickers must expose only OpenRouter-supported speech models',
    )
  }
  return errors
}
