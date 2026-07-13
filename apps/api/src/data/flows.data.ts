import type {
  AssetTable,
  Database,
  ElementTable,
  FlowEdgeTable,
  FlowNodeTable,
  FlowTable,
  JsonValue,
} from '@talelabs/db'
import type { Selectable, Transaction } from 'kysely'
import type { PageCursor } from '../pagination/cursor.js'

import { db, sql } from '@talelabs/db'
import { lockFlowReferenceBudget } from './flow-reference-budget.data.js'

export type FlowRecord = Selectable<FlowTable>
export type FlowNodeRecord = Selectable<FlowNodeTable>
export type FlowEdgeRecord = Selectable<FlowEdgeTable>
export type FlowReferenceAssetRecord = Selectable<AssetTable> & {
  generationModel: null | string
}
export type FlowReferenceElementRecord = Selectable<ElementTable>

export interface FlowNodeWrite {
  assetId: null | string
  data: JsonValue
  elementId: null | string
  id: string
  positionX: number
  positionY: number
  schemaVersion: number
  type: string
}

export interface FlowEdgeWrite {
  createdAt: Date | string
  id: string
  sourceHandle: null | string
  sourceNodeId: string
  targetHandle: null | string
  targetNodeId: string
}

export type FlowGraphTransaction = Transaction<Database>

class FlowGraphOwnershipConflictError extends Error {}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

export function listFlowRows(input: {
  cursor: PageCursor<'updatedAt'> | null
  limit: number
  organizationId: string
  search?: string
}) {
  let query = db.selectFrom('flows')
    .selectAll()
    .where('organizationId', '=', input.organizationId)

  if (input.search) {
    query = query.where(
      sql<boolean>`"name" ilike ${`%${escapeLike(input.search)}%`} escape '\\'`,
    )
  }

  if (input.cursor) {
    const updatedAt = new Date(String(input.cursor.sortValue))
    query = query.where(eb => eb.or([
      eb('updatedAt', '<', updatedAt),
      eb.and([
        eb('updatedAt', '=', updatedAt),
        eb('id', '<', input.cursor!.id),
      ]),
    ]))
  }

  return query
    .orderBy('updatedAt', 'desc')
    .orderBy('id', 'desc')
    .limit(input.limit + 1)
    .execute()
}

