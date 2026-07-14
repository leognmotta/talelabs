import type {
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationProviderLifecycle,
  GenerationSettingDefinition,
} from '@talelabs/flows'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'

import {
  GENERATION_MODEL_CONTRACT_VERSION,
  GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_1,
  GENERATION_MODEL_REGISTRY,
  getActiveGenerationSettings,
  validateGenerationCapabilityScenarios,
  validateGenerationProviderLifecycle,
  validateHardenedGenerationRegistry,
} from '@talelabs/flows'
import { z } from 'zod'

import { GENERATION_PROVIDER_ROUTES } from '../src/routes/config/generation-provider-routes.js'

const MAXIMUM_EVIDENCE_AGE_MS = 120 * 24 * 60 * 60 * 1000
const ProviderSchema = z.enum([
  'elevenlabs',
  'google-vertex',
  'ltx',
  'openai',
  'openrouter',
  'stability',
])
const OpenRouterVideoInventorySchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  models: z.array(
    z.strictObject({
      canonicalSlug: z.string().min(1),
      generateAudio: z.boolean().nullable(),
      id: z.string().min(1),
      productModelId: z.string().min(1).optional(),
      review: z.enum([
        'direct-route-authoritative',
        'discovered-only',
        'enabled-narrow',
        'superseded',
      ]),
      supportedDurations: z.array(z.number().positive()).min(1),
      supportedFrameImages: z
        .array(z.enum(['first_frame', 'last_frame']))
        .nullable(),
      supportedResolutions: z.array(z.string().min(1)).min(1),
    }),
  ),
  schemaVersion: z.literal(1),
  scope: z.string().min(1),
  source: z.literal('https://openrouter.ai/api/v1/videos/models'),
})
const OpenRouterImageInventorySchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  count: z.literal(39),
  models: z
    .array(
      z.looseObject({
        id: z.string().min(1),
      }),
    )
    .length(39),
  reviewedEndpoints: z.record(
    z.string().min(1),
    z.looseObject({
      endpoints: z.array(z.unknown()).min(1),
      id: z.string().min(1),
    }),
  ),
  schemaVersion: z.literal(1),
  source: z.literal('https://openrouter.ai/api/v1/images/models'),
})
const OpenRouterLlmInventorySchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  models: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        inputModalities: z.array(z.string().min(1)).min(1),
        outputModalities: z.tuple([z.literal('text')]),
        reasoning: z.nullable(
          z.strictObject({
            defaultEffort: z.string().nullable(),
            defaultEnabled: z.boolean(),
            efforts: z.array(z.string().min(1)),
            mandatory: z.boolean(),
          }),
        ),
        supportedParameters: z.array(z.string().min(1)),
      }),
    )
    .length(6),
  schemaVersion: z.literal(1),
  source: z.literal('https://openrouter.ai/api/v1/models'),
})
const OpenRouterAudioInventorySchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }),
  count: z.literal(9),
  documentation: z.tuple([
    z.literal('https://openrouter.ai/docs/guides/overview/multimodal/tts'),
    z.literal(
      'https://openrouter.ai/docs/api/api-reference/speech/create-audio-speech',
    ),
    z.literal('https://openrouter.ai/docs/guides/overview/multimodal/audio'),
  ]),
  models: z.array(z.strictObject({
    id: z.string().min(1),
    inputModalities: z.tuple([z.literal('text')]),
    name: z.string().min(1),
    outputModalities: z.tuple([z.literal('speech')]),
    review: z.literal('inventory-only'),
  })).length(9),
  schemaVersion: z.literal(1),
  scope: z.string().min(1),
  source: z.literal(
    'https://openrouter.ai/api/v1/models?output_modalities=speech',
  ),
})
const EXPECTED_REVIEWED_OPENROUTER_IMAGE_MODEL_IDS = [
  'black-forest-labs/flux.2-pro',
  'bytedance-seed/seedream-4.5',
  'google/gemini-3-pro-image',
  'google/gemini-3.1-flash-image',
  'google/gemini-3.1-flash-lite-image',
  'openai/gpt-image-2',
  'recraft/recraft-v4.1',
] as const
const EXPECTED_OPENROUTER_LLM_MODEL_IDS = [
  'anthropic/claude-sonnet-4.6',
  'deepseek/deepseek-v3.2',
  'google/gemini-3.1-flash-lite',
  'google/gemini-3.1-pro-preview',
  'mistralai/mistral-large-2512',
  'openai/gpt-5.4',
] as const
const EXPECTED_OPENROUTER_AUDIO_MODEL_IDS = [
  'canopylabs/orpheus-3b-0.1-ft',
  'google/gemini-3.1-flash-tts-preview',
  'hexgrad/kokoro-82m',
  'microsoft/mai-voice-2',
  'mistralai/voxtral-mini-tts-2603',
  'sesame/csm-1b',
  'x-ai/grok-voice-tts-1.0',
  'zyphra/zonos-v0.1-hybrid',
  'zyphra/zonos-v0.1-transformer',
] as const
const EXPECTED_OPENROUTER_VIDEO_MODEL_IDS = [
  'alibaba/happyhorse-1.1',
  'alibaba/happyhorse-1.0',
  'x-ai/grok-imagine-video',
  'kwaivgi/kling-v3.0-pro',
  'kwaivgi/kling-v3.0-std',
  'google/veo-3.1-fast',
  'google/veo-3.1-lite',
  'kwaivgi/kling-video-o1',
  'minimax/hailuo-2.3',
  'bytedance/seedance-2.0',
  'alibaba/wan-2.7',
  'bytedance/seedance-2.0-fast',
  'alibaba/wan-2.6',
  'bytedance/seedance-1-5-pro',
  'openai/sora-2-pro',
  'google/veo-3.1',
] as const
const HttpsUrlSchema = z
  .url()
  .refine(
    value => new URL(value).protocol === 'https:',
    'Evidence URLs must use HTTPS',
  )
