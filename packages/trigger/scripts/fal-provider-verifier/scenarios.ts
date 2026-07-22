/** Fake-HTTP scenarios covering every current managed and browser fal binding. */

import type { NormalizedGenerationProviderAdapter } from '@talelabs/flows'

import assert from 'node:assert/strict'

import { generationProviderLifecyclesEqual } from '@talelabs/flows'
import {
  toBrowserFalProviderBinding,
  validateFalBindingCompatibility,
} from '@talelabs/models-catalog'
import {
  createFalBrowserProviderAdapter,
  createFalProviderAdapter,
} from '@talelabs/providers/core'
import {
  GenerationProviderError,
} from '@talelabs/providers/server'
import { runGenerationProviderLifecycle } from '../../src/generation/adapters/lifecycle/runner.js'
import { resolveGenerationProviderAdapter } from '../../src/generation/adapters/registry.js'
import {
  mediaInput,
  providerRequest,
  resolvedAsset,
} from '../openrouter-provider-verifier/requests.js'
import { defaultSettings } from '../openrouter-provider-verifier/settings.js'
import { fakeFalProvider } from './fake-provider.js'
import { currentFalRoutes, pinnedFalRoute } from './routes.js'

function exercisedInputMappings(
  route: ReturnType<typeof currentFalRoutes>[number],
) {
  const omittedSlotIds = new Set<string>()
  for (const contract of Object.values(route.operation.inputs)) {
    for (const slotId of contract.oneOf?.slice(1) ?? [])
      omittedSlotIds.add(slotId)
  }
  return route.binding.requestProfile.inputMappings.filter(
    mapping => !omittedSlotIds.has(mapping.targetSlotId),
  )
}

function exercisedOrderedInputs(
  route: ReturnType<typeof currentFalRoutes>[number],
) {
  return exercisedInputMappings(route).map(
    mapping => mediaInput(mapping.targetSlotId, mapping.mediaType),
  )
}

async function exerciseQueueLifecycle(
  adapter: NormalizedGenerationProviderAdapter,
  route: ReturnType<typeof currentFalRoutes>[number],
  input: {
    outputCount?: number
    settings?: Record<string, boolean | number | string>
  } = {},
) {
  const orderedInputs = exercisedOrderedInputs(route)
  const outputCount = input.outputCount ?? 1
  const submission = await adapter.submit(
    providerRequest({
      orderedInputs,
      outputCount,
      route,
      ...(input.settings ? { settings: input.settings } : {}),
    }),
  )
  assert.equal(submission.status, 'submitted')
  if (submission.status !== 'submitted')
    return
  assert.match(submission.externalJobId, /^fal-request-/)
  assert.ok(adapter.poll)
  const completion = await adapter.poll(submission.externalJobId)
  assert.equal(completion.status, 'completed')
  if (completion.status === 'completed') {
    assert.equal(completion.outputs.length, outputCount)
    const payload = completion.outputs[0]?.payload
    assert.equal(payload?.delivery, 'stream')
    if (payload?.delivery === 'stream') {
      let streamedBytes = 0
      for await (const chunk of payload.chunks)
        streamedBytes += chunk.byteLength
      assert.equal(streamedBytes, 4)
    }
  }
  assert.ok(adapter.cancel)
  assert.deepEqual(await adapter.cancel(submission.externalJobId), {
    accepted: true,
    final: false,
  })
}

function assertInferenceHeaders(
  call: ReturnType<typeof fakeFalProvider>['calls'][number] | undefined,
) {
  assert.ok(call)
  assert.equal(call.headers['x-app-fal-disable-fallback'], 'true')
  assert.equal(call.headers['x-fal-store-io'], '0')
  assert.deepEqual(
    JSON.parse(call.headers['x-fal-object-lifecycle-preference'] ?? ''),
    {
      expiration_duration_seconds: 9 * 60 * 60,
    },
  )
}

