/** Project CRUD, list pagination, cover presentation, and target validation. */

import type {
  ProjectArchiveFilter,
  ProjectSummaryRow,
} from '../data/projects.data.js'

import { createId } from '@paralleldrive/cuid2'
import {
  findProjectSummaryRow,
  insertProjectRow,
  listProjectCoverAssetRows,
  listProjectRows,
  setProjectArchivedRow,
  updateProjectRow,
} from '../data/projects.data.js'
import {
  HttpError,
  TenantResourceNotFoundError,
} from '../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../pagination/pagination.js'
import { createAssetThumbnailUrl } from './asset-presenter.js'

async function coverAssetsById(
  organizationId: string,
  projects: readonly ProjectSummaryRow[],
) {
  const rows = await listProjectCoverAssetRows(
    organizationId,
    projects.flatMap(project => (
      project.coverAssetId ? [project.coverAssetId] : []
    )),
  )
  return new Map(await Promise.all(rows.map(async asset => [
    asset.id,
    {
      id: asset.id,
      mimeType: asset.mimeType,
      thumbnailUrl: await createAssetThumbnailUrl(asset),
      type: asset.type,
    },
  ] as const)))
}

async function presentProjects(
  organizationId: string,
  projects: readonly ProjectSummaryRow[],
) {
  const covers = await coverAssetsById(organizationId, projects)
  return projects.map(project => ({
    archivedAt: project.archivedAt?.toISOString() ?? null,
    counts: {
      assets: project.assetCount,
      createSessions: project.createSessionCount,
      elements: project.elementCount,
      flows: project.flowCount,
      folders: project.folderCount,
    },
    coverAsset: project.coverAssetId
      ? covers.get(project.coverAssetId) ?? null
      : null,
    coverAssetId: project.coverAssetId,
    createdAt: project.createdAt.toISOString(),
    defaultAssetFolderId: project.defaultAssetFolderId,
    description: project.description,
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt.toISOString(),
  }))
}

async function presentProjectById(input: {
  id: string
  organizationId: string
  userId: string
}) {
  const project = await findProjectSummaryRow(input)
  if (!project)
    throw new TenantResourceNotFoundError()
  return (await presentProjects(input.organizationId, [project]))[0]!
}

/** Lists active, archived, or all Projects with stable updated-at cursors. */
export async function listProjects(input: {
  archive: ProjectArchiveFilter
  cursor?: string
  limit: number
  organizationId: string
  search?: string
  userId: string
}) {
  const pagination = resolvePagination(
    { cursor: input.cursor, limit: input.limit },
    {
      cursorValueParsers: { updatedAt: parseIsoTimestampCursorValue },
      defaultOrder: 'desc',
      defaultSort: 'updatedAt',
    },
  )
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The pagination options are invalid.',
      pagination.details,
    )
  }
  const rows = await listProjectRows({
    archive: input.archive,
    cursor: pagination.value.cursor,
    limit: pagination.value.limit,
    organizationId: input.organizationId,
    search: input.search,
    userId: input.userId,
  })
  const page = buildCursorPage({
    cursorFromRow: row => ({
      id: row.id,
      order: 'desc' as const,
      sort: 'updatedAt' as const,
      sortValue: row.updatedAt.toISOString(),
    }),
    limit: pagination.value.limit,
    rows,
    serialize: row => row,
  })
  return {
    data: await presentProjects(input.organizationId, page.pageRows),
    nextCursor: page.nextCursor,
  }
}

/** Creates one empty Project without manufacturing folders or a Brief. */
export async function createProject(input: {
  createdBy: string
  description: string
  name: string
  organizationId: string
}) {
  const project = await insertProjectRow({
    ...input,
    id: createId(),
  })
  return presentProjectById({
    id: project.id,
    organizationId: input.organizationId,
    userId: input.createdBy,
  })
}

/** Reads one tenant-owned Project with grouped counts and a bounded cover. */
export function getProject(input: {
  id: string
  organizationId: string
  userId: string
}) {
  return presentProjectById(input)
}

/** Updates Project metadata after exact tenant-and-Project target validation. */
export async function updateProject(input: {
  coverAssetId?: null | string
  defaultAssetFolderId?: null | string
  description?: string
  id: string
  name?: string
  organizationId: string
  userId: string
}) {
  const result = await updateProjectRow(input)
  if (result.status === 'not_found')
    throw new TenantResourceNotFoundError(result.field)
  return presentProjectById(input)
}

/** Soft-archives a Project while preserving every assigned entity. */
export async function archiveProject(input: {
  id: string
  organizationId: string
  userId: string
}) {
  if (!await setProjectArchivedRow({ ...input, archived: true }))
    throw new TenantResourceNotFoundError()
  return presentProjectById(input)
}

/** Restores one archived Project to active lists. */
export async function restoreProject(input: {
  id: string
  organizationId: string
  userId: string
}) {
  if (!await setProjectArchivedRow({ ...input, archived: false }))
    throw new TenantResourceNotFoundError()
  return presentProjectById(input)
}
