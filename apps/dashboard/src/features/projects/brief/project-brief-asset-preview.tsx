/** Project Brief mention NodeView over current presentation-only metadata. */

import type { ReactNodeViewProps } from '@tiptap/react'
import type {
  ProjectEntityMentionAttributes,
  ProjectEntityMentionRuntimeOptions,
} from './project-brief-extensions'

import { NodeViewWrapper } from '@tiptap/react'

import {
  ProjectBriefAssetMentionPreview,
} from './project-brief-asset-mention-preview'
import { projectMentionHref } from './project-brief-extensions'
import {
  ProjectBriefFolderMentionLink,
} from './project-brief-folder-mention-link'

/** Renders one Project mention through current presentation-only metadata. */
export function ProjectBriefMentionNodeView(props: ReactNodeViewProps) {
  const attributes = props.node.attrs as ProjectEntityMentionAttributes
  const options = props.extension.options as ProjectEntityMentionRuntimeOptions
  const resolution = options.resolvedByKey.get(
    `${attributes.entityType}:${attributes.entityId}`,
  )
  const label = resolution?.label || attributes.fallbackLabel

  if (resolution && !resolution.available) {
    return (
      <NodeViewWrapper
        as="span"
        aria-label={`${label} (${options.presentation!.unavailableLabel})`}
        className="
          rounded-sm bg-muted px-1 text-muted-foreground line-through
          decoration-muted-foreground/60
        "
        data-project-entity-mention=""
        data-project-entity-unavailable=""
        title={options.presentation!.unavailableLabel}
      >
        {`@${label} (${options.presentation!.unavailableLabel})`}
      </NodeViewWrapper>
    )
  }

  if (attributes.entityType === 'folder') {
    return (
      <ProjectBriefFolderMentionLink
        attributes={attributes}
        label={label}
        options={options}
      />
    )
  }

  if (
    attributes.entityType === 'asset'
    && resolution?.available
    && resolution.asset
  ) {
    return (
      <ProjectBriefAssetMentionPreview
        attributes={attributes}
        options={options}
        resolution={resolution}
      />
    )
  }

  return (
    <NodeViewWrapper as="span" data-project-entity-mention="">
      <a
        className="
          rounded-sm bg-primary/10 px-1 text-primary
          hover:underline
        "
        href={projectMentionHref(options.projectId, attributes)}
      >
        {`@${label}`}
      </a>
    </NodeViewWrapper>
  )
}
