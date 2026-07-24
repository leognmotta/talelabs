/** Provider-neutral local draft contracts for the direct Asset creation surface. */

import type {
  AudioIntentNodeType,
  FlowNodeType,
  GenerationSettingValue,
  PromptTemplate,
} from '@talelabs/flows'
import type { Asset, FlowReferenceAsset } from '@talelabs/sdk'

import { createId } from '@paralleldrive/cuid2'
import {
  GENERATION_MODEL_CONTRACT_VERSION,
  getDefaultNodeData,
  promptTemplateFromText,
} from '@talelabs/flows'

/** Top-level direct creation media modes. */
export type CreateMode = 'audio' | 'image' | 'video'

/** Audio intents backed by the shared registered generation contracts. */
export const CREATE_AUDIO_INTENTS = [
  'speechGeneration',
  'musicGeneration',
  'soundEffectGeneration',
  'voiceChanger',
  'voiceIsolation',
] as const satisfies readonly AudioIntentNodeType[]

/** Canonical Asset facts retained by a local Create draft. */
export interface CreateAssetReference {
  /** Canonical Asset identifier. */
  id: string
  /** Canonical media MIME type. */
  mimeType: string
  /** User-visible Asset name. */
  name: string
  /** Current processing lifecycle used by attachment presentation. */
  processingState: 'failed' | 'processing' | 'ready'
  /** Lazy poster or thumbnail URL, when available. */
  thumbnailUrl: null | string
  /** Canonical media family accepted by Create. */
  type: 'audio' | 'image' | 'video'
  /** Current media URL, when available. */
  url: null | string
}

/** One stable ordered Asset input connected to a semantic model slot. */
export interface CreateAttachment {
  /** Canonical Asset facts shown in the composer. */
  asset: CreateAssetReference
  /** Stable local identity independent from list position. */
  attachmentId: string
  /** Semantic generation input handle selected by the user. */
  slotId: string
}

/** Complete browser-local direct generation request. */
export interface CreateDraft {
  /** Selected task-specific Audio node type. */
  audioIntent: AudioIntentNodeType
  /** Ordered canonical Asset inputs. */
  attachments: CreateAttachment[]
  /** Inline lyrics used by Music when supported. */
  lyrics: string
  /** Selected top-level media mode. */
  mode: CreateMode
  /** Pinned catalog contract used by this mutable local request. */
  modelContractVersion: string
  /** Canonical creative model identifier. */
  modelId: string
  /** Current resolver-selected operation. */
  operationId: string
  /** Persisted structured prompt, never Tiptap editor JSON. */
  prompt: PromptTemplate
  /** Current provider-neutral catalog setting values. */
  settings: Record<string, GenerationSettingValue>
}

/** Maps a Create mode and Audio intent to a shared generation contract type. */
export function createNodeType(
  mode: CreateMode,
  audioIntent: AudioIntentNodeType,
): Exclude<FlowNodeType, 'asset' | 'audioGeneration' | 'element' | 'llm' | 'text'> {
  if (mode === 'image')
    return 'imageGeneration'
  if (mode === 'video')
    return 'videoGeneration'
  return audioIntent
}

function generationDefaults(nodeType: ReturnType<typeof createNodeType>) {
  return getDefaultNodeData(nodeType) as {
    modelContractVersion: string
    modelId: string
    operationId: string
    settings: Record<string, GenerationSettingValue>
  }
}

/** Creates one empty Image-first request using catalog-owned defaults. */
export function createEmptyCreateDraft(): CreateDraft {
  const audioIntent = 'speechGeneration'
  const mode = 'image'
  const defaults = generationDefaults(createNodeType(mode, audioIntent))
  return {
    attachments: [],
    audioIntent,
    lyrics: '',
    mode,
    modelContractVersion: defaults.modelContractVersion,
    modelId: defaults.modelId,
    operationId: defaults.operationId,
    prompt: promptTemplateFromText(''),
    settings: { ...defaults.settings },
  }
}

/** Resets task-specific inputs while adopting the selected generation family. */
export function resetCreateDraftMode(
  draft: CreateDraft,
  mode: CreateMode,
  audioIntent: AudioIntentNodeType = draft.audioIntent,
): CreateDraft {
  const defaults = generationDefaults(createNodeType(mode, audioIntent))
  return {
    ...draft,
    attachments: [],
    audioIntent,
    lyrics: '',
    mode,
    modelContractVersion: defaults.modelContractVersion,
    modelId: defaults.modelId,
    operationId: defaults.operationId,
    prompt: promptTemplateFromText(''),
    settings: { ...defaults.settings },
  }
}

