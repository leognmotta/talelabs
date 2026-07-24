/**
 * Current-catalog validation and compilation for direct generation requests.
 *
 * The request is validated independently from dashboard state. Callers provide
 * tenant-scoped Asset rows, with admission using rows locked in PostgreSQL.
 */

import type {
  AudioIntentNodeType,
  CompileDirectGenerationInput,
  GenerationSettingValue,
  PromptTemplate,
} from '@talelabs/flows'

import {
  applyGenerationSettingRequirements,
  compileDirectGeneration,
  GENERATION_CATALOG_REVISION,
  GENERATION_CATALOG_VERSION,
  GENERATION_MODEL_CONTRACT_VERSION,
  getActiveGenerationInputSlots,
  getActiveGenerationSettings,
  getGenerationModel,
  getGenerationOperation,
  isGenerationSettingValueValid,
  normalizeImageGenerationInputSlotId,
  normalizeVideoGenerationInputSlotId,
  promptTemplateResolvedText,
  resolveAdaptiveGenerationState,
  resolvePromptTemplate,
} from '@talelabs/flows'

import { HttpError } from '../../middleware/error.js'

/** Direct request facts accepted by estimate and admission composition. */
export interface DirectGenerationRequest {
  /** Selected task-specific Audio intent. */
  audioIntent?: AudioIntentNodeType
  /** Browser providers with locally usable credentials. */
  byokProviders?: ('fal' | 'openrouter')[]
  /** Existing Create session; omitted when first generation creates one. */
  createSessionId?: string
  /** Paid-boundary policy for this request. */
  executionMode: 'debug' | 'live'
  /** Environment that executes provider lifecycle work. */
  executionRuntime: 'browser' | 'managed'
  /** Account source responsible for provider spend. */
  fundingSource: 'byok' | 'credits'
  /** Task-specific inline fields such as lyrics. */
  inline: Record<string, string>
  /** Ordered canonical Asset identities and semantic slots. */
  inputs: {
    assetId: string
    slotId: string
  }[]
  /** Top-level direct-generation media mode. */
  mediaMode: 'audio' | 'image' | 'video'
  /** Current public catalog contract supplied by the client. */
  modelContractVersion: string
  /** Canonical creative model identity. */
  modelId: string
  /** Current model operation selected by the composer. */
  operationId: string
  /** Expected provider output count. */
  outputCount: number
  /** Narrow structured prompt fields. */
  promptTemplates: Record<string, PromptTemplate>
  /** Provider-neutral scalar settings. */
  settings: Record<string, GenerationSettingValue>
}

/** Tenant-scoped canonical Asset facts used for direct contract validation. */
export interface DirectGenerationAsset {
  /** Optional media duration in seconds. */
  durationSeconds: null | number
  /** Optional image/video pixel height. */
  height: null | number
  /** Canonical Asset identity. */
  id: string
  /** Canonical media MIME type. */
  mimeType: string
  /** Current processing state. */
  processingState: 'failed' | 'processing' | 'ready'
  /** Exact stored object size in bytes, when available. */
  sizeBytes: null | number
  /** Purge lifecycle facts that make an Asset unusable. */
  unavailable: boolean
  /** Canonical media family. */
  type: 'audio' | 'document' | 'image' | 'video'
  /** Optional image/video pixel width. */
  width: null | number
}

function invalidDirectRequest(
  code: string,
  field: string,
  params?: Record<string, boolean | number | string>,
): never {
  throw new HttpError(
    422,
    'invalid_direct_generation_request',
    'The direct generation request is invalid.',
    [{
      code,
      field,
      message: code,
      ...(params ? { params } : {}),
    }],
  )
}

function directStepType(request: DirectGenerationRequest) {
  if (request.mediaMode === 'image')
    return 'imageGeneration' as const
  if (request.mediaMode === 'video')
    return 'videoGeneration' as const
  if (!request.audioIntent)
    invalidDirectRequest('audio_intent_required', 'audioIntent')
  return request.audioIntent
}

function normalizedSlotId(
  stepType: ReturnType<typeof directStepType>,
  slotId: string,
) {
  if (stepType === 'imageGeneration')
    return normalizeImageGenerationInputSlotId(slotId)
  if (stepType === 'videoGeneration')
    return normalizeVideoGenerationInputSlotId(slotId)
  return slotId
}

