/** Focused paid-subscription summary and renewal-boundary Pro controls. */

import type {
  BillingAccountResponse,
} from '@talelabs/sdk'

import type {
  CatalogPlan,
  RecurringOption,
} from './billing-plan-pricing'
import {
  IconArrowUpRight,
  IconCheck,
  IconClock,
} from '@tabler/icons-react'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@talelabs/ui/components/alert'
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
import { Separator } from '@talelabs/ui/components/separator'
import { Slider } from '@talelabs/ui/components/slider'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'

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

interface BillingPaidPlanSettingsProps {
  account: BillingAccountResponse
  billingInterval: 'month' | 'year'
  busy: boolean
  currentOption: RecurringOption
  currentPlan: CatalogPlan
  plans: CatalogPlan[]
  proIndex: number
  proOption: RecurringOption
  proPlan: CatalogPlan
  targetBillingInterval: 'month' | 'year'
  onBillingIntervalChange: (interval: 'month' | 'year') => void
  onCancelScheduledChange: () => void
  onManageBilling: () => void
  onProOptionChange: (option: RecurringOption) => void
  onReviewChange: (
    plan: CatalogPlan,
    option: RecurringOption,
    interval: 'month' | 'year',
  ) => void
}

function formatDate(value: null | string, locale: string) {
  return value
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
        .format(new Date(value))
    : '—'
}

