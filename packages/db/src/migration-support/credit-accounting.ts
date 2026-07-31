/** Creates append-only credit accounting and organization storage authority. */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds grants, reservations, ledger entries, storage, and initial projections. */
export async function createCreditAccountingSchema(db: Kysely<unknown>) {
  await sql`
    create table "creditGrants" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "source" text not null check (
        "source" in ('founder_welcome', 'subscription', 'purchase', 'manual')
      ),
      "originalCredits" integer not null check ("originalCredits" > 0),
      "availableCredits" integer not null default 0
        check ("availableCredits" >= 0),
      "reservedCredits" integer not null default 0
        check ("reservedCredits" >= 0),
      "capturedCredits" integer not null default 0
        check ("capturedCredits" >= 0),
      "reversedCredits" integer not null default 0
        check ("reversedCredits" >= 0),
      "grantPeriodStart" timestamptz,
      "grantPeriodEnd" timestamptz,
      "expiresAt" timestamptz,
      "planCode" text check (
        "planCode" is null or "planCode" in ('free', 'creator', 'pro')
      ),
      "offerCode" text,
      "catalogRevision" text not null,
      "stripeSubscriptionId" text,
      "stripeInvoiceId" text,
      "creditPurchaseId" text,
      "recognizedRevenueUsdCents" integer check (
        "recognizedRevenueUsdCents" is null
        or "recognizedRevenueUsdCents" >= 0
      ),
      "outputVisibility" text not null
        check ("outputVisibility" in ('private', 'public')),
      "showcaseEligible" boolean not null,
      "idempotencyKey" text not null,
      "createdBy" text references "user" ("id") on delete set null,
      "createdAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "idempotencyKey"),
      foreign key ("organizationId", "stripeSubscriptionId")
        references "billingSubscriptions" (
          "organizationId", "stripeSubscriptionId"
        ),
      foreign key ("organizationId", "creditPurchaseId")
        references "creditPurchases" ("organizationId", "id"),
      check (
        "availableCredits" + "reservedCredits" + "capturedCredits"
          + "reversedCredits" = "originalCredits"
      ),
      check (
        ("grantPeriodStart" is null and "grantPeriodEnd" is null)
        or (
          "grantPeriodStart" is not null
          and "grantPeriodEnd" is not null
          and "grantPeriodEnd" > "grantPeriodStart"
        )
      ),
      check (
        ("outputVisibility" = 'public' and "showcaseEligible")
        or ("outputVisibility" = 'private' and not "showcaseEligible")
      ),
      check (
        ("source" = 'founder_welcome'
          and "planCode" = 'free'
          and "creditPurchaseId" is null
          and "stripeSubscriptionId" is null)
        or ("source" = 'subscription'
          and "planCode" in ('creator', 'pro')
          and "offerCode" is not null
          and "stripeSubscriptionId" is not null
          and "stripeInvoiceId" is not null
          and "grantPeriodStart" is not null)
        or ("source" = 'purchase'
          and "creditPurchaseId" is not null
          and "recognizedRevenueUsdCents" is not null)
        or "source" = 'manual'
      )
    )
  `.execute(db)
  await sql`
    create unique index "creditGrantsFounderUidx"
      on "creditGrants" ("organizationId")
      where "source" = 'founder_welcome'
  `.execute(db)
  await sql`
    create unique index "creditGrantsSubscriptionPeriodUidx"
      on "creditGrants" (
        "organizationId", "stripeSubscriptionId", "grantPeriodStart"
      )
      where "source" = 'subscription'
  `.execute(db)
  await sql`
    create unique index "creditGrantsPurchaseUidx"
      on "creditGrants" ("creditPurchaseId")
      where "creditPurchaseId" is not null
  `.execute(db)
  await sql`
    create index "creditGrantsAllocationIdx"
      on "creditGrants" (
        "organizationId", "outputVisibility", "createdAt", "id"
      )
      where "availableCredits" > 0
  `.execute(db)
  await sql`
    alter table "creditPurchases"
      add constraint "creditPurchasesGrantFk"
      foreign key ("organizationId", "creditGrantId")
      references "creditGrants" ("organizationId", "id")
  `.execute(db)

  await sql`
    create table "creditBalances" (
      "organizationId" text primary key
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "availableCredits" integer not null default 0
        check ("availableCredits" >= 0),
      "reservedCredits" integer not null default 0
        check ("reservedCredits" >= 0),
      "version" bigint not null default 0 check ("version" >= 0),
      "updatedAt" timestamptz not null default now()
    )
  `.execute(db)

  await sql`
    create table "creditReservations" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "flowRunId" text not null,
      "status" text not null default 'reserved'
        check ("status" in ('reserved', 'partial', 'captured', 'released')),
      "quotedCredits" integer not null check ("quotedCredits" > 0),
      "reservedCredits" integer not null check ("reservedCredits" >= 0),
      "capturedCredits" integer not null default 0
        check ("capturedCredits" >= 0),
      "releasedCredits" integer not null default 0
        check ("releasedCredits" >= 0),
      "pricingPolicyVersion" text not null,
      "createdAt" timestamptz not null default now(),
      "closedAt" timestamptz,
      unique ("organizationId", "id"),
      unique ("organizationId", "flowRunId"),
      unique ("id", "flowRunId", "organizationId"),
      foreign key ("flowRunId", "organizationId")
        references "flowRuns" ("id", "organizationId"),
      check (
        "reservedCredits" + "capturedCredits" + "releasedCredits"
          = "quotedCredits"
      ),
      check (
        (
          "reservedCredits" > 0
          and "status" in ('reserved', 'partial')
          and "closedAt" is null
        )
        or (
          "reservedCredits" = 0
          and "status" in ('partial', 'captured', 'released')
          and "closedAt" is not null
        )
      )
    )
  `.execute(db)
  await sql`
    alter table "flowRuns"
      add constraint "flowRunsCreditReservationFk"
      foreign key ("creditReservationId", "id", "organizationId")
      references "creditReservations" (
        "id", "flowRunId", "organizationId"
      )
  `.execute(db)

  await sql`
    create table "creditReservationItems" (
      "id" text primary key,
      "organizationId" text not null,
      "creditReservationId" text not null,
      "generationJobId" text not null,
      "quotedCredits" integer not null check ("quotedCredits" > 0),
      "capturedCredits" integer not null default 0
        check ("capturedCredits" >= 0),
      "releasedCredits" integer not null default 0
        check ("releasedCredits" >= 0),
      "outputVisibility" text not null
        check ("outputVisibility" in ('private', 'public')),
      "showcaseEligible" boolean not null,
      "status" text not null default 'reserved'
        check ("status" in ('reserved', 'captured', 'released')),
      unique ("organizationId", "id"),
      unique ("organizationId", "generationJobId"),
      foreign key ("organizationId", "creditReservationId")
        references "creditReservations" ("organizationId", "id"),
      foreign key ("organizationId", "generationJobId")
        references "generationJobs" ("organizationId", "id"),
      check ("capturedCredits" + "releasedCredits" <= "quotedCredits"),
      check (
        ("status" = 'reserved'
          and "capturedCredits" = 0 and "releasedCredits" = 0)
        or ("status" = 'captured'
          and "capturedCredits" = "quotedCredits"
          and "releasedCredits" = 0)
        or ("status" = 'released'
          and "releasedCredits" = "quotedCredits"
          and "capturedCredits" = 0)
      ),
      check (
        ("outputVisibility" = 'public' and "showcaseEligible")
        or ("outputVisibility" = 'private' and not "showcaseEligible")
      )
    )
  `.execute(db)

  await sql`
    create table "creditReservationAllocations" (
      "organizationId" text not null,
      "creditReservationItemId" text not null,
      "creditGrantId" text not null,
      "reservedCredits" integer not null check ("reservedCredits" >= 0),
      "capturedCredits" integer not null default 0
        check ("capturedCredits" >= 0),
      "releasedCredits" integer not null default 0
        check ("releasedCredits" >= 0),
      "sortOrder" integer not null check ("sortOrder" >= 0),
      primary key ("creditReservationItemId", "creditGrantId"),
      unique ("creditReservationItemId", "sortOrder"),
      foreign key ("organizationId", "creditReservationItemId")
        references "creditReservationItems" ("organizationId", "id"),
      foreign key ("organizationId", "creditGrantId")
        references "creditGrants" ("organizationId", "id"),
      check (
        "reservedCredits" + "capturedCredits" + "releasedCredits" > 0
      )
    )
  `.execute(db)

  await sql`
    create table "creditLedgerEntries" (
      "id" text primary key,
      "organizationId" text not null
        references "organizationBillingAccounts" ("organizationId")
        on delete cascade,
      "entryType" text not null check (
        "entryType" in (
          'grant', 'reserve', 'capture', 'release', 'reverse', 'adjustment'
        )
      ),
      "availableDelta" integer not null,
      "reservedDelta" integer not null,
      "creditGrantId" text,
      "creditReservationId" text,
      "creditReservationItemId" text,
      "flowRunId" text,
      "generationJobId" text,
      "stripeInvoiceId" text,
      "creditPurchaseId" text,
      "idempotencyKey" text not null,
      "reasonCode" text not null,
      "createdBy" text references "user" ("id") on delete set null,
      "createdAt" timestamptz not null default now(),
      unique ("organizationId", "id"),
      unique ("organizationId", "idempotencyKey"),
      foreign key ("organizationId", "creditGrantId")
        references "creditGrants" ("organizationId", "id"),
      foreign key ("organizationId", "creditReservationId")
        references "creditReservations" ("organizationId", "id"),
      foreign key ("organizationId", "creditReservationItemId")
        references "creditReservationItems" ("organizationId", "id"),
      foreign key ("flowRunId", "organizationId")
        references "flowRuns" ("id", "organizationId"),
      foreign key ("generationJobId", "organizationId")
        references "generationJobs" ("id", "organizationId"),
      foreign key ("organizationId", "creditPurchaseId")
        references "creditPurchases" ("organizationId", "id"),
      check (
        ("entryType" = 'grant'
          and "availableDelta" > 0 and "reservedDelta" = 0)
        or ("entryType" = 'reserve'
          and "availableDelta" < 0
          and "reservedDelta" = -"availableDelta")
        or ("entryType" = 'capture'
          and "availableDelta" = 0 and "reservedDelta" < 0)
        or ("entryType" = 'release'
          and "availableDelta" > 0
          and "reservedDelta" = -"availableDelta")
        or ("entryType" = 'reverse'
          and "availableDelta" < 0 and "reservedDelta" = 0)
        or ("entryType" = 'adjustment'
          and ("availableDelta" <> 0 or "reservedDelta" <> 0))
      )
    )
  `.execute(db)
  await sql`
    create index "creditLedgerEntriesOrgCursorIdx"
      on "creditLedgerEntries" ("organizationId", "createdAt" desc, "id" desc)
  `.execute(db)
  await sql`
    create index "creditLedgerEntriesRunIdx"
      on "creditLedgerEntries" ("organizationId", "flowRunId")
      where "flowRunId" is not null
  `.execute(db)

  await sql`
    create table "organizationStorageUsage" (
      "organizationId" text primary key
        references "organization" ("id") on delete cascade,
      "usedBytes" bigint not null default 0 check ("usedBytes" >= 0),
      "reservedBytes" bigint not null default 0 check ("reservedBytes" >= 0),
      "version" bigint not null default 0 check ("version" >= 0),
      "updatedAt" timestamptz not null default now()
    )
  `.execute(db)

  await sql`
    insert into "organizationBillingAccounts" (
      "organizationId", "catalogRevision"
    )
    select "id", '2026-07-27.5'
    from "organization"
    on conflict ("organizationId") do nothing
  `.execute(db)
  await sql`
    insert into "creditBalances" ("organizationId")
    select "id"
    from "organization"
    on conflict ("organizationId") do nothing
  `.execute(db)
  await sql`
    insert into "organizationStorageUsage" (
      "organizationId", "usedBytes"
    )
    select
      organization."id",
      coalesce(sum(
        case
          when asset."purgedAt" is null then coalesce(asset."sizeBytes", 0)
          else 0
        end
      ), 0)::bigint
    from "organization" organization
    left join "assets" asset
      on asset."organizationId" = organization."id"
    group by organization."id"
    on conflict ("organizationId") do update
    set
      "usedBytes" = excluded."usedBytes",
      "updatedAt" = now()
  `.execute(db)
}
