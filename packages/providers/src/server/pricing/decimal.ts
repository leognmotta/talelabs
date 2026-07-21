/** Exact decimal arithmetic shared by provider-cost formulas and routing. */

import BigNumber from 'bignumber.js'

BigNumber.config({ DECIMAL_PLACES: 30, ROUNDING_MODE: BigNumber.ROUND_HALF_UP })

/** Multiplies exact decimal values and emits a normalized non-exponential string. */
export function multiplyProviderCostDecimals(
  ...values: readonly (number | string)[]
): string {
  return values
    .reduce((amount, value) => amount.multipliedBy(value), new BigNumber(1))
    .toFixed()
}

/** Adds exact decimal USD amounts without binary floating-point drift. */
export function addProviderCostDecimals(
  values: readonly string[],
): string {
  return values
    .reduce((amount, value) => amount.plus(value), new BigNumber(0))
    .toFixed()
}

/** Compares exact decimal amounts for deterministic provider routing. */
export function compareProviderCostDecimals(
  left: string,
  right: string,
): -1 | 0 | 1 {
  const comparison = new BigNumber(left).comparedTo(right)
  if (comparison === null)
    throw new TypeError('invalid_provider_cost_decimal')
  return comparison < 0 ? -1 : comparison > 0 ? 1 : 0
}

/** Divides exact decimal values for reviewed provider pricing formulas. */
export function divideProviderCostDecimals(
  numerator: number | string,
  denominator: number | string,
): string {
  return new BigNumber(numerator).dividedBy(denominator).toFixed()
}
