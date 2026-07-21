# TaleLabs — Credit System Planning

**Status: planning only. Do not implement.** The product focus is the core loop (Assets → Elements → Flows → generation). This document exists so the credit system is designed deliberately before it ships, and so Phase 1 records the right data for it.

Companion to `db-design-planning-v2.md`.

---

## Phasing

```txt
Phase 1 (now):    every generation job records creditCost + providerCostUsd.
                  Deterministic jobs also capture providerCostEstimate, and the
                  canvas may show temporary advisory USD. No balances, no
                  reservations, no enforcement, nothing blocked.
Phase 2 (later):  ledger, balances, reservation lifecycle, packs/subscriptions,
                  credit-facing estimation UI, insufficient-credit enforcement.
```

Phase 1 is not "billing turned off" — it is **data collection**. Provider pricing changes over time and depends on settings (resolution, duration, steps), so per-execution cost facts cannot be reconstructed retroactively. By the time Phase 2 ships, the jobs table contains the real distribution of models, settings, provider costs, and failure rates — the credit pricing below gets calibrated against measurements, not guesses.

Phase 1 may expose a browser-local `Credits | BYOK` generation preference. This
is a funding-route choice, not a balance or billing implementation: Credits uses
the existing managed platform-provider path, while BYOK uses the user's own
browser key. There is still no ledger, reservation, balance enforcement, or
credit-denominated quote. The preference must not be confused with the separate,
currently hidden managed-BYOK execution-location control.

## The credit model

- **Credits are integers** — one atomic indivisible unit, no fractional credits. Fractional pricing granularity is achieved by scaling the unit (1 credit = small value), never by decimals.
- **Credits are the final product cost language.** Before the credit product
  exists, the canvas shows an explicitly advisory provider-cost estimate in USD
  only when the generation funding preference is Credits. BYOK does not request,
  display, persist, or require that estimate. The interim USD value is not a
  charge or a margin promise and must be replaced by the credit-facing quote
  when Phase 2 ships. Private provider identity, rates, and formula evidence
  remain server-only.
- **Pricing is a pure server-side function** of `(model, settings)` → credits, defined in versioned static config (same philosophy as the model/element registries — code-owned, not DB-owned). Every charge records the `pricingVersion` that computed it, so historical jobs remain explainable after price changes.
- **Non-expiring credits initially.** Expiring promotional buckets force FIFO consumption accounting (per-bucket balances, expiry sweeps, consumption ordering rules) — heavy machinery to carry before there's revenue. If expiry becomes a business need, it arrives as a new ledger entry type plus a sweep, not a redesign.

## Ledger design

One **append-only ledger** as the source of truth, plus one **materialized balance row per organization** for O(1) reads. The ledger is never updated or deleted; the balance is derivable from it (invariant checkable by a periodic job).

```sql
-- Phase 2 DDL sketch — naming and conventions follow db-design-planning-v2.md
create table "creditLedger" (
  "id" text primary key,
  "organizationId" text not null references "organization"("id") on delete cascade,
  "entryType" text not null check ("entryType" in (
    'purchase',            -- credit pack bought
    'subscriptionGrant',   -- monthly allowance
    'reservation',         -- hold placed before execution (negative)
    'capture',             -- reservation converted to real spend
    'release',             -- unused reservation returned (positive)
    'refund',              -- goodwill / failure compensation
    'adjustment'           -- manual support action, always with reason
  )),
  "amount" integer not null,          -- signed; the invariant is sum(amount) = balance
  "jobId" text references "generationJobs"("id"),      -- what this entry pays for
  "flowRunId" text,                                    -- FK added when flowRuns ships
  "reservationId" text,               -- groups reservation → capture/release pairs
  "pricingVersion" text,              -- config version that priced this entry
  "reason" text,                      -- required for 'adjustment' and 'refund'
  "createdBy" text references "user"("id") on delete set null,
  "createdAt" timestamptz not null default now()
);

create index "creditLedgerOrgCreatedIdx"
  on "creditLedger" ("organizationId", "createdAt" desc, "id" desc);
create index "creditLedgerJobIdx" on "creditLedger" ("jobId") where "jobId" is not null;
-- idempotency: at most one entry of a given type per job
create unique index "creditLedgerJobTypeIdx"
  on "creditLedger" ("jobId", "entryType") where "jobId" is not null;

create table "creditBalances" (
  "organizationId" text primary key references "organization"("id") on delete cascade,
  "balance" integer not null default 0,
  "reserved" integer not null default 0,   -- sum of open reservations
  "updatedAt" timestamptz not null default now()
);
```

