import type { LocationElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  LocationElementDataSchema,
  parseElementData,
} from '@talelabs/elements'
import { FieldGroup } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { ElementDataFormSection } from './element-data-form-section'
import { ElementFormActions } from './element-form-actions'
import { ElementFormField } from './element-form-field'
import { createElementFormSchema } from './element-form-schema'

const LocationFormSchema = createElementFormSchema(LocationElementDataSchema)
type LocationFormValues = ZodInfer<typeof LocationFormSchema>
type LocationFormInput = ZodInput<typeof LocationFormSchema>

export function LocationElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<LocationFormInput, unknown, LocationFormValues>({
    resolver: zodResolver(LocationFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'location',
        initialValue?.data ?? {},
      ) as LocationElementData,
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
            id="element-location-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-location-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-location-description"
            label={t(
              elementFieldTranslationKey('location', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-location-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-location-atmosphere"
            label={t(
              elementFieldTranslationKey('location', 'atmosphere', 'label'),
            )}
            error={errors.data?.atmosphere}
          >
            <Textarea
              id="element-location-atmosphere"
              aria-invalid={Boolean(errors.data?.atmosphere)}
              rows={3}
              {...form.register('data.atmosphere')}
            />
          </ElementFormField>
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
