# TaleAds Pricing Formula

This document defines the initial credit-based pricing model for TaleAds.

The goal is to support:

- competitive customer-facing prices;
- large annual and credit-pack discounts;
- protected margins on expensive AI video models;
- simple credit accounting for users;
- accurate per-job margin tracking internally.

## 1. Credit System

TaleAds uses credits as the internal unit of usage.

```txt
100 credits = $1.00 nominal value
1 credit = $0.01 nominal value
```

The nominal value is what users see in normal pricing. However, annual plans and large credit packs can discount the effective value of a credit.

Example:

```txt
Normal value: $0.0100 / credit
Large-pack value: $0.00625 / credit
Maximum discount: 37.5%
```

All generation pricing must be calculated against the **lowest effective credit value**, not the nominal credit value.

## 2. Key Internal Values

```ts
const NOMINAL_CREDIT_VALUE_USD = 0.01
const CREDIT_FLOOR_USD = 0.00625
const OPENROUTER_FEE_MULTIPLIER = 1.055
```

`CREDIT_FLOOR_USD` is the cheapest possible effective value of one credit after the largest annual or bulk discount.

This protects margins even when a high-volume customer buys credits at a deep discount.

## 3. Adjusted COGS

Each generation job has an adjusted cost:

```txt
adjusted_cogs_usd =
  provider_cost_usd
  * provider_fee_multiplier
  + infra_per_job_usd
  + risk_buffer_usd
```

For OpenRouter:

```txt
provider_fee_multiplier = 1.055
```

`infra_per_job_usd` should include a small allocation for:

- Trigger.dev;
- storage;
- database;
- cache/rate limit;
- logs/observability;
- thumbnails/renders;
- failed-job overhead.

Recommended starting values:

```txt
infra_per_job_usd = $0.03 - $0.08
risk_buffer_usd = $0.00 - $0.20
```

## 4. Tiered Margin Formula

Do not use one universal markup for every model.

Use a tiered formula based on model cost and strategic importance.

| Tier | Examples | COGS Allowed As % Of Revenue | Target Gross Margin |
|---|---|---:|---:|
| Standard | Images, Veo Lite, Hailuo, Seedance Fast | 40% | 60% |
| Pro | Veo Fast, Kling Standard, Kling Pro | 50% | 50% |
| Premium | Sora, Veo 3.1, 4K, expensive models | 65% | 35% |

Formula:

```txt
credits =
  adjusted_cogs_usd
  / tier_cogs_ratio
  / credit_floor_usd
```

In TypeScript:

```ts
const tierCogsRatio = {
  standard: 0.40,
  pro: 0.50,
  premium: 0.65,
} as const

function calculateCredits({
  providerCostUsd,
  tier,
  providerFeeMultiplier = 1.055,
  infraPerJobUsd = 0.05,
  riskBufferUsd = 0,
}: {
  providerCostUsd: number
  tier: 'standard' | 'pro' | 'premium'
  providerFeeMultiplier?: number
  infraPerJobUsd?: number
  riskBufferUsd?: number
}) {
  const adjustedCogs
    = providerCostUsd * providerFeeMultiplier
      + infraPerJobUsd
      + riskBufferUsd

  const rawCredits
    = adjustedCogs / tierCogsRatio[tier] / CREDIT_FLOOR_USD

  return roundCredits(rawCredits)
}
```

## 5. Credit Rounding

Use clean rounded prices.

```ts
function roundCredits(rawCredits: number) {
  if (rawCredits < 100) {
    return Math.ceil(rawCredits / 5) * 5
  }

  if (rawCredits < 500) {
    return Math.ceil(rawCredits / 10) * 10
  }

  return Math.ceil(rawCredits / 50) * 50
}
```

## 6. Example Pricing Table

Assumptions:

- `CREDIT_FLOOR_USD = $0.00625`
- nominal credit value = `$0.01`
- OpenRouter fee included
- small infra allocation included

