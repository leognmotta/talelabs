import type { Database } from '@talelabs/db'
import type { Transaction } from 'kysely'

import { db } from '@talelabs/db'

export function listFavoriteAssetIds(input: {
  assetIds: string[]
  organizationId: string
  userId: string
}) {
  if (input.assetIds.length === 0)
    return Promise.resolve([])

  return db.selectFrom('assetFavorites')
    .select('assetId')
    .where('organizationId', '=', input.organizationId)
    .where('userId', '=', input.userId)
    .where('assetId', 'in', input.assetIds)
    .execute()
}

export function listAssetTagRows(input: {
  assetIds: string[]
  organizationId: string
}) {
  if (input.assetIds.length === 0)
    return Promise.resolve([])

  return db.selectFrom('assetTags as assetTag')
    .innerJoin('tags as tag', join => join
      .onRef('tag.id', '=', 'assetTag.tagId')
      .onRef('tag.organizationId', '=', 'assetTag.organizationId'))
    .select([
      'assetTag.assetId',
      'tag.id',
      'tag.name',
      'tag.createdAt',
      'tag.updatedAt',
    ])
    .where('assetTag.organizationId', '=', input.organizationId)
    .where('assetTag.assetId', 'in', input.assetIds)
    .orderBy('tag.normalizedName')
    .orderBy('tag.id')
    .execute()
}

export type AssetMetadataMutationResult
  = | { field?: 'assetId' | 'tagId', status: 'not_found' }
    | { status: 'invalid_state' | 'mutated' }

async function mutateMutableAsset(
  trx: Transaction<Database>,
  input: { assetId: string, organizationId: string },
  mutate: () => Promise<unknown>,
): Promise<AssetMetadataMutationResult> {
  const asset = await trx.selectFrom('assets')
    .select(['id', 'purgedAt', 'purgeRequestedAt'])
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.assetId)
    .forUpdate()
    .executeTakeFirst()

  if (!asset)
    return { field: 'assetId', status: 'not_found' }
  if (asset.purgeRequestedAt || asset.purgedAt)
    return { status: 'invalid_state' }

  await mutate()
  return { status: 'mutated' }
}

export function mutateAssetFavoriteRow(input: {
  assetId: string
  favorite: boolean
  organizationId: string
  userId: string
}): Promise<AssetMetadataMutationResult> {
  return db.transaction().execute(trx => mutateMutableAsset(trx, input, () =>
    input.favorite
      ? trx.insertInto('assetFavorites')
          .values({
            assetId: input.assetId,
            organizationId: input.organizationId,
            userId: input.userId,
          })
          .onConflict(conflict => conflict
            .columns(['organizationId', 'userId', 'assetId'])
            .doNothing())
          .executeTakeFirst()
      : trx.deleteFrom('assetFavorites')
          .where('organizationId', '=', input.organizationId)
          .where('userId', '=', input.userId)
          .where('assetId', '=', input.assetId)
          .executeTakeFirst()))
}

type MutateAssetTagRowInput = {
  assetId: string
  organizationId: string
  tagId: string
} & (
  | { assigned: false }
  | { assigned: true, userId: string }
)

export function mutateAssetTagRow(
  input: MutateAssetTagRowInput,
): Promise<AssetMetadataMutationResult> {
  return db.transaction().execute(async trx => mutateMutableAsset(
    trx,
    input,
    async () => {
      if (input.assigned) {
        const tag = await trx.selectFrom('tags')
          .select('id')
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', input.tagId)
          .forShare()
          .executeTakeFirst()

        if (!tag)
          throw new AssetTagNotFoundError()

        await trx.insertInto('assetTags')
          .values({
            assetId: input.assetId,
            createdBy: input.userId,
            organizationId: input.organizationId,
            tagId: input.tagId,
          })
          .onConflict(conflict => conflict
            .columns(['assetId', 'tagId'])
            .doNothing())
          .executeTakeFirst()
        return
      }

      await trx.deleteFrom('assetTags')
        .where('organizationId', '=', input.organizationId)
        .where('assetId', '=', input.assetId)
        .where('tagId', '=', input.tagId)
        .executeTakeFirst()
    },
  )).catch((error) => {
    if (error instanceof AssetTagNotFoundError)
      return { field: 'tagId', status: 'not_found' }
    throw error
  })
}

class AssetTagNotFoundError extends Error {}