function acceptsMedia(
  accepts: readonly string[],
  mediaType: 'audio' | 'image' | 'video',
) {
  const collection = mediaType === 'image'
    ? 'ImageSet'
    : mediaType === 'video' ? 'VideoSet' : 'AudioSet'
  return accepts.includes('Asset') || accepts.includes(collection)
}

function expectedOutputValueType(mediaType: 'audio' | 'image' | 'text' | 'video') {
  if (mediaType === 'image')
    return 'ImageSet'
  if (mediaType === 'video')
    return 'VideoSet'
  if (mediaType === 'audio')
    return 'AudioSet'
  return 'Text'
}

function normalizedSettings(input: {
  model: NonNullable<ReturnType<typeof getGenerationModel>>
  operationId: string
  settings: DirectGenerationRequest['settings']
}) {
  const definitions = getActiveGenerationSettings(
    input.model,
    input.operationId,
  )
  const activeIds = new Set(definitions.map(setting => setting.id))
  const unknown = Object.keys(input.settings).find(id => !activeIds.has(id))
  if (unknown)
    invalidDirectRequest('generation_setting_inactive', `settings.${unknown}`)
  return Object.fromEntries(definitions.map((setting) => {
    const value = input.settings[setting.id]
    if (value !== undefined && !isGenerationSettingValueValid(setting, value)) {
      invalidDirectRequest(
        'generation_setting_invalid',
        `settings.${setting.id}`,
      )
    }
    return [setting.id, value ?? setting.default]
  }))
}

function expectedOutputCount(input: {
  operation: NonNullable<ReturnType<typeof getGenerationOperation>>
  settings: Readonly<Record<string, GenerationSettingValue>>
}) {
  const count = input.operation.output?.count
  if (!count)
    return 1
  const value = count.settingId
    ? input.settings[count.settingId]
    : count.default
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? value
    : count.default
}

function validateAcceptedMedia(input: {
  asset: DirectGenerationAsset
  field: string
  slot: ReturnType<typeof getActiveGenerationInputSlots>[number]
}) {
  if (
    input.asset.type === 'document'
    || !acceptsMedia(input.slot.accepts, input.asset.type)
  ) {
    invalidDirectRequest('generation_input_media_type', input.field)
  }
  const accepted = input.slot.acceptedMedia
  if (!accepted)
    return
  if (
    accepted.mimeTypes.length > 0
    && !accepted.mimeTypes.includes(input.asset.mimeType)
  ) {
    invalidDirectRequest('generation_input_mime_type', input.field)
  }
  if (
    accepted.durationSeconds
    && input.asset.durationSeconds !== null
    && (
      input.asset.durationSeconds < accepted.durationSeconds.min
      || input.asset.durationSeconds > accepted.durationSeconds.max
    )
  ) {
    invalidDirectRequest('generation_input_duration', input.field)
  }
  if (
    accepted.maxBytes !== undefined
    && input.asset.sizeBytes !== null
    && input.asset.sizeBytes > accepted.maxBytes
  ) {
    invalidDirectRequest('generation_input_size', input.field)
  }
}

/**
 * Validates current-catalog request facts and compiles the generic execution
 * plan used identically by estimate and admission.
 */
