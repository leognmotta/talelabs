# TaleLabs Billing And Credits Technical Plan

**Status:** approved technical plan. Implementation has not started.

**Approved commercial model:** 2026-07-27.

This document is the binding source of truth for TaleLabs plans, subscription
credits, Stripe Billing, credit accounting, storage entitlements, and managed
generation charging. It supersedes `docs/pricing-formula.md`.

Companion documents:

```txt
docs/talelabs-product-vision.md
docs/db-design-planning-v2.md
docs/api-design-planning-v2.md
docs/provider-execution-modes.md
docs/observability-planning.md
```

## 1. Goal

TaleLabs must be able to:

1. sell monthly and annual subscriptions through Stripe;
2. grant the subscribed credit allowance every month;
3. quote a managed generation in integer credits before execution;
4. reserve enough credits atomically before provider submission;
5. capture credits only for usable outputs and release the rest;
6. preserve browser BYOK without charging TaleLabs credits;
7. enforce storage and managed-execution entitlements by organization;
8. explain every balance and charge from an append-only ledger;
9. measure actual provider cost and realized contribution margin;
10. sell non-expiring credit top-ups to every plan, including Free;
11. change plans, prices, allowances, and margin policy through a reviewed PR.

The result is one commercial path:

```txt
code-owned billing catalog
-> Stripe subscription or top-up Checkout
-> monthly subscription or one-time purchased credit grant
-> managed generation quote
-> atomic credit reservation
-> durable provider execution
-> usable Asset
-> credit capture and actual-cost reconciliation
```

Stripe is the payment authority. TaleLabs is the credit, entitlement, and
generation-settlement authority.

## 2. Approved Launch Offering

All launch prices are in USD. Credits are whole integers.

| Customer label | Plan code                        | Billing | Customer price |            Credits granted monthly | Storage | Managed generation                       | Browser BYOK |
| -------------- | -------------------------------- | ------- | -------------: | ---------------------------------: | ------: | ---------------------------------------- | ------------ |
| Free           | `free` + optional Founder status | none    |             $0 | 0 recurring; Founder gets 150 once |  100 MB | purchased credits; Founder welcome grant | yes          |
| Creator        | `creator`                        | monthly |      $18/month |                              1,350 |   10 GB | yes                                      | yes          |
| Creator        | `creator`                        | annual  |      $168/year |                   1,350 each month |   10 GB | yes                                      | yes          |
| Pro            | `pro`                            | monthly |      $49/month |                              4,400 |   50 GB | yes                                      | yes          |
| Pro            | `pro`                            | annual  |      $468/year |                   4,400 each month |   50 GB | yes                                      | yes          |

Annual subscriptions are paid up front, but credits are released monthly. An
annual purchase must not grant twelve months of credits immediately.

Pro keeps `$49 / 4,400` as its default entry offer. Customers who need more
managed generation may select a larger recurring Pro credit allowance without
changing plans or storage entitlements:

| Pro option | Monthly price | Monthly credits | Annual price | Credits released monthly on annual |
| ---------: | ------------: | --------------: | -----------: | ----------------------------------: |
|       Base |           $49 |           4,400 |         $468 |                               4,400 |
|          2 |           $99 |           9,000 |         $950 |                               9,000 |
|          3 |          $149 |          13,700 |       $1,430 |                              13,700 |
|          4 |          $249 |          23,500 |       $2,390 |                              23,500 |
|          5 |          $390 |          38,300 |       $3,744 |                              38,300 |
|          6 |          $590 |          60,000 |       $5,640 |                              60,000 |

The UI presents these reviewed points as a snapping slider, not as arbitrary
quantity billing. The base monthly prices remain `$18` for Creator and `$49`
for Pro. Increasing Pro changes only the recurring price and monthly credit
grant; all Pro options retain the same Pro feature and storage entitlements.
For the first release, a size change takes effect at the next renewal. Immediate
extra demand uses a top-up, avoiding prorated credit-grant logic.

The underlying Free plan provides browser BYOK and 100 MB without recurring
managed credits. Founder is an early-user status layered onto Free, not a
separate renewable subscription. It assigns the 150-credit welcome grant once.
This avoids inventing a second free-plan architecture when the Founder signup
window closes.

Every plan, including Free, may buy non-expiring managed-generation credit
top-ups. Top-ups do not increase storage or other plan entitlements.
Subscription credits remain a better value than top-up credits.

The first release does not include:

```txt
coupon stacking
metered overage billing
managed BYOK
seat-based pricing
multiple currencies
automatic plan switching
automatic tax calculation
```

Those additions must extend the same ledger and catalog rather than introduce a
second billing system.

## 3. Approved Economics

### 3.1 Credit pricing rule

Managed generation uses the exact selected provider binding, model, operation,
settings, output count, and current provider rates.

```txt
landedProviderCostUsd =
  rawProviderCostUsd
  * providerPurchaseFeeMultiplier
  * contingencyMultiplier

creditCharge =
  max(1, ceil(landedProviderCostUsd / 0.0045))
```

Launch adjustments:

| Provider   | Purchase fee multiplier | Contingency multiplier |
| ---------- | ----------------------: | ---------------------: |
| OpenRouter |                   1.055 |                   1.05 |
| fal.ai     |                   1.000 |                   1.05 |

`$0.0045` is the maximum modeled provider-cost allowance represented by one
credit. It is not a claim that provider cost is exactly 45% of revenue for every
offer. Annual Pro has a lower effective revenue per credit than monthly Creator;
the complete plan economics determine whether an offer remains above the margin
floor.

Use exact decimal arithmetic. JavaScript floating-point arithmetic must not
determine credits, money, balances, taxes, or margins.

### 3.2 Full-use contribution model

Every current paid offer must retain at least 20% modeled full-use contribution
after the following conservative assumptions:

```txt
Brazil gross-revenue tax reserve       11.0% of gross revenue
payment, international, and FX reserve  7.5% of gross revenue + $0.10
billing and refund-risk reserve          1.5% of gross revenue
runtime and processing reserve           1.0% of gross revenue
Creator storage allowance               $0.18/month
Pro storage allowance                    $0.90/month
fixed infrastructure allocation         $1.50/paid organization/month
provider cost ceiling                    credits * $0.0045
```

The 11% tax applies to gross revenue, not profit.

For annual offers, the validator compares monthly-equivalent revenue with one
monthly credit grant. It deliberately applies the `$0.10` payment reserve every
monthly equivalent even though Stripe normally charges the annual payment once.
This is conservative.

| Offer           | Monthly-equivalent revenue | Max provider cost | Modeled retained contribution | Modeled margin |
| --------------- | -------------------------: | ----------------: | ----------------------------: | -------------: |
| Creator monthly |                        $18 |            $6.075 |                        $6.365 |          35.4% |
| Creator annual  |                        $14 |            $6.075 |                        $3.205 |          22.9% |
| Pro monthly     |                        $49 |           $19.800 |                       $16.410 |          33.5% |
| Pro annual      |                        $39 |           $19.800 |                        $8.510 |          21.8% |
| Pro 9,000 monthly |                      $99 |           $40.500 |                       $35.210 |          35.6% |
| Pro 9,000 annual  |                  $79.167 |           $40.500 |                       $19.542 |          24.7% |
| Pro 13,700 monthly |                    $149 |           $61.650 |                       $53.560 |          35.9% |
| Pro 13,700 annual  |                $119.167 |           $61.650 |                       $29.992 |          25.2% |
| Pro 23,500 monthly |                    $249 |          $105.750 |                       $88.460 |          35.5% |
| Pro 23,500 annual  |                $199.167 |          $105.750 |                       $49.092 |          24.6% |
| Pro 38,300 monthly |                    $390 |          $172.350 |                      $133.250 |          34.2% |
| Pro 38,300 annual  |                    $312 |          $172.350 |                       $71.630 |          23.0% |
| Pro 60,000 monthly |                    $590 |          $270.000 |                      $193.600 |          32.8% |
| Pro 60,000 annual  |                    $470 |          $270.000 |                       $98.800 |          21.0% |

These are contribution estimates, not accounting net profit. Salaries,
acquisition, support, legal, accounting, fraud beyond the reserve, and other
company overhead remain outside this table.

### 3.3 Required Seedance 2.0 4K guard

The catalog validator must include the expensive scenario explicitly requested
for launch:

