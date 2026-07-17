/** Localized summary derived from the canonical Asset upload limits. */

import { getAssetUploadMaxSizeBytes } from '@talelabs/assets'
import { useTranslation } from 'react-i18next'
import { formatAssetSize } from '../media/asset-formatters'

/** Localizes accepted media types and the maximum file size from the shared policy. */
export function useAssetUploadPolicyDescription() {
  const { i18n, t } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language

  return t('assets.supportedFiles', {
    audioLimit: formatAssetSize(getAssetUploadMaxSizeBytes('audio'), locale),
    imageLimit: formatAssetSize(getAssetUploadMaxSizeBytes('image'), locale),
    videoLimit: formatAssetSize(getAssetUploadMaxSizeBytes('video'), locale),
  })
}
