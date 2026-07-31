/** Minimal exact rational arithmetic for billing decisions and serialization. */

/** Reduced exact rational number with a positive denominator. */
export interface Rational {
  /** Signed numerator. */
  numerator: bigint
  /** Positive denominator. */
  denominator: bigint
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left
  let b = right < 0n ? -right : right
  while (b !== 0n)
    [a, b] = [b, a % b]
  return a || 1n
}

/** Creates a normalized exact rational value. */
export function rational(
  numerator: bigint | number,
  denominator: bigint | number = 1n,
): Rational {
  let nextNumerator = BigInt(numerator)
  let nextDenominator = BigInt(denominator)
  if (nextDenominator === 0n)
    throw new RangeError('A rational denominator cannot be zero.')
  if (nextDenominator < 0n) {
    nextNumerator = -nextNumerator
    nextDenominator = -nextDenominator
  }
  const divisor = greatestCommonDivisor(nextNumerator, nextDenominator)
  return {
    numerator: nextNumerator / divisor,
    denominator: nextDenominator / divisor,
  }
}

/** Parses a base-10 decimal string without floating-point conversion. */
export function rationalFromDecimal(value: string): Rational {
  if (!/^-?\d+(?:\.\d+)?$/.test(value))
    throw new TypeError(`Invalid exact decimal: ${value}`)
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [whole, fraction = ''] = unsigned.split('.')
  const denominator = 10n ** BigInt(fraction.length)
  const numerator = BigInt(`${whole}${fraction}`)
  return rational(negative ? -numerator : numerator, denominator)
}

/** Adds two exact rational values. */
export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator
    + right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

/** Subtracts one exact rational value from another. */
export function subtractRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator
    - right.numerator * left.denominator,
    left.denominator * right.denominator,
  )
}

/** Multiplies two exact rational values. */
export function multiplyRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  )
}

/** Divides one exact rational value by another. */
export function divideRational(left: Rational, right: Rational): Rational {
  if (right.numerator === 0n)
    throw new RangeError('Cannot divide by zero.')
  return rational(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  )
}

/** Floors a nonnegative exact rational to an integer. */
export function floorRational(value: Rational): bigint {
  if (value.numerator < 0n)
    throw new RangeError('floorRational only accepts nonnegative values.')
  return value.numerator / value.denominator
}

/** Ceils a nonnegative exact rational to an integer. */
export function ceilRational(value: Rational): bigint {
  if (value.numerator < 0n)
    throw new RangeError('ceilRational only accepts nonnegative values.')
  return (value.numerator + value.denominator - 1n) / value.denominator
}

/** Compares two exact rational values. */
export function compareRational(left: Rational, right: Rational) {
  const difference = left.numerator * right.denominator
    - right.numerator * left.denominator
  return difference < 0n ? -1 : difference > 0n ? 1 : 0
}

/** Serializes a rational as a rounded-down fixed decimal without exponent form. */
export function rationalToDecimal(
  value: Rational,
  maximumFractionDigits = 12,
): string {
  if (!Number.isInteger(maximumFractionDigits) || maximumFractionDigits < 0)
    throw new RangeError('maximumFractionDigits must be a nonnegative integer.')
  const negative = value.numerator < 0n
  const numerator = negative ? -value.numerator : value.numerator
  const whole = numerator / value.denominator
  let remainder = numerator % value.denominator
  if (maximumFractionDigits === 0 || remainder === 0n)
    return `${negative ? '-' : ''}${whole}`
  let fraction = ''
  for (
    let index = 0;
    index < maximumFractionDigits && remainder !== 0n;
    index += 1
  ) {
    remainder *= 10n
    fraction += String(remainder / value.denominator)
    remainder %= value.denominator
  }
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Converts a bounded bigint to a safe JavaScript integer. */
export function safeInteger(value: bigint): number {
  const numberValue = Number(value)
  if (!Number.isSafeInteger(numberValue))
    throw new RangeError('Billing integer exceeds the safe JavaScript range.')
  return numberValue
}
