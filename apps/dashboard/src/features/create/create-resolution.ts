/** Catalog-backed model, slot, prompt, settings, and readiness resolution for Create. */

import type {
  AudioIntentNodeType,
  GenerationInputAvailability,
  GenerationInputSlotDefinition,
  GenerationModelDefinition,
  GenerationSettingDefinition,
  GenerationSettingValue,
  PromptTemplateInput,
} from '@talelabs/flows'
import type {
  CreateAssetReference,
  CreateAttachment,
  CreateDraft,
} from './create-draft'

import {
  applyGenerationSettingRequirements,
  getActiveGenerationSettings,
  getGenerationInputSlotsForNodeType,
  getGenerationModel,
  getGenerationModelsForNodeType,
  getGenerationOperationsForNodeType,
  isGenerationSettingValueValid,
  normalizeImageGenerationInputSlotId,
  normalizeVideoGenerationInputSlotId,
  promptTemplateResolvedText,
  resolveAudioNodeState,
  resolveImageGenerationState,
  resolvePromptTemplate,
  resolveVideoGenerationState,
  valueTypeToAssetTypes,
} from '@talelabs/flows'
import {
  CREATE_MODEL_CONTRACT_VERSION,
  createNodeType,
  removeCreateAttachment,
} from './create-draft'

/** Prompt-addressable attachment plus its stable canonical Asset identity. */
export interface CreatePromptInput extends PromptTemplateInput {
  /** Zero-based position within this semantic slot's selected inputs. */
  index: number
  /** Current Asset name shown by the suggestion menu. */
  name: string
  /** Lazy image preview shown by the suggestion menu. */
  previewUrl: null | string
}

/** Complete provider-neutral resolution used by composer and projection. */
export interface CreateDraftResolution {
  /** Catalog-active settings visible for the resolved operation. */
  activeSettings: readonly GenerationSettingDefinition[]
  /** Current connection counts keyed by semantic slot. */
  connectionCounts: Readonly<Record<string, number>>
  /** Shared model-resolver availability keyed by semantic input slot. */
  inputAvailability: Readonly<Record<string, GenerationInputAvailability>>
  /** Catalog model pinned by the draft. */
  model: GenerationModelDefinition | null
  /** Registered generation node type selected by mode and intent. */
  nodeType: ReturnType<typeof createNodeType>
  /** Stable prompt inputs in slot and edge order. */
  promptInputs: readonly CreatePromptInput[]
  /** Whether every structured prompt token resolves to its exact Asset. */
  promptValid: boolean
  /** Resolver-selected operation, or null for an unsupported composition. */
  resolvedOperationId: null | string
  /** Current normalized setting values compiled for the direct request. */
  settings: Readonly<Record<string, GenerationSettingValue>>
  /** Whether the current direct request can be admitted. */
  readiness: 'incomplete' | 'invalid' | 'ready'
  /** Catalog slots relevant to the selected node intent. */
  slots: readonly GenerationInputSlotDefinition[]
}

function promptInputsForDraft(
  draft: CreateDraft,
  slots: readonly GenerationInputSlotDefinition[],
): CreatePromptInput[] {
  return slots.flatMap(slot => draft.attachments
    .filter(item => item.slotId === slot.id)
    .slice(0, slot.maxItems)
    .map((item, index) => ({
      assetId: item.asset.id,
      index,
      itemKey: null,
      mediaType: item.asset.type,
      name: item.asset.name,
      previewUrl: item.asset.type === 'image'
        ? item.asset.thumbnailUrl ?? item.asset.url
        : null,
      slotId: slot.id,
      sourceNodeId: item.attachmentId,
    })))
}

function normalizedModelSettings(
  model: GenerationModelDefinition,
  settings: Readonly<Record<string, GenerationSettingValue>>,
) {
  return Object.fromEntries(model.settings.map(setting => [
    setting.id,
    settings[setting.id] !== undefined
    && isGenerationSettingValueValid(setting, settings[setting.id]!)
      ? settings[setting.id]!
      : setting.default,
  ]))
}

function normalizeDraftInputSlots(draft: CreateDraft): CreateDraft {
  const nodeType = createNodeType(draft.mode, draft.audioIntent)
  const normalizeSlotId = nodeType === 'imageGeneration'
    ? normalizeImageGenerationInputSlotId
    : nodeType === 'videoGeneration'
      ? normalizeVideoGenerationInputSlotId
      : (slotId: string) => slotId
  return {
    ...draft,
    attachments: draft.attachments.map(attachment => ({
      ...attachment,
      slotId: normalizeSlotId(attachment.slotId),
    })),
    prompt: {
      ...draft.prompt,
      parts: draft.prompt.parts.map(part => part.type === 'input'
        ? { ...part, slotId: normalizeSlotId(part.slotId) }
        : part),
    },
  }
}

