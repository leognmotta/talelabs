import type { ElementDetailViewProps } from './element-detail-view.types'

import { ProductElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
  ElementNumberedList,
} from './element-detail-primitives'

export function ProductElementDetail({ element }: ElementDetailViewProps) {
  const { t } = useTranslation()
  const { description, sellingPoints, ...unhandled }
    = ProductElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  if (!description && sellingPoints.length === 0)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      {description && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('product', 'description', 'label'))}
        >
          <ElementContextText value={description} />
        </ElementContextField>
      )}
      {sellingPoints.length > 0 && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('product', 'sellingPoints', 'label'))}
        >
          <ElementNumberedList values={sellingPoints} />
        </ElementContextField>
      )}
    </ElementContextSection>
  )
}
