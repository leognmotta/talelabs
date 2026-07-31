/** Bounded monthly run-history reads for the Billing Usage destination. */

import type { DatabaseExecutor } from '@talelabs/db'

import { db } from '@talelabs/db'

import { HttpError } from '../../middleware/error.js'
import {
  buildCursorPage,
  parseIsoTimestampCursorValue,
  resolvePagination,
} from '../../pagination/pagination.js'
import { resolveBillingUsageMonth } from './read.service.js'

const RUN_HISTORY_DEFAULT_LIMIT = 20
const mediaTypeOrder = ['image', 'video', 'audio', 'text'] as const

type RunMediaType = typeof mediaTypeOrder[number]

interface OutputCounts {
  audio: number
  image: number
  text: number
  video: number
}

function emptyOutputCounts(): OutputCounts {
  return { audio: 0, image: 0, text: 0, video: 0 }
}

/**
 * Lists one reverse-chronological page of runs visible in Billing Usage.
 *
 * Flow history is collaborative within the tenant. Direct Create history
 * remains visible only to its creator, matching the canonical run read policy.
 */
export async function listBillingUsageRuns(input: {
  /** Opaque cursor returned by the prior selected-month page. */
  cursor?: string
  /** Bounded requested page size. */
  limit?: number
  /** Optional YYYY-MM UTC calendar month. */
  month?: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Signed-in member used to preserve private Create history. */
  requestingUserId: string
  /** Current instant, injectable for deterministic verification. */
  now?: Date
}, database: DatabaseExecutor = db) {
  const period = resolveBillingUsageMonth(input.month, input.now)
  const pagination = resolvePagination(
    {
      cursor: input.cursor,
      limit: input.limit ?? RUN_HISTORY_DEFAULT_LIMIT,
    },
    {
      cursorValueParsers: { createdAt: parseIsoTimestampCursorValue },
      defaultOrder: 'desc',
      defaultSort: 'createdAt',
    },
  )
  if (!pagination.ok) {
    throw new HttpError(
      400,
      'validation_error',
      'The Billing Usage run cursor is invalid.',
      pagination.details,
    )
  }

  let query = database
    .selectFrom('flowRuns as run')
    .leftJoin('flows as flow', join => join
      .onRef('flow.organizationId', '=', 'run.organizationId')
      .onRef('flow.id', '=', 'run.flowId'))
    .leftJoin('createSessions as session', join => join
      .onRef('session.organizationId', '=', 'run.organizationId')
      .onRef('session.id', '=', 'run.createSessionId'))
    .select([
      'run.completedAt',
      'run.createdAt',
      'run.creditCost',
      'run.creditQuoted',
      'run.fundingSource',
      'run.id',
      'run.mode',
      'run.source',
      'run.status',
      'flow.name as flowName',
      'session.name as createSessionName',
    ])
    .where('run.organizationId', '=', input.organizationId)
    .where('run.createdAt', '>=', period.startsAt)
    .where('run.createdAt', '<', period.endsAt)
    .where(eb => eb.or([
      eb('run.source', '=', 'flow'),
      eb.and([
        eb('run.source', '=', 'create'),
        eb('run.createdBy', '=', input.requestingUserId),
      ]),
    ]))
  if (pagination.value.cursor) {
    const cursor = pagination.value.cursor
    const cursorCreatedAt = new Date(String(cursor.sortValue))
    query = query.where(eb => eb.or([
      eb('run.createdAt', '<', cursorCreatedAt),
      eb.and([
        eb('run.createdAt', '=', cursorCreatedAt),
        eb('run.id', '<', cursor.id),
      ]),
    ]))
  }
  const rows = await query
    .orderBy('run.createdAt', 'desc')
    .orderBy('run.id', 'desc')
    .limit(pagination.value.limit + 1)
    .execute()
  const page = buildCursorPage({
    cursorFromRow: run => ({
      id: run.id,
      order: 'desc' as const,
      sort: 'createdAt' as const,
      sortValue: run.createdAt.toISOString(),
    }),
    limit: pagination.value.limit,
    rows,
    serialize: run => run,
  })
  const runIds = page.pageRows.map(run => run.id)
  const [jobMediaTypes, assetOutputs, textOutputs] = runIds.length > 0
    ? await Promise.all([
        database
          .selectFrom('generationJobs')
          .select(['flowRunId', 'mediaType'])
          .distinct()
          .where('organizationId', '=', input.organizationId)
          .where('flowRunId', 'in', runIds)
          .execute(),
        database
          .selectFrom('assets as asset')
          .innerJoin('generationJobs as job', join => join
            .onRef('job.organizationId', '=', 'asset.organizationId')
            .onRef('job.id', '=', 'asset.generationJobId'))
          .select([
            'asset.type as mediaType',
            'job.flowRunId as flowRunId',
            eb => eb.fn.countAll<number>().as('count'),
          ])
          .where('asset.organizationId', '=', input.organizationId)
          .where('job.flowRunId', 'in', runIds)
          .groupBy(['asset.type', 'job.flowRunId'])
          .execute(),
        database
          .selectFrom('generationJobTextOutputs as output')
          .innerJoin('generationJobs as job', join => join
            .onRef('job.organizationId', '=', 'output.organizationId')
            .onRef('job.id', '=', 'output.jobId'))
          .select([
            'job.flowRunId as flowRunId',
            eb => eb.fn.countAll<number>().as('count'),
          ])
          .where('output.organizationId', '=', input.organizationId)
          .where('job.flowRunId', 'in', runIds)
          .groupBy('job.flowRunId')
          .execute(),
      ])
    : [[], [], []]

  const mediaTypesByRun = new Map<string, Set<RunMediaType>>()
  for (const job of jobMediaTypes) {
    const mediaTypes = mediaTypesByRun.get(job.flowRunId) ?? new Set()
    mediaTypes.add(job.mediaType)
    mediaTypesByRun.set(job.flowRunId, mediaTypes)
  }
  const outputCountsByRun = new Map<string, OutputCounts>()
  for (const output of assetOutputs) {
    const counts = outputCountsByRun.get(output.flowRunId)
      ?? emptyOutputCounts()
    if (output.mediaType !== 'document')
      counts[output.mediaType] = Number(output.count)
    outputCountsByRun.set(output.flowRunId, counts)
  }
  for (const output of textOutputs) {
    const counts = outputCountsByRun.get(output.flowRunId)
      ?? emptyOutputCounts()
    counts.text = Number(output.count)
    outputCountsByRun.set(output.flowRunId, counts)
  }

  return {
    items: page.pageRows.map((run) => {
      const outputCounts = outputCountsByRun.get(run.id)
        ?? emptyOutputCounts()
      return {
        completedAt: run.completedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
        creditCost: run.creditCost,
        creditQuoted: run.creditQuoted,
        fundingSource: run.fundingSource,
        id: run.id,
        mediaTypes: mediaTypeOrder.filter(mediaType =>
          mediaTypesByRun.get(run.id)?.has(mediaType)),
        mode: run.mode as
        | 'all'
        | 'direct'
        | 'downstream'
        | 'node'
        | 'selection'
        | 'upstream',
        outputCount: Object.values(outputCounts).reduce(
          (total, count) => total + count,
          0,
        ),
        source: run.source,
        sourceName: run.source === 'flow'
          ? run.flowName
          : run.createSessionName,
        status: run.status,
      }
    }),
    nextCursor: page.nextCursor,
  }
}
