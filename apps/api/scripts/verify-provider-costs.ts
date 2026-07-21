/** Catalog-wide provider-cost formula, metadata, and routing verification. */

import type {
  CatalogModelRecord,
  CatalogProviderBinding,
} from '@talelabs/models-catalog'
import type {
  ProviderCostInputAsset,
  ProviderCostRequest,
} from '@talelabs/providers/server'
import type { PlannedProviderCostNode } from '../src/domain/runs/provider-cost-plan.js'

import assert from 'node:assert/strict'

import {
  getCatalogProviderBindings,
  MODEL_CATALOG_MODELS,
} from '@talelabs/models-catalog'
import {
  estimateProviderCost,
  loadProviderPricingSnapshot,
} from '@talelabs/providers/server'
import { requireCompleteProviderCostEstimate } from '../src/domain/runs/provider-cost-admission.js'
import { resolveProviderCostNodeRouting } from '../src/domain/runs/provider-cost-routing.js'
import { publicRunCostEstimate } from '../src/domain/runs/provider-cost.service.js'
import { HttpError } from '../src/middleware/error.js'

const LIVE = process.argv.includes('--live')
const TEXT_CHARACTER_COUNT = 1000
const IMAGE_ASSET: ProviderCostInputAsset = {
  assetId: 'fixture-image',
  durationSeconds: null,
  height: 1024,
  mediaType: 'image',
  width: 1024,
}
const AUDIO_ASSET: ProviderCostInputAsset = {
  assetId: 'fixture-audio',
  durationSeconds: '30',
  height: null,
  mediaType: 'audio',
  width: null,
}
const EXPECTED_FORMULA_AMOUNTS_USD: Readonly<Record<string, string>> = {
  'fal-duration-seconds-v2': '3.2',
  'fal-flat-generation-unit-v1': '0.1',
  'fal-flat-output-image-v1': '0.1',
  'fal-flux-2-max-megapixel-tiers-v1': '0.13',
  'fal-flux-2-pro-megapixel-tiers-v1': '0.115',
  'fal-generated-audio-minutes-v1': '0.05',
  'fal-input-audio-minutes-v1': '0.05',
  'fal-mai-image-token-estimate-v1': '0.049378',
  'fal-nano-banana-lite-token-estimate-v1': '0.042078125',
  'fal-seedance-fast-video-tokens-v1': '0.6048',
  'fal-seedance-video-tokens-v1': '1.07604',
  'fal-seedream-v5-pro-output-tiers-v1': '0.2',
  'fal-text-thousand-characters-v1': '0.1',
  'openrouter-chat-token-estimate-v1': '0.0031345',
  'openrouter-grok-video-skus-v1': '0.3',
  'openrouter-image-pricing-lines-v2': '0.0336',
  'openrouter-seedance-video-tokens-v1': '0.53802',
  'openrouter-speech-token-estimate-v1': '0.04293',
  'openrouter-video-duration-skus-v1': '0.8',
}

function inputAssetsForOperation(operationId: string): ProviderCostInputAsset[] {
  if (operationId === 'visionToText' || operationId === 'imageToImage')
    return [IMAGE_ASSET]
  if (operationId === 'firstLastFrameToVideo')
    return [IMAGE_ASSET, { ...IMAGE_ASSET, assetId: 'fixture-last-frame' }]
  if (operationId === 'imageToVideo' || operationId === 'referencesToVideo')
    return [IMAGE_ASSET]
  if (operationId === 'changeVoice' || operationId === 'isolateVoice')
    return [AUDIO_ASSET]
  return []
}

function costRequest(input: {
  binding: CatalogProviderBinding
  model: CatalogModelRecord
  settingOverrides?: Readonly<Record<string, boolean | number | string>>
}): ProviderCostRequest {
  const operation = input.model.operations.find(candidate =>
    candidate.id === input.binding.operationId,
  )!
  const settings = Object.fromEntries(input.model.settings.map(setting => [
    setting.id,
    setting.default,
  ])) as Record<string, boolean | number | string>
  Object.assign(settings, input.settingOverrides)
  const outputCount = operation.output.count.settingId
    ? Number(settings[operation.output.count.settingId])
    : operation.output.count.default
  return {
    binding: input.binding,
    hasUnresolvedInputs: false,
    inputAssets: inputAssetsForOperation(input.binding.operationId),
    modelId: input.model.id,
    operationId: input.binding.operationId,
    outputCount,
    settings,
    textCharacterCount: TEXT_CHARACTER_COUNT,
  }
}