function PricePresentation({
  billingInterval,
  option,
}: {
  billingInterval: 'month' | 'year'
  option: RecurringOption
}) {
  const { i18n, t } = useTranslation()
  const offer = findBillingOffer(option, billingInterval)
  const annualPricing = billingInterval === 'year'
    ? getAnnualPricePresentation(option)
    : null

  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">
        {formatUsdCents(
          annualPricing?.monthlyEquivalentUsdCents ?? offer.priceUsdCents,
          i18n.language,
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {t('billing.perMonth')}
      </p>
      {annualPricing && (
        <p className="mt-1 text-xs text-primary">
          {t('billing.annualBillingSummary', {
            price: formatUsdCents(offer.priceUsdCents, i18n.language),
            savings: formatUsdCents(
              annualPricing.annualSavingsUsdCents,
              i18n.language,
            ),
          })}
        </p>
      )}
    </div>
  )
}

/** Renders the paid-plan summary and only the next relevant Pro action. */
export function BillingPaidPlanSettings({
  account,
  billingInterval,
  busy,
  currentOption,
  currentPlan,
  onBillingIntervalChange,
  onCancelScheduledChange,
  onManageBilling,
  onProOptionChange,
  onReviewChange,
  plans,
  proIndex,
  proOption,
  proPlan,
  targetBillingInterval,
}: BillingPaidPlanSettingsProps) {
  const { i18n, t } = useTranslation()
  const isCreator = account.plan.code === 'creator'
  const selectedIsCurrent = account.plan.code === 'pro'
    && proOption.code === account.plan.recurringOptionCode
    && targetBillingInterval === billingInterval
  const hasScheduledChange = account.plan.scheduledPlanCode !== null
  const targetIsImmediate
    = !(billingInterval === 'year' && targetBillingInterval === 'month')
      && proOption.monthlyCredits >= currentOption.monthlyCredits
      && (
        proOption.monthlyCredits > currentOption.monthlyCredits
        || (billingInterval === 'month' && targetBillingInterval === 'year')
      )
  const scheduledPlan = account.plan.scheduledPlanCode
    ? plans.find(plan => plan.code === account.plan.scheduledPlanCode)
    : undefined
  const scheduledOption = scheduledPlan
    ? scheduledPlan.recurringOptions.find(
        option => option.code === account.plan.scheduledRecurringOptionCode,
      )
    : undefined
  const renewalDate = formatDate(account.plan.paidThrough, i18n.language)
  const scheduledDate = formatDate(
    account.plan.scheduledEffectiveAt,
    i18n.language,
  )

  return (
    <div className="flex flex-col gap-4">
      <Card className="ring-primary/20" size="sm">
        <CardHeader>
          <CardTitle>
            {t(`billing.planNames.${currentPlan.code}`)}
          </CardTitle>
          <CardDescription>
            {t(`billing.planDescriptions.${currentPlan.code}`)}
          </CardDescription>
          <CardAction className="flex flex-wrap justify-end gap-1.5">
            <Badge>{t('billing.current')}</Badge>
            <Badge variant="outline">
              {t(
                billingInterval === 'year'
                  ? 'billing.annualBilling'
                  : 'billing.monthlyBilling',
              )}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="
          grid gap-x-6 gap-y-4
          sm:grid-cols-2
        "
        >
          <PricePresentation
            billingInterval={billingInterval}
            option={currentOption}
          />
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {formatCredits(
                account.plan.monthlyCreditAllowance,
                i18n.language,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('billing.creditsEachMonth')}
            </p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">
              {formatBytes(account.storage.limitBytes, i18n.language)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('billing.storage')}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium tabular-nums">
              {renewalDate}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                account.plan.cancelAtPeriodEnd
                  ? 'billing.endsOn'
                  : 'billing.renewsOn',
              )}
            </p>
          </div>
          {scheduledPlan
            && scheduledOption
            && account.plan.scheduledEffectiveAt && (
            <div className="
              flex flex-wrap items-center gap-x-3 gap-y-1
              sm:col-span-2
            "
            >
              <Separator className="mb-3 basis-full" />
              <IconClock
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {t('billing.scheduledChange')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('billing.scheduledPlanSummary', {
                    count: formatCredits(
                      scheduledOption.monthlyCredits,
                      i18n.language,
                    ),
                    plan: t(`billing.planNames.${scheduledPlan.code}`),
                  })}
                  {' · '}
                  {t(
                    account.plan.scheduledBillingInterval === 'year'
                      ? 'billing.annualBilling'
                      : 'billing.monthlyBilling',
                  )}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('billing.scheduledFor', { date: scheduledDate })}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex-wrap justify-between gap-2 border-t">
          <Button
            disabled={busy || !account.permissions.canManageBilling}
            type="button"
            variant="outline"
            onClick={onManageBilling}
          >
            {account.permissions.canManageBilling
              ? t('billing.manageBilling')
              : t('billing.adminOnly')}
          </Button>
          {hasScheduledChange && account.permissions.canManageBilling && (
            <Button
              disabled={busy}
              type="button"
              variant="outline"
              onClick={onCancelScheduledChange}
            >
              {t('billing.cancelScheduledChange')}
            </Button>
          )}
          {billingInterval === 'month'
            && !hasScheduledChange
            && !account.plan.cancelAtPeriodEnd
            && account.permissions.canManageBilling && (
            <Button
              disabled={busy}
              type="button"
              onClick={() => onReviewChange(
                currentPlan,
                currentOption,
                'year',
              )}
            >
              <IconArrowUpRight data-icon="inline-start" />
              {t('billing.switchToAnnual')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {account.plan.cancelAtPeriodEnd && (
        <Alert>
          <IconClock />
          <AlertTitle>{t('billing.resumeBeforeChangeTitle')}</AlertTitle>
          <AlertDescription>
            {t('billing.resumeBeforeChangeDescription')}
          </AlertDescription>
        </Alert>
      )}

      {!account.plan.cancelAtPeriodEnd && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>
              {t(
                isCreator
                  ? 'billing.upgradeYourPlan'
                  : 'billing.adjustProAllowance',
              )}
            </CardTitle>
            <CardDescription>
              {t('billing.planDescriptions.pro')}
            </CardDescription>
            {isCreator && (
              <CardAction>
                <Badge variant="secondary">
                  {t('billing.planNames.pro')}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field className="gap-2">
              <FieldLabel>{t('billing.billingCadence')}</FieldLabel>
              <ToggleGroup
                aria-label={t('billing.billingCadence')}
                spacing={0}
                value={[targetBillingInterval]}
                variant="outline"
                onValueChange={(value) => {
                  const nextInterval = value[0]
                  if (nextInterval === 'month' || nextInterval === 'year')
                    onBillingIntervalChange(nextInterval)
                }}
              >
                <ToggleGroupItem value="month">
                  {t('billing.monthly')}
                </ToggleGroupItem>
                <ToggleGroupItem value="year">
                  {t('billing.annual')}
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {t('billing.billingCadenceDescription')}
              </FieldDescription>
            </Field>
            <div className="
              grid gap-5
              sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]
            "
            >
              <PricePresentation
                billingInterval={targetBillingInterval}
                option={proOption}
              />
              <FieldGroup>
                <Field className="gap-2">
                  <FieldLabel>{t('billing.proCreditSize')}</FieldLabel>
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
            </div>
            <ul className="
              grid gap-x-5 gap-y-2 text-sm
              sm:grid-cols-2
            "
            >
              <li className="flex items-start gap-2">
                <IconCheck className="mt-0.5 size-4 text-primary" />
                {t('billing.monthlyCredits', {
                  count: formatCredits(
                    proOption.monthlyCredits,
                    i18n.language,
                  ),
                })}
              </li>
              <li className="flex items-start gap-2">
                <IconCheck className="mt-0.5 size-4 text-primary" />
                {t('billing.storageAllowance', {
                  amount: formatBytes(proPlan.storageBytes, i18n.language),
                })}
              </li>
              <li className="flex items-start gap-2">
                <IconCheck className="mt-0.5 size-4 text-primary" />
                {t('billing.browserByokIncluded')}
              </li>
              <li className="flex items-start gap-2">
                <IconCheck className="mt-0.5 size-4 text-primary" />
                {t('billing.topUpRateImprovement', {
                  percentage: formatBasisPoints(
                    proOption.maximumTopUpRateImprovementBpsFromFree,
                    i18n.language,
                  ),
                  plan: t('billing.planNames.free'),
                })}
              </li>
            </ul>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3 border-t">
            {!selectedIsCurrent && (
              <p className="text-xs text-muted-foreground">
                {t(
                  targetIsImmediate
                    ? 'billing.changeStartsAfterPayment'
                    : 'billing.changesAtRenewal',
                  { date: renewalDate },
                )}
              </p>
            )}
            <div className="ml-auto">
              {!account.permissions.canManageBilling
                ? (
                    <Button disabled type="button" variant="outline">
                      {t('billing.adminOnly')}
                    </Button>
                  )
                : hasScheduledChange
                  ? (
                      <Badge variant="secondary">
                        {t('billing.scheduledChange')}
                      </Badge>
                    )
                  : selectedIsCurrent
                    ? (
                        <Badge variant="outline">
                          {t('billing.currentAllowance')}
                        </Badge>
                      )
                    : (
                        <Button
                          disabled={busy}
                          type="button"
                          onClick={() => onReviewChange(
                            proPlan,
                            proOption,
                            targetBillingInterval,
                          )}
                        >
                          {targetIsImmediate && (
                            <IconArrowUpRight data-icon="inline-start" />
                          )}
                          {t('billing.reviewChange')}
                        </Button>
                      )}
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
