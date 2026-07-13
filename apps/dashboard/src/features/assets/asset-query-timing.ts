export const ASSET_MEDIA_REFRESH_INTERVAL_MS = 45 * 60 * 1_000
export const ASSET_PROCESSING_REFRESH_INTERVAL_MS = 3_000

export function assetNeedsProcessingRefresh(asset: {
  lifecycle: string
  processingState: string
}) {
  return asset.processingState === 'processing' || asset.lifecycle === 'purging'
}
