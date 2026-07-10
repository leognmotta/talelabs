import type { Control, UseFormRegister } from 'react-hook-form'
import type { ProductFormValues } from './product-schema'

import { IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { Field, FieldLabel } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { useFieldArray } from 'react-hook-form'

export function ProductListField({
  control,
  label,
  name,
  register,
}: {
  control: Control<ProductFormValues>
  label: string
  name: 'benefits' | 'features'
  register: UseFormRegister<ProductFormValues>
}) {
  const items = useFieldArray({ control, name })

  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => items.append({ value: '' })}
        >
          <IconPlus data-icon="inline-start" />
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.fields.map((item, index) => (
          <div className="flex gap-2" key={item.id}>
            <Input
              aria-label={`${label} ${index + 1}`}
              {...register(`${name}.${index}.value`)}
            />
            <Button
              aria-label={`Remove ${label.toLowerCase()}`}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => items.remove(index)}
            >
              <IconTrash />
            </Button>
          </div>
        ))}
      </div>
    </Field>
  )
}