const UniqueStringsSchema = z
  .array(z.string().min(1))
  .min(1)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length)
      context.addIssue({ code: 'custom', message: 'Values must be unique' })
  })
const EvidenceSchema = z
  .strictObject({
    reviewedAt: z.iso.date(),
    sources: z.array(HttpsUrlSchema).min(1),
  })
  .superRefine((evidence, context) => {
    if (new Set(evidence.sources).size !== evidence.sources.length) {
      context.addIssue({
        code: 'custom',
        message: 'Evidence sources must be unique',
      })
    }
  })
const LifecycleSchema = z.discriminatedUnion('submission', [
  z.strictObject({
    cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
    completions: z.tuple([z.literal('response')]),
    deliveries: z.array(z.enum(['bytes', 'stream', 'text', 'url'])).min(1),
    submission: z.literal('immediate'),
  }),
  z.strictObject({
    cancellation: z.enum(['best-effort', 'supported', 'unsupported']),
    completions: z.array(z.enum(['poll', 'webhook'])).min(1),
    deliveries: z.array(z.enum(['bytes', 'stream', 'text', 'url'])).min(1),
    submission: z.literal('asynchronous'),
  }),
])
const MockPricingSchema = z.strictObject({
  creditCost: z.literal(0),
  providerCostUsd: z.literal(0),
  source: z.literal('mock'),
})
const NativeProviderRouteSchema = z.strictObject({
  endpoint: z.string().min(1),
  nativeModelId: z.string().min(1),
  policy: z.literal('pinned'),
  provider: ProviderSchema,
  providerTag: z.string().min(1),
  settingValueMappings: z.record(
    z.string(),
    z.record(z.string(), z.string()),
  ).optional(),
  streamEndpoint: z.string().min(1).optional(),
  supportedParameters: UniqueStringsSchema,
})
const DiscoveryOperationSchema = z.strictObject({
  adapter: ProviderSchema,
  contractVersion: z.string().min(1),
  evidence: EvidenceSchema,
  lifecycle: LifecycleSchema,
  mockPricing: MockPricingSchema,
  operationId: z.string().min(1),
  productModelId: z.string().min(1),
  providerRoute: NativeProviderRouteSchema,
  publicContract: z.record(z.string(), z.unknown()),
  routeVersion: z.string().min(1),
})
const DiscoveryProviderModelSchema = z
  .strictObject({
    contractVersion: z.string().min(1),
    evidence: EvidenceSchema,
    lifecycle: z.enum(['active', 'deprecated', 'removed']),
    nativeModelId: z.string().min(1),
    productModelId: z.string().min(1),
    provider: ProviderSchema,
    removalAt: z.iso.date().optional(),
  })
  .superRefine((model, context) => {
    if (model.lifecycle === 'active' && model.removalAt) {
      context.addIssue({
        code: 'custom',
        message: 'Active provider models cannot declare a removal date',
      })
    }
    if (model.lifecycle !== 'active' && !model.removalAt) {
      context.addIssue({
        code: 'custom',
        message:
          'Deprecated and removed provider models require a removal date',
      })
    }
  })
