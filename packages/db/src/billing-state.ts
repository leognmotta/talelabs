/** Transactional initialization, grant creation, and unused-credit reversal. */

import type {
  BillingPlanCode,
  CreditGrantSource,
} from './billing-schema.js'
import type { DatabaseExecutor } from './index.js'

import { createId } from '@paralleldrive/cuid2'

import { withDatabaseTransaction } from './index.js'

/** Stable database accounting failures mapped by API and worker boundaries. */
export class BillingAccountingError extends Error {
  constructor(
    /** Machine-readable failure code. */
    public readonly code:
      | 'billing_account_blocked'
      | 'insufficient_credits'
      | 'storage_limit_exceeded',
    message: string,
  ) {
    super(message)
    this.name = 'BillingAccountingError'
  }
}

/** Ensures the three O(1) organization billing projections exist. */
export async function ensureOrganizationBillingState(
  input: {
    /** Current code-owned catalog revision used only for first initialization. */
    catalogRevision: string
    /** Tenant receiving the projections. */
    organizationId: string
  },
  database: DatabaseExecutor,
) {
  await database.insertInto('organizationBillingAccounts')
    .values({
      catalogRevision: input.catalogRevision,
      organizationId: input.organizationId,
    })
    .onConflict(conflict => conflict.column('organizationId').doNothing())
    .execute()
  await database.insertInto('creditBalances')
    .values({ organizationId: input.organizationId })
    .onConflict(conflict => conflict.column('organizationId').doNothing())
    .execute()
  await database.insertInto('organizationStorageUsage')
    .values({ organizationId: input.organizationId })
    .onConflict(conflict => conflict.column('organizationId').doNothing())
    .execute()
}

/** Immutable grant facts accepted by the shared append operation. */
export interface AppendCreditGrantInput {
  /** Catalog revision captured by the grant. */
  catalogRevision: string
  /** User responsible for a manual or Founder grant. */
  createdBy: null | string
  /** Optional caller-selected durable grant identity. */
  id?: string
  /** Organization-scoped financial transition identity. */
  idempotencyKey: string
  /** Whole credits introduced by the grant. */
  originalCredits: number
  /** Tenant receiving the grant. */
  organizationId: string
  /** Immutable output access policy. */
  outputPolicy: {
    /** Generated Asset visibility. */
    outputVisibility: 'private' | 'public'
    /** Separately moderated showcase eligibility. */
    showcaseEligible: boolean
  }
  /** Commercial plan associated with the grant. */
  planCode: BillingPlanCode | null
  /** Immutable paid offer associated with the grant. */
  offerCode: null | string
  /** Inclusive grant service-period start. */
  grantPeriodStart?: Date | null
  /** Exclusive grant service-period end. */
  grantPeriodEnd?: Date | null
  /** Revenue recognized by this grant in USD cents. */
  recognizedRevenueUsdCents?: number | null
  /** Commercial source of the grant. */
  source: CreditGrantSource
  /** Local top-up purchase identity. */
  creditPurchaseId?: null | string
  /** Stripe Invoice identity authorizing a subscription grant. */
  stripeInvoiceId?: null | string
  /** Stripe Subscription identity authorizing a subscription grant. */
  stripeSubscriptionId?: null | string
  /** Monthly ceiling consumed by a recurring subscription grant. */
  subscriptionCreditPeriodId?: null | string
  /** Paid subscription change authorizing an incremental grant. */
  billingSubscriptionChangeIntentId?: null | string
}

