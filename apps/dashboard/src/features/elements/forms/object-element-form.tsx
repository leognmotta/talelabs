import type { ObjectElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { ObjectElementDataSchema, parseElementData } from '@talelabs/elements'
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

const ObjectFormSchema = createElementFormSchema(ObjectElementDataSchema)
type ObjectFormValues = ZodInfer<typeof ObjectFormSchema>
type ObjectFormInput = ZodInput<typeof ObjectFormSchema>

export function ObjectElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<ObjectFormInput, unknown, ObjectFormValues>({
    resolver: zodResolver(ObjectFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'object',
        initialValue?.data ?? {},
      ) as ObjectElementData,
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
            id="element-object-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-object-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-object-description"
            label={t(
              elementFieldTranslationKey('object', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-object-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-object-interaction"
            label={t(
              elementFieldTranslationKey(
                'object',
                'interactionGuidance',
                'label',
              ),
            )}
            error={errors.data?.interactionGuidance}
          >
            <Textarea
              id="element-object-interaction"
              aria-invalid={Boolean(errors.data?.interactionGuidance)}
              rows={3}
              {...form.register('data.interactionGuidance')}
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
