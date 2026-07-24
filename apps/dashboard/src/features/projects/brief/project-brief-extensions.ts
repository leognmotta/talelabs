/**
 * Bounded Tiptap schema and navigational Project-entity mention primitive.
 *
 * These extensions intentionally exclude prompt-reference behavior and every
 * document feature the server-side Brief validator does not persist.
 */

import type {
  ProjectMentionResolution,
  ProjectMentionType,
} from '@talelabs/sdk'
import type { DOMOutputSpecArray, JSONContent } from '@tiptap/core'
import type { TaskItemOptions } from '@tiptap/extension-task-item'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { RefAttributes } from 'react'
import type {
  ProjectBriefMentionMenuCopy,
  ProjectBriefMentionMenuHandle,
  ProjectBriefMentionMenuProps,
} from './project-brief-mention-menu'

import { mergeAttributes, Node } from '@tiptap/core'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Suggestion, {
  exitSuggestion,
  SuggestionPluginKey,
} from '@tiptap/suggestion'
import {
  ProjectBriefMentionNodeView,
} from './project-brief-asset-preview'
import {
  ProjectBriefMentionMenu,
} from './project-brief-mention-menu'

type ProjectBriefMentionRendererProps
  = Omit<ProjectBriefMentionMenuProps, 'ref'>
    & RefAttributes<ProjectBriefMentionMenuHandle>

interface ProjectBriefSuggestionInput {
  copy: ProjectBriefMentionMenuCopy
  getItems: (query: string) => Promise<ProjectMentionResolution[]>
}

/** Read-only resolution metadata kept outside the authoritative Brief JSON. */
export interface ProjectBriefMentionPresentation {
  /** Current server-resolved state for every persisted mention identity. */
  mentions: readonly ProjectMentionResolution[]
  /** Opens an Asset through the shared URL-addressable viewer. */
  onOpenAsset?: (assetId: string) => void
  /** Localized label appended when an identity is no longer Project-visible. */
  unavailableLabel: string
}

/** Runtime-only presentation shared with the Project mention React NodeView. */
export interface ProjectEntityMentionRuntimeOptions {
  /** Current read/edit presentation and optional shared Asset viewer action. */
  presentation?: ProjectBriefMentionPresentation
  /** Project route context used for non-Asset mention links. */
  projectId: string
  /** Current lookup including persisted and newly suggested mentions. */
  resolvedByKey: Map<string, ProjectMentionResolution>
}

/** Optional localized and read-only interaction behavior for task items. */
export interface ProjectBriefTaskOptions {
  /** Builds the accessible checkbox label from the task's current text. */
  checkboxLabel: (taskText: string) => string
  /** Persists a checkbox change made while the Brief is in read mode. */
  onReadOnlyChecked?: NonNullable<TaskItemOptions['onReadOnlyChecked']>
}

/** Stable attributes persisted on one Project Brief mention atom. */
export interface ProjectEntityMentionAttributes {
  /** Stable entity identifier independent from its label. */
  entityId: string
  /** Entity family used for validation and navigation. */
  entityType: ProjectMentionType
  /** Last-known readable label retained when the entity is unavailable. */
  fallbackLabel: string
}

/** Builds the canonical fallback route for one Project mention. */
export function projectMentionHref(
  projectId: string,
  attributes: ProjectEntityMentionAttributes,
) {
  const base = `/projects/${projectId}`
  switch (attributes.entityType) {
    case 'asset':
      return `${base}/assets?asset=${attributes.entityId}`
    case 'element':
      return `${base}/elements/${attributes.entityId}`
    case 'flow':
      return `${base}/flows/${attributes.entityId}`
    case 'folder':
      return `${base}/assets?folder=${attributes.entityId}`
    case 'session':
      return `${base}/create/${attributes.entityId}`
  }
}

function mentionKey(
  mention: Pick<ProjectMentionResolution, 'entityId' | 'entityType'>,
) {
  return `${mention.entityType}:${mention.entityId}`
}

function assetMentionPreview(
  attributes: Record<string, unknown>,
  href: string,
  label: string,
  thumbnailUrl: null | string,
): DOMOutputSpecArray {
  const preview: DOMOutputSpecArray = thumbnailUrl
    ? [
        'img',
        {
          alt: '',
          class: 'pointer-events-none size-full object-cover',
          draggable: 'false',
          src: thumbnailUrl,
        },
      ]
    : [
        'span',
        {
          'aria-hidden': 'true',
          'class': `
            pointer-events-none flex size-full items-center justify-center
            bg-muted
          `,
        },
      ]
  return [
    'a',
    mergeAttributes(attributes, {
      'aria-label': label,
      'class': `
        group relative my-2 inline-flex aspect-video w-56 max-w-full
        overflow-hidden rounded-xl border border-border bg-muted align-middle
        shadow-sm transition
        hover:border-foreground/20 hover:shadow-md
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
      `,
      'data-project-asset-mention-preview': '',
      'data-project-entity-mention': '',
      href,
      'title': label,
    }),
    preview,
  ]
}

function suggestionMenu(input: ProjectBriefSuggestionInput) {
  let component: null | ReactRenderer<
    ProjectBriefMentionMenuHandle,
    ProjectBriefMentionRendererProps
  > = null
  let unmount: (() => void) | null = null

  function menuProps(props: SuggestionProps<ProjectMentionResolution>) {
    return {
      copy: input.copy,
      items: props.items,
      onSelect: props.command,
    }
  }

  return {
    onExit() {
      unmount?.()
      component?.destroy()
      unmount = null
      component = null
    },
    onKeyDown({ event, view }: SuggestionKeyDownProps) {
      if (event.key === 'Escape') {
        exitSuggestion(view, SuggestionPluginKey)
        return true
      }
      return component?.ref?.onKeyDown(event) ?? false
    },
    onStart(props: SuggestionProps<ProjectMentionResolution>) {
      const nextComponent = new ReactRenderer(ProjectBriefMentionMenu, {
        editor: props.editor,
        props: menuProps(props),
      })
      nextComponent.element.style.zIndex = '50'
      component = nextComponent
      unmount = props.mount(nextComponent.element)
    },
    onUpdate(props: SuggestionProps<ProjectMentionResolution>) {
      component?.updateProps(menuProps(props))
    },
  }
}

