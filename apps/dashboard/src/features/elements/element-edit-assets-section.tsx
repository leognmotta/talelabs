import type { ElementDetail } from '@talelabs/sdk'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@talelabs/ui/components/card'
import { useTranslation } from 'react-i18next'
import { ElementAssetsTab } from './element-assets-tab'
import { ELEMENT_FORM_SECTIONS } from './element-form-sections'

export function ElementEditAssetsSection({
  element,
}: {
  element: ElementDetail
}) {
  const { t } = useTranslation()

  return (
    <Card id={ELEMENT_FORM_SECTIONS.assets} className="scroll-mt-6">
      <CardHeader className="border-b">
        <CardTitle>{t('navigation.assets')}</CardTitle>
        <CardDescription>
          {t('elements.editAssetsDescription')}
        </CardDescription>
        <CardDescription className="mt-2 max-w-2xl">
          {t('elements.assetLimits.guidance')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ElementAssetsTab element={element} />
      </CardContent>
    </Card>
  )
}
