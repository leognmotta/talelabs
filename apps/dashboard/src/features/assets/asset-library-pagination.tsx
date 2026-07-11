import { Button } from '@talelabs/ui/components/button'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function AssetLibraryPagination({
  assetCount,
  filtered,
  folderCount,
  hasNextPage,
  hasPreviousPage,
  isFetchingNextPage,
  isFetchingPreviousPage,
  onNextPage,
  onPreviousPage,
}: {
  assetCount: number
  filtered: boolean
  folderCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  onNextPage: () => void
  onPreviousPage: () => void
}) {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])

  if (assetCount === 0 && folderCount === 0)
    return null

  return (
    <footer
      aria-live="polite"
      className="flex shrink-0 flex-col items-center gap-1 py-6 text-center"
    >
      <p className="text-sm font-medium">
        {t('assets.folderCount', { count: numberFormatter.format(folderCount) })}
        <span aria-hidden> · </span>
        {t(hasNextPage ? 'assets.loadedFileCount' : 'assets.fileCount', {
          count: numberFormatter.format(assetCount),
        })}
      </p>
      {(hasNextPage || hasPreviousPage) && (
        <div className="mt-2 flex items-center gap-2">
          <Button
            disabled={!hasPreviousPage || isFetchingPreviousPage}
            size="sm"
            type="button"
            variant="outline"
            onClick={onPreviousPage}
          >
            {isFetchingPreviousPage
              ? t('common.loading')
              : t('common.previous')}
          </Button>
          <Button
            disabled={!hasNextPage || isFetchingNextPage}
            size="sm"
            type="button"
            variant="outline"
            onClick={onNextPage}
          >
            {isFetchingNextPage ? t('common.loading') : t('common.next')}
          </Button>
        </div>
      )}
      {!hasNextPage && (
        <p className="text-sm text-muted-foreground">
          {filtered ? t('assets.endOfResults') : t('assets.endOfLibrary')}
        </p>
      )}
    </footer>
  )
}
