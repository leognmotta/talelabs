/** Fake-HTTP scenarios covering every current OpenRouter catalog binding. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'
import type { CatalogRouteFixture } from './routes.js'

import assert from 'node:assert/strict'
import { generationProviderLifecyclesEqual } from '@talelabs/flows'
import {
  MODEL_CATALOG,
  toBrowserOpenRouterProviderBinding,
} from '@talelabs/models-catalog'
import { createOpenRouterBrowserProviderAdapter } from '@talelabs/providers/browser'
import { resolveGenerationProviderAdapter } from '../../src/generation/adapters/registry.js'
import { adapterFor, videoInputs } from './adapters.js'
import { fakeProvider } from './fake-provider.js'
import { imageInput, providerRequest, resolvedAsset } from './requests.js'
import { currentRoute, currentRoutes, pinnedRoute } from './routes.js'
import { defaultSettings } from './settings.js'

function routeInputs(route: CatalogRouteFixture) {
  const profile = route.binding.requestProfile
  return profile.kind === 'image'
    ? route.operation.id === 'imageToImage' ? [imageInput()] : []
    : profile.kind === 'chat'
      ? route.operation.id === 'visionToText' ? [imageInput()] : []
      : profile.kind === 'video'
        ? videoInputs(route)
        : []
}

async function exerciseRoute(input: {
  adapter: NormalizedGenerationProviderAdapter
  provider: ReturnType<typeof fakeProvider>
  route: CatalogRouteFixture
}) {
  const { adapter, provider, route } = input
  const profile = route.binding.requestProfile
  const submission = await adapter.submit(
    providerRequest({ orderedInputs: routeInputs(route), route }),
    profile.kind === 'video'
      ? { callbackUrl: 'https://api.example.com/provider-callback' }
      : undefined,
  )
  if (submission.status === 'completed') {
    assert.equal(submission.outputs.length, 1)
    assert.equal(submission.outputs[0]?.mediaType, route.model.mediaType)
    if (profile.kind === 'speech') {
      assert.equal(
        submission.facts?.providerGenerationId,
        'speech-generation-0',
      )
      if (adapter.reconcileFacts) {
        const reconciled = await adapter.reconcileFacts(submission.facts ?? {})
        assert.equal(reconciled?.providerCostUsd, 0.03)
        assert.equal(reconciled?.providerGenerationId, 'speech-generation-0')
      }
    }
    if (profile.kind === 'audio') {
      assert.equal(submission.facts?.providerCostUsd, 0.04)
      assert.equal(
        submission.facts?.providerGenerationId,
        'music-generation-0',
      )
      const payload = submission.outputs[0]?.payload
      assert.equal(payload?.delivery, 'bytes')
      if (payload?.delivery === 'bytes') {
        assert.equal(payload.bytes.byteLength, 12)
        assert.equal(payload.mimeType, 'audio/wav')
      }
      assert.deepEqual(provider.bodies[0]?.audio, { format: 'wav' })
      assert.deepEqual(provider.bodies[0]?.modalities, ['text', 'audio'])
      assert.equal(provider.bodies[0]?.stream, true)
      assert.deepEqual(provider.bodies[0]?.stream_options, {
        include_usage: true,
      })
    }
  }
  else {
    assert.equal(profile.kind, 'video')
    assert.ok('poll' in adapter && adapter.poll)
    const completion = await adapter.poll(submission.externalJobId)
    assert.equal(completion.status, 'completed')
    if (completion.status === 'completed') {
      const payload = completion.outputs[0]?.payload
      assert.equal(payload?.delivery, 'stream')
      if (payload?.delivery === 'stream') {
        let streamedBytes = 0
        for await (const chunk of payload.chunks)
          streamedBytes += chunk.byteLength
        assert.equal(streamedBytes, 12)
      }
    }
  }
  if (route.binding.supportedParameters.includes('provider')) {
    assert.deepEqual(provider.bodies[0]?.provider, {
      allow_fallbacks: false,
      only: [route.binding.providerTag],
      ...(profile.kind === 'chat' ? { require_parameters: true } : {}),
    })
  }
  if (profile.kind === 'video') {
    assert.equal(
      provider.bodies[0]?.callback_url,
      'https://api.example.com/provider-callback',
    )
  }
  if (
    profile.kind === 'chat'
    && profile.reasoning
    && defaultSettings(route).reasoningMode === 'off'
  ) {
    assert.deepEqual(provider.bodies[0]?.reasoning, { effort: 'none' })
  }
}

/** Verifies managed and browser request/result behavior for every binding. */
export async function verifyCurrentRouteScenarios() {
  const routes = currentRoutes()
  assert.ok(routes.length > 0)
  for (const route of routes) {
    const managedProvider = fakeProvider()
    await exerciseRoute({
      adapter: adapterFor(route, managedProvider),
      provider: managedProvider,
      route,
    })
    if (route.binding.executionRuntimes.includes('browser')) {
      const browserProvider = fakeProvider()
      const browserAdapter = createOpenRouterBrowserProviderAdapter({
        binding: toBrowserOpenRouterProviderBinding(route.binding),
        credential: {
          provider: 'openrouter',
          resolveApiKey: () => 'verification-key',
        },
        fetch: browserProvider.fetch,
        resolveAsset: resolvedAsset,
      })
      assert.equal(
        generationProviderLifecyclesEqual(
          browserAdapter.lifecycle,
          route.binding.lifecycle,
        ),
        true,
      )
      await exerciseRoute({
        adapter: browserAdapter,
        provider: browserProvider,
        route,
      })
    }
  }
}

