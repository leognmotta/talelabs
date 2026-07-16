import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds durable paid-result recovery and callback wake-up state. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "generationJobs"
      add column "providerWaitTokenId" text,
      add column "providerCompletionStatus" text,
      add column "providerCompletionEventId" text,
      add column "providerCompletionReceivedAt" timestamptz,
      add constraint "generationJobs_provider_completion_status_check"
        check (
          "providerCompletionStatus" is null
          or "providerCompletionStatus" in (
            'completed', 'failed', 'cancelled', 'expired'
          )
        ),
      add constraint "generationJobs_provider_completion_event_check"
        check (
          ("providerCompletionStatus" is null
            and "providerCompletionReceivedAt" is null)
          or ("providerCompletionStatus" is not null
            and "providerCompletionReceivedAt" is not null)
        )
  `.execute(db)

  await sql`
    create table "generationProviderResults" (
      "organizationId" text not null
        references "organization"("id") on delete cascade,
      "jobId" text not null,
      "expectedOutputCount" smallint not null,
      "providerGenerationId" text,
      "providerCostUsd" numeric(20, 10),
      "createdAt" timestamptz not null default now(),
      primary key ("jobId"),
      unique ("jobId", "organizationId"),
      constraint "generationProviderResults_output_count_check"
        check ("expectedOutputCount" between 1 and 32),
      foreign key ("jobId", "organizationId")
        references "generationJobs" ("id", "organizationId")
        on delete cascade
    )
  `.execute(db)

  await sql`
    create table "generationProviderOutputs" (
      "organizationId" text not null
        references "organization"("id") on delete cascade,
      "jobId" text not null,
      "outputIndex" smallint not null,
      "mediaType" text not null,
      "status" text not null default 'staging',
      "delivery" text not null,
      "mimeType" text,
      "storageBucket" text,
      "storageKey" text,
      "text" text,
      "metadata" jsonb not null default '{}'::jsonb,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      primary key ("jobId", "outputIndex"),
      constraint "generationProviderOutputs_index_check"
        check ("outputIndex" >= 0),
      constraint "generationProviderOutputs_media_type_check"
        check ("mediaType" in ('audio', 'image', 'text', 'video')),
      constraint "generationProviderOutputs_status_check"
        check ("status" in ('staging', 'ready')),
      constraint "generationProviderOutputs_delivery_check"
        check (
          ("delivery" = 'text'
            and "mediaType" = 'text'
            and "text" is not null
            and "mimeType" is null
            and "storageBucket" is null
            and "storageKey" is null)
          or ("delivery" = 'storage'
            and "mediaType" <> 'text'
            and "text" is null
            and "mimeType" is not null
            and "storageBucket" is not null
            and "storageKey" is not null)
        ),
      constraint "generationProviderOutputs_metadata_check"
        check (jsonb_typeof("metadata") = 'object'),
      foreign key ("jobId", "organizationId")
        references "generationProviderResults" ("jobId", "organizationId")
        on delete cascade
    )
  `.execute(db)

  await sql`
    create index "generationProviderOutputsOrgJobIdx"
      on "generationProviderOutputs" (
        "organizationId", "jobId", "status", "outputIndex"
      )
  `.execute(db)
}

/** Provider-result checkpoints are intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