/** Resolves one direct request exclusively through existing catalog resolvers. */
export function resolveCreateDraft(draft: CreateDraft): CreateDraftResolution {
  const nodeType = createNodeType(draft.mode, draft.audioIntent)
  const model = getGenerationModel(draft.modelId, draft.modelContractVersion)
  const slots = model
    ? getGenerationInputSlotsForNodeType(model, nodeType)
    : []
  const promptInputs = promptInputsForDraft(draft, slots)
  const promptResolution = resolvePromptTemplate({
    inputs: promptInputs,
    template: draft.prompt,
  })
  const itemCounts = Object.fromEntries(slots.map(slot => [
    slot.id,
    draft.attachments.filter(item => item.slotId === slot.id).length,
  ]))
  const connectionCounts = Object.fromEntries(
    Object.entries(itemCounts).map(([slotId, count]) => [
      slotId,
      count > 0 ? 1 : 0,
    ]),
  )
  const settings = model ? normalizedModelSettings(model, draft.settings) : {}
  let readiness: CreateDraftResolution['readiness'] = 'invalid'
  let resolvedOperationId: null | string = null
  let normalizedSettings = settings
  let visibleSettingIds: readonly string[] = []
  let inputAvailability: Readonly<
    Record<string, GenerationInputAvailability>
  > = {}

  if (model && nodeType === 'imageGeneration') {
    const state = resolveImageGenerationState({
      connectionCounts,
      inlinePrompt: promptTemplateResolvedText(draft.prompt),
      itemCounts,
      model,
      settings,
    })
    readiness = state.readiness
    inputAvailability = state.inputAvailability
    resolvedOperationId = state.resolvedOperationId
    normalizedSettings = { ...state.normalizedSettings }
    visibleSettingIds = state.visibleSettingIds
  }
  else if (model && nodeType === 'videoGeneration') {
    const state = resolveVideoGenerationState({
      connectionCounts,
      inlinePrompt: promptTemplateResolvedText(draft.prompt),
      itemCounts,
      model,
      settings,
    })
    readiness = state.readiness
    inputAvailability = state.inputAvailability
    resolvedOperationId = state.resolvedOperationId
    visibleSettingIds = state.visibleSettingIds
    if (resolvedOperationId) {
      normalizedSettings = applyGenerationSettingRequirements({
        connectedSlotIds: new Set(
          Object.entries(connectionCounts)
            .filter(([, count]) => count > 0)
            .map(([slotId]) => slotId),
        ),
        model,
        operationId: resolvedOperationId,
        settings,
      })
    }
  }
  else if (model) {
    const state = resolveAudioNodeState(nodeType as AudioIntentNodeType, {
      connectionCounts,
      inlineLyrics: draft.lyrics,
      inlinePrompt: promptTemplateResolvedText(draft.prompt),
      itemCounts,
      model,
      settings,
    })
    readiness = state.readiness
    inputAvailability = state.inputAvailability
    resolvedOperationId = state.resolvedOperationId
    normalizedSettings = { ...settings, ...state.normalizedSettings }
    visibleSettingIds = state.visibleSettingIds
  }

  if (!promptResolution.ok)
    readiness = 'invalid'
  const operation = model && resolvedOperationId
    ? getGenerationOperationsForNodeType(model, nodeType)
        .find(item => item.id === resolvedOperationId)
    : undefined
  const activeSettings = model && operation
    ? getActiveGenerationSettings(model, operation.id)
        .filter(setting => visibleSettingIds.includes(setting.id))
    : []
  const defaults = model ? normalizedModelSettings(model, normalizedSettings) : {}
  return {
    activeSettings,
    connectionCounts,
    inputAvailability,
    model: model ?? null,
    nodeType,
    promptInputs,
    promptValid: promptResolution.ok,
    readiness,
    resolvedOperationId,
    settings: defaults,
    slots,
  }
}

/** Returns the Asset media families accepted by one Create input slot. */
export function createInputSlotAssetTypes(
  slot: GenerationInputSlotDefinition,
): CreateAssetReference['type'][] {
  return [...new Set(slot.accepts.flatMap(valueTypeToAssetTypes))]
    .filter((type): type is CreateAssetReference['type'] => type !== 'document')
}

/** Checks one Asset's public media facts against a catalog input slot. */
export function createAssetMatchesInputSlot(
  asset: {
    mimeType: string
    type: CreateAssetReference['type'] | 'document'
  },
  slot: GenerationInputSlotDefinition,
): boolean {
  return (
    asset.type !== 'document'
    && createInputSlotAssetTypes(slot).includes(asset.type)
    && (
      !slot.acceptedMedia
      || slot.acceptedMedia.mimeTypes.includes(asset.mimeType)
    )
  )
}

/** Returns whether the shared resolver permits another item in one input slot. */
export function isCreateInputSlotAddable(input: {
  /** Current browser-local request used to enforce direct item capacity. */
  draft: CreateDraft
  /** Canonical shared resolution for the same draft. */
  resolution: CreateDraftResolution
  /** Semantic catalog slot to test. */
  slotId: string
}): boolean {
  const slot = input.resolution.slots.find(item => item.id === input.slotId)
  const availability = input.resolution.inputAvailability[input.slotId]
  if (!slot || !availability)
    return false
  const count = input.draft.attachments.filter(
    attachment => attachment.slotId === slot.id,
  ).length
  return count < slot.maxItems
    && (availability.state === 'available' || availability.state === 'connected')
}