```txt
Seedance 2.0
8 seconds
16:9
4K
one output
```

Current researched examples:

| Route      | Raw estimate | Landed estimate | Credit quote |
| ---------- | -----------: | --------------: | -----------: |
| OpenRouter |     $10.8864 |     $12.0594096 |        2,680 |
| fal.ai     |     $12.4416 |       $13.06368 |        2,904 |

The runtime still uses current provider facts rather than these documentation
numbers. The examples are permanent regression fixtures that prevent a future
catalog change from silently making the approved plans loss-making.

### 3.4 Margin behavior

For Credits-funded execution:

1. select a compatible binding using current managed-provider policy;
2. calculate exact raw provider cost;
3. apply the provider-specific landed-cost policy;
4. reject a binding whose quote cannot be computed;
5. prefer the lowest safe landed cost, using explicit catalog priority only as
   a deterministic tie-breaker;
6. quote and reserve the resulting integer credits.

If actual provider cost exceeds the admission quote, TaleLabs absorbs the
difference. Never surprise-charge the customer after execution.

If a provider charges TaleLabs but no usable output reaches the customer,
release the customer's credits and record the provider expense as margin loss.

### 3.5 Credit top-up slider

Every plan, including Free, may purchase a code-owned top-up. The purchase
range and volume curve are shared, while the organization's current plan
controls how many credits the same payment receives. This makes Pro the best
top-up value and gives high-volume customers a reason to keep a subscription.
Purchased credits:

```txt
do not expire
create private, non-showcase outputs
do not increase storage or unlock plan features
remain spendable if a subscription later ends
```

The initial slider accepts `$10` through `$590` in `$5` increments. Larger
purchases receive a better volume rate. The maximum volume-rate improvement is
38% relative to the same plan's `$10` point. A separate plan factor applies
after the volume curve:

| Plan    | Credit factor | Effective relationship at the same purchase amount |
| ------- | ------------: | -------------------------------------------------- |
| Free    |         5,000 bps | retail top-up rate                              |
| Creator |         7,500 bps | 50% more credits than Free                      |
| Pro     |        10,000 bps | twice Free credits and 33.3% more than Creator  |

The UI must show volume savings and plan membership value as separate concepts.
It must not combine them into a misleading crossed-out retail discount.

For each valid `amountUsdCents`, use exact integer arithmetic:

```txt
volumeRateImprovementBps =
  linearInterpolation(
    amountUsdCents,
    minAmountUsdCents,
    maxAmountUsdCents,
    0,
    maxVolumeRateImprovementBps
  )

proReferenceCredits =
  floor(
    amountUsdCents
    * proReferenceCreditsAtMinimumAmount
    * 10_000
    / minAmountUsdCents
    / (10_000 - volumeRateImprovementBps)
  )

topUpCredits =
  floor(proReferenceCredits * planCreditFactorBps / 10_000)
```

Launch constants:

```txt
minAmountUsdCents                    1_000
maxAmountUsdCents                   59_000
stepUsdCents                           500
proReferenceCreditsAtMinimumAmount     622
maxVolumeRateImprovementBps           3_800
planCreditFactorBps.free              5_000
planCreditFactorBps.creator           7_500
planCreditFactorBps.pro              10_000
paymentFixedUsdCents                     10
platformAllocationUsdCents              150
```

The validator applies the same gross tax, payment/FX, billing risk, runtime,
provider-cost ceiling, fixed payment fee, and `$1.50` per-purchase platform
allocation used by the approved contribution model. It must prove every
generated amount and plan combination remains above the 20% contribution floor.

At the maximum point, Pro is approximately `$0.00997` per credit. This remains
slightly worse than the largest recurring Pro monthly option at approximately
`$0.00983` per credit, while annual Pro remains the best approved value at
approximately `$0.00783` per credit.

Representative plan-relative points:

| Purchase | Volume improvement | Free credits | Creator credits | Pro credits |
| -------: | -----------------: | -----------: | --------------: | ----------: |
|      $10 |                 0% |          311 |             466 |         622 |
|     $100 |              5.89% |        3,304 |           4,956 |       6,609 |
|     $250 |             15.72% |        9,225 |          13,837 |      18,450 |
|     $590 |                38% |       29,595 |          44,392 |      59,190 |

The API returns the exact purchase amount, plan-specific credits, volume-rate
improvement, and plan-rate benefit computed by the catalog. The server
independently recomputes the selected slider point and current organization plan
before creating Checkout.

## 4. Code-Owned Billing Catalog

### 4.1 Ownership

Create a provider-neutral `@talelabs/billing` package. It owns commercial policy
and exact arithmetic. It must not import Stripe, provider HTTP clients, Hono,
React, PostgreSQL, or Trigger.dev.

`@talelabs/stripe` remains the small server-only Stripe SDK boundary. Stripe
Product and Price identifiers do not belong in environment variables.

Suggested cohesive structure:

```txt
packages/billing/
  AGENTS.md
  package.json
  src/
    catalog.ts
    contracts.ts
    credit-quote.ts
    economics.ts
    top-ups.ts
    public-catalog.ts
    index.ts
  scripts/
    check-billing-catalog.ts
```

This is an ownership map, not a requirement to create empty wrappers. Combine
files when one cohesive module is easier to read; split only when responsibilities
actually diverge.

### 4.2 Catalog shape

The TypeScript catalog is the maintained source of truth:

```ts
export const BILLING_CATALOG = defineBillingCatalog({
  revision: "2026-07-27.2",
  currency: "usd",
  creditPolicy: {
    providerCostAllowanceUsdPerCredit: "0.0045",
    minimumFullUseContributionMarginBps: 2_000,
    landedCostByProvider: {
      openrouter: {
        purchaseFeeMultiplier: "1.055",
        contingencyMultiplier: "1.05",
      },
      fal: {
        purchaseFeeMultiplier: "1",
        contingencyMultiplier: "1.05",
      },
    },
  },
  contributionModel: {
    grossRevenueTaxBps: 1_100,
    paymentAndFxReserveBps: 750,
    paymentFixedUsdCents: 10,
    billingAndRefundRiskBps: 150,
    runtimeReserveBps: 100,
    fixedInfrastructureUsdCentsPerPaidOrganizationMonth: 150,
    monthlyStorageAllocationUsdCents: {
      creator: 18,
      pro: 90,
    },
  },
  programs: {
    founder: {
      underlyingPlanCode: "free",
      oneTimeCredits: 150,
      outputVisibility: "public",
      showcaseEligible: true,
    },
  },
  topUps: {
    enabledPlanCodes: ["free", "creator", "pro"],
    minAmountUsdCents: 1_000,
    maxAmountUsdCents: 59_000,
    stepUsdCents: 500,
    proReferenceCreditsAtMinimumAmount: 622,
    maxVolumeRateImprovementBps: 3_800,
    planCreditFactorBps: {
      free: 5_000,
      creator: 7_500,
      pro: 10_000,
    },
    platformAllocationUsdCents: 150,
    outputVisibility: "private",
    showcaseEligible: false,
    expires: false,
  },
  plans: {
    free: {
      storageBytes: 100 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: null,
      currentRecurringOptions: [],
      historicalOffers: [],
    },
    creator: {
      storageBytes: 10 * 1024 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: "creator-1350",
      currentRecurringOptions: [
        {
          code: "creator-1350",
          monthlyCredits: 1_350,
          month: {
            offerCode: "creator-monthly-2026-07",
            priceUsdCents: 1_800,
            stripeLookupKey: "talelabs_creator_monthly_2026_07",
          },
          year: {
            offerCode: "creator-annual-2026-07",
            priceUsdCents: 16_800,
            stripeLookupKey: "talelabs_creator_annual_2026_07",
          },
        },
      ],
      historicalOffers: [],
    },
    pro: {
      storageBytes: 50 * 1024 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: "pro-4400",
      currentRecurringOptions: [
        {
          code: "pro-4400",
          monthlyCredits: 4_400,
          month: {
            offerCode: "pro-monthly-4400-2026-07",
            priceUsdCents: 4_900,
            stripeLookupKey: "talelabs_pro_monthly_4400_2026_07",
          },
          year: {
            offerCode: "pro-annual-4400-2026-07",
            priceUsdCents: 46_800,
            stripeLookupKey: "talelabs_pro_annual_4400_2026_07",
          },
        },
        {
          code: "pro-9000",
          monthlyCredits: 9_000,
          month: {
            offerCode: "pro-monthly-9000-2026-07",
            priceUsdCents: 9_900,
            stripeLookupKey: "talelabs_pro_monthly_9000_2026_07",
          },
          year: {
            offerCode: "pro-annual-9000-2026-07",
            priceUsdCents: 95_000,
            stripeLookupKey: "talelabs_pro_annual_9000_2026_07",
          },
        },
        {
          code: "pro-13700",
          monthlyCredits: 13_700,
          month: {
            offerCode: "pro-monthly-13700-2026-07",
            priceUsdCents: 14_900,
            stripeLookupKey: "talelabs_pro_monthly_13700_2026_07",
          },
          year: {
            offerCode: "pro-annual-13700-2026-07",
            priceUsdCents: 143_000,
            stripeLookupKey: "talelabs_pro_annual_13700_2026_07",
          },
        },
        {
          code: "pro-23500",
          monthlyCredits: 23_500,
          month: {
            offerCode: "pro-monthly-23500-2026-07",
            priceUsdCents: 24_900,
            stripeLookupKey: "talelabs_pro_monthly_23500_2026_07",
          },
          year: {
            offerCode: "pro-annual-23500-2026-07",
            priceUsdCents: 239_000,
            stripeLookupKey: "talelabs_pro_annual_23500_2026_07",
          },
        },
        {
          code: "pro-38300",
          monthlyCredits: 38_300,
          month: {
            offerCode: "pro-monthly-38300-2026-07",
            priceUsdCents: 39_000,
            stripeLookupKey: "talelabs_pro_monthly_38300_2026_07",
          },
          year: {
            offerCode: "pro-annual-38300-2026-07",
            priceUsdCents: 374_400,
            stripeLookupKey: "talelabs_pro_annual_38300_2026_07",
          },
        },
        {
          code: "pro-60000",
          monthlyCredits: 60_000,
          month: {
            offerCode: "pro-monthly-60000-2026-07",
            priceUsdCents: 59_000,
            stripeLookupKey: "talelabs_pro_monthly_60000_2026_07",
          },
          year: {
            offerCode: "pro-annual-60000-2026-07",
            priceUsdCents: 564_000,
            stripeLookupKey: "talelabs_pro_annual_60000_2026_07",
          },
        },
      ],
      historicalOffers: [],
    },
  },
});
```

