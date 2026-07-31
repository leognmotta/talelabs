# TaleLabs Billing And Credits Technical Plan

**Status:** approved technical plan. Implementation is in progress.

**Approved commercial model:** 2026-07-27, capped Pro and top-up revision.

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
| Creator        | `creator`                        | monthly |      $18/month |                              1,600 |   10 GB | yes                                      | yes          |
| Creator        | `creator`                        | annual  |      $192/year |                   1,600 each month |   10 GB | yes                                      | yes          |
| Pro            | `pro`                            | monthly |      $49/month |                              5,300 |   50 GB | yes                                      | yes          |
| Pro            | `pro`                            | annual  |      $548/year |                   5,300 each month |   50 GB | yes                                      | yes          |

Annual subscriptions are paid up front, but credits are released monthly. An
annual purchase must not grant twelve months of credits immediately.

Pro keeps `$49 / 5,300` as its default entry offer. Customers who need more
managed generation may select a larger recurring Pro credit allowance without
changing plans or storage entitlements:

| Pro option | Monthly price | Monthly credits | Annual price | Credits released monthly on annual |
| ---------: | ------------: | --------------: | -----------: | ----------------------------------: |
|       Base |           $49 |           5,300 |         $548 |                               5,300 |
|          2 |           $99 |          11,300 |       $1,104 |                              11,300 |
|          3 |          $149 |          17,300 |       $1,668 |                              17,300 |
|          4 |          $249 |          29,500 |       $2,790 |                              29,500 |

The UI presents these reviewed points as a snapping slider, not as arbitrary
quantity billing. The base monthly prices remain `$18` for Creator and `$49`
for Pro. Increasing Pro changes only the recurring price and monthly credit
grant; all Pro options retain the same Pro feature and storage entitlements.
Paid allowance increases take effect after Stripe collects the exact prorated
invoice. TaleLabs grants only the floored incremental credits for the remaining
monthly credit period. Decreases remain renewal-boundary changes. Immediate
extra demand remains available through the separate top-up slider, which
extends to `$390` without changing the subscription.

The approved annual prices intentionally use modest discounts rather than the
earlier approximately 20% discount. Creator is about 11% below twelve monthly
payments, while each Pro option is about 7% below twelve monthly payments. This
keeps annual offers competitive without crossing the contribution floor.

The underlying Free plan provides browser BYOK and 100 MB without recurring
managed credits. Founder is an early-user status layered onto Free, not a
separate renewable subscription. It assigns the 150-credit welcome grant once.
This avoids inventing a second free-plan architecture when the Founder signup
window closes.

Every plan, including Free, may buy non-expiring managed-generation credit
top-ups. Top-ups do not increase storage or other plan entitlements.
The Creator endpoint and highest Pro endpoint may match their corresponding
monthly option rates. Lower Pro options deliberately receive weaker top-up
rates, and annual subscriptions remain the best approved recurring value.

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

| Offer               | Monthly-equivalent revenue | Max provider cost | Modeled retained contribution | Modeled margin |
| ------------------- | -------------------------: | ----------------: | ----------------------------: | -------------: |
| Creator monthly     |                        $18 |            $7.200 |                        $5.240 |          29.1% |
| Creator annual      |                        $16 |            $7.200 |                        $3.660 |          22.9% |
| Pro 5,300 monthly   |                        $49 |           $23.850 |                       $12.360 |          25.2% |
| Pro 5,300 annual    |                     $45.667 |           $23.850 |                        $9.727 |          21.3% |
| Pro 11,300 monthly  |                        $99 |           $50.850 |                       $24.860 |          25.1% |
| Pro 11,300 annual   |                        $92 |           $50.850 |                       $19.330 |          21.0% |
| Pro 17,300 monthly  |                       $149 |           $77.850 |                       $37.360 |          25.1% |
| Pro 17,300 annual   |                       $139 |           $77.850 |                       $29.460 |          21.2% |
| Pro 29,500 monthly  |                       $249 |          $132.750 |                       $61.460 |          24.7% |
| Pro 29,500 annual   |                     $232.500 |          $132.750 |                       $48.425 |          20.8% |

The 20% threshold is an absolute fail-closed floor, not the target for every
offer. The approved launch positioning targets roughly 25% full-use
contribution on monthly Pro, 21–23% on annual subscriptions, and at least 25%
at the most generous Pro top-up point. Creator retains a larger monthly buffer.

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
range is shared, while the organization's exact active recurring option selects
its maximum top-up endpoint. Higher recurring Pro allowances deliberately
unlock better top-up rates without creating another plan.
Purchased credits:

```txt
do not expire
create private, non-showcase outputs
do not increase storage or unlock plan features
remain spendable if a subscription later ends
```

The initial slider accepts `$10` through `$390` in `$5` increments. Every plan
has an explicit `$10` retail endpoint. Free and every paid recurring option
also have one reviewed `$390` endpoint in the catalog. The Pro ladder is
intentionally stepped:

