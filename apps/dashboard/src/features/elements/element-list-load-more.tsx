/** Shared load-more affordance for cursor-paged Element list surfaces. */

import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

/** Renders nothing once every Element page is loaded. */
export function ElementListLoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}) {
  const { t } = useTranslation()

  if (!hasNextPage)
    return null

  return (
    <div className="flex justify-center py-2">
      <Button
        disabled={isFetchingNextPage}
        size="sm"
        type="button"
        variant="outline"
        onClick={onLoadMore}
      >
        {isFetchingNextPage ? t('common.loading') : t('elements.loadMore')}
      </Button>
    </div>
  )
}