export function findFlowById(organizationId: string, id: string) {
  return db.selectFrom('flows')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

export function insertFlowRow(input: {
  createdBy: string
  id: string
  name: string
  organizationId: string
}) {
  return db.insertInto('flows')
    .values({
      ...input,
      viewport: { x: 0, y: 0, zoom: 1 },
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export function updateFlowRow(input: {
  id: string
  name?: string
  organizationId: string
  viewport?: { x: number, y: number, zoom: number }
}) {
  return db.updateTable('flows')
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.viewport !== undefined ? { viewport: input.viewport } : {}),
      updatedAt: new Date(),
    })
    .where('organizationId', '=', input.organizationId)
    .where('id', '=', input.id)
    .returningAll()
    .executeTakeFirst()
}

export function deleteFlowRow(organizationId: string, id: string) {
  return db.deleteFrom('flows')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst()
}

export async function getFlowGraphRows(
  executor: typeof db | FlowGraphTransaction,
  organizationId: string,
  flowId: string,
) {
  const flow = await executor.selectFrom('flows')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', flowId)
    .executeTakeFirst()
  if (!flow)
    return undefined

  const [nodes, edges, activeRuns] = await Promise.all([
    executor.selectFrom('flowNodes')
      .selectAll()
      .where('organizationId', '=', organizationId)
      .where('flowId', '=', flowId)
      .orderBy('createdAt')
      .orderBy('id')
      .execute(),
    executor.selectFrom('flowEdges')
      .selectAll()
      .where('flowId', '=', flowId)
      .orderBy('createdAt')
      .orderBy('id')
      .execute(),
    executor.selectFrom('flowRunNodes as node')
      .innerJoin('flowRuns as run', join => join
        .onRef('run.id', '=', 'node.flowRunId')
        .onRef('run.organizationId', '=', 'node.organizationId'))
      .leftJoin('generationJobs as job', join => join
        .onRef('job.id', '=', 'node.jobId')
        .onRef('job.organizationId', '=', 'node.organizationId'))
      .select([
        'run.id as runId',
        'node.nodeId',
        'node.status as nodeStatus',
        'job.status as jobStatus',
      ])
      .where('run.organizationId', '=', organizationId)
      .where('run.flowId', '=', flowId)
      .where('run.status', 'in', ['pending', 'running'])
      .execute(),
  ])

  return { activeRuns, edges, flow, nodes }
}

export async function listFlowGraphReferenceRows(
  executor: FlowGraphTransaction,
  input: {
    assetIds: string[]
    elementIds: string[]
    organizationId: string
  },
) {
  const assets = input.assetIds.length
    ? await executor.selectFrom('assets')
        .select(['id', 'type'])
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', input.assetIds)
        .execute()
    : []
  const elements = input.elementIds.length
    ? await executor.selectFrom('elements')
        .select(['id', 'type', 'data', 'schemaVersion'])
        .where('organizationId', '=', input.organizationId)
        .where('id', 'in', input.elementIds)
        .execute()
    : []
  const elementAssets = input.elementIds.length
    ? await executor.selectFrom('elementAssets as link')
        .innerJoin('assets as asset', join => join
          .onRef('asset.id', '=', 'link.assetId')
          .onRef('asset.organizationId', '=', 'link.organizationId'))
        .select([
          'link.elementId',
          'link.role',
          'link.assetId',
          'link.sortOrder',
          'link.isPrimary',
          'asset.type',
        ])
        .where('link.organizationId', '=', input.organizationId)
        .where('link.elementId', 'in', input.elementIds)
        .where('asset.processingState', '=', 'ready')
        .where('asset.purgeRequestedAt', 'is', null)
        .where('asset.purgedAt', 'is', null)
        .orderBy('link.elementId')
        .orderBy('link.role')
        .orderBy(sql`case when "link"."isPrimary" then 0 else 1 end`)
        .orderBy('link.sortOrder')
        .orderBy('link.assetId')
        .execute()
    : []

  return { assets, elementAssets, elements }
}

export async function listFlowGraphHydrationRows(input: {
  assetLimit: number
  assetIds: string[]
  elementAssetLimit: number
  elementIds: string[]
  organizationId: string
}) {
  const [elements, elementAssets] = await Promise.all([
    input.elementIds.length
      ? db.selectFrom('elements')
          .selectAll()
          .where('organizationId', '=', input.organizationId)
          .where('id', 'in', input.elementIds)
          .orderBy('id')
          .execute()
      : Promise.resolve([] as FlowReferenceElementRecord[]),
    input.elementIds.length
      ? db.selectFrom('elementAssets')
          .select([
            'elementId',
            'assetId',
            'role',
            'sortOrder',
            'isPrimary',
          ])
          .where('organizationId', '=', input.organizationId)
          .where('elementId', 'in', input.elementIds)
          .orderBy('elementId')
          .orderBy('role')
          .orderBy(sql`case when "isPrimary" then 0 else 1 end`)
          .orderBy('sortOrder')
          .orderBy('assetId')
          .limit(input.elementAssetLimit + 1)
          .execute()
      : Promise.resolve([]),
  ])
  if (elementAssets.length > input.elementAssetLimit) {
    return {
      assets: [],
      elementAssets: [],
      elements,
      limitExceeded: 'elementAssets' as const,
    }
  }
  const allAssetIds = [...new Set([
    ...input.assetIds,
    ...elementAssets.map(link => link.assetId),
  ])]
  if (allAssetIds.length > input.assetLimit) {
    return {
      assets: [],
      elementAssets: [],
      elements,
      limitExceeded: 'assets' as const,
    }
  }
  const assets: FlowReferenceAssetRecord[] = allAssetIds.length
    ? await db.selectFrom('assets as asset')
        .leftJoin('generationJobs as job', join => join
          .onRef('job.id', '=', 'asset.generationJobId')
          .onRef('job.organizationId', '=', 'asset.organizationId'))
        .selectAll('asset')
        .select('job.model as generationModel')
        .where('asset.organizationId', '=', input.organizationId)
        .where('asset.id', 'in', allAssetIds)
        .orderBy('asset.id')
        .execute()
    : []

  return { assets, elementAssets, elements, limitExceeded: null }
}

export async function syncFlowGraphRows(input: {
  baseRevision: number
  deleteEdgeIds: string[]
  deleteNodeIds: string[]
  flowId: string
  lockReferenceBudget: boolean
  organizationId: string
  prepare: (input: {
    edges: FlowEdgeRecord[]
    executor: FlowGraphTransaction
    nodes: FlowNodeRecord[]
  }) => Promise<{ edges: FlowEdgeWrite[], nodes: FlowNodeWrite[] }>
  upsertEdges: FlowEdgeWrite[]
  upsertNodes: FlowNodeWrite[]
}) {
  try {
    return await db.transaction().execute(async (trx) => {
      if (input.lockReferenceBudget)
        await lockFlowReferenceBudget(trx, input.organizationId)
      const flow = await trx.selectFrom('flows')
        .select(['id', 'revision'])
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.flowId)
        .executeTakeFirst()
      if (!flow)
        return { status: 'not_found' as const }
      if (Number(flow.revision) !== input.baseRevision)
        return { status: 'revision_conflict' as const }

      const [nodes, edges] = await Promise.all([
        trx.selectFrom('flowNodes')
          .selectAll()
          .where('organizationId', '=', input.organizationId)
          .where('flowId', '=', input.flowId)
          .execute(),
        trx.selectFrom('flowEdges')
          .selectAll()
          .where('flowId', '=', input.flowId)
          .execute(),
      ])
      const prepared = await input.prepare({ edges, executor: trx, nodes })

      const updated = await trx.updateTable('flows')
        .set({
          revision: sql`"revision" + 1`,
          updatedAt: new Date(),
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', input.flowId)
        .where('revision', '=', String(input.baseRevision))
        .returning('revision')
        .executeTakeFirst()
      if (!updated)
        return { status: 'revision_conflict' as const }

      if (input.deleteEdgeIds.length) {
        await trx.deleteFrom('flowEdges')
          .where('flowId', '=', input.flowId)
          .where('id', 'in', input.deleteEdgeIds)
          .execute()
      }
      if (input.deleteNodeIds.length) {
        await trx.deleteFrom('flowNodes')
          .where('organizationId', '=', input.organizationId)
          .where('flowId', '=', input.flowId)
          .where('id', 'in', input.deleteNodeIds)
          .execute()
      }
      const preparedNodesById = new Map(
        prepared.nodes.map(node => [node.id, node]),
      )
      const canonicalUpsertNodes = input.upsertNodes.map(node => (
        preparedNodesById.get(node.id) ?? node
      ))
      const writeTimestamp = new Date()
      if (canonicalUpsertNodes.length) {
        const writtenNodes = await trx.insertInto('flowNodes')
          .values(canonicalUpsertNodes.map(node => ({
            ...node,
            flowId: input.flowId,
            organizationId: input.organizationId,
            updatedAt: writeTimestamp,
          })))
          .onConflict(conflict => conflict.column('id')
            .doUpdateSet(eb => ({
              assetId: eb.ref('excluded.assetId'),
              data: eb.ref('excluded.data'),
              elementId: eb.ref('excluded.elementId'),
              positionX: eb.ref('excluded.positionX'),
              positionY: eb.ref('excluded.positionY'),
              schemaVersion: eb.ref('excluded.schemaVersion'),
              type: eb.ref('excluded.type'),
              updatedAt: writeTimestamp,
            }))
            .where('flowNodes.flowId', '=', input.flowId)
            .where('flowNodes.organizationId', '=', input.organizationId))
          .returning('id')
          .execute()
        if (writtenNodes.length !== canonicalUpsertNodes.length)
          throw new FlowGraphOwnershipConflictError()
      }

      if (input.upsertEdges.length) {
        const writtenEdges = await trx.insertInto('flowEdges')
          .values(input.upsertEdges.map(edge => ({
            ...edge,
            flowId: input.flowId,
          })))
          .onConflict(conflict => conflict.column('id')
            .doUpdateSet(eb => ({
              sourceHandle: eb.ref('excluded.sourceHandle'),
              sourceNodeId: eb.ref('excluded.sourceNodeId'),
              targetHandle: eb.ref('excluded.targetHandle'),
              targetNodeId: eb.ref('excluded.targetNodeId'),
            }))
            .where('flowEdges.flowId', '=', input.flowId))
          .returning('id')
          .execute()
        if (writtenEdges.length !== input.upsertEdges.length)
          throw new FlowGraphOwnershipConflictError()
      }

      return {
        canonical: prepared,
        revision: Number(updated.revision),
        status: 'updated' as const,
      }
    })
  }
  catch (error) {
    if (error instanceof FlowGraphOwnershipConflictError)
      return { status: 'id_conflict' as const }
    throw error
  }
}
