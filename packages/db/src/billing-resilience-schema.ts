/** Kysely contracts for serialized billing mutations and reversal recovery. */

import type { Generated } from 'kysely'
import type {
  BillingBigIntColumn,
  BillingPlanCode,
} from './billing-schema.js'
import type {
  GeneratedTimestamp,
  NullableTimestamp,
  Timestamp,
} from './column-types.js'

/** Durable subscription Checkout admission lifecycle. */
export type BillingSubscriptionCheckoutIntentStatus
  = | 'completed'
    | 'expired'
    | 'failed'
    | 'pending'

/** Durable renewal-boundary subscription mutation lifecycle. */
export type BillingSubscriptionChangeIntentStatus
  = | 'applied'
    | 'failed'
    | 'pending'

/** Payment timing for one durable paid-subscription mutation. */
export type BillingSubscriptionChangeMode = 'immediate' | 'renewal'

/** Current Stripe dispute outcome projected for one payment. */
export type BillingPaymentDisputeStatus
  = | 'lost'
    | 'open'
    | 'prevented'
    | 'warning_closed'
    | 'won'

/** Organization-serialized admission for one recurring Checkout Session. */
export interface BillingSubscriptionCheckoutIntentTable {
  /** Durable local intent identity embedded in Stripe metadata. */
  id: string
  /** Tenant that may own at most one pending subscription Checkout. */
  organizationId: string
  /** Current durable intent lifecycle. */
  status: BillingSubscriptionCheckoutIntentStatus
  /** Creator or Pro target plan. */
  planCode: Exclude<BillingPlanCode, 'free'>
  /** Exact target recurring allowance. */
  recurringOptionCode: string
  /** Immutable target commercial offer. */
  offerCode: string
  /** Monthly or annual target cadence. */
  billingInterval: 'month' | 'year'
  /** Catalog revision authorizing the target. */
  catalogRevision: string
  /** Caller request identity retained for exact replay validation. */
  idempotencyKey: string
  /** Stripe-hosted Checkout Session once creation succeeds. */
  stripeCheckoutSessionId: string | null
  /** Stripe Subscription that completed the admitted Checkout. */
  stripeSubscriptionId: string | null
  /** Short-lived owner of the external Stripe creation attempt. */
  stripeRequestLeaseToken: string | null
  /** Exclusive boundary for reclaiming an abandoned Stripe request. */
  stripeRequestLeaseExpiresAt: NullableTimestamp
  /** Exclusive boundary after which a new organization intent may be admitted. */
  expiresAt: Timestamp
  /** Terminal successful completion instant. */
  completedAt: NullableTimestamp
  /** Intent admission instant. */
  createdAt: GeneratedTimestamp
  /** Latest lease, Stripe identity, or terminal transition instant. */
  updatedAt: GeneratedTimestamp
}

/** Organization-serialized paid plan, option, or cadence mutation. */
export interface BillingSubscriptionChangeIntentTable {
  /** Durable mutation identity used in Stripe idempotency keys. */
  id: string
  /** Tenant owning the subscription and intent. */
  organizationId: string
  /** Local subscription projection being changed. */
  billingSubscriptionId: string
  /** Monotonic subscription-local mutation revision. */
  revision: BillingBigIntColumn
  /** Current durable intent lifecycle. */
  status: BillingSubscriptionChangeIntentStatus
  /** Whether payment unlocks now or the target starts at renewal. */
  changeMode: BillingSubscriptionChangeMode
  /** Current paid plan captured when the intent was admitted. */
  fromPlanCode: Exclude<BillingPlanCode, 'free'>
  /** Current Creator or Pro option captured when the intent was admitted. */
  fromRecurringOptionCode: string
  /** Current immutable offer captured when the intent was admitted. */
  fromOfferCode: string
  /** Current monthly or annual cadence captured at admission. */
  fromBillingInterval: 'month' | 'year'
  /** Current full monthly allowance captured for immediate credit arithmetic. */
  fromMonthlyCredits: number | null
  /** Requested paid plan. */
  toPlanCode: Exclude<BillingPlanCode, 'free'>
  /** Requested recurring allowance option. */
  toRecurringOptionCode: string
  /** Immutable offer corresponding to the requested option. */
  toOfferCode: string
  /** Requested monthly or annual cadence. */
  toBillingInterval: 'month' | 'year'
  /** Target full monthly allowance captured for immediate credit arithmetic. */
  toMonthlyCredits: number | null
  /** Catalog revision authorizing the requested option. */
  catalogRevision: string
  /** Expected current-period start guarded at Stripe and PostgreSQL. */
  currentPeriodStart: Timestamp
  /** Expected current-period boundary guarded at Stripe and PostgreSQL. */
  currentPeriodEnd: Timestamp
  /** Fixed Stripe proration instant shared by preview and mutation. */
  prorationDate: NullableTimestamp
  /** Incremental credits authorized immediately after successful payment. */
  creditAdjustment: Generated<number>
  /** Exact previewed Stripe amount due immediately in USD cents. */
  expectedAmountDueMinor: number | null
  /** Exact immutable target Stripe Price used by the immediate or scheduled mutation. */
  stripePriceId: string | null
  /** Caller request identity retained for exact replay validation. */
  idempotencyKey: string
  /** Stripe Subscription Schedule after creation or reconciliation. */
  stripeScheduleId: string | null
  /** Stripe Invoice that payment-gated an immediate change. */
  stripeInvoiceId: string | null
  /** Short-lived owner of the external Stripe mutation attempt. */
  stripeRequestLeaseToken: string | null
  /** Exclusive boundary for reclaiming an abandoned Stripe mutation. */
  stripeRequestLeaseExpiresAt: NullableTimestamp
  /** Stable failure code for terminal local conflicts. */
  lastErrorCode: string | null
  /** Boundary after which an abandoned pending mutation may be failed. */
  expiresAt: Timestamp
  /** Applied or failed transition instant. */
  completedAt: NullableTimestamp
  /** Intent admission instant. */
  createdAt: GeneratedTimestamp
  /** Latest lease, Stripe identity, or terminal transition instant. */
  updatedAt: GeneratedTimestamp
}