/** Creates the stable inline mention node for one Project route context. */
export function createProjectEntityMentionExtension(
  projectId: string,
  suggestion?: ProjectBriefSuggestionInput,
  presentation?: ProjectBriefMentionPresentation,
) {
  const resolvedByKey = new Map(presentation?.mentions.map(mention => [
    mentionKey(mention),
    mention,
  ]))
  return Node.create<ProjectEntityMentionRuntimeOptions>({
    addOptions() {
      return {
        presentation,
        projectId,
        resolvedByKey,
      }
    },
    addAttributes() {
      return {
        entityId: { default: null },
        entityType: { default: null },
        fallbackLabel: { default: '' },
      }
    },
    addProseMirrorPlugins() {
      if (!suggestion)
        return []
      return [Suggestion<ProjectMentionResolution>({
        allowSpaces: true,
        char: '@',
        command: ({ editor, props, range }) => {
          editor.chain().focus().insertContentAt(range, [
            {
              attrs: {
                entityId: props.entityId,
                entityType: props.entityType,
                fallbackLabel: props.label,
              },
              type: this.name,
            },
            { text: ' ', type: 'text' },
          ]).run()
        },
        editor: this.editor,
        items: async ({ query }) => {
          const items = await suggestion.getItems(query)
          for (const item of items)
            resolvedByKey.set(mentionKey(item), item)
          return items
        },
        pluginKey: SuggestionPluginKey,
        render: () => suggestionMenu(suggestion),
      })]
    },
    addNodeView() {
      return ReactNodeViewRenderer(ProjectBriefMentionNodeView, {
        stopEvent: ({ event }) => {
          const target = event.target
          return target instanceof Element
            && Boolean(target.closest(`
              [data-project-asset-mention-preview],
              [data-project-folder-mention]
            `))
        },
      })
    },
    atom: true,
    group: 'inline',
    inline: true,
    name: 'projectEntityMention',
    parseHTML() {
      return [{ tag: 'a[data-project-entity-mention]' }]
    },
    renderHTML({ HTMLAttributes, node }) {
      const attributes = node.attrs as ProjectEntityMentionAttributes
      const resolution = resolvedByKey.get(
        `${attributes.entityType}:${attributes.entityId}`,
      )
      const label = resolution?.label || attributes.fallbackLabel
      if (resolution && !resolution.available) {
        return [
          'span',
          mergeAttributes(HTMLAttributes, {
            'aria-label': `${label} (${presentation!.unavailableLabel})`,
            'class': `
              rounded bg-muted px-1 text-muted-foreground line-through
              decoration-muted-foreground/60
            `,
            'data-project-entity-mention': '',
            'data-project-entity-unavailable': '',
            'title': presentation!.unavailableLabel,
          }),
          `@${label} (${presentation!.unavailableLabel})`,
        ]
      }
      const href = projectMentionHref(projectId, attributes)
      if (attributes.entityType === 'asset' && resolution?.available) {
        return assetMentionPreview(
          HTMLAttributes,
          href,
          label,
          resolution.thumbnailUrl,
        )
      }
      return [
        'a',
        mergeAttributes(HTMLAttributes, {
          'class': 'rounded bg-primary/10 px-1 text-primary hover:underline',
          'data-project-entity-mention': '',
          href,
        }),
        `@${label}`,
      ]
    },
    selectable: true,
  })
}

/** Creates the complete client schema matching the server Brief allowlist. */
export function createProjectBriefExtensions(
  projectId: string,
  suggestion?: ProjectBriefSuggestionInput,
  presentation?: ProjectBriefMentionPresentation,
  taskOptions?: ProjectBriefTaskOptions,
) {
  return [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4] },
      link: {
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
        openOnClick: true,
      },
      strike: false,
      underline: false,
    }),
    TaskList,
    TaskItem.configure({
      a11y: taskOptions
        ? {
            checkboxLabel: node =>
              taskOptions.checkboxLabel(node.textContent),
          }
        : undefined,
      nested: true,
      onReadOnlyChecked: taskOptions?.onReadOnlyChecked,
    }),
    createProjectEntityMentionExtension(projectId, suggestion, presentation),
  ]
}

/** Replaces mention fallback labels only in a read-only presentation clone. */
export function resolveProjectBriefPresentation(
  document: Record<string, unknown>,
  mentions: ProjectMentionResolution[],
): JSONContent {
  const labels = new Map(mentions.map(mention => [
    `${mention.entityType}:${mention.entityId}`,
    mention.label,
  ]))
  function visit(value: unknown): unknown {
    if (Array.isArray(value))
      return value.map(visit)
    if (!value || typeof value !== 'object')
      return value
    const node = value as Record<string, unknown>
    const copy = Object.fromEntries(
      Object.entries(node).map(([key, item]) => [key, visit(item)]),
    )
    if (
      node.type === 'projectEntityMention'
      && copy.attrs
      && typeof copy.attrs === 'object'
    ) {
      const attrs = copy.attrs as Record<string, unknown>
      const key = `${attrs.entityType}:${attrs.entityId}`
      const label = labels.get(key)
      if (label)
        attrs.fallbackLabel = label
    }
    return copy
  }
  return visit(document) as JSONContent
}
