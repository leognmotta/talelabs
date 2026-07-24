/** Bounded Project Home reads for recent Assets, Brief, and resumable work. */

import type { AssetTable } from '@talelabs/db'
import type { Selectable } from 'kysely'

import { db, sql } from '@talelabs/db'

/** One recent Project work row from an existing Flow or Create session. */
export interface ProjectRecentWorkRow {
  /** Stable Flow or Create-session identifier. */
  id: string
  /** User-facing work label, nullable for an unnamed Create session. */
  name: null | string
  /** Number of available generated Assets attributed to this source. */
  outputCount: number
  /** Source family used to build the canonical Project route. */
  type: 'flow' | 'session'
  /** Last source update used to merge the two bounded lists. */
  updatedAt: Date
}

/** Loads a media-first bounded recent Asset set for Project Home. */
export function listRecentProjectAssetRows(input: {
  limit: number
  organizationId: string
  projectId: string
}) {
  return db.selectFrom('assets')
    .selectAll()
    .where('organizationId', '=', input.organizationId)
    .where('projectId', '=', input.projectId)
    .where('deletedAt', 'is', null)
    .where('purgeRequestedAt', 'is', null)
    .where('purgedAt', 'is', null)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(input.limit)
    .execute() as Promise<Selectable<AssetTable>[]>
}

/** Loads a combined bounded recent work set without duplicating list APIs. */
export async function listRecentProjectWorkRows(input: {
  limit: number
  organizationId: string
  projectId: string
  userId: string
}) {
  const result = await sql<ProjectRecentWorkRow>`
    with bounded_sessions as (
      select
        session."id",
        session."name",
        session."updatedAt",
        'session'::text as "type",
        (
          select count(*)::integer
          from "assets" asset
          join "generationJobs" job
            on job."organizationId" = asset."organizationId"
            and job."id" = asset."generationJobId"
          join "flowRuns" run
            on run."organizationId" = job."organizationId"
            and run."id" = job."flowRunId"
          where asset."organizationId" = ${input.organizationId}
            and run."createSessionId" = session."id"
            and asset."deletedAt" is null
            and asset."purgeRequestedAt" is null
            and asset."purgedAt" is null
        ) as "outputCount"
      from "createSessions" session
      where session."organizationId" = ${input.organizationId}
        and session."projectId" = ${input.projectId}
        and session."createdBy" = ${input.userId}
        and session."deletedAt" is null
      order by session."updatedAt" desc, session."id" desc
      limit ${input.limit}
    ), bounded_flows as (
      select
        flow."id",
        flow."name",
        flow."updatedAt",
        'flow'::text as "type",
        (
          select count(*)::integer
          from "assets" asset
          join "generationJobs" job
            on job."organizationId" = asset."organizationId"
            and job."id" = asset."generationJobId"
          where asset."organizationId" = ${input.organizationId}
            and job."flowId" = flow."id"
            and asset."deletedAt" is null
            and asset."purgeRequestedAt" is null
            and asset."purgedAt" is null
        ) as "outputCount"
      from "flows" flow
      where flow."organizationId" = ${input.organizationId}
        and flow."projectId" = ${input.projectId}
      order by flow."updatedAt" desc, flow."id" desc
      limit ${input.limit}
    )
    select * from (
      select * from bounded_sessions
      union all
      select * from bounded_flows
    ) work
    order by work."updatedAt" desc, work."id" desc
    limit ${input.limit}
  `.execute(db)
  return result.rows
}
