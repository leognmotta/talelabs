/** Compact, localized cost prerequisite presentation for canvas run controls. */

import type { RunCostEstimateState } from './use-flow-run-cost-estimate'

import { Spinner } from '@talelabs/ui/components/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { cn } from '@talelabs/ui/lib/utils'
import { useTranslation } from 'react-i18next'

function formattedUsd(amountUsd: string, locale: string): string {
  const amount = Number(amountUsd)
  return new Intl.NumberFormat(locale, {
    currency: 'USD',
    maximumFractionDigits: amount > 0 && amount < 0.01 ? 6 : 2,
    minimumFractionDigits: amount > 0 && amount < 0.01 ? 4 : 2,
    style: 'currency',
  }).format(amount)
}

/** Renders estimate progress or the required approximate USD amount. */
export function RunCostEstimate({
  className,
  showTooltip = true,
  state,
}: {
  /** Optional layout classes supplied by the owning action. */
  className?: string
  /** Whether this standalone presentation owns a keyboard-accessible tooltip. */
  showTooltip?: boolean
  /** Server-recalculated estimate state from the saved-plan query. */
  state: RunCostEstimateState
}) {
  const { i18n, t } = useTranslation()
  if (state.status === 'not-required' || state.status === 'idle')
    return null
  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const amount = state.status === 'ready'
    ? formattedUsd(state.estimate.amountUsd, locale)
    : undefined
  const label = amount
    ? t('flows.runCost.amount', { amount })
    : state.status === 'estimating'
      ? t('flows.runCost.estimating')
      : state.status === 'updating'
        ? t('flows.runCost.updating')
        : t('flows.runCost.estimating')
  const content = (
    <span
      aria-atomic="true"
      aria-label={label}
      aria-live="polite"
      className={cn(
        `
          inline-flex min-w-14 items-center justify-end gap-1 text-[10px]
          font-medium whitespace-nowrap text-current/70 tabular-nums
        `,
        className,
      )}
      role="status"
      tabIndex={showTooltip ? 0 : undefined}
    >
      {!amount && state.status !== 'updating' && (
        <Spinner aria-hidden="true" className="size-2.5" />
      )}
      {amount ? `≈ ${amount}` : label}
    </span>
  )
  if (!showTooltip)
    return content
  return (
    <Tooltip>
      <TooltipTrigger render={content} />
      <TooltipContent className="max-w-72">
        <p>{t('flows.runCost.explanation')}</p>
      </TooltipContent>
    </Tooltip>
  )
}