The final implementation may refine names, but it must preserve:

```txt
catalog revision
immutable plan and offer codes
current and historical offers
integer USD cents
integer basis points
decimal-string provider economics
tax, payment, risk, runtime, storage, and infrastructure assumptions
monthly grant amount on each recurring option
top-up range, step, volume curve, plan factors, and platform allocation
storage bytes
funding-source output visibility
stable Stripe lookup keys
sanitized public projection
```

Founder eligibility and its 150-credit welcome grant are a separate code-owned
program policy attached to `free`; they are not encoded as a recurring offer.

Internal economics, Stripe lookup keys, eligibility policy, and historical
commercial metadata are server-only. The dashboard and marketing site consume
the sanitized public catalog.

### 4.3 Changing plans through a PR

Stripe Prices are immutable commercial records. A price change must not mutate
an existing offer.

The release process is:

1. bump the billing catalog revision;
2. add a new immutable offer code and versioned Stripe lookup key;
3. retain every historical offer still referenced by a subscription;
4. mark the new offer as current for new purchases;
5. run `billing:check`;
6. run the Stripe sync command in dry-run mode;
7. during deployment, create or verify the Stripe Product and Price before the
   application version becomes active;
8. deploy only if Stripe and code agree exactly.

The Stripe synchronization command must:

```txt
default to dry-run
require an explicit --apply to mutate Stripe
be idempotent
create missing immutable Prices
reject amount, currency, interval, metadata, or lookup-key drift
never deactivate a Price still used by an active subscription
never write Price IDs into source code or environment variables
```

It also creates or verifies one stable TaleLabs Credits Product used by inline
top-up Price data. Slider points do not create or synchronize 49 long-lived
Stripe Prices.

Every Stripe Product, Price, Checkout Session, and Subscription carries
`planCode`, `recurringOptionCode`, `offerCode`, and `catalogRevision` metadata
when applicable. Webhook handling still verifies the Stripe
customer/subscription relationship in TaleLabs; metadata is not authorization.

### 4.4 Catalog validation

`npm run billing:check` must fail on:

```txt
duplicate plan, offer, or lookup-key identities
missing historical offer references
invalid monthly or annual intervals
non-integer cents, credits, bytes, or basis points
floating-point financial configuration
annual credits granted up front
an active offer below the 20% full-use contribution floor
a top-up slider point below the 20% contribution floor
non-monotonic top-up credits or effective rates
a top-up rate better than the best active subscription credit rate
an invalid top-up range or amount step
an unsupported funding or visibility policy
an unpriced current offer
Seedance 2.0 4K regression drift
```

The production build and API startup run the same fail-closed validator.

## 5. Persistence Model

All billing state is organization-scoped. Financial truth must never live only
in a cache, process-local `Map`, Stripe dashboard view, or Trigger.dev run.

### 5.1 Billing accounts

`organizationBillingAccounts` is the local entitlement projection:

```txt
organizationId                  primary key
stripeCustomerId                nullable, unique when present
currentPlanCode                 free | creator | pro
currentOfferCode                nullable for Free
catalogRevision
managedExecutionStatus          active | past_due | blocked_review
managedExecutionReason          nullable stable code
founderEligibleAt               nullable
founderAssignedBy               nullable user
paidThrough                     nullable
revision
createdAt
updatedAt
```

Founder assignment is an explicit admin operation. It is not inferred from
email, signup time, or mutable UI state.

### 5.2 Subscriptions, top-up purchases, and payments

`billingSubscriptions` stores the local Stripe subscription projection:

```txt
id
organizationId
stripeCustomerId
stripeSubscriptionId            unique
planCode
offerCode
catalogRevision
status
billingInterval
currentPeriodStart
currentPeriodEnd
paidThrough
cancelAtPeriodEnd
scheduledPlanCode               nullable future seam
scheduledOfferCode              nullable future seam
createdAt
updatedAt
```

A partial unique constraint permits at most one current subscription per
organization.

`creditPurchases` is the durable order and quoted-credit authority for one
top-up:

```txt
id
organizationId
planCode                        plan at purchase quotation
status                          pending | paid | failed | expired | refunded | disputed
amountMinor
currency
credits
catalogRevision
pricingPolicyVersion
volumeRateImprovementBps
planCreditFactorBps
modeledContributionMarginBps
stripeCustomerId
stripeCheckoutSessionId         nullable, unique when present
stripePaymentIntentId           nullable, unique when present
creditGrantId                   nullable, unique when present
idempotencyKey
paidAt                          nullable
createdAt
updatedAt
```

Create this row before requesting Stripe Checkout. The amount, credits, catalog
revision, and economics evidence are immutable after creation. A browser cannot
choose or submit its own credit amount.

`billingPayments` stores minimal durable revenue facts:

```txt
id
organizationId
paymentKind                     subscription | credit_topup
billingSubscriptionId           nullable
creditPurchaseId                nullable
stripeInvoiceId                 nullable, unique when present
stripeCheckoutSessionId         nullable, unique when present
stripePaymentIntentId           nullable, unique when present
amountPaidMinor
currency
stripeBalanceTransactionId      nullable
settlementGrossMinor            nullable
settlementFeeMinor              nullable
settlementNetMinor              nullable
settlementCurrency              nullable
settlementExchangeRate          nullable exact decimal
status
servicePeriodStart              nullable for top-up
servicePeriodEnd                nullable for top-up
paidAt
createdAt
updatedAt
```

A database check enforces the payment shape:

```txt
subscription -> billingSubscriptionId and stripeInvoiceId are present
credit_topup -> creditPurchaseId and stripeCheckoutSessionId are present
exactly one subscription or purchase owner is present
```

Do not infer payment from `customer.subscription.status` alone. `invoice.paid`
extends `paidThrough` and authorizes future monthly grants.

Stripe balance-transaction facts let realized reporting replace the conservative
payment-fee reserve with the actual fee, FX, and settlement amount.

### 5.3 Stripe webhook inbox

`stripeWebhookEvents` is a durable idempotency inbox:

