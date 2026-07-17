/** Viewer command bar projected from the canonical Asset action contract. */

import type { Asset } from '@talelabs/sdk'
import type { AssetActions } from '../library/asset-actions.types'

import { IconDownload } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'
import { AssetActionMenu } from '../library/asset-action-menu'
import { AssetFavoriteButton } from '../library/asset-favorite-button'
import { AssetTagPicker } from '../tags/asset-tag-picker'

/** Groups non-destructive commands while isolating archive and purge confirmation. */
export function AssetViewerActions({
  asset,
  actions,
}: {
  actions: AssetActions
  asset: Asset
}) {
  const { t } = useTranslation()

  const actionClassName = `
    size-10 border border-white/10 bg-[#1d2027] text-white shadow-lg
    shadow-black/40 hover:bg-[#2a2e38] hover:text-white
  `

  return (
    <div className="flex items-center gap-2">
      <AssetFavoriteButton
        actions={actions}
        asset={asset}
        className={actionClassName}
        size="icon"
        variant="ghost"
      />
      <AssetTagPicker
        actions={actions}
        asset={asset}
        className={actionClassName}
      />
      <Button
        aria-label={t('assets.download')}
        className={actionClassName}
        size="icon"
        type="button"
        variant="ghost"
        onClick={() => actions.onDownload(asset)}
      >
        <IconDownload />
      </Button>
      <AssetActionMenu
        actions={actions}
        asset={asset}
        triggerClassName={actionClassName}
        viewDetails={false}
      />
    </div>
  )
}
