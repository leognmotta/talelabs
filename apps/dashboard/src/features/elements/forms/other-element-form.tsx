import type { OtherElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'

import { zodResolver } from '@hookform/resolvers/zod'
import { OtherElementDataSchema, parseElementData } from '@talelabs/elements'
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
import { createElementFormSchemaWithInstructions } from './element-form-schema'

const OtherFormSchema = createElementFormSchemaWithInstructions(
  OtherElementDataSchema,
)
type OtherFormValues = ZodInfer<typeof OtherFormSchema>
type OtherFormInput = ZodInput<typeof OtherFormSchema>

export function OtherElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<OtherFormInput, unknown, OtherFormValues>({
    resolver: zodResolver(OtherFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      instructions: initialValue?.instructions ?? '',
      data: parseElementData(
        'other',
        initialValue?.data ?? {},
      ) as OtherElementData,
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
            id="element-other-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-other-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-other-instructions"
            label={t(
              elementFieldTranslationKey('other', 'instructions', 'label'),
            )}
            description={t(
              elementFieldTranslationKey(
                'other',
                'instructions',
                'description',
              ),
            )}
            error={errors.instructions}
          >
            <Textarea
              id="element-other-instructions"
              aria-invalid={Boolean(errors.instructions)}
              placeholder={t(
                elementFieldTranslationKey(
                  'other',
                  'instructions',
                  'placeholder',
                ),
              )}
              rows={6}
              {...form.register('instructions')}
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