const DiscoverySnapshotSchema = z.strictObject({
  capture: z.strictObject({
    capturedAt: z.iso.datetime({ offset: true }),
    method: z.literal('external'),
  }),
  operations: z.array(DiscoveryOperationSchema),
  providerModels: z.array(DiscoveryProviderModelSchema),
  schemaVersion: z.literal(2),
})

function parseSnapshot(value: unknown) {
  const result = DiscoverySnapshotSchema.safeParse(value)
  if (!result.success) {
    throw new Error(
      `Invalid discovery snapshot:\n${z.prettifyError(result.error)}`,
    )
  }
  return result.data
}

function assertFreshTimestamp(label: string, value: string) {
  const timestamp = new Date(value).getTime()
  const now = Date.now()
  if (!Number.isFinite(timestamp))
    throw new Error(`${label} must be a valid ISO timestamp`)
  if (timestamp > now)
    throw new Error(`${label} cannot be in the future`)
  if (now - timestamp > MAXIMUM_EVIDENCE_AGE_MS)
    throw new Error(`${label} is older than 120 days`)
}

function assertFreshReviewDate(label: string, value: string) {
  assertFreshTimestamp(label, `${value}T00:00:00.000Z`)
}

function serializeAcceptedMedia(slot: GenerationInputSlotDefinition) {
  const media = slot.acceptedMedia
  if (!media)
    return undefined
  return {
    ...(media.aspectRatios ? { aspectRatios: [...media.aspectRatios] } : {}),
    ...(media.durationSeconds
      ? { durationSeconds: { ...media.durationSeconds } }
      : {}),
    ...(media.framesPerSecond
      ? { framesPerSecond: [...media.framesPerSecond] }
      : {}),
    ...(media.maxBytes === undefined ? {} : { maxBytes: media.maxBytes }),
    mimeTypes: [...media.mimeTypes],
    ...(media.resolutions ? { resolutions: [...media.resolutions] } : {}),
  }
}

function serializeInputSlot(slot: GenerationInputSlotDefinition) {
  return {
    accepts: [...slot.accepts],
    ...(slot.acceptedMedia
      ? { acceptedMedia: serializeAcceptedMedia(slot) }
      : {}),
    id: slot.id,
    maxConnections: slot.maxConnections,
    maxItems: slot.maxItems,
    minConnections: slot.minConnections,
    ...(slot.referenceProfile
      ? {
          referenceProfile: {
            contactSheetPolicy: slot.referenceProfile.contactSheetPolicy,
            multipleSubjectSupport:
              slot.referenceProfile.multipleSubjectSupport,
            purposes: [...slot.referenceProfile.purposes],
            ...(slot.referenceProfile.recommendedMaxItems === undefined
              ? {}
              : {
                  recommendedMaxItems:
                    slot.referenceProfile.recommendedMaxItems,
                }),
          },
        }
      : {}),
  }
}

