/** Kysely contracts for organization billing, credits, and storage authority. */

import type { ColumnType, Generated } from 'kysely'
import type {
  GeneratedTimestamp,
  NullableNumericColumn,
  NullableTimestamp,
  Timestamp,
} from './column-types.js'

/** Launch billing plan identities. */
export type BillingPlanCode = 'creator' | 'free' | 'pro'

/** Organization managed-generation entitlement state. */
export type ManagedExecutionStatus = 'active' | 'blocked_review' | 'past_due'

/** Stripe-backed local subscription lifecycle state. */
export type BillingSubscriptionStatus
  = | 'active'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'paused'
    | 'past_due'
    | 'trialing'
    | 'unpaid'

/** Durable top-up purchase lifecycle state. */
export type CreditPurchaseStatus
  = | 'disputed'
    | 'expired'
    | 'failed'
    | 'partially_refunded'
    | 'paid'
    | 'pending'
    | 'refunded'

/** Durable credit source categories. */
export type CreditGrantSource
  = | 'founder_welcome'
    | 'manual'
    | 'purchase'
    | 'subscription'

/** Durable credit reservation lifecycle state. */
export type CreditReservationStatus
  = | 'captured'
    | 'partial'
    | 'released'
    | 'reserved'

/** Append-only credit accounting entry categories. */
export type CreditLedgerEntryType
  = | 'adjustment'
    | 'capture'
    | 'grant'
    | 'release'
    | 'reserve'
    | 'reverse'

/** Webhook inbox processing lifecycle. */
export type StripeWebhookProcessingStatus
  = | 'failed'
    | 'pending'
    | 'processing'
    | 'succeeded'

/** Bigint selected as a string and required on insertion. */
export type BillingBigIntColumn = ColumnType<
  string,
  bigint | number | string,
  bigint | number | string
>

/** Bigint selected as a string with a database-owned insertion default. */
export type GeneratedBillingBigIntColumn = ColumnType<
  string,
  bigint | number | string | undefined,
  bigint | number | string
>

/** Nullable bigint selected as a string. */
export type NullableBillingBigIntColumn = ColumnType<
  string | null,
  bigint | number | string | null | undefined,
  bigint | number | string | null
>

/** Local organization billing and current entitlement projection. */
export interface OrganizationBillingAccountTable {
  /** Tenant owning the billing account. */
  organizationId: string
  /** Stripe Customer identity; never exposed to browser clients. */
  stripeCustomerId: string | null
  /** Current three-plan commercial identity. */
  currentPlanCode: Generated<BillingPlanCode>
  /** Immutable current paid offer, or null on Free. */
  currentOfferCode: string | null
  /** Current recurring allowance option, or null on Free. */
  currentRecurringOptionCode: string | null
  /** Catalog revision last applied to this projection. */
  catalogRevision: string
  /** Whether managed credits may currently be spent. */
  managedExecutionStatus: Generated<ManagedExecutionStatus>
  /** Stable reason for a managed-execution restriction. */
  managedExecutionReason: string | null
  /** Explicit Founder eligibility instant, when assigned. */
  founderEligibleAt: NullableTimestamp
  /** Administrator that explicitly assigned Founder status. */
  founderAssignedBy: string | null
  /** Exclusive paid entitlement boundary confirmed by successful payment. */
  paidThrough: NullableTimestamp
  /** Optimistic projection revision. */
  revision: GeneratedBillingBigIntColumn
  /** Initial account projection instant. */
  createdAt: GeneratedTimestamp
  /** Latest entitlement mutation instant. */
  updatedAt: GeneratedTimestamp
}

