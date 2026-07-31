/** OpenAPI schemas for TaleLabs billing, credits, usage, and Stripe actions. */

import { z } from '@hono/zod-openapi'

import {
  Cuid2Schema,
  CursorSchema,
  NullableCursorSchema,
  NullableTimestampSchema,
  TimestampSchema,
} from '../../schemas/common.js'
import {
  FlowRunFundingSourceSchema,
  FlowRunStatusSchema,
  GenerationJobMediaTypeSchema,
  RunModeSchema,
  RunSourceSchema,
} from '../runs/runs.schemas.js'

/** Three launch plan identities. */
export const BillingPlanCodeSchema = z.enum(['free', 'creator', 'pro'])

/** Sanitized current commercial catalog response. */
export const BillingCatalogResponseSchema = z.object({
  revision: z.string(),
  currency: z.literal('usd'),
  plans: z.array(z.object({
    code: BillingPlanCodeSchema,
    browserByok: z.boolean(),
    defaultRecurringOptionCode: z.string().nullable(),
    storageBytes: z.number().int().nonnegative(),
    recurringOptions: z.array(z.object({
      code: z.string(),
      maximumTopUpCredits: z.number().int().positive(),
      maximumTopUpRateImprovementBpsFromFree:
        z.number().int().min(0).max(10_000),
      maximumTopUpSavingsBps: z.number().int().min(0).max(10_000),
      monthlyCredits: z.number().int().positive(),
      offers: z.array(z.object({
        billingInterval: z.enum(['month', 'year']),
        offerCode: z.string(),
        priceUsdCents: z.number().int().positive(),
      })),
    })),
  })),
  programs: z.object({
    founder: z.object({
      oneTimeCredits: z.number().int().positive(),
      underlyingPlanCode: z.literal('free'),
    }),
  }),
  topUps: z.object({
    packageAmountsUsdCents: z.array(z.number().int().positive()).min(1),
    minAmountUsdCents: z.number().int().positive(),
    maxAmountUsdCents: z.number().int().positive(),
    stepUsdCents: z.number().int().positive(),
    expires: z.literal(false),
    increasesStorage: z.literal(false),
    quotes: z.array(z.object({
      amountUsdCents: z.number().int().positive(),
      credits: z.number().int().positive(),
      effectiveUsdPerCredit: z.string().regex(/^\d+(?:\.\d+)?$/),
      volumeRateImprovementBps: z.number().int().min(0).max(10_000),
      planRateImprovementBpsFromFree: z.number().int().min(0).max(10_000),
      pricingPlanCode: BillingPlanCodeSchema,
      pricingRecurringOptionCode: z.string().nullable(),
    })),
  }),
}).openapi('BillingCatalogResponse')

/** Constant-time organization billing and quota summary. */
export const BillingAccountResponseSchema = z.object({
  catalogRevision: z.string(),
  plan: z.object({
    code: BillingPlanCodeSchema,
    founder: z.boolean(),
    recurringOptionCode: z.string().nullable(),
    scheduledPlanCode: BillingPlanCodeSchema.nullable(),
    scheduledRecurringOptionCode: z.string().nullable(),
    scheduledBillingInterval: z.enum(['month', 'year']).nullable(),
    scheduledEffectiveAt: NullableTimestampSchema,
    offerCode: z.string().nullable(),
    billingInterval: z.enum(['month', 'year']).nullable(),
    monthlyCreditAllowance: z.number().int().nonnegative(),
    status: z.enum([
      'free',
      'active',
      'past_due',
      'canceling',
      'blocked_review',
    ]),
    paidThrough: NullableTimestampSchema,
    cancelAtPeriodEnd: z.boolean(),
    nextGrantAt: NullableTimestampSchema,
  }),
  credits: z.object({
    available: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
  }),
  storage: z.object({
    usedBytes: z.number().int().nonnegative(),
    reservedBytes: z.number().int().nonnegative(),
    limitBytes: z.number().int().nonnegative(),
    remainingBytes: z.number().int().nonnegative(),
    state: z.enum(['within_limit', 'at_limit', 'over_limit']),
  }),
  entitlements: z.object({
    browserByok: z.boolean(),
    managedExecutionStatus: z.enum([
      'active',
      'past_due',
      'blocked_review',
    ]),
  }),
  permissions: z.object({
    canManageBilling: z.boolean(),
  }),
  updatedAt: TimestampSchema,
}).openapi('BillingAccountResponse')

/** Optional month selection for the bounded Usage destination. */
export const BillingUsageQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/).optional(),
})

/** Recent data-bearing months available to the Usage month selector. */
export const BillingUsageMonthsResponseSchema = z.object({
  items: z.array(
    z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
  ).min(1).max(120),
}).openapi('BillingUsageMonthsResponse')

/** Bounded organization content and monthly generation usage. */
export const BillingUsageResponseSchema = z.object({
  period: z.object({
    month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    startsAt: TimestampSchema,
    endsAt: TimestampSchema,
  }),
  content: z.object({
    projects: z.object({
      count: z.number().int().nonnegative(),
      assetCount: z.number().int().nonnegative(),
    }),
    assets: z.object({
      count: z.number().int().nonnegative(),
      usedBytes: z.number().int().nonnegative(),
      byMediaType: z.array(z.object({
        mediaType: z.enum(['image', 'video', 'audio', 'document']),
        count: z.number().int().nonnegative(),
        usedBytes: z.number().int().nonnegative(),
      })),
    }),
    elements: z.object({
      count: z.number().int().nonnegative(),
      referenceCount: z.number().int().nonnegative(),
    }),
  }),
  generation: z.object({
    runCount: z.number().int().nonnegative(),
    successfulOutputCount: z.number().int().nonnegative(),
    outputsByMediaType: z.object({
      image: z.number().int().nonnegative(),
      video: z.number().int().nonnegative(),
      audio: z.number().int().nonnegative(),
      text: z.number().int().nonnegative(),
    }),
    capturedCredits: z.number().int().nonnegative(),
    releasedCredits: z.number().int().nonnegative(),
  }),
  updatedAt: TimestampSchema,
}).openapi('BillingUsageResponse')