function serializeSetting(setting: GenerationSettingDefinition) {
  const common = {
    advanced: setting.advanced ?? false,
    default: setting.default,
    id: setting.id,
    kind: setting.kind,
    ...(setting.visibleWhen
      ? {
          visibleWhen: setting.visibleWhen.map(condition => ({
            ...condition,
          })),
        }
      : {}),
  }
  if (setting.kind === 'enum') {
    return {
      ...common,
      values: setting.options.map(option => option.value),
    }
  }
  if (setting.kind === 'number') {
    return {
      ...common,
      max: setting.max,
      min: setting.min,
      step: setting.step,
    }
  }
  if (setting.kind === 'string') {
    return {
      ...common,
      maxLength: setting.maxLength,
    }
  }
  return common
}

function operationPublicContract(
  model: GenerationModelDefinition,
  operationId: string,
) {
  const operation = model.operations.find(item => item.id === operationId)
  if (!operation)
    return null
  const inputSlotIds = new Set(operation.inputSlotIds)
  const settingIds = new Set(operation.settingIds)
  const constraints = model.constraints
    .filter((constraint) => {
      const conditions = [
        ...constraint.when,
        ...(constraint.require ?? []),
        ...(constraint.forbid ?? []),
      ]
      return conditions.every((condition) => {
        if (condition.field === 'operation')
          return condition.value === operation.id
        if (condition.field === 'setting')
          return settingIds.has(condition.id)
        return inputSlotIds.has(condition.id)
      })
    })
    .map(constraint => ({
      id: constraint.id,
      when: constraint.when.map(condition => ({ ...condition })),
      ...(constraint.require
        ? { require: constraint.require.map(condition => ({ ...condition })) }
        : {}),
      ...(constraint.forbid
        ? { forbid: constraint.forbid.map(condition => ({ ...condition })) }
        : {}),
    }))
    .toSorted((left, right) => left.id.localeCompare(right.id))

  return {
    capabilitySchemaVersion: model.capabilitySchemaVersion ?? null,
    constraints,
    inputSlots: model.inputSlots
      .filter(slot => inputSlotIds.has(slot.id))
      .map(serializeInputSlot),
    mediaType: model.mediaType,
    operation: {
      id: operation.id,
      inputs: Object.fromEntries(
        Object.entries(operation.inputs).map(([id, requirement]) => [
          id,
          {
            required: requirement.required ?? false,
            ...(requirement.oneOf ? { oneOf: [...requirement.oneOf] } : {}),
            ...(requirement.atLeastOne
              ? { atLeastOne: [...requirement.atLeastOne] }
              : {}),
          },
        ]),
      ),
      inputSlotIds: [...operation.inputSlotIds],
      nodeType: operation.nodeType ?? null,
      output: operation.output
        ? {
            count: { ...operation.output.count },
            mediaType: operation.output.mediaType,
          }
        : null,
      referenceLimit: operation.referenceLimit
        ? {
            maxItems: operation.referenceLimit.maxItems,
            slotIds: [...operation.referenceLimit.slotIds],
          }
        : null,
      requiredSettingIds: [...(operation.requiredSettingIds ?? [])],
      settingIds: [...operation.settingIds],
    },
    settings: getActiveGenerationSettings(model, operation.id).map(
      serializeSetting,
    ),
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalize)
  if (!value || typeof value !== 'object')
    return value
  return Object.fromEntries(
    Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  )
}

function contractsMatch(left: unknown, right: unknown) {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  )
}

function operationKey(input: {
  contractVersion: string
  operationId: string
  productModelId: string
}) {
  return `${input.productModelId}:${input.contractVersion}:${input.operationId}`
}

function providerModelKey(input: { nativeModelId: string, provider: string }) {
  return `${input.provider}:${input.nativeModelId}`
}

function compareOperationField(
  drift: string[],
  label: string,
  field: string,
  expected: unknown,
  actual: unknown,
) {
  if (!contractsMatch(expected, actual))
    drift.push(`${label}: ${field} drifted from the reviewed route`)
}

const snapshotArguments = process.argv.filter(argument =>
  argument.startsWith('--snapshot='),
)
if (snapshotArguments.length !== 1) {
  throw new Error(
    'Pass exactly one externally refreshed --snapshot=<path>; network discovery is intentionally disabled',
  )
}

