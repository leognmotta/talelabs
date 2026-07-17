/** Lazy detail-query boundary for one connected or candidate port value. */

import type { PortPreviewItem } from './flow-node-port-preview'

import { HoverCard, HoverCardTrigger } from '@talelabs/ui/components/hover-card'
import { useState } from 'react'
import { useAssetDetailQuery } from '../../../../assets/data/asset-queries'
import { FlowNodePortItemDetails } from './flow-node-port-item-details'
import { FlowNodePortThumbnail } from './flow-node-port-thumbnail'

/** Displays one connected or candidate port value with canonical Asset details. */
export function FlowNodePortItemRow({
  item,
  label,
}: {
  item: PortPreviewItem
  label: string
}) {
  const [detailRequested, setDetailRequested] = useState(false)
  const assetDetail = useAssetDetailQuery(
    item.asset ? null : item.assetId ?? null,
    detailRequested,
  )
  const resolvedItem: PortPreviewItem = assetDetail.data
    ? {
        ...item,
        asset: {
          ...assetDetail.data,
          generationModel: assetDetail.data.generation?.model ?? null,
        },
        name: assetDetail.data.name,
      }
    : item
  const displayName = resolvedItem.text || resolvedItem.name

  function handleOpenChange(open: boolean) {
    if (open && item.assetId && !item.asset)
      setDetailRequested(true)
  }

  return (
    <HoverCard onOpenChange={handleOpenChange}>
      <HoverCardTrigger
        closeDelay={100}
        delay={150}
        render={(
          <div
            aria-label={`${label}: ${resolvedItem.name}`}
            className="
              flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left
            "
          />
        )}
      >
        <FlowNodePortThumbnail item={resolvedItem} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {displayName}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {label}
          </span>
        </span>
      </HoverCardTrigger>
      <FlowNodePortItemDetails item={resolvedItem} label={label} />
    </HoverCard>
  )
}
