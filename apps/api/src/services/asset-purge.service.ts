import { idempotencyKeys, triggerTask } from '@talelabs/trigger'

import { requestAssetPurge } from '../data/assets.data.js'
import { HttpError, TenantResourceNotFoundError } from '../middleware/error.js'
import { presentAssetForUser } from './assets-presentation.service.js'

async function dispatchPurge(organizationId: string, assetId: string) {
  try {
    const idempotencyKey = await idempotencyKeys.create(assetId, {
      scope: 'global',
    })
    await triggerTask('asset-purge', { assetId, organizationId }, {
      idempotencyKey,
    })
  }
  catch (error) {
    console.error('Asset purge dispatch failed; reconciliation will retry.', {
      assetId,
      error,
      organizationId,
    })
  }
}

export async function purgeAsset(
  organizationId: string,
  userId: string,
  id: string,
) {
  const result = await requestAssetPurge(organizationId, id)
  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError()
  if (result.status === 'active_generation') {
    throw new HttpError(
      409,
      'invalid_state',
      'This asset is in use by an active generation.',
    )
  }
  if (result.status === 'requested')
    void dispatchPurge(organizationId, id)
  return {
    asset: await presentAssetForUser({
      asset: result.asset,
      organizationId,
      userId,
    }),
    alreadyRequested: result.status === 'already_requested',
  }
}