/** Local projection of one Stripe recurring subscription. */
export interface BillingSubscriptionTable {
  /** Durable local identity. */
  id: string
  /** Tenant owning the subscription. */
  organizationId: string
  /** Verified Stripe Customer identity. */
  stripeCustomerId: string
  /** Unique Stripe Subscription identity. */
  stripeSubscriptionId: string
  /** Current plan identity. */
  planCode: BillingPlanCode
  /** Current recurring allowance option. */
  recurringOptionCode: string
  /** Immutable current offer. */
  offerCode: string
  /** Catalog revision captured when the offer became current. */
  catalogRevision: string
  /** Current Stripe lifecycle projection. */
  status: BillingSubscriptionStatus
  /** Stripe billing cadence. */
  billingInterval: 'month' | 'year'
  /** Original paid anchor used for drift-free monthly grants. */
  originalAnchorAt: Timestamp
  /** Current Stripe service-period start. */
  currentPeriodStart: Timestamp
  /** Current Stripe service-period end. */
  currentPeriodEnd: Timestamp
  /** Exclusive service boundary authorized by paid invoices. */
  paidThrough: NullableTimestamp
  /** Whether Stripe will end service at the current period boundary. */
  cancelAtPeriodEnd: Generated<boolean>
  /** Future Pro plan projection for a Creator upgrade or Pro option change. */
  scheduledPlanCode: BillingPlanCode | null
  /** Future Pro recurring option taking effect at renewal. */
  scheduledRecurringOptionCode: string | null
  /** Future immutable offer taking effect at renewal. */
  scheduledOfferCode: string | null
  /** Future billing cadence taking effect at renewal. */
  scheduledBillingInterval: 'month' | 'year' | null
  /** Monotonic durable option-change intent revision. */
  changeRevision: GeneratedBillingBigIntColumn
  /** Current monthly-credit schedule generation after cadence resets. */
  creditScheduleRevision: GeneratedBillingBigIntColumn
  /** Initial local projection instant. */
  createdAt: GeneratedTimestamp
  /** Latest webhook or schedule mutation instant. */
  updatedAt: GeneratedTimestamp
}

/** Immutable quoted order and payment state for one credit top-up. */
export interface CreditPurchaseTable {
  /** Durable local purchase identity. */
  id: string
  /** Tenant owning the purchase. */
  organizationId: string
  /** Plan used to quote the purchase. */
  planCode: BillingPlanCode
  /** Paid option used to quote the purchase, or null for Free. */
  recurringOptionCode: string | null
  /** Durable payment lifecycle state. */
  status: CreditPurchaseStatus
  /** Exact amount in currency minor units. */
  amountMinor: number
  /** Current cumulative Stripe-refunded amount in currency minor units. */
  refundedAmountMinor: Generated<number>
  /** ISO settlement currency. */
  currency: string
  /** Exact whole credits quoted and later granted. */
  credits: number
  /** Catalog revision captured at quotation. */
  catalogRevision: string
  /** Credit pricing policy captured at quotation. */
  pricingPolicyVersion: string
  /** Volume-rate benefit in basis points. */
  volumeRateImprovementBps: number
  /** Paid-plan benefit over Free in basis points. */
  membershipRateImprovementBpsFromFree: number
  /** Modeled contribution margin in basis points. */
  modeledContributionMarginBps: number
  /** Verified Stripe Customer identity. */
  stripeCustomerId: string
  /** Unique Stripe Checkout Session identity. */
  stripeCheckoutSessionId: string | null
  /** Unique Stripe PaymentIntent identity. */
  stripePaymentIntentId: string | null
  /** Exactly one purchased grant after successful fulfillment. */
  creditGrantId: string | null
  /** Organization-scoped Checkout request idempotency key. */
  idempotencyKey: string
  /** Confirmed payment instant. */
  paidAt: NullableTimestamp
  /** Purchase admission instant. */
  createdAt: GeneratedTimestamp
  /** Latest payment lifecycle mutation instant. */
  updatedAt: GeneratedTimestamp
}

