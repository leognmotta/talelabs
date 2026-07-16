import type { HardenedGenerationModelDefinition } from '../registry/types.js'
import {
  fixedOutput,
  PROMPT_INPUT,
  referenceLimit,
} from './common.js'
import { videoSettings } from './video-adaptive-settings.js'
import {
  frameInput,
  imageReferencesInput,
} from './video-image-inputs.js'
import {
  audioReferencesInput,
  videoReferencesInput,
} from './video-media-inputs.js'

const FIRST_FRAME_INPUT = frameInput('firstFrame')
const LAST_FRAME_INPUT = frameInput('lastFrame')

const VEO_SETTINGS = videoSettings({
  audio: true,
  defaultDuration: '8',
  durations: ['4', '6', '8'],
  resolutions: ['720p', '1080p', '4k'],
})

export const ADAPTIVE_VEO_31_MODEL = {
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
      require: [
        {
          field: 'setting',
          id: 'durationSeconds',
          operator: 'equals',
          value: '8',
        },
      ],
      when: [
        { field: 'operation', operator: 'equals', value: 'referencesToVideo' },
      ],
    },
  ],
  defaultOperationId: 'textToVideo',
  displayName: 'Veo 3.1',
  enabled: true,
  id: 'talelabs/veo-3.1',
  inputSlots: [
    PROMPT_INPUT,
    FIRST_FRAME_INPUT,
    LAST_FRAME_INPUT,
    imageReferencesInput(3),
    videoReferencesInput(),
  ],
  labelKey: 'flows.models.veo31',
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
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
    {
      descriptionKey: 'flows.operations.firstLastFrameToVideoDescription',
      id: 'firstLastFrameToVideo',
      inputs: { firstFrame: { required: true }, prompt: { required: true } },
      inputSlotIds: ['prompt', 'firstFrame', 'lastFrame'],
      labelKey: 'flows.operations.firstLastFrameToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(2, 'firstFrame', 'lastFrame'),
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
    {
      descriptionKey: 'flows.operations.referencesToVideoDescription',
      id: 'referencesToVideo',
      inputs: {
        imageReferences: { required: true },
        prompt: { required: true },
      },
      inputSlotIds: ['prompt', 'imageReferences'],
      labelKey: 'flows.operations.referencesToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(3, 'imageReferences'),
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
    {
      descriptionKey: 'flows.operations.extendVideoDescription',
      id: 'extendVideo',
      inputs: { videoReferences: { required: true } },
      inputSlotIds: ['prompt', 'videoReferences'],
      labelKey: 'flows.operations.extendVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(1, 'videoReferences'),
      settingIds: ['generateAudio'],
    },
  ],
  recommended: true,
  settings: VEO_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition

const VEO_LITE_SETTINGS = videoSettings({
  audio: true,
  defaultDuration: '8',
  durations: ['4', '6', '8'],
  resolutions: ['720p', '1080p'],
})

export const VEO_31_LITE_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [
    {
      id: 'last-frame-requires-first-frame',
      messageKey: 'flows.constraints.lastFrameRequiresFirstFrame',
      require: [{ field: 'slot', id: 'firstFrame', operator: 'connected' }],
      when: [{ field: 'slot', id: 'lastFrame', operator: 'connected' }],
    },
  ],
  defaultOperationId: 'textToVideo',
  displayName: 'Veo 3.1 Lite',
  enabled: true,
  id: 'talelabs/veo-3.1-lite',
  inputSlots: [PROMPT_INPUT, FIRST_FRAME_INPUT, LAST_FRAME_INPUT],
  labelKey: 'flows.models.veo31Lite',
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
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
    {
      descriptionKey: 'flows.operations.firstLastFrameToVideoDescription',
      id: 'firstLastFrameToVideo',
      inputs: { firstFrame: { required: true }, prompt: { required: true } },
      inputSlotIds: ['prompt', 'firstFrame', 'lastFrame'],
      labelKey: 'flows.operations.firstLastFrameToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(2, 'firstFrame', 'lastFrame'),
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
  ],
  recommended: false,
  settings: VEO_LITE_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition

const GROK_SETTINGS = videoSettings({
  defaultDuration: '6',
  durations: ['1', '3', '6', '10', '15'],
  resolutions: ['480p', '720p'],
})

export const GROK_IMAGINE_VIDEO_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [],
  defaultOperationId: 'textToVideo',
  displayName: 'Grok Imagine Video',
  enabled: true,
  id: 'talelabs/grok-imagine-video',
  inputSlots: [PROMPT_INPUT, FIRST_FRAME_INPUT, imageReferencesInput(7)],
  labelKey: 'flows.models.grokImagineVideo',
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
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
    },
    {
      descriptionKey: 'flows.operations.imageToVideoDescription',
      id: 'imageToVideo',
      inputs: { firstFrame: { required: true }, prompt: { required: true } },
      inputSlotIds: ['prompt', 'firstFrame'],
      labelKey: 'flows.operations.imageToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(1, 'firstFrame'),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
    },
    {
      descriptionKey: 'flows.operations.referencesToVideoDescription',
      id: 'referencesToVideo',
      inputs: {
        imageReferences: { required: true },
        prompt: { required: true },
      },
      inputSlotIds: ['prompt', 'imageReferences'],
      labelKey: 'flows.operations.referencesToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(7, 'imageReferences'),
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
    },
  ],
  recommended: false,
  settings: GROK_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition

const SEEDANCE_SETTINGS = videoSettings({
  audio: true,
  defaultDuration: '8',
  durations: ['4', '6', '8', '10', '12', '15'],
  resolutions: ['480p', '720p', '1080p', '4k'],
})

export const SEEDANCE_20_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [
    {
      id: 'last-frame-requires-first-frame',
      messageKey: 'flows.constraints.lastFrameRequiresFirstFrame',
      require: [{ field: 'slot', id: 'firstFrame', operator: 'connected' }],
      when: [{ field: 'slot', id: 'lastFrame', operator: 'connected' }],
    },
  ],
  defaultOperationId: 'textToVideo',
  displayName: 'Seedance 2.0',
  enabled: true,
  id: 'talelabs/seedance-2.0',
  inputSlots: [
    PROMPT_INPUT,
    FIRST_FRAME_INPUT,
    LAST_FRAME_INPUT,
    // OpenRouter confirms all three media families but does not publish a hard
    // per-family count. TaleLabs deliberately enables one of each, bounded by
    // a total of three, until stronger provider evidence is reviewed.
    imageReferencesInput(1),
    videoReferencesInput(),
    audioReferencesInput(),
  ],
  labelKey: 'flows.models.seedance20',
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
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
    {
      descriptionKey: 'flows.operations.firstLastFrameToVideoDescription',
      id: 'firstLastFrameToVideo',
      inputs: { firstFrame: { required: true }, prompt: { required: true } },
      inputSlotIds: ['prompt', 'firstFrame', 'lastFrame'],
      labelKey: 'flows.operations.firstLastFrameToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(2, 'firstFrame', 'lastFrame'),
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
    {
      descriptionKey: 'flows.operations.referencesToVideoDescription',
      id: 'referencesToVideo',
      inputs: {
        prompt: { required: true },
        referenceMedia: {
          atLeastOne: ['imageReferences', 'videoReferences', 'audioReferences'],
        },
      },
      inputSlotIds: [
        'prompt',
        'imageReferences',
        'videoReferences',
        'audioReferences',
      ],
      labelKey: 'flows.operations.referencesToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(
        3,
        'imageReferences',
        'videoReferences',
        'audioReferences',
      ),
      settingIds: [
        'aspectRatio',
        'durationSeconds',
        'resolution',
        'generateAudio',
      ],
    },
  ],
  recommended: false,
  settings: SEEDANCE_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition

const LTX_SETTINGS = videoSettings({
  defaultDuration: '8',
  durations: ['6', '8', '10'],
  resolutions: ['1080p'],
})

export const ADAPTIVE_LTX_23_PRO_MODEL = {
  capabilitySchemaVersion: 2,
  constraints: [],
  defaultOperationId: 'textToVideo',
  displayName: 'LTX 2.3 Pro',
  enabled: true,
  id: 'talelabs/ltx-2.3-pro',
  inputSlots: [PROMPT_INPUT, imageReferencesInput(1), audioReferencesInput()],
  labelKey: 'flows.models.ltx23Pro',
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
      settingIds: ['aspectRatio', 'durationSeconds', 'resolution'],
    },
    {
      descriptionKey: 'flows.operations.audioToVideoDescription',
      id: 'audioToVideo',
      inputs: { audioReferences: { required: true } },
      inputSlotIds: ['prompt', 'audioReferences', 'imageReferences'],
      labelKey: 'flows.operations.audioToVideo',
      output: fixedOutput('video'),
      referenceLimit: referenceLimit(2, 'audioReferences', 'imageReferences'),
      settingIds: ['aspectRatio', 'resolution'],
    },
  ],
  recommended: false,
  settings: LTX_SETTINGS,
} as const satisfies HardenedGenerationModelDefinition
