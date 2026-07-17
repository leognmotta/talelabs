/** Browser download handoff for canonical Asset files. */

import { getAssetsIdDownload } from '@talelabs/sdk'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../../organizations/organization-scope-context'

/** Resolves the canonical download URL and hands it to browser navigation. */
export function useAssetDownload() {
  const { t } = useTranslation()
  const organizationId = useActiveOrganizationId()

  return async (assetId: string) => {
    if (!organizationId)
      return
    try {
      const result = await getAssetsIdDownload(
        { id: assetId },
        { headers: getOrganizationRequestHeaders(organizationId) },
      )
      window.location.assign(result.url)
      toast.success(t('assets.downloadStarted'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
    }
  }
}
