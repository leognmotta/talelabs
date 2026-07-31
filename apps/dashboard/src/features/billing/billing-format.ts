/** Locale-aware presentation helpers for generated Billing contracts. */

/** Formats whole credits in the active locale. */
export function formatCredits(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value)
}

/** Formats integer USD cents without browser-owned billing arithmetic. */
export function formatUsdCents(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    currency: 'USD',
    style: 'currency',
  }).format(value / 100)
}

/** Formats a byte projection with an appropriate binary unit. */
export function formatBytes(value: number, locale: string) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let amount = value
  let unitIndex = 0
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024
    unitIndex += 1
  }
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(amount)} ${units[unitIndex]}`
}

/** Formats catalog basis points as a localized percentage. */
export function formatBasisPoints(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    style: 'percent',
  }).format(value / 10_000)
}
