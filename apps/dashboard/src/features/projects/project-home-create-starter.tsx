/**
 * Project Home entry point into the canonical direct Create workspace.
 *
 * This surface owns only a structured local draft handoff. Model resolution,
 * settings, references, admission, execution, and history remain owned by the
 * existing Project-scoped Create route.
 */

import type { CreateDraft, CreateMode } from '../create/create-draft'

import { IconArrowRight } from '@tabler/icons-react'
import { isPromptTemplateEmpty } from '@talelabs/flows'
import { Button } from '@talelabs/ui/components/button'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useSession } from '../auth/auth-client'
import { CreateComposerFrame } from '../create/create-composer-frame'
import { CreateComposerModeTabs } from '../create/create-composer-mode-tabs'
import {
  getCreatePromptLabelKey,
  getCreatePromptPlaceholderKey,
} from '../create/create-composer-prompt-copy'
import {
  createEmptyCreateDraft,
  resetCreateDraftMode,
} from '../create/create-draft'
import { writeCreateDraftCache } from '../create/create-draft-cache'
import { createDraftHandoffState } from '../create/create-draft-handoff'
import { PromptComposer } from '../generation/prompt-composer/prompt-composer'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'

const EMPTY_PROMPT_INPUTS = [] as const

function transitionMode(draft: CreateDraft, mode: CreateMode): CreateDraft {
  return {
    ...resetCreateDraftMode(draft, mode),
    prompt: draft.prompt,
  }
}

/** Renders a chat-like structured prompt that continues in Project Create. */
export function ProjectHomeCreateStarter({
  projectId,
}: {
  /** Project that owns the unsaved Create draft and its future session. */
  projectId: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const organizationId = useActiveOrganizationId()
  const session = useSession()
  const userId = session.data?.user.id
  const [draft, setDraft] = useState(createEmptyCreateDraft)
  const promptEmpty = isPromptTemplateEmpty(draft.prompt)
  const canContinue = Boolean(organizationId && userId && !promptEmpty)

  function continueInCreate() {
    if (!organizationId || !userId || promptEmpty)
      return
    writeCreateDraftCache({
      createSessionId: null,
      draft,
      organizationId,
      projectId,
      userId,
    })
    navigate(`/projects/${projectId}/create`, {
      state: createDraftHandoffState(draft),
    })
  }

  return (
    <CreateComposerFrame
      aria-label={t('create.composer.label')}
      className="
        mx-auto mt-8 w-full max-w-3xl
        shadow-[0_20px_64px_var(--shadow-color-soft)]
      "
      onKeyDownCapture={(event) => {
        const target = event.target
        if (
          event.key === 'Enter'
          && !event.shiftKey
          && !event.nativeEvent.isComposing
          && target instanceof HTMLElement
          && target.closest('[role="textbox"]')
        ) {
          event.preventDefault()
          continueInCreate()
        }
      }}
      onSubmit={(event) => {
        event.preventDefault()
        continueInCreate()
      }}
    >
      <div className="
        flex min-w-0 items-center gap-2 px-3 pt-3
        sm:px-4
      "
      >
        <CreateComposerModeTabs
          mode={draft.mode}
          onModeChange={(mode) => {
            setDraft(current => transitionMode(current, mode))
          }}
        />
      </div>
      <div className="
        min-w-0 p-3
        sm:px-4
      "
      >
        <PromptComposer
          key={draft.mode}
          className="
            max-h-24 min-h-16 rounded-none border-0 bg-transparent p-0
            text-sm/relaxed
            focus-within:border-transparent focus-within:bg-transparent
            hover:bg-transparent
          "
          id="project-home-create-prompt"
          inputs={EMPTY_PROMPT_INPUTS}
          label={t(getCreatePromptLabelKey(draft))}
          mountEditorImmediately
          placeholder={t(getCreatePromptPlaceholderKey(draft))}
          template={draft.prompt}
          onChange={(prompt) => {
            setDraft(current => ({ ...current, prompt }))
          }}
        />
      </div>
      <div className="
        flex items-center justify-end border-t border-border/65 px-3 py-2.5
        sm:px-4
      "
      >
        <Button
          className="h-10 rounded-xl px-4"
          disabled={!canContinue}
          type="submit"
        >
          {t('navigation.create')}
          <IconArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </CreateComposerFrame>
  )
}