function assertRequestShape(
  route: ReturnType<typeof currentFalRoutes>[number],
  body: Record<string, unknown> | null,
  outputCount = 1,
  settings = defaultSettings(route),
) {
  assert.ok(body)
  const profile = route.binding.requestProfile
  const expected: Record<string, unknown> = {
    ...profile.staticParams,
  }
  if (profile.promptField)
    expected[profile.promptField] = 'A safe verification prompt.'
  for (const param of profile.params) {
    if (
      param.sendWhen
      && settings[param.sendWhen.settingId] !== param.sendWhen.equals
    ) {
      continue
    }
    const value = settings[param.settingId]
    assert.notEqual(value, undefined)
    expected[param.field] = param.valueMap?.[String(value)]
      ?? (param.numberMultiplier === undefined
        ? value
        : Number(value) * param.numberMultiplier)
  }
  for (const param of profile.combinedParams) {
    const [firstSettingId, secondSettingId] = param.settingIds
    const first = settings[firstSettingId]
    const second = settings[secondSettingId]
    assert.notEqual(first, undefined)
    assert.notEqual(second, undefined)
    const value = param.valueMap[String(first)]?.[String(second)]
    assert.notEqual(value, undefined)
    expected[param.field] = value
  }
  if (profile.kind === 'image' && profile.requestedCountField)
    expected[profile.requestedCountField] = outputCount
  for (const mapping of exercisedInputMappings(route)) {
    const url = `https://signed.invalid/asset-${mapping.mediaType}-${mapping.targetSlotId}`
    expected[mapping.field] = mapping.cardinality === 'single' ? url : [url]
  }
  assert.deepEqual(body, expected)
}

function falMediaType(route: ReturnType<typeof currentFalRoutes>[number]) {
  return route.binding.requestProfile.kind === 'video'
    ? ('video' as const)
    : route.binding.requestProfile.kind === 'speech'
      ? ('audio' as const)
      : ('image' as const)
}

/** Verifies resolver identity and managed/browser queue behavior for all routes. */
export async function verifyFalProviderAdapters() {
  const routes = currentFalRoutes()
  assert.ok(routes.length > 0)
  for (const route of routes) {
    const pinned = pinnedFalRoute(route)
    const resolved = resolveGenerationProviderAdapter({
      ...pinned,
      executionMode: 'live',
      organizationId: 'organization-verification',
      runtimeCredential: {
        provider: 'fal',
        resolveApiKey: () => 'verification-key',
      },
    })
    assert.equal(
      generationProviderLifecyclesEqual(
        resolved.adapter.lifecycle,
        route.binding.lifecycle,
      ),
      true,
    )

    const managedProvider = fakeFalProvider({ mediaType: falMediaType(route) })
    await exerciseQueueLifecycle(
      createFalProviderAdapter({
        binding: route.binding,
        client: managedProvider.client,
        resolveAsset: resolvedAsset,
      }),
      route,
    )
    const managedSubmission = managedProvider.calls.find(
      call => call.method === 'POST',
    )
    assertRequestShape(route, managedSubmission?.body ?? null)
    assertInferenceHeaders(managedSubmission)
    assert.ok(
      managedProvider.calls.some(
        call => call.method === 'GET' && call.url.endsWith('/status'),
      ),
    )
    assert.ok(
      managedProvider.calls.some(
        call => call.method === 'PUT' && call.url.endsWith('/cancel'),
      ),
    )

    const browserProvider = fakeFalProvider({ mediaType: falMediaType(route) })
    await exerciseQueueLifecycle(
      createFalBrowserProviderAdapter({
        binding: toBrowserFalProviderBinding(route.binding),
        credential: {
          provider: 'fal',
          resolveApiKey: () => 'verification-key',
        },
        fetch: browserProvider.fetch,
        resolveAsset: resolvedAsset,
      }),
      route,
    )
    const browserSubmission = browserProvider.calls.find(
      call => call.method === 'POST',
    )
    assertRequestShape(route, browserSubmission?.body ?? null)
    assertInferenceHeaders(browserSubmission)
  }
  return routes.length
}

/** Verifies accepted Fal cancellation remains non-terminal until reconciliation. */
export async function verifyFalCancellationSemantics() {
  const route = currentFalRoutes()[0]
  assert.ok(route)
  const createAdapter = (
    cancelResponse: 'already_completed' | 'invalid' | 'not_found' | 'requested',
  ) => {
    const provider = fakeFalProvider({ cancelResponse })
    return {
      adapter: createFalProviderAdapter({
        binding: route.binding,
        client: provider.client,
        resolveAsset: resolvedAsset,
      }),
      provider,
    }
  }

  const requested = createAdapter('requested')
  assert.ok(requested.adapter.cancel)
  assert.deepEqual(await requested.adapter.cancel('fal-request-requested'), {
    accepted: true,
    final: false,
  })

  const completed = createAdapter('already_completed')
  assert.ok(completed.adapter.cancel)
  assert.deepEqual(await completed.adapter.cancel('fal-request-completed'), {
    accepted: false,
    final: true,
  })

  const missing = createAdapter('not_found')
  assert.ok(missing.adapter.cancel)
  assert.deepEqual(await missing.adapter.cancel('fal-request-missing'), {
    accepted: false,
    final: true,
  })

  const invalid = createAdapter('invalid')
  assert.ok(invalid.adapter.cancel)
  const cancelInvalid = invalid.adapter.cancel
  await assert.rejects(
    () => cancelInvalid('fal-request-invalid'),
    (error: unknown) =>
      (error as { code?: string }).code === 'provider_rejected',
  )
}