export function resolveDirectGeneration(input: {
  /** Tenant-scoped canonical Assets keyed by ID. */
  assetsById: ReadonlyMap<string, DirectGenerationAsset>
  /** Parsed direct request from the authenticated caller. */
  request: DirectGenerationRequest
}) {
  const { request } = input
  if (request.mediaMode !== 'audio' && request.audioIntent !== undefined)
    invalidDirectRequest('audio_intent_inactive', 'audioIntent')
  const stepType = directStepType(request)
  if (request.modelContractVersion !== GENERATION_MODEL_CONTRACT_VERSION) {
    invalidDirectRequest(
      'generation_model_contract_outdated',
      'modelContractVersion',
    )
  }
  const model = getGenerationModel(
    request.modelId,
    request.modelContractVersion,
  )
  if (!model || !model.enabled || model.executionAvailable === false)
    invalidDirectRequest('generation_model_unavailable', 'modelId')
  if (model.mediaType !== request.mediaMode)
    invalidDirectRequest('generation_model_media_mismatch', 'modelId')
  const operation = getGenerationOperation(model, request.operationId)
  if (!operation || operation.nodeType !== stepType)
    invalidDirectRequest('unknown_generation_operation', 'operationId')

  const slots = getActiveGenerationInputSlots(model, operation.id)
  const slotsById = new Map(slots.map(slot => [slot.id, slot]))
  const normalizedInputs = request.inputs.map((inputItem, index) => {
    const slotId = normalizedSlotId(stepType, inputItem.slotId)
    const slot = slotsById.get(slotId)
    if (!slot)
      invalidDirectRequest('generation_input_inactive', `inputs.${index}.slotId`)
    const asset = input.assetsById.get(inputItem.assetId)
    if (
      !asset
      || asset.processingState !== 'ready'
      || asset.unavailable
    ) {
      invalidDirectRequest('asset_not_usable', `inputs.${index}.assetId`)
    }
    validateAcceptedMedia({
      asset,
      field: `inputs.${index}.assetId`,
      slot,
    })
    return {
      asset,
      assetId: asset.id,
      mediaType: asset.type as 'audio' | 'image' | 'video',
      slotId,
    }
  })
  const itemCounts = Object.fromEntries(slots.map(slot => [
    slot.id,
    normalizedInputs.filter(item => item.slotId === slot.id).length,
  ]))
  const connectionCounts = Object.fromEntries(
    Object.entries(itemCounts).map(([slotId, count]) => [
      slotId,
      count > 0 ? 1 : 0,
    ]),
  )
  const connectedSlotIds = new Set(
    Object.entries(connectionCounts)
      .filter(([, count]) => count > 0)
      .map(([slotId]) => slotId),
  )
  let settings = normalizedSettings({
    model,
    operationId: operation.id,
    settings: request.settings,
  })
  settings = applyGenerationSettingRequirements({
    connectedSlotIds,
    model,
    operationId: operation.id,
    settings,
  })
  const normalizedTemplates = Object.fromEntries(
    Object.entries(request.promptTemplates).map(([key, template]) => [
      key,
      {
        ...template,
        parts: template.parts.map(part => part.type === 'input'
          ? { ...part, slotId: normalizedSlotId(stepType, part.slotId) }
          : part),
      },
    ]),
  )
  const promptInputs = normalizedInputs.map((item, index) => ({
    assetId: item.assetId,
    itemKey: `direct-input:${index}`,
    mediaType: item.mediaType,
    slotId: item.slotId,
    sourceNodeId: item.assetId,
  }))
  for (const [field, template] of Object.entries(normalizedTemplates)) {
    const resolution = resolvePromptTemplate({ inputs: promptInputs, template })
    if (!resolution.ok) {
      invalidDirectRequest(
        resolution.issues[0]!.code,
        `promptTemplates.${field}`,
      )
    }
  }
  const adaptive = resolveAdaptiveGenerationState({
    connectionCounts,
    inlineLyrics: request.inline.lyrics ?? '',
    inlinePrompt: normalizedTemplates.prompt
      ? promptTemplateResolvedText(normalizedTemplates.prompt)
      : request.inline.prompt ?? '',
    itemCounts,
    model,
    nodeType: stepType,
    settings,
  })
  if (
    !adaptive
    || adaptive.readiness !== 'ready'
    || adaptive.resolvedOperationId !== operation.id
  ) {
    invalidDirectRequest('generation_request_incomplete', 'request')
  }
  if ('normalizedSettings' in adaptive) {
    settings = {
      ...settings,
      ...adaptive.normalizedSettings,
    }
  }
  const outputCount = expectedOutputCount({ operation, settings })
  if (request.outputCount !== outputCount) {
    invalidDirectRequest(
      'generation_output_count',
      'outputCount',
      { expected: outputCount },
    )
  }
  return compileDirectGeneration({
    ...(request.audioIntent ? { audioIntent: request.audioIntent } : {}),
    catalogRevision: GENERATION_CATALOG_REVISION,
    catalogVersion: GENERATION_CATALOG_VERSION,
    inline: request.inline,
    inputLimits: Object.fromEntries(slots.map(slot => [
      slot.id,
      slot.maxItems,
    ])),
    inputs: normalizedInputs.map(item => ({
      assetId: item.assetId,
      mediaType: item.mediaType,
      slotId: item.slotId,
    })),
    mediaMode: request.mediaMode,
    modelContractVersion: request.modelContractVersion,
    modelId: model.id,
    modelRevision: model.revision!,
    operationId: operation.id,
    outputCount,
    outputValueType: expectedOutputValueType(operation.output!.mediaType),
    promptTemplates: normalizedTemplates,
    settings,
    stepType,
  } satisfies CompileDirectGenerationInput)
}
