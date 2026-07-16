import type {
  GenerationInputSlotDefinition,
  GenerationSettingDefinition,
  HardenedGenerationModelDefinition,
} from '../registry/types.js'
import {
  configurableOutput,
  CONTEXT_INPUT,
  FIRST_FRAME_INPUT,
  fixedOutput,
  LAST_FRAME_INPUT,
  PROMPT_INPUT,
  REFERENCE_AUDIO_INPUT,
  REFERENCE_VIDEO_INPUT,
  referenceLimit,
  VIDEO_ASPECT_RATIOS,
} from './common.js'

const VEO_REFERENCES_INPUT = {
  accepts: ['ImageSet'],
  acceptedMedia: {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png'],
  },
  descriptionKey: 'flows.inputs.referencesDescription',
  id: 'references',
  labelKey: 'flows.inputs.references',
  maxConnections: 3,
  maxItems: 3,
  minConnections: 0,
  referenceProfile: {
    contactSheetPolicy: 'never',
    multipleSubjectSupport: 'unsupported',
    purposes: ['identity', 'subject'],
  },
} as const satisfies GenerationInputSlotDefinition

const VEO_FRAME_MEDIA = {
  maxBytes: 20 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png'],
} as const

const VEO_FIRST_FRAME_INPUT = {
  ...FIRST_FRAME_INPUT,
  acceptedMedia: VEO_FRAME_MEDIA,
} as const satisfies GenerationInputSlotDefinition

const VEO_LAST_FRAME_INPUT = {
  ...LAST_FRAME_INPUT,
  acceptedMedia: VEO_FRAME_MEDIA,
} as const satisfies GenerationInputSlotDefinition

const VEO_REFERENCE_VIDEO_INPUT = {
  ...REFERENCE_VIDEO_INPUT,
  acceptedMedia: {
    aspectRatios: ['16:9', '9:16'],
    durationSeconds: { max: 30, min: 1 },
    framesPerSecond: [24],
    mimeTypes: ['video/mp4'],
    resolutions: ['720p', '1080p'],
  },
} as const satisfies GenerationInputSlotDefinition

const VEO_SETTINGS = [
  {
    default: '16:9',
    id: 'aspectRatio',
    kind: 'enum',
    labelKey: 'flows.settings.aspectRatio',
    options: VIDEO_ASPECT_RATIOS,
  },
  {
    default: '8',
    id: 'durationSeconds',
    kind: 'enum',
    labelKey: 'flows.settings.duration',
    options: [4, 6, 8].map(value => ({
      labelKey: `flows.settings.durations.seconds${value}`,
      value: String(value),
    })),
  },
  {
    default: '720p',
    id: 'resolution',
    kind: 'enum',
    labelKey: 'flows.settings.resolution',
    options: ['720p', '1080p'].map(value => ({
      labelKey: `flows.settings.resolutions.${value}`,
      value,
    })),
  },
  {
    default: 1,
    id: 'outputCount',
    kind: 'number',
    labelKey: 'flows.settings.outputCount',
    max: 4,
    min: 1,
    step: 1,
  },
] as const satisfies readonly GenerationSettingDefinition[]

export const VEO_31_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [
    {
      id: 'last-frame-requires-first-frame',
      messageKey: 'flows.constraints.lastFrameRequiresFirstFrame',
      require: [{ field: 'slot', id: 'firstFrame', operator: 'connected' }],
      when: [{ field: 'slot', id: 'lastFrame', operator: 'connected' }],
    },
    {
      id: 'references-require-eight-seconds',
      messageKey: 'flows.constraints.referencesRequireEightSeconds',
      require: [{
        field: 'setting',
        id: 'durationSeconds',
        operator: 'equals',
        value: '8',
      }],
      when: [{
        field: 'operation',
        operator: 'equals',
        value: 'referencesToVideo',
      }],
    },
  ],
  defaultOperationId: 'textToVideo',
  displayName: 'Veo 3.1',
  enabled: true,
  id: 'talelabs/veo-3.1',
  inputSlots: [
    PROMPT_INPUT,
    CONTEXT_INPUT,
    VEO_FIRST_FRAME_INPUT,
    VEO_LAST_FRAME_INPUT,
    VEO_REFERENCES_INPUT,
    VEO_REFERENCE_VIDEO_INPUT,
  ],
  labelKey: 'flows.models.veo31',
  mediaType: 'video',
  operations: [
    {
      descriptionKey: 'flows.operations.textToVideoDescription',
      id: 'textToVideo',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt', 'context'],
      labelKey: 'flows.operations.textToVideo',
      output: configurableOutput('video', 4),
      referenceLimit: referenceLimit(0),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution', 'outputCount'],
    },
    {
      descriptionKey: 'flows.operations.firstLastFrameToVideoDescription',
      id: 'firstLastFrameToVideo',
      inputs: {
        firstFrame: { required: true },
        prompt: { required: true },
      },
      inputSlotIds: ['prompt', 'context', 'firstFrame', 'lastFrame'],
      labelKey: 'flows.operations.firstLastFrameToVideo',
      output: configurableOutput('video', 4),
      referenceLimit: referenceLimit(2, 'firstFrame', 'lastFrame'),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution', 'outputCount'],
    },
    {
      descriptionKey: 'flows.operations.referencesToVideoDescription',
      id: 'referencesToVideo',
      inputs: {
        prompt: { required: true },
        references: { required: true },
      },
      inputSlotIds: ['prompt', 'context', 'references'],
      labelKey: 'flows.operations.referencesToVideo',
      output: configurableOutput('video', 4),
      referenceLimit: referenceLimit(3, 'references'),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution', 'outputCount'],
    },
    {
      descriptionKey: 'flows.operations.extendVideoDescription',
      id: 'extendVideo',
      inputs: { referenceVideo: { required: true } },
      inputSlotIds: ['prompt', 'context', 'referenceVideo'],
      labelKey: 'flows.operations.extendVideo',
      output: configurableOutput('video', 4),
      referenceLimit: referenceLimit(1, 'referenceVideo'),
      settingIds: ['outputCount'],
    },
  ],
  recommended: true,
  settings: VEO_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition

