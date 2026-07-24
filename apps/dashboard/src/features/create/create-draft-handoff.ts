/**
 * One-time React Router handoff for a Project Home direct Create draft.
 *
 * Same-tab storage remains the refresh-recovery owner. This state bridges the
 * immediate route transition without making navigation state durable truth.
 */

import type { CreateAttachment, CreateDraft } from './create-draft'

import { PromptTemplateSchema } from '@talelabs/flows'
import { CREATE_AUDIO_INTENTS } from './create-draft'

const HANDOFF_STATE_KEY = 'talelabsCreateDraftHandoff'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
}

function isNullableString(value: unknown): value is null | string {
  return value === null || typeof value === 'string'
}

function isCreateAttachment(value: unknown): value is CreateAttachment {
  if (!isRecord(value) || !isRecord(value.asset))
    return false
  return typeof value.attachmentId === 'string'
    && typeof value.slotId === 'string'
    && typeof value.asset.id === 'string'
    && typeof value.asset.mimeType === 'string'
    && typeof value.asset.name === 'string'
    && ['failed', 'processing', 'ready'].includes(
      String(value.asset.processingState),
    )
    && isNullableString(value.asset.thumbnailUrl)
    && ['audio', 'image', 'video'].includes(String(value.asset.type))
    && isNullableString(value.asset.url)
}

function parseCreateDraft(value: unknown): CreateDraft | null {
  if (
    !isRecord(value)
    || !['audio', 'image', 'video'].includes(String(value.mode))
    || !CREATE_AUDIO_INTENTS.includes(
      value.audioIntent as CreateDraft['audioIntent'],
    )
    || !Array.isArray(value.attachments)
    || !value.attachments.every(isCreateAttachment)
    || typeof value.lyrics !== 'string'
    || typeof value.modelContractVersion !== 'string'
    || typeof value.modelId !== 'string'
    || typeof value.operationId !== 'string'
    || !isRecord(value.settings)
  ) {
    return null
  }
  const prompt = PromptTemplateSchema.safeParse(value.prompt)
  if (!prompt.success)
    return null
  return structuredClone({
    ...value,
    prompt: prompt.data,
  } as CreateDraft)
}

/**
 * Creates bounded navigation state for the immediate Home-to-Create handoff.
 */
export function createDraftHandoffState(draft: CreateDraft) {
  return {
    [HANDOFF_STATE_KEY]: {
      draft: structuredClone(draft),
      version: 1,
    },
  }
}

/**
 * Reads one validated direct Create draft from internal navigation state.
 */
export function readCreateDraftHandoffState(state: unknown): CreateDraft | null {
  if (!isRecord(state))
    return null
  const handoff = state[HANDOFF_STATE_KEY]
  if (!isRecord(handoff) || handoff.version !== 1)
    return null
  return parseCreateDraft(handoff.draft)
}
