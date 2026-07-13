import type { VoiceElementData } from '@talelabs/elements'
import type { infer as ZodInfer, input as ZodInput } from 'zod'
import type { ElementFormProps } from './element-form.types'
import { zodResolver } from '@hookform/resolvers/zod'
import { parseElementData, VoiceElementDataSchema } from '@talelabs/elements'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@talelabs/ui/components/combobox'
import { FieldGroup } from '@talelabs/ui/components/field'
import { Input } from '@talelabs/ui/components/input'
import { Textarea } from '@talelabs/ui/components/textarea'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { ElementConsistencyNotesField } from './element-consistency-notes-field'
import { ElementDataFormSection } from './element-data-form-section'
import { ElementFormActions } from './element-form-actions'
import { ElementFormField } from './element-form-field'
import { createElementFormSchema } from './element-form-schema'
import {
  createVoiceLanguageOptions,
  filterVoiceLanguageOption,
} from './voice-language-options'

const VoiceFormSchema = createElementFormSchema(VoiceElementDataSchema)
type VoiceFormValues = ZodInfer<typeof VoiceFormSchema>
type VoiceFormInput = ZodInput<typeof VoiceFormSchema>

export function VoiceElementForm({
  assetsSection,
  initialValue,
  onSubmit,
  pending,
  submitLabel,
}: ElementFormProps) {
  const { i18n, t } = useTranslation()
  const form = useForm<VoiceFormInput, unknown, VoiceFormValues>({
    resolver: zodResolver(VoiceFormSchema),
    defaultValues: {
      name: initialValue?.name ?? '',
      data: parseElementData(
        'voice',
        initialValue?.data ?? {},
      ) as VoiceElementData,
    },
  })
  const { errors, isSubmitting } = form.formState
  const languageAccent = useWatch({
    control: form.control,
    name: 'data.languageAccent',
  })
  const languageOptions = useMemo(
    () => createVoiceLanguageOptions(
      i18n.resolvedLanguage ?? 'en',
      languageAccent ?? '',
    ),
    [i18n.resolvedLanguage, languageAccent],
  )
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <ElementDataFormSection>
        <FieldGroup className="gap-5">
          <ElementFormField
            id="element-voice-name"
            label={t('common.name')}
            error={errors.name}
          >
            <Input
              id="element-voice-name"
              aria-invalid={Boolean(errors.name)}
              autoFocus
              {...form.register('name')}
            />
          </ElementFormField>
          <ElementFormField
            id="element-voice-description"
            label={t(
              elementFieldTranslationKey('voice', 'description', 'label'),
            )}
            error={errors.data?.description}
          >
            <Textarea
              id="element-voice-description"
              aria-invalid={Boolean(errors.data?.description)}
              rows={4}
              {...form.register('data.description')}
            />
          </ElementFormField>
          <Controller
            control={form.control}
            name="data.languageAccent"
            render={({ field, fieldState }) => {
              const selectedOption = languageOptions.find(option =>
                option.value === field.value) ?? null
              return (
                <ElementFormField
                  id="element-voice-language"
                  label={t(elementFieldTranslationKey(
                    'voice',
                    'languageAccent',
                    'label',
                  ))}
                  error={fieldState.error}
                >
                  <Combobox
                    autoHighlight
                    filter={filterVoiceLanguageOption}
                    inputRef={field.ref}
                    isItemEqualToValue={(option, value) =>
                      option.value === value.value}
                    items={languageOptions}
                    name={field.name}
                    value={selectedOption}
                    onValueChange={option =>
                      field.onChange(option?.value ?? '')}
                  >
                    <ComboboxInput
                      id="element-voice-language"
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                      placeholder={t(elementFieldTranslationKey(
                        'voice',
                        'languageAccent',
                        'placeholder',
                      ))}
                      showClear
                      onBlur={field.onBlur}
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>
                        {t(elementFieldTranslationKey(
                          'voice',
                          'languageAccent',
                          'empty',
                        ))}
                      </ComboboxEmpty>
                      <ComboboxList>
                        {option => (
                          <ComboboxItem key={option.value} value={option}>
                            {option.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </ElementFormField>
              )
            }}
          />
          <ElementFormField
            id="element-voice-tone"
            label={t(elementFieldTranslationKey('voice', 'tone', 'label'))}
            error={errors.data?.tone}
          >
            <Textarea
              id="element-voice-tone"
              aria-invalid={Boolean(errors.data?.tone)}
              rows={3}
              {...form.register('data.tone')}
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
