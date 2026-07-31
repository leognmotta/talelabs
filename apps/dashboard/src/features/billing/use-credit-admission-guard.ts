/**
 * Shared browser-side admission guard for every TaleLabs credit-funded action.
 *
 * The account summary is advisory and prevents avoidable paid admission calls.
 * Transactional server reservation remains authoritative for stale balances,
 * concurrent tabs, and pricing races.
 */

import type { BillingAccountResponse } from '@talelabs/sdk'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getApiErrorCode } from '../../shared/lib/api-error'
import {
  billingAccountQueryKey,
  invalidateBillingActivityQueries,
  useBillingAccountQuery,
} from './billing-queries'
import { useGenerationAccessDialog } from './generation-access-dialog-context'

/** Coordinates cached balance checks, funding choices, and balance refreshes. */
export function useCreditAdmissionGuard(organizationId: string) {
  const queryClient = useQueryClient()
  const accountQuery = useBillingAccountQuery(organizationId)
  const refetchAccount = accountQuery.refetch
  const { openGenerationAccessDialog } = useGenerationAccessDialog()

  const openAccessOptions = useCallback((
    reason: 'apiKeyRequired' | 'creditsRequired',
    requiredCredits: null | number,
    account?: BillingAccountResponse,
  ) => {
    const currentAccount = account
      ?? queryClient.getQueryData<BillingAccountResponse>(
        billingAccountQueryKey(organizationId),
      )
    openGenerationAccessDialog({
      availableCredits: currentAccount?.credits.available ?? null,
      canManageBilling:
        currentAccount?.permissions.canManageBilling ?? null,
      reason,
      requiredCredits,
    })
  }, [openGenerationAccessDialog, organizationId, queryClient])

  const ensureCreditsAvailable = useCallback(async (requiredCredits: number) => {
    const currentAccount
      = queryClient.getQueryData<BillingAccountResponse>(
        billingAccountQueryKey(organizationId),
      )
      ?? (await refetchAccount()).data
    if (
      !currentAccount
      || currentAccount.credits.available < requiredCredits
    ) {
      openAccessOptions('creditsRequired', requiredCredits, currentAccount)
      return false
    }
    return true
  }, [openAccessOptions, organizationId, queryClient, refetchAccount])

  const handleInsufficientCreditsError = useCallback((error: unknown) => {
    if (getApiErrorCode(error) !== 'insufficient_credits')
      return false
    openAccessOptions('creditsRequired', null)
    void invalidateBillingActivityQueries(queryClient, organizationId)
    return true
  }, [openAccessOptions, organizationId, queryClient])

  const showApiKeyRequired = useCallback(() => {
    openAccessOptions('apiKeyRequired', null)
  }, [openAccessOptions])

  const recordCreditAdmission = useCallback((quotedCredits: number) => {
    if (quotedCredits <= 0)
      return
    queryClient.setQueryData<BillingAccountResponse>(
      billingAccountQueryKey(organizationId),
      current => current
        ? {
            ...current,
            credits: {
              available: Math.max(
                0,
                current.credits.available - quotedCredits,
              ),
              reserved: current.credits.reserved + quotedCredits,
            },
          }
        : current,
    )
    void invalidateBillingActivityQueries(queryClient, organizationId)
  }, [organizationId, queryClient])

  return {
    /** Verifies the cached/refetched balance before a paid admission request. */
    ensureCreditsAvailable,
    /** Converts an authoritative race-time 402 into funding choices. */
    handleInsufficientCreditsError,
    /** Applies the accepted quote immediately, then refreshes server truth. */
    recordCreditAdmission,
    /** Offers all funding paths when browser BYOK has no stored key. */
    showApiKeyRequired,
  }
}
