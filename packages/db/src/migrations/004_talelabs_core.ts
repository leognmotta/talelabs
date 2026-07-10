import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    create table "folders" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "parentId" text,
      "name" text not null,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("id", "organizationId"),
      foreign key ("parentId", "organizationId")
        references "folders" ("id", "organizationId") on delete cascade
    )
  `.execute(db)
  await sql`create index "foldersOrgIdx" on "folders" ("organizationId")`.execute(
    db,
  )
  await sql`create index "foldersParentIdx" on "folders" ("parentId")`.execute(
    db,
  )

  await sql`
    create table "flows" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "name" text not null,
      "viewport" jsonb not null default '{"x": 0, "y": 0, "zoom": 1}',
      "revision" bigint not null default 0,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("id", "organizationId")
    )
  `.execute(db)
  await sql`
    create index "flowsOrgUpdatedIdx"
      on "flows" ("organizationId", "updatedAt" desc, "id" desc)
  `.execute(db)

  await sql`
    create table "flowRuns" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "flowId" text,
      "mode" text not null check ("mode" in ('node', 'downstream', 'all', 'tool')),
      "targetNodeId" text,
      "status" text not null default 'pending'
        check ("status" in ('pending', 'running', 'succeeded', 'partial', 'failed', 'canceled')),
      "graphSnapshot" jsonb not null default '{}',
      "snapshotVersion" smallint not null default 1,
      "idempotencyKey" text not null,
      "requestHash" text not null,
      "triggerRunId" text,
      "creditCost" integer,
      "errorCode" text,
      "errorMessage" text,
      "createdAt" timestamptz not null default now(),
      "startedAt" timestamptz,
      "completedAt" timestamptz,
      unique ("id", "organizationId"),
      check ("mode" not in ('node', 'downstream') or "targetNodeId" is not null),
      foreign key ("flowId", "organizationId")
        references "flows" ("id", "organizationId") on delete set null ("flowId")
    )
  `.execute(db)
  await sql`
    create index "flowRunsOrgCreatedIdx"
      on "flowRuns" ("organizationId", "createdAt" desc, "id" desc)
  `.execute(db)
  await sql`create index "flowRunsFlowIdx" on "flowRuns" ("flowId")`.execute(
    db,
  )
  await sql`
    create index "flowRunsUndispatchedIdx" on "flowRuns" ("createdAt")
      where "status" = 'pending' and "triggerRunId" is null and "mode" <> 'node'
  `.execute(db)
  await sql`
    create index "flowRunsOrgActiveIdx" on "flowRuns" ("organizationId")
      where "status" in ('pending', 'running')
  `.execute(db)
  await sql`
    create unique index "flowRunsIdempotencyIdx"
      on "flowRuns" ("organizationId", "idempotencyKey")
  `.execute(db)
  await sql`
    create unique index "flowRunsTriggerRunIdx" on "flowRuns" ("triggerRunId")
      where "triggerRunId" is not null
  `.execute(db)

  await sql`
    create table "generationJobs" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "flowRunId" text not null,
      "flowId" text,
      "nodeId" text not null,
      "mediaType" text not null check ("mediaType" in ('image', 'video', 'audio')),
      "status" text not null default 'pending'
        check ("status" in ('pending', 'running', 'succeeded', 'failed', 'canceled')),
      "provider" text not null,
      "model" text not null,
      "settings" jsonb not null default '{}',
      "resolvedPrompt" text,
      "idempotencyKey" text not null,
      "requestHash" text not null,
      "triggerRunId" text,
      "providerSubmittedAt" timestamptz,
      "providerJobId" text,
      "creditCost" integer,
      "providerCostUsd" numeric(12, 6),
      "errorCode" text,
      "errorMessage" text,
      "createdAt" timestamptz not null default now(),
      "startedAt" timestamptz,
      "completedAt" timestamptz,
      unique ("id", "organizationId"),
      unique ("id", "flowRunId", "nodeId", "organizationId"),
      foreign key ("flowRunId", "organizationId")
        references "flowRuns" ("id", "organizationId"),
      foreign key ("flowId", "organizationId")
        references "flows" ("id", "organizationId") on delete set null ("flowId")
    )
  `.execute(db)
  await sql`create index "generationJobsFlowRunIdx" on "generationJobs" ("flowRunId")`.execute(
    db,
  )
  await sql`
    create index "generationJobsOrgCreatedIdx"
      on "generationJobs" ("organizationId", "createdAt" desc, "id" desc)
  `.execute(db)
  await sql`
    create index "generationJobsNodeHistoryIdx"
      on "generationJobs" ("flowId", "nodeId", "createdAt" desc, "id" desc)
  `.execute(db)
  await sql`
    create index "generationJobsUndispatchedIdx" on "generationJobs" ("createdAt")
      where "status" = 'pending' and "triggerRunId" is null
  `.execute(db)
  await sql`
    create unique index "generationJobsIdempotencyIdx"
      on "generationJobs" ("organizationId", "idempotencyKey")
  `.execute(db)
  await sql`
    create unique index "generationJobsTriggerRunIdx" on "generationJobs" ("triggerRunId")
      where "triggerRunId" is not null
  `.execute(db)
  await sql`
    create unique index "generationJobsProviderJobIdx"
      on "generationJobs" ("provider", "providerJobId")
      where "providerJobId" is not null
  `.execute(db)

  await sql`
    create table "flowRunNodes" (
      "organizationId" text not null references "organization"("id") on delete cascade,
      "flowRunId" text not null,
      "nodeId" text not null,
      "status" text not null default 'pending'
        check ("status" in ('pending', 'running', 'succeeded', 'failed', 'skipped', 'canceled')),
      "jobId" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      primary key ("flowRunId", "nodeId"),
      foreign key ("flowRunId", "organizationId")
        references "flowRuns" ("id", "organizationId") on delete cascade,
      foreign key ("jobId", "flowRunId", "nodeId", "organizationId")
        references "generationJobs" ("id", "flowRunId", "nodeId", "organizationId")
        on delete set null ("jobId")
    )
  `.execute(db)
  await sql`
    create index "flowRunNodesJobIdx" on "flowRunNodes" ("jobId")
      where "jobId" is not null
  `.execute(db)

  await sql`
    create table "assets" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "name" text not null,
      "type" text not null check ("type" in ('image', 'video', 'audio', 'document')),
      "source" text not null check ("source" in ('upload', 'generation')),
      "storageKey" text not null unique,
      "thumbnailKey" text,
      "mimeType" text not null,
      "sizeBytes" bigint,
      "width" integer,
      "height" integer,
      "durationSeconds" numeric(10, 3),
      "folderId" text,
      "generationJobId" text,
      "outputIndex" smallint,
      "uploadId" text,
      "metadata" jsonb not null default '{}',
      "processingState" text not null default 'processing'
        check ("processingState" in ('processing', 'ready', 'failed')),
      "processingError" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      "deletedAt" timestamptz,
      "purgeRequestedAt" timestamptz,
      "purgedAt" timestamptz,
      unique ("id", "organizationId"),
      check (
        ("source" = 'generation'
          and "generationJobId" is not null and "outputIndex" is not null and "outputIndex" >= 0)
        or ("source" = 'upload'
          and "generationJobId" is null and "outputIndex" is null)
      ),
      check ("purgeRequestedAt" is null or "deletedAt" is not null),
      check ("purgedAt" is null or "purgeRequestedAt" is not null),
      check (("processingState" = 'failed') = ("processingError" is not null)),
      foreign key ("folderId", "organizationId")
        references "folders" ("id", "organizationId") on delete set null ("folderId"),
      foreign key ("generationJobId", "organizationId")
        references "generationJobs" ("id", "organizationId")
    )
  `.execute(db)
  await sql`
    create index "assetsOrgCreatedIdx"
      on "assets" ("organizationId", "createdAt" desc, "id" desc)
      where "deletedAt" is null and "purgedAt" is null
  `.execute(db)
  await sql`
    create index "assetsOrgTypeIdx" on "assets" ("organizationId", "type")
      where "deletedAt" is null and "purgedAt" is null
  `.execute(db)
  await sql`
    create index "assetsFolderIdx" on "assets" ("folderId")
      where "deletedAt" is null and "purgedAt" is null
  `.execute(db)
  await sql`
    create unique index "assetsJobOutputIdx" on "assets" ("generationJobId", "outputIndex")
      where "generationJobId" is not null
  `.execute(db)
  await sql`
    create unique index "assetsUploadIdIdx" on "assets" ("uploadId")
      where "uploadId" is not null
  `.execute(db)
  await sql`
    create index "assetsPurgePendingIdx" on "assets" ("purgeRequestedAt")
      where "purgeRequestedAt" is not null and "purgedAt" is null
  `.execute(db)
  await sql`
    create index "assetsProcessingIdx" on "assets" ("createdAt")
      where "processingState" = 'processing' and "purgeRequestedAt" is null
  `.execute(db)

  await sql`
    create table "elements" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "createdBy" text references "user"("id") on delete set null,
      "type" text not null,
      "name" text not null,
      "instructions" text,
      "data" jsonb not null default '{}',
      "schemaVersion" smallint not null default 1,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("id", "organizationId")
    )
  `.execute(db)
  await sql`
    create index "elementsOrgTypeIdx" on "elements" ("organizationId", "type")
  `.execute(db)
  await sql`
    create index "elementsOrgUpdatedIdx"
      on "elements" ("organizationId", "updatedAt" desc, "id" desc)
  `.execute(db)

  await sql`
    create table "elementAssets" (
      "organizationId" text not null references "organization"("id") on delete cascade,
      "elementId" text not null,
      "assetId" text not null,
      "role" text not null,
      "sortOrder" smallint not null default 0,
      "isPrimary" boolean not null default false,
      "createdAt" timestamptz not null default now(),
      primary key ("elementId", "assetId", "role"),
      foreign key ("elementId", "organizationId")
        references "elements" ("id", "organizationId") on delete cascade,
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId") on delete cascade
    )
  `.execute(db)
  await sql`create index "elementAssetsAssetIdx" on "elementAssets" ("assetId")`.execute(
    db,
  )
  await sql`
    create unique index "elementAssetsPrimaryIdx"
      on "elementAssets" ("elementId", "role") where "isPrimary"
  `.execute(db)

  await sql`
    create table "flowNodes" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "flowId" text not null,
      "type" text not null,
      "positionX" double precision not null,
      "positionY" double precision not null,
      "elementId" text,
      "assetId" text,
      "data" jsonb not null default '{}',
      "schemaVersion" smallint not null default 1,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      unique ("flowId", "id"),
      foreign key ("flowId", "organizationId")
        references "flows" ("id", "organizationId") on delete cascade,
      foreign key ("elementId", "organizationId")
        references "elements" ("id", "organizationId") on delete set null ("elementId"),
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId") on delete set null ("assetId")
    )
  `.execute(db)
  await sql`create index "flowNodesFlowIdx" on "flowNodes" ("flowId")`.execute(
    db,
  )
  await sql`
    create index "flowNodesElementIdx" on "flowNodes" ("elementId")
      where "elementId" is not null
  `.execute(db)
  await sql`
    create index "flowNodesAssetIdx" on "flowNodes" ("assetId")
      where "assetId" is not null
  `.execute(db)

  await sql`
    create table "flowEdges" (
      "id" text primary key,
      "flowId" text not null,
      "sourceNodeId" text not null,
      "targetNodeId" text not null,
      "sourceHandle" text,
      "targetHandle" text,
      "createdAt" timestamptz not null default now(),
      foreign key ("flowId", "sourceNodeId")
        references "flowNodes" ("flowId", "id") on delete cascade,
      foreign key ("flowId", "targetNodeId")
        references "flowNodes" ("flowId", "id") on delete cascade,
      unique nulls not distinct
        ("flowId", "sourceNodeId", "sourceHandle", "targetNodeId", "targetHandle")
    )
  `.execute(db)
  await sql`create index "flowEdgesFlowIdx" on "flowEdges" ("flowId")`.execute(
    db,
  )
  await sql`create index "flowEdgesTargetIdx" on "flowEdges" ("targetNodeId")`.execute(
    db,
  )

  await sql`
    create table "generationJobSources" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "jobId" text not null,
      "sortOrder" smallint not null,
      "sourceType" text not null
        check ("sourceType" in ('text', 'element', 'asset', 'nodeOutput')),
      "nodeId" text not null,
      "elementId" text,
      "assetId" text,
      "resolvedText" text,
      "snapshot" jsonb not null default '{}',
      unique ("jobId", "sortOrder"),
      unique ("jobId", "id"),
      foreign key ("jobId", "organizationId")
        references "generationJobs" ("id", "organizationId") on delete cascade,
      foreign key ("elementId", "organizationId")
        references "elements" ("id", "organizationId") on delete set null ("elementId"),
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId") on delete set null ("assetId")
    )
  `.execute(db)
  await sql`
    create index "generationJobSourcesJobIdx" on "generationJobSources" ("jobId")
  `.execute(db)
  await sql`
    create index "generationJobSourcesElementIdx" on "generationJobSources" ("elementId")
      where "elementId" is not null
  `.execute(db)

  await sql`
    create table "generationJobInputs" (
      "organizationId" text not null references "organization"("id") on delete cascade,
      "jobId" text not null,
      "assetId" text not null,
      "sourceId" text,
      "role" text not null default 'reference',
      "sortOrder" smallint not null,
      primary key ("jobId", "assetId", "role"),
      unique ("jobId", "sortOrder"),
      foreign key ("jobId", "organizationId")
        references "generationJobs" ("id", "organizationId") on delete cascade,
      foreign key ("assetId", "organizationId")
        references "assets" ("id", "organizationId"),
      foreign key ("jobId", "sourceId")
        references "generationJobSources" ("jobId", "id")
        on delete set null ("sourceId")
    )
  `.execute(db)
  await sql`
    create index "generationJobInputsAssetIdx" on "generationJobInputs" ("assetId")
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table "generationJobInputs"`.execute(db)
  await sql`drop table "generationJobSources"`.execute(db)
  await sql`drop table "flowEdges"`.execute(db)
  await sql`drop table "flowNodes"`.execute(db)
  await sql`drop table "elementAssets"`.execute(db)
  await sql`drop table "elements"`.execute(db)
  await sql`drop table "assets"`.execute(db)
  await sql`drop table "flowRunNodes"`.execute(db)
  await sql`drop table "generationJobs"`.execute(db)
  await sql`drop table "flowRuns"`.execute(db)
  await sql`drop table "flows"`.execute(db)
  await sql`drop table "folders"`.execute(db)
}
