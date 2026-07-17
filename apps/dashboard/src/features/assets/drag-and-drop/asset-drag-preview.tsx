/** Asset library drag-and-drop behavior and payload contracts. */

import type { Asset } from '@talelabs/sdk'

import { Badge } from '@talelabs/ui/components/badge'
import { createPortal } from 'react-dom'
import { AssetMediaPreview } from '../media/asset-media-preview'

/** Displays the dragged Asset/folder identity and multi-selection count. */
export function AssetDragPreview({
  asset,
  count,
  container,
}: {
  asset: Asset
  container: HTMLElement | null
  count: number
}) {
  if (!container)
    return null

  return createPortal(
    <div className="
      flex max-w-64 items-center gap-3 rounded-xl border bg-popover p-2 pr-3
      text-popover-foreground shadow-lg
    "
    >
      <span className="
        flex size-10 shrink-0 items-center justify-center overflow-hidden
        rounded-lg bg-muted
      "
      >
        <AssetMediaPreview asset={asset} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{asset.name}</span>
      {count > 1 && <Badge variant="secondary">{count}</Badge>}
    </div>,
    container,
  )
}
