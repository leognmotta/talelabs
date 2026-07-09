import { Badge } from '@talelabs/ui/components/badge'
import { Separator } from '@talelabs/ui/components/separator'
import { SettingsRow } from './settings-row'

export function BillingSettings() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">Billing</h2>
      </header>
      <Separator />
      <SettingsRow label="Plan">
        <Badge variant="secondary">Free</Badge>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Payment method">
        <span className="text-sm text-muted-foreground">Not connected</span>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Invoices">
        <span className="text-sm text-muted-foreground">No invoices</span>
      </SettingsRow>
    </div>
  )
}
