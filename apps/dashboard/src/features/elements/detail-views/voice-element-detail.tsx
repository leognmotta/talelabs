import type { ElementDetailViewProps } from './element-detail-view.types'

import { VoiceElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

function getLanguageDisplayName(value: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], {
      fallback: 'code',
      languageDisplay: 'dialect',
      type: 'language',
    }).of(value) ?? value
  }
  catch {
    return value
  }
}

export function VoiceElementDetail({ element }: ElementDetailViewProps) {
  const { i18n, t } = useTranslation()
  const { description, languageAccent, tone, ...unhandled }
    = VoiceElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  if (!description && !languageAccent && !tone)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      {description && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('voice', 'description', 'label'))}
        >
          <ElementContextText value={description} />
        </ElementContextField>
      )}
      {languageAccent && (
        <ElementContextField
          label={t(elementFieldTranslationKey('voice', 'languageAccent', 'label'))}
        >
          <ElementContextText
            value={getLanguageDisplayName(
              languageAccent,
              i18n.resolvedLanguage ?? 'en',
            )}
          />
        </ElementContextField>
      )}
      {tone && (
        <ElementContextField
          label={t(elementFieldTranslationKey('voice', 'tone', 'label'))}
        >
          <ElementContextText value={tone} />
        </ElementContextField>
      )}
    </ElementContextSection>
  )
}
