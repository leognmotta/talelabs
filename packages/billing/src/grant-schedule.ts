/** UTC monthly subscription grant periods and annual revenue allocation. */

/** One eligible monthly grant period derived from an original UTC anchor. */
export interface MonthlyGrantPeriod {
  /** Zero-based ordinal month from the original subscription anchor. */
  ordinal: number
  /** Inclusive grant-period start. */
  startsAt: Date
  /** Exclusive next monthly boundary. */
  endsAt: Date
}

function daysInUtcMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Resolves a month from the original anchor without clamp drift. */
export function monthlyGrantBoundary(anchor: Date, ordinal: number) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0)
    throw new RangeError('Grant ordinal must be a nonnegative integer.')
  const anchorYear = anchor.getUTCFullYear()
  const anchorMonth = anchor.getUTCMonth()
  const targetMonthIndex = anchorMonth + ordinal
  const targetYear = anchorYear + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12
  const day = Math.min(
    anchor.getUTCDate(),
    daysInUtcMonth(targetYear, targetMonth),
  )
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    day,
    anchor.getUTCHours(),
    anchor.getUTCMinutes(),
    anchor.getUTCSeconds(),
    anchor.getUTCMilliseconds(),
  ))
}

/**
 * Resolves the monthly credit period containing one instant without iterating
 * from the original anchor.
 */
export function monthlyGrantPeriodAt(
  anchor: Date,
  instant: Date,
): MonthlyGrantPeriod {
  if (instant < anchor)
    throw new RangeError('Grant-period instant cannot precede its anchor.')
  const monthDifference
    = (instant.getUTCFullYear() - anchor.getUTCFullYear()) * 12
      + instant.getUTCMonth() - anchor.getUTCMonth()
  let ordinal = Math.max(0, monthDifference)
  if (monthlyGrantBoundary(anchor, ordinal) > instant)
    ordinal -= 1
  while (monthlyGrantBoundary(anchor, ordinal + 1) <= instant)
    ordinal += 1
  return {
    endsAt: monthlyGrantBoundary(anchor, ordinal + 1),
    ordinal,
    startsAt: monthlyGrantBoundary(anchor, ordinal),
  }
}

/** Lists every due monthly grant period bounded by paid service. */
export function dueMonthlyGrantPeriods(input: {
  /** Original paid subscription start used for every month calculation. */
  anchor: Date
  /** Maximum number of periods returned in one bounded reconciliation. */
  limit?: number
  /** Reconciliation instant. */
  now: Date
  /** Exclusive paid service boundary confirmed by invoice payment. */
  paidThrough: Date
  /** Ordinal from which bounded reconciliation resumes. */
  startOrdinal?: number
}): MonthlyGrantPeriod[] {
  const limit = input.limit ?? 24
  const startOrdinal = input.startOrdinal ?? 0
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new RangeError('Grant reconciliation limit must be positive.')
  if (!Number.isSafeInteger(startOrdinal) || startOrdinal < 0)
    throw new RangeError('Grant start ordinal must be nonnegative.')
  const periods: MonthlyGrantPeriod[] = []
  for (
    let ordinal = startOrdinal;
    ordinal < startOrdinal + limit;
    ordinal += 1
  ) {
    const startsAt = monthlyGrantBoundary(input.anchor, ordinal)
    if (startsAt > input.now || startsAt >= input.paidThrough)
      break
    periods.push({
      ordinal,
      startsAt,
      endsAt: monthlyGrantBoundary(input.anchor, ordinal + 1),
    })
  }
  return periods
}

/** Allocates annual invoice cents across twelve grants with earliest remainders. */
export function allocateAnnualRevenueUsdCents(amountUsdCents: number) {
  return allocateRevenueUsdCents(
    amountUsdCents,
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  )
}

/**
 * Allocates paid cents across positive credit weights by largest remainder.
 *
 * The returned integer amounts always sum to the exact paid amount. Equal
 * fractional remainders favor earlier periods for deterministic replay.
 */
export function allocateRevenueUsdCents(
  amountUsdCents: number,
  creditWeights: readonly number[],
) {
  if (!Number.isSafeInteger(amountUsdCents) || amountUsdCents < 0)
    throw new RangeError('Invoice amount must be nonnegative cents.')
  if (
    !creditWeights.length
    || creditWeights.some(
      weight => !Number.isSafeInteger(weight) || weight < 0,
    )
  ) {
    throw new RangeError('Revenue weights must be nonnegative whole credits.')
  }
  const totalWeight = creditWeights.reduce(
    (total, weight) => total + BigInt(weight),
    0n,
  )
  if (totalWeight === 0n)
    throw new RangeError('Revenue allocation requires a positive credit weight.')
  const amount = BigInt(amountUsdCents)
  const allocations = creditWeights.map(
    weight => Number((amount * BigInt(weight)) / totalWeight),
  )
  let centsRemaining
    = amountUsdCents
      - allocations.reduce((total, allocation) => total + allocation, 0)
  const remainderOrder = creditWeights
    .map((weight, index) => ({
      index,
      remainder: (amount * BigInt(weight)) % totalWeight,
    }))
    .sort((left, right) =>
      left.remainder === right.remainder
        ? left.index - right.index
        : left.remainder > right.remainder ? -1 : 1,
    )
  for (const { index, remainder } of remainderOrder) {
    if (centsRemaining === 0)
      break
    if (remainder === 0n)
      continue
    allocations[index]! += 1
    centsRemaining -= 1
  }
  if (centsRemaining !== 0)
    throw new Error('Revenue allocation remainder was not exhausted.')
  return allocations
}

/**
 * Resolves one annual payment's exact revenue share for a monthly credit
 * period, including partial first-period credits from an immediate change.
 */
export function annualRevenueForGrantPeriod(input: {
  /** Exact paid Invoice amount in USD cents. */
  amountUsdCents: number
  /** Monthly credit schedule anchor active for the paid service. */
  anchor: Date
  /** Credits funded in the first partially covered monthly period. */
  firstPeriodCredits: number
  /** Credits funded in each later full monthly period. */
  laterPeriodCredits: number
  /** Monthly credit-period start whose revenue share is requested. */
  periodStart: Date
  /** Inclusive paid-line service boundary. */
  servicePeriodStart: Date
  /** Exclusive paid-line service boundary. */
  servicePeriodEnd: Date
}) {
  if (input.servicePeriodEnd <= input.servicePeriodStart)
    throw new RangeError('Annual paid service period must be positive.')
  const firstPeriod = input.servicePeriodStart <= input.anchor
    ? {
        endsAt: monthlyGrantBoundary(input.anchor, 1),
        ordinal: 0,
        startsAt: input.anchor,
      }
    : monthlyGrantPeriodAt(input.anchor, input.servicePeriodStart)
  const periods: MonthlyGrantPeriod[] = []
  for (
    let ordinal = firstPeriod.ordinal;
    periods.length < 24;
    ordinal += 1
  ) {
    const startsAt = monthlyGrantBoundary(input.anchor, ordinal)
    if (startsAt >= input.servicePeriodEnd)
      break
    periods.push({
      endsAt: monthlyGrantBoundary(input.anchor, ordinal + 1),
      ordinal,
      startsAt,
    })
  }
  const weights = periods.map((_, index) =>
    index === 0 ? input.firstPeriodCredits : input.laterPeriodCredits,
  )
  const targetIndex = periods.findIndex(
    period => period.startsAt.getTime() === input.periodStart.getTime(),
  )
  if (targetIndex < 0)
    throw new Error('Grant period is outside the annual paid service.')
  return allocateRevenueUsdCents(input.amountUsdCents, weights)[targetIndex]!
}