function costRequestScenarios(input: {
  binding: CatalogProviderBinding
  model: CatalogModelRecord
}): { label: string, request: ProviderCostRequest }[] {
  const operation = input.model.operations.find(candidate =>
    candidate.id === input.binding.operationId,
  )!
  const scenarios = [{
    label: 'defaults',
    request: costRequest(input),
  }]
  for (const settingId of operation.settingIds) {
    const setting = input.model.settings.find(candidate => candidate.id === settingId)
    if (!setting)
      continue
    const values: (boolean | number | string)[] = setting.kind === 'enum'
      ? setting.options.map(option => option.value)
      : setting.kind === 'boolean'
        ? [false, true]
        : setting.kind === 'number'
          ? [setting.min, setting.default, setting.max]
          : [setting.default]
    for (const value of [...new Set(values)]) {
      scenarios.push({
        label: `${settingId}=${String(value)}`,
        request: costRequest({
          ...input,
          settingOverrides: { [settingId]: value },
        }),
      })
    }
  }
  return scenarios
}

function falUnit(endpointId: string): string {
  if (endpointId.includes('/tts/'))
    return '1000 characters'
  if (endpointId.endsWith('/music') || endpointId.endsWith('/voice-changer') || endpointId.endsWith('/audio-isolation'))
    return 'minutes'
  if (endpointId.includes('/sound-effects/'))
    return 'seconds'
  if (endpointId.includes('flux-2-max/edit') || endpointId.includes('flux-2-pro'))
    return 'processed megapixels'
  if (endpointId.endsWith('flux-2-max'))
    return 'megapixels'
  if (endpointId === 'microsoft/mai-image-2.5')
    return 'compute seconds'
  if (endpointId === 'microsoft/mai-image-2.5/edit')
    return 'credits'
  if (
    endpointId.includes('seedance-2.0')
    || endpointId.includes('seedream/v5/pro')
    || endpointId.includes('hailuo-2.3/pro')
    || endpointId.includes('nano-banana-lite')
  ) {
    return 'units'
  }
  if (
    endpointId.includes('video')
    || endpointId.includes('/wan/')
    || endpointId.startsWith('wan/')
    || endpointId.includes('happy-horse')
    || endpointId.includes('veo3.1')
  ) {
    return 'seconds'
  }
  return 'images'
}

function imagePricing(modelId: string): object[] {
  if (modelId === 'google/gemini-3-pro-image') {
    return [
      { billable: 'input_image', cost_usd: 0.000002, unit: 'token' },
      { billable: 'output_image', cost_usd: 0.00012, unit: 'token' },
    ]
  }
  if (modelId.includes('gemini') || modelId.includes('gpt-image') || modelId.includes('gpt-5.4-image'))
    return [{ billable: 'output_image', cost_usd: 0.00003, unit: 'token' }]
  if (modelId === 'microsoft/mai-image-2.5') {
    return [
      { billable: 'input_text', cost_usd: 0.000005, unit: 'token' },
      { billable: 'input_image', cost_usd: 0.000008, unit: 'token' },
      { billable: 'output_image', cost_usd: 0.000047, unit: 'token' },
    ]
  }
  if (modelId.includes('flux.2'))
    return [{ billable: 'output_image', cost_usd: 0.03, unit: 'megapixel' }]
  if (modelId.includes('grok-imagine-image')) {
    return [
      { billable: 'input_image', cost_usd: 0.01, unit: 'image' },
      { billable: 'output_image', cost_usd: 0.05, unit: 'image', variant: '1k' },
      { billable: 'output_image', cost_usd: 0.07, unit: 'image', variant: '2k' },
    ]
  }
  return [{ billable: 'output_image', cost_usd: 0.04, unit: 'image' }]
}

