import { schemaTask } from '@trigger.dev/sdk'

import { purgeAsset } from '../../assets/processing/purge.js'
import { assetTaskPayloadSchema } from './contracts.js'

export const assetPurgeTask = schemaTask({
  id: 'asset-purge',
  schema: assetTaskPayloadSchema,
  retry: {
    maxAttempts: 8,
    factor: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 60_000,
  },
  run: purgeAsset,
})
