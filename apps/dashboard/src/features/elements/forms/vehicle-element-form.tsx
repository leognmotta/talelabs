import type { VehicleElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { parseElementData, VehicleElementDataSchema } from '@talelabs/elements'
import { FieldGroup } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { ElementConsistencyNotesField } from './element-consistency-notes-field'
import { ElementDataFormSection } from './element-data-form-section'
import { ElementFormActions } from './element-form-actions'
import { ElementFormField } from './element-form-field'
import { createElementFormSchema } from './element-form-schema'

const VehicleFormSchema = createElementFormSchema(VehicleElementDataSchema)
type VehicleFormValues = ZodInfer<typeof VehicleFormSchema>
type VehicleFormInput = ZodInput<typeof VehicleFormSchema>

export function VehicleElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(VehicleFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'vehicle',
        initialValue?.data ?? {},
      ) as VehicleElementData,
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
            id="element-vehicle-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-vehicle-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-vehicle-description"
            label={t(
              elementFieldTranslationKey('vehicle', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-vehicle-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-vehicle-motion"
            label={t(
              elementFieldTranslationKey('vehicle', 'motionGuidance', 'label'),
            )}
            error={errors.data?.motionGuidance}
          >
            <Textarea
              id="element-vehicle-motion"
              aria-invalid={Boolean(errors.data?.motionGuidance)}
              rows={3}
              {...form.register('data.motionGuidance')}
            />
          </ElementFormField>
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