```txt
$49 Pro  -> up to 25% volume savings
$99 Pro  -> up to 30% volume savings
$149 Pro -> up to 34% volume savings
$249 Pro -> up to 42.1% volume savings and the best top-up rate
```

Only the `$249 / 29,500` Pro option reaches its monthly subscription
price-per-credit at the `$390` top-up endpoint, as closely as integer credits
permit. Lower Pro options have intentionally more expensive top-up endpoints.
This creates a real high-volume upgrade benefit while retaining stronger
contribution margins on lower commitments.

An annual subscriber uses the same endpoint as the matching monthly recurring
option, not a stronger endpoint derived from the discounted annual price.
Consequently:

```txt
no top-up may beat the $249 Pro monthly credit rate
the matching annual subscription remains the best recurring credit value
canceling or changing a subscription changes future quotes only
already purchased credits and their economics never change
```

For each intermediate `amountUsdCents`, linearly interpolate the exact
price-per-credit between the `$10` and `$390` endpoints, then round credits
down:

```txt
progress =
  (amountUsdCents - minAmountUsdCents)
  / (maxAmountUsdCents - minAmountUsdCents)

minimumPricePerCredit =
  minAmountUsdCents / creditsAtMinimumAmount

maximumPricePerCredit =
  maxAmountUsdCents / creditsAtMaximumAmount

effectivePricePerCredit =
  linearInterpolation(
    minimumPricePerCredit,
    maximumPricePerCredit,
    progress
  )

topUpCredits =
  floor(amountUsdCents / effectivePricePerCredit)

volumeRateImprovementBps =
  floor(
    (minimumPricePerCredit - effectivePricePerCredit)
    * 10_000
    / minimumPricePerCredit
  )
```

Implement this as exact rational or decimal arithmetic. Do not calculate money,
credits, rates, basis points, or interpolation with JavaScript floating point.
`membershipRateImprovementBpsFromFree` is presentation metadata derived by
comparing this exact effective rate with Free's rate at the same amount; it is
not a second pricing input.

Launch constants:

```txt
minAmountUsdCents                    1_000
maxAmountUsdCents                   39_000
stepUsdCents                           500
creditsAtMinimumAmount.free             343
creditsAtMinimumAmount.creator          514
creditsAtMinimumAmount.pro              686
freeCreditsAtMaximumAmount           22_295
creditsAtMaximumAmount.creator-1600  34_666
creditsAtMaximumAmount.pro-5300      35_672
creditsAtMaximumAmount.pro-11300     38_220
creditsAtMaximumAmount.pro-17300     40_536
creditsAtMaximumAmount.pro-29500     46_204
paymentFixedUsdCents                     10
platformAllocationUsdCents              150
```

The validator applies the same gross tax, payment/FX, billing risk, runtime,
provider-cost ceiling, fixed payment fee, and `$1.50` per-purchase platform
allocation used by the approved contribution model. It must prove every
generated amount and entitlement combination remains above the 20%
contribution floor.

The approved `$390` endpoints are:

| Top-up entitlement | Endpoint policy      | Exact credits | Maximum savings from its $10 point | $390 modeled margin |
| ------------------ | -------------------- | ------------: | ---------------------------------: | ------------------: |
| Free               | retail curve         |        22,295 |                              40.0% |               52.9% |
| Creator 1,600      | matches $18 monthly  |        34,666 |                              42.2% |               38.6% |
| Pro 5,300          | stepped endpoint     |        35,672 |                              25.0% |               37.4% |
| Pro 11,300         | stepped endpoint     |        38,220 |                              30.0% |               34.5% |
| Pro 17,300         | stepped endpoint     |        40,536 |                              34.0% |               31.8% |
| Pro 29,500         | matches $249 monthly |        46,204 |                              42.1% |               25.3% |

The savings value is relative to the same entitlement's `$10` effective
price-per-credit, not to a fabricated universal retail price. It increases
linearly across the slider and reaches the table value at `$390`.

Because every Pro option shares the same `$10` baseline, the Pro selector may
present this approved comparison:

```txt
$49  -> Up to 25% off
$99  -> Up to 30% off
$149 -> Up to 34% off
$249 -> Up to 42.1% off · Best rate
```

Do not compare Creator's 42.2% label directly with these Pro labels: Creator
has a different, more expensive `$10` baseline. Its `$390` effective rate
remains worse than every Pro option. Cross-plan comparisons must use absolute
USD per credit, not percentages with different baselines.

Representative curve points:

| Entitlement | $10 credits | $100 credits | $250 credits | $390 credits |
| ----------- | ----------: | -----------: | -----------: | -----------: |
| Free        |         343 |        3,788 |       11,473 |       22,295 |
| Creator     |         514 |        5,710 |       17,515 |       34,666 |
| Pro 5,300   |         686 |        7,291 |       20,365 |       35,672 |
| Pro 11,300  |         686 |        7,384 |       21,159 |       38,220 |
| Pro 17,300  |         686 |        7,460 |       21,839 |       40,536 |
| Pro 29,500  |         686 |        7,619 |       23,360 |       46,204 |

