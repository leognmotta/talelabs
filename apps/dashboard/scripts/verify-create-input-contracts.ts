/**
 * Focused Create parity checks for every direct-generation node intent.
 *
 * These scenarios exercise the shared catalog resolvers through the Create
 * draft reducer without a browser, API, provider request, or database write.
 */

import type { CreateAssetReference, CreateDraft } from '../src/features/create/create-draft'

import assert from 'node:assert/strict'

import {
  getGenerationModel,
  getGenerationModelsForNodeType,
} from '@talelabs/flows'

import {
  CREATE_AUDIO_INTENTS,
  CREATE_MODEL_CONTRACT_VERSION,
  createAttachment,
  createEmptyCreateDraft,
  createNodeType,
  resetCreateDraftMode,
} from '../src/features/create/create-draft'
import {
  createDraftReducer,
} from '../src/features/create/create-draft-reducer'
import {
  createInputSlotAssetTypes,
  resolveCreateDraft,
  selectCreateDraftModel,
} from '../src/features/create/create-resolution'

function asset(
  id: string,
  type: CreateAssetReference['type'],
): CreateAssetReference {
  return {
    id,
    mimeType: type === 'image'
      ? 'image/png'
      : type === 'video'
        ? 'video/mp4'
        : 'audio/mpeg',
    name: id,
    processingState: 'ready',
    thumbnailUrl: null,
    type,
    url: null,
  }
}

function selectModel(draft: CreateDraft, modelId: string) {
  const model = getGenerationModel(modelId, CREATE_MODEL_CONTRACT_VERSION)
  assert.ok(model, `${modelId} is available in the current catalog`)
  const selected = selectCreateDraftModel(draft, model)
  assert.ok(selected, `${modelId} accepts the empty intent draft`)
  return selected
}

function add(
  draft: CreateDraft,
  input: {
    assetId: string
    mimeType?: string
    slotId: string
    type: CreateAssetReference['type']
  },
) {
  const reference = asset(input.assetId, input.type)
  return createDraftReducer(
    { draft, notice: null },
    {
      attachment: createAttachment(
        {
          ...reference,
          mimeType: input.mimeType ?? reference.mimeType,
        },
        input.slotId,
      ),
      type: 'addAttachment',
    },
  ).draft
}

function slotAsset(
  id: string,
  slot: ReturnType<typeof resolveCreateDraft>['slots'][number],
) {
  const type = createInputSlotAssetTypes(slot)[0]
  assert.ok(type, `${slot.id} accepts one Create media type`)
  return {
    assetId: id,
    mimeType: slot.acceptedMedia?.mimeTypes[0],
    slotId: slot.id,
    type,
  }
}

const empty = createEmptyCreateDraft()

const imageDraft = selectModel(empty, 'recraft/recraft-v4.1')
const imageWithReference = add(imageDraft, {
  assetId: 'image-reference',
  slotId: 'imageReferences',
  type: 'image',
})
assert.equal(imageWithReference.attachments.length, 1)
assert.equal(
  resolveCreateDraft(imageWithReference)
    .inputAvailability
    .imageReferences
    ?.state,
  'full',
)
assert.equal(
  add(imageWithReference, {
    assetId: 'second-image-reference',
    slotId: 'imageReferences',
    type: 'image',
  }).attachments.length,
  1,
)

const videoDraft = selectModel(
  resetCreateDraftMode(empty, 'video'),
  'bytedance/seedance-2.0',
)
const videoWithReference = add(videoDraft, {
  assetId: 'video-image-reference',
  slotId: 'imageReferences',
  type: 'image',
})
const referenceResolution = resolveCreateDraft(videoWithReference)
assert.equal(referenceResolution.inputAvailability.firstFrame?.state, 'blocked')
assert.equal(referenceResolution.inputAvailability.lastFrame?.state, 'blocked')
assert.equal(
  add(videoWithReference, {
    assetId: 'blocked-first-frame',
    slotId: 'firstFrame',
    type: 'image',
  }).attachments.length,
  1,
)

const videoWithFrame = add(videoDraft, {
  assetId: 'first-frame',
  slotId: 'firstFrame',
  type: 'image',
})
const frameResolution = resolveCreateDraft(videoWithFrame)
for (const slotId of [
  'imageReferences',
  'videoReferences',
  'audioReferences',
]) {
  assert.equal(frameResolution.inputAvailability[slotId]?.state, 'blocked')
}
assert.equal(frameResolution.inputAvailability.lastFrame?.state, 'available')

