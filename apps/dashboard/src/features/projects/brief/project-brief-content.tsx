/** Clean read-only Project Brief rendering over the authoritative Tiptap JSON. */

import type { ProjectMentionResolution } from '@talelabs/sdk'
import type { Editor, JSONContent } from '@tiptap/core'
import type { TaskItemOptions } from '@tiptap/extension-task-item'

import { cn } from '@talelabs/ui/lib/utils'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useAssetViewerUrlState } from '../../assets/viewer/use-asset-viewer-url-state'
import { PROJECT_BRIEF_DOCUMENT_CLASS_NAME } from './project-brief-document-style'
import {
  createProjectBriefExtensions,
  resolveProjectBriefPresentation,
} from './project-brief-extensions'

const EMPTY_PROJECT_MENTIONS: ProjectMentionResolution[] = []

/** Renders a Brief document without mounting any editing behavior. */
export function ProjectBriefContent({
  className,
  document,
  mentions = EMPTY_PROJECT_MENTIONS,
  projectId,
  onTaskChange,
}: {
  /** Optional surface styling. */
  className?: string
  /** Authoritative persisted Tiptap JSON. */
  document: Record<string, unknown>
  /** Current batch-resolved mention presentation. */
  mentions?: ProjectMentionResolution[]
  /** Project used to build canonical entity links. */
  projectId: string
  /** Persists an interactive read-mode task checkbox change. */
  onTaskChange?: (document: JSONContent) => void
}) {
  const { t } = useTranslation()
  const { openAsset } = useAssetViewerUrlState()
  const editorRef = useRef<Editor | null>(null)
  const taskPositionsRef = useRef(new WeakMap<object, number>())
  const content = useMemo(
    () => resolveProjectBriefPresentation(document, mentions),
    [document, mentions],
  )
  const unavailableLabel = t('projects.briefMentionUnavailable')
  const mentionPresentation = useMemo(() => ({
    mentions,
    onOpenAsset: openAsset,
    unavailableLabel,
  }), [mentions, openAsset, unavailableLabel])
  const onReadOnlyTaskChecked = useCallback<NonNullable<
    TaskItemOptions['onReadOnlyChecked']
  >>((taskNode, checked) => {
    const editor = editorRef.current
    if (!editor || editor.isDestroyed || !onTaskChange)
      return false
    let position = taskPositionsRef.current.get(taskNode)
    if (position === undefined) {
      const matchingPositions: number[] = []
      editor.state.doc.descendants((node, nodePosition) => {
        if (node.type.name !== 'taskItem')
          return true
        if (node === taskNode) {
          matchingPositions.length = 0
          matchingPositions.push(nodePosition)
          return false
        }
        if (node.eq(taskNode))
          matchingPositions.push(nodePosition)
        return true
      })
      if (matchingPositions.length === 1) {
        position = matchingPositions[0]
        taskPositionsRef.current.set(taskNode, position)
      }
    }
    if (position === undefined)
      return false
    const currentNode = editor.state.doc.nodeAt(position)
    if (!currentNode || currentNode.type.name !== 'taskItem')
      return false
    editor.view.dispatch(editor.state.tr.setNodeMarkup(
      position,
      undefined,
      { ...currentNode.attrs, checked },
    ))
    onTaskChange(editor.getJSON())
    return true
  }, [onTaskChange])
  const taskOptions = useMemo(() => ({
    checkboxLabel: (taskText: string) =>
      `${t('projects.briefTaskList')}: ${taskText}`,
    onReadOnlyChecked: onReadOnlyTaskChecked,
  }), [onReadOnlyTaskChecked, t])
  const extensions = useMemo(
    () => createProjectBriefExtensions(
      projectId,
      undefined,
      mentionPresentation,
      taskOptions,
    ),
    [mentionPresentation, projectId, taskOptions],
  )
  const editor = useEditor({
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
    extensions,
    immediatelyRender: true,
  }, [extensions])
  useEffect(() => {
    editorRef.current = editor
    return () => {
      if (editorRef.current === editor)
        editorRef.current = null
    }
  }, [editor])
  useEffect(() => {
    if (
      editor
      && !editor.isDestroyed
      && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)
    ) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  return (
    <EditorContent
      className={cn(
        PROJECT_BRIEF_DOCUMENT_CLASS_NAME,
        className,
      )}
      editor={editor}
    />
  )
}
