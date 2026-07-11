import type { ElementDetailViewProps } from './element-detail-view.types'

import { VehicleElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

export function VehicleElementDetail({ element }: ElementDetailViewProps) {
  const { t } = useTranslation()
  const { description, motionGuidance, ...unhandled }
    = VehicleElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  if (!description && !motionGuidance)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      {description && (
        <ElementContextField
          className="md:col-span-2"
          label={t(elementFieldTranslationKey('vehicle', 'description', 'label'))}
        >
          <ElementContextText value={description} />
        </ElementContextField>
      )}
      {motionGuidance && (
        <ElementContextField
          label={t(elementFieldTranslationKey('vehicle', 'motionGuidance', 'label'))}
        >
          <ElementContextText value={motionGuidance} />
        </ElementContextField>
      )}
    </ElementContextSection>
  )
}
