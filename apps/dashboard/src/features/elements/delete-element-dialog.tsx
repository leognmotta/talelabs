/** Confirmation dialog for deleting one Element; Assets are never touched. */

import type { Element } from '@talelabs/sdk'

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
import { toast } from 'sonner'

import { useElementMutations } from './element-mutations'

/** Confirms deletion of the given Element and reports the result. */
export function DeleteElementDialog({
  element,
  onOpenChange,
}: {
  element: Element | null
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const mutations = useElementMutations()

  async function confirm() {
    if (!element)
      return
    try {
      await mutations.remove.mutateAsync(element.id)
      toast.success(t('elements.deleted'))
    }
    catch {
      toast.error(t('elements.deleteFailed'))
    }
    onOpenChange(false)
  }

  return (
    <AlertDialog open={element !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('elements.deleteTitle', { name: element?.name ?? '' })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('elements.deleteDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutations.remove.isPending}
            onClick={() => void confirm()}
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
