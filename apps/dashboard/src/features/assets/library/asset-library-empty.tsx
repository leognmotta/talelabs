/** Context-sensitive empty state for filtered, folder, and picker library modes. */

import { IconPhotoPlus, IconSearchOff } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@talelabs/ui/components/empty'
import { useTranslation } from 'react-i18next'

/** Distinguishes an empty folder from filters that hide otherwise available media. */
export function AssetLibraryEmpty({ filtered, onUpload }: {
  filtered: boolean
  onUpload: () => void
}) {
  const { t } = useTranslation()

  return (
    <Empty className="min-h-80 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {filtered ? <IconSearchOff /> : <IconPhotoPlus />}
        </EmptyMedia>
        <EmptyTitle>{filtered ? t('assets.noResults') : t('assets.emptyTitle')}</EmptyTitle>
        <EmptyDescription>
          {filtered ? t('assets.noResultsDescription') : t('assets.emptyDescription')}
        </EmptyDescription>
      </EmptyHeader>
      {!filtered && (
        <EmptyContent>
          <Button type="button" onClick={onUpload}>{t('assets.upload')}</Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
