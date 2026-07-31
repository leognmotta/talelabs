/** Billing Plans destination for pre-purchase comparison and paid management. */

import type { BillingSubscriptionChangePreviewResponse } from '@talelabs/sdk'
import type { CatalogPlan, RecurringOption } from './billing-plan-pricing'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Alert, AlertDescription } from '@talelabs/ui/components/alert'
import { Separator } from '@talelabs/ui/components/separator'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@talelabs/ui/components/toggle-group'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from 'sonner'

import { getApiErrorMessage } from '../../shared/lib/api-error'
import { BillingFreePlanGrid } from './billing-free-plan-grid'
import { BillingPaidPlanSettings } from './billing-paid-plan-settings'
import {
  useBillingAccountQuery,
  useBillingCatalogQuery,
  useBillingMutations,
} from './billing-queries'
import { BillingErrorState, BillingLoadingState } from './billing-state-panel'
import { BillingUpgradeDialog } from './billing-upgrade-dialog'

/** Renders the Billing Plans Settings destination. */
export function BillingPlansSettings({
  organizationId,
}: {
  /** Active organization identity used only in organization-keyed queries. */
  organizationId: null | string
}) {
  const { t } = useTranslation()
  const accountQuery = useBillingAccountQuery(organizationId)
  const catalogQuery = useBillingCatalogQuery(organizationId)
  const mutations = useBillingMutations(organizationId)
  const [selectedInterval, setSelectedInterval] = useState<
    null | 'month' | 'year'
  >(null)
  const [selectedProOptionCode, setSelectedProOptionCode] = useState<
    null | string
  >(null)
  const [pendingChange, setPendingChange] = useState<null | {
    billingInterval: 'month' | 'year'
    idempotencyKey: string
    option: RecurringOption
    plan: CatalogPlan
    preview: BillingSubscriptionChangePreviewResponse
  }>(null)
  const plans = catalogQuery.data?.plans ?? []
  const proPlan = plans.find(plan => plan.code === 'pro')
  const paidInterval
    = accountQuery.data?.plan.code === 'free'
      ? null
      : accountQuery.data?.plan.billingInterval
  const interval
    = selectedInterval
      ?? accountQuery.data?.plan.scheduledBillingInterval
      ?? paidInterval
      ?? 'month'
  const currentProOptionCode
    = accountQuery.data?.plan.code === 'pro'
      ? accountQuery.data.plan.recurringOptionCode
      : null
  const effectiveProOptionCode
    = selectedProOptionCode
      ?? accountQuery.data?.plan.scheduledRecurringOptionCode
      ?? currentProOptionCode
  const proIndex = Math.max(
    0,
    proPlan?.recurringOptions.findIndex(
      option => option.code === effectiveProOptionCode,
    ) ?? 0,
  )
  const proOption = proPlan?.recurringOptions[proIndex]

  if (accountQuery.isPending || catalogQuery.isPending)
    return <BillingLoadingState />
  if (!accountQuery.data || !catalogQuery.data || !proPlan || !proOption) {
    return (
      <BillingErrorState
        retry={() => {
          void accountQuery.refetch()
          void catalogQuery.refetch()
        }}
      />
    )
  }

  const account = accountQuery.data
  const catalog = catalogQuery.data
  const currentPlan = plans.find(plan => plan.code === account.plan.code)
  const currentOption = currentPlan?.recurringOptions.find(
    option => option.code === account.plan.recurringOptionCode,
  )
  const isFree = account.plan.code === 'free'
  const busy
    = mutations.checkout.isPending
      || mutations.portal.isPending
      || mutations.subscription.isPending
      || mutations.subscriptionPreview.isPending
      || mutations.subscriptionScheduleCancel.isPending

  if (!isFree && (!currentPlan || !currentOption || !paidInterval)) {
    return (
      <BillingErrorState
        retry={() => {
          void accountQuery.refetch()
          void catalogQuery.refetch()
        }}
      />
    )
  }

  async function openPortal() {
    try {
      const result = await mutations.portal.mutateAsync()
      setSelectedInterval(null)
      setSelectedProOptionCode(null)
      window.location.assign(result.url)
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'billing.actionFailed'))
    }
  }

  async function reviewSubscriptionChange(
    plan: CatalogPlan,
    option: RecurringOption,
    billingInterval: 'month' | 'year',
  ) {
    if (!account.permissions.canManageBilling)
      return
    try {
      if (plan.code !== 'creator' && plan.code !== 'pro')
        return
      const preview = await mutations.subscriptionPreview.mutateAsync({
        billingInterval,
        catalogRevision: catalog.revision,
        planCode: plan.code,
        recurringOptionCode: option.code,
      })
      setPendingChange({
        billingInterval,
        idempotencyKey: crypto.randomUUID(),
        option,
        plan,
        preview,
      })
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'billing.actionFailed'))
    }
  }

  async function confirmSubscriptionChange() {
    if (!pendingChange || !account.permissions.canManageBilling)
      return
    if (
      pendingChange.plan.code !== 'creator'
      && pendingChange.plan.code !== 'pro'
    ) {
      return
    }
    try {
      const result = await mutations.subscription.mutateAsync({
        billingInterval: pendingChange.billingInterval,
        catalogRevision: catalog.revision,
        idempotencyKey: pendingChange.idempotencyKey,
        planCode: pendingChange.plan.code,
        prorationDate: pendingChange.preview.prorationDate ?? undefined,
        recurringOptionCode: pendingChange.option.code,
      })
      if (result.status === 'payment_required') {
        if (!result.paymentUrl)
          throw new Error('subscription_payment_url_missing')
        window.location.assign(result.paymentUrl)
        return
      }
      setPendingChange(null)
      toast.success(
        t(
          result.status === 'applied'
            ? 'billing.changeApplied'
            : 'billing.changeScheduled',
        ),
      )
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'billing.actionFailed'))
    }
  }

  async function cancelScheduledChange() {
    if (!account.permissions.canManageBilling)
      return
    try {
      const result = await mutations.subscriptionScheduleCancel.mutateAsync()
      setSelectedInterval(null)
      setSelectedProOptionCode(null)
      if (result.canceled)
        toast.success(t('billing.scheduledChangeCanceled'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'billing.actionFailed'))
    }
  }

  async function startCheckout(plan: CatalogPlan, option: RecurringOption) {
    if (
      !account.permissions.canManageBilling
      || account.plan.code !== 'free'
      || (plan.code !== 'creator' && plan.code !== 'pro')
    ) {
      return
    }
    try {
      const result = await mutations.checkout.mutateAsync({
        billingInterval: interval,
        catalogRevision: catalog.revision,
        idempotencyKey: crypto.randomUUID(),
        planCode: plan.code,
        recurringOptionCode: option.code,
      })
      window.location.assign(result.url)
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'billing.actionFailed'))
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('billing.plans')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              isFree
                ? 'billing.plansDescription'
                : 'billing.paidPlansDescription',
            )}
          </p>
        </div>
        {isFree && (
          <ToggleGroup
            aria-label={t('billing.plansDescription')}
            spacing={0}
            value={[interval]}
            variant="outline"
            onValueChange={(value) => {
              const nextInterval = value[0]
              if (nextInterval === 'month' || nextInterval === 'year')
                setSelectedInterval(nextInterval)
            }}
          >
            <ToggleGroupItem value="month">
              {t('billing.monthly')}
            </ToggleGroupItem>
            <ToggleGroupItem value="year">
              {t('billing.annual')}
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </header>
      <Separator />
      {isFree && (
        <BillingFreePlanGrid
          account={account}
          busy={busy}
          interval={interval}
          plans={plans}
          proIndex={proIndex}
          proPlan={proPlan}
          onCheckout={(plan, option) => void startCheckout(plan, option)}
          onProOptionChange={option => setSelectedProOptionCode(option.code)}
        />
      )}
      {!isFree && currentPlan && currentOption && paidInterval && (
        <BillingPaidPlanSettings
          account={account}
          billingInterval={paidInterval}
          busy={busy}
          currentOption={currentOption}
          currentPlan={currentPlan}
          plans={plans}
          proIndex={proIndex}
          proOption={proOption}
          proPlan={proPlan}
          targetBillingInterval={interval}
          onBillingIntervalChange={setSelectedInterval}
          onCancelScheduledChange={() => void cancelScheduledChange()}
          onManageBilling={() => void openPortal()}
          onProOptionChange={option => setSelectedProOptionCode(option.code)}
          onReviewChange={(plan, option, billingInterval) =>
            void reviewSubscriptionChange(plan, option, billingInterval)}
        />
      )}
      {account.plan.status === 'past_due' && (
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertDescription>{t('billing.pastDueNotice')}</AlertDescription>
        </Alert>
      )}
      {account.plan.status === 'blocked_review' && (
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertDescription>
            {t('billing.blockedReviewNotice')}
          </AlertDescription>
        </Alert>
      )}
      {pendingChange && account.plan.paidThrough && (
        <BillingUpgradeDialog
          open
          pending={mutations.subscription.isPending}
          plan={t(`billing.planNames.${pendingChange.plan.code}`)}
          preview={pendingChange.preview}
          onConfirm={() => void confirmSubscriptionChange()}
          onOpenChange={(open) => {
            if (!open && !mutations.subscription.isPending)
              setPendingChange(null)
          }}
        />
      )}
    </div>
  )
}
