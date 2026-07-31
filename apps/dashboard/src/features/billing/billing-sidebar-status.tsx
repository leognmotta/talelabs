/** Compact shared sidebar projection for organization credits and storage. */

import type { SettingsTab } from '../settings/settings-state'
import { IconCoins, IconDatabase } from '@tabler/icons-react'
import { Progress } from '@talelabs/ui/components/progress'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@talelabs/ui/components/sidebar'

import { useTranslation } from 'react-i18next'
import {
  formatBytes,
  formatCredits,
} from './billing-format'
import { useBillingAccountQuery } from './billing-queries'

/** Renders the one account-query-backed Billing shortcut in every sidebar. */
export function BillingSidebarStatus({
  onOpenSettings,
  organizationId,
}: {
  /** Opens the requested URL-backed Billing destination. */
  onOpenSettings: (tab: SettingsTab) => void
  /** Active organization identity. */
  organizationId: null | string
}) {
  const { i18n, t } = useTranslation()
  const accountQuery = useBillingAccountQuery(organizationId)

  if (!organizationId)
    return null
  if (accountQuery.isPending) {
    return (
      <SidebarMenu className="
        px-1
        group-data-[collapsible=icon]:hidden
      "
      >
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }
  const account = accountQuery.data
  if (!account)
    return null
  const committed = account.storage.usedBytes + account.storage.reservedBytes
  const storagePercent = account.storage.limitBytes === 0
    ? 100
    : Math.min(100, committed / account.storage.limitBytes * 100)
  const storageUsed = formatBytes(account.storage.usedBytes, i18n.language)
  const storageLimit = formatBytes(account.storage.limitBytes, i18n.language)
  const storageSummary = t('billing.storageUsedOf', {
    limit: storageLimit,
    used: storageUsed,
  })
  const storageTooltip = `${t('billing.storage')}: ${storageSummary}`
  const availableCredits = formatCredits(
    account.credits.available,
    i18n.language,
  )
  const creditsTooltip
    = `${t('billing.availableCredits')}: ${availableCredits}`

  return (
    <SidebarMenu className="gap-1 px-1">
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={storageTooltip}
          className="
            flex-col items-stretch gap-1.5
            group-data-[collapsible=icon]:items-center
            group-data-[collapsible=icon]:justify-center
          "
          size="lg"
          tooltip={storageTooltip}
          type="button"
          onClick={() => onOpenSettings('usage')}
        >
          <IconDatabase
            aria-hidden="true"
            className="
              hidden
              group-data-[collapsible=icon]:block
            "
          />
          <span className="
            grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center
            gap-2 text-xs text-muted-foreground
            group-data-[collapsible=icon]:hidden
          "
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <IconDatabase />
              <span className="truncate" title={t('billing.storage')}>
                {t('billing.storage')}
              </span>
            </span>
            <span className="whitespace-nowrap tabular-nums">
              {storageUsed}
              {' / '}
              {storageLimit}
            </span>
          </span>
          <Progress
            className="
              h-1
              group-data-[collapsible=icon]:hidden
            "
            value={storagePercent}
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          aria-label={creditsTooltip}
          className="
            gap-2 text-xs
            group-data-[collapsible=icon]:justify-center
          "
          size="sm"
          tooltip={creditsTooltip}
          type="button"
          onClick={() => onOpenSettings('credits')}
        >
          <IconCoins
            aria-hidden="true"
            className="
              hidden
              group-data-[collapsible=icon]:block
            "
          />
          <span className="
            flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground
            group-data-[collapsible=icon]:hidden
          "
          >
            <IconCoins />
            <span className="truncate" title={t('billing.credits')}>
              {t('billing.credits')}
            </span>
          </span>
          <span className="
            shrink-0 font-medium whitespace-nowrap tabular-nums
            group-data-[collapsible=icon]:hidden
          "
          >
            {availableCredits}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
