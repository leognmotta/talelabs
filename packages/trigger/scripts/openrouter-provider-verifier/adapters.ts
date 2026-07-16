/** Production-adapter fixtures backed by deterministic fake OpenRouter transport. */

import type { fakeProvider } from './fake-provider.js'
import type { CatalogRouteFixture } from './routes.js'

import assert from 'node:assert/strict'
import { createOpenRouterProviderAdapter } from '@talelabs/providers/server'
import { imageInput, resolvedAsset } from './requests.js'

/** Creates the production OpenRouter adapter wired to one fake transport. */
export function adapterFor(
  route: CatalogRouteFixture,
  provider: ReturnType<typeof fakeProvider>,
) {
  return createOpenRouterProviderAdapter({
    binding: route.binding,
    client: provider.client,
    resolveAsset: resolvedAsset,
  })
}

/** Builds the minimum valid video inputs required by one catalog profile. */
export function videoInputs(route: CatalogRouteFixture) {
  const profile = route.binding.requestProfile
  assert.equal(profile.kind, 'video')
  if (profile.kind !== 'video')
    return []
  if (profile.frameMode === 'first')
    return [imageInput('firstFrame')]
  if (profile.frameMode === 'first-last') {
    return [
      imageInput('firstFrame'),
      { ...imageInput('lastFrame'), edgeId: 'edge-last', order: 1 },
    ]
  }
  if (Object.values(profile.referenceLimits).some(Boolean))
    return [imageInput('imageReferences')]
  return []
}
