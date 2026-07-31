/** Scheduled deployment entrypoint for expired direct-upload cleanup. */

import { schedules } from '@trigger.dev/sdk'

import { cleanupExpiredAssetUploads } from '../../assets/uploads/cleanup.js'

const ASSET_UPLOAD_CLEANUP_MAX_DURATION_SECONDS = 5 * 60

/** Releases expired upload holds and removes abandoned private objects. */
export const assetUploadCleanupTask = schedules.task({
  id: 'asset-upload-cleanup',
  cron: '* * * * *',
  maxDuration: ASSET_UPLOAD_CLEANUP_MAX_DURATION_SECONDS,
  queue: { concurrencyLimit: 1 },
  ttl: '1m',
  run: cleanupExpiredAssetUploads,
})
