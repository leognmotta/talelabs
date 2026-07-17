/** Compact thumbnail dispatch for text, Asset, and generated port values. */

import type { PortPreviewItem } from './flow-node-port-preview'

import { FlowNodePortIcon } from './flow-node-port-icon'

/** Displays an Asset thumbnail or media-type fallback within a port item. */
export function FlowNodePortThumbnail({ item }: { item: PortPreviewItem }) {
  const source = item.asset?.thumbnailUrl
    ?? (item.asset?.type === 'image' ? item.asset.url : null)
    ?? (
      item.mediaType === 'image' || item.mimeType?.startsWith('image/')
        ? item.previewUrl
        : null
    )

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