/** Cursor request for visible run history in one bounded Usage month. */
export const BillingUsageRunsQuerySchema = BillingUsageQuerySchema.extend({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Compact generation run shown in the selected-month Usage table. */
export const BillingUsageRunSchema = z.object({
  id: Cuid2Schema,
  completedAt: NullableTimestampSchema,
  createdAt: TimestampSchema,
  creditCost: z.number().int().nonnegative().nullable(),
  creditQuoted: z.number().int().nonnegative().nullable(),
  fundingSource: FlowRunFundingSourceSchema,
  mediaTypes: z.array(GenerationJobMediaTypeSchema).max(4),
  mode: RunModeSchema,
  outputCount: z.number().int().nonnegative(),
  source: RunSourceSchema,
  sourceName: z.string().nullable(),
  status: FlowRunStatusSchema,
}).openapi('BillingUsageRun')

/** Cursor page of Flow runs and creator-visible private Create runs. */
export const BillingUsageRunsResponseSchema = z.object({
  items: z.array(BillingUsageRunSchema),
  nextCursor: NullableCursorSchema,
}).openapi('BillingUsageRunsResponse')

/** Selected-month cursor page request for the append-only credit ledger. */
export const BillingLedgerQuerySchema = BillingUsageQuerySchema.extend({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

/** Owner/admin append-only credit transaction history page. */
export const BillingLedgerResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    entryType: z.enum([
      'grant',
      'reserve',
      'capture',
      'release',
      'reverse',
      'adjustment',
    ]),
    availableDelta: z.number().int(),
    reservedDelta: z.number().int(),
    reasonCode: z.string(),
    createdAt: TimestampSchema,
  })),
  nextCursor: NullableCursorSchema,
}).openapi('BillingLedgerResponse')

/** Subscription Checkout request resolved exclusively against the catalog. */
export const BillingCheckoutRequestSchema = z.object({
  planCode: z.enum(['creator', 'pro']),
  recurringOptionCode: z.string().min(1).max(100),
  billingInterval: z.enum(['month', 'year']),
  catalogRevision: z.string().min(1).max(100),
})

/** Top-up Checkout request resolved against the active entitlement. */
export const BillingTopUpCheckoutRequestSchema = z.object({
  amountUsdCents: z.number().int().positive(),
})

/** Paid plan, recurring allowance, and cadence selected for review. */
export const BillingSubscriptionChangeRequestSchema = z.object({
  planCode: z.enum(['creator', 'pro']),
  recurringOptionCode: z.string().min(1).max(100),
  billingInterval: z.enum(['month', 'year']),
  catalogRevision: z.string().min(1).max(100),
})

/** Confirmed paid change carrying the fixed preview proration instant. */
export const BillingSubscriptionUpdateRequestSchema
  = BillingSubscriptionChangeRequestSchema.extend({
    prorationDate: TimestampSchema.optional(),
  })

/** Exact server and Stripe preview shown before a paid change is confirmed. */
export const BillingSubscriptionChangePreviewResponseSchema = z.object({
  amountDueNowMinor: z.number().int().nonnegative(),
  billingInterval: z.enum(['month', 'year']),
  creditsAddedNow: z.number().int().nonnegative(),
  effectiveAt: TimestampSchema,
  mode: z.enum(['immediate', 'renewal']),
  nextRenewalAt: NullableTimestampSchema,
  planCode: z.enum(['creator', 'pro']),
  prorationDate: NullableTimestampSchema,
  recurringOptionCode: z.string(),
  storageBytes: z.number().int().nonnegative(),
  targetMonthlyCredits: z.number().int().positive(),
  targetPriceUsdCents: z.number().int().positive(),
}).openapi('BillingSubscriptionChangePreviewResponse')

/** Result of applying or scheduling one reviewed paid change. */
export const BillingSubscriptionUpdateResponseSchema = z.object({
  account: BillingAccountResponseSchema,
  creditsAdded: z.number().int().nonnegative(),
  paymentUrl: z.string().url().nullable(),
  status: z.enum(['applied', 'payment_required', 'scheduled']),
}).openapi('BillingSubscriptionUpdateResponse')

/** Idempotent result of releasing one future subscription change. */
export const BillingSubscriptionScheduleCancelResponseSchema = z.object({
  account: BillingAccountResponseSchema,
  canceled: z.boolean(),
}).openapi('BillingSubscriptionScheduleCancelResponse')

/** Stripe-hosted short-lived redirect URL. */
export const BillingHostedUrlResponseSchema = z.object({
  url: z.string().url(),
}).openapi('BillingHostedUrlResponse')

/** Signed Stripe webhook receipt response. */
export const StripeWebhookReceiptResponseSchema = z.object({
  received: z.literal(true),
}).openapi('StripeWebhookReceiptResponse')
