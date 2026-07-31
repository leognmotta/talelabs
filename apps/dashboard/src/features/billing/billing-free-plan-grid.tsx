/** Three-plan comparison and Checkout choices for Free Billing accounts. */

import type { BillingAccountResponse } from '@talelabs/sdk'

import type {
  CatalogPlan,
  RecurringOption,
} from './billing-plan-pricing'
import { IconCheck, IconCrown } from '@tabler/icons-react'
import { Badge } from '@talelabs/ui/components/badge'
import { Button } from '@talelabs/ui/components/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Slider } from '@talelabs/ui/components/slider'

import { useTranslation } from 'react-i18next'

import {
  formatBasisPoints,
  formatBytes,
  formatCredits,
  formatUsdCents,
} from './billing-format'
import {
  findBillingOffer,
  getAnnualPricePresentation,
} from './billing-plan-pricing'

interface BillingFreePlanGridProps {
  account: BillingAccountResponse
  busy: boolean
  interval: 'month' | 'year'
  plans: CatalogPlan[]
  proIndex: number
  proPlan: CatalogPlan
  onCheckout: (plan: CatalogPlan, option: RecurringOption) => void
  onProOptionChange: (option: RecurringOption) => void
}

/** Renders the comparable plan grid available before a first subscription. */
export function BillingFreePlanGrid({
  account,
  busy,
  interval,
  onCheckout,
  onProOptionChange,
  plans,
  proIndex,
  proPlan,
}: BillingFreePlanGridProps) {
  const { i18n, t } = useTranslation()
  const selectedOptions = Object.fromEntries(
    plans.map(plan => [
      plan.code,
      plan.code === 'pro'
        ? plan.recurringOptions[proIndex]
        : plan.recurringOptions[0],
    ]),
  ) as Partial<Record<CatalogPlan['code'], RecurringOption>>

  return (
    <div className="
      grid gap-3
      lg:grid-cols-3
    "
    >
      {plans.map((plan) => {
        const option = selectedOptions[plan.code]
        const offer = option ? findBillingOffer(option, interval) : null
        const annualPricing = option && interval === 'year'
          ? getAnnualPricePresentation(option)
          : null
        const isCurrent = plan.code === 'free'
        const isFounder = isCurrent && account.plan.founder
        const checkoutChoice = plan.code !== 'free' && Boolean(option)
        const actionLabel = !account.permissions.canManageBilling && !isCurrent
          ? t('billing.adminOnly')
          : isCurrent
            ? t('billing.currentPlan')
            : t('billing.chooseNamedPlan', {
                plan: t(`billing.planNames.${plan.code}`),
              })

        return (
          <Card
            className={isCurrent ? 'ring-2 ring-primary/30' : undefined}
            key={plan.code}
            size="sm"
          >
            <CardHeader
              className="
                content-start
                lg:min-h-32
              "
            >
              <CardTitle>{t(`billing.planNames.${plan.code}`)}</CardTitle>
              <CardDescription>
                {t(`billing.planDescriptions.${plan.code}`)}
              </CardDescription>
              <CardAction className="flex gap-1">
                {isCurrent && <Badge>{t('billing.current')}</Badge>}
                {isFounder && (
                  <Badge variant="secondary">
                    <IconCrown />
                    {t('billing.founder')}
                  </Badge>
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatUsdCents(
                    annualPricing?.monthlyEquivalentUsdCents
                    ?? offer?.priceUsdCents
                    ?? 0,
                    i18n.language,
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {offer
                    ? t('billing.perMonth')
                    : t('billing.noRecurringCharge')}
                </p>
                {annualPricing && offer && (
                  <p className="mt-1 text-xs text-primary">
                    {t('billing.annualBillingSummary', {
                      price: formatUsdCents(
                        offer.priceUsdCents,
                        i18n.language,
                      ),
                      savings: formatUsdCents(
                        annualPricing.annualSavingsUsdCents,
                        i18n.language,
                      ),
                    })}
                  </p>
                )}
              </div>
              {plan.code === 'pro' && (
                <FieldGroup>
                  <Field className="gap-2">
                    <FieldLabel className="sr-only">
                      {t('billing.proCreditSize')}
                    </FieldLabel>
                    <Slider
                      aria-label={t('billing.proCreditSize')}
                      max={Math.max(0, proPlan.recurringOptions.length - 1)}
                      min={0}
                      step={1}
                      value={[proIndex]}
                      onValueChange={(value) => {
                        const next = Array.isArray(value) ? value[0] : value
                        const nextOption = typeof next === 'number'
                          ? proPlan.recurringOptions[next]
                          : null
                        if (nextOption)
                          onProOptionChange(nextOption)
                      }}
                    />
                    <FieldDescription>
                      {t('billing.proOptionsCount', {
                        count: proPlan.recurringOptions.length,
                      })}
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              )}
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-start gap-2">
                  <IconCheck className="mt-0.5 size-4 text-primary" />
                  {t('billing.monthlyCredits', {
                    count: formatCredits(
                      option?.monthlyCredits ?? 0,
                      i18n.language,
                    ),
                  })}
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck className="mt-0.5 size-4 text-primary" />
                  {t('billing.storageAllowance', {
                    amount: formatBytes(plan.storageBytes, i18n.language),
                  })}
                </li>
                <li className="flex items-start gap-2">
                  <IconCheck className="mt-0.5 size-4 text-primary" />
                  {t('billing.browserByokIncluded')}
                </li>
                {option && (
                  <li className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 size-4 text-primary" />
                    {t('billing.topUpRateImprovement', {
                      percentage: formatBasisPoints(
                        option.maximumTopUpRateImprovementBpsFromFree,
                        i18n.language,
                      ),
                      plan: t('billing.planNames.free'),
                    })}
                  </li>
                )}
              </ul>
            </CardContent>
            <CardFooter className="mt-auto min-h-9">
              <Button
                className="w-full"
                disabled={
                  busy
                  || isCurrent
                  || !account.permissions.canManageBilling
                }
                type="button"
                variant={
                  checkoutChoice && plan.code === 'creator'
                    ? 'default'
                    : 'outline'
                }
                onClick={() => {
                  if (checkoutChoice && option)
                    onCheckout(plan, option)
                }}
              >
                {actionLabel}
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
