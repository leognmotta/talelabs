import type { FlowReferenceAsset } from '@talelabs/sdk'
import type { PortPreviewItem } from './flow-node-port-preview'

import { Badge } from '@talelabs/ui/components/badge'
import { HoverCardContent } from '@talelabs/ui/components/hover-card'
import { useTranslation } from 'react-i18next'
import { formatDuration } from '../assets/asset-formatters'
import { FlowNodePortMediaPreview } from './flow-node-port-media-preview'
import { FlowNodePortMetadataRow } from './flow-node-port-metadata-row'
import { valueTypeLabel } from './flow-node-port-preview'

function greatestCommonDivisor(left: number, right: number): number {
  return right === 0 ? left : greatestCommonDivisor(right, left % right)
}

function assetAspectRatio(asset?: FlowReferenceAsset) {
  if (!asset?.width || !asset.height)
    return null
  const divisor = greatestCommonDivisor(asset.width, asset.height)
  return `${asset.width / divisor}:${asset.height / divisor}`
}

export function FlowNodePortItemDetails({
  item,
  label,
}: {
  item: PortPreviewItem
  label: string
}) {
  const { t } = useTranslation()
  const dimensions = item.asset?.width && item.asset.height
    ? `${item.asset.width} × ${item.asset.height}`
    : null
  const aspectRatio = assetAspectRatio(item.asset)
  const duration = item.asset
    ? formatDuration(item.asset.durationSeconds)
    : null

  return (
    <HoverCardContent
      align="start"
      className="w-72 overflow-hidden rounded-xl p-0"
      side="left"
      sideOffset={12}
    >
      <div className="border-b border-border/70 px-4 py-2.5 text-xs font-medium">
        {label}
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate font-medium" title={item.name}>
            {item.name}
          </p>
          <Badge variant="secondary">{valueTypeLabel(item.valueType, t)}</Badge>
        </div>
        {(item.asset || item.previewUrl) && (
          <FlowNodePortMediaPreview item={item} />
        )}
        {item.text !== undefined && (
          <p className="
            max-h-32 overflow-auto rounded-lg border border-border/70
            bg-muted/35 p-3 text-xs/relaxed whitespace-pre-wrap
          "
          >
            {item.text}
          </p>
        )}
        {(dimensions || aspectRatio || duration) && (
          <dl className="flex flex-col gap-2 text-xs">
            {dimensions && (
              <FlowNodePortMetadataRow
                label={t('assets.dimensions')}
                value={dimensions}
              />
            )}
            {aspectRatio && (
              <FlowNodePortMetadataRow
                label={t('flows.settings.aspectRatio')}
                value={aspectRatio}
              />
            )}
            {duration && (
              <FlowNodePortMetadataRow
                label={t('assets.duration')}
                value={duration}
              />
            )}
          </dl>
        )}
      </div>
    </HoverCardContent>
  )
}