/** Proves managed cancellation invokes Fal once and then continues polling. */
export async function verifyFalManagedCancellationLifecycle() {
  const route = currentFalRoutes()[0]
  assert.ok(route)
  const provider = fakeFalProvider({
    queueStatuses: [
      { status: 'IN_PROGRESS' },
      { status: 'COMPLETED' },
    ],
  })
  const adapter = createFalProviderAdapter({
    binding: route.binding,
    client: provider.client,
    resolveAsset: resolvedAsset,
  })
  let submitted = false
  const result = await runGenerationProviderLifecycle({
    beforeSubmit: async () => undefined,
    isCancellationRequested: async () => submitted,
    onSubmitted: async () => {
      submitted = true
    },
    request: providerRequest({
      orderedInputs: exercisedOrderedInputs(route),
      route,
    }),
    resolvedAdapter: {
      adapter,
      requiresDurableSubmissionBoundary: true,
      route: pinnedFalRoute(route),
    },
    waitForPoll: async () => false,
  })
  assert.equal(result.outputs.length, 1)
  assert.equal(
    provider.calls.filter(call => call.method === 'PUT').length,
    1,
  )
  assert.equal(
    provider.calls.filter(call => call.url.endsWith('/status')).length,
    2,
  )

  const resumedProvider = fakeFalProvider()
  const resumedGenerationId = 'fal-request-resumed'
  const resumed = await runGenerationProviderLifecycle({
    providerSubmittedAt: new Date(),
    request: providerRequest({
      orderedInputs: exercisedOrderedInputs(route),
      route,
    }),
    resolvedAdapter: {
      adapter: createFalProviderAdapter({
        binding: route.binding,
        client: resumedProvider.client,
        resolveAsset: resolvedAsset,
      }),
      requiresDurableSubmissionBoundary: true,
      route: pinnedFalRoute(route),
    },
    resumeExternalJobId: resumedGenerationId,
    resumeFacts: { providerGenerationId: resumedGenerationId },
    waitForPoll: async () => false,
  })
  assert.equal(
    resumed.facts.providerGenerationId,
    resumedGenerationId,
  )
  assert.equal(
    resumedProvider.calls.some(call => call.method === 'POST'),
    false,
  )
}

