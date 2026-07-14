import type { PortPreviewItem } from './flow-node-port-preview'

import { FlowNodePortIcon } from './flow-node-port-icon'

export function FlowNodePortThumbnail({ item }: { item: PortPreviewItem }) {
  const source = item.asset?.thumbnailUrl
    ?? (item.asset?.type === 'image' ? item.asset.url : null)

  return (
    <span className="
      flex size-10 shrink-0 items-center justify-center overflow-hidden
      rounded-lg border border-border/70 bg-muted/45 text-muted-foreground
    "
    >
      {source
        ? (
            <img
              alt=""
              aria-hidden
              className="size-full object-cover"
              src={source}
            />
          )
        : <FlowNodePortIcon item={item} />}
    </span>
  )
}
