import type { BrandElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { BrandElementDataSchema, parseElementData } from '@talelabs/elements'
import { FieldGroup } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { ColorPaletteField } from './color-palette-field'
import { ElementDataFormSection } from './element-data-form-section'
import { ElementFormActions } from './element-form-actions'
import { ElementFormField } from './element-form-field'
import { createElementFormSchema } from './element-form-schema'

const BrandFormSchema = createElementFormSchema(BrandElementDataSchema)
type BrandFormValues = ZodInfer<typeof BrandFormSchema>
type BrandFormInput = ZodInput<typeof BrandFormSchema>

export function BrandElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<BrandFormInput, unknown, BrandFormValues>({
    resolver: zodResolver(BrandFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'brand',
        initialValue?.data ?? {},
      ) as BrandElementData,
    },
  })
  const { errors, isSubmitting } = form.formState
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <ElementDataFormSection>
        <FieldGroup className="gap-5">
          <ElementFormField
            id="element-brand-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-brand-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-brand-description"
            label={t(
              elementFieldTranslationKey('brand', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-brand-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-brand-communication"
            label={t(
              elementFieldTranslationKey(
                'brand',
                'communicationStyle',
                'label',
              ),
            )}
            error={errors.data?.communicationStyle}
          >
            <Textarea
              id="element-brand-communication"
              aria-invalid={Boolean(errors.data?.communicationStyle)}
              rows={3}
              {...form.register('data.communicationStyle')}
            />
          </ElementFormField>
          <Controller
            control={form.control}
            name="data.colors"
            render={({ field, fieldState }) => (
              <ColorPaletteField
                error={fieldState.error}
                value={field.value ?? []}
                onBlur={field.onBlur}
                onChange={field.onChange}
              />
            )}
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
