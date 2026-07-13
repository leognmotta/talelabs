import type { Flow } from '@talelabs/sdk'
import {
  IconDots,
  IconEdit,
  IconGitBranch,
  IconTrash,
} from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

export function FlowCard({
  flow,
  onDelete,
  onRename,
}: {
  flow: Flow
  onDelete: (flow: Flow) => void
  onRename: (flow: Flow) => void
}) {
  const { t } = useTranslation()
  const updatedAt = new Intl.DateTimeFormat(getResolvedLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(flow.updatedAt))

  return (
    <article className="group min-w-0">
      <Link
        aria-label={t('flows.open', { name: flow.name })}
        className="
          block rounded-xl outline-none
          focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:ring-offset-background
        "
        to={`/flows/${flow.id}`}
      >
        <MediaLibraryCardPreview className="group-hover:ring-foreground/30">
          <div data-flow-card-grid className="absolute inset-0 opacity-40" />
          <div className="
            absolute inset-0 flex items-center justify-center
            text-muted-foreground
          "
          >
            <div className="flex items-center gap-2.5">
              <span className="
                h-6 w-10 rounded-md border bg-background shadow-sm
              "
              />
              <span className="h-px w-5 bg-border" />
              <span className="
                flex size-8 items-center justify-center rounded-lg border
                bg-background shadow-sm
              "
              >
                <IconGitBranch className="size-4" />
              </span>
            </div>
          </div>
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
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onRename(flow)}>
                  <IconEdit />
                  {t('flows.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(flow)}>
                  <IconTrash />
                  {t('flows.delete')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      >
        <p className="truncate text-sm font-medium" title={flow.name}>
          <Link
            className="
              block truncate rounded-sm outline-none
              focus-visible:ring-2 focus-visible:ring-ring
            "
            title={flow.name}
            to={`/flows/${flow.id}`}
          >
            {flow.name}
          </Link>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {t('flows.updated', { date: updatedAt })}
        </p>
      </MediaLibraryCardDetails>
    </article>
  )
}
