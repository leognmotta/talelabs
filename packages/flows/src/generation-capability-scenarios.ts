import type { GenerationContractIssue } from './generation-evaluator.js'
import type {
  GenerationModelDefinition,
  GenerationSettingValue,
} from './generation-registry-types.js'
import { reconcileAudioNodeModel } from './audio-node-resolver.js'
import { evaluateGenerationContract } from './generation-evaluator.js'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_CONTRACTS,
  GENERATION_MODEL_REGISTRY,
  getGenerationInputSlotsForNodeType,
  getGenerationModelsForNodeType,
  validateGenerationCandidateSelectionSnapshot,
} from './generation-registry.js'
import { validateExecutableFlowGraph } from './graph-validation.js'
import { resolveImageGenerationState } from './image-generation-resolver.js'
import { resolveLlmState } from './llm-resolver.js'
import { resolveMusicGenerationState } from './music-generation-resolver.js'
import {
  getDefaultNodeData,
  getFlowNodeTypeDefinition,
  parseAndUpcastFlowNodeData,
} from './node-registry.js'
import { resolveSoundEffectGenerationState } from './sound-effect-generation-resolver.js'
import { resolveSpeechGenerationState } from './speech-generation-resolver.js'
import { resolveVideoGenerationState } from './video-generation-resolver.js'
import { resolveVoiceChangerState } from './voice-changer-resolver.js'
import { resolveVoiceIsolationState } from './voice-isolation-resolver.js'

interface CapabilityScenario {
  expectedIssueCodes?: readonly GenerationContractIssue['code'][]
  input: {
    connectionCounts: Readonly<Record<string, number>>
    itemCounts?: Readonly<Record<string, number>>
    model: GenerationModelDefinition
    operationId: string
    requireComplete?: boolean
    settings: Readonly<Record<string, GenerationSettingValue>>
  }
  name: string
}

function defaultSettings(model: GenerationModelDefinition) {
  return Object.fromEntries(
    model.settings.map(setting => [setting.id, setting.default]),
  )
}

const gptImage2 = GENERATION_MODEL_REGISTRY['talelabs/gpt-image-2']
const veo31 = GENERATION_MODEL_REGISTRY['talelabs/veo-3.1']
const ltx23Pro = GENERATION_MODEL_REGISTRY['talelabs/ltx-2.3-pro']
const seedance20 = GENERATION_MODEL_REGISTRY['talelabs/seedance-2.0']
const nanoBanana2 = GENERATION_MODEL_REGISTRY['talelabs/nano-banana-2']
const recraft41 = GENERATION_MODEL_REGISTRY['talelabs/recraft-4.1']
const legacyGptImage2 = GENERATION_MODEL_CONTRACTS['2026-07-13.3'][
  'talelabs/gpt-image-2'
]
const legacySeedance20 = GENERATION_MODEL_CONTRACTS['2026-07-13.3'][
  'talelabs/seedance-2.0'
]
const legacyClaudeSonnet46 = GENERATION_MODEL_CONTRACTS['2026-07-13.7'][
  'talelabs/claude-sonnet-4.6'
]
const gemini31FlashLite
  = GENERATION_MODEL_REGISTRY['talelabs/gemini-3.1-flash-lite']
const gemini31Pro = GENERATION_MODEL_REGISTRY['talelabs/gemini-3.1-pro']
const deepseekV32 = GENERATION_MODEL_REGISTRY['talelabs/deepseek-v3.2']
const mistralLarge3 = GENERATION_MODEL_REGISTRY['talelabs/mistral-large-3']
const elevenSpeech
  = GENERATION_MODEL_REGISTRY['talelabs/eleven-multilingual-v2']
const openAiSpeech = GENERATION_MODEL_REGISTRY['talelabs/gpt-4o-mini-tts']
const elevenMusic = GENERATION_MODEL_REGISTRY['talelabs/eleven-music-v2']
const elevenSoundEffects
  = GENERATION_MODEL_REGISTRY['talelabs/eleven-sound-effects-v2']
const elevenVoiceChanger
  = GENERATION_MODEL_REGISTRY['talelabs/eleven-voice-changer']
const elevenVoiceIsolator
  = GENERATION_MODEL_REGISTRY['talelabs/eleven-voice-isolator']
const stableAudio25 = GENERATION_MODEL_REGISTRY['talelabs/stable-audio-2.5']

