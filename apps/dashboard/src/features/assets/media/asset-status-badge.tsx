/** Localized presentation of the canonical Asset processing lifecycle. */

import type { Asset } from '@talelabs/sdk'

import { Badge } from '@talelabs/ui/components/badge'
import { useTranslation } from 'react-i18next'

/** Displays the localized processing or lifecycle status that needs user attention. */
export function AssetStatusBadge({ asset }: { asset: Asset }) {
  const { t } = useTranslation()

  if (asset.lifecycle === 'purging')
    return <Badge variant="destructive">{t('assets.purging')}</Badge>
  if (asset.lifecycle === 'archived')
    return <Badge variant="outline">{t('assets.archived')}</Badge>
  if (asset.processingState === 'processing')
    return <Badge variant="secondary">{t('assets.processing')}</Badge>
  if (asset.processingState === 'failed')
    return <Badge variant="destructive">{t('assets.failed')}</Badge>

  return null
}
