import assert from 'node:assert/strict'

import { inspectStagedProviderObject } from '../src/flow-runs/execution/provider-results/storage-recovery.js'

const descriptor = {
  mimeType: 'video/mp4',
  storageBucket: 'generated-output',
  storageKey: 'organizations/test/assets/recoverable.mp4',
}

assert.equal(await inspectStagedProviderObject(
  descriptor,
  async () => ({
    $metadata: {},
    ContentLength: 42,
    ContentType: 'video/mp4',
  }),
), true)

assert.equal(await inspectStagedProviderObject(
  descriptor,
  async () => {
    throw Object.assign(new Error('missing'), {
      $metadata: { httpStatusCode: 404 },
      name: 'NotFound',
    })
  },
), false)

await assert.rejects(
  inspectStagedProviderObject(
    descriptor,
    async () => ({
      $metadata: {},
      ContentLength: 0,
      ContentType: 'video/mp4',
    }),
  ),
  /generation_provider_checkpoint_object_invalid/,
)

await assert.rejects(
  inspectStagedProviderObject(
    descriptor,
    async () => ({
      $metadata: {},
      ContentLength: 42,
      ContentType: 'application/octet-stream',
    }),
  ),
  /generation_provider_checkpoint_object_invalid/,
)

console.log('Provider output recovery verification passed.')
