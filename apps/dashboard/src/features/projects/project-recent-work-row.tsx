/** Compact Project Home link for one recently edited creative source. */

import type { ProjectRecentWork } from '@talelabs/sdk'

import { IconGitBranch, IconSparkles } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { getResolvedLocale } from '../../i18n/i18n'

/** Renders one recent Flow or Create session with output metadata. */
export function ProjectRecentWorkRow({
  projectId,
  work,
}: {
  /** Project route identity used to compose the canonical source URL. */
  projectId: string
  /** Bounded recent source summary returned by Project Home. */
  work: ProjectRecentWork
}) {
  const { t } = useTranslation()
  const date = new Intl.DateTimeFormat(getResolvedLocale(), {
    dateStyle: 'medium',
  }).format(new Date(work.updatedAt))
  const path = work.type === 'flow'
    ? `/projects/${projectId}/flows/${work.id}`
    : `/projects/${projectId}/create/${work.id}`
  const Icon = work.type === 'flow' ? IconGitBranch : IconSparkles

  return (
    <Link
      className="
        flex min-w-0 items-center gap-3 rounded-lg p-2 outline-none
        hover:bg-muted/60
        focus-visible:ring-2 focus-visible:ring-ring
      "
      to={path}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {work.name || t(work.type === 'flow'
            ? 'flows.untitled'
            : 'create.sessions.untitled')}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {date}
          {' · '}
          {t('projects.outputCount', { count: work.outputCount })}
        </span>
      </span>
    </Link>
  )
}