function videoPricingSkus(): Record<string, string> {
  return {
    cents_per_image_input: '0.2',
    cents_per_video_output_second_480p: '5',
    cents_per_video_output_second_720p: '7',
    duration_seconds: '0.1',
    duration_seconds_1024p: '0.5',
    duration_seconds_1080p: '0.15',
    duration_seconds_480p: '0.04',
    duration_seconds_720p: '0.08',
    duration_seconds_with_audio: '0.12',
    duration_seconds_with_audio_4k: '0.3',
    duration_seconds_with_audio_720p: '0.1',
    duration_seconds_without_audio: '0.1',
    duration_seconds_without_audio_4k: '0.25',
    duration_seconds_without_audio_720p: '0.08',
    image_to_video_duration_seconds_1080p: '0.15',
    image_to_video_duration_seconds_720p: '0.1',
    text_to_video_duration_seconds_1080p: '0.12',
    text_to_video_duration_seconds_480p: '0.04',
    text_to_video_duration_seconds_720p: '0.08',
    video_tokens: '0.000007',
    video_tokens_without_audio: '0.000007',
  }
}

const bindings = MODEL_CATALOG_MODELS.flatMap(model => model.bindings)
const fakeFetch: typeof globalThis.fetch = async (request) => {
  const url = new URL(String(request))
  if (url.hostname === 'api.fal.ai') {
    return Response.json({
      prices: url.searchParams.getAll('endpoint_id').map(endpointId => ({
        currency: 'USD',
        endpoint_id: endpointId,
        unit: falUnit(endpointId),
        unit_price: endpointId.includes('seedance-2.0') ? 0.014 : 0.1,
      })),
    })
  }
  if (url.pathname === '/api/v1/videos/models') {
    return Response.json({
      data: [...new Set(bindings
        .filter(binding => binding.provider === 'openrouter' && binding.protocol === 'video')
        .map(binding => binding.nativeModelId))]
        .map(id => ({ id, pricing_skus: videoPricingSkus() })),
    })
  }
  const imageMatch = /^\/api\/v1\/images\/models\/([^/]+)\/([^/]+)\/endpoints$/.exec(url.pathname)
  if (imageMatch) {
    const modelId = `${decodeURIComponent(imageMatch[1]!)}\/${decodeURIComponent(imageMatch[2]!)}`
    const endpointBindings = bindings.filter(binding =>
      binding.provider === 'openrouter'
      && binding.protocol === 'image'
      && binding.nativeModelId === modelId,
    )
    return Response.json({
      endpoints: endpointBindings.map(binding => ({
        pricing: imagePricing(modelId),
        provider_tag: binding.providerTag,
      })),
    })
  }
  const modelMatch = /^\/api\/v1\/models\/(.+)\/endpoints$/.exec(url.pathname)
  if (modelMatch) {
    const modelId = decodeURIComponent(modelMatch[1]!)
    const endpointBindings = bindings.filter(binding =>
      binding.provider === 'openrouter'
      && (binding.protocol === 'chat' || binding.protocol === 'speech')
      && binding.nativeModelId === modelId,
    )
    return Response.json({
      data: {
        endpoints: endpointBindings.map(binding => ({
          max_completion_tokens: binding.protocol === 'speech' ? 16384 : 65536,
          max_prompt_tokens: null,
          pricing: {
            completion: binding.protocol === 'speech' ? '0.00002' : '0.0000015',
            image: '0.00000025',
            prompt: binding.protocol === 'speech' ? '0.000001' : '0.00000025',
          },
          tag: binding.providerTag,
        })),
      },
    })
  }
  return new Response('not found', { status: 404 })
}

