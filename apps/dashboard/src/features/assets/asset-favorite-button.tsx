import type { Asset } from '@talelabs/sdk'
import type { ComponentProps } from 'react'
import type { AssetActions } from './asset-actions.types'

import { IconHeart, IconHeartFilled } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'
import { LibraryItemAction } from './library-item-action'

export function AssetFavoriteButton({
  actions,
  asset,
  className,
  size = 'icon-sm',
  variant = 'secondary',
}: {
  actions: AssetActions
  asset: Asset
  className?: string
  size?: ComponentProps<typeof Button>['size']
  variant?: ComponentProps<typeof Button>['variant']
}) {
  const { t } = useTranslation()

  return (
    <LibraryItemAction>
      <Button
        aria-label={asset.favorite ? t('assets.removeFavorite') : t('assets.addFavorite')}
        aria-pressed={asset.favorite}
        className={className}
        disabled={actions.favoritePending}
        size={size}
        type="button"
        variant={variant}
        onClick={() => actions.onToggleFavorite(asset)}
      >
        {asset.favorite
          ? <IconHeartFilled className="text-destructive" />
          : <IconHeart />}
      </Button>
    </LibraryItemAction>
  )
}
