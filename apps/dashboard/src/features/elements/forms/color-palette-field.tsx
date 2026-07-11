import type { FieldError } from 'react-hook-form'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { BRAND_MAX_COLORS } from '@talelabs/elements'
import { Button } from '@talelabs/ui/components/button'
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalizedFieldError } from '../../../shared/components/localized-field-error'

const COMPLETE_HEX_COLOR = /^#[0-9A-F]{6}$/i

function normalizeHexDraft(value: string) {
  const withPrefix = value.startsWith('#') ? value : `#${value}`
  return COMPLETE_HEX_COLOR.test(withPrefix)
    ? withPrefix.toUpperCase()
    : value
}

export function ColorPaletteField({
  error,
  onBlur,
  onChange,
  value,
}: {
  error?: FieldError
  onBlur: () => void
  onChange: (colors: string[]) => void
  value: string[]
}) {
  const { t } = useTranslation()
  const [itemIds, setItemIds] = useState(
    () => value.map(() => crypto.randomUUID()),
  )

  function updateColor(index: number, color: string) {
    onChange(value.map((item, itemIndex) =>
      itemIndex === index ? color : item))
  }

  function removeColor(index: number) {
    setItemIds(current => current.filter((_, itemIndex) => itemIndex !== index))
    onChange(value.filter((_, itemIndex) => itemIndex !== index))
  }

  function addColor() {
    setItemIds(current => [...current, crypto.randomUUID()])
    onChange([...value, '#000000'])
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <FieldLabel>{t('elements.types.brand.fields.colors.label')}</FieldLabel>
          <FieldDescription>
            {t('elements.types.brand.fields.colors.description', {
              count: BRAND_MAX_COLORS,
            })}
          </FieldDescription>
        </div>
        <Button
          disabled={value.length >= BRAND_MAX_COLORS}
          size="sm"
          type="button"
          variant="outline"
          onClick={addColor}
        >
          <IconPlus data-icon="inline-start" />
          {t('elements.types.brand.fields.colors.add')}
        </Button>
      </div>

      {value.length === 0
        ? (
            <p
              className="
                rounded-lg bg-muted/40 px-3 py-5 text-center text-sm
                text-muted-foreground
              "
            >
              {t('elements.types.brand.fields.colors.empty')}
            </p>
          )
        : (
            <div
              className="
                grid gap-2
                sm:grid-cols-2
              "
            >
              {value.map((color, index) => {
                const pickerValue = COMPLETE_HEX_COLOR.test(color)
                  ? color
                  : '#000000'
                return (
                  <div
                    key={itemIds[index]}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <input
                      aria-label={t(
                        'elements.types.brand.fields.colors.pick',
                        { index: index + 1 },
                      )}
                      className="
                        size-9 shrink-0 cursor-pointer rounded-md border
                        bg-transparent p-1
                      "
                      type="color"
                      value={pickerValue}
                      onChange={event =>
                        updateColor(index, event.target.value.toUpperCase())}
                    />
                    <Input
                      aria-label={t(
                        'elements.types.brand.fields.colors.value',
                        { index: index + 1 },
                      )}
                      className="min-w-0 font-mono uppercase"
                      maxLength={7}
                      placeholder="#000000"
                      value={color}
                      onBlur={(event) => {
                        updateColor(index, normalizeHexDraft(event.target.value))
                        onBlur()
                      }}
                      onChange={event => updateColor(index, event.target.value)}
                    />
                    <Button
                      aria-label={t(
                        'elements.types.brand.fields.colors.remove',
                        { color },
                      )}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={() => removeColor(index)}
                    >
                      <IconTrash />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
      <LocalizedFieldError error={error} />
    </Field>
  )
}
