/** Organization-scoped billing summary, usage aggregates, and ledger reads. */

import type {
  BillingPlanCode,
  DatabaseExecutor,
} from '@talelabs/db'

import { Buffer } from 'node:buffer'
import {
  BILLING_CATALOG,
  getBillingPlan,
  getBillingRecurringOption,
  monthlyGrantBoundary,
} from '@talelabs/billing'
import {
  db,
  sql,
} from '@talelabs/db'

const LEDGER_DEFAULT_LIMIT = 30
const USAGE_MONTH_HISTORY_LIMIT = 120

function toSafeNumber(value: number | string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number))
    throw new Error('billing_projection_exceeds_safe_integer')
  return number
}

function toIso(value: Date | null) {
  return value?.toISOString() ?? null
}

/** Reads the O(1) billing and quota projection used by Settings and sidebars. */
export async function getBillingAccountSummary(input: {
  /** Whether the current member may perform billing mutations. */
  canManageBilling: boolean
  /** Active authenticated tenant. */
  organizationId: string
  /** Current instant, injectable for deterministic verification. */
  now?: Date
}, database: DatabaseExecutor = db) {
  const now = input.now ?? new Date()
  const row = await database.selectFrom('organization as organization')
    .leftJoin(
      'organizationBillingAccounts as account',
      'account.organizationId',
      'organization.id',
    )
    .leftJoin(
      'creditBalances as balance',
      'balance.organizationId',
      'organization.id',
    )
    .leftJoin(
      'organizationStorageUsage as storage',
      'storage.organizationId',
      'organization.id',
    )
    .leftJoin('billingSubscriptions as subscription', join => join
      .onRef('subscription.organizationId', '=', 'organization.id')
      .on('subscription.status', 'not in', ['canceled', 'incomplete_expired']))
    .select([
      'account.catalogRevision',
      'account.currentOfferCode',
      'account.currentPlanCode',
      'account.currentRecurringOptionCode',
      'account.founderEligibleAt',
      'account.managedExecutionStatus',
      'account.paidThrough',
      'account.updatedAt as accountUpdatedAt',
      'balance.availableCredits',
      'balance.reservedCredits',
      'balance.updatedAt as balanceUpdatedAt',
      'storage.reservedBytes',
      'storage.updatedAt as storageUpdatedAt',
      'storage.usedBytes',
      'subscription.billingInterval',
      'subscription.cancelAtPeriodEnd',
      'subscription.creditScheduleRevision',
      'subscription.originalAnchorAt',
      'subscription.scheduledBillingInterval',
      'subscription.scheduledPlanCode',
      'subscription.scheduledRecurringOptionCode',
      'subscription.status as subscriptionStatus',
      'organization.createdAt as organizationCreatedAt',
      sql<number>`(
        select count(*)::integer
        from "subscriptionCreditPeriods" period_row
        where period_row."organizationId" = ${input.organizationId}
          and period_row."billingSubscriptionId" = subscription."id"
          and period_row."scheduleRevision"
            = subscription."creditScheduleRevision"
      )`.as('subscriptionCreditPeriodCount'),
    ])
    .where('organization.id', '=', input.organizationId)
    .executeTakeFirstOrThrow()

  const projectedPlanCode: BillingPlanCode = row.currentPlanCode === 'creator'
    || row.currentPlanCode === 'pro'
    ? row.currentPlanCode
    : 'free'
  const paidEntitlementActive = projectedPlanCode !== 'free'
    && row.paidThrough !== null
    && row.paidThrough > now
  const currentPlanCode: BillingPlanCode = paidEntitlementActive
    ? projectedPlanCode
    : 'free'
  const currentOfferCode = paidEntitlementActive
    ? row.currentOfferCode
    : null
  const currentRecurringOptionCode = paidEntitlementActive
    ? row.currentRecurringOptionCode
    : null
  const managedExecutionStatus = row.managedExecutionStatus ?? 'active'
  const plan = getBillingPlan(currentPlanCode)
  const usedBytes = toSafeNumber(row.usedBytes ?? '0')
  const reservedBytes = toSafeNumber(row.reservedBytes ?? '0')
  const committedBytes = usedBytes + reservedBytes
  const remainingBytes = Math.max(0, plan.storageBytes - committedBytes)
  const storageState = committedBytes > plan.storageBytes
    ? 'over_limit' as const
    : committedBytes === plan.storageBytes
      ? 'at_limit' as const
      : 'within_limit' as const
  const recurringOption = currentPlanCode === 'free'
    ? null
    : getBillingRecurringOption(
        currentPlanCode,
        currentRecurringOptionCode ?? '',
      )
  const nextBoundary = row.originalAnchorAt
    ? monthlyGrantBoundary(
        row.originalAnchorAt,
        Number(row.subscriptionCreditPeriodCount),
      )
    : null
  const nextGrantAt = paidEntitlementActive && nextBoundary && row.paidThrough
    && nextBoundary < row.paidThrough
    ? nextBoundary
    : null
  const planStatus = managedExecutionStatus === 'blocked_review'
    ? 'blocked_review' as const
    : currentPlanCode === 'free'
      ? 'free' as const
      : row.cancelAtPeriodEnd
        ? 'canceling' as const
        : managedExecutionStatus === 'past_due'
          || ['past_due', 'unpaid'].includes(row.subscriptionStatus ?? '')
          ? 'past_due' as const
          : 'active' as const
  const updatedAt = new Date(Math.max(
    row.accountUpdatedAt?.getTime() ?? row.organizationCreatedAt.getTime(),
    row.balanceUpdatedAt?.getTime() ?? row.organizationCreatedAt.getTime(),
    row.storageUpdatedAt?.getTime() ?? row.organizationCreatedAt.getTime(),
  ))

  return {
    catalogRevision: row.catalogRevision ?? BILLING_CATALOG.revision,
    plan: {
      billingInterval: paidEntitlementActive ? row.billingInterval : null,
      cancelAtPeriodEnd:
        paidEntitlementActive && (row.cancelAtPeriodEnd ?? false),
      code: currentPlanCode,
      founder:
        currentPlanCode === 'free' && row.founderEligibleAt !== null,
      monthlyCreditAllowance: recurringOption?.monthlyCredits ?? 0,
      nextGrantAt: toIso(nextGrantAt),
      offerCode: currentOfferCode,
      paidThrough: paidEntitlementActive ? toIso(row.paidThrough) : null,
      recurringOptionCode: currentRecurringOptionCode,
      scheduledBillingInterval: paidEntitlementActive
        ? row.scheduledBillingInterval
        : null,
      scheduledPlanCode: paidEntitlementActive
        ? row.scheduledPlanCode
        : null,
      scheduledEffectiveAt:
        paidEntitlementActive && row.scheduledRecurringOptionCode
          ? toIso(row.paidThrough)
          : null,
      scheduledRecurringOptionCode: paidEntitlementActive
        ? row.scheduledRecurringOptionCode
        : null,
      status: planStatus,
    },
    credits: {
      available: row.availableCredits ?? 0,
      reserved: row.reservedCredits ?? 0,
    },
    entitlements: {
      browserByok: plan.browserByok,
      managedExecutionStatus,
    },
    permissions: {
      canManageBilling: input.canManageBilling,
    },
    storage: {
      limitBytes: plan.storageBytes,
      remainingBytes,
      reservedBytes,
      state: storageState,
      usedBytes,
    },
    updatedAt: updatedAt.toISOString(),
  }
}