/** Minimal durable revenue and Stripe settlement record. */
export interface BillingPaymentTable {
  /** Durable payment identity. */
  id: string
  /** Tenant owning the payment. */
  organizationId: string
  /** Subscription invoice or one-time top-up classification. */
  paymentKind: 'credit_topup' | 'subscription'
  /** Owning subscription for recurring payments. */
  billingSubscriptionId: string | null
  /** Owning credit purchase for top-up payments. */
  creditPurchaseId: string | null
  /** Unique Stripe Invoice identity for subscriptions. */
  stripeInvoiceId: string | null
  /** Exact Stripe Invoice Line Item authorizing subscription grants. */
  stripeInvoiceLineItemId: string | null
  /** Exact immutable Stripe Price referenced by the paid invoice line. */
  stripePriceId: string | null
  /** Unique Stripe Checkout identity for top-ups. */
  stripeCheckoutSessionId: string | null
  /** Unique Stripe PaymentIntent identity when present. */
  stripePaymentIntentId: string | null
  /** Exact amount collected in currency minor units. */
  amountPaidMinor: number
  /** Current cumulative Stripe-refunded amount in currency minor units. */
  refundedAmountMinor: Generated<number>
  /** Payment currency. */
  currency: string
  /** Paid plan captured from the exact subscription invoice line. */
  subscriptionPlanCode: BillingPlanCode | null
  /** Paid recurring option captured from the exact subscription invoice line. */
  subscriptionRecurringOptionCode: string | null
  /** Paid offer captured from the exact subscription invoice line. */
  subscriptionOfferCode: string | null
  /** Whole credits authorized for each monthly grant in this service period. */
  subscriptionMonthlyCredits: number | null
  /** Billing cadence captured from the exact paid Stripe Price. */
  subscriptionBillingInterval: 'month' | 'year' | null
  /** Catalog revision attached to the exact paid Stripe Price. */
  subscriptionCatalogRevision: string | null
  /** Instant at which complete paid-line grant facts became immutable. */
  subscriptionGrantFactsCapturedAt: NullableTimestamp
  /** Stripe BalanceTransaction identity when reconciled. */
  stripeBalanceTransactionId: string | null
  /** Realized gross settlement amount in minor units. */
  settlementGrossMinor: number | null
  /** Realized Stripe fee in settlement minor units. */
  settlementFeeMinor: number | null
  /** Realized net settlement amount in minor units. */
  settlementNetMinor: number | null
  /** Realized settlement currency. */
  settlementCurrency: string | null
  /** Exact settlement exchange rate. */
  settlementExchangeRate: NullableNumericColumn
  /** Stable payment lifecycle state. */
  status: string
  /** Inclusive service-period start for subscriptions. */
  servicePeriodStart: NullableTimestamp
  /** Exclusive service-period end for subscriptions. */
  servicePeriodEnd: NullableTimestamp
  /** Confirmed payment instant. */
  paidAt: Timestamp
  /** Initial payment record instant. */
  createdAt: GeneratedTimestamp
  /** Latest settlement mutation instant. */
  updatedAt: GeneratedTimestamp
}

/** Durable idempotency inbox for signed Stripe events. */
export interface StripeWebhookEventTable {
  /** Unique Stripe Event identity. */
  stripeEventId: string
  /** Stripe event type used for bounded dispatch. */
  eventType: string
  /** Primary Stripe object identity, when safely available. */
  stripeObjectId: string | null
  /** Durable asynchronous processing state. */
  processingStatus: StripeWebhookProcessingStatus
  /** Number of processor claims. */
  attemptCount: Generated<number>
  /** Stable last processor failure code. */
  lastErrorCode: string | null
  /** Signed delivery receipt instant. */
  receivedAt: GeneratedTimestamp
  /** Successful terminal processing instant. */
  processedAt: NullableTimestamp
  /** Latest inbox mutation instant. */
  updatedAt: GeneratedTimestamp
}

