/** Exact policy for classifying and crediting paid subscription changes. */

import { floorRational, rational, safeInteger } from './exact.js'

/** User-visible execution mode for one paid subscription change. */
export type SubscriptionChangeMode = 'current' | 'immediate' | 'renewal'

/** Commercial facts required to classify a paid subscription change. */
export interface SubscriptionChangeSelection {
  /** Billing cadence of the selected offer. */
  billingInterval: 'month' | 'year'
  /** Monthly generation allowance of the selected recurring option. */
  monthlyCredits: number
  /** Stable plan identity of the selected offer. */
  planCode: 'creator' | 'pro'
  /** Stable recurring-option identity of the selected offer. */
  recurringOptionCode: string
}

/**
 * Classifies increases and monthly-to-annual switches as immediate while every
 * decrease and annual-to-monthly switch remains renewal-bound.
 */
export function classifySubscriptionChange(
  current: SubscriptionChangeSelection,
  target: SubscriptionChangeSelection,
): SubscriptionChangeMode {
  const sameSelection
    = current.planCode === target.planCode
      && current.recurringOptionCode === target.recurringOptionCode
      && current.billingInterval === target.billingInterval
  if (sameSelection)
    return 'current'
  if (
    current.billingInterval === 'year'
    && target.billingInterval === 'month'
  ) {
    return 'renewal'
  }
  if (target.monthlyCredits < current.monthlyCredits)
    return 'renewal'
  if (
    current.billingInterval === 'month'
    && target.billingInterval === 'year'
  ) {
    return 'immediate'
  }
  return target.monthlyCredits > current.monthlyCredits
    ? 'immediate'
    : 'renewal'
}

/**
 * Floors the incremental allowance for the remaining seconds of the current
 * monthly credit period. Flooring makes repeated upgrades unable to overgrant.
 */
export function proratedUpgradeCredits(input: {
  /** Current option's full monthly allowance. */
  currentMonthlyCredits: number
  /** Instant at which the paid change becomes effective. */
  effectiveAt: Date
  /** Exclusive boundary of the current monthly credit period. */
  periodEnd: Date
  /** Inclusive boundary of the current monthly credit period. */
  periodStart: Date
  /** Target option's full monthly allowance. */
  targetMonthlyCredits: number
}) {
  const values = [
    input.currentMonthlyCredits,
    input.targetMonthlyCredits,
  ]
  if (values.some(value => !Number.isSafeInteger(value) || value < 0))
    throw new RangeError('Subscription credits must be nonnegative integers.')
  if (
    input.periodEnd <= input.periodStart
    || input.effectiveAt < input.periodStart
    || input.effectiveAt >= input.periodEnd
  ) {
    throw new RangeError('Upgrade instant must be inside the credit period.')
  }
  const increase
    = Math.max(0, input.targetMonthlyCredits - input.currentMonthlyCredits)
  const remainingMilliseconds
    = input.periodEnd.getTime() - input.effectiveAt.getTime()
  const periodMilliseconds
    = input.periodEnd.getTime() - input.periodStart.getTime()
  return safeInteger(floorRational(rational(
    BigInt(increase) * BigInt(remainingMilliseconds),
    BigInt(periodMilliseconds),
  )))
}
