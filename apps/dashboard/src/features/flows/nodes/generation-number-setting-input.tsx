import type { GenerationSettingDefinition } from '@talelabs/flows'

import { Input } from '@talelabs/ui/components/input'
import { useState } from 'react'

type NumberSetting = Extract<GenerationSettingDefinition, { kind: 'number' }>

function decimalPlaces(value: number) {
  const [coefficient, exponentText] = value.toString().toLowerCase().split('e')
  const exponent = Number(exponentText ?? 0)
  const fractionLength = coefficient?.split('.')[1]?.length ?? 0
  return Math.max(0, fractionLength - exponent)
}

function normalizeNumberSetting(value: number, setting: NumberSetting) {
  const clamped = Math.min(setting.max, Math.max(setting.min, value))
  const steps = Math.round((clamped - setting.min) / setting.step)
  const aligned = setting.min + steps * setting.step
  const precision = Math.min(
    12,
    Math.max(
      decimalPlaces(setting.min),
      decimalPlaces(setting.max),
      decimalPlaces(setting.step),
    ),
  )
  return Number(aligned.toFixed(precision))
}

export function GenerationNumberSettingInput({
  ariaLabel,
  onValueChange,
  setting,
  value,
}: {
  ariaLabel: string
  onValueChange: (value: number) => void
  setting: NumberSetting
  value: number
}) {
  const [draft, setDraft] = useState(String(value))

  function commit() {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const normalized = normalizeNumberSetting(parsed, setting)
    setDraft(String(normalized))
    if (normalized !== value)
      onValueChange(normalized)
  }

  return (
    <Input
      aria-label={ariaLabel}
      className="h-8 w-28 text-xs"
      max={setting.max}
      min={setting.min}
      step={setting.step}
      type="number"
      value={draft}
      onBlur={commit}
      onChange={event => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter')
          event.currentTarget.blur()
        if (event.key === 'Escape')
          setDraft(String(value))
      }}
    />
  )
}