| Output | Adjusted COGS | Tier | Credits | Normal Price | Big-Pack Price | Normal Margin | Big-Pack Margin |
|---|---:|---|---:|---:|---:|---:|---:|
| Veo Lite 8s | $0.47 | Standard | 190 | $1.90 | $1.19 | 75% | 60% |
| Veo Fast 8s | $0.90 | Pro | 290 | $2.90 | $1.81 | 69% | 50% |
| Hailuo 10s | $0.91 | Pro | 300 | $3.00 | $1.88 | 70% | 51% |
| Kling Standard 10s | $1.38 | Pro | 450 | $4.50 | $2.81 | 69% | 51% |
| Kling Pro 10s | $1.82 | Pro | 590 | $5.90 | $3.69 | 69% | 51% |
| Sora 720p 8s | $2.58 | Premium | 650 | $6.50 | $4.06 | 60% | 36% |
| Sora 1080p 8s | $4.27 | Premium | 1,050 | $10.50 | $6.56 | 59% | 35% |

## 7. Why Premium Models Use Lower Margin

Expensive models such as Sora, Veo premium, 4K video, or high-end cinematic generation should not use the same margin target as cheap image generation.

If the same margin target is applied to premium models, customer-facing pricing becomes uncompetitive.

Example:

```txt
Sora 1080p 8s COGS: ~$4.27
Safe high-margin price: ~$13.50
More competitive price: ~$10.50 normal / ~$6.56 discounted
```

The lower-margin premium tier allows TaleAds to remain competitive while still protecting a margin floor.

## 8. Suggested Credit Packs

Credit packs should be more expensive than subscription credits.

| Pack | Price | Credits | Effective $ / Credit |
|---|---:|---:|---:|
| Small top-up | $20 | 2,000 | $0.0100 |
| Medium top-up | $50 | 5,500 | $0.0091 |
| Large top-up | $100 | 12,000 | $0.0083 |
| Studio pack | $500 | 70,000 | $0.0071 |
| Agency pack | $1,000 | 160,000 | $0.00625 |

The `Agency pack` defines the current `CREDIT_FLOOR_USD`.

If TaleAds later offers deeper discounts, all model pricing must be recalculated.

## 9. Suggested Subscription Credits

| Plan | Price | Credits / Month | Effective $ / Credit |
|---|---:|---:|---:|
| Starter | $39 | 4,500 | $0.0087 |
| Creator | $99 | 12,000 | $0.00825 |
| Growth | $199 | 26,000 | $0.00765 |
| Agency | $399 | 56,000 | $0.0071 |

Annual plans can add more credits, but should not go below the global credit floor unless pricing is recalculated.

## 10. Job Accounting Rules

Every generation job must store:

```txt
job_id
workspace_id
model_id
provider
provider_job_id
credits_quoted
credits_reserved
credits_captured
provider_cost_usd
effective_revenue_usd
gross_margin_usd
gross_margin_percent
user_plan
credit_purchase_source
status
created_at
completed_at
```

This is required to track margin accurately.

## 11. Credit Reservation Flow

Use a ledger, not only a balance field.

```txt
1. Estimate generation cost
2. Reserve credits
3. Start provider job
4. Capture credits on success
5. Refund credits on failure
6. Log provider cost and effective revenue
```

Ledger event types:

```txt
subscription_grant
credit_purchase
reserve
capture
refund
manual_adjustment
expiration
```

## 12. Failed Jobs And Retries

Recommended rules:

- if the provider does not charge TaleAds, refund the user fully;
- if the provider charges TaleAds and the output fails internally, refund the user and log the cost as failed COGS;
- do not offer unlimited free retries;
- for subjective retries, charge again or offer a limited revision policy;
- for provider/system errors, refund automatically.

## 13. Discount Guardrails

Large discounts are allowed only if:

- all model prices are calculated against `CREDIT_FLOOR_USD`;
- premium models consume more credits;
- no unlimited usage is offered;
- every job records actual margin;
- pricing can be updated per model;
- extremely expensive models can be marked as premium or beta.

## 14. Provider Strategy

Initial provider strategy:

```txt
Use OpenRouter for MVP speed and broad model access.
```

Scaling strategy:

```txt
Integrate directly with providers once a model has meaningful volume.
```

Candidate direct integrations:

- Google Veo / Vertex AI;
- Kling / Kuaishou;
- OpenAI image/video;
- ByteDance Seedance / Seedream;
- MiniMax Hailuo;
- Black Forest Labs / FLUX.

OpenRouter should remain available as:

- fallback;
- long-tail model catalog;
- prototyping layer;
- backup provider.

## 15. Positioning

TaleAds should not compete as the cheapest raw AI video generator.

The pricing should support this positioning:

```txt
AI ad creative workflows with brand memory, product memory, scripts,
creative angles, batch variants, premium model choice, and export-ready assets.
```

Users should pay for the workflow value, not only for seconds of AI video.

