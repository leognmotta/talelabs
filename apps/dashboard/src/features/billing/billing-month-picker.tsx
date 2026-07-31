/** Data-bearing billing month selector composed from shared shadcn primitives. */

import { IconCalendarMonth } from '@tabler/icons-react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@talelabs/ui/components/select'
import { useTranslation } from 'react-i18next'

function parseMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  return new Date(year!, month! - 1, 1)
}

/** Selects one UTC billing month from months containing organization data. */
export function BillingMonthPicker({
  availableMonths,
  value,
  onValueChange,
}: {
  /** Data-bearing UTC months ordered newest first and encoded as YYYY-MM. */
  availableMonths: string[]
  /** Currently selected month, encoded as `YYYY-MM`. */
  value: string
  /** Receives a committed `YYYY-MM` month selection. */
  onValueChange: (value: string) => void
}) {
  const { i18n, t } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language
  const months = [...new Set(availableMonths)].sort((left, right) =>
    right.localeCompare(left))
  const years = [...new Set(months.map(month => month.slice(0, 4)))]
  const fullMonthFormatter = new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric',
  })
  const monthFormatter = new Intl.DateTimeFormat(language, {
    month: 'long',
  })
  const formattedMonth = fullMonthFormatter.format(parseMonth(value))

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null && months.includes(nextValue))
          onValueChange(nextValue)
      }}
    >
      <SelectTrigger
        aria-label={`${t('billing.usageMonth')}: ${formattedMonth}`}
        className="min-w-40 font-normal"
      >
        <IconCalendarMonth data-icon="inline-start" />
        <span className="flex-1 text-left">{formattedMonth}</span>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {years.map(year => (
          <SelectGroup key={year}>
            <SelectLabel>{year}</SelectLabel>
            {months
              .filter(month => month.startsWith(`${year}-`))
              .map(month => (
                <SelectItem key={month} value={month}>
                  {monthFormatter.format(parseMonth(month))}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
