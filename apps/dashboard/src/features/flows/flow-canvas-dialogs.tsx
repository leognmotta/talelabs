import type { Asset } from '@talelabs/sdk'
import type { FlowInputState, FlowSaveStatus } from './flow-canvas-types'

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
import { useTranslation } from 'react-i18next'
import { AssetLibraryDialog } from '../assets/asset-library-dialog'
import { FlowInputInspector } from './flow-input-inspector'

export function FlowCanvasDialogs({
  assetPickerNodeId,
  inputInspector,
  navigation,
  onAssetPickerOpenChange,
  onInputInspectorOpenChange,
  onInputSelectionChange,
  onSelectAsset,
  selectedAssetId,
}: {
  assetPickerNodeId: null | string
  inputInspector: {
    inputState: FlowInputState | null
    open: boolean
    title: string
  }
  navigation: {
    blocked: boolean
    onCancel: () => void
    onSave: () => void
    saving: boolean
    status: FlowSaveStatus
  }
  onAssetPickerOpenChange: (open: boolean) => void
  onInputInspectorOpenChange: (open: boolean) => void
  onInputSelectionChange: (
    selection: { mode: 'auto' } | { assetIds: string[], mode: 'manual' },
  ) => void
  onSelectAsset: (asset: Asset) => void
  selectedAssetId: null | string
}) {
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
      <FlowInputInspector
        inputState={inputInspector.inputState}
        open={inputInspector.open}
        title={inputInspector.title}
        onOpenChange={onInputInspectorOpenChange}
        onSelectionChange={onInputSelectionChange}
      />
    </>
  )
}
