/** Asset readiness rule for media surfaces that require a canonical URL. */

import type { Asset } from '@talelabs/sdk'

/** Reports whether processing has completed and a preview URL is available. */
export function canPreviewAsset(asset: Asset) {
  return asset.processingState === 'ready' && Boolean(asset.url)
}
