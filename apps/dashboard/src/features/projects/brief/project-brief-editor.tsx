/** Bounded Project Brief editor with Project-aware mentions and previews. */

import type { ProjectMentionResolution } from '@talelabs/sdk'
import type { JSONContent } from '@tiptap/core'

import { cn } from '@talelabs/ui/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { EditorContent, useEditor } from '@tiptap/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAssetViewerUrlState } from '../../assets/viewer/use-asset-viewer-url-state'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'
import { projectMentionSearchQueryOptions } from '../project-queries'
import { PROJECT_BRIEF_DOCUMENT_CLASS_NAME } from './project-brief-document-style'
import { createProjectBriefExtensions } from './project-brief-extensions'
import { ProjectBriefToolbar } from './project-brief-toolbar'

/** Edits one Brief JSON document and emits every authoritative local change. */
export function ProjectBriefEditor({
  document,
  mentions,
  projectId,
  onChange,
}: {
  /** Initial authoritative Tiptap JSON for this editor mount. */
  document: Record<string, unknown>
  /** Batch-resolved presentation for persisted references. */
  mentions: ProjectMentionResolution[]
  /** Project used for mention search and canonical mention links. */
  projectId: string
  /** Receives the full JSON document after each editor transaction. */
  onChange: (document: JSONContent) => void
}) {
  const { t } = useTranslation()
  const { openAsset } = useAssetViewerUrlState()
  const organizationId = useActiveOrganizationId()
  const queryClient = useQueryClient()
  const unavailableLabel = t('projects.briefMentionUnavailable')
  const suggestion = useMemo(() => ({
    copy: {
      empty: t('projects.briefMentionEmpty'),
      groups: {
        asset: t('projects.mentionTypes.asset'),
        element: t('projects.mentionTypes.element'),
        flow: t('projects.mentionTypes.flow'),
        folder: t('projects.mentionTypes.folder'),
        session: t('projects.mentionTypes.session'),
      },
    },
    getItems: async (query: string) => {
      if (!organizationId)
        return []
      try {
        const response = await queryClient.fetchQuery(
          projectMentionSearchQueryOptions({
            organizationId,
            projectId,
            search: query.trim(),
          }),
        )
        return response.groups.flatMap(group => group.items)
      }
      catch {
        return []
      }
    },
  }), [organizationId, projectId, queryClient, t])
  const mentionPresentation = useMemo(() => ({
    mentions,
    onOpenAsset: openAsset,
    unavailableLabel,
  }), [mentions, openAsset, unavailableLabel])
  const taskOptions = useMemo(() => ({
    checkboxLabel: (taskText: string) =>
      `${t('projects.briefTaskList')}: ${taskText}`,
  }), [t])
  const editor = useEditor({
    content: document,
    editorProps: {
      attributes: {
        'aria-label': t('projects.briefEditorLabel'),
        'class': 'min-h-[55vh] cursor-text outline-none',
        'role': 'textbox',
      },
    },
    extensions: createProjectBriefExtensions(
      projectId,
      suggestion,
      mentionPresentation,
      taskOptions,
    ),
    immediatelyRender: true,
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getJSON())
    },
  }, [mentionPresentation, projectId, suggestion, taskOptions])

  if (!editor)
    return null

  return (
    <div className="relative min-h-[55vh]">
      <ProjectBriefToolbar editor={editor} />
      <EditorContent
        className={cn(
          PROJECT_BRIEF_DOCUMENT_CLASS_NAME,
          'min-h-[55vh]',
        )}
        editor={editor}
      />
    </div>
  )
}