/** Appends one idempotent grant, ledger entry, and balance projection update. */
export async function appendCreditGrant(
  input: AppendCreditGrantInput,
  database: DatabaseExecutor,
) {
  if (!Number.isSafeInteger(input.originalCredits) || input.originalCredits < 1)
    throw new RangeError('A credit grant must contain positive whole credits.')
  if (input.source === 'subscription' && !input.subscriptionCreditPeriodId)
    throw new Error('subscription_credit_period_required')
  return withDatabaseTransaction(database, async (trx) => {
    await ensureOrganizationBillingState(input, trx)
    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const existing = await trx.selectFrom('creditGrants')
      .select([
        'billingSubscriptionChangeIntentId',
        'id',
        'originalCredits',
        'subscriptionCreditPeriodId',
      ])
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (existing) {
      if (
        existing.originalCredits !== input.originalCredits
        || existing.subscriptionCreditPeriodId
        !== (input.subscriptionCreditPeriodId ?? null)
        || existing.billingSubscriptionChangeIntentId
        !== (input.billingSubscriptionChangeIntentId ?? null)
      ) {
        throw new Error('credit_grant_idempotency_conflict')
      }
      return { grantId: existing.id, replayed: true as const }
    }

    const subscriptionPeriod = input.subscriptionCreditPeriodId
      ? await trx.selectFrom('subscriptionCreditPeriods')
          .selectAll()
          .where('organizationId', '=', input.organizationId)
          .where('id', '=', input.subscriptionCreditPeriodId)
          .forUpdate()
          .executeTakeFirstOrThrow()
      : null
    if (
      subscriptionPeriod
      && (
        subscriptionPeriod.grantedCredits + input.originalCredits
        > subscriptionPeriod.targetCredits
        - subscriptionPeriod.carriedCredits
        || subscriptionPeriod.periodStart.getTime()
        !== input.grantPeriodStart?.getTime()
        || subscriptionPeriod.periodEnd.getTime()
        !== input.grantPeriodEnd?.getTime()
      )
    ) {
      throw new Error('subscription_credit_period_ceiling_exceeded')
    }

    await trx.selectFrom('creditBalances')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()

    const grantId = input.id ?? createId()
    await trx.insertInto('creditGrants').values({
      availableCredits: input.originalCredits,
      billingSubscriptionChangeIntentId:
        input.billingSubscriptionChangeIntentId ?? null,
      capturedCredits: 0,
      catalogRevision: input.catalogRevision,
      createdBy: input.createdBy,
      creditPurchaseId: input.creditPurchaseId ?? null,
      grantPeriodEnd: input.grantPeriodEnd ?? null,
      grantPeriodStart: input.grantPeriodStart ?? null,
      id: grantId,
      idempotencyKey: input.idempotencyKey,
      offerCode: input.offerCode,
      organizationId: input.organizationId,
      originalCredits: input.originalCredits,
      outputVisibility: input.outputPolicy.outputVisibility,
      planCode: input.planCode,
      recognizedRevenueUsdCents: input.recognizedRevenueUsdCents ?? null,
      reservedCredits: 0,
      reversedCredits: 0,
      showcaseEligible: input.outputPolicy.showcaseEligible,
      source: input.source,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      subscriptionCreditPeriodId: input.subscriptionCreditPeriodId ?? null,
    }).execute()
    if (subscriptionPeriod) {
      await trx.updateTable('subscriptionCreditPeriods')
        .set(eb => ({
          grantedCredits: eb('grantedCredits', '+', input.originalCredits),
          updatedAt: new Date(),
        }))
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', subscriptionPeriod.id)
        .executeTakeFirstOrThrow()
    }
    await trx.insertInto('creditLedgerEntries').values({
      availableDelta: input.originalCredits,
      createdBy: input.createdBy,
      creditGrantId: grantId,
      creditPurchaseId: input.creditPurchaseId ?? null,
      entryType: 'grant',
      id: createId(),
      idempotencyKey: `${input.idempotencyKey}:ledger`,
      organizationId: input.organizationId,
      reasonCode: `${input.source}_grant`,
      reservedDelta: 0,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
    }).execute()
    await trx.updateTable('creditBalances')
      .set(eb => ({
        availableCredits: eb('availableCredits', '+', input.originalCredits),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .executeTakeFirstOrThrow()
    return { grantId, replayed: false as const }
  })
}

/** Reverses only unused credits and blocks review when a grant was consumed. */
export async function reverseUnusedCreditGrant(
  input: {
    /** Grant being reversed. */
    creditGrantId: string
    /** External refund or dispute transition identity. */
    idempotencyKey: string
    /** Tenant owning the grant. */
    organizationId: string
    /** Stable reversal reason. */
    reasonCode: 'payment_disputed' | 'payment_refunded'
  },
  database: DatabaseExecutor,
) {
  return withDatabaseTransaction(database, async (trx) => {
    const replay = await trx.selectFrom('creditLedgerEntries')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (replay) {
      return {
        consumed: false,
        replayed: true as const,
        reversedCredits: 0,
      }
    }

    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    await trx.selectFrom('creditBalances')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const grant = await trx.selectFrom('creditGrants')
      .selectAll()
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.creditGrantId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const reversedCredits = grant.availableCredits
    if (reversedCredits > 0) {
      await trx.updateTable('creditGrants')
        .set({
          availableCredits: 0,
          reversedCredits: grant.reversedCredits + reversedCredits,
        })
        .where('organizationId', '=', input.organizationId)
        .where('id', '=', grant.id)
        .execute()
      await trx.insertInto('creditLedgerEntries').values({
        availableDelta: -reversedCredits,
        creditGrantId: grant.id,
        entryType: 'reverse',
        id: createId(),
        idempotencyKey: input.idempotencyKey,
        organizationId: input.organizationId,
        reasonCode: input.reasonCode,
        reservedDelta: 0,
      }).execute()
      await trx.updateTable('creditBalances')
        .set(eb => ({
          availableCredits: eb('availableCredits', '-', reversedCredits),
          updatedAt: new Date(),
          version: eb('version', '+', '1'),
        }))
        .where('organizationId', '=', input.organizationId)
        .execute()
    }
    const consumed = grant.capturedCredits > 0 || grant.reservedCredits > 0
    if (consumed) {
      await trx.updateTable('organizationBillingAccounts')
        .set(eb => ({
          managedExecutionReason: input.reasonCode,
          managedExecutionStatus: 'blocked_review',
          revision: eb('revision', '+', '1'),
          updatedAt: new Date(),
        }))
        .where('organizationId', '=', input.organizationId)
        .execute()
    }
    return {
      consumed,
      replayed: false as const,
      reversedCredits,
    }
  })
}

/** Restores an exact prior unused-credit reversal through a compensating entry. */
export async function reinstateReversedCreditGrant(
  input: {
    /** Whole credits previously removed from the grant. */
    credits: number
    /** Grant receiving the compensating restoration. */
    creditGrantId: string
    /** External resolution identity. */
    idempotencyKey: string
    /** Tenant owning the grant. */
    organizationId: string
    /** Stable restoration reason. */
    reasonCode: 'payment_dispute_reinstated'
  },
  database: DatabaseExecutor,
) {
  if (!Number.isSafeInteger(input.credits) || input.credits < 1)
    throw new RangeError('A credit reinstatement must contain positive credits.')
  return withDatabaseTransaction(database, async (trx) => {
    const replay = await trx.selectFrom('creditLedgerEntries')
      .select('id')
      .where('organizationId', '=', input.organizationId)
      .where('idempotencyKey', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (replay)
      return { reinstatedCredits: 0, replayed: true as const }

    await trx.selectFrom('organizationBillingAccounts')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    await trx.selectFrom('creditBalances')
      .select('organizationId')
      .where('organizationId', '=', input.organizationId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    const grant = await trx.selectFrom('creditGrants')
      .select(['id', 'reversedCredits'])
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', input.creditGrantId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (grant.reversedCredits < input.credits)
      throw new Error('credit_reinstatement_exceeds_reversal')

    await trx.updateTable('creditGrants')
      .set(eb => ({
        availableCredits: eb('availableCredits', '+', input.credits),
        reversedCredits: eb('reversedCredits', '-', input.credits),
      }))
      .where('organizationId', '=', input.organizationId)
      .where('id', '=', grant.id)
      .execute()
    await trx.insertInto('creditLedgerEntries').values({
      availableDelta: input.credits,
      creditGrantId: grant.id,
      entryType: 'adjustment',
      id: createId(),
      idempotencyKey: input.idempotencyKey,
      organizationId: input.organizationId,
      reasonCode: input.reasonCode,
      reservedDelta: 0,
    }).execute()
    await trx.updateTable('creditBalances')
      .set(eb => ({
        availableCredits: eb('availableCredits', '+', input.credits),
        updatedAt: new Date(),
        version: eb('version', '+', '1'),
      }))
      .where('organizationId', '=', input.organizationId)
      .execute()
    return {
      reinstatedCredits: input.credits,
      replayed: false as const,
    }
  })
}