```txt
stripeEventId                   primary key
eventType
stripeObjectId                  nullable
processingStatus                pending | processing | succeeded | failed
attemptCount
lastErrorCode                   nullable
receivedAt
processedAt                     nullable
updatedAt
```

Store only the minimum safe event metadata. The asynchronous processor retrieves
the Stripe event and current Stripe objects by ID. Do not log or persist
sensitive payment payloads by default.

### 5.4 Credit grants

`creditGrants` identifies where credits came from:

```txt
id
organizationId
source                          founder_welcome | subscription | purchase | manual
originalCredits
availableCredits
reservedCredits
capturedCredits
reversedCredits
grantPeriodStart                nullable
grantPeriodEnd                  nullable
expiresAt                       nullable; launch grants do not expire
planCode                        nullable
offerCode                       nullable
catalogRevision
stripeSubscriptionId            nullable
stripeInvoiceId                 nullable
creditPurchaseId                nullable
recognizedRevenueUsdCents       nullable
outputVisibility                private | public
showcaseEligible                boolean
idempotencyKey
createdBy                       nullable
createdAt
```

Unique organization-scoped idempotency keys prevent duplicate Founder,
subscription-period, purchase, or support grants.

An annual invoice allocates its paid USD revenue across its twelve monthly
grants. Store that recognized amount on each grant so captured credits can be
compared with the revenue that funded them.

A purchased grant recognizes the exact successfully paid top-up amount and
links it to `creditPurchaseId`.

When an annual amount does not divide evenly into twelve minor-unit amounts,
allocate the remainder deterministically to the earliest grant periods. The
twelve recognized amounts must sum exactly to the paid invoice amount.

Grant visibility policy is immutable. Founder welcome grants are `public` and
showcase-eligible. Subscription and purchased grants are `private` and not
showcase-eligible. Manual grants default to private unless the admin action
explicitly selects another reviewed policy.

### 5.5 Materialized balance

`creditBalances` provides O(1) admission reads:

```txt
organizationId                  primary key
availableCredits
reservedCredits
version
updatedAt
```

It is a transactionally maintained projection of the ledger, not an independent
source of truth.

### 5.6 Reservations

`creditReservations` is one run-level hold:

```txt
id
organizationId
flowRunId                       unique
status                          reserved | partial | captured | released
quotedCredits
reservedCredits
capturedCredits
releasedCredits
pricingPolicyVersion
createdAt
closedAt                        nullable
```

`creditReservationItems` binds the quote to each generation job:

```txt
id
organizationId
creditReservationId
generationJobId                 unique
quotedCredits
capturedCredits
releasedCredits
outputVisibility
showcaseEligible
status
```

`creditReservationAllocations` maps each item to one or more grant buckets:

```txt
organizationId
creditReservationItemId
creditGrantId
reservedCredits
capturedCredits
releasedCredits
sortOrder
```

Allocations consume private paid grants before public promotional grants, then
use deterministic `createdAt, id` order within the same funding priority. This
ensures a Free customer who buys credits receives private outputs while paid
credits remain available, rather than unexpectedly spending an older public
Founder grant first. Even while credits do not expire, deterministic allocation
preserves attribution, refund correctness, and a future expiry seam.

### 5.7 Append-only ledger

`creditLedgerEntries` is the accounting authority:

```txt
id
organizationId
entryType                       grant | reserve | capture | release | reverse | adjustment
availableDelta
reservedDelta
creditGrantId                   nullable
creditReservationId             nullable
creditReservationItemId         nullable
flowRunId                       nullable
generationJobId                 nullable
stripeInvoiceId                 nullable
creditPurchaseId                nullable
idempotencyKey
reasonCode
createdBy                       nullable
createdAt
```

Entry effects:

| Entry                | Available delta | Reserved delta |
| -------------------- | --------------: | -------------: |
| grant                |      `+credits` |            `0` |
| reserve              |      `-credits` |     `+credits` |
| capture              |             `0` |     `-credits` |
| release              |      `+credits` |     `-credits` |
| reverse unused grant |      `-credits` |            `0` |

Ledger rows are never updated or deleted. Corrections append compensating
entries.

### 5.8 Existing run tables

Extend existing persistence rather than creating a billing-specific run:

```txt
flowRuns.fundingSource              credits | byok
flowRuns.creditReservationId        nullable
flowRuns.creditQuoted               nullable
flowRuns.creditCost                 captured total

generationJobs.creditQuoted         nullable immutable admission quote
generationJobs.creditPricingVersion nullable
generationJobs.creditSettlement     not_applicable | reserved | captured | released
generationJobs.creditCost           captured amount
```

The immutable run snapshot and each job retain the selected provider binding,
provider estimate, landed-cost inputs, pricing policy version, and quoted
credits. Later catalog changes never rewrite a historical run.

### 5.9 Database invariants

PostgreSQL must enforce:

```txt
nonnegative available and reserved balances
nonnegative grant and reservation components
grant components sum to original credits
reservation components sum to quoted credits
ledger deltas reconcile to the materialized balance
at most one Founder welcome grant per organization
at most one subscription grant per subscription period
at most one reservation per run
at most one settlement item per generation job
at most one Stripe webhook row per event ID
at most one payment row per Stripe invoice
at most one payment and one purchased grant per credit purchase
unique Stripe Checkout Session and PaymentIntent identities when present
the persisted top-up amount and credits match one valid catalog slider point
one organization-scoped unique ledger idempotency key per financial transition
tenant-safe composite references for every organization-owned relation
```

No Redis or in-memory cache participates in these invariants.

Credits, storage bytes, and payment minor units use bounded integer database
types and are range-checked before conversion at TypeScript/API boundaries.
Provider cost and exchange-rate facts use exact PostgreSQL numeric values and
decimal strings in TypeScript. Floating-point values never enter financial
rows. Timestamps use `timestamptz`; monthly grant calculations use UTC.

## 6. Monthly Subscription Grants

### 6.1 Payment and grant authority

Stripe collecting an annual payment does not create twelve grants. TaleLabs
tracks a monthly internal grant schedule bounded by the paid service period.

```txt
Stripe invoice.paid
-> update local payment and subscription projection
-> extend paidThrough
-> reconcile every monthly grant period now due
```

The first grant is emitted only after confirmed payment.

### 6.2 Grant period calculation

Grant periods are anchored to the original paid subscription start in UTC.

For ordinal month `n`:

```txt
targetMonth = originalAnchorMonth + n
targetDay = min(originalAnchorDay, lastDayOf(targetMonth))
```

Calculate every month from the original anchor, not from the previous clamped
date. A January 31 subscription therefore grants on February's final day and
March 31 rather than drifting permanently to the 28th.

A grant is eligible when:

```txt
grantPeriodStart <= now
grantPeriodStart < paidThrough
```

Idempotency key:

```txt
subscription:{stripeSubscriptionId}:grant:{grantPeriodStartIso}
```

### 6.3 Scheduler and recovery

Use one code-owned Trigger.dev scheduled task, not one external schedule per
organization.

```txt
hourly scheduled task
-> select bounded pages of subscriptions with due grant periods
-> lock rows with FOR UPDATE SKIP LOCKED
-> append missing grants idempotently
-> continue within a fixed time and item budget
```

The scheduler is acceleration, not the only correctness path. Billing account
reads and managed run admission also reconcile due local grant periods before
reporting insufficient credits. This lets a customer use a paid allowance even
if a scheduled task was delayed.

### 6.4 Subscription lifecycle

| Stripe/payment state      | TaleLabs behavior                                                       |
| ------------------------- | ----------------------------------------------------------------------- |
| first invoice paid        | activate paid entitlement and emit first monthly grant                  |
| monthly renewal paid      | extend `paidThrough` and emit the next due grant                        |
| annual renewal paid       | extend `paidThrough` by the paid annual period; continue monthly grants |
| payment failed / past due | do not emit grants beyond existing `paidThrough`                        |
| cancel at period end      | preserve paid service and due grants through `paidThrough`              |
| subscription ended        | stop future grants; already granted non-expiring credits remain         |
| Pro recurring-size change | schedule the new option for the next renewal; no proration or extra grant |
| cross-plan/cadence change | deferred for the first release                                           |

