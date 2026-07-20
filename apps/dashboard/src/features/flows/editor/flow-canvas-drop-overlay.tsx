/** Full-canvas affordance shown while OS files are dragged over the editor. */

import { IconUpload } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useAssetUploadPolicyDescription } from '../../assets/upload/use-asset-upload-policy-description'

/** Renders the dashed drop ring and guidance chip during an active file drag. */
export function FlowCanvasDropOverlay() {
  const { t } = useTranslation()
  const policyDescription = useAssetUploadPolicyDescription()

  return (
    <div
      className="
        pointer-events-none absolute inset-3 z-50 flex items-center
        justify-center rounded-2xl border-2 border-dashed border-primary/50
        bg-primary/5
      "
      data-flow-chrome-enter
    >
      <div
        className="
          flex flex-col items-center gap-2 rounded-xl px-6 py-5 text-center
        "
        data-flow-chrome
      >
        <IconUpload aria-hidden className="size-6 text-primary" />
        <span className="text-sm font-medium">
          {t('flows.dropAssets.title')}
        </span>
        <span className="max-w-xs text-xs text-muted-foreground">
          {policyDescription}
        </span>
      </div>
    </div>
  )
}