/** One immutable source bucket for organization credits. */
export interface CreditGrantTable {
  /** Durable grant identity. */
  id: string
  /** Tenant owning the grant. */
  organizationId: string
  /** Commercial or support source. */
  source: CreditGrantSource
  /** Original whole-credit amount. */
  originalCredits: number
  /** Credits still available for reservation. */
  availableCredits: Generated<number>
  /** Credits currently held by active reservations. */
  reservedCredits: Generated<number>
  /** Credits permanently captured by usable outputs. */
  capturedCredits: Generated<number>
  /** Credits reversed after refunds, disputes, or corrections. */
  reversedCredits: Generated<number>
  /** Inclusive monthly service period, when applicable. */
  grantPeriodStart: NullableTimestamp
  /** Exclusive monthly service period, when applicable. */
  grantPeriodEnd: NullableTimestamp
  /** Optional future expiration seam; launch grants are non-expiring. */
  expiresAt: NullableTimestamp
  /** Plan that funded the grant, when applicable. */
  planCode: BillingPlanCode | null
  /** Immutable paid offer, when applicable. */
  offerCode: string | null
  /** Catalog revision captured by the grant. */
  catalogRevision: string
  /** Stripe Subscription identity for recurring grants. */
  stripeSubscriptionId: string | null
  /** Stripe Invoice identity authorizing recurring revenue. */
  stripeInvoiceId: string | null
  /** Monthly subscription ceiling debited by this recurring grant. */
  subscriptionCreditPeriodId: string | null
  /** Paid change that authorized an incremental recurring grant. */
  billingSubscriptionChangeIntentId: string | null
  /** Local top-up purchase identity for purchased grants. */
  creditPurchaseId: string | null
  /** Revenue recognized for this grant in USD cents. */
  recognizedRevenueUsdCents: number | null
  /** Immutable generated Asset visibility policy. */
  outputVisibility: 'private' | 'public'
  /** Immutable generated Asset showcase eligibility. */
  showcaseEligible: boolean
  /** Organization-scoped financial idempotency key. */
  idempotencyKey: string
  /** User responsible for a manual or Founder grant. */
  createdBy: string | null
  /** Grant creation instant. */
  createdAt: GeneratedTimestamp
}

/** Mutable ceiling for credits issued into one monthly subscription period. */
export interface SubscriptionCreditPeriodTable {
  /** Durable credit-period identity referenced by recurring grants. */
  id: string
  /** Tenant owning the subscription and period. */
  organizationId: string
  /** Local subscription whose paid service authorizes this period. */
  billingSubscriptionId: string
  /** Credit-schedule generation retained across billing-anchor resets. */
  scheduleRevision: BillingBigIntColumn
  /** Zero-based month within the current credit schedule. */
  ordinal: number
  /** Inclusive monthly credit boundary. */
  periodStart: Timestamp
  /** Exclusive monthly credit boundary. */
  periodEnd: Timestamp
  /** Maximum credits that may count toward this period. */
  targetCredits: number
  /** Credits from an overlapping prior schedule counted without reissuing. */
  carriedCredits: Generated<number>
  /** Credits actually appended as grants for this period. */
  grantedCredits: Generated<number>
  /** Initial period-projection instant. */
  createdAt: GeneratedTimestamp
  /** Latest target or issued-credit update instant. */
  updatedAt: GeneratedTimestamp
}

/** O(1) organization credit balance projection. */
export interface CreditBalanceTable {
  /** Tenant owning the balance. */
  organizationId: string
  /** Whole credits available for new reservations. */
  availableCredits: Generated<number>
  /** Whole credits held by active reservations. */
  reservedCredits: Generated<number>
  /** Monotonic projection revision. */
  version: GeneratedBillingBigIntColumn
  /** Latest balance mutation instant. */
  updatedAt: GeneratedTimestamp
}

