import assert from 'node:assert/strict'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  generationProviderLifecyclesEqual,
} from '@talelabs/flows'
import { GENERATION_PROVIDER_ROUTES } from '@talelabs/openrouter'
import { resolveGenerationProviderAdapter } from '../../src/generation/adapters/registry.js'
import { adapterFor, videoInputs } from './adapters.js'
import { fakeProvider } from './fake-provider.js'
import { imageInput, providerRequest } from './requests.js'
import { currentRoute, defaultSettings, pinnedRoute } from './routes.js'

export async function verifyCurrentRouteScenarios() {
  const currentRoutes = GENERATION_PROVIDER_ROUTES.filter(
    route => route.modelContractVersion === GENERATION_MODEL_CONTRACT_VERSION
      && route.routingStatus === 'current',
  )
  assert.ok(currentRoutes.length > 0)
  for (const route of currentRoutes) {
    const provider = fakeProvider()
    const adapter = adapterFor(route, provider)
    const orderedInputs = route.requestProfile.kind === 'image'
      ? route.operationId === 'imageToImage' ? [imageInput()] : []
      : route.requestProfile.kind === 'chat'
        ? route.operationId === 'visionToText' ? [imageInput()] : []
        : route.requestProfile.kind === 'video'
          ? videoInputs(route)
          : []
    const submission = await adapter.submit(
      providerRequest({ orderedInputs, route }),
      route.requestProfile.kind === 'video'
        ? { callbackUrl: 'https://api.example.com/provider-callback' }
        : undefined,
    )
    if (submission.status === 'completed') {
      assert.equal(submission.outputs.length, 1)
      assert.equal(submission.outputs[0]?.mediaType, route.outputType)
      if (route.requestProfile.kind === 'speech') {
        const reconciled = await adapter.reconcileFacts?.(submission.facts ?? {})
        assert.equal(reconciled?.providerCostUsd, 0.03)
        assert.equal(
          reconciled?.providerGenerationId,
          'speech-generation-0',
        )
      }
    }
    else {
      assert.equal(route.requestProfile.kind, 'video')
      assert.ok('poll' in adapter && adapter.poll)
      const completion = await adapter.poll(submission.externalJobId)
      assert.equal(completion.status, 'completed')
      if (completion.status === 'completed') {
        assert.equal(completion.outputs[0]?.mediaType, 'video')
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
    if (route.providerRoute.supportedParameters.includes('provider')) {
      assert.deepEqual(provider.bodies[0]?.provider, {
        allow_fallbacks: false,
        only: [route.providerRoute.providerTag],
        ...(route.requestProfile.kind === 'chat'
          ? { require_parameters: true }
          : {}),
      })
    }
    if (route.requestProfile.kind === 'video') {
      assert.equal(
        provider.bodies[0]?.callback_url,
        'https://api.example.com/provider-callback',
      )
    }
    if (
      route.requestProfile.kind === 'chat'
      && route.requestProfile.reasoning
      && defaultSettings(route).reasoningMode === 'off'
    ) {
      assert.deepEqual(provider.bodies[0]?.reasoning, { effort: 'none' })
    }
  }
}

export async function verifyNanoBanana2CanvasRequest() {
  const route = currentRoute('talelabs/nano-banana-2', 'imageToImage')
  assert.equal(route.providerRoute.nativeModelId, 'google/gemini-3.1-flash-image')
  assert.equal(route.providerRoute.endpoint, '/api/v1/images')
  assert.equal(route.requestProfile.kind, 'image')
  if (route.requestProfile.kind !== 'image')
    return
  assert.equal(route.requestProfile.maxReferences, 14)
  const provider = fakeProvider()
  const submission = await adapterFor(route, provider).submit(providerRequest({
    orderedInputs: [imageInput()],
    route,
    settings: { aspectRatio: '16:9', resolution: '4K' },
  }))
  assert.equal(submission.status, 'completed')
  const body = provider.bodies[0]
  assert.equal(body?.model, route.providerRoute.nativeModelId)
  assert.equal(body?.aspect_ratio, '16:9')
  assert.equal(body?.resolution, '4K')
  assert.equal((body?.input_references as unknown[]).length, 1)
  assert.deepEqual(body?.provider, {
    allow_fallbacks: false,
    only: [route.providerRoute.providerTag],
  })
}

export function verifyProductionResolver() {
  for (const route of GENERATION_PROVIDER_ROUTES) {
    const pinned = pinnedRoute(route)
    const resolved = resolveGenerationProviderAdapter({
      ...pinned,
      organizationId: 'organization-verification',
    })
    assert.equal(resolved.route.providerRouteVersion, route.routeVersion)
    assert.equal(
      generationProviderLifecyclesEqual(resolved.adapter.lifecycle, route.lifecycle),
      true,
    )
    assert.equal(
      resolved.requiresDurableSubmissionBoundary,
      route.requiresDurableSubmissionBoundary,
    )
  }
  const route = GENERATION_PROVIDER_ROUTES.find(candidate =>
    candidate.modelContractVersion === GENERATION_MODEL_CONTRACT_VERSION,
  )
  assert.ok(route)
  const pinned = pinnedRoute(route)
  assert.throws(() => resolveGenerationProviderAdapter({
    ...pinned,
    adapterVersion: `${pinned.adapterVersion}-tampered`,
    organizationId: 'organization-verification',
  }), /generation_provider_route_invalid/)
  assert.throws(() => resolveGenerationProviderAdapter({
    ...pinned,
    organizationId: 'organization-verification',
    providerEndpointTag: undefined,
  }), /generation_provider_route_invalid/)
}
