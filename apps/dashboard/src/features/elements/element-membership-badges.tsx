/** Compact badges naming the Elements that reference one Asset. */

import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

import { ELEMENT_KIND_ICONS } from './element-kind-meta'
import { useElementListInfiniteQuery } from './element-queries'

/** Shows Element membership for an Asset; renders nothing when unused. */
export function ElementMembershipBadges({ assetId }: { assetId: string }) {
  const { t } = useTranslation()
  const query = useElementListInfiniteQuery({ assetId })
  const elements = query.data?.pages.flatMap(page => page.data) ?? []

  if (elements.length === 0)
    return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">
        {t('elements.memberOf')}
      </span>
      {elements.map((element) => {
        const KindIcon = ELEMENT_KIND_ICONS[element.kind]
        return (
          <Badge key={element.id} variant="secondary">
            <KindIcon aria-hidden className="size-3" />
            {element.name}
          </Badge>
        )
      })}
      {query.hasNextPage && (
        <Button
          className="h-6 px-2 text-xs"
          disabled={query.isFetchingNextPage}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage
            ? t('common.loading')
            : t('elements.loadMore')}
        </Button>
      )}
    </div>
  )
}
