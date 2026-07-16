import type {
  GenerationInputSlotDefinition,
  GenerationModelLogoId,
  GenerationSettingDefinition,
  HardenedGenerationModelDefinition,
} from '../registry/types.js'
import { fixedOutput, PROMPT_INPUT, referenceLimit } from './common.js'

const IMAGE_MEDIA = {
  maxBytes: 20 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

const FIRST_FRAME_INPUT = {
  acceptedMedia: IMAGE_MEDIA,
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

const LAST_FRAME_INPUT = {
  ...FIRST_FRAME_INPUT,
  descriptionKey: 'flows.inputs.lastFrameDescription',
  id: 'lastFrame',
  labelKey: 'flows.inputs.lastFrame',
  referenceProfile: { ...FIRST_FRAME_INPUT.referenceProfile, purposes: ['lastFrame'] },
} as const satisfies GenerationInputSlotDefinition

function enumSetting(
  id: 'aspectRatio' | 'durationSeconds' | 'resolution',
  values: readonly string[],
  defaultValue = values[0]!,
): GenerationSettingDefinition {
  return {
    default: defaultValue,
    id,
    kind: 'enum',
    labelKey: id === 'durationSeconds'
      ? 'flows.settings.duration'
      : `flows.settings.${id}`,
    options: values.map(value => ({
      labelKey:
        id === 'durationSeconds'
          ? `flows.settings.durations.seconds${value}`
          : id === 'resolution'
            ? `flows.settings.resolutions.${value.toLowerCase()}`
            : value === '1:1'
              ? 'flows.settings.aspectRatios.square'
              : value === '16:9'
                ? 'flows.settings.aspectRatios.landscape'
                : value === '9:16'
                  ? 'flows.settings.aspectRatios.portrait'
                  : value === '21:9'
                    ? 'flows.settings.aspectRatios.ultrawide'
                    : 'flows.settings.aspectRatio',
      value,
    })),
  }
}

function videoModel(input: {
  aspectRatios: readonly string[]
  audio: boolean
  defaultDuration: string
  descriptionKey: string
  displayName: string
  durations: readonly string[]
  frameMode: 'first' | 'first-last' | 'none'
  id: string
  labelKey: string
  logoId: GenerationModelLogoId
  resolutions: readonly string[]
}): HardenedGenerationModelDefinition {
  const settings = [
    enumSetting('aspectRatio', input.aspectRatios, input.aspectRatios[0]),
    enumSetting('durationSeconds', input.durations, input.defaultDuration),
    enumSetting('resolution', input.resolutions, input.resolutions[0]),
    ...(input.audio
      ? [{
          default: true,
          id: 'generateAudio',
          kind: 'boolean' as const,
          labelKey: 'flows.settings.generateAudio',
        }]
      : []),
  ]
  const settingIds = settings.map(setting => setting.id)
  const frameInputSlotIds = input.frameMode === 'first-last'
    ? ['prompt', 'firstFrame', 'lastFrame']
    : ['prompt', 'firstFrame']
  return {
    capabilitySchemaVersion: 2,
    constraints: input.frameMode === 'first-last'
      ? [{
          id: 'last-frame-requires-first-frame',
          messageKey: 'flows.constraints.lastFrameRequiresFirstFrame',
          require: [{ field: 'slot', id: 'firstFrame', operator: 'connected' }],
          when: [{ field: 'slot', id: 'lastFrame', operator: 'connected' }],
        }]
      : [],
    defaultOperationId: 'textToVideo',
    displayName: input.displayName,
    enabled: true,
    id: input.id,
    inputSlots: input.frameMode === 'none'
      ? [PROMPT_INPUT]
      : input.frameMode === 'first-last'
        ? [PROMPT_INPUT, FIRST_FRAME_INPUT, LAST_FRAME_INPUT]
        : [PROMPT_INPUT, FIRST_FRAME_INPUT],
    labelKey: input.labelKey,
    mediaType: 'video',
    operations: [
      {
        descriptionKey: 'flows.operations.textToVideoDescription',
        id: 'textToVideo',
        inputs: { prompt: { required: true } },
        inputSlotIds: ['prompt'],
        labelKey: 'flows.operations.textToVideo',
        output: fixedOutput('video'),
        referenceLimit: referenceLimit(0),
        settingIds,
      },
      ...(input.frameMode === 'none'
        ? []
        : [{
            descriptionKey: input.frameMode === 'first-last'
              ? 'flows.operations.firstLastFrameToVideoDescription'
              : 'flows.operations.imageToVideoDescription',
            id: input.frameMode === 'first-last'
              ? 'firstLastFrameToVideo'
              : 'imageToVideo',
            inputs: { firstFrame: { required: true }, prompt: { required: true } },
            inputSlotIds: frameInputSlotIds,
            labelKey: input.frameMode === 'first-last'
              ? 'flows.operations.firstLastFrameToVideo'
              : 'flows.operations.imageToVideo',
            output: fixedOutput('video'),
            referenceLimit: referenceLimit(
              input.frameMode === 'first-last' ? 2 : 1,
              'firstFrame',
              ...(input.frameMode === 'first-last' ? ['lastFrame'] : []),
            ),
            settingIds,
          }]),
    ],
    presentation: {
      descriptionKey: input.descriptionKey,
      logoId: input.logoId,
    },
    recommended: false,
    settings,
  }
}

const KLING_DURATIONS = [
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
] as const
const STANDARD_VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1'] as const

export const OPENROUTER_MAJOR_VIDEO_MODELS = [
  videoModel({
    aspectRatios: STANDARD_VIDEO_ASPECT_RATIOS,
    audio: true,
    defaultDuration: '5',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Kling 3.0 Pro',
    durations: KLING_DURATIONS,
    frameMode: 'first-last',
    id: 'talelabs/kling-3.0-pro',
    labelKey: 'flows.models.kling30Pro',
    logoId: 'kling',
    resolutions: ['720p'],
  }),
  videoModel({
    aspectRatios: STANDARD_VIDEO_ASPECT_RATIOS,
    audio: true,
    defaultDuration: '5',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Kling 3.0 Standard',
    durations: KLING_DURATIONS,
    frameMode: 'first-last',
    id: 'talelabs/kling-3.0-standard',
    labelKey: 'flows.models.kling30Standard',
    logoId: 'kling',
    resolutions: ['720p'],
  }),
  videoModel({
    aspectRatios: STANDARD_VIDEO_ASPECT_RATIOS,
    audio: true,
    defaultDuration: '5',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Kling Video O1',
    durations: ['5', '10'],
    frameMode: 'first-last',
    id: 'talelabs/kling-video-o1',
    labelKey: 'flows.models.klingVideoO1',
    logoId: 'kling',
    resolutions: ['720p'],
  }),
  videoModel({
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    audio: true,
    defaultDuration: '5',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Wan 2.7',
    durations: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
    frameMode: 'first-last',
    id: 'talelabs/wan-2.7',
    labelKey: 'flows.models.wan27',
    logoId: 'alibaba',
    resolutions: ['720p', '1080p'],
  }),
  videoModel({
    aspectRatios: ['16:9', '9:16'],
    audio: true,
    defaultDuration: '5',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Wan 2.6',
    durations: ['5', '10'],
    frameMode: 'first',
    id: 'talelabs/wan-2.6',
    labelKey: 'flows.models.wan26',
    logoId: 'alibaba',
    resolutions: ['720p', '1080p'],
  }),
  videoModel({
    aspectRatios: ['16:9'],
    audio: false,
    defaultDuration: '6',
    descriptionKey: 'flows.modelDescriptions.frameVideo',
    displayName: 'Hailuo 2.3',
    durations: ['6', '10'],
    frameMode: 'first',
    id: 'talelabs/hailuo-2.3',
    labelKey: 'flows.models.hailuo23',
    logoId: 'minimax',
    resolutions: ['1080p'],
  }),
  videoModel({
    aspectRatios: ['16:9', '9:16'],
    audio: true,
    defaultDuration: '8',
    descriptionKey: 'flows.modelDescriptions.textAudioVideo',
    displayName: 'Sora 2 Pro',
    durations: ['4', '8', '12', '16', '20'],
    frameMode: 'none',
    id: 'talelabs/sora-2-pro',
    labelKey: 'flows.models.sora2Pro',
    logoId: 'openai',
    resolutions: ['720p', '1080p'],
  }),
  videoModel({
    aspectRatios: ['16:9', '9:16'],
    audio: true,
    defaultDuration: '8',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Veo 3.1 Fast',
    durations: ['4', '6', '8'],
    frameMode: 'first-last',
    id: 'talelabs/veo-3.1-fast',
    labelKey: 'flows.models.veo31Fast',
    logoId: 'google',
    resolutions: ['720p', '1080p', '4K'],
  }),
  videoModel({
    aspectRatios: ['1:1', '3:4', '9:16', '4:3', '16:9', '21:9', '9:21'],
    audio: true,
    defaultDuration: '8',
    descriptionKey: 'flows.modelDescriptions.nativeAudioFrameVideo',
    displayName: 'Seedance 2.0 Fast',
    durations: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
    frameMode: 'first-last',
    id: 'talelabs/seedance-2.0-fast',
    labelKey: 'flows.models.seedance20Fast',
    logoId: 'bytedance',
    resolutions: ['480p', '720p'],
  }),
  videoModel({
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
    audio: false,
    defaultDuration: '5',
    descriptionKey: 'flows.modelDescriptions.frameVideo',
    displayName: 'HappyHorse 1.1',
    durations: KLING_DURATIONS,
    frameMode: 'first',
    id: 'talelabs/happyhorse-1.1',
    labelKey: 'flows.models.happyhorse11',
    logoId: 'alibaba',
    resolutions: ['720p', '1080p'],
  }),
] as const