Checkout, ledger grants, and margin validation always use the exact catalog
result. Marketing may round output examples but must not replace the exact
credit amount shown before purchase.

The API returns the exact purchase amount, entitlement-specific credits,
volume-rate improvement, and membership benefit computed by the catalog. The
server independently resolves the current plan and recurring option, recomputes
the selected slider point, and captures that option and catalog revision before
creating Checkout.

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
  revision: "2026-07-27.5",
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
    maxAmountUsdCents: 39_000,
    stepUsdCents: 500,
    creditsAtMinimumAmountByPlanCode: {
      free: 343,
      creator: 514,
      pro: 686,
    },
    freeCreditsAtMaximumAmount: 22_295,
    creditsAtMaximumAmountByRecurringOptionCode: {
      "creator-1600": 34_666,
      "pro-5300": 35_672,
      "pro-11300": 38_220,
      "pro-17300": 40_536,
      "pro-29500": 46_204,
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
      defaultRecurringOptionCode: "creator-1600",
      currentRecurringOptions: [
        {
          code: "creator-1600",
          monthlyCredits: 1_600,
          month: {
            catalogRevision: "2026-07-27.5",
            offerCode: "creator-monthly-1600-2026-07",
            priceUsdCents: 1_800,
            stripeLookupKey: "talelabs_creator_monthly_1600_2026_07",
          },
          year: {
            catalogRevision: "2026-07-27.5",
            offerCode: "creator-annual-1600-2026-07",
            priceUsdCents: 19_200,
            stripeLookupKey: "talelabs_creator_annual_1600_2026_07",
          },
        },
      ],
      historicalOffers: [],
    },
    pro: {
      storageBytes: 50 * 1024 * 1024 * 1024,
      browserByok: true,
      defaultRecurringOptionCode: "pro-5300",
      currentRecurringOptions: [
        {
          code: "pro-5300",
          monthlyCredits: 5_300,
          month: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-monthly-5300-2026-07",
            priceUsdCents: 4_900,
            stripeLookupKey: "talelabs_pro_monthly_5300_2026_07",
          },
          year: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-annual-5300-2026-07",
            priceUsdCents: 54_800,
            stripeLookupKey: "talelabs_pro_annual_5300_2026_07",
          },
        },
        {
          code: "pro-11300",
          monthlyCredits: 11_300,
          month: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-monthly-11300-2026-07",
            priceUsdCents: 9_900,
            stripeLookupKey: "talelabs_pro_monthly_11300_2026_07",
          },
          year: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-annual-11300-2026-07",
            priceUsdCents: 110_400,
            stripeLookupKey: "talelabs_pro_annual_11300_2026_07",
          },
        },
        {
          code: "pro-17300",
          monthlyCredits: 17_300,
          month: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-monthly-17300-2026-07",
            priceUsdCents: 14_900,
            stripeLookupKey: "talelabs_pro_monthly_17300_2026_07",
          },
          year: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-annual-17300-2026-07",
            priceUsdCents: 166_800,
            stripeLookupKey: "talelabs_pro_annual_17300_2026_07",
          },
        },
        {
          code: "pro-29500",
          monthlyCredits: 29_500,
          month: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-monthly-29500-2026-07",
            priceUsdCents: 24_900,
            stripeLookupKey: "talelabs_pro_monthly_29500_2026_07",
          },
          year: {
            catalogRevision: "2026-07-27.5",
            offerCode: "pro-annual-29500-2026-07",
            priceUsdCents: 279_000,
            stripeLookupKey: "talelabs_pro_annual_29500_2026_07",
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
top-up range, step, minimum retail endpoints, recurring-option maximum
endpoints, and platform allocation
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

Each `historicalOffers` entry is a complete recurring fact, not only a retired
price: it retains `billingInterval`, `recurringOptionCode`, `monthlyCredits`,
`catalogRevision`, `offerCode`, `priceUsdCents`, and `stripeLookupKey` under its
owning paid plan. Webhook projection and paid-Invoice reconciliation resolve
both current and historical entries, while new Checkout remains limited to
`currentRecurringOptions`. Catalog synchronization verifies historical Prices
read-only against those code-owned facts and never creates, updates, activates,
or deactivates them.

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
top-up Price data. Slider points do not create or synchronize 77 long-lived
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
a paid top-up rate better than its active recurring option's monthly rate
an interval-specific top-up endpoint for one recurring option
a non-increasing Pro endpoint or approved savings-ladder drift
a top-up endpoint inconsistent with its captured recurring option
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
currentRecurringOptionCode      nullable for Free
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

Founder assignment is an explicit system-administrator operator operation. It
is not self-service for organization owners/admins and is not inferred from
email, signup time, or mutable UI state.

### 5.2 Subscriptions, top-up purchases, and payments

`billingSubscriptions` stores the local Stripe subscription projection:

```txt
id
organizationId
stripeCustomerId
stripeSubscriptionId            unique
planCode
recurringOptionCode
offerCode
catalogRevision
status
billingInterval
currentPeriodStart
currentPeriodEnd
paidThrough
cancelAtPeriodEnd
scheduledPlanCode               nullable Creator or Pro target
scheduledRecurringOptionCode    nullable paid option
scheduledOfferCode              nullable immutable target offer
scheduledBillingInterval        nullable month or year
creditScheduleRevision          nonnegative schedule generation
createdAt
updatedAt
```

A partial unique constraint permits at most one current subscription per
organization.

`subscriptionCreditPeriods` stores one database-enforced monthly ceiling per
subscription schedule revision. `carriedCredits + grantedCredits` can never
exceed `targetCredits`. A monthly-to-annual switch starts a new schedule,
counts the credits already issued for the overlapping month as carried, and
grants only the positive shortfall. Spending credits does not lower this
ceiling and can never cause them to be issued again.

`creditPurchases` is the durable order and quoted-credit authority for one
top-up:

```txt
id
organizationId
planCode                        plan at purchase quotation
recurringOptionCode             nullable; exact paid option used for quotation
status                          pending | paid | failed | expired | partially_refunded | refunded | disputed
amountMinor
refundedAmountMinor             cumulative Stripe-refunded minor units
currency
credits
catalogRevision
pricingPolicyVersion
volumeRateImprovementBps
membershipRateImprovementBpsFromFree
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
stripeInvoiceLineItemId         nullable, unique when present
stripePriceId                   nullable; exact paid recurring Price
stripeCheckoutSessionId         nullable, unique when present
stripePaymentIntentId           nullable, unique when present
amountPaidMinor
refundedAmountMinor             cumulative Stripe-refunded minor units
currency
subscriptionPlanCode            nullable for top-up
subscriptionRecurringOptionCode nullable for top-up
subscriptionOfferCode           nullable for top-up
subscriptionMonthlyCredits      nullable for top-up
subscriptionBillingInterval     nullable for top-up
subscriptionCatalogRevision     nullable for top-up
subscriptionGrantFactsCapturedAt nullable; one-time immutable capture marker
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
subscription -> billingSubscriptionId, stripeInvoiceId, and service period are present
credit_topup -> creditPurchaseId and stripeCheckoutSessionId are present
exactly one subscription or purchase owner is present
```

Do not infer payment from `customer.subscription.status` alone. `invoice.paid`
extends `paidThrough` and authorizes future monthly grants. The exact
positive target-Price subscription invoice line is the grant authority,
including a payment-gated subscription-update invoice: its Price, service
period, plan, recurring option, offer, monthly credits, billing interval, and
catalog revision are captured atomically on the payment. Grant
reconciliation consumes only those immutable payment facts and never the
mutable current Subscription projection. Invoice processing resolves the exact
already-projected local Subscription by Stripe Subscription and Customer
identity; it never retrieves or reprojects mutable lifecycle state. A missing
local projection leaves the Invoice retryable until its Subscription event is
processed. A pre-migration payment may capture the complete fact set once by
replaying its Stripe Invoice; after capture, a database trigger rejects changes
to the grant authority.

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
Grant append acquires the organization billing lock before checking that key,
so concurrent webhook, scheduled, and admission replays return the same grant
instead of surfacing a unique-constraint failure.

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
the persisted top-up amount, credits, recurring option, and catalog endpoint
match one valid catalog slider point
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
-> resolve the exact local subscription and immutable invoice-line facts
-> update the local payment and that exact subscription's paidThrough
-> reconcile every monthly grant period now due
```

Stripe Subscription lifecycle projection and paid-Invoice mutation acquire
PostgreSQL row locks in one order: `organizationBillingAccounts`, then every
`billingSubscriptions` row ordered by local `id`, then the dependent Checkout
intent or payment rows they touch. Disposable certification overlaps a delayed
historical Invoice with a replacement Subscription lifecycle event and must
complete without a deadlock.

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
-> read the next durable organization-keyset cursor page in a serialized task
-> merge due tenant failures from the durable recovery queue
-> reconcile each organization as an isolated idempotent operation
-> persist tenant-specific backoff or quarantine before continuing the page
-> advance after every page organization either succeeds or has a durable failure
-> retry failed tenants independently and wrap only after the final page
```

The scheduler is acceleration, not the only correctness path. Managed run
admission also reconciles due local grant periods before reporting insufficient
credits. Billing account reads are side-effect-free and never initialize,
expire, or reconcile state. This lets a customer use a paid allowance even if a
scheduled task was delayed without turning global sidebar reads into a write
amplifier.

Both the grant and invariant sweeps retain per-task, per-organization failure
rows with attempt count, stable error code, next retry, and quarantine state.
Five consecutive failures quarantine that tenant for operator review. A failed
tenant never prevents later organizations from being visited, and cursor
advancement never silently drops a failure that was not durably recorded.

### 6.4 Subscription lifecycle

| Stripe/payment state      | TaleLabs behavior                                                       |
| ------------------------- | ----------------------------------------------------------------------- |
| first invoice paid        | activate paid entitlement and emit first monthly grant                  |
| monthly renewal paid      | extend `paidThrough` and emit the next due grant                        |
| annual renewal paid       | extend `paidThrough` by the paid annual period; continue monthly grants |
| payment failed / past due | do not emit grants beyond existing `paidThrough`                        |
| cancel at period end      | preserve paid service and due grants through `paidThrough`              |
| subscription ended        | stop future grants; already granted non-expiring credits remain         |
| paid allowance increase   | collect exact proration, apply immediately, and grant only the remaining-period increment |
| monthly to annual         | collect immediately, reset the billing/credit schedule, and carry overlapping credits |
| paid allowance decrease   | schedule the selected paid option for the next renewal; no immediate credit mutation |
| annual to monthly         | schedule the cadence change for renewal; no immediate credit mutation              |

Already granted credits remain spendable after a paid subscription ends. The
organization falls back to Free storage and feature entitlements at
`paidThrough`; being over the new storage limit blocks new storage but never
deletes existing Assets. Only `blocked_review`, abuse, or account security may
block spending an otherwise valid remaining balance.

Launch Customer Portal configuration supports payment methods, invoice history,
and cancellation. TaleLabs previews and executes product, cadence, and
recurring-size changes so it can apply its payment-gated monthly-credit
contract. Immediate increases use Stripe's exact preview and
`pending_if_incomplete`; decreases use a Stripe Subscription Schedule with a
next-period phase. Do not expose those changes through Portal, where they could
bypass the local intent, credit ceiling, and scheduled-offer projection.

### 6.5 Refunds and disputes

For an affected grant:

1. reverse unspent credits from that grant;
2. preserve an audit entry tied to the Stripe refund or dispute;
3. if the grant has already been consumed, do not create a hidden negative
   balance;
4. set managed execution to `blocked_review` and require an explicit support
   decision.

Any partial refund enters `blocked_review` and records Stripe's cumulative
refunded amount without automatically guessing a proportional credit or annual
entitlement policy. A later full refund uses the stable Charge identity to
reverse every then-unused credit exactly once. Repeated partial-refund events
update the cumulative amount but do not mark the payment fully refunded.

An open or lost dispute records the exact unused-credit reversal per grant. A
current Stripe outcome of `won`, `warning_closed`, or `prevented` appends
compensating ledger entries and restores exactly those credits unless a full
refund has superseded the dispute. Managed execution is unblocked only when no
other open or lost dispute or partial-refund review remains.

A dispute amount that does not map exactly to the one local payment enters
`blocked_review` without automatic credit reversal. Stripe can report partial
disputes, conversion differences, or multiple recurring payments in one
dispute, so TaleLabs must not guess which grant share to revoke.

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
8. admits one durable organization-scoped pending Checkout intent before
   calling Stripe, with a short external-request lease and expiry boundary;
9. creates or reuses the one Stripe Checkout Session in `subscription` mode
   using the durable intent identity for Stripe idempotency;
10. explicitly permits only the synchronous `card` payment method at launch;
11. includes the API-version-supported `integration_identifier`;
12. returns the Stripe-hosted Checkout URL.

Success redirects to a billing completion route that displays pending state
until the signed webhook confirms payment. The redirect is not payment proof.
The processor still supports legacy delayed-payment Sessions. On
`checkout.session.async_payment_failed`, it retrieves and projects the current
Subscription. Any non-terminal Subscription durably blocks a second Checkout
until Stripe reports explicit recovery or cancellation; a failure with no
Subscription releases the pending intent.

### 7.3 Top-up Checkout

`POST /billing/topups/checkout` is available to Free, Creator, and Pro:

1. require an organization owner/admin;
2. accept only `amountUsdCents` and a request idempotency key from the browser;
3. validate that the amount is an exact current slider point;
4. lock the organization billing account, resolve its current plan and exact
   recurring option, then recompute credits, volume improvement, membership
   benefit, modeled contribution, and catalog revision;
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
organization's plan or storage limit. A Free organization uses the Free retail
curve. A paid organization must capture the exact current recurring option and
its reviewed catalog endpoint. A concurrent subscription change cannot alter an
admitted purchase.

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
be safe under duplicate delivery and out-of-order events. Historical
`invoice.payment_failed` deliveries never override a currently recovered
Subscription or paid Invoice.
An asynchronous subscription Checkout failure also retrieves its current
Subscription rather than treating the historical Session event as sufficient
state.
If a known TaleLabs customer's refund or dispute arrives before its local
payment projection, the event remains failed with a retryable projection
pending code. Inbox recovery replays it after the payment exists; the event is
never marked successful while its reversal is unmatched. Events for customers
outside the TaleLabs billing account remain safely ignored.

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
invoice.payment_action_required
subscription_schedule.created
subscription_schedule.updated
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
| `GET /billing/usage/months`     | authenticated member  | recent months containing usage or credit activity      |
| `GET /billing/usage/runs`       | authenticated member  | cursor-paged visible runs for one selected month       |
| `GET /billing/credits/ledger`   | owner/admin           | selected-month cursor-paged organization ledger       |
| `POST /billing/checkout`        | owner/admin           | create subscription Checkout Session                  |
| `POST /billing/subscription/preview` | owner/admin      | preview exact timing, amount due, and credits          |
| `PATCH /billing/subscription`   | owner/admin           | apply a paid increase or schedule a decrease           |
| `POST /billing/topups/checkout` | owner/admin           | create one-time credit top-up Checkout Session        |
| `POST /billing/portal`          | owner/admin           | open Stripe Customer Portal                           |
| `POST /billing/founder`         | system administrator  | assign approved Founder status and welcome credits    |
| `POST /webhooks/stripe`         | signed Stripe request | durable webhook inbox                                 |

The public catalog exposes stable plan codes, storage limits, BYOK availability,
default/current recurring options, monthly credit allowances, intervals,
customer prices, and every recurring option's reviewed maximum top-up credits
and savings. It returns generated top-up options for the current entitlement
with only:

```txt
amountUsdCents
credits
effectiveUsdPerCredit             exact decimal string
volumeRateImprovementBps
planRateImprovementBpsFromFree
pricingPlanCode
pricingRecurringOptionCode        nullable for Free
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
member may read the summary. It reads the materialized billing, credit-balance,
and storage-usage projections without writing. An organization with no
initialized billing rows receives a read-only Free/zero projection; the first
billing, storage, or run mutation initializes the durable rows transactionally.

```ts
type BillingAccountSummary = {
  catalogRevision: string;
  plan: {
    code: "free" | "creator" | "pro";
    founder: boolean;
    recurringOptionCode: string | null;
    scheduledRecurringOptionCode: string | null;
    scheduledBillingInterval: "month" | "year" | null;
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

#### 8.2.1 `GET /billing/usage/months`

The Usage month selector lists only UTC months containing organization
generation runs or credit-ledger activity. The discovery read probes a fixed
120-month candidate window using the existing organization-and-created-at
indexes rather than exposing the calendar component's broad default year
range or scanning hydrated history. Results are newest first.

An organization with no recorded activity receives the current UTC month as
its single fallback so the empty Usage destination remains navigable. The
dashboard selects the newest returned month initially, groups choices by year,
and commits a month directly without offering empty years or months.

#### 8.2.2 `GET /billing/usage/runs`

Usage presents a reverse-chronological run table beneath the selected month's
generation summary. The table uses a separate bounded read rather than
expanding `GET /billing/usage` or hydrating the organization's complete run
history. It accepts the same optional UTC `month=YYYY-MM` parameter plus an
opaque `cursor` and a bounded `limit`.

Flow history is collaborative within the active organization. Direct Create
history remains private to its creator, so this endpoint returns organization
Flow runs plus only the authenticated member's direct Create runs. This
visibility rule intentionally means that the table can contain fewer rows than
the organization-wide monthly aggregate when other members have private direct
Create runs.

Each row includes only the run identity, source and source name, mode, status,
requested media types, successful output count, funding source, quoted and
captured credits, and creation/completion timestamps. It never exposes prompts,
provider bindings, provider costs, credentials, output contents, or Stripe
identifiers.

The read uses the tenant-scoped `createdAt, id` ordering and performs only
bounded aggregate queries for the run IDs on the current page. Cursors are
reverse chronological, the dashboard resets pagination when the month changes,
and the response uses `Cache-Control: private, no-store`.

`GET /billing/credits/ledger` accepts the same optional `month=YYYY-MM`
selection. Its cursor remains scoped to that month, and the dashboard resets
ledger pagination whenever the selected month changes.

### 8.3 Paid subscription preview and change

Both endpoints accept one complete paid target:

```ts
type PaidSubscriptionChangeTarget = {
  planCode: "creator" | "pro";
  recurringOptionCode: string;
  billingInterval: "month" | "year";
  catalogRevision: string;
};
```

`POST /billing/subscription/preview` resolves the exact Stripe Price and returns
`immediate` or `renewal`, the exact amount due now, the whole credits added now,
the effective date, target monthly allowance, storage, cadence, and next renewal
when applicable. Its whole-second `prorationDate` must be returned unchanged by
the confirming request.

`PATCH /billing/subscription` additionally requires `Idempotency-Key`. The
server locks the account then every subscription in local-ID order, admits one
durable monotonic revision, and verifies the same Stripe subscription and Price
used by the preview.

For an immediate increase, Stripe uses `always_invoice`,
`pending_if_incomplete`, and the fixed preview proration instant. TaleLabs
applies the plan, storage, allowance, and current-period credit increment only
after that Invoice is paid. An authentication-required Invoice returns its
hosted payment URL and remains pending for webhook completion. For a decrease
or annual-to-monthly switch, the server creates and verifies a renewal-boundary
Subscription Schedule and persists the complete scheduled tuple. Replaying the
same target and key is idempotent.

Every external change carries the durable intent identity in Stripe metadata.
`subscription_schedule.created` can recover a crash immediately after Schedule
creation by attaching and configuring that exact Schedule;
`subscription_schedule.updated` applies the verified future tuple.
`invoice.payment_action_required` attaches the exact hosted recovery Invoice,
and an API replay may also recover it from the Subscription's `latest_invoice`.
Pending intents are never failed merely because a local TTL elapsed: Stripe is
retrieved first, and only a proven absence of an attached Schedule, pending
update, or related Invoice permits an abandoned intent to fail.
If a signed webhook applies the exact Invoice or Schedule before the originating
API request resumes, the matching immutable Stripe identity is a successful
replay even though the webhook has already cleared the API request lease.

The credit rules are independent from the spendable balance:

```txt
same-cadence increase -> floor((target - current) * remaining / period)
monthly-to-annual -> target monthly credits - already counted overlapping credits
decrease or annual-to-monthly -> zero credits now
period invariant -> carried credits + granted credits <= target credits
```

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

Before any Credits-funded managed action, including debug execution, the
dashboard compares the complete advisory quote with the shared
`GET /billing/account` balance. An
insufficient balance opens Settings directly on Credits and does not submit the
paid admission request. This applies to Create, Flow node, downstream, upstream,
selection, hidden all-scope, and user retry actions. Retry uses
`POST /runs/:id/retry/estimate`, which quotes the source run's immutable jobs
through the same credit-policy function used by retry admission.

The browser check is an interaction guard, not an authorization boundary.
Concurrent tabs, a stale cache, or a price race can still reach authoritative
admission. A race-time `402 insufficient_credits` refreshes the shared account
summary and opens Credits without showing a generic generation failure.

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
| deterministic Credits debug execution  | capture the normal quote without a provider call |

Actual provider cost can reconcile after output success. It must not delay Asset
availability or change the customer charge.

Run cancellation commits the user-terminal run state first and dispatches one
idempotent settlement task. The task releases each job independently and the
global terminal-settlement sweep remains the fallback. A dispatch or individual
settlement failure never changes the accepted cancellation into an HTTP error;
replaying an already-canceled run succeeds and re-dispatches recovery.

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
Never edit historical ledger rows. Isolate failures per job, back off bounded
retries, and quarantine an exhausted job for operator review so one corrupt
reservation cannot block later tenants.

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
| managed Credits debug                | funding allocation policy; no provider call |
| BYOK debug                            | private; no TaleLabs credit charge |

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
before issuing a direct-upload signed URL, using a durable exact-byte hold
before browser-output upload grants
before managed generation dispatch using a conservative output-byte reservation
when a retry would create additional outputs
```

Generated output reservation can use model/media-specific upper bounds from the
generation catalog. Release unused bytes after ingestion records actual size.
An admitted hold authorizes actual bytes up to the released per-output share
even if the plan is downgraded before ingestion. Apply the current plan limit
only to bytes above that admitted share.

Direct-upload registration atomically converts its exact hold into used bytes.
An expired unregistered grant retains the hold until its create-only private R2
object has been deleted idempotently, then releases it exactly once. Cleanup
claims use a durable attempt revision and `cleanupNextAt` lease; failures apply
bounded backoff while later eligible intents continue through a bounded worker
pool. No signed direct-upload capability or abandoned object may exist without
the corresponding organization storage reservation.

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

Founder is a status on Free, not a fourth plan. Pro's four reviewed recurring
allowances are selectable sizes of one Pro plan, not four plans. Do not add
Starter, Business, Studio, or a separate BYOK plan.

Free accounts see:

```txt
monthly / annual segmented control
three responsive plan cards
Current and Founder badges when applicable
monthly credit allowance
storage allowance
browser BYOK and managed-generation availability
maximum top-up savings unlocked by each recurring option
short, stable entitlement comparison
owner/admin Checkout actions and read-only visibility for ordinary members
the snapping Pro recurring-credit selector using the four catalog points
```

Paid Creator and Pro accounts instead see:

```txt
one compact current-subscription summary
an active monthly / annual target control for owner/admin changes
current price, monthly credits, storage, and renewal or end date
one secondary owner/admin Manage billing action inside the summary
the complete scheduled target and effective renewal date inside the summary
one focused paid-option panel rather than three acquisition cards
Creator: review Creator annual or Pro targets
Pro: adjust the four-point recurring-credit allowance or cadence
read-only visibility for ordinary members
```

Changing the monthly/annual control never changes Free. For paid users it
selects a reviewed TaleLabs target: monthly-to-annual is an immediate paid
change, while annual-to-monthly takes effect at renewal. Stripe Customer Portal
owns payment methods, invoice history, cancellation, and other hosted account
management, but not product or cadence changes.

The focused selector updates the displayed price and monthly allowance, then
loads an exact server preview. Immediate confirmation shows amount due today,
credits added now, target allowance, storage, and the explicit no-duplicate
credit rule. Renewal confirmation shows the effective date and no-charge-today
copy. Prices, credits, plan copy, and slider points come from the public billing
catalog; UI code must not duplicate them. Rounded whole-percentage labels may
be used in the compact selector, while the detailed Credits view shows the
exact catalog percentage and effective USD per credit.

Annual cards present the annual offer as its rounded monthly-equivalent price,
then disclose the exact annual charge and exact savings relative to twelve
monthly payments. The calculation uses the paired catalog offers and exact
integer-cent arithmetic.

Plan-card top-up percentages use the Free rate at the same maximum purchase
amount as their common baseline. Never compare entitlement-specific volume
improvement percentages side by side: their minimum-purchase baselines differ
and make Creator appear better than Pro even when Pro has the lower absolute
USD-per-credit rate.

### 12.4 Credits

Credits is the organization balance and one-time purchase destination:

```txt
available credit balance
reserved credits only when nonzero, as supporting detail
one $10-$390 top-up slider in $5 increments
exact one-time amount and exact credits
effective USD per credit
volume savings and recurring-option membership value derived from the catalog
clear notice that top-ups do not increase storage or plan entitlements
owner/admin Buy action and read-only state for ordinary members
```

Free, Creator, and Pro may all buy top-ups. The slider is the sole top-up amount
selector and resolves every valid step from the generated catalog formula. Any
approximate image/video output examples must name the representative model,
duration, resolution, and pricing snapshot in a tooltip or nearby disclosure.
Never present one universal “images” or “videos” number as a promise across
models.

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
open Settings -> Credits before paid admission when the shared balance is
insufficient
preserve 402 handling as a race-time fallback without a generic error toast
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
per-organization reconciliation retry and quarantine state
run/job funding and credit quote fields
organization storage usage
```

Add a permanent repeatable invariant verifier for concurrent reserve, capture,
release, duplicate events, grant reconciliation, and storage totals.

### B3 - Stripe test-mode payment

Deliver:

```txt
Checkout Session API
card-only launch subscription Checkout
one-time top-up Checkout Session API
Customer Portal API
signed webhook inbox
asynchronous webhook processor and recovery scan
idempotent Product/Price synchronization
local subscription/payment projection
payment-gated immediate paid increases and monthly-to-annual changes
renewal-boundary paid decreases and annual-to-monthly scheduling
```

Do not run live-mode Stripe mutations in development or verification.

### B4 - Monthly grants

Deliver:

```txt
Founder one-time grant
system-admin-only Founder assignment operation
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
pre-admission Credits routing with server-side race fallback
retry and idempotency behavior
actual provider cost and realized margin facts
```

Do not create a billing-specific execution engine.

### B6 - Entitlements and UI

Deliver:

```txt
Settings Billing group with Plans, Credits, and Usage destinations
exactly three plan identities: Free, Creator, and Pro
monthly/annual comparison and the four-point Pro recurring-credit selector
global sidebar credit and storage usage
single `GET /billing/account` query shared with Billing settings
top-up slider on Free, Creator, and Pro
Projects, Assets, and Elements usage overview without double-counted storage
month-selectable generation usage and owner/admin transactions
data-bearing month choices grouped by year without empty calendar ranges
cursor-paged monthly generation run history
snapping Pro recurring-credit slider
credit-denominated Create/Flow estimates
client-side Credits modal guard for every credit-funded admission and retry
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
all four Pro recurring options on monthly and annual cadence
monthly Creator to Pro upgrade with exact Stripe proration and only the floored remaining-period credit increment
monthly-to-annual switch carrying already counted credits without duplication
annual paid-option increase with exact revenue allocation across later monthly grants
Pro decrease and annual-to-monthly change taking effect at renewal without an immediate grant
Free top-up purchase and private purchased-credit grant
Creator and Pro top-up purchase without plan mutation
every top-up slider point and recurring-option endpoint preserves monotonic value and the contribution floor
each paid endpoint follows the approved savings ladder and never beats its active monthly option
only the highest Pro endpoint matches its monthly option after integer rounding
annual subscriptions remain better per credit than their matching top-up curve
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
managed Credits debug mode quotes, reserves, and captures the same credits as
the corresponding live run while never calling the real provider
BYOK debug mode does not consume TaleLabs credits
Seedance 2.0 4K quote is protected
promotional output public; paid/BYOK output private
top-up output private on Free, Creator, and Pro
top-up does not increase the Free storage limit
upload and generated-output storage overage
concurrent and abandoned direct-upload grants cannot exceed storage quota or
leave untracked R2 objects
persistent upload-cleanup failures back off without starving later intents
ledger-to-balance and storage projection invariants
sidebar/account summary matches balance and storage projections after run, upload, purge, grant, and organization switch
Plans renders only Free, Creator, and Pro; Founder is a Free status and Pro sizes remain one plan
Credits exposes one slider whose every step resolves a catalog-derived top-up value
Usage labels Collections as Elements and never attributes referenced Asset bytes twice
Usage month changes remain tenant-scoped, bounded, and consistent with run/job settlement
Usage month choices include only recent months with runs or credit activity
Usage run history preserves collaborative Flow and private Create visibility and paginates without unbounded scans
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
