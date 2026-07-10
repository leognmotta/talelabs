import type { Control, UseFormRegister } from 'react-hook-form'
import type { BrandFormValues } from './brand-schema'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Field, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { useFieldArray } from 'react-hook-form'

export function BrandColorsField({
  control,
  register,
}: {
  control: Control<BrandFormValues>
  register: UseFormRegister<BrandFormValues>
}) {
  const colors = useFieldArray({ control, name: 'colors' })

  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>Colors</FieldLabel>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => colors.append({ name: '', hex: '#000000' })}
        >
          <IconPlus data-icon="inline-start" />
          Add color
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {colors.fields.map((color, index) => (
          <div
            className="
              grid grid-cols-[2.5rem_minmax(0,1fr)_8rem_2rem] items-center gap-2
            "
            key={color.id}
          >
            <Input
              aria-label={`Color ${index + 1}`}
              className="h-9 p-1"
              type="color"
              {...register(`colors.${index}.hex`)}
            />
            <Input
              aria-label="Color name"
              placeholder="Name"
              {...register(`colors.${index}.name`)}
            />
            <Input
              aria-label="Hex value"
              {...register(`colors.${index}.hex`)}
            />
            <Button
              aria-label="Remove color"
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => colors.remove(index)}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
      </div>
    </Field>
  )
}
