/**
 * Focused browser-local Create draft compatibility scenario.
 *
 * This proves model transition normalizes historical slot aliases before
 * capacity and detachment decisions. It has no browser, API, or database side
 * effects.
 */

import assert from 'node:assert/strict'

import { getGenerationModel } from '@talelabs/flows'

import {
  CREATE_MODEL_CONTRACT_VERSION,
  createAttachment,
  createEmptyCreateDraft,
} from '../src/features/create/create-draft'
import {
  transitionCreateDraftModel,
} from '../src/features/create/create-resolution'

const empty = createEmptyCreateDraft()
const attachment = createAttachment({
  id: 'compatible-image',
  mimeType: 'image/png',
  name: 'Compatible image',
  processingState: 'ready',
  thumbnailUrl: null,
  type: 'image',
  url: null,
}, 'references')
const historical = {
  ...empty,
  attachments: [attachment],
  modelContractVersion: 'historical-contract',
  prompt: {
    parts: [{
      index: 0,
      mediaType: 'image' as const,
      slotId: 'references',
      type: 'input' as const,
    }],
    version: 1 as const,
  },
}
const model = getGenerationModel(
  empty.modelId,
  CREATE_MODEL_CONTRACT_VERSION,
)
assert.ok(model, 'current default image model')
const transition = transitionCreateDraftModel(historical, model)
assert.ok(transition, 'historical image request remains upgradable')
assert.equal(transition.detachedAttachments.length, 0)
assert.equal(
  transition.draft.attachments[0]?.slotId,
  'imageReferences',
)
const promptInput = transition.draft.prompt.parts[0]
assert.equal(
  promptInput?.type === 'input' ? promptInput.slotId : null,
  'imageReferences',
)
assert.equal(
  transition.draft.modelContractVersion,
  CREATE_MODEL_CONTRACT_VERSION,
)

console.log(
  'Create draft upgrade: compatible attachment and prompt aliases preserved.',
)
