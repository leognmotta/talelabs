/** Continuation and canonical Asset actions for one Create result. */

import type { FlowRunAssetOutput } from '@talelabs/sdk'

import { IconVideo } from '@tabler/icons-react'
import { Button } from '@talelabs/ui/components/button'
import { useTranslation } from 'react-i18next'

/** Presents media-compatible continuation actions without owning mutations. */
export function CreateResultActions({
  output,
  onMakeVideo,
  onOpenAsset,
  onUseAsReference,
}: {
  /** Composes an Image output as a Video start frame. */
  onMakeVideo: (output: FlowRunAssetOutput) => void
  /** Opens the existing shared Asset viewer. */
  onOpenAsset: (assetId: string) => void
  /** Explicitly attaches one output to the next request. */
  onUseAsReference: (output: FlowRunAssetOutput) => void
  /** Canonical output whose media type controls available actions. */
  output: FlowRunAssetOutput
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2 pt-3">
      <Button
        size="xs"
        type="button"
        variant="secondary"
        onClick={() => onUseAsReference(output)}
      >
        {t('create.results.useAsReference')}
      </Button>
      {output.type === 'image' && (
        <Button
          size="xs"
          type="button"
          variant="outline"
          onClick={() => onMakeVideo(output)}
        >
          <IconVideo data-icon="inline-start" />
          {t('create.results.makeVideo')}
        </Button>
      )}
      <Button
        size="xs"
        type="button"
        variant="ghost"
        onClick={() => onOpenAsset(output.assetId)}
      >
        {t('create.results.openAsset')}
      </Button>
    </div>
  )
}
