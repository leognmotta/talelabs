import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/**
 * Reconciles the pre-M5 run ledger with the durable work-item contract.
 *
 * This migration is intentionally forward-only: historical execution rows are
 * retained and deterministically marked as pre-M5 rather than reinterpreted as
 * newly planned work.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      drop constraint if exists "flowRuns_mode_check",
      drop constraint if exists "flowRuns_check",
      add column "snapshotHash" text,
      add column "executorVersion" text,
      add column "retryOfRunId" text,
      add column "providerCostUsd" numeric(12, 6)
  `.execute(db)

  // Pre-M5 snapshots were never executable durable-run artifacts. Give any
  // development/history rows an auditable hash and explicit legacy executor
  // marker without pretending they used the new canonical serializer.
  await sql`
    update "flowRuns"
    set
      "snapshotHash" = encode(
        sha256(
          convert_to(
            'talelabs:legacy-run-snapshot:v0' || "graphSnapshot"::text,
            'UTF8'
          )
        ),
        'hex'
      ),
      "executorVersion" = 'legacy-pre-m5'
  `.execute(db)

  await sql`
    alter table "flowRuns"
      alter column "snapshotHash" set not null,
      alter column "executorVersion" set not null,
      add constraint "flowRunsModeCheck"
        check (
          "mode" in (
            'node',
            'downstream',
            'upstream',
            'selection',
            'all',
            'tool'
          )
        ),
      add constraint "flowRunsTargetNodeCheck"
        check (
          "mode" not in ('node', 'downstream', 'upstream')
          or "targetNodeId" is not null
        ),
      add constraint "flowRunsSnapshotVersionCheck"
        check ("snapshotVersion" > 0),
      add constraint "flowRunsSnapshotHashCheck"
        check ("snapshotHash" ~ '^[0-9a-f]{64}$'),
      add constraint "flowRunsExecutorVersionCheck"
        check (length("executorVersion") > 0),
      add constraint "flowRunsRetryNotSelfCheck"
        check ("retryOfRunId" is null or "retryOfRunId" <> "id"),
      add constraint "flowRunsRetryOfFk"
        foreign key ("retryOfRunId", "organizationId")
        references "flowRuns" ("id", "organizationId")
        on delete set null ("retryOfRunId")
  `.execute(db)

  await sql`drop index if exists "flowRunsUndispatchedIdx"`.execute(db)
  await sql`
    create index "flowRunsUndispatchedIdx" on "flowRuns" ("createdAt")
      where "status" = 'pending' and "triggerRunId" is null
  `.execute(db)
  await sql`
    create index "flowRunsRetryOfIdx" on "flowRuns" ("retryOfRunId")
      where "retryOfRunId" is not null
  `.execute(db)

  await sql`
    create function "protectFlowRunSnapshot"()
    returns trigger
    language plpgsql
    as $$
    begin
      if old."graphSnapshot" is distinct from new."graphSnapshot"
        or old."snapshotVersion" is distinct from new."snapshotVersion"
        or old."snapshotHash" is distinct from new."snapshotHash"
        or old."executorVersion" is distinct from new."executorVersion"
      then
        raise exception 'flow run snapshots are immutable'
          using errcode = '23514';
      end if;
      return new;
    end;
    $$
  `.execute(db)
  await sql`
    create trigger "flowRunsSnapshotImmutableTrigger"
    before update on "flowRuns"
    for each row execute function "protectFlowRunSnapshot"()
  `.execute(db)

  await sql`
    alter table "generationJobs"
      drop constraint if exists "generationJobs_mediaType_check",
      add column "itemKey" text,
      add column "requestIndex" integer not null default 0,
      add column "operation" text,
      add column "providerModel" text,
      add column "modelRegistryVersion" text,
      add column "providerRouteVersion" text,
      add column "adapterVersion" text,
      add constraint "generationJobsMediaTypeCheck"
        check ("mediaType" in ('text', 'image', 'video', 'audio')),
      add constraint "generationJobsRequestIndexCheck"
        check ("requestIndex" >= 0)
  `.execute(db)

  await sql`
    update "generationJobs"
    set
      "itemKey" = 'legacy-job:' || "id",
      "operation" = 'legacy',
      "providerModel" = "model",
      "modelRegistryVersion" = 'legacy-pre-m5',
      "providerRouteVersion" = 'legacy-pre-m5',
      "adapterVersion" = 'legacy-pre-m5'
  `.execute(db)

  // The released schema did not require a summary row for every job. Repair
  // that historical gap before adding the item-level foreign key.
  await sql`
    alter table "flowRunNodes"
      drop constraint if exists "flowRunNodes_status_check"
  `.execute(db)

  await sql`
    insert into "flowRunNodes" (
      "organizationId",
      "flowRunId",
      "nodeId",
      "status"
    )
    select
      grouped."organizationId",
      grouped."flowRunId",
      grouped."nodeId",
      case
        when grouped."runningCount" > 0
          or (
            grouped."pendingCount" > 0
            and grouped."pendingCount" < grouped."totalCount"
          )
          then 'running'
        when grouped."pendingCount" = grouped."totalCount"
          then 'pending'
        when grouped."succeededCount" > 0
          and (grouped."failedCount" + grouped."canceledCount") > 0
          then 'partial'
        when grouped."succeededCount" = grouped."totalCount"
          then 'succeeded'
        when grouped."failedCount" > 0
          then 'failed'
        when grouped."canceledCount" > 0
          then 'canceled'
        else 'pending'
      end
    from (
      select
        job."organizationId",
        job."flowRunId",
        job."nodeId",
        count(*)::integer as "totalCount",
        count(*) filter (where job."status" = 'pending')::integer
          as "pendingCount",
        count(*) filter (where job."status" = 'running')::integer
          as "runningCount",
        count(*) filter (where job."status" = 'succeeded')::integer
          as "succeededCount",
        count(*) filter (where job."status" = 'failed')::integer
          as "failedCount",
        count(*) filter (where job."status" = 'canceled')::integer
          as "canceledCount"
      from "generationJobs" as job
      group by job."organizationId", job."flowRunId", job."nodeId"
    ) as grouped
    on conflict ("flowRunId", "nodeId") do update set
      "status" = excluded."status",
      "updatedAt" = now()
  `.execute(db)

  await sql`drop index if exists "flowRunNodesJobIdx"`.execute(db)
  await sql`
    alter table "flowRunNodes"
      drop constraint if exists "flowRunNodes_jobId_flowRunId_nodeId_organizationId_fkey",
      drop column if exists "jobId",
      add constraint "flowRunNodesStatusCheck"
        check (
          "status" in (
            'pending',
            'running',
            'succeeded',
            'partial',
            'failed',
            'skipped',
            'canceled'
          )
        ),
      add constraint "flowRunNodesTenantIdentityUnique"
        unique ("flowRunId", "nodeId", "organizationId")
  `.execute(db)

  await sql`
    alter table "generationJobs"
      drop constraint if exists "generationJobs_id_flowRunId_nodeId_organizationId_key"
  `.execute(db)

  await sql`
    create table "flowRunNodeItems" (
      "organizationId" text not null
        references "organization"("id") on delete cascade,
      "flowRunId" text not null,
      "nodeId" text not null,
      "itemKey" text not null,
      "sortOrder" integer not null,
      "dimensions" jsonb not null default '{}'::jsonb,
      "lineage" jsonb not null default '[]'::jsonb,
      "status" text not null default 'pending'
        constraint "flowRunNodeItemsStatusCheck"
        check (
          "status" in (
            'pending',
            'running',
            'succeeded',
            'partial',
            'failed',
            'skipped',
            'canceled'
          )
        ),
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      primary key ("flowRunId", "nodeId", "itemKey"),
      unique ("flowRunId", "nodeId", "itemKey", "organizationId"),
      unique ("flowRunId", "nodeId", "sortOrder"),
      constraint "flowRunNodeItemsItemKeyCheck"
        check (length("itemKey") > 0),
      constraint "flowRunNodeItemsSortOrderCheck"
        check ("sortOrder" >= 0),
      constraint "flowRunNodeItemsDimensionsCheck"
        check (jsonb_typeof("dimensions") = 'object'),
      constraint "flowRunNodeItemsLineageCheck"
        check (jsonb_typeof("lineage") = 'array'),
      foreign key ("flowRunId", "nodeId", "organizationId")
        references "flowRunNodes" (
          "flowRunId",
          "nodeId",
          "organizationId"
        ) on delete cascade
    )
  `.execute(db)

  await sql`
    insert into "flowRunNodeItems" (
      "organizationId",
      "flowRunId",
      "nodeId",
      "itemKey",
      "sortOrder",
      "status"
    )
    select
      job."organizationId",
      job."flowRunId",
      job."nodeId",
      job."itemKey",
      (
        row_number() over (
          partition by job."flowRunId", job."nodeId"
          order by job."createdAt", job."id"
        ) - 1
      )::integer,
      job."status"
    from "generationJobs" as job
  `.execute(db)

  await sql`
    insert into "flowRunNodeItems" (
      "organizationId",
      "flowRunId",
      "nodeId",
      "itemKey",
      "sortOrder",
      "status"
    )
    select
      node."organizationId",
      node."flowRunId",
      node."nodeId",
      'legacy-node:' || node."nodeId",
      0,
      node."status"
    from "flowRunNodes" as node
    where not exists (
      select 1
      from "generationJobs" as job
      where job."flowRunId" = node."flowRunId"
        and job."nodeId" = node."nodeId"
    )
  `.execute(db)

  await sql`
    create index "flowRunNodeItemsStatusIdx"
      on "flowRunNodeItems" ("flowRunId", "status")
  `.execute(db)

  await sql`
    alter table "generationJobs"
      alter column "itemKey" set not null,
      alter column "operation" set not null,
      alter column "providerModel" set not null,
      alter column "modelRegistryVersion" set not null,
      alter column "providerRouteVersion" set not null,
      alter column "adapterVersion" set not null,
      add constraint "generationJobsItemKeyCheck"
        check (length("itemKey") > 0),
      add constraint "generationJobsLogicalRequestUnique"
        unique ("flowRunId", "nodeId", "itemKey", "requestIndex"),
      add constraint "generationJobsRunItemFk"
        foreign key (
          "flowRunId",
          "nodeId",
          "itemKey",
          "organizationId"
        ) references "flowRunNodeItems" (
          "flowRunId",
          "nodeId",
          "itemKey",
          "organizationId"
        )
  `.execute(db)

  await sql`
    create table "generationJobTextOutputs" (
      "organizationId" text not null
        references "organization"("id") on delete cascade,
      "jobId" text not null,
      "outputIndex" smallint not null,
      "text" text not null,
      primary key ("jobId", "outputIndex"),
      constraint "generationJobTextOutputsIndexCheck"
        check ("outputIndex" >= 0),
      foreign key ("jobId", "organizationId")
        references "generationJobs" ("id", "organizationId")
        on delete cascade
    )
  `.execute(db)
  await sql`
    create index "generationJobTextOutputsOrgJobIdx"
      on "generationJobTextOutputs" (
        "organizationId",
        "jobId",
        "outputIndex"
      )
  `.execute(db)
}