const snapshotPath = resolve(
  process.cwd(),
  snapshotArguments[0]!.slice('--snapshot='.length),
)
if (process.argv.includes('--refresh-reviewed-baseline')) {
  const previous = parseSnapshot(
    JSON.parse(await readFile(snapshotPath, 'utf8')),
  )
  const operations = GENERATION_PROVIDER_ROUTES.map((route) => {
    const model = GENERATION_MODEL_REGISTRY[String(route.productModelId)]
    const publicContract = model
      ? operationPublicContract(model, route.operationId)
      : null
    if (!publicContract) {
      throw new Error(
        `Cannot serialize ${route.productModelId}/${route.operationId}`,
      )
    }
    return {
      adapter: route.adapter,
      contractVersion: route.modelContractVersion,
      evidence: {
        reviewedAt: route.evidence.reviewedAt,
        sources: [...route.evidence.sources],
      },
      lifecycle: route.lifecycle,
      mockPricing: route.mockPricing,
      operationId: route.operationId,
      productModelId: String(route.productModelId),
      providerRoute: {
        endpoint: route.providerRoute.endpoint,
        nativeModelId: route.providerRoute.nativeModelId,
        policy: route.providerRoute.policy,
        provider: route.providerRoute.provider,
        providerTag: route.providerRoute.providerTag,
        ...(route.providerRoute.settingValueMappings
          ? {
              settingValueMappings: Object.fromEntries(
                Object.entries(route.providerRoute.settingValueMappings).map(
                  ([settingId, values]) => [settingId, { ...values }],
                ),
              ),
            }
          : {}),
        ...(route.providerRoute.streamEndpoint
          ? { streamEndpoint: route.providerRoute.streamEndpoint }
          : {}),
        supportedParameters: [...route.providerRoute.supportedParameters],
      },
      publicContract,
      routeVersion: route.routeVersion,
    }
  })
  const routeGroups = new Map<
    string,
    (typeof GENERATION_PROVIDER_ROUTES)[number][]
  >()
  for (const route of GENERATION_PROVIDER_ROUTES) {
    const key = providerModelKey(route.providerRoute)
    const group = routeGroups.get(key) ?? []
    group.push(route)
    routeGroups.set(key, group)
  }
  const providerModels: z.infer<typeof DiscoveryProviderModelSchema>[] = [
    ...routeGroups.values(),
  ].map((routes) => {
    const first = routes[0]!
    return {
      contractVersion: first.modelContractVersion,
      evidence: {
        reviewedAt: first.evidence.reviewedAt,
        sources: [
          ...new Set(routes.flatMap(route => route.evidence.sources)),
        ],
      },
      lifecycle: 'active' as const,
      nativeModelId: first.providerRoute.nativeModelId,
      productModelId: String(first.productModelId),
      provider: first.providerRoute.provider,
    }
  })
  providerModels.push(
    ...previous.providerModels.filter(
      model =>
        model.contractVersion
        === GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_1
        && model.productModelId === 'talelabs/gpt-image-1.5',
    ),
  )
  await writeFile(
    snapshotPath,
    `${JSON.stringify(
      {
        capture: {
          capturedAt: '2026-07-13T18:30:00.000Z',
          method: 'external',
        },
        operations,
        providerModels,
        schemaVersion: 2,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`Refreshed reviewed generation baseline ${snapshotPath}`)
  process.exit(0)
}
const snapshot = parseSnapshot(
  JSON.parse(await readFile(snapshotPath, 'utf8')),
)
const inventoryPath = resolve(
  process.cwd(),
  'config/openrouter-video-inventory-2026-07-13.json',
)
const inventoryResult = OpenRouterVideoInventorySchema.safeParse(
  JSON.parse(await readFile(inventoryPath, 'utf8')),
)
if (!inventoryResult.success) {
  throw new Error(
    `Invalid OpenRouter video inventory:\n${z.prettifyError(inventoryResult.error)}`,
  )
}
const inventory = inventoryResult.data
const imageInventoryPath = resolve(
  process.cwd(),
  'config/openrouter-image-inventory-2026-07-13.json',
)
const imageInventoryResult = OpenRouterImageInventorySchema.safeParse(
  JSON.parse(await readFile(imageInventoryPath, 'utf8')),
)
if (!imageInventoryResult.success) {
  throw new Error(
    `Invalid OpenRouter image inventory:\n${z.prettifyError(imageInventoryResult.error)}`,
  )
}
const imageInventory = imageInventoryResult.data
const llmInventoryPath = resolve(
  process.cwd(),
  'config/openrouter-llm-inventory-2026-07-13.json',
)
const llmInventoryResult = OpenRouterLlmInventorySchema.safeParse(
  JSON.parse(await readFile(llmInventoryPath, 'utf8')),
)
if (!llmInventoryResult.success) {
  throw new Error(
    `Invalid OpenRouter LLM inventory:\n${z.prettifyError(llmInventoryResult.error)}`,
  )
}
const llmInventory = llmInventoryResult.data
const audioInventoryPath = resolve(
  process.cwd(),
  'config/openrouter-audio-inventory-2026-07-13.json',
)
const audioInventoryResult = OpenRouterAudioInventorySchema.safeParse(
  JSON.parse(await readFile(audioInventoryPath, 'utf8')),
)
if (!audioInventoryResult.success) {
  throw new Error(
    `Invalid OpenRouter audio inventory:\n${z.prettifyError(audioInventoryResult.error)}`,
  )
}
const audioInventory = audioInventoryResult.data
assertFreshTimestamp('Discovery capture date', snapshot.capture.capturedAt)
assertFreshTimestamp(
  'OpenRouter video inventory capture date',
  inventory.capturedAt,
)
assertFreshTimestamp(
  'OpenRouter image inventory capture date',
  imageInventory.capturedAt,
)
assertFreshTimestamp(
  'OpenRouter LLM inventory capture date',
  llmInventory.capturedAt,
)
assertFreshTimestamp(
  'OpenRouter audio inventory capture date',
  audioInventory.capturedAt,
)
for (const [index, operation] of snapshot.operations.entries()) {
  assertFreshReviewDate(
    `Operation ${index} evidence review date`,
    operation.evidence.reviewedAt,
  )
  const lifecycleErrors = validateGenerationProviderLifecycle(
    operation.lifecycle as unknown as GenerationProviderLifecycle,
  )
  if (lifecycleErrors.length) {
    throw new Error(
      `Operation ${index} has an invalid lifecycle:\n${lifecycleErrors.join('\n')}`,
    )
  }
}
for (const [index, model] of snapshot.providerModels.entries()) {
  assertFreshReviewDate(
    `Provider model ${index} evidence review date`,
    model.evidence.reviewedAt,
  )
  if (
    model.lifecycle === 'removed'
    && new Date(`${model.removalAt}T00:00:00.000Z`) > new Date()
  ) {
    throw new Error(
      `Provider model ${index} is marked removed before its removal date`,
    )
  }
  if (
    model.lifecycle === 'deprecated'
    && new Date(`${model.removalAt}T00:00:00.000Z`) <= new Date()
  ) {
    throw new Error(
      `Provider model ${index} passed its removal date without being marked removed`,
    )
  }
}

const drift = [
  ...validateHardenedGenerationRegistry(GENERATION_MODEL_REGISTRY).map(
    error => `Invalid current registry: ${error}`,
  ),
  ...validateGenerationCapabilityScenarios().map(
    error => `Invalid deterministic capability scenario: ${error}`,
  ),
]
const inventoryIds = inventory.models.map(model => model.id)
if (
  new Set(inventoryIds).size !== inventoryIds.length
    || JSON.stringify([...inventoryIds].toSorted())
    !== JSON.stringify([...EXPECTED_OPENROUTER_VIDEO_MODEL_IDS].toSorted())
) {
  drift.push(
    'OpenRouter video inventory must contain exactly the 16 reviewed discovery models',
  )
}
const imageInventoryIds = imageInventory.models.map(model => model.id)
if (new Set(imageInventoryIds).size !== imageInventoryIds.length)
  drift.push('OpenRouter image inventory model IDs must be unique')
const reviewedImageIds = Object.keys(
  imageInventory.reviewedEndpoints,
).toSorted()
if (
  JSON.stringify(reviewedImageIds)
  !== JSON.stringify([...EXPECTED_REVIEWED_OPENROUTER_IMAGE_MODEL_IDS].toSorted())
) {
  drift.push(
    'OpenRouter image inventory must contain exactly the seven reviewed endpoints',
  )
}
const llmInventoryIds = llmInventory.models.map(model => model.id)
if (
  new Set(llmInventoryIds).size !== llmInventoryIds.length
    || JSON.stringify([...llmInventoryIds].toSorted())
    !== JSON.stringify([...EXPECTED_OPENROUTER_LLM_MODEL_IDS].toSorted())
) {
  drift.push(
    'OpenRouter LLM inventory must contain exactly the six reviewed models',
  )
}
for (const model of llmInventory.models) {
  if (
    model.id === 'deepseek/deepseek-v3.2'
      ? model.inputModalities.includes('image')
      : !model.inputModalities.includes('image')
  ) {
    drift.push(`${model.id}: reviewed image-input capability is invalid`)
  }
}
const audioInventoryIds = audioInventory.models.map(model => model.id)
if (
  new Set(audioInventoryIds).size !== audioInventoryIds.length
    || JSON.stringify([...audioInventoryIds].toSorted())
    !== JSON.stringify([...EXPECTED_OPENROUTER_AUDIO_MODEL_IDS].toSorted())
) {
  drift.push(
    'OpenRouter audio inventory must contain exactly the nine reviewed speech-output models',
  )
}
for (const model of inventory.models.filter(item => item.productModelId)) {
  const productModel = GENERATION_MODEL_REGISTRY[model.productModelId!]
  if (!productModel || productModel.mediaType !== 'video') {
    drift.push(
      `${model.id}: reviewed product model ${model.productModelId} is unavailable`,
    )
  }
}
const currentRegistry: Readonly<Record<string, GenerationModelDefinition>>
  = GENERATION_MODEL_REGISTRY
const discoveredByKey = new Map(
  snapshot.operations.map(operation => [operationKey(operation), operation]),
)
if (discoveredByKey.size !== snapshot.operations.length)
  throw new Error('Discovery snapshot contains duplicate operations')
const providerModelsByKey = new Map(
  snapshot.providerModels.map(model => [providerModelKey(model), model]),
)
if (providerModelsByKey.size !== snapshot.providerModels.length)
  throw new Error('Discovery snapshot contains duplicate provider models')

for (const model of Object.values(currentRegistry)) {
  const matchingEvidence = snapshot.providerModels.filter(
    record =>
      record.contractVersion === GENERATION_MODEL_CONTRACT_VERSION
      && record.productModelId === model.id,
  )
  if (!matchingEvidence.length)
    drift.push(`${model.id}: provider model evidence is missing`)
}

const gptImage15Lifecycle = snapshot.providerModels.find(
  model =>
    model.contractVersion === GENERATION_MODEL_CONTRACT_VERSION_2026_07_13_1
    && model.productModelId === 'talelabs/gpt-image-1.5'
    && model.provider === 'openai'
    && model.nativeModelId === 'gpt-image-1.5',
)
if (
  !gptImage15Lifecycle
  || gptImage15Lifecycle.lifecycle !== 'deprecated'
  || gptImage15Lifecycle.removalAt !== '2026-12-01'
) {
  drift.push(
    'talelabs/gpt-image-1.5: expected deprecated gpt-image-1.5 evidence with removal on 2026-12-01',
  )
}

const routedProviderModels = new Set<string>()
for (const route of GENERATION_PROVIDER_ROUTES) {
  const productModelId = String(route.productModelId)
  const label = `${productModelId}/${route.operationId}`
  const providerKey = providerModelKey(route.providerRoute)
  const providerModel = providerModelsByKey.get(providerKey)
  routedProviderModels.add(providerKey)
  if (!providerModel) {
    drift.push(`${label}: provider model evidence is missing`)
  }
  else {
    if (providerModel.lifecycle !== 'active') {
      drift.push(
        `${label}: active route uses a ${providerModel.lifecycle} provider model`,
      )
    }
    if (providerModel.productModelId !== productModelId) {
      drift.push(
        `${label}: provider model evidence points at ${providerModel.productModelId}`,
      )
    }
    if (providerModel.contractVersion !== route.modelContractVersion) {
      drift.push(
        `${label}: provider model evidence uses contract ${providerModel.contractVersion}`,
      )
    }
  }

  const key = operationKey({
    contractVersion: route.modelContractVersion,
    operationId: route.operationId,
    productModelId,
  })
  const discovered = discoveredByKey.get(key)
  if (!discovered) {
    drift.push(`${label}: reviewed provider operation is missing`)
    continue
  }
  const publicContract = operationPublicContract(
    currentRegistry[productModelId]!,
    route.operationId,
  )
  if (!publicContract) {
    drift.push(`${label}: public operation contract is missing`)
  }
  else {
    compareOperationField(
      drift,
      label,
      'public capability contract',
      publicContract,
      discovered.publicContract,
    )
  }
  compareOperationField(
    drift,
    label,
    'adapter',
    route.adapter,
    discovered.adapter,
  )
  compareOperationField(
    drift,
    label,
    'route version',
    route.routeVersion,
    discovered.routeVersion,
  )
  compareOperationField(
    drift,
    label,
    'route evidence',
    route.evidence,
    discovered.evidence,
  )
  compareOperationField(
    drift,
    label,
    'lifecycle',
    route.lifecycle,
    discovered.lifecycle,
  )
  compareOperationField(
    drift,
    label,
    'mock pricing',
    route.mockPricing,
    discovered.mockPricing,
  )
  compareOperationField(
    drift,
    label,
    'native provider model',
    route.providerRoute.nativeModelId,
    discovered.providerRoute.nativeModelId,
  )
  compareOperationField(
    drift,
    label,
    'provider endpoint',
    route.providerRoute.endpoint,
    discovered.providerRoute.endpoint,
  )
  compareOperationField(
    drift,
    label,
    'stream endpoint',
    route.providerRoute.streamEndpoint ?? null,
    discovered.providerRoute.streamEndpoint ?? null,
  )
  compareOperationField(
    drift,
    label,
    'provider identity',
    {
      provider: route.providerRoute.provider,
      providerTag: route.providerRoute.providerTag,
      policy: route.providerRoute.policy,
    },
    {
      provider: discovered.providerRoute.provider,
      providerTag: discovered.providerRoute.providerTag,
      policy: discovered.providerRoute.policy,
    },
  )
  compareOperationField(
    drift,
    label,
    'supported provider parameters',
    route.providerRoute.supportedParameters,
    discovered.providerRoute.supportedParameters,
  )
  discoveredByKey.delete(key)
}

for (const operation of discoveredByKey.values()) {
  drift.push(
    `${operation.productModelId}/${operation.operationId}: unreviewed provider operation appeared`,
  )
}

for (const providerModel of snapshot.providerModels) {
  const key = providerModelKey(providerModel)
  const publicModel = currentRegistry[providerModel.productModelId]
  const reviewedHistoricalModel = providerModel === gptImage15Lifecycle
  if (
    (!publicModel
      || providerModel.contractVersion !== GENERATION_MODEL_CONTRACT_VERSION)
    && !reviewedHistoricalModel
  ) {
    drift.push(
      `${providerModel.provider}/${providerModel.nativeModelId}: unreviewed provider model evidence appeared`,
    )
  }
  else if (publicModel?.enabled && !routedProviderModels.has(key)) {
    drift.push(
      `${providerModel.provider}/${providerModel.nativeModelId}: enabled model evidence has no reviewed route`,
    )
  }
}

if (drift.length) {
  console.error(
    `Generation model discovery drift detected:\n${drift.join('\n')}`,
  )
  process.exitCode = 1
}
else {
  console.log(
    `No generation model discovery drift in external snapshot ${snapshotPath}`,
  )
}
