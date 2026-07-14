import type { HardenedGenerationModelDefinition } from '../generation-registry-types.js'
import {
  CONTEXT_INPUT,
  fixedOutput,
  PROMPT_INPUT,
  referenceLimit,
  SCRIPT_INPUT,
  SINGLE_PROMPT_INPUT,
  SOURCE_MEDIA_INPUT,
  VOICE_SETTINGS,
} from './common.js'

export const ELEVEN_MULTILINGUAL_V2_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [],
  defaultOperationId: 'textToSpeech',
  displayName: 'Eleven Multilingual v2',
  enabled: true,
  id: 'talelabs/eleven-multilingual-v2',
  inputSlots: [PROMPT_INPUT, CONTEXT_INPUT],
  labelKey: 'flows.models.elevenMultilingualV2',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToSpeechDescription',
      id: 'textToSpeech',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt', 'context'],
      labelKey: 'flows.operations.textToSpeech',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      requiredSettingIds: ['voiceId'],
      settingIds: ['voiceId', 'stability'],
    },
  ],
  recommended: true,
  settings: VOICE_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition

export const ELEVEN_SOUND_EFFECTS_V2_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [],
  defaultOperationId: 'textToSoundEffect',
  displayName: 'Eleven Sound Effects v2',
  enabled: true,
  id: 'talelabs/eleven-sound-effects-v2',
  inputSlots: [PROMPT_INPUT, CONTEXT_INPUT],
  labelKey: 'flows.models.elevenSoundEffectsV2',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToSoundEffectDescription',
      id: 'textToSoundEffect',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt', 'context'],
      labelKey: 'flows.operations.textToSoundEffect',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      settingIds: ['durationSeconds', 'loop', 'promptInfluence'],
    },
  ],
  recommended: false,
  settings: [
    {
      default: 5,
      id: 'durationSeconds',
      kind: 'number',
      labelKey: 'flows.settings.duration',
      max: 30,
      min: 0.5,
      step: 0.5,
    },
    {
      default: false,
      id: 'loop',
      kind: 'boolean',
      labelKey: 'flows.settings.loop',
    },
    {
      advanced: true,
      default: 0.3,
      id: 'promptInfluence',
      kind: 'number',
      labelKey: 'flows.settings.promptInfluence',
      max: 1,
      min: 0,
      step: 0.1,
    },
  ],
} as const satisfies HardenedGenerationModelDefinition

const AUDIO_OUTPUT_FORMAT_SETTING = {
  advanced: true,
  default: 'mp3',
  id: 'outputFormat',
  kind: 'enum',
  labelKey: 'flows.settings.outputFormat',
  options: [
    { labelKey: 'flows.settings.outputFormats.mp3', value: 'mp3' },
    { labelKey: 'flows.settings.outputFormats.wav', value: 'wav' },
  ],
} as const

const DURATION_MODE_SETTINGS = [
  {
    default: 'auto',
    id: 'durationMode',
    kind: 'enum',
    labelKey: 'flows.settings.durationMode',
    options: [
      { labelKey: 'flows.settings.durationModes.auto', value: 'auto' },
      { labelKey: 'flows.settings.durationModes.custom', value: 'custom' },
    ],
  },
  {
    default: 5,
    id: 'durationSeconds',
    kind: 'number',
    labelKey: 'flows.settings.duration',
    max: 30,
    min: 0.5,
    step: 0.5,
    visibleWhen: [
      {
        field: 'setting',
        id: 'durationMode',
        operator: 'equals',
        value: 'custom',
      },
    ],
  },
] as const

const ELEVEN_VOICE_SETTING = {
  default: 'eleven-rachel',
  id: 'voice',
  kind: 'enum',
  labelKey: 'flows.settings.voice',
  options: [
    { labelKey: 'flows.settings.voices.elevenRachel', value: 'eleven-rachel' },
    { labelKey: 'flows.settings.voices.elevenDomi', value: 'eleven-domi' },
    { labelKey: 'flows.settings.voices.elevenAntoni', value: 'eleven-antoni' },
    { labelKey: 'flows.settings.voices.elevenJosh', value: 'eleven-josh' },
  ],
} as const

const OPENAI_VOICE_SETTING = {
  default: 'openai-coral',
  id: 'voice',
  kind: 'enum',
  labelKey: 'flows.settings.voice',
  options: [
    { labelKey: 'flows.settings.voices.openaiCoral', value: 'openai-coral' },
    { labelKey: 'flows.settings.voices.openaiCedar', value: 'openai-cedar' },
    { labelKey: 'flows.settings.voices.openaiMarin', value: 'openai-marin' },
    { labelKey: 'flows.settings.voices.openaiVerse', value: 'openai-verse' },
  ],
} as const