/** Normalizes an existing Asset response into the narrow Create attachment shape. */
export function toCreateAssetReference(
  asset: Asset | FlowReferenceAsset,
): CreateAssetReference | null {
  if (asset.type === 'document')
    return null
  return {
    id: asset.id,
    mimeType: asset.mimeType,
    name: asset.name,
    processingState: asset.processingState,
    thumbnailUrl: asset.thumbnailUrl,
    type: asset.type,
    url: asset.url,
  }
}

/** Creates a stable local attachment for one chosen semantic slot. */
export function createAttachment(
  asset: CreateAssetReference,
  slotId: string,
): CreateAttachment {
  return {
    asset,
    attachmentId: createId(),
    slotId,
  }
}

function removePromptInputAt(
  prompt: PromptTemplate,
  slotId: string,
  removedIndex: number,
): PromptTemplate {
  return {
    parts: prompt.parts.flatMap((part) => {
      if (part.type !== 'input' || part.slotId !== slotId)
        return [part]
      if (part.index === removedIndex)
        return []
      return [{
        ...part,
        index: part.index > removedIndex ? part.index - 1 : part.index,
      }]
    }),
    version: 1,
  }
}

/**
 * Detaches one exact Asset and rewrites structured references atomically so a
 * later index can never begin referring to a different Asset silently.
 */
export function removeCreateAttachment(
  draft: CreateDraft,
  attachmentId: string,
): CreateDraft {
  const attachment = draft.attachments.find(
    item => item.attachmentId === attachmentId,
  )
  if (!attachment)
    return draft
  const slotAttachments = draft.attachments.filter(
    item => item.slotId === attachment.slotId,
  )
  const removedIndex = slotAttachments.findIndex(
    item => item.attachmentId === attachmentId,
  )
  return {
    ...draft,
    attachments: draft.attachments.filter(
      item => item.attachmentId !== attachmentId,
    ),
    prompt: removePromptInputAt(
      draft.prompt,
      attachment.slotId,
      removedIndex,
    ),
  }
}

/** Reorders inputs while preserving each structured token's exact Asset identity. */
export function reorderCreateDraftAttachments(
  draft: CreateDraft,
  orderedAttachmentIds: readonly string[],
): CreateDraft {
  const byId = new Map(draft.attachments.map(item => [item.attachmentId, item]))
  const ordered = orderedAttachmentIds.flatMap(id => byId.get(id) ?? [])
  if (ordered.length !== draft.attachments.length)
    return draft
  const attachments = ordered
  const groupBySlot = (items: readonly CreateAttachment[]) => {
    const slots = new Map<string, CreateAttachment[]>()
    for (const item of items)
      slots.set(item.slotId, [...(slots.get(item.slotId) ?? []), item])
    return slots
  }
  const oldSlots = groupBySlot(draft.attachments)
  const newSlots = groupBySlot(attachments)
  const parts: PromptTemplate['parts'] = []
  for (const part of draft.prompt.parts) {
    if (part.type !== 'input') {
      parts.push(part)
      continue
    }
    const referenced = oldSlots.get(part.slotId)?.[part.index]
    if (!referenced)
      continue
    const nextIndex = newSlots.get(part.slotId)?.findIndex(
      item => item.attachmentId === referenced.attachmentId,
    ) ?? -1
    if (nextIndex >= 0)
      parts.push({ ...part, index: nextIndex })
  }
  const prompt: PromptTemplate = { parts, version: 1 }
  return { ...draft, attachments, prompt }
}

/** Returns whether the draft contains user-authored request state. */
export function hasCreateDraftContent(draft: CreateDraft): boolean {
  return draft.attachments.length > 0
    || draft.lyrics.trim().length > 0
    || draft.prompt.parts.length > 0
}

/** Clears submitted request inputs while retaining the selected model controls. */
export function clearSubmittedCreateDraft(draft: CreateDraft): CreateDraft {
  return {
    ...draft,
    attachments: [],
    lyrics: '',
    prompt: promptTemplateFromText(''),
  }
}

/** Current catalog contract used when a user selects a new model. */
export const CREATE_MODEL_CONTRACT_VERSION = GENERATION_MODEL_CONTRACT_VERSION
