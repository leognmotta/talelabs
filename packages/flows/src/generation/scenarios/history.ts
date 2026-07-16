import { parseAndUpcastFlowNodeData } from '../../nodes/registry/index.js'
import {
  GENERATION_MODEL_CONTRACTS,
  getGenerationInputSlotsForNodeType,
  validateGenerationCandidateSelectionSnapshot,
} from '../registry/index.js'

const legacyGptImage2
  = GENERATION_MODEL_CONTRACTS['2026-07-13.3']['talelabs/gpt-image-2']
const legacySeedance20
  = GENERATION_MODEL_CONTRACTS['2026-07-13.3']['talelabs/seedance-2.0']
const legacyClaudeSonnet46
  = GENERATION_MODEL_CONTRACTS['2026-07-13.7']['talelabs/claude-sonnet-4.6']

export function validateGenerationHistoryCapabilityScenarios() {
  const errors: string[] = []
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

  const legacySpeechModel
    = GENERATION_MODEL_CONTRACTS['2026-07-13.7'][
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
    !== '2026-07-15.14'
  ) {
    errors.push(
      'Legacy ElevenLabs text-to-speech nodes must migrate to the retained Speech contract',
    )
  }

  const legacySoundEffectModel
    = GENERATION_MODEL_CONTRACTS['2026-07-13.7'][
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
  const migratedSoundEffectSettings = migratedSoundEffect.data
    .settings as Record<string, unknown>
  if (
    migratedSoundEffect.type !== 'soundEffectGeneration'
    || migratedSoundEffect.data.prompt !== ''
    || migratedSoundEffectSettings.durationMode !== 'custom'
    || migratedSoundEffectSettings.durationSeconds !== 7.5
    || migratedSoundEffectSettings.loop !== true
  ) {
    errors.push(
      'Legacy ElevenLabs sound-effect nodes must migrate compatible settings to the retained Sound Effect contract',
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