**Concurrency rule:** every balance mutation is one transaction that (1) locks the org's `creditBalances` row (`select ... for update`), (2) checks sufficiency, (3) inserts the ledger entry, (4) updates the balance. The row lock serializes concurrent generations within an org; cross-org traffic never contends. The partial unique index makes double-capture for the same job structurally impossible, so a retried Trigger.dev task can safely re-run its billing step.

## Reservation lifecycle (single node run)

```txt
estimate (UI, advisory)
-> create job + RESERVE estimated credits        (one transaction; insufficient -> reject, no job row)
-> execute via Trigger.dev
-> success: CAPTURE actual cost, RELEASE remainder
-> billable failure (provider generated, we can't bill user for nothing usable): policy below
-> non-billable failure / cancel before provider spend: RELEASE full reservation
```

Decisions embedded there:

- **Reserve at job create, atomically with the insert.** A job row existing means credits are held — no window where execution starts unfunded.
- **Actual may differ from estimate.** Capture actual, capped at the reservation. If actual would exceed the reservation (estimate bug, provider surprise), capture the reservation, log the delta as margin loss, and fix the estimator — never surprise-charge beyond what was shown.
- **Failure policy is provider-cost-aware:** if the provider charged us but the user got nothing usable (ingestion failure, corrupt output), the user is **not** charged — release the reservation and record `providerCostUsd` as eaten margin. The jobs table already separates `creditCost` (what the user paid) from `providerCostUsd` (what we paid), so margin reporting falls out of a query.
- The client-facing `estimate` endpoint is advisory; the reserve amount is always recomputed server-side from the same pricing function (v1 API doc's rule, carried forward).

## Flow-run billing (whole-graph execution)

The interesting design question. Three options:

| Option                            | Mechanics                                                                                                                             | Problem                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. Aggregate reservation up front | Estimate whole plan, reserve total, capture per node                                                                                  | Downstream node settings can depend on upstream outputs — the up-front estimate is partly fiction; long runs hold large reservations             |
| B. Per-node reservation only      | Each child job reserves as it's created                                                                                               | A run can die from insufficient credits halfway through — worst UX, wasted partial spend                                                         |
| C. **Hybrid (recommended)**       | Pre-check `balance − reserved ≥ planEstimate` at run start (no hold), then reserve per node just-in-time as each child job is created | A concurrent spender can still starve a running flow — rare, and the failure mode is a clean `partial` run with everything completed so far kept |

Recommendation: **C.** It matches the just-in-time child-job creation model from the DB doc (downstream jobs don't exist until upstream outputs do), never holds more than the currently-executing level, and its worst case is exactly the partial-failure behavior the run model already handles. Completed outputs are durable assets; the user tops up and re-runs the remainder — and already-succeeded nodes' outputs feed the re-run as `nodeOutput` sources without regenerating (no double spend).

The run row denormalizes `creditCost` (sum of child captures) at completion for cheap history lists; the ledger remains the truth.

## Packs and subscriptions (sketch, decisions deferred)

- Purchases and subscription grants are just ledger entry types — Stripe (or similar) webhooks insert `purchase` / `subscriptionGrant` entries idempotently (webhook event id as natural idempotency key).
- Subscription allowance reset strategy (grant monthly vs. rolling) changes ledger entries only, not schema.
- Price points, pack sizes, and margin targets are business decisions to be made against Phase 1 data — deliberately not guessed here.

## What Phase 1 must do (the full list)

1. Compute and store `creditCost` on every job at completion, via the pricing function, even though nothing is charged — the function gets exercised and validated long before money depends on it.
2. Store `providerCostUsd` from provider responses/receipts at execution time.
3. Record `pricingVersion` inside `generationJobs."settings"` or alongside cost fields when the pricing function lands (one column, add with the pricing function).
4. Nothing else. No balances, no ledger, no enforcement, no UI.

## Open decisions (for when Phase 2 is scheduled)

- Credit unit value and pack pricing (needs Phase 1 data + margin targets).
- Whether failed-but-provider-charged jobs ever pass cost to users (recommended: no, eat it — trust compounds).
- Subscription model: allowance + overage packs vs. pure packs.
- Whether flow-run pre-check uses optimistic (`balance − reserved`) or pessimistic (aggregate hold) accounting — recommended optimistic (Option C) pending real usage patterns.
- Promotional/expiring credits: only if marketing needs them; brings FIFO bucket accounting with it.
- Refund policy surface (self-serve vs. support-only adjustments).