const CAPABILITY_SCENARIOS: readonly CapabilityScenario[] = [
  {
    input: {
      connectionCounts: { imageReferences: 1, prompt: 1 },
      itemCounts: { imageReferences: 3, prompt: 1 },
      model: gptImage2,
      operationId: 'imageToImage',
      requireComplete: true,
      settings: defaultSettings(gptImage2),
    },
    name: 'multiple image references with fixed single output',
  },
  {
    expectedIssueCodes: ['generation_input_required'],
    input: {
      connectionCounts: { imageReferences: 1, prompt: 1 },
      itemCounts: { imageReferences: 1, prompt: 0 },
      model: gptImage2,
      operationId: 'imageToImage',
      requireComplete: true,
      settings: defaultSettings(gptImage2),
    },
    name: 'structural prompt connection does not satisfy runtime input',
  },
  {
    input: {
      connectionCounts: { firstFrame: 1, lastFrame: 1, prompt: 1 },
      model: veo31,
      operationId: 'firstLastFrameToVideo',
      requireComplete: true,
      settings: defaultSettings(veo31),
    },
    name: 'first and last frame',
  },
  {
    input: {
      connectionCounts: { videoReferences: 1 },
      model: veo31,
      operationId: 'extendVideo',
      requireComplete: true,
      settings: defaultSettings(veo31),
    },
    name: 'reference video',
  },
  {
    input: {
      connectionCounts: { audioReferences: 1 },
      model: ltx23Pro,
      operationId: 'audioToVideo',
      requireComplete: true,
      settings: defaultSettings(ltx23Pro),
    },
    name: 'reference audio',
  },
  {
    expectedIssueCodes: ['generation_constraint', 'generation_setting_invalid'],
    input: {
      connectionCounts: { imageReferences: 1, prompt: 1 },
      itemCounts: { imageReferences: 2, prompt: 1 },
      model: veo31,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: { ...defaultSettings(veo31), durationSeconds: '6' },
    },
    name: 'invalid setting combination',
  },
  {
    input: {
      connectionCounts: {
        audioReferences: 1,
        imageReferences: 1,
        prompt: 1,
        videoReferences: 1,
      },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'multimodal reference group accepts more than one member',
  },
  {
    expectedIssueCodes: ['generation_input_at_least_one'],
    input: {
      connectionCounts: { prompt: 1 },
      model: seedance20,
      operationId: 'referencesToVideo',
      requireComplete: true,
      settings: defaultSettings(seedance20),
    },
    name: 'multimodal reference group requires at least one member',
  },
]

export function validateGenerationCapabilityScenarios() {
  const errors: string[] = []

  for (const scenario of CAPABILITY_SCENARIOS) {
    const actualCodes = evaluateGenerationContract(scenario.input)
      .issues
      .map(issue => issue.code)
      .toSorted()
    const expectedCodes = [...(scenario.expectedIssueCodes ?? [])].toSorted()
    if (JSON.stringify(actualCodes) !== JSON.stringify(expectedCodes)) {
      errors.push(
        `${scenario.name}: expected [${expectedCodes.join(', ')}], received [${actualCodes.join(', ')}]`,
      )
    }
  }

  const emptyConnectedTextResult = validateExecutableFlowGraph({
    context: { assetTypesById: {} },
    edges: [{
      createdAt: '2026-07-14T00:00:00.000Z',
      id: 'empty-text-to-llm-prompt',
      sourceHandle: 'text',
      sourceNodeId: 'empty-text',
      targetHandle: 'prompt',
      targetNodeId: 'llm',
    }],
    nodes: [
      {
        assetId: null,
        data: getDefaultNodeData('text'),
        id: 'empty-text',
        positionX: 0,
        positionY: 0,
        schemaVersion: getFlowNodeTypeDefinition('text').currentVersion,
        type: 'text',
      },
      {
        assetId: null,
        data: getDefaultNodeData('llm'),
        id: 'llm',
        positionX: 100,
        positionY: 0,
        schemaVersion: getFlowNodeTypeDefinition('llm').currentVersion,
        type: 'llm',
      },
    ],
  })
  if (
    emptyConnectedTextResult.valid
    || !emptyConnectedTextResult.issues.some(
      issue => issue.code === 'generation_input_required',
    )
  ) {
    errors.push(
      'Executable validation must reject an empty connected Text prompt',
    )
  }

  const resolverScenarios = [
    {
      actual: resolveVideoGenerationState({
        inlinePrompt: 'A calm establishing shot',
        model: veo31,
        settings: defaultSettings(veo31),
      }),
      expectedOperationId: 'textToVideo',
      expectedReadiness: 'ready',
      name: 'inline prompt resolves the default text operation',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { lastFrame: 1 },
        inlinePrompt: 'Move toward the final composition',
        model: veo31,
        settings: defaultSettings(veo31),
      }),
      expectedOperationId: 'firstLastFrameToVideo',
      expectedReadiness: 'incomplete',
      name: 'last frame establishes frame intent while first frame remains required',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { audioReferences: 1, imageReferences: 1 },
        inlinePrompt: 'Follow the reference timing',
        model: seedance20,
        settings: defaultSettings(seedance20),
      }),
      expectedOperationId: 'referencesToVideo',
      expectedReadiness: 'ready',
      name: 'multimodal references resolve one shared reference operation',
    },
    {
      actual: resolveVideoGenerationState({
        connectionCounts: { firstFrame: 1, imageReferences: 1 },
        inlinePrompt: 'Conflicting intent',
        model: seedance20,
        settings: defaultSettings(seedance20),
      }),
      expectedOperationId: null,
      expectedReadiness: 'invalid',
      name: 'frame and reference families cannot coexist',
    },
  ] as const
  for (const scenario of resolverScenarios) {
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}`,
      )
    }
  }

  const imageResolverScenarios = [
    {
      actual: resolveImageGenerationState({
        inlinePrompt: 'A studio portrait',
        model: nanoBanana2,
        settings: defaultSettings(nanoBanana2),
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToImage',
      expectedReadiness: 'ready',
      name: 'image inline prompt resolves text to image',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { imageReferences: 1 },
        inlinePrompt: 'Keep the subject identity',
        itemCounts: { imageReferences: 4 },
        model: nanoBanana2,
        settings: defaultSettings(nanoBanana2),
      }),
      expectedAvailability: 'connected',
      expectedOperationId: 'imageToImage',
      expectedReadiness: 'ready',
      name: 'selected image items resolve image to image',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { references: 1 },
        inlinePrompt: 'Preserve the legacy reference',
        itemCounts: { references: 2 },
        model: legacyGptImage2,
        settings: defaultSettings(legacyGptImage2),
      }),
      expectedAvailability: 'connected',
      expectedOperationId: 'imageToImage',
      expectedReadiness: 'ready',
      name: 'historical references alias remains resolvable before explicit upgrade',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { imageReferences: 1 },
        itemCounts: { imageReferences: 14 },
        model: nanoBanana2,
        settings: defaultSettings(nanoBanana2),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'imageToImage',
      expectedReadiness: 'incomplete',
      name: 'image reference runtime item limit is full',
    },
    {
      actual: resolveImageGenerationState({
        connectionCounts: { imageReferences: 1 },
        inlinePrompt: 'Unsupported reference attempt',
        itemCounts: { imageReferences: 1 },
        model: recraft41,
        settings: defaultSettings(recraft41),
      }),
      expectedAvailability: 'unsupported',
      expectedOperationId: null,
      expectedReadiness: 'invalid',
      name: 'text only image model rejects references',
    },
  ] as const
  for (const scenario of imageResolverScenarios) {
    const availability
      = scenario.actual.inputAvailability.imageReferences?.state
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
      || availability !== scenario.expectedAvailability
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}/${scenario.expectedAvailability}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}/${availability}`,
      )
    }
  }

  const llmResolverScenarios = [
    {
      actual: resolveLlmState({
        inlinePrompt: 'Rewrite this creative brief',
        model: gemini31FlashLite,
        settings: defaultSettings(gemini31FlashLite),
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToText',
      expectedReadiness: 'ready',
      name: 'LLM inline prompt resolves text to text',
    },
    {
      actual: resolveLlmState({
        connectionCounts: { imageReferences: 1, prompt: 1 },
        itemCounts: { imageReferences: 8, prompt: 1 },
        model: gemini31FlashLite,
        settings: defaultSettings(gemini31FlashLite),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'visionToText',
      expectedReadiness: 'ready',
      name: 'LLM vision operation accepts exactly eight images',
    },
    {
      actual: resolveLlmState({
        connectionCounts: { imageReferences: 1, prompt: 1 },
        itemCounts: { imageReferences: 9, prompt: 1 },
        model: gemini31FlashLite,
        settings: defaultSettings(gemini31FlashLite),
      }),
      expectedAvailability: 'full',
      expectedOperationId: 'visionToText',
      expectedReadiness: 'invalid',
      name: 'LLM vision operation rejects a ninth image',
    },
    {
      actual: resolveLlmState({
        connectionCounts: { imageReferences: 1, prompt: 1 },
        itemCounts: { imageReferences: 1, prompt: 1 },
        model: deepseekV32,
        settings: defaultSettings(deepseekV32),
      }),
      expectedAvailability: 'unsupported',
      expectedOperationId: null,
      expectedReadiness: 'invalid',
      name: 'text-only LLM rejects image references',
    },
    {
      actual: resolveLlmState({
        inlinePrompt: 'Analyze the composition',
        model: gemini31Pro,
        settings: { ...defaultSettings(gemini31Pro), reasoningMode: 'off' },
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToText',
      expectedReadiness: 'invalid',
      expectedReasoning: 'medium',
      name: 'mandatory reasoning normalizes unsupported Off',
    },
    {
      actual: resolveLlmState({
        inlineInstructions: 'Answer as a creative director',
        inlinePrompt: 'Create three scene ideas',
        model: mistralLarge3,
        settings: defaultSettings(mistralLarge3),
      }),
      expectedAvailability: 'available',
      expectedOperationId: 'textToText',
      expectedReadiness: 'ready',
      expectedReasoning: undefined,
      name: 'non-reasoning LLM has no reasoning setting',
    },
  ] as const
  for (const scenario of llmResolverScenarios) {
    const availability
      = scenario.actual.inputAvailability.imageReferences?.state
    const reasoning = scenario.actual.normalizedSettings.reasoningMode
    if (
      scenario.actual.resolvedOperationId !== scenario.expectedOperationId
      || scenario.actual.readiness !== scenario.expectedReadiness
      || availability !== scenario.expectedAvailability
      || ('expectedReasoning' in scenario
        && reasoning !== scenario.expectedReasoning)
    ) {
      errors.push(
        `${scenario.name}: expected ${scenario.expectedOperationId}/${scenario.expectedReadiness}/${scenario.expectedAvailability}/${'expectedReasoning' in scenario ? scenario.expectedReasoning : '-'}, received ${scenario.actual.resolvedOperationId}/${scenario.actual.readiness}/${availability}/${String(reasoning)}`,
      )
    }
  }

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
    inlinePrompt: 'This preserved draft is not concatenated with connected text',
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
    speechSwitch.settings.outputFormat !== 'wav'
    || speechSwitch.settings.speed !== 1
    || speechSwitch.settings.voice !== 'openai-coral'
    || !speechSwitch.resetSettingIds.includes('voice')
    || speechSwitch.incompatibleConnectedSlotIds.length !== 0
  ) {
    errors.push(
      'Speech model reconciliation must preserve compatible settings and report provider-specific voice resets',
    )
  }

  const audioPromptOnlyModels = [elevenMusic, elevenSoundEffects, stableAudio25]
  if (audioPromptOnlyModels.some(model =>
    model.inputSlots.some(slot =>
      slot.id === 'lyrics' || slot.id === 'imageReferences'),
  )) {
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
    errors.push('Automatic Sound Effect duration must hide the custom duration')
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

  const musicModelIds = getGenerationModelsForNodeType('musicGeneration')
    .map(model => model.id)
  const soundEffectModelIds = getGenerationModelsForNodeType(
    'soundEffectGeneration',
  ).map(model => model.id)
  const speechModelIds = getGenerationModelsForNodeType('speechGeneration')
    .map(model => model.id)
  if (
    !musicModelIds.includes(stableAudio25.id)
    || !soundEffectModelIds.includes(stableAudio25.id)
    || speechModelIds.includes(stableAudio25.id)
  ) {
    errors.push(
      'Operation node types must place Stable Audio only in Music and Sound Effect pickers',
    )
  }

  const legacyImageSlotIds = getGenerationInputSlotsForNodeType(
    legacyGptImage2,
    'imageGeneration',
  ).map(slot => slot.id)
  const legacyVideoSlotIds = getGenerationInputSlotsForNodeType(
    legacySeedance20,
    'videoGeneration',
  ).map(slot => slot.id)
  const legacyLlmSlotIds = getGenerationInputSlotsForNodeType(
    legacyClaudeSonnet46,
    'llm',
  ).map(slot => slot.id)
  if (
    !legacyImageSlotIds.includes('prompt')
    || !legacyVideoSlotIds.includes('prompt')
    || !legacyVideoSlotIds.includes('imageReferences')
    || !legacyLlmSlotIds.includes('instructions')
    || !legacyLlmSlotIds.includes('prompt')
  ) {
    errors.push(
      'Historical capability-v2 Image, Video, and LLM contracts must retain their input handles',
    )
  }

  const legacySpeechModel = GENERATION_MODEL_CONTRACTS['2026-07-13.7'][
    'talelabs/eleven-multilingual-v2'
  ]
  const migratedSpeech = parseAndUpcastFlowNodeData({
    data: {
      inputSelections: Object.fromEntries(
        legacySpeechModel.inputSlots.map(slot => [slot.id, { mode: 'auto' }]),
      ),
      locked: true,
      modelContractVersion: '2026-07-13.7',
      modelId: legacySpeechModel.id,
      operationId: 'textToSpeech',
      settings: { stability: 0.7, voiceId: 'legacy-provider-voice-id' },
    },
    schemaVersion: 2,
    type: 'audioGeneration',
  })
  if (
    migratedSpeech.type !== 'speechGeneration'
    || migratedSpeech.schemaVersion !== 1
    || migratedSpeech.data.locked !== true
    || migratedSpeech.data.prompt !== ''
    || migratedSpeech.data.modelContractVersion
    !== GENERATION_MODEL_CONTRACT_VERSION
  ) {
    errors.push(
      'Legacy ElevenLabs text-to-speech nodes must migrate to the current Speech contract',
    )
  }

  const legacySoundEffectModel = GENERATION_MODEL_CONTRACTS['2026-07-13.7'][
    'talelabs/eleven-sound-effects-v2'
  ]
  const migratedSoundEffect = parseAndUpcastFlowNodeData({
    data: {
      inputSelections: Object.fromEntries(
        legacySoundEffectModel.inputSlots.map(slot => [
          slot.id,
          { mode: 'auto' },
        ]),
      ),
      locked: false,
      modelContractVersion: '2026-07-13.7',
      modelId: legacySoundEffectModel.id,
      operationId: 'textToSoundEffect',
      settings: { durationSeconds: 7.5, loop: true, promptInfluence: 0.3 },
    },
    schemaVersion: 2,
    type: 'audioGeneration',
  })
  const migratedSoundEffectSettings
    = migratedSoundEffect.data.settings as Record<string, unknown>
  if (
    migratedSoundEffect.type !== 'soundEffectGeneration'
    || migratedSoundEffect.data.prompt !== ''
    || migratedSoundEffectSettings.durationMode !== 'custom'
    || migratedSoundEffectSettings.durationSeconds !== 7.5
    || migratedSoundEffectSettings.loop !== true
  ) {
    errors.push(
      'Legacy ElevenLabs sound-effect nodes must migrate compatible settings to the current Sound Effect contract',
    )
  }

  errors.push(
    ...validateGenerationCandidateSelectionSnapshot({
      considered: [
        {
          candidate: {
            assetId: 'asset-selected',
            candidateId: 'candidate-selected',
            mediaType: 'image',
            order: 0,
            origin: { kind: 'asset' },
            slotId: 'references',
          },
          exclusionReasons: [],
          selected: true,
        },
        {
          candidate: {
            assetId: 'asset-excluded',
            candidateId: 'candidate-excluded',
            mediaType: 'image',
            order: 1,
            origin: { kind: 'asset' },
            slotId: 'references',
          },
          exclusionReasons: ['reference_limit'],
          selected: false,
        },
      ],
      selectedInputs: [
        {
          assetId: 'asset-selected',
          candidateId: 'candidate-selected',
          order: 0,
          slotId: 'references',
        },
      ],
    }).map(error => `candidate selection provenance: ${error}`),
  )

  const invalidOrderErrors = validateGenerationCandidateSelectionSnapshot({
    considered: [
      {
        candidate: {
          assetId: 'asset-selected',
          candidateId: 'candidate-selected',
          mediaType: 'image',
          order: 0,
          origin: { kind: 'asset' },
          slotId: 'references',
        },
        exclusionReasons: [],
        selected: true,
      },
    ],
    selectedInputs: [
      {
        assetId: 'asset-selected',
        candidateId: 'candidate-selected',
        order: -1,
        slotId: 'references',
      },
    ],
  })
  if (!invalidOrderErrors.some(error => error.includes('payload order'))) {
    errors.push(
      'Candidate selection validation must reject invalid provider input order',
    )
  }

  return errors
}