Already granted credits remain spendable after a paid subscription ends. The
organization falls back to Free storage and feature entitlements at
`paidThrough`; being over the new storage limit blocks new storage but never
deletes existing Assets. Only `blocked_review`, abuse, or account security may
block spending an otherwise valid remaining balance.

Launch Customer Portal configuration supports payment methods, invoice history,
and cancellation. Pro recurring-size changes use TaleLabs' reviewed endpoint
and a Stripe Subscription Schedule with a next-period phase. Do not expose
product, cadence, or recurring-size changes through Portal, where they could
bypass the local scheduled-offer projection and monthly-grant contract.

### 6.5 Refunds and disputes

For an affected grant:

1. reverse unspent credits from that grant;
2. preserve an audit entry tied to the Stripe refund or dispute;
3. if the grant has already been consumed, do not create a hidden negative
   balance;
4. set managed execution to `blocked_review` and require an explicit support
   decision.

Browser BYOK remains available according to the organization's current plan
policy unless abuse or account security requires a broader suspension.

## 7. Stripe Integration

### 7.1 Stripe package boundary

`@talelabs/stripe` owns only:

```txt
Stripe SDK construction
the pinned Stripe API version
webhook signature verification
small Stripe-specific transport helpers
```

TaleLabs launch credits are prepaid internal usage units, not Stripe metered
usage or a customer cash balance. Do not send generation jobs to Stripe Billing
Meters or add Metronome for launch. PostgreSQL must reserve and settle credits
atomically with run admission, while Stripe remains the recurring-payment
authority. Re-evaluate external usage billing only if TaleLabs later introduces
postpaid overages, enterprise commits, or contract rating.

Plan amounts, credits, storage, eligibility, margin policy, and entitlements stay
in `@talelabs/billing`.

Allowed billing secrets:

