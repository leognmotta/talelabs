import type { ElementDetailViewProps } from './element-detail-view.types'

import { BrandElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementColorPalette,
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

export function BrandElementDetail({ element }: ElementDetailViewProps) {
  const { t } = useTranslation()
  const { colors, communicationStyle, description, identity, ...unhandled }
    = BrandElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  void identity
  if (!description && !communicationStyle && colors.length === 0)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      {description && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('brand', 'description', 'label'))}
        >
          <ElementContextText value={description} />
        </ElementContextField>
      )}
      {communicationStyle && (
        <ElementContextField
          label={t(elementFieldTranslationKey('brand', 'communicationStyle', 'label'))}
        >
          <ElementContextText value={communicationStyle} />
        </ElementContextField>
      )}
      {colors.length > 0 && (
        <ElementContextField
          label={t(elementFieldTranslationKey('brand', 'colors', 'label'))}
        >
          <ElementColorPalette colors={colors} />
        </ElementContextField>
      )}
    </ElementContextSection>
  )
}
