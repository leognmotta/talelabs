import type { FieldError } from 'react-hook-form'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import {
  PRODUCT_MAX_SELLING_POINTS,
  PRODUCT_SELLING_POINT_MAX_LENGTH,
} from '@talelabs/elements'
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

export function ProductSellingPointsField({
  error,
  onBlur,
  onChange,
  value,
}: {
  error?: FieldError
  onBlur: () => void
  onChange: (sellingPoints: string[]) => void
  value: string[]
}) {
  const { t } = useTranslation()
  const [itemIds, setItemIds] = useState(
    () => value.map(() => crypto.randomUUID()),
  )

  function updateSellingPoint(index: number, sellingPoint: string) {
    onChange(value.map((item, itemIndex) =>
      itemIndex === index ? sellingPoint : item))
  }

  function addSellingPoint() {
    setItemIds(current => [...current, crypto.randomUUID()])
    onChange([...value, ''])
  }

  function removeSellingPoint(index: number) {
    setItemIds(current => current.filter((_, itemIndex) => itemIndex !== index))
    onChange(value.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <FieldLabel>
            {t('elements.types.product.fields.sellingPoints.label')}
          </FieldLabel>
          <FieldDescription>
            {t('elements.types.product.fields.sellingPoints.description', {
              count: PRODUCT_MAX_SELLING_POINTS,
            })}
          </FieldDescription>
        </div>
        <Button
          disabled={value.length >= PRODUCT_MAX_SELLING_POINTS}
          size="sm"
          type="button"
          variant="outline"
          onClick={addSellingPoint}
        >
          <IconPlus data-icon="inline-start" />
          {t('elements.types.product.fields.sellingPoints.add')}
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
              {t('elements.types.product.fields.sellingPoints.empty')}
            </p>
          )
        : (
            <div className="flex flex-col gap-2">
              {value.map((sellingPoint, index) => (
                <div
                  key={itemIds[index]}
                  className="flex items-center gap-2"
                >
                  <span
                    aria-hidden="true"
                    className="
                      flex size-9 shrink-0 items-center justify-center
                      rounded-full bg-muted text-sm text-muted-foreground
                    "
                  >
                    {index + 1}
                  </span>
                  <Input
                    aria-label={t(
                      'elements.types.product.fields.sellingPoints.value',
                      { index: index + 1 },
                    )}
                    maxLength={PRODUCT_SELLING_POINT_MAX_LENGTH}
                    placeholder={t(
                      'elements.types.product.fields.sellingPoints.placeholder',
                    )}
                    value={sellingPoint}
                    onBlur={(event) => {
                      updateSellingPoint(index, event.target.value.trim())
                      onBlur()
                    }}
                    onChange={event =>
                      updateSellingPoint(index, event.target.value)}
                  />
                  <Button
                    aria-label={t(
                      'elements.types.product.fields.sellingPoints.remove',
                      { index: index + 1 },
                    )}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={() => removeSellingPoint(index)}
                  >
                    <IconTrash />
                  </Button>
                </div>
              ))}
            </div>
          )}
      <LocalizedFieldError error={error} />
    </Field>
  )
}