/** Verifies the real canvas request shape for the Nano Banana 2 image route. */
export async function verifyNanoBanana2CanvasRequest() {
  const route = currentRoute('google/gemini-3.1-flash-image', 'imageToImage')
  assert.equal(route.binding.nativeModelId, 'google/gemini-3.1-flash-image')
  assert.equal(route.binding.endpoint, '/api/v1/images')
  assert.equal(route.binding.requestProfile.kind, 'image')
  if (route.binding.requestProfile.kind !== 'image')
    return
  assert.equal(route.binding.requestProfile.maxReferences, 14)
  const provider = fakeProvider()
  const submission = await adapterFor(route, provider).submit(providerRequest({
    orderedInputs: [imageInput()],
    route,
    settings: { aspectRatio: '16:9', resolution: '4K' },
  }))
  assert.equal(submission.status, 'completed')
  const body = provider.bodies[0]
  assert.equal(body?.model, route.binding.nativeModelId)
  assert.equal(body?.aspect_ratio, '16:9')
  assert.equal(body?.resolution, '4K')
  assert.equal((body?.input_references as unknown[]).length, 1)
}

/** Verifies production resolution rejects route drift and mutable lookup. */
export function verifyProductionResolver() {
  for (const route of currentRoutes()) {
    const pinned = pinnedRoute(route)
    const resolved = resolveGenerationProviderAdapter({
      ...pinned,
      executionMode: 'live',
      organizationId: 'organization-verification',
      runtimeCredential: {
        provider: 'openrouter',
        resolveApiKey: () => 'verification-key',
      },
    })
    assert.equal(resolved.route.providerRouteVersion, route.binding.routeVersion)
    assert.equal(
      generationProviderLifecyclesEqual(
        resolved.adapter.lifecycle,
        route.binding.lifecycle,
      ),
      true,
    )
    assert.equal(
      resolved.requiresDurableSubmissionBoundary,
      route.binding.requiresDurableSubmissionBoundary,
    )
  }
  const route = currentRoutes()[0]
  assert.ok(route)
  const pinned = pinnedRoute(route)
  assert.throws(() => resolveGenerationProviderAdapter({
    ...pinned,
    adapterVersion: `${pinned.adapterVersion}-tampered`,
    executionMode: 'live',
    organizationId: 'organization-verification',
  }), /generation_provider_route_invalid/)
  assert.throws(() => resolveGenerationProviderAdapter({
    ...pinned,
    catalogVersion: MODEL_CATALOG.catalogVersion,
    executionMode: 'live',
    organizationId: 'organization-verification',
    providerEndpointTag: 'tampered',
  }), /generation_provider_route_invalid/)
}
