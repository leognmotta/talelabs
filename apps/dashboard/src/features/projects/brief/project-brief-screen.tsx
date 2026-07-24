/**
 * Project Brief read/edit composition with revision compare-and-set autosave.
 */

import type { JSONContent } from '@tiptap/core'

import { IconEdit } from '@tabler/icons-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@talelabs/ui/components/alert'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { getApiErrorCode } from '../../../shared/lib/api-error'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { useSaveProjectBriefMutation } from '../project-mutations'
import { useProjectBriefQuery } from '../project-queries'
import { ProjectBriefContent } from './project-brief-content'
import { ProjectBriefEditor } from './project-brief-editor'

const EMPTY_BRIEF = { content: [], type: 'doc' }
type SaveState = 'conflict' | 'dirty' | 'error' | 'saved' | 'saving'

/** Renders a clean read view and an explicitly entered bounded edit mode. */
export function ProjectBriefScreen() {
  const { t } = useTranslation()
  const { projectId } = useParams<{ projectId: string }>()
  const organizationId = useActiveOrganizationId()
  const query = useProjectBriefQuery(projectId ?? null)
  const mutation = useSaveProjectBriefMutation({
    organizationId,
    projectId: projectId ?? '',
  })
  const [document, setDocument] = useState<Record<string, unknown>>(EMPTY_BRIEF)
  const [editing, setEditing] = useState(false)
  const [editorSession, setEditorSession] = useState(0)
  const [revision, setRevision] = useState(0)
  const [saveWake, setSaveWake] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [version, setVersion] = useState(0)
  const versionRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const saveStateRef = useRef<SaveState>('saved')
  const brief = query.data
  const briefRef = useRef(brief)
  saveStateRef.current = saveState
  briefRef.current = brief

  const saveDraft = useCallback(async () => {
    if (
      !projectId
      || saveInFlightRef.current
      || saveState === 'saved'
      || saveState === 'conflict'
    ) {
      return false
    }
    const savingVersion = versionRef.current
    let retryNewerEdits = false
    saveInFlightRef.current = true
    setSaveState('saving')
    try {
      const saved = await mutation.mutateAsync({
        document,
        expectedRevision: revision,
      })
      setRevision(saved.revision)
      const fullySaved = versionRef.current === savingVersion
      retryNewerEdits = !fullySaved
      if (fullySaved) {
        setDocument(saved.document)
        setSaveState('saved')
      }
      else {
        setSaveState('dirty')
      }
      return fullySaved
    }
    catch (error) {
      setSaveState(getApiErrorCode(error) === 'revision_conflict'
        ? 'conflict'
        : 'error')
      return false
    }
    finally {
      saveInFlightRef.current = false
      if (retryNewerEdits)
        setSaveWake(current => current + 1)
    }
  }, [document, mutation, projectId, revision, saveState])

  useEffect(() => {
    if (saveState !== 'dirty')
      return
    const timeout = globalThis.setTimeout(() => {
      void saveDraft()
    }, 800)
    return () => globalThis.clearTimeout(timeout)
  }, [saveDraft, saveState, saveWake, version])

  const changeDocument = useCallback((next: JSONContent) => {
    versionRef.current += 1
    setVersion(versionRef.current)
    setDocument(next as Record<string, unknown>)
    setSaveState('dirty')
  }, [])

  const changeReadOnlyTaskDocument = useCallback((next: JSONContent) => {
    const currentBrief = briefRef.current
    if (!currentBrief || saveStateRef.current === 'conflict')
      return
    if (saveStateRef.current === 'saved')
      setRevision(currentBrief.revision)
    changeDocument(next)
  }, [changeDocument])

  async function reloadLatest() {
    const result = await query.refetch()
    if (!result.data)
      return
    setDocument(result.data.document)
    setRevision(result.data.revision)
    setSaveState('saved')
    setEditorSession(current => current + 1)
  }

  async function finishEditing() {
    if (saveState === 'dirty' || saveState === 'error') {
      const saved = await saveDraft()
      if (!saved)
        return
    }
    if (saveState === 'saving' || saveState === 'conflict')
      return
    setEditing(false)
  }

  function startEditing() {
    if (!brief)
      return
    setDocument(brief.document)
    setRevision(brief.revision)
    setSaveState('saved')
    setEditorSession(current => current + 1)
    setEditing(true)
  }

  if (query.isPending) {
    return (
      <div className="flex min-h-full flex-1 flex-col">
        <div className="h-12 shrink-0" />
        <div className="
          mx-auto w-full max-w-[900px] px-6 pt-12 pb-24
          sm:px-10
          md:pt-20
          lg:px-14
        "
        >
          <Skeleton className="h-12 w-56" />
          <div className="mt-12 space-y-4">
            <Skeleton className="h-5 w-full max-w-2xl" />
            <Skeleton className="h-5 w-full max-w-xl" />
            <Skeleton className="h-5 w-full max-w-2xl" />
          </div>
        </div>
      </div>
    )
  }
  if (query.isError || !brief || !projectId) {
    return (
      <Empty className="min-h-full flex-1">
        <EmptyHeader>
          <EmptyTitle>{t('projects.briefCouldNotLoad')}</EmptyTitle>
          <EmptyDescription>
            {t('projects.couldNotLoadDescription')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const empty = brief.plainText.length === 0
  return (
    <div className="flex min-h-full w-full flex-1 flex-col">
      <header className="
        sticky top-0 z-20 flex h-12 shrink-0 items-center justify-end gap-2
        bg-background/90 px-3 backdrop-blur-sm
        sm:px-5
      "
      >
        {editing
          ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {t(`projects.briefSaveState.${saveState}`)}
                </span>
                <Button
                  disabled={saveState === 'saving' || saveState === 'conflict'}
                  size="sm"
                  variant="ghost"
                  onClick={() => void finishEditing()}
                >
                  {t('common.done')}
                </Button>
              </>
            )
          : (
              <>
                {saveState !== 'saved' && (
                  <span className="text-xs text-muted-foreground">
                    {t(`projects.briefSaveState.${saveState}`)}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={startEditing}
                >
                  <IconEdit data-icon="inline-start" />
                  {t('common.edit')}
                </Button>
              </>
            )}
      </header>

      <article
        aria-labelledby="project-brief-title"
        className="
          mx-auto flex w-full max-w-[900px] flex-1 flex-col px-6 pt-12 pb-24
          sm:px-10
          md:pt-20
          lg:px-14
        "
      >
        <h1
          className="
            text-4xl font-bold tracking-[-0.035em]
            sm:text-5xl
          "
          id="project-brief-title"
        >
          {t('projects.brief')}
        </h1>

        <div className="mt-10 flex-1">
          {saveState === 'conflict' && (
            <Alert className="mb-8" variant="destructive">
              <AlertTitle>{t('projects.briefConflictTitle')}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{t('projects.briefConflictDescription')}</span>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void reloadLatest()}
                >
                  {t('projects.briefReload')}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {saveState === 'error' && (
            <Alert className="mb-8" variant="destructive">
              <AlertTitle>{t('projects.briefSaveFailed')}</AlertTitle>
              <AlertDescription>
                {t('projects.briefSaveFailedDescription')}
              </AlertDescription>
            </Alert>
          )}

          {editing
            ? (
                <ProjectBriefEditor
                  document={document}
                  key={`${projectId}:${editorSession}`}
                  mentions={brief.mentions}
                  projectId={projectId}
                  onChange={changeDocument}
                />
              )
            : empty
              ? (
                  <div className="max-w-xl">
                    <p className="text-base/7 text-muted-foreground">
                      {t('projects.briefEmptyDescription')}
                    </p>
                    <Button
                      className="mt-4 -ml-3"
                      variant="ghost"
                      onClick={startEditing}
                    >
                      <IconEdit data-icon="inline-start" />
                      {t('projects.briefStart')}
                    </Button>
                  </div>
                )
              : (
                  <ProjectBriefContent
                    document={saveState === 'saved'
                      ? brief.document
                      : document}
                    mentions={brief.mentions}
                    projectId={projectId}
                    onTaskChange={saveState === 'conflict'
                      ? undefined
                      : changeReadOnlyTaskDocument}
                  />
                )}
        </div>
      </article>
    </div>
  )
}
