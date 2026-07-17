/** Asset selection and unsaved-navigation dialogs for the Flow canvas. */

import type { Asset } from '@talelabs/sdk'
import type { FlowSaveStatus } from './flow-canvas-types'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@talelabs/ui/components/alert-dialog'
import { Spinner } from '@talelabs/ui/components/spinner'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { AssetLibraryDialog } from '../assets/asset-library-dialog'

/** Navigation-blocker projection consumed by the canvas dialog layer. */
export interface FlowCanvasNavigationDialogState {
  /** Whether navigation is currently blocked by unsaved graph edits. */
  blocked: boolean
  /** Cancels the pending navigation and keeps the editor open. */
  onCancel: () => void
  /** Saves the graph and continues the blocked navigation. */
  onSave: () => void
  /** Whether the save-before-leave command is in flight. */
  saving: boolean
  /** Current graph autosave presentation status. */
  status: FlowSaveStatus
}

/** Renders Asset selection and unsaved-navigation dialogs. */
export const FlowCanvasDialogs = memo(({
  assetPickerNodeId,
  navigation,
  onAssetPickerOpenChange,
  onSelectAsset,
  selectedAssetId,
}: {
  assetPickerNodeId: null | string
  navigation: FlowCanvasNavigationDialogState
  onAssetPickerOpenChange: (open: boolean) => void
  onSelectAsset: (asset: Asset) => void
  selectedAssetId: null | string
}) => {
  const { t } = useTranslation()

  return (
    <>
      <AlertDialog open={navigation.blocked}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('flows.saveStatus.unsaved')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('flows.navigation.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={navigation.saving}
              onClick={navigation.onCancel}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={navigation.saving}
              onClick={navigation.onSave}
            >
              {navigation.saving && <Spinner data-icon="inline-start" />}
              {navigation.status === 'error'
                ? t('common.retry')
                : t('flows.navigation.saveAndLeave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssetLibraryDialog
        mode="select"
        open={assetPickerNodeId !== null}
        selectedAssetIds={selectedAssetId ? [selectedAssetId] : []}
        onOpenChange={onAssetPickerOpenChange}
        onSelect={onSelectAsset}
      />
    </>
  )
})
