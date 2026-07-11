import type { ElementDetailViewProps } from './element-detail-view.types'

import { ObjectElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

export function ObjectElementDetail({ element }: ElementDetailViewProps) {
  const { t } = useTranslation()
  const { description, interactionGuidance, ...unhandled }
    = ObjectElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  if (!description && !interactionGuidance)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      {description && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('object', 'description', 'label'))}
        >
          <ElementContextText value={description} />
        </ElementContextField>
      )}
      {interactionGuidance && (
        <ElementContextField
          label={t(elementFieldTranslationKey('object', 'interactionGuidance', 'label'))}
        >
          <ElementContextText value={interactionGuidance} />
        </ElementContextField>
      )}
    </ElementContextSection>
  )
}
