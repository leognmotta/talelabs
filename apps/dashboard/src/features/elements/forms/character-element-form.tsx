import type { CharacterElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'

import { zodResolver } from '@hookform/resolvers/zod'
import {
  CharacterElementDataSchema,
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

const CharacterFormSchema = createElementFormSchema(CharacterElementDataSchema)
type CharacterFormValues = ZodInfer<typeof CharacterFormSchema>
type CharacterFormInput = ZodInput<typeof CharacterFormSchema>

export function CharacterElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { t } = useTranslation()
  const form = useForm<CharacterFormInput, unknown, CharacterFormValues>({
    resolver: zodResolver(CharacterFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'character',
        initialValue?.data ?? {},
      ) as CharacterElementData,
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
            id="element-character-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-character-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-character-description"
            label={t(
              elementFieldTranslationKey('character', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-character-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-character-personality"
            label={t(
              elementFieldTranslationKey('character', 'personality', 'label'),
            )}
            error={errors.data?.personality}
          >
            <Textarea
              id="element-character-personality"
              aria-invalid={Boolean(errors.data?.personality)}
              rows={3}
              {...form.register('data.personality')}
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
