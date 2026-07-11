import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

export function ElementFormActions({
  pending,
  submitLabel,
}: {
  pending: boolean
  submitLabel: string
}) {
  const { t } = useTranslation()

  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={pending}>
        {pending ? t('common.saving') : submitLabel}
      </Button>
    </div>
  )
}
