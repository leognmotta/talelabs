import type { CookiePreferences } from './cookie-preferences'

import { Button } from '@talelabs/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@talelabs/ui/components/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from '@talelabs/ui/components/field'
import { Separator } from '@talelabs/ui/components/separator'
import { Switch } from '@talelabs/ui/components/switch'
import { useTranslation } from 'react-i18next'

export function CookiePreferencesDialog({
  onOpenChange,
  onPreferencesChange,
  onSave,
  open,
  preferences,
}: {
  onOpenChange: (open: boolean) => void
  onPreferencesChange: (preferences: CookiePreferences) => void
  onSave: () => void
  open: boolean
  preferences: CookiePreferences
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('cookies.title')}</DialogTitle>
          <DialogDescription>
            {t('cookies.description')}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>{t('cookies.essential')}</FieldTitle>
              <FieldDescription>
                {t('cookies.essentialDescription')}
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-label={t('cookies.essentialAria')}
              checked
              disabled
            />
          </Field>

          <Separator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>{t('cookies.analytics')}</FieldTitle>
              <FieldDescription>
                {t('cookies.analyticsDescription')}
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-label={t('cookies.analyticsAria')}
              checked={preferences.analytics}
              onCheckedChange={analytics => onPreferencesChange({
                ...preferences,
                analytics,
              })}
            />
          </Field>

          <Separator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>{t('cookies.marketing')}</FieldTitle>
              <FieldDescription>
                {t('cookies.marketingDescription')}
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-label={t('cookies.marketingAria')}
              checked={preferences.marketing}
              onCheckedChange={marketing => onPreferencesChange({
                ...preferences,
                marketing,
              })}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" onClick={onSave}>
            {t('cookies.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
