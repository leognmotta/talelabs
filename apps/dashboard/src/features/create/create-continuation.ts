/** Historical request and canonical Asset continuation into the current draft. */

import type { GenerationReferencePurpose } from '@talelabs/flows'
import type { Asset, FlowRunSummary } from '@talelabs/sdk'
import type { CreateAssetReference, CreateDraft, CreateMode } from './create-draft'

import { promptTemplateFromText } from '@talelabs/flows'
import {
  CREATE_AUDIO_INTENTS,
  createAttachment,
  createEmptyCreateDraft,
  resetCreateDraftMode,
  toCreateAssetReference,
} from './create-draft'
import {
  canAddCreateAttachment,
  createAssetMatchesInputSlot,
  createModelsForDraft,
  resolveCreateDraft,
  selectCreateDraftModel,
  upgradeCreateDraftModelContract,
} from './create-resolution'

function summaryMode(nodeType: string): {
  audioIntent: CreateDraft['audioIntent']
  mode: CreateMode
} | null {
  if (nodeType === 'imageGeneration')
    return { audioIntent: 'speechGeneration', mode: 'image' }
  if (nodeType === 'videoGeneration')
    return { audioIntent: 'speechGeneration', mode: 'video' }
  if ((CREATE_AUDIO_INTENTS as readonly string[]).includes(nodeType)) {
    return {
      audioIntent: nodeType as CreateDraft['audioIntent'],
      mode: 'audio',
    }
  }
  return null
}

/** Restores one immutable run request into a fresh browser-local draft. */
export function createDraftFromRunSummary(input: {
  /** Canonical Asset details keyed by immutable request input id. */
  assets: ReadonlyMap<string, Asset>
  /** Bounded provider-neutral request facts from the run snapshot. */
  run: FlowRunSummary
}): CreateDraft | null {
  const summary = input.run.requestSummary
  const intent = summaryMode(summary?.nodeType ?? '')
  if (!summary || !intent)
    return null
  const empty = createEmptyCreateDraft()
  const reset = resetCreateDraftMode(empty, intent.mode, intent.audioIntent)
  const attachments = summary.inputs.flatMap(slot => slot.assetIds.flatMap(
    (assetId) => {
      const asset = input.assets.get(assetId)
      const reference = asset ? toCreateAssetReference(asset) : null
      return reference ? [createAttachment(reference, slot.slotId)] : []
    },
  ))
  if (attachments.length !== summary.inputs.reduce(
    (count, slot) => count + slot.assetIds.length,
    0,
  )) {
    return null
  }
  const restoredDraft: CreateDraft = {
    ...reset,
    attachments,
    lyrics: summary.inline.lyrics ?? '',
    modelContractVersion: summary.modelContractVersion,
    modelId: summary.modelId,
    operationId: summary.operationId,
    prompt: summary.promptTemplates.prompt ?? promptTemplateFromText(''),
    settings: { ...summary.settings },
  }
  return upgradeCreateDraftModelContract(restoredDraft)?.draft ?? null
}

function slotAcceptsAsset(
  slot: ReturnType<typeof resolveCreateDraft>['slots'][number],
  asset: CreateAssetReference,
  purpose: GenerationReferencePurpose | null,
) {
  const acceptsPurpose = !purpose
    || slot.referenceProfile?.purposes.includes(purpose)
    || slot.id === purpose
  return createAssetMatchesInputSlot(asset, slot) && acceptsPurpose
}

function attachToCompatibleModel(
  draft: CreateDraft,
  asset: CreateAssetReference,
  purpose: GenerationReferencePurpose | null,
): CreateDraft | null {
  const candidates = [draft, ...createModelsForDraft(draft).flatMap(
    model => selectCreateDraftModel(draft, model) ?? [],
  )]
  for (const candidate of candidates) {
    const resolution = resolveCreateDraft(candidate)
    for (const slot of resolution.slots) {
      if (!slotAcceptsAsset(slot, asset, purpose))
        continue
      const attachment = createAttachment(asset, slot.id)
      if (!canAddCreateAttachment(candidate, attachment))
        continue
      return {
        ...candidate,
        attachments: [
          ...candidate.attachments,
          attachment,
        ],
      }
    }
  }
  return null
}

/** Explicitly reuses a canonical result in the next compatible request. */
export function createDraftUsingAsset(input: {
  /** Canonical result Asset selected by the user. */
  asset: Asset
  /** Current next-request draft, preserved when its model accepts the Asset. */
  draft: CreateDraft
  /** Image-to-video forces a fresh Video request and first-frame semantics. */
  makeVideo: boolean
}): CreateDraft | null {
  const reference = toCreateAssetReference(input.asset)
  if (!reference)
    return null
  if (input.makeVideo) {
    if (reference.type !== 'image')
      return null
    return attachToCompatibleModel(
      resetCreateDraftMode(input.draft, 'video'),
      reference,
      'firstFrame',
    )
  }
  const current = attachToCompatibleModel(input.draft, reference, null)
  if (current)
    return current
  const fallbackMode: CreateMode = reference.type === 'image'
    ? 'image'
    : reference.type === 'video'
      ? 'video'
      : 'audio'
  const fallbackIntent = reference.type === 'audio'
    ? 'voiceChanger'
    : input.draft.audioIntent
  return attachToCompatibleModel(
    resetCreateDraftMode(input.draft, fallbackMode, fallbackIntent),
    reference,
    null,
  )
}
