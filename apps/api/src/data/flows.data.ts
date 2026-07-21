/** Tenant-scoped Flow persistence, graph loading, and reference queries. */

import type {
  AssetTable,
  Database,
  FlowEdgeTable,
  FlowNodeTable,
  FlowTable,
  JsonValue,
} from '@talelabs/db'
import type { Selectable, Transaction } from 'kysely'
import type { PageCursor } from '../pagination/cursor.js'

import { availableFolderName, db, sql } from '@talelabs/db'
import { lockFolderStructure } from './folders.data.js'

/** Persisted Flow row returned by tenant-scoped data queries. */
export type FlowRecord = Selectable<FlowTable>
/** Persisted Flow node row used while validating and synchronizing a graph. */
export type FlowNodeRecord = Selectable<FlowNodeTable>
/** Persisted Flow edge row used while validating and synchronizing a graph. */
export type FlowEdgeRecord = Selectable<FlowEdgeTable>
/** Referenced Asset row enriched with the model that generated it, when known. */
export type FlowReferenceAssetRecord = Selectable<AssetTable> & {
  /** Canonical creative model recorded by the Asset's generation job. */
  generationModel: null | string
}
/** Canonical node fields accepted by the graph synchronization transaction. */
export interface FlowNodeWrite {
  /** Direct Asset reference selected by the node, or null when absent. */
  assetId: null | string
  /** Validated node payload stored as JSON. */
  data: JsonValue
  /** Stable node identifier within the Flow. */
  id: string
  /** Horizontal canvas position in Flow coordinate space. */
  positionX: number
  /** Vertical canvas position in Flow coordinate space. */
  positionY: number
  /** Version of the node payload contract. */
  schemaVersion: number
  /** Registered Flow node type. */
  type: string
}

/** Canonical edge fields accepted by the graph synchronization transaction. */
export interface FlowEdgeWrite {
  /** Creation timestamp preserved when inserting the edge. */
  createdAt: Date | string
  /** Stable edge identifier within the Flow. */
  id: string
  /** Optional typed handle on the source node. */
  sourceHandle: null | string
  /** Identifier of the edge's source node. */
  sourceNodeId: string
  /** Optional typed handle on the target node. */
  targetHandle: null | string
  /** Identifier of the edge's target node. */
  targetNodeId: string
}

/** Database transaction capable of reading and writing a complete Flow graph. */
export type FlowGraphTransaction = Transaction<Database>

class FlowGraphOwnershipConflictError extends Error {}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

/** Lists one cursor-paginated page of Flows owned by an organization. */
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

/** Finds one Flow by tenant and identifier without loading its graph. */
export function findFlowById(organizationId: string, id: string) {
  return db.selectFrom('flows')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()
}

/** Creates a Flow with the default canvas viewport. */
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

/** Updates Flow metadata and keeps its generated-Asset folder name aligned. */
export function updateFlowRow(input: {
  id: string
  name?: string
  organizationId: string
  viewport?: { x: number, y: number, zoom: number }
}) {
  return db.transaction().execute(async (trx) => {
    if (input.name !== undefined)
      await lockFolderStructure(trx, input.organizationId)

    const current = await trx.selectFrom('flows')
      .select(['assetFolderId', 'id'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .forUpdate()
      .executeTakeFirst()
    if (!current)
      return undefined

    if (input.name !== undefined && current.assetFolderId) {
      const folder = await trx.selectFrom('folders')
        .select(['id', 'parentId'])
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', current.assetFolderId)
        .forUpdate()
        .executeTakeFirst()
      if (folder) {
        let siblingQuery = trx.selectFrom('folders')
          .select('name')
          .where('organizationId', '=', input.organizationId)
          .where('id', '!=', folder.id)
        siblingQuery = folder.parentId
          ? siblingQuery.where('parentId', '=', folder.parentId)
          : siblingQuery.where('parentId', 'is', null)
        const siblings = await siblingQuery.execute()
        await trx.updateTable('folders')
          .set({
            name: availableFolderName(
              input.name,
              siblings.map(sibling => sibling.name),
            ),
            updatedAt: new Date(),
          })
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', current.assetFolderId)
          .execute()
      }
    }

    return trx.updateTable('flows')
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.viewport !== undefined ? { viewport: input.viewport } : {}),
        updatedAt: new Date(),
      })
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.id)
      .returningAll()
      .executeTakeFirst()
  })
}

/** Deletes one tenant-owned Flow and returns its identifier when it existed. */
export function deleteFlowRow(organizationId: string, id: string) {
  return db.deleteFrom('flows')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returning('id')
    .executeTakeFirst()
}

async function getFlowDraftGraphRows(
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

  const [nodes, edges] = await Promise.all([
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
  ])

  return { edges, flow, nodes }
}

/** Loads only the saved graph facts required by deterministic run planning. */
export function getFlowRunPlanningRows(
  executor: typeof db | FlowGraphTransaction,
  organizationId: string,
  flowId: string,
) {
  return getFlowDraftGraphRows(executor, organizationId, flowId)
}

/** Loads the saved graph plus active-run presentation required by the canvas. */
export async function getFlowGraphRows(
  executor: typeof db | FlowGraphTransaction,
  organizationId: string,
  flowId: string,
) {
  const graph = await getFlowDraftGraphRows(executor, organizationId, flowId)
  if (!graph)
    return undefined

  const activeRuns = await executor.selectFrom('flowRunNodes as node')
    .innerJoin('flowRuns as run', join => join
      .onRef('run.id', '=', 'node.flowRunId')
      .onRef('run.organizationId', '=', 'node.organizationId'))
    .select(eb => [
      'run.id as runId',
      'node.nodeId',
      'node.status as nodeStatus',
      eb.selectFrom('generationJobs as job')
        .select('job.status')
        .whereRef('job.flowRunId', '=', 'node.flowRunId')
        .whereRef('job.nodeId', '=', 'node.nodeId')
        .whereRef('job.organizationId', '=', 'node.organizationId')
        .orderBy('job.createdAt', 'desc')
        .orderBy('job.id', 'desc')
        .limit(1)
        .as('jobStatus'),
    ])
    .where('run.organizationId', '=', organizationId)
    .where('run.flowId', '=', flowId)
    .where('run.status', 'in', ['pending', 'running'])
    .execute()

  return { ...graph, activeRuns }
}

/** Loads the referenced Asset identities needed inside a graph transaction. */
export async function listFlowGraphReferenceRows(
  executor: FlowGraphTransaction,
  input: {
    assetIds: string[]
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
  return { assets }
}

/** Hydrates bounded reference Assets and their immutable generation models. */
export async function listFlowGraphHydrationRows(input: {
  assetLimit: number
  assetIds: string[]
  organizationId: string
}) {
  const allAssetIds = [...new Set(input.assetIds)]
  if (allAssetIds.length > input.assetLimit) {
    return {
      assets: [],
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

  return { assets, limitExceeded: null }
}

/**
 * Atomically validates and synchronizes a Flow graph at an expected revision.
 *
 * The callback receives the locked persisted graph and must return canonical
 * node and edge writes before the revision is advanced.
 */
export async function syncFlowGraphRows(input: {
  baseRevision: number
  deleteEdgeIds: string[]
  deleteNodeIds: string[]
  flowId: string
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