/** Resolves one UTC calendar month without accepting unbounded date ranges. */
export function resolveBillingUsageMonth(month: string | undefined, now = new Date()) {
  const selected = month ?? `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, '0')}`
  const [yearText, monthText] = selected.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  if (
    !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(selected)
    || year < 1970
    || year > 9999
  ) {
    throw new RangeError('invalid_usage_month')
  }
  const startsAt = new Date(Date.UTC(year, monthIndex, 1))
  const endsAt = new Date(Date.UTC(year, monthIndex + 1, 1))
  return { endsAt, month: selected, startsAt }
}

/**
 * Lists recent UTC months containing generation or credit-ledger activity.
 *
 * The fixed candidate window keeps this discovery read bounded while each
 * existence check uses the organization-and-created-at indexes.
 */
export async function listBillingUsageMonths(input: {
  /** Active authenticated tenant. */
  organizationId: string
  /** Current instant, injectable for deterministic verification. */
  now?: Date
}, database: DatabaseExecutor = db) {
  const now = input.now ?? new Date()
  const currentMonth = resolveBillingUsageMonth(undefined, now)
  const result = await sql<{ month: string }>`
    with "candidateMonths" as (
      select
        ${currentMonth.startsAt}::timestamptz
          - month_offset * interval '1 month' as "startsAt"
      from generate_series(
        0,
        ${USAGE_MONTH_HISTORY_LIMIT - 1}
      ) as series(month_offset)
    )
    select to_char(
      "startsAt" at time zone 'UTC',
      'YYYY-MM'
    ) as "month"
    from "candidateMonths"
    where exists (
      select 1
      from "flowRuns"
      where "organizationId" = ${input.organizationId}
        and "createdAt" >= "candidateMonths"."startsAt"
        and "createdAt"
          < "candidateMonths"."startsAt" + interval '1 month'
    )
    or exists (
      select 1
      from "creditLedgerEntries"
      where "organizationId" = ${input.organizationId}
        and "createdAt" >= "candidateMonths"."startsAt"
        and "createdAt"
          < "candidateMonths"."startsAt" + interval '1 month'
    )
    order by "startsAt" desc
  `.execute(database)
  const items = result.rows.map(row => row.month)
  return {
    items: items.length > 0 ? items : [currentMonth.month],
  }
}