/** One complete run-level credit hold. */
export interface CreditReservationTable {
  /** Durable reservation identity. */
  id: string
  /** Tenant owning the reservation. */
  organizationId: string
  /** Unique funded Flow or Create run. */
  flowRunId: string
  /** Aggregate reservation lifecycle. */
  status: CreditReservationStatus
  /** Immutable aggregate run quote. */
  quotedCredits: number
  /** Credits still reserved. */
  reservedCredits: number
  /** Credits captured by successful jobs. */
  capturedCredits: number
  /** Credits returned by non-billable jobs. */
  releasedCredits: number
  /** Catalog pricing revision captured at admission. */
  pricingPolicyVersion: string
  /** Reservation creation instant. */
  createdAt: GeneratedTimestamp
  /** Terminal settlement instant. */
  closedAt: NullableTimestamp
}

/** Per-generation-job quote and settlement policy. */
export interface CreditReservationItemTable {
  /** Durable item identity. */
  id: string
  /** Tenant owning the item. */
  organizationId: string
  /** Parent run-level reservation. */
  creditReservationId: string
  /** Unique generation job settled by this item. */
  generationJobId: string
  /** Immutable job quote. */
  quotedCredits: number
  /** Credits captured by the job. */
  capturedCredits: number
  /** Credits returned by the job. */
  releasedCredits: number
  /** Immutable output visibility derived from every allocation. */
  outputVisibility: 'private' | 'public'
  /** Immutable showcase eligibility derived from every allocation. */
  showcaseEligible: boolean
  /** Per-job settlement lifecycle. */
  status: CreditReservationStatus
}

/** Deterministic item allocation against one grant bucket. */
export interface CreditReservationAllocationTable {
  /** Tenant owning the allocation. */
  organizationId: string
  /** Parent per-job reservation item. */
  creditReservationItemId: string
  /** Credit source bucket supplying the hold. */
  creditGrantId: string
  /** Credits still reserved against this grant. */
  reservedCredits: number
  /** Credits captured from this grant. */
  capturedCredits: number
  /** Credits released back to this grant. */
  releasedCredits: number
  /** Deterministic allocation order within the job. */
  sortOrder: number
}

/** Append-only authoritative credit accounting transition. */
export interface CreditLedgerEntryTable {
  /** Durable ledger identity. */
  id: string
  /** Tenant owning the entry. */
  organizationId: string
  /** Accounting transition category. */
  entryType: CreditLedgerEntryType
  /** Signed change to spendable credits. */
  availableDelta: number
  /** Signed change to held credits. */
  reservedDelta: number
  /** Related grant bucket, when applicable. */
  creditGrantId: string | null
  /** Related run-level reservation, when applicable. */
  creditReservationId: string | null
  /** Related per-job reservation, when applicable. */
  creditReservationItemId: string | null
  /** Related Flow or Create run, when applicable. */
  flowRunId: string | null
  /** Related generation job, when applicable. */
  generationJobId: string | null
  /** Related Stripe Invoice, when applicable. */
  stripeInvoiceId: string | null
  /** Related top-up purchase, when applicable. */
  creditPurchaseId: string | null
  /** Organization-scoped immutable transition identity. */
  idempotencyKey: string
  /** Stable machine-readable accounting reason. */
  reasonCode: string
  /** User responsible for manual transitions. */
  createdBy: string | null
  /** Ledger append instant. */
  createdAt: GeneratedTimestamp
}

/** O(1) organization Asset storage projection. */
export interface OrganizationStorageUsageTable {
  /** Tenant owning the storage projection. */
  organizationId: string
  /** Canonical non-purged Asset bytes. */
  usedBytes: GeneratedBillingBigIntColumn
  /** Bytes held for pending generated outputs and direct-upload grants. */
  reservedBytes: GeneratedBillingBigIntColumn
  /** Monotonic projection revision. */
  version: GeneratedBillingBigIntColumn
  /** Latest storage mutation instant. */
  updatedAt: GeneratedTimestamp
}
