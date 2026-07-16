import { db } from '@talelabs/db'

export async function findAssetsNeedingReconciliation() {
  const olderThan = new Date(Date.now() - 5 * 60 * 1000)
  const [processing, purging] = await Promise.all([
    db.selectFrom('assets')
      .select(['id', 'organizationId'])
      .where('processingState', '=', 'processing')
      .where('purgeRequestedAt', 'is', null)
      .where('createdAt', '<', olderThan)
      .orderBy('createdAt')
      .limit(100)
      .execute(),
    db.selectFrom('assets')
      .select(['id', 'organizationId'])
      .where('purgeRequestedAt', '<', olderThan)
      .where('purgedAt', 'is', null)
      .orderBy('purgeRequestedAt')
      .limit(100)
      .execute(),
  ])

  return { processing, purging }
}
