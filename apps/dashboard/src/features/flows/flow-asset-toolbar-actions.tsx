import { IconArrowsMaximize, IconCrop, IconDownload } from '@tabler/icons-react'
import { getAssetsIdDownload } from '@talelabs/sdk'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { useFlowCanvas } from './flow-canvas-context'
import { FlowToolbarButton } from './flow-toolbar-button'

export function FlowAssetToolbarActions({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const organizationId = useActiveOrganizationId()
  const node = canvas.getNode(nodeId)
  const asset = node?.assetId
    ? canvas.referenceData.assetsById.get(node.assetId)
    : undefined
  const canUseMediaTools = Boolean(
    asset && ['audio', 'image', 'video'].includes(asset.type),
  )
  const canCropImage = Boolean(
    asset?.type === 'image' && (asset.thumbnailUrl || asset.url),
  )

  if (!canUseMediaTools)
    return null

  async function downloadAsset() {
    if (!asset || !organizationId)
      return
    try {
      const result = await getAssetsIdDownload(
        { id: asset.id },
        { headers: getOrganizationRequestHeaders(organizationId) },
      )
      window.location.assign(result.url)
      toast.success(t('assets.downloadStarted'))
    }
    catch (error) {
      toast.error(getApiErrorMessage(error, 'assets.actionFailed'))
    }
  }

  async function viewFullscreen() {
    const frame = document.getElementById(`flow-node-media-${nodeId}`)
    if (!frame)
      return
    try {
      await frame.requestFullscreen()
    }
    catch {
      toast.error(t('flows.nodeToolbar.fullscreenFailed'))
    }
  }

  return (
    <>
      {canCropImage && (
        <FlowToolbarButton
          icon={IconCrop}
          label={t('flows.nodeToolbar.crop')}
          pressed={canvas.editingImageCropNodeId === nodeId}
          onClick={() => canvas.setEditingImageCropNodeId(
            canvas.editingImageCropNodeId === nodeId ? null : nodeId,
          )}
        />
      )}
      <FlowToolbarButton
        icon={IconDownload}
        label={t('assets.download')}
        onClick={() => void downloadAsset()}
      />
      <FlowToolbarButton
        icon={IconArrowsMaximize}
        label={t('flows.nodeToolbar.fullscreen')}
        onClick={() => void viewFullscreen()}
      />
    </>
  )
}
