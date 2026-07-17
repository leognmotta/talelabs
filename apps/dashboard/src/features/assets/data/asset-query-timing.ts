/** Idle Asset refresh interval, in milliseconds, used for media URL renewal. */
export const ASSET_MEDIA_REFRESH_INTERVAL_MS = 45 * 60 * 1_000
/** Active processing poll interval, in milliseconds, used until media settles. */
export const ASSET_PROCESSING_REFRESH_INTERVAL_MS = 3_000

/** Reports whether an Asset still needs processing-state polling. */
export function assetNeedsProcessingRefresh(asset: {
  lifecycle: string
  processingState: string
}) {
  return asset.processingState === 'processing' || asset.lifecycle === 'purging'
}
