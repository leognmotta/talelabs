/** Kysely persistence and bounded batch lookup for Project Briefs. */

import type {
  Database,
  JsonValue,
  ProjectBriefTable,
  Transaction,
} from '@talelabs/db'
import type { Selectable } from 'kysely'
import type {
  ProjectMention,
  ProjectMentionType,
} from '../domain/projects/project-brief-document.js'

import { db, sql } from '@talelabs/db'

/** One persisted Project Brief row. */
export type ProjectBriefRecord = Selectable<ProjectBriefTable>

/** Current entity metadata resolved for one Brief reference. */
export interface ProjectMentionRecord {
  height?: number | null
  entityId: string
  entityType: ProjectMentionType
  label: string
  mimeType?: string
  storageKey?: string
  thumbnailKey?: null | string
  type?: 'audio' | 'document' | 'image' | 'video'
  visibility?: 'private' | 'public'
  width?: number | null
}

type BriefExecutor = typeof db | Transaction<Database>

/** Loads one Project Brief, optionally locking it for compare-and-set save. */
export function findProjectBriefRow(
  executor: BriefExecutor,
  organizationId: string,
  projectId: string,
  forUpdate = false,
) {
  let query = executor.selectFrom('projectBriefs')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('projectId', '=', projectId)
  if (forUpdate)
    query = query.forUpdate()
  return query.executeTakeFirst()
}