/** Reads bounded organization content and monthly generation aggregates. */
export async function getBillingUsageSummary(input: {
  /** Optional YYYY-MM UTC calendar month. */
  month?: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Current instant, injectable for deterministic verification. */
  now?: Date
}, database: DatabaseExecutor = db) {
  const period = resolveBillingUsageMonth(input.month, input.now)
  const [
    storage,
    projects,
    projectAssets,
    assets,
    assetMedia,
    elements,
    references,
    runs,
    mediaOutputs,
    textOutputs,
    credits,
  ] = await Promise.all([
    database.selectFrom('organization as organization')
      .leftJoin(
        'organizationStorageUsage as storage',
        'storage.organizationId',
        'organization.id',
      )
      .select([
        sql<Date>`coalesce(
          storage."updatedAt",
          organization."createdAt"
        )`.as('updatedAt'),
        sql<string>`coalesce(storage."usedBytes", 0)::text`.as('usedBytes'),
      ])
      .where('organization.id', '=', input.organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('projects')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('archivedAt', 'is', null)
      .executeTakeFirstOrThrow(),
    database.selectFrom('assets')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('projectId', 'is not', null)
      .where('purgedAt', 'is', null)
      .executeTakeFirstOrThrow(),
    database.selectFrom('assets')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('purgedAt', 'is', null)
      .executeTakeFirstOrThrow(),
    database.selectFrom('assets')
      .select([
        'type as mediaType',
        eb => eb.fn.countAll<number>().as('count'),
        eb => eb.fn.coalesce(
          eb.fn.sum<string>('sizeBytes'),
          eb.val('0'),
        ).as('usedBytes'),
      ])
      .where('organizationId', '=', input.organizationId)
      .where('purgedAt', 'is', null)
      .groupBy('type')
      .execute(),
    database.selectFrom('elements')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('elementReferences')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .executeTakeFirstOrThrow(),
    database.selectFrom('flowRuns')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', input.organizationId)
      .where('createdAt', '>=', period.startsAt)
      .where('createdAt', '<', period.endsAt)
      .executeTakeFirstOrThrow(),
    database.selectFrom('assets')
      .select([
        'type as mediaType',
        eb => eb.fn.countAll<number>().as('count'),
      ])
      .where('organizationId', '=', input.organizationId)
      .where('source', '=', 'generation')
      .where('createdAt', '>=', period.startsAt)
      .where('createdAt', '<', period.endsAt)
      .groupBy('type')
      .execute(),
    database.selectFrom('generationJobTextOutputs as output')
      .innerJoin('generationJobs as job', join => join
        .onRef('job.organizationId', '=', 'output.organizationId')
        .onRef('job.id', '=', 'output.jobId'))
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('output.organizationId', '=', input.organizationId)
      .where('job.status', '=', 'succeeded')
      .where('job.completedAt', '>=', period.startsAt)
      .where('job.completedAt', '<', period.endsAt)
      .executeTakeFirstOrThrow(),
    database.selectFrom('creditLedgerEntries')
      .select([
        sql<number>`coalesce(sum(
          case when "entryType" = 'capture' then -"reservedDelta" else 0 end
        ), 0)::integer`.as('capturedCredits'),
        sql<number>`coalesce(sum(
          case when "entryType" = 'release' then "availableDelta" else 0 end
        ), 0)::integer`.as('releasedCredits'),
      ])
      .where('organizationId', '=', input.organizationId)
      .where('createdAt', '>=', period.startsAt)
      .where('createdAt', '<', period.endsAt)
      .executeTakeFirstOrThrow(),
  ])

  const byMediaType = (['image', 'video', 'audio', 'document'] as const)
    .map((mediaType) => {
      const aggregate = assetMedia.find(row => row.mediaType === mediaType)
      return {
        count: Number(aggregate?.count ?? 0),
        mediaType,
        usedBytes: toSafeNumber(aggregate?.usedBytes ?? '0'),
      }
    })
  const mediaOutputCounts = Object.fromEntries(
    mediaOutputs.map(row => [row.mediaType, Number(row.count)]),
  )
  const textOutputCount = Number(textOutputs.count)
  const successfulOutputCount = mediaOutputs.reduce(
    (total, row) => total + Number(row.count),
    textOutputCount,
  )

  return {
    content: {
      assets: {
        byMediaType,
        count: Number(assets.count),
        usedBytes: toSafeNumber(storage.usedBytes),
      },
      elements: {
        count: Number(elements.count),
        referenceCount: Number(references.count),
      },
      projects: {
        assetCount: Number(projectAssets.count),
        count: Number(projects.count),
      },
    },
    generation: {
      capturedCredits: Number(credits.capturedCredits),
      outputsByMediaType: {
        audio: mediaOutputCounts.audio ?? 0,
        image: mediaOutputCounts.image ?? 0,
        text: textOutputCount,
        video: mediaOutputCounts.video ?? 0,
      },
      releasedCredits: Number(credits.releasedCredits),
      runCount: Number(runs.count),
      successfulOutputCount,
    },
    period: {
      endsAt: period.endsAt.toISOString(),
      month: period.month,
      startsAt: period.startsAt.toISOString(),
    },
    updatedAt: storage.updatedAt.toISOString(),
  }
}

interface LedgerCursor {
  createdAt: string
  id: string
}

function decodeLedgerCursor(cursor: string): LedgerCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<LedgerCursor>
    if (
      typeof parsed.createdAt !== 'string'
      || Number.isNaN(Date.parse(parsed.createdAt))
      || typeof parsed.id !== 'string'
      || !parsed.id
    ) {
      throw new Error('invalid')
    }
    return { createdAt: parsed.createdAt, id: parsed.id }
  }
  catch {
    throw new RangeError('invalid_ledger_cursor')
  }
}

