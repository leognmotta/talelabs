/** Exact paid subscription-change review and confirmation dialog. */

import type {
  BillingSubscriptionChangePreviewResponse,
} from '@talelabs/sdk'

import { IconArrowUpRight, IconCalendar, IconCoins } from '@tabler/icons-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@talelabs/ui/components/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@talelabs/ui/components/alert-dialog'
import { Spinner } from '@talelabs/ui/components/spinner'
import { useTranslation } from 'react-i18next'

import {
  formatBytes,
  formatCredits,
  formatUsdCents,
} from './billing-format'

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' })
    .format(new Date(value))
}

/** Reviews exact Stripe and credit facts before a paid change is submitted. */
export function BillingUpgradeDialog({
  onConfirm,
  onOpenChange,
  open,
  pending,
  plan,
  preview,
}: {
  /** Applies the already-reviewed target and fixed proration instant. */
  onConfirm: () => void
  /** Synchronizes controlled dialog visibility with its parent. */
  onOpenChange: (open: boolean) => void
  /** Whether the review is currently visible. */
  open: boolean
  /** Whether Stripe is applying the reviewed change. */
  pending: boolean
  /** Localized target plan name. */
  plan: string
  /** Exact server-side Stripe and entitlement preview. */
  preview: BillingSubscriptionChangePreviewResponse
}) {
  const { i18n, t } = useTranslation()
  const immediate = preview.mode === 'immediate'
  const dueToday = formatUsdCents(
    preview.amountDueNowMinor,
    i18n.language,
  )
  const effectiveDate = formatDate(preview.effectiveAt, i18n.language)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            {immediate
              ? <IconArrowUpRight className="text-primary" />
              : <IconCalendar className="text-primary" />}
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t(
              immediate
                ? 'billing.changeReviewTitleNow'
                : 'billing.changeReviewTitleRenewal',
              { plan },
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              immediate
                ? 'billing.changeReviewDescriptionNow'
                : 'billing.changeReviewDescriptionRenewal',
              { date: effectiveDate },
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <dt className="text-muted-foreground">
              {t('billing.dueToday')}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">{dueToday}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-muted-foreground">
              {t('billing.creditsAddedNow')}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {formatCredits(preview.creditsAddedNow, i18n.language)}
            </dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-muted-foreground">
              {t('billing.newMonthlyAllowance')}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {formatCredits(preview.targetMonthlyCredits, i18n.language)}
            </dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-muted-foreground">
              {t('billing.newStorageAllowance')}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {formatBytes(preview.storageBytes, i18n.language)}
            </dd>
          </div>
        </dl>

        {immediate && (
          <Alert>
            <IconCoins />
            <AlertTitle>
              {t(
                preview.creditsAddedNow > 0
                  ? 'billing.creditAdjustmentTitle'
                  : 'billing.creditCarryTitle',
              )}
            </AlertTitle>
            <AlertDescription>
              {t(
                preview.creditsAddedNow > 0
                  ? 'billing.creditAdjustmentDescription'
                  : 'billing.creditCarryDescription',
                {
                  count: formatCredits(
                    preview.creditsAddedNow,
                    i18n.language,
                  ),
                },
              )}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending && <Spinner aria-label={t('common.loading')} />}
            {t(
              immediate
                ? 'billing.payAndUpgrade'
                : 'billing.scheduleChange',
              { amount: dueToday },
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
