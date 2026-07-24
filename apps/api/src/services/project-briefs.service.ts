/** Project Brief reads, revision-safe saves, and batched mention presentation. */

import type { JsonObject } from '@talelabs/db'
import type { ProjectMentionRecord } from '../data/project-briefs.data.js'
import type { ProjectMention } from '../domain/projects/project-brief-document.js'

import { db } from '@talelabs/db'

import {
  findProjectBriefRow,
  insertProjectBriefRow,
  resolveProjectMentionRows,
  searchProjectMentionRows,
  updateProjectBriefRow,
} from '../data/project-briefs.data.js'
import {
  projectBriefDocumentAsJson,
  validateProjectBriefDocument,
} from '../domain/projects/project-brief-document.js'
import {
  lockActiveProject,
  lockProjectScopes,
  requireProject,
  touchProject,
} from '../domain/projects/project-scope.js'
import { HttpError } from '../middleware/error.js'
import { createAssetThumbnailUrl } from './asset-presenter.js'

const EMPTY_DOCUMENT = { content: [], type: 'doc' } as const

function mentionKey(mention: Pick<ProjectMention, 'entityId' | 'entityType'>) {
  return `${mention.entityType}:${mention.entityId}`
}

async function presentMentionRecord(record: ProjectMentionRecord) {
  const thumbnailUrl = record.entityType === 'asset'
    ? await createAssetThumbnailUrl({
        mimeType: record.mimeType!,
        storageKey: record.storageKey!,
        thumbnailKey: record.thumbnailKey!,
        type: record.type!,
        visibility: record.visibility!,
      })
    : null
  return {
    asset: record.entityType === 'asset'
      ? {
          height: record.height ?? null,
          type: record.type!,
          width: record.width ?? null,
        }
      : null,
    available: true as const,
    entityId: record.entityId,
    entityType: record.entityType,
    label: record.label,
    thumbnailUrl,
  }
}

async function presentMentionResolution(
  mentions: readonly ProjectMention[],
  rows: readonly ProjectMentionRecord[],
) {
  const rowsByKey = new Map(rows.map(row => [mentionKey(row), row]))
  return Promise.all(mentions.map(async (mention) => {
    const row = rowsByKey.get(mentionKey(mention))
    if (row)
      return presentMentionRecord(row)
    return {
      asset: null,
      available: false as const,
      entityId: mention.entityId,
      entityType: mention.entityType,
      label: mention.fallbackLabel,
      thumbnailUrl: null,
    }
  }))
}

function presentBrief(
  brief: Awaited<ReturnType<typeof findProjectBriefRow>>,
  mentions: Awaited<ReturnType<typeof presentMentionResolution>>,
) {
  return {
    document: (brief?.document as JsonObject | undefined) ?? EMPTY_DOCUMENT,
    mentions,
    plainText: brief?.plainText ?? '',
    revision: Number(brief?.revision ?? 0),
    updatedAt: brief?.updatedAt.toISOString() ?? null,
    updatedBy: brief?.updatedBy ?? null,
  }
}

function revisionConflict(): never {
  throw new HttpError(
    409,
    'revision_conflict',
    'The Project Brief changed before this save completed.',
    [{
      code: 'revision_conflict',
      field: 'expectedRevision',
      message: 'Reload the latest Brief before saving again.',
    }],
  )
}

function invalidDocument(error: unknown): never {
  const code = error instanceof Error
    ? error.message
    : 'project_brief_invalid_document'
  throw new HttpError(
    400,
    'validation_error',
    'The Project Brief document is invalid.',
    [{
      code,
      field: 'document',
      message: 'The document contains unsupported or invalid content.',
    }],
  )
}

async function validateMentionRows(input: {
  executor?: Parameters<typeof resolveProjectMentionRows>[0]['executor']
  mentions: readonly ProjectMention[]
  organizationId: string
  projectId: string
  userId: string
}) {
  const rows = await resolveProjectMentionRows(input)
  const available = new Set(rows.map(mentionKey))
  const missing = input.mentions.find(mention => !available.has(mentionKey(mention)))
  if (missing) {
    throw new HttpError(
      400,
      'validation_error',
      'A Project Brief reference is unavailable.',
      [{
        code: 'project_mention_unavailable',
        field: 'document',
        message: 'Remove references that are outside this Project or unavailable.',
      }],
    )
  }
  return rows
}

/** Reads one Brief and resolves every unique mention in bounded batches. */
export async function getProjectBrief(input: {
  organizationId: string
  projectId: string
  userId: string
}) {
  await requireProject(input.organizationId, input.projectId)
  const brief = await findProjectBriefRow(db, input.organizationId, input.projectId)
  if (!brief)
    return presentBrief(undefined, [])
  let validated
  try {
    validated = validateProjectBriefDocument(brief.document)
  }
  catch {
    validated = { mentions: [] }
  }
  const rows = await resolveProjectMentionRows({
    ...input,
    mentions: validated.mentions,
  })
  return presentBrief(
    brief,
    await presentMentionResolution(validated.mentions, rows),
  )
}

/** Saves one Brief through Project-scoped mention validation and revision CAS. */
export async function saveProjectBrief(input: {
  document: unknown
  expectedRevision: number
  organizationId: string
  projectId: string
  userId: string
}) {
  let validated
  try {
    validated = validateProjectBriefDocument(input.document)
  }
  catch (error) {
    invalidDocument(error)
  }

  const saved = await db.transaction().execute(async (trx) => {
    await lockProjectScopes(trx, input.organizationId, [input.projectId])
    await lockActiveProject(
      trx,
      input.organizationId,
      input.projectId,
      'projectId',
    )
    const rows = await validateMentionRows({
      executor: trx,
      mentions: validated.mentions,
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
    })
    const current = await findProjectBriefRow(
      trx,
      input.organizationId,
      input.projectId,
      true,
    )
    if (!current) {
      if (input.expectedRevision !== 0)
        revisionConflict()
      const inserted = await insertProjectBriefRow(trx, {
        document: projectBriefDocumentAsJson(validated.document),
        organizationId: input.organizationId,
        plainText: validated.plainText,
        projectId: input.projectId,
        updatedBy: input.userId,
      })
      await touchProject(trx, input.organizationId, input.projectId)
      return { brief: inserted, rows }
    }
    if (Number(current.revision) !== input.expectedRevision)
      revisionConflict()
    const updated = await updateProjectBriefRow(trx, {
      document: projectBriefDocumentAsJson(validated.document),
      expectedRevision: input.expectedRevision,
      organizationId: input.organizationId,
      plainText: validated.plainText,
      projectId: input.projectId,
      updatedBy: input.userId,
    })
    if (!updated)
      revisionConflict()
    await touchProject(trx, input.organizationId, input.projectId)
    return { brief: updated, rows }
  })
  return presentBrief(
    saved.brief,
    await presentMentionResolution(validated.mentions, saved.rows),
  )
}

/** Resolves a client-provided bounded mention set without N+1 requests. */
export async function resolveProjectBriefMentions(input: {
  mentions: ProjectMention[]
  organizationId: string
  projectId: string
  userId: string
}) {
  await requireProject(input.organizationId, input.projectId)
  const rows = await resolveProjectMentionRows(input)
  return {
    data: await presentMentionResolution(input.mentions, rows),
  }
}

/** Searches every eligible Project entity group behind one API request. */
export async function searchProjectBriefMentions(input: {
  limit: number
  organizationId: string
  projectId: string
  search: string
  userId: string
}) {
  await requireProject(input.organizationId, input.projectId)
  const rows = await searchProjectMentionRows(input)
  const presented = await Promise.all(rows.map(presentMentionRecord))
  const mentionTypes = [
    'asset',
    'flow',
    'session',
    'element',
    'folder',
  ] as const
  return {
    groups: mentionTypes.map(entityType => ({
      entityType,
      items: presented.filter(item => item.entityType === entityType),
    })),
  }
}
