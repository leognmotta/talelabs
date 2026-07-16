import type { PortPreviewItem } from './flow-node-port-preview'

import { cn } from '@talelabs/ui/lib/utils'
import { AssetMediaPreview } from '../assets/asset-media-preview'

export function FlowNodePortMediaPreview({ item }: { item: PortPreviewItem }) {
  const previewType = item.mimeType?.startsWith('image/')
    ? 'image'
    : item.mediaType
  const asset = item.asset ?? (
    item.previewUrl && previewType
      ? {
          id: item.assetId ?? item.id,
          name: item.name,
          processingState: 'ready' as const,
          thumbnailUrl: previewType === 'image' ? item.previewUrl : null,
          type: previewType,
          url: item.previewUrl,
        }
      : null
  )
  if (!asset)
    return null

  const mediaType = asset.type
  return (
    <div className={cn(
      `
        flex items-center justify-center overflow-hidden rounded-lg border
        border-border/70 bg-background
      `,
      mediaType === 'audio' ? 'min-h-32' : 'aspect-video',
    )}
    >
      <AssetMediaPreview
        asset={asset}
        className="object-contain"
        mode={mediaType === 'audio' || mediaType === 'video'
          ? 'player'
          : 'thumbnail'}
      />
    </div>
  )
}
