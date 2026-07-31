/** One organization-keyed TanStack Query and mutation boundary for Billing. */

import type {
  CreateBillingCheckoutMutationRequest,
  CreateBillingTopUpCheckoutMutationRequest,
  PreviewBillingSubscriptionChangeMutationRequest,
  UpdateBillingSubscriptionMutationRequest,
} from '@talelabs/sdk'

import type { QueryClient } from '@tanstack/react-query'
import {
  cancelBillingSubscriptionSchedule,
  createBillingCheckout,
  createBillingPortal,
  createBillingTopUpCheckout,
  getBillingAccount,
  getBillingCatalog,
  getBillingCreditsLedger,
  getBillingUsage,
  getBillingUsageMonths,
  getBillingUsageRuns,
  previewBillingSubscriptionChange,
  updateBillingSubscription,
} from '@talelabs/sdk'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

const ACTIVE_CREDIT_RESERVATION_REFRESH_MS = 2_000

/** Stable account-summary key including the active organization boundary. */
export function billingAccountQueryKey(organizationId: null | string) {
  return ['billing', organizationId, 'account'] as const
}

/** Stable public-catalog key because top-up values depend on current entitlement. */
export function billingCatalogQueryKey(organizationId: null | string) {
  return ['billing', organizationId, 'catalog'] as const
}

/** Stable selected-month Usage key. */
export function billingUsageQueryKey(
  organizationId: null | string,
  month: string,
) {
  return ['billing', organizationId, 'usage', month] as const
}

/** Stable available-month key for one organization. */
export function billingUsageMonthsQueryKey(
  organizationId: null | string,
) {
  return ['billing', organizationId, 'usage', 'months'] as const
}

/** Stable prefix covering every Usage summary, month, and run-history query. */
export function billingUsageScopeQueryKey(
  organizationId: null | string,
) {
  return ['billing', organizationId, 'usage'] as const
}

/** Stable selected-month and cursor run-history key. */
export function billingUsageRunsQueryKey(
  organizationId: null | string,
  month: string,
  cursor: null | string,
) {
  return [
    'billing',
    organizationId,
    'usage',
    month,
    'runs',
    cursor,
  ] as const
}

/** Stable cursor-page ledger key. */
export function billingLedgerQueryKey(
  organizationId: null | string,
  month: string,
  cursor: null | string,
) {
  return ['billing', organizationId, 'ledger', month, cursor] as const
}

/** Stable prefix covering every cursor page in the append-only ledger. */
export function billingLedgerScopeQueryKey(
  organizationId: null | string,
) {
  return ['billing', organizationId, 'ledger'] as const
}

/**
 * Refreshes every balance-derived billing projection after a credit mutation.
 *
 * Admission, capture, release, grants, and reversals can affect the sidebar,
 * Usage, available months, run history, and Transactions at the same time.
 */
export function invalidateBillingActivityQueries(
  queryClient: QueryClient,
  organizationId: null | string,
) {
  return Promise.allSettled([
    queryClient.invalidateQueries({
      exact: true,
      queryKey: billingAccountQueryKey(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: billingUsageScopeQueryKey(organizationId),
    }),
    queryClient.invalidateQueries({
      queryKey: billingLedgerScopeQueryKey(organizationId),
    }),
  ])
}

/** Reads the one sidebar and Settings billing account authority. */
export function useBillingAccountQuery(organizationId: null | string) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => getBillingAccount(),
    queryKey: billingAccountQueryKey(organizationId),
    refetchInterval: query => query.state.data?.credits.reserved
      ? ACTIVE_CREDIT_RESERVATION_REFRESH_MS
      : false,
    staleTime: 10_000,
  })
}

/** Reads the sanitized catalog priced for the active organization. */
export function useBillingCatalogQuery(organizationId: null | string) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => getBillingCatalog(),
    queryKey: billingCatalogQueryKey(organizationId),
    staleTime: 60_000,
  })
}

/** Reads one bounded UTC month of organization usage. */
export function useBillingUsageQuery(
  organizationId: null | string,
  month: string,
  enabled = true,
) {
  return useQuery({
    enabled: Boolean(organizationId) && enabled,
    queryFn: () => getBillingUsage({ params: { month } }),
    queryKey: billingUsageQueryKey(organizationId, month),
  })
}

/** Reads recent UTC months containing organization usage or transactions. */
export function useBillingUsageMonthsQuery(
  organizationId: null | string,
) {
  return useQuery({
    enabled: Boolean(organizationId),
    queryFn: () => getBillingUsageMonths(),
    queryKey: billingUsageMonthsQueryKey(organizationId),
    staleTime: 30_000,
  })
}

/** Reads one cursor page of member-visible runs in the selected UTC month. */
export function useBillingUsageRunsQuery(
  organizationId: null | string,
  month: string,
  cursor: null | string,
) {
  return useQuery({
    enabled: Boolean(organizationId),
    placeholderData: previous => previous,
    queryFn: () => getBillingUsageRuns({
      params: {
        cursor: cursor ?? undefined,
        limit: 20,
        month,
      },
    }),
    queryKey: billingUsageRunsQueryKey(organizationId, month, cursor),
    refetchInterval: query => query.state.data?.items.some(
      run => run.status === 'pending' || run.status === 'running',
    )
      ? 30_000
      : false,
  })
}

/** Reads one owner/admin cursor page from the append-only ledger. */
export function useBillingLedgerQuery(
  organizationId: null | string,
  month: string,
  cursor: null | string,
  enabled: boolean,
) {
  return useQuery({
    enabled: Boolean(organizationId) && enabled,
    queryFn: () => getBillingCreditsLedger({
      params: { cursor: cursor ?? undefined, limit: 30, month },
    }),
    queryKey: billingLedgerQueryKey(organizationId, month, cursor),
  })
}

interface IdempotentMutation {
  idempotencyKey: string
}

/** Stripe-hosted billing mutations with shared account/catalog invalidation. */
export function useBillingMutations(organizationId: null | string) {
  const queryClient = useQueryClient()

  async function invalidateBilling() {
    await Promise.all([
      invalidateBillingActivityQueries(queryClient, organizationId),
      queryClient.invalidateQueries({
        queryKey: billingCatalogQueryKey(organizationId),
      }),
    ])
  }

  const checkout = useMutation({
    mutationFn: (
      input: IdempotentMutation & CreateBillingCheckoutMutationRequest,
    ) => {
      const { idempotencyKey, ...data } = input
      return createBillingCheckout(
        { data },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    },
  })
  const topUp = useMutation({
    mutationFn: (
      input: IdempotentMutation & CreateBillingTopUpCheckoutMutationRequest,
    ) => {
      const { idempotencyKey, ...data } = input
      return createBillingTopUpCheckout(
        { data },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    },
  })
  const subscription = useMutation({
    mutationFn: (
      input: IdempotentMutation & UpdateBillingSubscriptionMutationRequest,
    ) => {
      const { idempotencyKey, ...data } = input
      return updateBillingSubscription(
        { data },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
    },
    onSuccess: invalidateBilling,
  })
  const subscriptionPreview = useMutation({
    mutationFn: (
      input: PreviewBillingSubscriptionChangeMutationRequest,
    ) => previewBillingSubscriptionChange({ data: input }),
  })
  const subscriptionScheduleCancel = useMutation({
    mutationFn: () => cancelBillingSubscriptionSchedule(),
    onSuccess: invalidateBilling,
  })
  const portal = useMutation({
    mutationFn: () => createBillingPortal(),
  })
  return {
    checkout,
    portal,
    subscription,
    subscriptionPreview,
    subscriptionScheduleCancel,
    topUp,
  }
}