/** Current outcome for one Stripe dispute against a known payment. */
export interface BillingPaymentDisputeTable {
  /** Unique Stripe Dispute identity. */
  stripeDisputeId: string
  /** Tenant owning the affected payment. */
  organizationId: string
  /** Local payment under dispute. */
  billingPaymentId: string
  /** Current Stripe dispute outcome. */
  status: BillingPaymentDisputeStatus
  /** Stripe-disputed amount in currency minor units. */
  amountMinor: number
  /** Stripe dispute currency. */
  currency: string
  /** Terminal Stripe outcome instant. */
  resolvedAt: NullableTimestamp
  /** Initial dispute projection instant. */
  createdAt: GeneratedTimestamp
  /** Latest current-resource projection instant. */
  updatedAt: GeneratedTimestamp
}

/** Per-grant unused credits removed and optionally restored for a dispute. */
export interface BillingDisputeGrantReversalTable {
  /** Tenant owning the dispute and grant. */
  organizationId: string
  /** Stripe Dispute responsible for the reversal. */
  stripeDisputeId: string
  /** Affected immutable credit grant. */
  creditGrantId: string
  /** Unused credits removed when the dispute opened. */
  reversedCredits: number
  /** Removed credits restored after a merchant-favorable outcome. */
  reinstatedCredits: Generated<number>
  /** Initial reversal instant. */
  createdAt: GeneratedTimestamp
  /** Latest restoration transition instant. */
  updatedAt: GeneratedTimestamp
}

/** Durable keyset cursor for one bounded global billing sweep. */
export interface BillingReconciliationCursorTable {
  /** Stable scheduled-task identity. */
  taskId: string
  /** Last organization completed by the preceding successful page. */
  cursorOrganizationId: string | null
  /** Latest page-claim instant. */
  updatedAt: GeneratedTimestamp
}

/** Durable retry and operator-visible quarantine for one task and tenant. */
export interface BillingReconciliationFailureTable {
  /** Stable scheduled-task identity. */
  taskId: string
  /** Tenant whose isolated reconciliation attempt failed. */
  organizationId: string
  /** Consecutive failed attempts since the latest resolution. */
  attempts: number
  /** Stable non-secret classification for the latest failure. */
  lastErrorCode: string
  /** Most recent failed attempt instant. */
  lastAttemptedAt: Timestamp
  /** Earliest automatic retry instant; null after quarantine or resolution. */
  nextAttemptAt: NullableTimestamp
  /** Retry-exhaustion instant requiring operator review. */
  quarantinedAt: NullableTimestamp
  /** Latest successful recovery instant, when this failure is closed. */
  resolvedAt: NullableTimestamp
  /** First failure-record creation instant. */
  createdAt: GeneratedTimestamp
  /** Latest retry, quarantine, or resolution transition instant. */
  updatedAt: GeneratedTimestamp
}
