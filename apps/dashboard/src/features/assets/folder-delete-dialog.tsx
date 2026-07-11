import type { Folder } from '@talelabs/sdk'

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

export function FolderDeleteDialog({
  folder,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  folder: Folder | null
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
          <AlertDialogTitle>{t('assets.deleteFolder')}</AlertDialogTitle>
          <AlertDialogDescription>{t('assets.deleteFolderDescription', { name: folder?.name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={pending} variant="destructive" onClick={() => void onConfirm()}>
            {pending ? t('assets.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
