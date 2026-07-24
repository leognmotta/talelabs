/** Project library card with cover preview and lifecycle command. */

import type { Project } from '@talelabs/sdk'

import {
  IconArchive,
  IconDots,
  IconFolder,
  IconRestore,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@talelabs/ui/components/dropdown-menu'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { getResolvedLocale } from '../../i18n/i18n'
import {
  MediaLibraryCardDetails,
  MediaLibraryCardPreview,
} from '../../shared/components/media-library-card'

/** Renders one Project summary and its archive or restore command. */
export function ProjectCard({
  project,
  onLifecycle,
}: {
  /** Project summary returned by the cursor-paginated collection. */
  project: Project
  /** Applies the lifecycle transition appropriate for the current state. */
  onLifecycle: (project: Project) => void
}) {
  const { t } = useTranslation()
  const updatedAt = new Intl.DateTimeFormat(getResolvedLocale(), {
    dateStyle: 'medium',
  }).format(new Date(project.updatedAt))
  const archived = Boolean(project.archivedAt)

  return (
    <article className="group min-w-0">
      <Link
        aria-label={t('projects.open', { name: project.name })}
        className="
          block rounded-xl outline-none
          focus-visible:ring-2 focus-visible:ring-ring
        "
        to={`/projects/${project.id}`}
      >
        <MediaLibraryCardPreview className="group-hover:ring-foreground/30">
          {project.coverAsset?.thumbnailUrl
            ? (
                <img
                  alt=""
                  className="size-full object-cover"
                  src={project.coverAsset.thumbnailUrl}
                />
              )
            : (
                <div className="
                  flex size-full items-center justify-center bg-muted/40
                  text-muted-foreground
                "
                >
                  <IconFolder className="size-9" />
                </div>
              )}
        </MediaLibraryCardPreview>
      </Link>
      <MediaLibraryCardDetails
        trailing={(
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('common.moreOptions')}
              render={<Button size="icon-sm" variant="ghost" />}
            >
              <IconDots />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onLifecycle(project)}>
                {archived ? <IconRestore /> : <IconArchive />}
                {archived
                  ? t('projects.restore')
                  : t('projects.archive')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      >
        <Link
          className="
            block truncate rounded-sm text-sm font-medium outline-none
            focus-visible:ring-2 focus-visible:ring-ring
          "
          to={`/projects/${project.id}`}
        >
          {project.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {t('projects.updated', { date: updatedAt })}
          {' · '}
          {t('projects.assetCount', { count: project.counts.assets })}
        </p>
      </MediaLibraryCardDetails>
    </article>
  )
}
