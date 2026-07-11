import type { ReactNode } from 'react'

import { useTranslation } from 'react-i18next'
import { ELEMENT_FORM_SECTIONS } from '../element-form-sections'
import { ElementFormSection } from './element-form-section'

export function ElementDataFormSection({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <ElementFormSection
      description={t('elements.createEditor.sections.details.description')}
      id={ELEMENT_FORM_SECTIONS.data}
      title={t('elements.dataTab')}
    >
      {children}
    </ElementFormSection>
  )
}