function encodeLedgerCursor(cursor: LedgerCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

/** Reads one reverse-chronological cursor page from the append-only ledger. */
export async function listBillingLedger(input: {
  /** Opaque cursor returned by a prior page. */
  cursor?: string
  /** Bounded requested page size. */
  limit?: number
  /** Optional YYYY-MM UTC calendar month. */
  month?: string
  /** Active authenticated tenant. */
  organizationId: string
  /** Current instant, injectable for deterministic verification. */
  now?: Date
}, database: DatabaseExecutor = db) {
  const limit = input.limit ?? LEDGER_DEFAULT_LIMIT
  const cursor = input.cursor ? decodeLedgerCursor(input.cursor) : null
  const period = resolveBillingUsageMonth(input.month, input.now)
  let query = database.selectFrom('creditLedgerEntries')
    .select([
      'availableDelta',
      'createdAt',
      'entryType',
      'id',
      'reasonCode',
      'reservedDelta',
    ])
    .where('organizationId', '=', input.organizationId)
    .where('createdAt', '>=', period.startsAt)
    .where('createdAt', '<', period.endsAt)
  if (cursor) {
    const createdAt = new Date(cursor.createdAt)
    query = query.where(eb => eb.or([
      eb('createdAt', '<', createdAt),
      eb.and([
        eb('createdAt', '=', createdAt),
        eb('id', '<', cursor.id),
      ]),
    ]))
  }
  const rows = await query
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(limit + 1)
    .execute()
  const hasMore = rows.length > limit
  const items = rows.slice(0, limit).map(row => ({
    availableDelta: row.availableDelta,
    createdAt: row.createdAt.toISOString(),
    entryType: row.entryType,
    id: row.id,
    reasonCode: row.reasonCode,
    reservedDelta: row.reservedDelta,
  }))
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last
      ? encodeLedgerCursor({ createdAt: last.createdAt, id: last.id })
      : null,
  }
}