/** Current Speech contract; the capability-v2 export above remains immutable. */
export const ELEVEN_MULTILINGUAL_V2_SPEECH_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'textToSpeech',
  displayName: 'Eleven Multilingual v2',
  enabled: true,
  id: 'talelabs/eleven-multilingual-v2',
  inputSlots: [SCRIPT_INPUT],
  labelKey: 'flows.models.elevenMultilingualV2',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToSpeechDescription',
      id: 'textToSpeech',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt'],
      labelKey: 'flows.operations.textToSpeech',
      nodeType: 'speechGeneration',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      requiredSettingIds: ['voice'],
      settingIds: ['voice', 'speed', 'outputFormat'],
    },
  ],
  recommended: true,
  settings: [
    ELEVEN_VOICE_SETTING,
    {
      default: 1,
      id: 'speed',
      kind: 'number',
      labelKey: 'flows.settings.speed',
      max: 1.2,
      min: 0.7,
      step: 0.05,
    },
    AUDIO_OUTPUT_FORMAT_SETTING,
  ],
} as const satisfies HardenedGenerationModelDefinition

export const GPT_4O_MINI_TTS_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'textToSpeech',
  displayName: 'GPT-4o mini TTS',
  enabled: true,
  id: 'talelabs/gpt-4o-mini-tts',
  inputSlots: [SCRIPT_INPUT],
  labelKey: 'flows.models.gpt4oMiniTts',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToSpeechDescription',
      id: 'textToSpeech',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt'],
      labelKey: 'flows.operations.textToSpeech',
      nodeType: 'speechGeneration',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      requiredSettingIds: ['voice'],
      settingIds: ['voice', 'speed', 'delivery', 'outputFormat'],
    },
  ],
  recommended: false,
  settings: [
    OPENAI_VOICE_SETTING,
    {
      default: 1,
      id: 'speed',
      kind: 'number',
      labelKey: 'flows.settings.speed',
      max: 4,
      min: 0.25,
      step: 0.25,
    },
    {
      default: '',
      id: 'delivery',
      kind: 'string',
      labelKey: 'flows.settings.delivery',
      maxLength: 1000,
    },
    AUDIO_OUTPUT_FORMAT_SETTING,
  ],
} as const satisfies HardenedGenerationModelDefinition

export const ELEVEN_MUSIC_V2_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'textToMusic',
  displayName: 'Eleven Music v2',
  enabled: true,
  id: 'talelabs/eleven-music-v2',
  inputSlots: [SINGLE_PROMPT_INPUT],
  labelKey: 'flows.models.elevenMusicV2',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToMusicDescription',
      id: 'textToMusic',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt'],
      labelKey: 'flows.operations.textToMusic',
      nodeType: 'musicGeneration',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      settingIds: [
        'durationMode',
        'durationSeconds',
        'instrumental',
        'outputFormat',
      ],
    },
  ],
  recommended: true,
  settings: [
    ...DURATION_MODE_SETTINGS.map(setting =>
      setting.id === 'durationSeconds'
        ? { ...setting, default: 30, max: 600, min: 3, step: 1 }
        : setting),
    {
      default: false,
      id: 'instrumental',
      kind: 'boolean',
      labelKey: 'flows.settings.instrumental',
    },
    AUDIO_OUTPUT_FORMAT_SETTING,
  ],
} as const satisfies HardenedGenerationModelDefinition

/** Current Sound Effect contract; the capability-v2 export stays historical. */
export const ELEVEN_SOUND_EFFECTS_V2_ADAPTIVE_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'textToSoundEffect',
  displayName: 'Eleven Sound Effects v2',
  enabled: true,
  id: 'talelabs/eleven-sound-effects-v2',
  inputSlots: [SINGLE_PROMPT_INPUT],
  labelKey: 'flows.models.elevenSoundEffectsV2',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToSoundEffectDescription',
      id: 'textToSoundEffect',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt'],
      labelKey: 'flows.operations.textToSoundEffect',
      nodeType: 'soundEffectGeneration',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      settingIds: [
        'durationMode',
        'durationSeconds',
        'loop',
        'promptInfluence',
        'outputFormat',
      ],
    },
  ],
  recommended: true,
  settings: [
    ...DURATION_MODE_SETTINGS,
    {
      default: false,
      id: 'loop',
      kind: 'boolean',
      labelKey: 'flows.settings.loop',
    },
    {
      advanced: true,
      default: 0.3,
      id: 'promptInfluence',
      kind: 'number',
      labelKey: 'flows.settings.promptInfluence',
      max: 1,
      min: 0,
      step: 0.1,
    },
    AUDIO_OUTPUT_FORMAT_SETTING,
  ],
} as const satisfies HardenedGenerationModelDefinition