/** Inserts the first revision of a lazily created Project Brief. */
export function insertProjectBriefRow(
  executor: Transaction<Database>,
  input: {
    document: JsonValue
    organizationId: string
    plainText: string
    projectId: string
    updatedBy: string
  },
) {
  return executor.insertInto('projectBriefs')
    .values({ ...input, revision: 1 })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/** Atomically saves a Brief only when its expected revision still matches. */
export function updateProjectBriefRow(
  executor: Transaction<Database>,
  input: {
    document: JsonValue
    expectedRevision: number
    organizationId: string
    plainText: string
    projectId: string
    updatedBy: string
  },
) {
  return executor.updateTable('projectBriefs')
    .set({
      document: input.document,
      plainText: input.plainText,
      revision: sql`"revision" + 1`,
      updatedAt: new Date(),
      updatedBy: input.updatedBy,
    })
    .where('organizationId', '=', input.organizationId)
    .where('projectId', '=', input.projectId)
    .where('revision', '=', String(input.expectedRevision))
    .returningAll()
    .executeTakeFirst()
}

function idsByType(
  mentions: readonly ProjectMention[],
  entityType: ProjectMentionType,
) {
  return [...new Set(mentions
    .filter(mention => mention.entityType === entityType)
    .map(mention => mention.entityId))]
}

/** Resolves all structured mentions through five bounded set queries. */
export async function resolveProjectMentionRows(input: {
  executor?: BriefExecutor
  mentions: readonly ProjectMention[]
  organizationId: string
  projectId: string
  userId: string
}) {
  const executor = input.executor ?? db
  const assetIds = idsByType(input.mentions, 'asset')
  const elementIds = idsByType(input.mentions, 'element')
  const flowIds = idsByType(input.mentions, 'flow')
  const folderIds = idsByType(input.mentions, 'folder')
  const sessionIds = idsByType(input.mentions, 'session')
  const [assets, elements, flows, folders, sessions] = await Promise.all([
    assetIds.length
      ? executor.selectFrom('assets')
          .select([
            'height',
            'id',
            'mimeType',
            'name',
            'storageKey',
            'thumbnailKey',
            'type',
            'visibility',
            'width',
          ])
          .where('organizationId', '=', input.organizationId)
          .where('projectId', '=', input.projectId)
          .where('id', 'in', assetIds)
          .where('deletedAt', 'is', null)
          .where('purgeRequestedAt', 'is', null)
          .where('purgedAt', 'is', null)
          .execute()
      : Promise.resolve([]),
    elementIds.length
      ? executor.selectFrom('elements')
          .select(['id', 'name'])
          .where('organizationId', '=', input.organizationId)
          .where('projectId', '=', input.projectId)
          .where('id', 'in', elementIds)
          .execute()
      : Promise.resolve([]),
    flowIds.length
      ? executor.selectFrom('flows')
          .select(['id', 'name'])
          .where('organizationId', '=', input.organizationId)
          .where('projectId', '=', input.projectId)
          .where('id', 'in', flowIds)
          .execute()
      : Promise.resolve([]),
    folderIds.length
      ? executor.selectFrom('folders')
          .select(['id', 'name'])
          .where('organizationId', '=', input.organizationId)
          .where('projectId', '=', input.projectId)
          .where('id', 'in', folderIds)
          .execute()
      : Promise.resolve([]),
    sessionIds.length
      ? executor.selectFrom('createSessions')
          .select(['id', 'name'])
          .where('organizationId', '=', input.organizationId)
          .where('projectId', '=', input.projectId)
          .where('createdBy', '=', input.userId)
          .where('id', 'in', sessionIds)
          .where('deletedAt', 'is', null)
          .execute()
      : Promise.resolve([]),
  ])

  const records: ProjectMentionRecord[] = [
    ...assets.map(asset => ({
      entityId: asset.id,
      entityType: 'asset' as const,
      height: asset.height,
      label: asset.name,
      mimeType: asset.mimeType,
      storageKey: asset.storageKey,
      thumbnailKey: asset.thumbnailKey,
      type: asset.type,
      visibility: asset.visibility,
      width: asset.width,
    })),
    ...elements.map(element => ({
      entityId: element.id,
      entityType: 'element' as const,
      label: element.name,
    })),
    ...flows.map(flow => ({
      entityId: flow.id,
      entityType: 'flow' as const,
      label: flow.name,
    })),
    ...folders.map(folder => ({
      entityId: folder.id,
      entityType: 'folder' as const,
      label: folder.name,
    })),
    ...sessions.map(session => ({
      entityId: session.id,
      entityType: 'session' as const,
      label: session.name ?? '',
    })),
  ]
  return records
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}

/** Searches all mention domains with one bounded query per entity family. */
export async function searchProjectMentionRows(input: {
  limit: number
  organizationId: string
  projectId: string
  search: string
  userId: string
}) {
  const pattern = `%${escapeLike(input.search)}%`
  const [assets, elements, flows, folders, sessions] = await Promise.all([
    db.selectFrom('assets')
      .select([
        'height',
        'id',
        'mimeType',
        'name',
        'storageKey',
        'thumbnailKey',
        'type',
        'visibility',
        'width',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('projectId', '=', input.projectId)
      .where(sql<boolean>`"name" ilike ${pattern} escape '\\'`)
      .where('deletedAt', 'is', null)
      .where('purgeRequestedAt', 'is', null)
      .where('purgedAt', 'is', null)
      .orderBy('updatedAt', 'desc')
      .limit(input.limit)
      .execute(),
    db.selectFrom('elements')
      .select(['id', 'name'])
      .where('organizationId', '=', input.organizationId)
      .where('projectId', '=', input.projectId)
      .where(sql<boolean>`"name" ilike ${pattern} escape '\\'`)
      .orderBy('updatedAt', 'desc')
      .limit(input.limit)
      .execute(),
    db.selectFrom('flows')
      .select(['id', 'name'])
      .where('organizationId', '=', input.organizationId)
      .where('projectId', '=', input.projectId)
      .where(sql<boolean>`"name" ilike ${pattern} escape '\\'`)
      .orderBy('updatedAt', 'desc')
      .limit(input.limit)
      .execute(),
    db.selectFrom('folders')
      .select(['id', 'name'])
      .where('organizationId', '=', input.organizationId)
      .where('projectId', '=', input.projectId)
      .where(sql<boolean>`"name" ilike ${pattern} escape '\\'`)
      .orderBy('name')
      .limit(input.limit)
      .execute(),
    db.selectFrom('createSessions')
      .select(['id', 'name'])
      .where('organizationId', '=', input.organizationId)
      .where('projectId', '=', input.projectId)
      .where('createdBy', '=', input.userId)
      .where('deletedAt', 'is', null)
      .where(sql<boolean>`coalesce("name", '') ilike ${pattern} escape '\\'`)
      .orderBy('updatedAt', 'desc')
      .limit(input.limit)
      .execute(),
  ])
  return [
    ...assets.map(asset => ({
      entityId: asset.id,
      entityType: 'asset' as const,
      height: asset.height,
      label: asset.name,
      mimeType: asset.mimeType,
      storageKey: asset.storageKey,
      thumbnailKey: asset.thumbnailKey,
      type: asset.type,
      visibility: asset.visibility,
      width: asset.width,
    })),
    ...elements.map(row => ({
      entityId: row.id,
      entityType: 'element' as const,
      label: row.name,
    })),
    ...flows.map(row => ({
      entityId: row.id,
      entityType: 'flow' as const,
      label: row.name,
    })),
    ...folders.map(row => ({
      entityId: row.id,
      entityType: 'folder' as const,
      label: row.name,
    })),
    ...sessions.map(row => ({
      entityId: row.id,
      entityType: 'session' as const,
      label: row.name ?? '',
    })),
  ] satisfies ProjectMentionRecord[]
}
