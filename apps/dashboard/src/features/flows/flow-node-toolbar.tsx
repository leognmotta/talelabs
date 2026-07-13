/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import {
  IconArrowsMaximize,
  IconCrop,
  IconDownload,
  IconLock,
  IconLockOpen,
} from '@tabler/icons-react'
import { getAssetsIdDownload } from '@talelabs/sdk'
import { Button } from '@talelabs/ui/components/button'
import { Separator } from '@talelabs/ui/components/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@talelabs/ui/components/tooltip'
import { NodeToolbar, Position } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { getOrganizationRequestHeaders } from '../../shared/lib/organization-request'
import { useActiveOrganizationId } from '../organizations/organization-scope-context'
import { useFlowCanvas } from './flow-canvas-context'

function ToolbarButton({
  icon: Icon,
  label,
  pressed,
  onClick,
}: {
  icon: typeof IconLock
  label: string
  onClick: () => void
  pressed?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            aria-label={label}
            aria-pressed={pressed}
            size="icon-sm"
            type="button"
            variant={pressed ? 'secondary' : 'ghost'}
            onClick={onClick}
          />
        )}
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function FlowNodeToolbar({ nodeId }: { nodeId: string }) {
  const { t } = useTranslation()
  const canvas = useFlowCanvas()
  const organizationId = useActiveOrganizationId()
  const node = canvas.getNode(nodeId)

  if (!node)
    return null

  const asset = node.assetId
    ? canvas.referenceData.assetsById.get(node.assetId)
    : undefined
  const locked = node.data.locked === true
  const canUseMediaTools = Boolean(
    asset && ['audio', 'image', 'video'].includes(asset.type),
  )
  const canCropImage = Boolean(
    asset?.type === 'image' && (asset.thumbnailUrl || asset.url),
  )

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
    <NodeToolbar
      className="
        nodrag nopan flex items-center gap-1 rounded-xl border border-border/90
        bg-card/96 p-1 shadow-xl backdrop-blur-sm
      "
      nodeId={nodeId}
      offset={10}
      position={Position.Top}
    >
      {canUseMediaTools && (
        <>
          {canCropImage && (
            <ToolbarButton
              icon={IconCrop}
              label={t('flows.nodeToolbar.crop')}
              pressed={canvas.editingImageCropNodeId === nodeId}
              onClick={() => canvas.setEditingImageCropNodeId(
                canvas.editingImageCropNodeId === nodeId ? null : nodeId,
              )}
            />
          )}
          <ToolbarButton
            icon={IconDownload}
            label={t('assets.download')}
            onClick={() => void downloadAsset()}
          />
          <ToolbarButton
            icon={IconArrowsMaximize}
            label={t('flows.nodeToolbar.fullscreen')}
            onClick={() => void viewFullscreen()}
          />
          <Separator className="h-5! self-center!" orientation="vertical" />
        </>
      )}
      <ToolbarButton
        icon={locked ? IconLockOpen : IconLock}
        label={t(locked
          ? 'flows.nodeToolbar.unlock'
          : 'flows.nodeToolbar.lock')}
        pressed={locked}
        onClick={() => canvas.updateNodeData(nodeId, current => ({
          ...current,
          locked: !locked,
        }))}
      />
    </NodeToolbar>
  )
}