export const ELEVEN_VOICE_CHANGER_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'changeVoice',
  displayName: 'Eleven Voice Changer',
  enabled: true,
  id: 'talelabs/eleven-voice-changer',
  inputSlots: [SOURCE_MEDIA_INPUT],
  labelKey: 'flows.models.elevenVoiceChanger',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.changeVoiceDescription',
      id: 'changeVoice',
      inputs: { sourceMedia: { required: true } },
      inputSlotIds: ['sourceMedia'],
      labelKey: 'flows.operations.changeVoice',
      nodeType: 'voiceChanger',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(1, 'sourceMedia'),
      requiredSettingIds: ['voice'],
      settingIds: ['voice', 'removeBackgroundNoise', 'outputFormat'],
    },
  ],
  recommended: true,
  settings: [
    ELEVEN_VOICE_SETTING,
    {
      default: true,
      id: 'removeBackgroundNoise',
      kind: 'boolean',
      labelKey: 'flows.settings.removeBackgroundNoise',
    },
    AUDIO_OUTPUT_FORMAT_SETTING,
  ],
} as const satisfies HardenedGenerationModelDefinition

export const ELEVEN_VOICE_ISOLATOR_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'isolateVoice',
  displayName: 'Eleven Voice Isolator',
  enabled: true,
  id: 'talelabs/eleven-voice-isolator',
  inputSlots: [SOURCE_MEDIA_INPUT],
  labelKey: 'flows.models.elevenVoiceIsolator',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.isolateVoiceDescription',
      id: 'isolateVoice',
      inputs: { sourceMedia: { required: true } },
      inputSlotIds: ['sourceMedia'],
      labelKey: 'flows.operations.isolateVoice',
      nodeType: 'voiceIsolation',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(1, 'sourceMedia'),
      settingIds: [],
    },
  ],
  recommended: true,
  settings: [],
} as const satisfies HardenedGenerationModelDefinition

export const STABLE_AUDIO_25_MODEL = {
  capabilitySchemaVersion: 3,
  constraints: [],
  defaultOperationId: 'textToMusic',
  displayName: 'Stable Audio 2.5',
  enabled: true,
  id: 'talelabs/stable-audio-2.5',
  inputSlots: [SINGLE_PROMPT_INPUT],
  labelKey: 'flows.models.stableAudio25',
  mediaType: 'audio',
  operations: [
    {
      descriptionKey: 'flows.operations.textToMusicDescription',
      id: 'textToMusic',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt'],
      labelKey: 'flows.operations.textToMusic',
      nodeType: 'musicGeneration',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      settingIds: [
        'durationMode',
        'durationSeconds',
        'seed',
        'outputFormat',
      ],
    },
    {
      descriptionKey: 'flows.operations.textToSoundEffectDescription',
      id: 'textToSoundEffect',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt'],
      labelKey: 'flows.operations.textToSoundEffect',
      nodeType: 'soundEffectGeneration',
      output: fixedOutput('audio'),
      referenceLimit: referenceLimit(0),
      settingIds: [
        'durationMode',
        'durationSeconds',
        'seed',
        'promptInfluence',
        'outputFormat',
      ],
    },
  ],
  recommended: false,
  settings: [
    ...DURATION_MODE_SETTINGS.map(setting =>
      setting.id === 'durationSeconds'
        ? { ...setting, default: 30, max: 190, min: 1, step: 1 }
        : setting),
    {
      advanced: true,
      default: 0,
      id: 'seed',
      kind: 'number',
      labelKey: 'flows.settings.seed',
      max: 4_294_967_294,
      min: 0,
      step: 1,
    },
    {
      advanced: true,
      default: 1,
      id: 'promptInfluence',
      kind: 'number',
      labelKey: 'flows.settings.promptInfluence',
      max: 25,
      min: 1,
      step: 0.5,
    },
    AUDIO_OUTPUT_FORMAT_SETTING,
  ],
} as const satisfies HardenedGenerationModelDefinition