/** Verifies Fal terminal error types preserve retryability through the worker. */
export async function verifyFalTerminalErrorClassification() {
  const route = currentFalRoutes()[0]
  assert.ok(route)
  const provider = fakeFalProvider({
    queueStatuses: [{
      error: 'The runner disconnected.',
      error_type: 'runner_disconnected',
      status: 'COMPLETED',
    }],
  })
  const adapter = createFalProviderAdapter({
    binding: route.binding,
    client: provider.client,
    resolveAsset: resolvedAsset,
  })
  await assert.rejects(
    runGenerationProviderLifecycle({
      beforeSubmit: async () => undefined,
      request: providerRequest({
        orderedInputs: exercisedOrderedInputs(route),
        route,
      }),
      resolvedAdapter: {
        adapter,
        requiresDurableSubmissionBoundary: true,
        route: pinnedFalRoute(route),
      },
      waitForPoll: async () => false,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderError
      && error.code === 'provider_unavailable'
      && error.retryable,
  )
  assert.equal(
    provider.calls.some(call => /\/requests\/[^/]+$/.test(new URL(call.url).pathname)),
    false,
  )
}

/** Verifies Seedream 5 combined dimensions, safety, and six-output requests. */
export async function verifySeedream5RequestProfiles() {
  const routes = currentFalRoutes().filter(
    route =>
      route.model.id === 'bytedance/seedream-5.0-lite'
      || route.model.id === 'bytedance/seedream-5.0-pro',
  )
  assert.equal(routes.length, 4)
  for (const route of routes) {
    const settings = { ...defaultSettings(route), outputCount: 6 }
    const provider = fakeFalProvider({ mediaType: 'image', outputCount: 6 })
    await exerciseQueueLifecycle(
      createFalProviderAdapter({
        binding: route.binding,
        client: provider.client,
        resolveAsset: resolvedAsset,
      }),
      route,
      { outputCount: 6, settings },
    )
    const submission = provider.calls.find(call => call.method === 'POST')
    assertRequestShape(route, submission?.body ?? null, 6, settings)
    assert.equal(submission?.body?.num_images, 6)
    assert.equal(typeof submission?.body?.image_size, 'object')
    assert.equal(submission?.body?.enable_safety_checker, true)
    if (route.model.id.endsWith('-lite'))
      assert.equal(submission?.body?.max_images, 1)
    else assert.equal(submission?.body?.output_format, 'jpeg')
  }
}

async function rejectionCode(status: number) {
  const route = currentFalRoutes()[0]
  assert.ok(route)
  const provider = fakeFalProvider({ submissionStatus: status })
  const adapter = createFalProviderAdapter({
    binding: route.binding,
    client: provider.client,
    resolveAsset: resolvedAsset,
  })
  try {
    await adapter.submit(providerRequest({ route }))
    assert.fail('Expected fal submission to reject.')
  }
  catch (error) {
    return error as {
      code?: string
      publicMessage?: null | string
      safeToResubmit?: boolean
    }
  }
}

/** Verifies fal authentication and validation failures use the shared boundary. */
export async function verifyFalErrorNormalization() {
  const authentication = await rejectionCode(401)
  assert.equal(authentication.code, 'provider_authentication')
  assert.equal(authentication.safeToResubmit, true)
  assert.equal(
    authentication.publicMessage?.includes('verification-secret'),
    false,
  )
  assert.match(authentication.publicMessage ?? '', /\[redacted\]/)

  const insufficientBalance = await rejectionCode(403)
  assert.equal(insufficientBalance.code, 'provider_insufficient_balance')
  assert.equal(insufficientBalance.safeToResubmit, true)

  const validation = await rejectionCode(422)
  assert.equal(validation.code, 'provider_rejected')
  assert.equal(validation.safeToResubmit, true)
  assert.equal(validation.publicMessage, 'The prompt is invalid.')
}

/** Proves fal rejects unmapped slots and wrong media before any submission. */
export async function verifyFalInputMappingBoundary() {
  const route = currentFalRoutes().find(
    candidate => candidate.operation.id === 'imageToImage',
  )
  assert.ok(route)
  const provider = fakeFalProvider({ mediaType: falMediaType(route) })
  const adapter = createFalProviderAdapter({
    binding: route.binding,
    client: provider.client,
    resolveAsset: resolvedAsset,
  })
  await assert.rejects(
    () =>
      adapter.submit(
        providerRequest({
          orderedInputs: [mediaInput('unmappedReference', 'image')],
          route,
        }),
      ),
    (error: unknown) =>
      (error as { code?: string }).code === 'provider_response_invalid',
  )
  const wrongMediaInput = mediaInput('imageReferences', 'image')
  await assert.rejects(
    () =>
      adapter.submit(
        providerRequest({
          orderedInputs: [
            {
              ...wrongMediaInput,
              items: [
                {
                  ...wrongMediaInput.items[0]!,
                  assets: [
                    { assetId: 'asset-video', mediaType: 'video', order: 0 },
                  ],
                },
              ],
            },
          ],
          route,
        }),
      ),
    (error: unknown) =>
      (error as { code?: string }).code === 'provider_response_invalid',
  )
  assert.equal(
    provider.calls.some(call => call.method === 'POST'),
    false,
  )

  const profile = route.binding.requestProfile
  assert.equal(profile.kind, 'image')
  if (profile.kind !== 'image')
    return
  const narrowedBinding = {
    ...route.binding,
    requestProfile: {
      ...profile,
      inputMappings: profile.inputMappings.map(mapping => ({
        ...mapping,
        maxItems: Math.max(1, mapping.maxItems - 1),
      })),
    },
  }
  assert.ok(
    validateFalBindingCompatibility(route.model, narrowedBinding).some(
      error => error.includes('accepted item limit'),
    ),
  )
}

/** Verifies fal's two reviewed output host families and rejects Google drift. */
export async function verifyFalMediaTransportBoundary() {
  const provider = fakeFalProvider()
  const accepted = await provider.client.requestMediaStream({
    url: 'https://storage.googleapis.com/falserverless/verification/output.png',
  })
  let acceptedBytes = 0
  for await (const chunk of accepted.value) acceptedBytes += chunk.byteLength
  assert.equal(acceptedBytes, 4)
  assert.ok(
    provider.calls.some(call =>
      call.url.includes(
        '/download/storage/v1/b/falserverless/o/verification%2Foutput.png?alt=media',
      ),
    ),
  )
  await assert.rejects(
    () =>
      provider.client.requestMediaStream({
        url: 'https://storage.googleapis.com/unrelated/output.png',
      }),
    (error: unknown) => (error as { code?: string }).code === 'rejected',
  )
}
