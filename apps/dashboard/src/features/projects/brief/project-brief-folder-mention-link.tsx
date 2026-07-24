/** Navigable inline folder reference for one Project Brief mention. */

import type {
  ProjectEntityMentionAttributes,
  ProjectEntityMentionRuntimeOptions,
} from './project-brief-extensions'

import { IconFolder } from '@tabler/icons-react'
import { NodeViewWrapper } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { projectMentionHref } from './project-brief-extensions'

/** Opens the mentioned folder through the canonical Project Asset route. */
export function ProjectBriefFolderMentionLink({
  attributes,
  label,
  options,
}: {
  /** Stable attributes persisted in the Tiptap mention node. */
  attributes: ProjectEntityMentionAttributes
  /** Current presentation label for the folder. */
  label: string
  /** Project route and ephemeral mention presentation behavior. */
  options: ProjectEntityMentionRuntimeOptions
}) {
  const { t } = useTranslation()

  return (
    <NodeViewWrapper
      as="span"
      className="inline-flex max-w-full align-baseline"
      data-project-entity-mention=""
    >
      <Link
        aria-label={t('assets.openFolder', { name: label })}
        className="
          inline-flex max-w-full items-center gap-1 rounded-sm px-0.5
          text-foreground/90 underline decoration-border underline-offset-4
          transition-colors
          hover:text-foreground hover:decoration-muted-foreground
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:outline-none
        "
        data-project-folder-mention=""
        title={label}
        to={projectMentionHref(options.projectId, attributes)}
      >
        <IconFolder
          aria-hidden
          className="size-[0.95em] shrink-0 text-muted-foreground"
        />
        <span className="truncate">{label}</span>
      </Link>
    </NodeViewWrapper>
  )
}
