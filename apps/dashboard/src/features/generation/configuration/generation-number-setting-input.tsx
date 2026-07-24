/** Draft-safe numeric control that commits only catalog-valid normalized values. */

import type { GenerationSettingDefinition } from '@talelabs/flows'

import { Input } from '@talelabs/ui/components/input'
import { useState } from 'react'
import { normalizeNumberSetting } from './generation-number-setting'

type NumberSetting = Extract<GenerationSettingDefinition, { kind: 'number' }>

/** Renders a draftable number input and commits only valid normalized settings. */
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
