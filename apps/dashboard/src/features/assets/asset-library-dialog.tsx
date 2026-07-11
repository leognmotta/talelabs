import type { Asset } from '@talelabs/sdk'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { useTranslation } from 'react-i18next'
import { AssetLibrary } from './asset-library'

export function AssetLibraryDialog({
  mode = 'select',
  onOpenChange,
  onOpenAsset = () => {},
  onSelect,
  open,
  selectedAssetIds,
}: {
  mode?: 'manage' | 'select'
  onOpenChange: (open: boolean) => void
  onOpenAsset?: (asset: Asset) => void
  onSelect?: (asset: Asset) => void
  open: boolean
  selectedAssetIds?: string[]
}) {
  const { t } = useTranslation()
  const selecting = mode === 'select'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex h-[min(860px,90svh)] max-w-[min(1440px,96vw)] overflow-hidden p-0
          sm:max-w-[min(1440px,96vw)]
        "
        closeLabel={t('common.close')}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {selecting ? t('assets.chooseAsset') : t('navigation.assets')}
          </DialogTitle>
          <DialogDescription>
            {selecting ? t('assets.chooseAssetDescription') : t('assets.library')}
          </DialogDescription>
        </DialogHeader>
        <AssetLibrary
          className="overflow-hidden"
          mode={mode}
          onOpenAsset={onOpenAsset}
          onSelect={onSelect}
          presentation="dialog"
          selectedAssetIds={selectedAssetIds}
        />
      </DialogContent>
    </Dialog>
  )
}
