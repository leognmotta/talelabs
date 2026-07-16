import type {
  GenerationInputSlotDefinition,
  GenerationOutputDefinition,
  GenerationReferenceLimit,
  GenerationSettingDefinition,
} from '../registry/types.js'

export const PROMPT_INPUT = {
  accepts: ['Text'],
  descriptionKey: 'flows.inputs.promptDescription',
  id: 'prompt',
  labelKey: 'flows.inputs.prompt',
  maxConnections: 32,
  maxItems: 32,
  minConnections: 0,
} as const satisfies GenerationInputSlotDefinition

export const CONTEXT_INPUT = {
  accepts: ['ElementContext'],
  descriptionKey: 'flows.inputs.contextDescription',
  id: 'context',
  labelKey: 'flows.inputs.context',
  maxConnections: 32,
  maxItems: 32,
  minConnections: 0,
} as const satisfies GenerationInputSlotDefinition

export const SINGLE_PROMPT_INPUT = {
  ...PROMPT_INPUT,
  maxConnections: 1,
  maxItems: 1,
} as const satisfies GenerationInputSlotDefinition

export const SCRIPT_INPUT = {
  ...SINGLE_PROMPT_INPUT,
  descriptionKey: 'flows.inputs.scriptDescription',
  labelKey: 'flows.inputs.script',
} as const satisfies GenerationInputSlotDefinition

export const LYRICS_INPUT = {
  accepts: ['Text'],
  descriptionKey: 'flows.inputs.lyricsDescription',
  id: 'lyrics',
  labelKey: 'flows.inputs.lyrics',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
} as const satisfies GenerationInputSlotDefinition

export const SOURCE_MEDIA_INPUT = {
  accepts: ['AudioSet', 'VideoSet'],
  acceptedMedia: {
    mimeTypes: [
      'audio/aac',
      'audio/m4a',
      'audio/mpeg',
      'audio/mp4',
      'audio/ogg',
      'audio/wav',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ],
  },
  descriptionKey: 'flows.inputs.sourceMediaDescription',
  id: 'sourceMedia',
  labelKey: 'flows.inputs.sourceMedia',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 1,
  referenceProfile: {
    contactSheetPolicy: 'not-applicable',
    multipleSubjectSupport: 'not-applicable',
    purposes: ['audioGuidance'],
  },
} as const satisfies GenerationInputSlotDefinition

export const FIRST_FRAME_INPUT = {
  accepts: ['ImageSet'],
  descriptionKey: 'flows.inputs.firstFrameDescription',
  id: 'firstFrame',
  labelKey: 'flows.inputs.firstFrame',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
  referenceProfile: {
    contactSheetPolicy: 'not-applicable',
    multipleSubjectSupport: 'not-applicable',
    purposes: ['firstFrame'],
  },
} as const satisfies GenerationInputSlotDefinition

export const LAST_FRAME_INPUT = {
  accepts: ['ImageSet'],
  descriptionKey: 'flows.inputs.lastFrameDescription',
  id: 'lastFrame',
  labelKey: 'flows.inputs.lastFrame',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
  referenceProfile: {
    contactSheetPolicy: 'not-applicable',
    multipleSubjectSupport: 'not-applicable',
    purposes: ['lastFrame'],
  },
} as const satisfies GenerationInputSlotDefinition

export const REFERENCE_AUDIO_INPUT = {
  accepts: ['AudioSet'],
  descriptionKey: 'flows.inputs.referenceAudioDescription',
  id: 'referenceAudio',
  labelKey: 'flows.inputs.referenceAudio',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
  referenceProfile: {
    contactSheetPolicy: 'not-applicable',
    multipleSubjectSupport: 'not-applicable',
    purposes: ['audioGuidance'],
  },
} as const satisfies GenerationInputSlotDefinition

export const REFERENCE_VIDEO_INPUT = {
  accepts: ['VideoSet'],
  descriptionKey: 'flows.inputs.referenceVideoDescription',
  id: 'referenceVideo',
  labelKey: 'flows.inputs.referenceVideo',
  maxConnections: 1,
  maxItems: 1,
  minConnections: 0,
  referenceProfile: {
    contactSheetPolicy: 'not-applicable',
    multipleSubjectSupport: 'not-applicable',
    purposes: ['motion', 'videoExtension'],
  },
} as const satisfies GenerationInputSlotDefinition

export const IMAGE_ASPECT_RATIOS = [
  { labelKey: 'flows.settings.aspectRatios.square', value: '1:1' },
  { labelKey: 'flows.settings.aspectRatios.portraitPhoto', value: '2:3' },
  { labelKey: 'flows.settings.aspectRatios.photo', value: '3:2' },
] as const

export const VIDEO_ASPECT_RATIOS = [
  { labelKey: 'flows.settings.aspectRatios.landscape', value: '16:9' },
  { labelKey: 'flows.settings.aspectRatios.portrait', value: '9:16' },
] as const

export function fixedOutput(
  mediaType: GenerationOutputDefinition['mediaType'],
): GenerationOutputDefinition {
  return {
    count: { default: 1, max: 1, min: 1 },
    mediaType,
  }
}

export function configurableOutput(
  mediaType: GenerationOutputDefinition['mediaType'],
  max: number,
): GenerationOutputDefinition {
  return {
    count: { default: 1, max, min: 1, settingId: 'outputCount' },
    mediaType,
  }
}

export function referenceLimit(
  maxItems: number,
  ...slotIds: string[]
): GenerationReferenceLimit {
  return { maxItems, slotIds }
}

export const VOICE_SETTINGS = [
  {
    default: '',
    id: 'voiceId',
    kind: 'string',
    labelKey: 'flows.settings.voiceId',
    maxLength: 128,
  },
  {
    default: 0.5,
    id: 'stability',
    kind: 'number',
    labelKey: 'flows.settings.stability',
    max: 1,
    min: 0,
    step: 0.1,
  },
] as const satisfies readonly GenerationSettingDefinition[]