const pricing = await loadProviderPricingSnapshot({
  bindings,
  ...(LIVE ? {} : { fetch: fakeFetch, resolveApiKey: () => 'fixture-key' }),
  now: () => new Date('2026-07-21T12:00:00.000Z'),
})
const failures: string[] = []
const formulaExamples = new Map<string, {
  amountUsd: string
  label: string
}>()
let estimatedBindingCount = 0
let estimatedScenarioCount = 0
for (const model of MODEL_CATALOG_MODELS) {
  for (const binding of model.bindings) {
    let bindingEstimated = true
    for (const scenario of costRequestScenarios({ binding, model })) {
      const estimate = estimateProviderCost({
        pricing,
        request: scenario.request,
      })
      if (estimate.status === 'estimated') {
        estimatedScenarioCount += 1
        if (!formulaExamples.has(estimate.basis.formulaVersion)) {
          formulaExamples.set(estimate.basis.formulaVersion, {
            amountUsd: estimate.amountUsd,
            label: `${model.id}/${binding.operationId}/${binding.provider}/${scenario.label}`,
          })
        }
      }
      else {
        bindingEstimated = false
        failures.push(`${model.id}/${binding.operationId}/${binding.provider}/${binding.nativeModelId}/${scenario.label}: ${estimate.reason}`)
      }
    }
    if (bindingEstimated)
      estimatedBindingCount += 1
  }
}
assert.deepEqual(failures, [])
assert.equal(estimatedBindingCount, bindings.length)
if (!LIVE) {
  assert.deepEqual(
    [...formulaExamples.keys()].toSorted(),
    Object.keys(EXPECTED_FORMULA_AMOUNTS_USD).toSorted(),
  )
  for (const [formulaVersion, expectedAmount] of Object.entries(
    EXPECTED_FORMULA_AMOUNTS_USD,
  )) {
    const example = formulaExamples.get(formulaVersion)
    assert.equal(
      example?.amountUsd,
      expectedAmount,
      `${formulaVersion} returned the wrong USD amount for ${example?.label ?? 'a missing fixture'}`,
    )
  }
  const seedreamModel = MODEL_CATALOG_MODELS.find(
    model => model.id === 'bytedance/seedream-5.0-pro',
  )!
  const seedreamEditBinding = seedreamModel.bindings.find(binding => (
    binding.provider === 'fal' && binding.operationId === 'imageToImage'
  ))!
  const seedreamWithAdditionalInputs = estimateProviderCost({
    pricing,
    request: {
      ...costRequest({
        binding: seedreamEditBinding,
        model: seedreamModel,
      }),
      inputAssets: Array.from({ length: 4 }, (_, index) => ({
        ...IMAGE_ASSET,
        assetId: `fixture-image-${index}`,
      })),
    },
  })
  assert.equal(seedreamWithAdditionalInputs.status, 'estimated')
  if (seedreamWithAdditionalInputs.status === 'estimated')
    assert.equal(seedreamWithAdditionalInputs.amountUsd, '0.2135')
}

const seedanceBindings = getCatalogProviderBindings('bytedance/seedance-2.0', 'textToVideo')
const fal = seedanceBindings.find(binding => binding.provider === 'fal')
const openrouter = seedanceBindings.find(binding => binding.provider === 'openrouter')
assert.ok(fal)
assert.ok(openrouter)
const seedanceModel = MODEL_CATALOG_MODELS.find(model => model.id === 'bytedance/seedance-2.0')!
const request = costRequest({ binding: fal, model: seedanceModel })
const { binding: _seedanceBinding, ...providerNeutralSeedanceRequest } = request
const node: PlannedProviderCostNode = {
  jobs: [{
    jobKey: 'seedance-job',
    request: providerNeutralSeedanceRequest,
  }],
  modelId: seedanceModel.id,
  nodeId: 'seedance-node',
  operationId: 'textToVideo',
}
const managed = resolveProviderCostNodeRouting({
  costEstimationEnabled: true,
  costRoutingEnabled: true,
  eligibleBindings: [fal, openrouter],
  node,
  pricing,
})
assert.equal(managed?.selection.strategy, 'estimated_cost')
const browser = resolveProviderCostNodeRouting({
  costEstimationEnabled: false,
  costRoutingEnabled: false,
  eligibleBindings: [fal, openrouter],
  node,
  pricing,
})
assert.equal(browser?.binding.provider, 'fal')
assert.equal(browser?.estimate.status, 'unavailable')
assert.equal(browser?.jobEstimates.size, 0)
assert.equal(browser?.selection.strategy, 'priority')
const unavailableRoute = resolveProviderCostNodeRouting({
  costEstimationEnabled: true,
  costRoutingEnabled: false,
  eligibleBindings: [fal],
  node,
  pricing: { rates: [], version: 1 },
})
assert.ok(unavailableRoute)
const unavailableRunEstimate = publicRunCostEstimate({
  plannedJobCount: 1,
  routes: new Map([[node.nodeId, unavailableRoute]]),
})
assert.throws(
  () => requireCompleteProviderCostEstimate(unavailableRunEstimate),
  error => error instanceof HttpError
    && error.status === 409
    && error.code === 'run_cost_estimate_unavailable',
)

console.log(
  `Verified ${estimatedBindingCount} catalog bindings across ${estimatedScenarioCount} configuration scenarios${LIVE ? ' against live pricing metadata' : ` and ${formulaExamples.size + 1} exact formula cases covering every family with fake pricing HTTP`}, Credits cost routing, disabled BYOK estimation with priority routing, and the hard Credits admission gate.`,
)
