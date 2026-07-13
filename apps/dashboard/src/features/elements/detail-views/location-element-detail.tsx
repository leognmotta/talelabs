import type { ElementDetailViewProps } from './element-detail-view.types'

import { LocationElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

export function LocationElementDetail({ element }: ElementDetailViewProps) {
  const { t } = useTranslation()
  const { atmosphere, description, identity, ...unhandled }
    = LocationElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  void identity
  if (!description && !atmosphere)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      {description && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('location', 'description', 'label'))}
        >
          <ElementContextText value={description} />
        </ElementContextField>
      )}
      {atmosphere && (
        <ElementContextField
          label={t(elementFieldTranslationKey('location', 'atmosphere', 'label'))}
        >
          <ElementContextText value={atmosphere} />
        </ElementContextField>
      )}
    </ElementContextSection>
  )
}