```txt
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Use a least-privilege Stripe restricted API key for `STRIPE_SECRET_KEY` when the
required Customer, Checkout, Portal, Price, Subscription, Invoice, Event,
Refund, Dispute, and Balance Transaction operations have been verified in test
mode. Production, staging, and local development use separate credentials.

Price IDs, Product IDs, lookup keys, plan codes, limits, tax percentages, and
catalog revisions are not secrets and must not become environment variables.

### 7.2 Subscription Checkout

`POST /billing/checkout`:

1. requires an organization owner/admin;
2. accepts only `planCode`, `recurringOptionCode`, `billingInterval`,
   `catalogRevision`, and a request idempotency key;
3. resolves the exact current offer and customer price from the code catalog;
4. creates or reuses exactly one Stripe Customer mapped to the organization;
5. resolves exactly one active Stripe Price by immutable lookup key;
6. verifies that Price amount, currency, interval, credits, and metadata match
   code;
7. rejects an organization that already has a current subscription;
8. creates a Stripe Checkout Session in `subscription` mode;
9. supplies Stripe idempotency using organization, offer, and request key;
10. omits `payment_method_types` so Stripe can select supported methods;
11. includes the API-version-supported `integration_identifier`;
12. returns the Stripe-hosted Checkout URL.

Success redirects to a billing completion route that displays pending state
until the signed webhook confirms payment. The redirect is not payment proof.

### 7.3 Top-up Checkout

`POST /billing/topups/checkout` is available to Free, Creator, and Pro:

1. require an organization owner/admin;
2. accept only `amountUsdCents` and a request idempotency key from the browser;
3. validate that the amount is an exact current slider point;
4. resolve the organization's current plan and recompute credits, volume
   improvement, plan factor, modeled contribution, and catalog revision;
5. create the immutable pending `creditPurchases` row;
6. create or reuse the organization's Stripe Customer;
7. resolve the single synced TaleLabs Credits Product;
8. create a Stripe Checkout Session in `payment` mode with one inline
   `price_data.unit_amount`;
9. attach the purchase ID and catalog revision to Checkout and PaymentIntent
   metadata for correlation, never authorization;
10. use organization, purchase, amount, and request key for Stripe idempotency;
11. persist the resulting Checkout Session ID;
12. return the Stripe-hosted Checkout URL.

Inline Price data avoids maintaining one Stripe Price for every `$5` slider
step. The code-owned catalog remains the price and credit authority.

The success redirect shows `pending` until a signed webhook verifies all of:

```txt
Checkout mode is payment
payment_status is paid
Stripe Customer belongs to the organization
amount_total and currency match the purchase
purchase, catalog revision, and PaymentIntent identities match
no purchased-credit grant already exists
```

Only then may one transaction mark the purchase paid, insert the payment,
append the private non-expiring purchased grant and ledger entry, and update the
materialized balance. `checkout.session.completed` with an unpaid asynchronous
payment remains pending. `checkout.session.async_payment_succeeded` may complete
it later; `checkout.session.async_payment_failed` marks it failed.

Top-up Checkout does not require an active subscription and does not change the
organization's plan or storage limit.

### 7.4 Customer Portal

`POST /billing/portal`:

1. requires an organization owner/admin;
2. verifies the mapped Stripe Customer;
3. creates a short-lived Stripe Customer Portal session;
4. returns the Stripe-hosted Portal URL.

Do not build card collection, invoice rendering, or cancellation controls in
TaleLabs when the Stripe-hosted surface already owns them.

### 7.5 Webhook

`POST /webhooks/stripe` is unauthenticated by TaleLabs session but authenticated
by Stripe signature:

1. read the raw request body;
2. verify the `Stripe-Signature` before JSON parsing;
3. insert the event ID into the durable inbox idempotently;
4. request asynchronous processing by event ID;
5. return `2xx` quickly.

The processor retrieves the Stripe event and current Stripe resources. It must
be safe under duplicate delivery and out-of-order events.

Initial handled events:

```txt
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
charge.refunded
charge.dispute.created
charge.dispute.closed
```

Pending webhook inbox rows are also recovered by one bounded scheduled task, so
a temporary Trigger dispatch failure cannot lose a payment event.

### 7.6 Tax position

The 11% Brazilian gross-revenue tax is an economics reserve in the code-owned
margin model. It is not permission to enable Stripe Tax or a substitute for
professional tax advice.

Launch must not enable automatic tax collection until the business registration,
customer-location, invoice, and remittance requirements have been confirmed.

## 8. Billing API

Add one focused billing route group:

| Endpoint                        | Access                | Purpose                                               |
| ------------------------------- | --------------------- | ----------------------------------------------------- |
| `GET /billing/catalog`          | authenticated member  | plans, recurring options, and generated top-up points |
| `GET /billing/account`          | authenticated member  | plan, available/reserved credits, storage, next grant |
| `GET /billing/usage`            | authenticated member  | current content counts and one month of generation use |
| `GET /billing/credits/ledger`   | owner/admin           | cursor-paged organization ledger                      |
| `POST /billing/checkout`        | owner/admin           | create subscription Checkout Session                  |
| `PATCH /billing/subscription`   | owner/admin           | schedule a Pro recurring-size change at renewal       |
| `POST /billing/topups/checkout` | owner/admin           | create one-time credit top-up Checkout Session        |
| `POST /billing/portal`          | owner/admin           | open Stripe Customer Portal                           |
| `POST /webhooks/stripe`         | signed Stripe request | durable webhook inbox                                 |

The public catalog exposes stable plan codes, storage limits, BYOK availability,
default/current recurring options, monthly credit allowances, intervals, and
customer prices. It returns generated top-up options with only:

```txt
amountUsdCents
credits
effectiveUsdPerCredit             exact decimal string
volumeRateImprovementBps
planRateImprovementBpsFromFree
```

It never exposes internal reserve, tax, margin, provider-cost, or platform
allocation inputs.

### 8.1 `GET /billing/account`

This is the single organization-scoped current billing and quota summary used
by the global dashboard shell, sidebar, Billing settings, and
managed-generation UX. Do not add a second current-summary endpoint or
recompute these totals independently in each feature. The detailed,
month-selectable Usage destination uses `GET /billing/usage`; it does not
replace this hot summary.

The endpoint resolves the active organization from authenticated request
context; it never accepts an organization ID from the client. Any organization
member may read the summary. Before reading, it performs the already-defined
bounded lazy monthly-grant reconciliation, then reads the materialized billing,
credit-balance, and storage-usage projections.

```ts
type BillingAccountSummary = {
  catalogRevision: string;
  plan: {
    code: "free" | "creator" | "pro";
    founder: boolean;
    recurringOptionCode: string | null;
    scheduledRecurringOptionCode: string | null;
    scheduledEffectiveAt: string | null;
    offerCode: string | null;
    billingInterval: "month" | "year" | null;
    monthlyCreditAllowance: number;
    status: "free" | "active" | "past_due" | "canceling" | "blocked_review";
    paidThrough: string | null;
    cancelAtPeriodEnd: boolean;
    nextGrantAt: string | null;
  };
  credits: {
    available: number;
    reserved: number;
  };
  storage: {
    usedBytes: number;
    reservedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    state: "within_limit" | "at_limit" | "over_limit";
  };
  entitlements: {
    browserByok: boolean;
    managedExecutionStatus: "active" | "past_due" | "blocked_review";
  };
  updatedAt: string;
};
```

`credits.available` is the amount shown as “credits remaining.” Reservations
have already reduced that available amount; `credits.reserved` is supporting
detail, not added back into the displayed balance.

Storage admission uses `usedBytes + reservedBytes`. `remainingBytes` is clamped
to zero, while `state` preserves the distinction between exactly full and over
quota. Clients format bytes and numbers with `Intl`; they do not receive
preformatted English strings or internal Stripe IDs, provider costs, margin
policy, ledger rows, or payment details.

The hot read must be constant-time: one organization-scoped query over the
billing account/subscription projection, `creditBalances`, and
`organizationStorageUsage`, plus the in-process code-owned catalog lookup. It
must not aggregate the credit ledger or Assets table on every request.

Return `Cache-Control: private, no-store`. The dashboard keeps one
organization-keyed TanStack Query entry and invalidates it after:

```txt
organization switch
run admission, settlement, cancellation, or retry reconciliation
upload registration, generated-output ingestion, or purge completion
Founder/subscription/top-up webhook reconciliation
return from Stripe Checkout or Portal
```

While a run or upload is active, existing realtime/recovery events may refetch
the summary. A bounded background refresh may recover missed events, but the
sidebar is advisory: run and storage admission always re-check authoritative
state transactionally.

### 8.2 `GET /billing/usage`

This endpoint supplies the detailed Usage destination only. It resolves the
active organization from authenticated context and accepts one optional
`month=YYYY-MM` query parameter. Omitting `month` selects the current UTC
calendar month.

```ts
type BillingUsageSummary = {
  period: {
    month: string;
    startsAt: string;
    endsAt: string;
  };
  content: {
    projects: {
      count: number;
      assetCount: number;
    };
    assets: {
      count: number;
      usedBytes: number;
      byMediaType: Array<{
        mediaType: "image" | "video" | "audio" | "document";
        count: number;
        usedBytes: number;
      }>;
    };
    elements: {
      count: number;
      referenceCount: number;
    };
  };
  generation: {
    runCount: number;
    successfulOutputCount: number;
    outputsByMediaType: {
      image: number;
      video: number;
      audio: number;
      text: number;
    };
    capturedCredits: number;
    releasedCredits: number;
  };
  updatedAt: string;
};
```

The competitor term “Collections” maps to TaleLabs `Elements`. The API and UI
must always use `Elements`; do not introduce a `collections` billing concept.
`elements.referenceCount` is the number of Element-to-Asset references, not a
second byte total.

Assets are the only storage authority. `content.assets.usedBytes` reads the
same organization storage projection as `GET /billing/account`, and the media
breakdown must sum to that total. Projects organize Assets and Elements
reference Assets, so neither may independently claim the same bytes. The
Project card may show how many Assets currently belong to Projects; the Element
card may show how many image references Elements contain.

The endpoint is loaded only when Usage opens or its month changes. Current
storage totals come from `organizationStorageUsage`. Content counts and the
selected month's generation facts use tenant-scoped indexed aggregates. Do not
scan unbounded history, hydrate run details row by row, or cache financial
truth in process memory. If measured production volume makes the bounded month
aggregate too slow, preserve this API and replace the implementation with a
durable daily/monthly projection.

The response never includes provider credentials, provider costs, internal
margin policy, Stripe identifiers, prompts, or media contents. Return
`Cache-Control: private, no-store`; the dashboard may retain one
organization-and-month-keyed TanStack Query entry and invalidate the current
month after run settlement, Asset ingestion or purge, Project movement, or
Element reference changes.

### 8.3 `PATCH /billing/subscription`

This endpoint schedules a different current Pro recurring option on the
subscription's existing cadence:

```ts
type ScheduleSubscriptionOptionRequest = {
  recurringOptionCode: string;
  catalogRevision: string;
};
```

It requires an organization owner/admin and `Idempotency-Key`. The server locks
the local subscription, verifies active Pro entitlement and the current catalog,
resolves the immutable Stripe Price by lookup key, and creates or updates a
Stripe Subscription Schedule whose next phase begins at the current paid period
end. It persists `scheduledPlanCode` and `scheduledOfferCode`; the signed Stripe
webhook remains authoritative for the transition.

The change:

```txt
does not prorate
does not charge immediately
does not emit credits immediately
does not alter the current monthly grant
does not permit cross-plan or cadence changes
```

The response is the refreshed `BillingAccountSummary`, including the pending
option when present. Replaying the same request is idempotent. A different
pending option replaces the future phase without mutating the current paid
period.

The generated SDK owns dashboard contracts. APIs return stable error codes, not
English-only billing messages.

Required errors include:

```txt
insufficient_credits                 402
billing_account_blocked              403
subscription_already_active          409
subscription_change_not_available    409
billing_catalog_mismatch             409
invalid_topup_amount                 400
topup_not_available                  409
storage_limit_exceeded               409
stripe_checkout_unavailable          503
```

## 9. Managed Run Credit Lifecycle

### 9.1 Quote

Credits-funded Flow and Create preflight:

```txt
current graph or direct request
-> canonical plan
-> exact candidate provider bindings
-> current provider prices
-> landed-cost policy
-> per-job integer credit quote
-> aggregate public quote
```

The public quote exposes credits and availability, not provider rates, internal
fees, or margin policy.

The preflight quote is advisory. Admission always recomputes it from current
locked inputs and current pricing facts.

### 9.2 Reservation

Current TaleLabs admission persists every planned generation job before
dispatch. Therefore the launch billing model reserves the complete admitted run,
not a just-in-time subset.

Within the existing organization-wide run admission lock and one PostgreSQL
transaction:

1. replay an existing idempotency key if present;
2. validate run capacity and source revision;
3. lock every exact input Asset;
4. compile and validate the immutable execution plan;
5. resolve exact provider bindings and credit quotes;
6. reconcile due subscription grants;
7. lock the organization's credit balance;
8. reject with `402 insufficient_credits` if the full quote is unavailable;
9. allocate and reserve grant buckets for every planned job;
10. insert the run, snapshot, jobs, reservation, allocations, and ledger entries;
11. commit;
12. dispatch Trigger.dev only after commit.

This guarantees that a durable managed run is fully funded before provider
submission and that concurrent runs cannot overspend one organization balance.

### 9.3 Capture and release

Each generation job settles its immutable quoted credits exactly once:

| Outcome                                | Credit result                                   |
| -------------------------------------- | ----------------------------------------------- |
| usable canonical output succeeds       | capture quoted job credits                      |
| provider fails before usable output    | release quoted job credits                      |
| user cancellation before usable output | release quoted job credits                      |
| output ingestion fails or is corrupt   | release quoted job credits                      |
| run is partial                         | capture successful items, release the remainder |
| deterministic debug execution          | no reservation and no charge                    |

Actual provider cost can reconcile after output success. It must not delay Asset
availability or change the customer charge.

### 9.4 Retry and replay

- An idempotent admission replay returns the same run and reservation.
- Trigger retries reuse the same job settlement boundary.
- A user retry creates a new immutable run and a new reservation only for jobs
  that will execute.
- Reused prior outputs are not charged again.
- The engine's hidden `all` mode uses the same aggregate reservation even while
  the toolbar does not expose Run All.

### 9.5 Terminal reconciliation

A scheduled run reconciler must identify:

```txt
terminal jobs with open reservation items
terminal runs with open reservation totals
captured jobs missing ledger entries
released jobs missing ledger entries
ledger and materialized-balance disagreement
```

Every repair is idempotent and appends a compensating or missing ledger entry.
Never edit historical ledger rows.

### 9.6 BYOK

Browser BYOK:

```txt
does not request a TaleLabs credit quote
does not reserve or capture TaleLabs credits
does not send the provider key to TaleLabs
still persists run and Asset provenance
still enforces the organization's storage entitlement
```

Managed Credits and browser BYOK share planning, snapshots, outputs, and Assets,
but never share funding settlement.

## 10. Generated Asset Visibility

Visibility is captured at admission from the exact funding/grant policy and
persisted on the run and output Asset. It is never inferred later from the
organization's current plan.

Approved launch defaults:

| Funding source                        | Output visibility               |
| ------------------------------------- | ------------------------------- |
| Founder welcome managed credits       | public, showcase-eligible       |
| paid Creator/Pro subscription credits | private                         |
| purchased top-up credits on any plan  | private                         |
| browser BYOK                          | private                         |
| debug/mock                            | non-billable development policy |

When one job reserves from multiple grant buckets, derive the strictest output
policy once at admission:

```txt
public and showcase-eligible only when every allocation is public and showcase-eligible
private and not showcase-eligible when any allocation is private or not showcase-eligible
```

Persist that derived policy on the reservation item, immutable run/job
provenance, and output Asset. A later plan, grant, or catalog change must not
reclassify the output.

Public does not mean automatically featured. Showcase inclusion remains a
separate moderation/selection decision.

## 11. Storage Entitlements

The existing Asset table records `sizeBytes`, but TaleLabs does not yet have one
organization storage-quota authority. Billing must add it.

### 11.1 Usage authority

Use PostgreSQL as the source of truth:

```txt
organizationStorageUsage
  organizationId
  usedBytes
  reservedBytes
  version
  updatedAt
