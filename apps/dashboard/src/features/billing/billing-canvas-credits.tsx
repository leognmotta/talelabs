/** Compact Billing balance and Credits shortcut for full-screen creative surfaces. */

import { IconCoins } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Skeleton } from '@talelabs/ui/components/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { useTranslation } from 'react-i18next'
import { formatCredits } from './billing-format'
import { useBillingAccountQuery } from './billing-queries'

/** Shows the shared organization balance and opens its Credits destination. */
export function BillingCanvasCredits({
  onOpenCredits,
  organizationId,
}: {
  /** Opens the URL-backed Credits settings destination. */
  onOpenCredits: () => void
  /** Active organization identity used by the shared Billing query. */
  organizationId: string
}) {
  const { i18n, t } = useTranslation()
  const accountQuery = useBillingAccountQuery(organizationId)
  const availableCredits = accountQuery.data
    ? formatCredits(accountQuery.data.credits.available, i18n.language)
    : null
  const trigger = (
    <Button
      aria-busy={accountQuery.isPending}
      className="rounded-lg"
      data-flow-canvas-credits
      size="sm"
      type="button"
      variant="ghost"
      onClick={onOpenCredits}
    >
      <IconCoins data-icon="inline-start" />
      <span className="
        sr-only
        sm:not-sr-only
      "
      >
        {t('billing.credits')}
      </span>
      {accountQuery.isPending
        ? (
            <Skeleton
              aria-hidden
              className="h-3.5 w-7 rounded-md"
            />
          )
        : (
            <span
              aria-hidden={availableCredits === null}
              className="tabular-nums"
            >
              {availableCredits ?? '—'}
            </span>
          )}
    </Button>
  )

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent side="bottom">
        <p>
          {accountQuery.isError
            ? t('billing.couldNotLoad')
            : t('billing.creditsDescription')}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
