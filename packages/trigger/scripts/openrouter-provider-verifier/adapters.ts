import type { GenerationProviderRoute } from '@talelabs/openrouter'
import type { fakeProvider } from './fake-provider.js'

import assert from 'node:assert/strict'
import { createOpenRouterChatAdapter } from '../../src/generation/adapters/openrouter/chat/adapter.js'
import { createOpenRouterImageAdapter } from '../../src/generation/adapters/openrouter/image/adapter.js'
import { createOpenRouterSpeechAdapter } from '../../src/generation/adapters/openrouter/speech/adapter.js'
import { createOpenRouterVideoAdapter } from '../../src/generation/adapters/openrouter/video/adapter.js'
import { imageInput, resolvedAsset } from './requests.js'
import { pinnedRoute } from './routes.js'

export function adapterFor(
  route: GenerationProviderRoute,
  provider: ReturnType<typeof fakeProvider>,
) {
  const pinned = pinnedRoute(route)
  const profile = route.requestProfile
  if (profile.kind === 'image') {
    return createOpenRouterImageAdapter({
      client: provider.client,
      profile,
      resolveAsset: resolvedAsset,
      route: pinned,
    })
  }
  if (profile.kind === 'video') {
    return createOpenRouterVideoAdapter({
      client: provider.client,
      profile,
      resolveAsset: resolvedAsset,
      route: pinned,
    })
  }
  if (profile.kind === 'speech') {
    return createOpenRouterSpeechAdapter({
      client: provider.client,
      profile,
      route: pinned,
    })
  }
  return createOpenRouterChatAdapter({
    client: provider.client,
    profile,
    resolveAsset: resolvedAsset,
    route: pinned,
  })
}

export function videoInputs(route: GenerationProviderRoute) {
  const profile = route.requestProfile
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