/** Validates every client-known fact before appending one Create attachment. */
export function canAddCreateAttachment(
  draft: CreateDraft,
  attachment: CreateAttachment,
): boolean {
  const resolution = resolveCreateDraft(draft)
  const slot = resolution.slots.find(item => item.id === attachment.slotId)
  return Boolean(
    slot
    && attachment.asset.processingState === 'ready'
    && createAssetMatchesInputSlot(attachment.asset, slot)
    && isCreateInputSlotAddable({
      draft,
      resolution,
      slotId: attachment.slotId,
    })
    && !draft.attachments.some(item => (
      item.slotId === attachment.slotId
      && item.asset.id === attachment.asset.id
    )),
  )
}

/** Lists models for a Create intent without adding a second catalog registry. */
export function createModelsForDraft(draft: CreateDraft) {
  return getGenerationModelsForNodeType(
    createNodeType(draft.mode, draft.audioIntent),
  )
}

/** Applies one compatible catalog model while preserving valid scalar settings. */
export function selectCreateDraftModel(
  draft: CreateDraft,
  model: GenerationModelDefinition,
): CreateDraft | null {
  const normalizedDraft = normalizeDraftInputSlots(draft)
  const nodeType = createNodeType(
    normalizedDraft.mode,
    normalizedDraft.audioIntent,
  )
  const slotsById = new Map(
    getGenerationInputSlotsForNodeType(model, nodeType).map(slot => [
      slot.id,
      slot,
    ]),
  )
  if (normalizedDraft.attachments.some((item) => {
    const slot = slotsById.get(item.slotId)
    return !slot || !createAssetMatchesInputSlot(item.asset, slot)
  })) {
    return null
  }
  const operations = getGenerationOperationsForNodeType(model, nodeType)
  const operation = operations.find(item => item.id === draft.operationId)
    ?? operations[0]
  if (!operation)
    return null
  return {
    ...normalizedDraft,
    modelContractVersion: CREATE_MODEL_CONTRACT_VERSION,
    modelId: model.id,
    operationId: operation.id,
    settings: normalizedModelSettings(model, normalizedDraft.settings),
  }
}

/** Model transition plus the exact attachments detached from execution. */
export interface CreateModelTransition {
  /** Next provider-neutral draft with catalog-compatible inputs and settings. */
  draft: CreateDraft
  /** Canonical Assets removed only from this request, never from Assets. */
  detachedAttachments: CreateDraft['attachments']
}

/**
 * Reconciles a model switch through catalog slot contracts while removing any
 * affected prompt tokens before input indexes compact.
 */
export function transitionCreateDraftModel(
  draft: CreateDraft,
  model: GenerationModelDefinition,
): CreateModelTransition | null {
  const normalizedDraft = normalizeDraftInputSlots(draft)
  const nodeType = createNodeType(
    normalizedDraft.mode,
    normalizedDraft.audioIntent,
  )
  const slots = getGenerationInputSlotsForNodeType(model, nodeType)
  const slotMaximums = new Map(slots.map(slot => [slot.id, slot.maxItems]))
  const detachedAttachments = normalizedDraft.attachments.filter((attachment) => {
    const maximum = slotMaximums.get(attachment.slotId)
    const slot = slots.find(item => item.id === attachment.slotId)
    if (
      maximum === undefined
      || !slot
      || !createAssetMatchesInputSlot(attachment.asset, slot)
    ) {
      return true
    }
    const slotIndex = normalizedDraft.attachments
      .filter(item => item.slotId === attachment.slotId)
      .findIndex(item => item.attachmentId === attachment.attachmentId)
    return slotIndex >= maximum
  })
  let reconciled = normalizedDraft
  for (const attachment of detachedAttachments) {
    reconciled = removeCreateAttachment(
      reconciled,
      attachment.attachmentId,
    )
  }
  const selected = selectCreateDraftModel(reconciled, model)
  return selected
    ? { detachedAttachments, draft: selected }
    : null
}

/**
 * Upgrades one mutable Create draft to the current catalog contract while
 * leaving immutable historical run summaries untouched.
 */
export function upgradeCreateDraftModelContract(
  draft: CreateDraft,
): CreateModelTransition | null {
  const nodeType = createNodeType(draft.mode, draft.audioIntent)
  const currentModel = getGenerationModel(
    draft.modelId,
    CREATE_MODEL_CONTRACT_VERSION,
  )
  const currentModelCompatible = Boolean(
    currentModel
    && getGenerationOperationsForNodeType(currentModel, nodeType).length > 0,
  )
  if (
    draft.modelContractVersion === CREATE_MODEL_CONTRACT_VERSION
    && currentModelCompatible
  ) {
    return { detachedAttachments: [], draft }
  }
  const models = createModelsForDraft(draft)
  const fallbackModel = models.find(model => model.recommended) ?? models[0]
  const targetModel = currentModelCompatible ? currentModel : fallbackModel
  return targetModel ? transitionCreateDraftModel(draft, targetModel) : null
}