const LTX_SETTINGS = [
  {
    default: '16:9',
    id: 'aspectRatio',
    kind: 'enum',
    labelKey: 'flows.settings.aspectRatio',
    options: VIDEO_ASPECT_RATIOS,
  },
  {
    default: '8',
    id: 'durationSeconds',
    kind: 'enum',
    labelKey: 'flows.settings.duration',
    options: [6, 8, 10].map(value => ({
      labelKey: `flows.settings.durations.seconds${value}`,
      value: String(value),
    })),
  },
  {
    default: '1080p',
    id: 'resolution',
    kind: 'enum',
    labelKey: 'flows.settings.resolution',
    options: [{ labelKey: 'flows.settings.resolutions.1080p', value: '1080p' }],
  },
] as const satisfies readonly GenerationSettingDefinition[]

const LTX_FRAME_MEDIA = {
  maxBytes: 15 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const

const LTX_FIRST_FRAME_INPUT = {
  ...FIRST_FRAME_INPUT,
  acceptedMedia: LTX_FRAME_MEDIA,
} as const satisfies GenerationInputSlotDefinition

const LTX_LAST_FRAME_INPUT = {
  ...LAST_FRAME_INPUT,
  acceptedMedia: LTX_FRAME_MEDIA,
} as const satisfies GenerationInputSlotDefinition

const LTX_REFERENCE_AUDIO_INPUT = {
  ...REFERENCE_AUDIO_INPUT,
  acceptedMedia: {
    durationSeconds: { max: 20, min: 2 },
    maxBytes: 32 * 1024 * 1024,
    mimeTypes: [
      'audio/aac',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
    ],
  },
} as const satisfies GenerationInputSlotDefinition

export const LTX_23_PRO_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [],
  defaultOperationId: 'textToVideo',
  displayName: 'LTX 2.3 Pro',
  enabled: true,
  id: 'talelabs/ltx-2.3-pro',
  inputSlots: [
    PROMPT_INPUT,
    CONTEXT_INPUT,
    LTX_FIRST_FRAME_INPUT,
    LTX_LAST_FRAME_INPUT,
    LTX_REFERENCE_AUDIO_INPUT,
  ],
  labelKey: 'flows.models.ltx23Pro',
  mediaType: 'video',
  operations: [
    {
      descriptionKey: 'flows.operations.textToVideoDescription',
      id: 'textToVideo',
      inputs: { prompt: { required: true } },
      inputSlotIds: ['prompt', 'context'],
      labelKey: 'flows.operations.textToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(0),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
    },
    {
      descriptionKey: 'flows.operations.imageToVideoDescription',
      id: 'imageToVideo',
      inputs: {
        firstFrame: { required: true },
        prompt: { required: true },
      },
      inputSlotIds: ['prompt', 'context', 'firstFrame', 'lastFrame'],
      labelKey: 'flows.operations.imageToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(2, 'firstFrame', 'lastFrame'),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
    },
    {
      descriptionKey: 'flows.operations.audioToVideoDescription',
      id: 'audioToVideo',
      inputs: {
        referenceAudio: { required: true },
        // TaleLabs deliberately keeps one deterministic source mode even though
        // the provider also accepts prompt + image together.
        source: { oneOf: ['prompt', 'firstFrame'] },
      },
      inputSlotIds: ['prompt', 'context', 'referenceAudio', 'firstFrame'],
      labelKey: 'flows.operations.audioToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(2, 'referenceAudio', 'firstFrame'),
      settingIds: ['aspectRatio', 'resolution'],
    },
  ],
  recommended: false,
  settings: LTX_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition
