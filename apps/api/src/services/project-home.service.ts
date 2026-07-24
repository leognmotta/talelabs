/** Compact Project Home composition from bounded existing-domain reads. */

import type { JsonObject, JsonValue } from '@talelabs/db'

import { db } from '@talelabs/db'

import { findProjectBriefRow } from '../data/project-briefs.data.js'
import {
  listRecentProjectAssetRows,
  listRecentProjectWorkRows,
} from '../data/project-home.data.js'
import { presentAsset } from './asset-presenter.js'
import { getProject } from './projects.service.js'

const RECENT_ASSET_LIMIT = 10
const RECENT_WORK_LIMIT = 8
const BRIEF_PREVIEW_BLOCK_LIMIT = 4

function briefPreviewDocument(value: JsonValue | undefined): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return { content: [], type: 'doc' }
  const document = value as JsonObject
  const content = Array.isArray(document.content)
    ? document.content.slice(0, BRIEF_PREVIEW_BLOCK_LIMIT)
    : []
  return { content, type: 'doc' }
}

/** Loads one compact Project Home without unbounded entity collections. */
export async function getProjectHome(input: {
  organizationId: string
  projectId: string
  userId: string
}) {
  const [project, brief, assets, recentWork] = await Promise.all([
    getProject({
      id: input.projectId,
      organizationId: input.organizationId,
      userId: input.userId,
    }),
    findProjectBriefRow(
      db,
      input.organizationId,
      input.projectId,
    ),
    listRecentProjectAssetRows({
      limit: RECENT_ASSET_LIMIT,
      organizationId: input.organizationId,
      projectId: input.projectId,
    }),
    listRecentProjectWorkRows({
      limit: RECENT_WORK_LIMIT,
      organizationId: input.organizationId,
      projectId: input.projectId,
      userId: input.userId,
    }),
  ])
  return {
    brief: {
      document: briefPreviewDocument(brief?.document),
      empty: !brief || brief.plainText.trim().length === 0,
      revision: Number(brief?.revision ?? 0),
      updatedAt: brief?.updatedAt.toISOString() ?? null,
    },
    project,
    recentAssets: await Promise.all(assets.map(asset => presentAsset(
      asset,
      undefined,
      { includeOriginalUrl: false },
    ))),
    recentWork: recentWork.map(work => ({
      ...work,
      updatedAt: work.updatedAt.toISOString(),
    })),
  }
}
