import type { ProductElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'

import { zodResolver } from '@hookform/resolvers/zod'
import { parseElementData, ProductElementDataSchema } from '@talelabs/elements'
import { FieldGroup } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { ElementConsistencyNotesField } from './element-consistency-notes-field'
import { ElementDataFormSection } from './element-data-form-section'
import { ElementFormActions } from './element-form-actions'
import { ElementFormField } from './element-form-field'
import { createElementFormSchema } from './element-form-schema'
import { ProductSellingPointsField } from './product-selling-points-field'

const ProductFormSchema = createElementFormSchema(ProductElementDataSchema)
type ProductFormValues = ZodInfer<typeof ProductFormSchema>
type ProductFormInput = ZodInput<typeof ProductFormSchema>

function normalizeSellingPoints(values: string[]) {
  return values
    .map(value => value.trim())
    .filter(Boolean)
}

export function ProductElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'product',
        initialValue?.data ?? {},
      ) as ProductElementData,
    },
  })
  const { errors, isSubmitting } = form.formState

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(values => onSubmit({
        ...values,
        data: {
          ...values.data,
          sellingPoints: normalizeSellingPoints(values.data.sellingPoints),
        },
      }))}
    >
      <ElementDataFormSection>
        <FieldGroup className="gap-5">
          <ElementFormField
            id="element-product-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-product-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-product-description"
            label={t(
              elementFieldTranslationKey('product', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-product-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <Controller
            control={form.control}
            name="data.sellingPoints"
            render={({ field, fieldState }) => (
              <ProductSellingPointsField
                error={fieldState.error}
                value={field.value ?? []}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
          />
          <ElementConsistencyNotesField
            error={errors.data?.identity?.summary}
            registration={form.register('data.identity.summary')}
          />
        </FieldGroup>
      </ElementDataFormSection>
      {assetsSection}
      <ElementFormActions
        pending={pending || isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  )
}
