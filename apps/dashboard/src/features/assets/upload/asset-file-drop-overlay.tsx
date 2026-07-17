/** Full-surface feedback shown while accepted files hover over the Asset library. */

import { IconCloudUpload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useAssetUploadPolicyDescription } from './use-asset-upload-policy-description'

/** Shows the active file-drop target and localized upload-policy guidance. */
export function AssetFileDropOverlay() {
  const { t } = useTranslation()
  const policyDescription = useAssetUploadPolicyDescription()

  return (
    <div
      aria-live="polite"
      className="
        pointer-events-none absolute inset-0 flex items-center justify-center
        rounded-xl bg-background/90 ring-2 ring-primary ring-inset
      "
      role="status"
    >
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="
          flex size-11 items-center justify-center rounded-xl bg-primary
          text-primary-foreground
        "
        >
          <IconCloudUpload aria-hidden />
        </span>
        <span>
          <span className="block font-medium">{t('assets.dropFiles')}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{policyDescription}</span>
        </span>
      </div>
    </div>
  )
}