```

Maintain it transactionally with Asset registration, generated-output
reservation, purge completion, and project/folder-independent Asset lifecycle.
Provide a periodic invariant verifier that compares the projection with the
authoritative Asset aggregate.

### 11.2 Enforcement

Enforce the current plan's `storageBytes`:

```txt
before direct upload registration
before browser-output upload grants
before managed generation dispatch using a conservative output-byte reservation
when a retry would create additional outputs
```

Generated output reservation can use model/media-specific upper bounds from the
generation catalog. Release unused bytes after ingestion records actual size.

On downgrade or subscription end:

```txt
never delete existing Assets automatically
keep existing Assets accessible
block new uploads and new generated-output admission while over quota
allow purge and subscription upgrade
```

Folder moves and Project moves do not change organization storage usage.
Purchasing credits does not increase storage. A Free customer may buy top-ups
while remaining on the 100 MB limit; over-quota customers keep purchased credits
but must purge Assets or upgrade before creating another stored output.

## 12. Dashboard Experience

Billing belongs in account and status surfaces, not the main creative navigation.

### 12.1 Global sidebar/status

Show:

```txt
storage used / plan limit with a compact progress bar
available credits
reserved credits only when nonzero in supporting detail or a tooltip
a shortcut to Billing
```

The sidebar consumes only `GET /billing/account`. It renders
`storage.usedBytes / storage.limitBytes`, while progress and admission warnings
consider `usedBytes + reservedBytes`. Clicking either usage row opens Billing
settings. The component must not fetch ledger, Asset aggregates, or the public
catalog merely to render current usage. Mount the same shared status component
in both the standard dashboard sidebar and the contextual Project sidebar.

### 12.2 Settings modal information architecture

Extend the existing URL-backed Settings modal rather than creating a separate
billing application. Preserve the current Account and Providers destinations,
then add one Billing group:

```txt
Account
  General
  Organization
  Profile
  Security
  Team

Providers
  Secure Store

Billing
  Plans
  Credits
  Usage
