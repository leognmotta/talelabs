import { idempotencyKeys, schedules } from '@trigger.dev/sdk'

import { findAssetsNeedingReconciliation } from '../../assets/processing/reconciliation.js'
import { assetIngestTask } from './ingest.task.js'
import { assetPurgeTask } from './purge.task.js'

export const reconcileAssetsTask = schedules.task({
  id: 'asset-reconcile',
  cron: '*/5 * * * *',
  run: async () => {
    const { processing, purging } = await findAssetsNeedingReconciliation()

    for (const asset of processing) {
      const key = await idempotencyKeys.create(asset.id, { scope: 'global' })
      await assetIngestTask.trigger({
        assetId: asset.id,
        organizationId: asset.organizationId,
      }, { idempotencyKey: key })
    }

    for (const asset of purging) {
      const key = await idempotencyKeys.create(asset.id, { scope: 'global' })
      await assetPurgeTask.trigger({
        assetId: asset.id,
        organizationId: asset.organizationId,
      }, { idempotencyKey: key })
    }

    return {
      ingestionDispatched: processing.length,
      purgeDispatched: purging.length,
    }
  },
})
