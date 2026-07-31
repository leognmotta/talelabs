/**
 * Bounded Stripe-return reconciliation for webhook-projected billing state.
 *
 * Stripe redirects the browser independently from webhook delivery. A fresh
 * page can therefore cache pre-payment state immediately before PostgreSQL is
 * updated, so successful returns briefly refresh every affected projection.
 */

import { useQueryClient } from '@tanstack/react-query'
import { parseAsStringEnum, useQueryState } from 'nuqs'
import { useEffect } from 'react'

import {
  billingCatalogQueryKey,
  invalidateBillingActivityQueries,
} from './billing-queries'

const BILLING_RETURN_REFRESH_ATTEMPTS = 15
const BILLING_RETURN_REFRESH_INTERVAL_MS = 1_000
const billingReturnParser = parseAsStringEnum<'canceled' | 'success'>([
  'canceled',
  'success',
])

/** Reconciles a successful Stripe return without keeping permanent polling. */
export function BillingReturnReconciler({
  organizationId,
}: {
  /** Active tenant whose webhook-projected billing state must settle. */
  organizationId: null | string
}) {
  const queryClient = useQueryClient()
  const [billingReturn, setBillingReturn] = useQueryState(
    'billingReturn',
    billingReturnParser,
  )

  useEffect(() => {
    if (!billingReturn)
      return
    if (billingReturn === 'canceled') {
      void setBillingReturn(null, { history: 'replace' })
      return
    }
    if (!organizationId)
      return

    let canceled = false
    let timeout: number | undefined
    let attempt = 0

    const refresh = async () => {
      await Promise.allSettled([
        invalidateBillingActivityQueries(queryClient, organizationId),
        queryClient.invalidateQueries({
          exact: true,
          queryKey: billingCatalogQueryKey(organizationId),
        }),
      ])
      if (canceled)
        return
      attempt += 1
      if (attempt >= BILLING_RETURN_REFRESH_ATTEMPTS) {
        void setBillingReturn(null, { history: 'replace' })
        return
      }
      timeout = window.setTimeout(
        () => void refresh(),
        BILLING_RETURN_REFRESH_INTERVAL_MS,
      )
    }

    void refresh()
    return () => {
      canceled = true
      if (timeout !== undefined)
        window.clearTimeout(timeout)
    }
  }, [
    billingReturn,
    organizationId,
    queryClient,
    setBillingReturn,
  ])

  return null
}
