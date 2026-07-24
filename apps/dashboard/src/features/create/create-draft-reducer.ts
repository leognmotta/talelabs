/** Route-level reducer for the one current unsaved Create request. */

import type {
  AudioIntentNodeType,
  GenerationModelDefinition,
  GenerationSettingValue,
  PromptTemplate,
} from '@talelabs/flows'
import type {
  CreateAttachment,
  CreateDraft,
  CreateMode,
} from './create-draft'

import {
  removeCreateAttachment,
  reorderCreateDraftAttachments,
  resetCreateDraftMode,
} from './create-draft'
import {
  canAddCreateAttachment,
  transitionCreateDraftModel,
} from './create-resolution'

/** One undoable model transition that detached request inputs. */
export interface CreateDraftDetachNotice {
  /** Number of inputs no longer accepted by the selected catalog model. */
  count: number
  /** Exact prior draft restored by the local undo command. */
  previousDraft: CreateDraft
}

/** Route-owned request plus one nearby undoable reconciliation notice. */
export interface CreateDraftState {
  /** Current provider-neutral request composition. */
  draft: CreateDraft
  /** Latest model-switch detachment, or null after any unrelated edit. */
  notice: CreateDraftDetachNotice | null
}

/** Explicit draft transitions accepted by the Create route owner. */
export type CreateDraftAction
  = | { attachment: CreateAttachment, type: 'addAttachment' }
    | { attachmentId: string, type: 'removeAttachment' }
    | { attachmentIds: string[], type: 'reorderAttachments' }
    | { audioIntent: AudioIntentNodeType, type: 'setAudioIntent' }
    | { lyrics: string, type: 'setLyrics' }
    | { mode: CreateMode, type: 'setMode' }
    | { model: GenerationModelDefinition, type: 'setModel' }
    | { prompt: PromptTemplate, type: 'setPrompt' }
    | { settingId: string, type: 'setSetting', value: GenerationSettingValue }
    | { draft: CreateDraft, type: 'replace' }
    | { type: 'undoModelDetach' }

/** Applies one user-authored Create request transition without server state. */
export function createDraftReducer(
  state: CreateDraftState,
  action: CreateDraftAction,
): CreateDraftState {
  if (action.type === 'replace')
    return { draft: action.draft, notice: null }
  if (action.type === 'undoModelDetach') {
    return state.notice
      ? { draft: state.notice.previousDraft, notice: null }
      : state
  }
  if (action.type === 'setMode') {
    return {
      draft: resetCreateDraftMode(state.draft, action.mode),
      notice: null,
    }
  }
  if (action.type === 'setAudioIntent') {
    return {
      draft: resetCreateDraftMode(state.draft, 'audio', action.audioIntent),
      notice: null,
    }
  }
  if (action.type === 'setModel') {
    const transition = transitionCreateDraftModel(state.draft, action.model)
    if (!transition)
      return state
    return {
      draft: transition.draft,
      notice: transition.detachedAttachments.length > 0
        ? {
            count: transition.detachedAttachments.length,
            previousDraft: state.draft,
          }
        : null,
    }
  }
  if (action.type === 'addAttachment') {
    if (!canAddCreateAttachment(state.draft, action.attachment))
      return state
    return {
      draft: {
        ...state.draft,
        attachments: [...state.draft.attachments, action.attachment],
      },
      notice: null,
    }
  }
  if (action.type === 'removeAttachment') {
    return {
      draft: removeCreateAttachment(state.draft, action.attachmentId),
      notice: null,
    }
  }
  if (action.type === 'reorderAttachments') {
    return {
      draft: reorderCreateDraftAttachments(state.draft, action.attachmentIds),
      notice: null,
    }
  }
  if (action.type === 'setPrompt') {
    return {
      draft: { ...state.draft, prompt: action.prompt },
      notice: null,
    }
  }
  if (action.type === 'setLyrics') {
    return {
      draft: { ...state.draft, lyrics: action.lyrics },
      notice: null,
    }
  }
  return {
    draft: {
      ...state.draft,
      settings: {
        ...state.draft.settings,
        [action.settingId]: action.value,
      },
    },
    notice: null,
  }
}
