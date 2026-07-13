import type { ElementDetailViewProps } from './element-detail-view.types'

import { OtherElementDataSchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import { elementFieldTranslationKey } from '../element-i18n'
import { assertNoUnhandledElementFields } from './element-detail-exhaustiveness'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

export function OtherElementDetail({ element }: ElementDetailViewProps) {
  const { t } = useTranslation()
  const { assetRoles, identity, ...unhandled }
    = OtherElementDataSchema.parse(element.data)
  assertNoUnhandledElementFields(unhandled)
  void assetRoles
  void identity
  const instructions = element.instructions?.trim() ?? ''
  if (!instructions)
    return null

  return (
    <ElementContextSection title={t('elements.createEditor.sections.details.label')}>
      <ElementContextField
        className="md:col-span-2"
        label={t(elementFieldTranslationKey('other', 'instructions', 'label'))}
      >
        <ElementContextText value={instructions} />
      </ElementContextField>
    </ElementContextSection>
  )
}
