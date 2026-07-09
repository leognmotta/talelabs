import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { mockedCreditsBalance } from '../credits/credits-data'
import { mockedCurrentPlan } from '../subscription/subscription-data'
import { SettingsRow } from './settings-row'

export function BillingSettings({
  onOpenCreditsPurchase,
  onOpenSubscriptionUpgrade,
}: {
  onOpenCreditsPurchase: () => void
  onOpenSubscriptionUpgrade: () => void
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <header className="pb-4">
        <h2 className="text-lg font-semibold">Billing</h2>
      </header>
      <Separator />
      <SettingsRow label="Plan">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{mockedCurrentPlan}</Badge>
          <Button
            type="button"
            size="sm"
            onClick={onOpenSubscriptionUpgrade}
          >
            Upgrade
          </Button>
        </div>
      </SettingsRow>
      <Separator />
      <SettingsRow label="Credits" description="Available generation balance.">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {mockedCreditsBalance.toLocaleString()}
            {' '}
            credits
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenCreditsPurchase}
          >
            Buy more credits
          </Button>
        </div>
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