let videoAtReferenceLimit = videoDraft
for (let index = 0; index < 9; index += 1) {
  videoAtReferenceLimit = add(videoAtReferenceLimit, {
    assetId: `image-reference-${index}`,
    slotId: 'imageReferences',
    type: 'image',
  })
}
for (let index = 0; index < 3; index += 1) {
  videoAtReferenceLimit = add(videoAtReferenceLimit, {
    assetId: `video-reference-${index}`,
    slotId: 'videoReferences',
    type: 'video',
  })
}
assert.equal(
  resolveCreateDraft(videoAtReferenceLimit)
    .inputAvailability
    .audioReferences
    ?.state,
  'full',
)
assert.equal(
  add(videoAtReferenceLimit, {
    assetId: 'over-combined-reference-limit',
    slotId: 'audioReferences',
    type: 'audio',
  }).attachments.length,
  12,
)

for (const audioIntent of CREATE_AUDIO_INTENTS.slice(0, 3)) {
  const draft = resetCreateDraftMode(empty, 'audio', audioIntent)
  const resolution = resolveCreateDraft(draft)
  const mediaSlots = resolution.slots.filter(
    slot => createInputSlotAssetTypes(slot).length > 0,
  )
  assert.deepEqual(
    mediaSlots,
    [],
    `${audioIntent} remains a prompt-only Create intent`,
  )
}

const voiceChanger = resetCreateDraftMode(
  empty,
  'audio',
  'voiceChanger',
)
const voiceChangerWithSource = add(voiceChanger, {
  assetId: 'voice-source',
  slotId: 'sourceMedia',
  type: 'audio',
})
assert.equal(
  resolveCreateDraft(voiceChangerWithSource)
    .inputAvailability
    .sourceMedia
    ?.state,
  'full',
)
assert.equal(
  add(voiceChangerWithSource, {
    assetId: 'second-voice-source',
    slotId: 'sourceMedia',
    type: 'audio',
  }).attachments.length,
  1,
)

const voiceIsolation = resetCreateDraftMode(
  empty,
  'audio',
  'voiceIsolation',
)
const isolationWithAudio = add(voiceIsolation, {
  assetId: 'isolation-audio',
  slotId: 'sourceAudio',
  type: 'audio',
})
const isolationResolution = resolveCreateDraft(isolationWithAudio)
assert.equal(isolationResolution.inputAvailability.sourceAudio?.state, 'full')
assert.equal(isolationResolution.inputAvailability.sourceVideo?.state, 'blocked')
assert.equal(
  add(isolationWithAudio, {
    assetId: 'blocked-isolation-video',
    slotId: 'sourceVideo',
    type: 'video',
  }).attachments.length,
  1,
)

const intentDrafts = [
  resetCreateDraftMode(empty, 'image'),
  resetCreateDraftMode(empty, 'video'),
  ...CREATE_AUDIO_INTENTS.map(
    intent => resetCreateDraftMode(empty, 'audio', intent),
  ),
]
let checkedModels = 0
let checkedMediaSlots = 0
for (const intentDraft of intentDrafts) {
  const nodeType = createNodeType(
    intentDraft.mode,
    intentDraft.audioIntent,
  )
  for (const model of getGenerationModelsForNodeType(nodeType)) {
    const selected = selectCreateDraftModel(intentDraft, model)
    assert.ok(selected, `${model.id} accepts its empty ${nodeType} draft`)
    const emptyResolution = resolveCreateDraft(selected)
    const mediaSlots = emptyResolution.slots.filter(
      slot => createInputSlotAssetTypes(slot).length > 0,
    )
    checkedModels += 1
    checkedMediaSlots += mediaSlots.length
    for (const slot of mediaSlots) {
      assert.equal(
        emptyResolution.inputAvailability[slot.id]?.state,
        'available',
        `${model.id}:${slot.id} starts available`,
      )
      const withInput = add(
        selected,
        slotAsset(`${model.id}:${slot.id}:primary`, slot),
      )
      assert.equal(
        withInput.attachments.length,
        1,
        `${model.id}:${slot.id} accepts compatible media`,
      )
      const withInputResolution = resolveCreateDraft(withInput)
      for (const sibling of mediaSlots) {
        const availability = withInputResolution
          .inputAvailability[sibling.id]
        assert.ok(
          availability,
          `${model.id}:${sibling.id} exposes shared availability`,
        )
        const attempted = add(
          withInput,
          slotAsset(
            `${model.id}:${slot.id}:${sibling.id}:secondary`,
            sibling,
          ),
        )
        const accepted = availability.state === 'available'
          || availability.state === 'connected'
        assert.equal(
          attempted.attachments.length,
          accepted ? 2 : 1,
          `${model.id}:${slot.id} -> ${sibling.id} `
          + `follows ${availability.state}`,
        )
      }
    }
  }
}

console.log(
  `Create input contracts: ${checkedModels} catalog models, `
  + `${checkedMediaSlots} media slots, and all seven intents passed.`,
)
