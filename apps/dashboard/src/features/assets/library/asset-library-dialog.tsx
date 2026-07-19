/** Modal Asset picker that reuses the canonical library query and selection model. */

import type { Asset, AssetType } from '@talelabs/sdk'
import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { useTranslation } from 'react-i18next'
import { AssetLibrary } from './asset-library'

/** Adapts the library to a bounded media selection contract for feature consumers. */
export function AssetLibraryDialog({
  allowedTypes,
  footer,
  isAssetDisabled,
  mode = 'select',
  onOpenChange,
  onOpenAsset = () => {},
  onSelect,
  onUploadBatch,
  open,
  selectedAssetIds,
}: {
  allowedTypes?: AssetType[]
  /** Sticky commit bar rendered under the library, owned by the caller. */
  footer?: ReactNode
  isAssetDisabled?: (asset: Asset) => null | string
  mode?: 'manage' | 'select'
  onOpenChange: (open: boolean) => void
  onOpenAsset?: (asset: Asset) => void
  onSelect?: (asset: Asset) => void
  /** Reports each upload batch started from inside this dialog. */
  onUploadBatch?: (batchId: string) => void
  open: boolean
  selectedAssetIds?: string[]
}) {
  const { t } = useTranslation()
  const selecting = mode === 'select'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          flex h-[min(860px,90svh)] max-w-[min(1440px,96vw)] flex-col
          overflow-hidden p-0
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
          allowedTypes={allowedTypes}
          className="min-h-0 flex-1 overflow-hidden"
          isAssetDisabled={isAssetDisabled}
          mode={mode}
          onOpenAsset={onOpenAsset}
          onSelect={onSelect}
          onUploadBatch={onUploadBatch}
          presentation="dialog"
          selectedAssetIds={selectedAssetIds}
        />
        {footer && (
          <div className="
            flex items-center justify-between gap-3 border-t bg-background px-5
            py-3
          "
          >
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