```

The competitor screenshots are layout references, not a request to add Shared
Links, System Status, Danger Zone, a second API-key surface, or another
navigation model. Each Billing destination must have a stable `nuqs` Settings
value so the sidebar, Checkout return, Portal return, and upgrade actions can
open it directly.

Reuse the existing Settings dialog shell, navigation buttons, headings,
segmented controls, inputs, loading/error states, and responsive behavior.
Desktop keeps the navigation rail and one scrollable content region. Mobile
uses the existing compact destination navigation; do not create a second modal
inside Settings. Keep the visual treatment quiet and compact, avoid nested
cards, use familiar icons, and do not show a visible scrollbar when the shared
scroll-fade treatment can preserve the scroll affordance.

Plans and Credits share `GET /billing/catalog`; all three destinations share
`GET /billing/account`. They must not maintain separate plan, balance, or
storage representations.

### 12.3 Plans

Plans shows exactly three product identities:

```txt
Free
Creator
Pro
```

Founder is a status on Free, not a fourth plan. Pro's six reviewed recurring
allowances are selectable sizes of one Pro plan, not six plans. Do not add
Starter, Business, Studio, or a separate BYOK plan.

The destination includes:

```txt
monthly / annual segmented control
three responsive plan cards
Current and Founder badges when applicable
monthly credit allowance
storage allowance
browser BYOK and managed-generation availability
short, stable entitlement comparison
owner/admin upgrade or Manage subscription action
read-only plan visibility for ordinary members
the snapping Pro recurring-credit selector using the six catalog points
the scheduled Pro option and effective renewal date when a change is pending
```

Changing the monthly/annual control never changes Free. The Pro selector
updates the price and monthly allowance on the one Pro card and schedules an
existing Pro subscription change for renewal through
`PATCH /billing/subscription`. Prices, credits, plan copy, and slider points
come from the public billing catalog; UI code must not duplicate them.

### 12.4 Credits

Credits is the organization balance and one-time purchase destination:

```txt
available credit balance
reserved credits only when nonzero, as supporting detail
Packages / Custom segmented control
reviewed package shortcuts generated from catalog points
custom $10-$590 slider in $5 increments
exact one-time amount and exact credits
effective USD per credit
volume and plan value improvement derived from catalog basis points
clear notice that top-ups do not increase storage or plan entitlements
owner/admin Buy action and read-only state for ordinary members
```

Free, Creator, and Pro may all buy top-ups. Package cards and the custom slider
are two views of the same generated catalog formula; they do not define
separate offers. Any approximate image/video output examples must name the
representative model, duration, resolution, and pricing snapshot in a tooltip
or nearby disclosure. Never present one universal “images” or “videos” number
as a promise across models.

The cursor-paged organization ledger is available from this destination to
owners/admins, either as a compact history below the balance or through the
Transactions view in Usage. Both surfaces use the same
`GET /billing/credits/ledger` query and stable localized reason codes.

### 12.5 Usage

Usage has an Overview followed by a month-selectable detail area.

The Overview shows three compact summaries:

```txt
Projects  -> Project count and Project-owned Asset count
Assets    -> active Asset count and total storage bytes
Elements  -> Element count and image-reference count
```

Use `Elements`, never the competitor label `Collections`. Only Assets own
storage bytes. The storage progress bar uses
`GET /billing/account.storage`; its optional breakdown is by Asset media type.
Do not add Project bytes and Element bytes together because Projects organize
Assets and Elements reference those same Assets.

The detail area provides:

```txt
Generation usage / Transactions segmented control
UTC month selector
run and successful-output counts
image, video, audio, and text output counts
captured and released credits
localized empty, loading, error, and retry states
cursor-paged ledger transactions for owners/admins
```

`GET /billing/usage` owns Overview counts and selected-month generation facts.
`GET /billing/account` remains the storage and current-balance authority, and
`GET /billing/credits/ledger` remains the transaction authority. Do not derive
these values by loading full Asset, Element, Project, run, or ledger lists in
the browser.

### 12.6 Create and Flow

Managed mode:

```txt
show estimated credits before Run
keep Run disabled while a required quote is incomplete
show insufficient balance with an upgrade path
show captured credits in run/result history
clearly disclose when Founder promotional credits will create a public,
showcase-eligible output
```

BYOK mode remains unchanged and does not show a TaleLabs credit estimate.

All billing copy, dates, numbers, currencies, errors, and accessibility labels
follow the repository's ten-locale i18n contract and `Intl` formatting.

## 13. Security And Tenant Isolation

1. Subscription Checkout, top-up Checkout, Portal, Founder assignment, and
   billing mutations require explicit organization owner/admin authorization.
2. Members may read the current organization balance needed for generation UX.
3. Every billing query and foreign key is organization-scoped.
4. Never trust organization, plan, credits, or entitlement values from the
   browser.
5. Never trust Stripe metadata without verifying the local customer and
   subscription mapping.
6. Verify webhooks from the raw body before parsing.
7. Use idempotency keys for Stripe mutations and database uniqueness for all
   financial transitions.
8. Use stable lock order: organization admission -> billing account/balance ->
   grants -> reservation -> jobs.
9. Keep transactions short; do not call Stripe, Trigger.dev, or a provider while
   holding financial row locks.
10. Never place Stripe secrets, provider keys, payment payloads, or private
    billing facts in browser bundles, run snapshots, logs, or metrics.
11. Do not keep balances, grants, reservations, or webhook truth in memory-only
    storage.
12. Manual adjustments require actor, reason code, and an append-only ledger
    entry.

## 14. Operations And Observability

Correlate billing transitions with:

```txt
organizationId
stripeEventId
stripeCustomerId
stripeSubscriptionId
stripeInvoiceId
creditPurchaseId
stripeCheckoutSessionId
flowRunId
generationJobId
creditReservationId
catalogRevision
pricingPolicyVersion
```

Do not use these high-cardinality IDs as metric labels.

Alert on:

```txt
webhook backlog or repeated failure
monthly grant failure or duplicate attempt
top-up payment without exactly one purchased grant
top-up amount or credit count inconsistent with its catalog revision
negative balance or grant invariant
terminal run with open reservation
provider actual cost above quote
plan full-use margin below 20%
storage projection mismatch
refund or dispute against consumed credits
Stripe catalog synchronization drift
```

Profitability reporting must distinguish:

```txt
gross subscription revenue
gross top-up revenue
tax reserve
actual Stripe fee
credits granted, reserved, captured, and unused
actual provider cost
storage/runtime allocation
refunds/disputes
modeled contribution
```

Provider-positive jobs alone do not prove company profitability.

## 15. Implementation Sequence

### B0 - Confirm launch policy

Before code:

```txt
confirm the approved prices and monthly credit allowances
confirm Founder enrollment window/assignment workflow
confirm promotional-public versus paid-private output policy
confirm USD-only launch
confirm no plan switching at first paid beta
confirm the launch top-up range and volume curve
```

### B1 - Billing catalog

Deliver:

```txt
@talelabs/billing
approved plan and offer catalog
exact credit and margin arithmetic
top-up slider generation and monotonic-rate validation
sanitized public projection
billing:check
Seedance 4K and full-use margin fixtures
Stripe catalog dry-run/apply synchronizer
```

Gate:

```txt
every current offer >= 20% modeled full-use contribution
no duplicate source of plan or margin truth
no non-secret environment configuration
```

### B2 - Ledger and storage foundation

Deliver forward-only migrations for:

```txt
billing accounts
subscriptions, top-up purchases, and payments
Stripe event inbox
credit balances and grants
reservations, items, and allocations
append-only ledger
run/job funding and credit quote fields
organization storage usage
```

Add a permanent repeatable invariant verifier for concurrent reserve, capture,
release, duplicate events, grant reconciliation, and storage totals.

### B3 - Stripe test-mode payment

Deliver:

```txt
Checkout Session API
one-time top-up Checkout Session API
Customer Portal API
signed webhook inbox
asynchronous webhook processor and recovery scan
idempotent Product/Price synchronization
local subscription/payment projection
next-renewal Pro recurring-option scheduling
```

Do not run live-mode Stripe mutations in development or verification.

### B4 - Monthly grants

Deliver:

```txt
Founder one-time grant
admin-only Founder assignment operation
private non-expiring purchased-credit grant
monthly and annual paidThrough projection
monthly grant period calculator
hourly bounded grant task
lazy grant reconciliation on account read and admission
refund/dispute unused-credit reversal
```

### B5 - Managed run settlement

Integrate the canonical Flow/Create admission path:

```txt
credit quote
aggregate run reservation
per-job capture/release
terminal reservation reconciliation
402 enforcement
retry and idempotency behavior
actual provider cost and realized margin facts
```

Do not create a billing-specific execution engine.

### B6 - Entitlements and UI

Deliver:

```txt
Settings Billing group with Plans, Credits, and Usage destinations
exactly three plan identities: Free, Creator, and Pro
monthly/annual comparison and the six-point Pro recurring-credit selector
global sidebar credit and storage usage
single `GET /billing/account` query shared with Billing settings
top-up slider on Free, Creator, and Pro
Projects, Assets, and Elements usage overview without double-counted storage
month-selectable generation usage and owner/admin transactions
snapping Pro recurring-credit slider
credit-denominated Create/Flow estimates
storage usage and enforcement
Founder/paid output visibility capture
localized errors and history
```

### B7 - Certification

The billing milestone is not accepted until the following pass in Stripe test
mode and TaleLabs debug/provider-safe modes:

```txt
monthly Creator signup and first grant
annual Pro signup and only one monthly grant
all six Pro recurring options on monthly and annual cadence
Pro recurring option change taking effect at renewal without a prorated grant
Free top-up purchase and private purchased-credit grant
Creator and Pro top-up purchase without plan mutation
every top-up slider point and plan factor preserves monotonic value and the contribution floor
largest top-up remains worse per credit than the best subscription offer
top-up payment failure, duplicate webhook, refund, and dispute
12 annual monthly periods without duplicate grants
January 31 and leap-year grant anchors
duplicate and out-of-order Stripe webhooks
payment failure, recovery, cancel-at-period-end, refund, and dispute
two concurrent admissions cannot overspend one balance
Flow node, downstream, upstream, selection, and hidden all run modes
direct Create managed run
partial run, cancellation, retry, and ingestion failure settlement
browser BYOK bypasses credits
debug mode never charges credits
Seedance 2.0 4K quote is protected
promotional output public; paid/BYOK output private
top-up output private on Free, Creator, and Pro
top-up does not increase the Free storage limit
upload and generated-output storage overage
ledger-to-balance and storage projection invariants
sidebar/account summary matches balance and storage projections after run, upload, purge, grant, and organization switch
Plans renders only Free, Creator, and Pro; Founder is a Free status and Pro sizes remain one plan
Credits package and custom views resolve the same catalog-derived top-up values
Usage labels Collections as Elements and never attributes referenced Asset bytes twice
Usage month changes remain tenant-scoped, bounded, and consistent with run/job settlement
```

### B8 - Small paid beta

After test-mode certification:

1. use a small controlled real-provider and real-Stripe budget;
2. reconcile every invoice, grant, run charge, actual provider cost, and Asset;
3. monitor realized utilization and contribution;
4. adjust only through a catalog PR and immutable offer version;
5. expand access only after no money, credit, or tenant-isolation discrepancy
   remains.

## 16. Source References

Primary sources reviewed for this plan:

- [Stripe subscription integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions)
- [Stripe Checkout Session API](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal)
- [Stripe webhook behavior and signatures](https://docs.stripe.com/webhooks)
- [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
- [Stripe Prices and lookup keys](https://docs.stripe.com/api/prices/create)
- [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe subscription price changes](https://docs.stripe.com/billing/subscriptions/change-price)
- [Stripe subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
- [Stripe Test Clocks](https://docs.stripe.com/billing/testing/test-clocks)
- [Stripe Brazil pricing](https://stripe.com/br/pricing)
- [Stripe Billing pricing](https://stripe.com/br/billing/pricing)
- [Trigger.dev scheduled tasks](https://trigger.dev/docs/tasks/scheduled)
- [Trigger.dev idempotency](https://trigger.dev/docs/idempotency)
- [Trigger.dev queue concurrency](https://trigger.dev/docs/queue-concurrency)
- [OpenRouter fees](https://openrouter.ai/docs/faq)
- [fal.ai pricing](https://fal.ai/docs/documentation/model-apis/pricing)
- `docs/feature-research/provider-cost-estimation-and-routing.md`

## 17. Explicitly Deferred

The launch design leaves clean seams for, but does not implement:

```txt
expiring promotional credits
managed BYOK
automatic Credits-then-BYOK fallback
immediate prorated upgrades
multi-currency prices
Stripe Tax
seat billing
team budgets
self-serve negative-balance recovery
overage billing
affiliate discounts and coupon stacking
```

Every future addition must preserve the code-owned catalog, append-only ledger,
immutable run quote, provider-independent execution, and organization-scoped
financial invariants.
