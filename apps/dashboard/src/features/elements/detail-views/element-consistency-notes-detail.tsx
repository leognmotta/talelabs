import type { ElementDetail } from '@talelabs/sdk'

import { ElementIdentitySchema } from '@talelabs/elements'
import { useTranslation } from 'react-i18next'
import {
  ElementContextField,
  ElementContextSection,
  ElementContextText,
} from './element-detail-primitives'

export function ElementConsistencyNotesDetail({
  element,
}: {
  element: ElementDetail
}) {
  const { t } = useTranslation()
  const identity = ElementIdentitySchema.parse(element.data.identity)
  const summary = identity.summary.trim()

  if (!summary)
    return null

  return (
    <ElementContextSection title={t('elements.consistencyNotes.label')}>
      <ElementContextField
        className="md:col-span-2"
        label={t('elements.consistencyNotes.description')}
      >
        <ElementContextText value={summary} />
      </ElementContextField>
    </ElementContextSection>
  )
}
