import { ELEMENT_TYPES } from '@talelabs/elements'
import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { elementTypeTranslationKey } from './element-i18n'
import { ELEMENT_TYPE_ICONS } from './element-type-icons'

export function CreateElementDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          max-h-[90svh] overflow-y-auto
          sm:max-w-2xl
        "
        closeLabel={t('common.close')}
      >
        <DialogHeader>
          <DialogTitle>{t('elements.create')}</DialogTitle>
          <DialogDescription>{t('elements.chooseType')}</DialogDescription>
        </DialogHeader>
        <div
          className="
            grid gap-3
            sm:grid-cols-2
          "
        >
          {ELEMENT_TYPES.map((elementType) => {
            const Icon = ELEMENT_TYPE_ICONS[elementType]
            return (
              <Button
                key={elementType}
                className="
                  h-auto items-start justify-start gap-3 p-4 text-left
                  whitespace-normal
                "
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  navigate(`/elements/new/${elementType}`)
                }}
              >
                <Icon data-icon="inline-start" />
                <span className="flex flex-col gap-1">
                  <span>{t(elementTypeTranslationKey(elementType, 'label'))}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t(elementTypeTranslationKey(elementType, 'description'))}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
