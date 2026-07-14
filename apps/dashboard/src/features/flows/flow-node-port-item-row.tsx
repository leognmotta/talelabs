import type { PortPreviewItem } from './flow-node-port-preview'
/* eslint-disable better-tailwindcss/no-unknown-classes -- React Flow uses these interaction classes as behavior hooks. */

import { HoverCard, HoverCardTrigger } from '@talelabs/ui/components/hover-card'
import { FlowNodePortItemDetails } from './flow-node-port-item-details'
import { FlowNodePortThumbnail } from './flow-node-port-thumbnail'

export function FlowNodePortItemRow({
  item,
  label,
  onActivate,
}: {
  item: PortPreviewItem
  label: string
  onActivate?: () => void
}) {
  const displayName = item.text || item.name

  return (
    <HoverCard>
      <HoverCardTrigger
        closeDelay={100}
        delay={150}
        render={(
          <button
            aria-label={`${label}: ${item.name}`}
            className="
              nodrag nopan flex w-full items-center gap-2.5 rounded-lg px-2
              py-1.5 text-left transition-colors outline-none
              hover:bg-muted/55
              focus-visible:ring-2 focus-visible:ring-ring
            "
            type="button"
            onClick={onActivate}
          />
        )}
      >
        <FlowNodePortThumbnail item={item} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            {displayName}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {label}
          </span>
        </span>
      </HoverCardTrigger>
      <FlowNodePortItemDetails item={item} label={label} />
    </HoverCard>
  )
}
