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

export function ElementDeleteDialog({
  name,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  name: string
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
          <AlertDialogTitle>{t('elements.delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('elements.deleteDescription', { name })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void onConfirm()}>
            {pending ? t('elements.deleting') : t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
