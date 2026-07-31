/** Credit balance and catalog-derived one-time top-up Settings destination. */

import { IconDatabaseDollar, IconInfoCircle } from '@tabler/icons-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@talelabs/ui/components/alert'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import { Slider } from '@talelabs/ui/components/slider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import {
  formatBasisPoints,
  formatCredits,
  formatUsdCents,
} from './billing-format'
import {
  useBillingAccountQuery,
  useBillingCatalogQuery,
  useBillingMutations,
} from './billing-queries'
import {
  BillingErrorState,
  BillingLoadingState,
} from './billing-state-panel'

/** Renders the Credits balance and top-up purchase destination. */
export function BillingCreditsSettings({
  organizationId,
}: {
  /** Active organization identity used only in organization-keyed queries. */
  organizationId: null | string
}) {
  const { i18n, t } = useTranslation()
  const accountQuery = useBillingAccountQuery(organizationId)
  const catalogQuery = useBillingCatalogQuery(organizationId)
  const mutations = useBillingMutations(organizationId)
  const [amountUsdCents, setAmountUsdCents] = useState<null | number>(null)
  const catalog = catalogQuery.data
  const quote = catalog?.topUps.quotes.find(
    candidate => candidate.amountUsdCents === (
      amountUsdCents ?? catalog.topUps.minAmountUsdCents
    ),
  ) ?? catalog?.topUps.quotes[0]

  if (accountQuery.isPending || catalogQuery.isPending)
    return <BillingLoadingState />
  if (!accountQuery.data || !catalog || !quote) {
    return (
      <BillingErrorState retry={() => {
        void accountQuery.refetch()
        void catalogQuery.refetch()
      }}
      />
    )
  }

  const account = accountQuery.data

  async function buyCredits() {
    try {
      const result = await mutations.topUp.mutateAsync({
        amountUsdCents: quote!.amountUsdCents,
        idempotencyKey: crypto.randomUUID(),
      })
      window.location.assign(result.url)
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'billing.actionFailed'))
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h2 className="text-lg font-semibold">{t('billing.credits')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('billing.creditsDescription')}
        </p>
      </header>
      <Separator />
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t('billing.availableCredits')}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {formatCredits(account.credits.available, i18n.language)}
          </p>
          {account.credits.reserved > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('billing.reservedCredits', {
                count: formatCredits(
                  account.credits.reserved,
                  i18n.language,
                ),
              })}
            </p>
          )}
        </div>
        <IconDatabaseDollar className="size-8 text-muted-foreground" />
      </section>
      <Separator />
      <div>
        <h3 className="font-medium">{t('billing.buyCredits')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('billing.buyCreditsDescription')}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Slider
          aria-label={t('billing.oneTimeAmount')}
          max={catalog.topUps.maxAmountUsdCents}
          min={catalog.topUps.minAmountUsdCents}
          step={catalog.topUps.stepUsdCents}
          value={[quote.amountUsdCents]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            if (typeof next === 'number')
              setAmountUsdCents(next)
          }}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {formatUsdCents(
              catalog.topUps.minAmountUsdCents,
              i18n.language,
            )}
          </span>
          <span>
            {formatUsdCents(
              catalog.topUps.maxAmountUsdCents,
              i18n.language,
            )}
          </span>
        </div>
      </div>
      <section className="
        grid gap-4 rounded-3xl bg-muted/35 p-5
        sm:grid-cols-2
      "
      >
        <div>
          <p className="text-sm text-muted-foreground">
            {t('billing.oneTimeAmount')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatUsdCents(quote.amountUsdCents, i18n.language)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {t('billing.creditsReceived')}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatCredits(quote.credits, i18n.language)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {t('billing.effectiveRate')}
          </p>
          <p className="mt-1 font-medium tabular-nums">
            {new Intl.NumberFormat(i18n.language, {
              currency: 'USD',
              maximumFractionDigits: 6,
              style: 'currency',
            }).format(Number(quote.effectiveUsdPerCredit))}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {t('billing.catalogSavings')}
          </p>
          <p className="mt-1 font-medium tabular-nums">
            {formatBasisPoints(
              quote.volumeRateImprovementBps,
              i18n.language,
            )}
          </p>
          {quote.planRateImprovementBpsFromFree > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('billing.membershipValue', {
                percentage: formatBasisPoints(
                  quote.planRateImprovementBpsFromFree,
                  i18n.language,
                ),
              })}
            </p>
          )}
        </div>
      </section>
      <Alert>
        <IconInfoCircle />
        <AlertTitle>{t('billing.storageUnchanged')}</AlertTitle>
        <AlertDescription>
          {t('billing.storageUnchangedDescription')}
        </AlertDescription>
      </Alert>
      <Button
        disabled={
          !account.permissions.canManageBilling || mutations.topUp.isPending
        }
        type="button"
        onClick={() => void buyCredits()}
      >
        {account.permissions.canManageBilling
          ? mutations.topUp.isPending
            ? t('billing.openingCheckout')
            : t('billing.buyNow')
          : t('billing.adminOnly')}
      </Button>
    </div>
  )
}
