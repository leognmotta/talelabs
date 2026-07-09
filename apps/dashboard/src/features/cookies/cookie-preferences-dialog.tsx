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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cookie Preferences</DialogTitle>
          <DialogDescription>
            Manage how TaleLabs uses cookies and similar technologies. Essential
            cookies are always active.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Essential</FieldTitle>
              <FieldDescription>
                Required for TaleLabs to function. Handles authentication,
                security, and core product features.
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-label="Essential cookies"
              checked
              disabled
            />
          </Field>

          <Separator />

          <Field orientation="horizontal">
            <FieldContent>
              <FieldTitle>Analytics</FieldTitle>
              <FieldDescription>
                Helps us understand how you use TaleLabs so we can improve the
                product. This data is aggregated and not used for advertising.
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-label="Analytics cookies"
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
              <FieldTitle>Marketing</FieldTitle>
              <FieldDescription>
                Allows us to measure campaign effectiveness and show relevant
                content across other platforms.
              </FieldDescription>
            </FieldContent>
            <Switch
              aria-label="Marketing cookies"
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
            Save Preferences
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
