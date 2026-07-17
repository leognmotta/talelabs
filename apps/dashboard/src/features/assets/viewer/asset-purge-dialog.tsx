/** Explicit confirmation boundary for irreversible Asset deletion. */

import type { Asset } from '@talelabs/sdk'

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
import { useTranslation } from 'react-i18next'

/** Requires caller confirmation before dispatching the permanent purge mutation. */
export function AssetPurgeDialog({
  asset,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  asset: Asset | null
  onConfirm: () => Promise<void>
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
}) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('assets.deletePermanently')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('assets.purgeDescription', { name: asset?.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            variant="destructive"
            onClick={() => void onConfirm()}
          >
            {pending ? t('assets.deleting') : t('assets.deletePermanently')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
