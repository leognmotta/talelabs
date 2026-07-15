import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/**
 * Stores each bounded immutable job request independently from the complete
 * Flow snapshot and adds durable reconciliation rotation timestamps.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      add column "lastReconciledAt" timestamptz;

    alter table "generationJobs"
      add column "requestPayload" jsonb,
      add column "lastReconciledAt" timestamptz
  `.execute(db)

  await sql`
    with planned_requests as (
      select
        run."organizationId",
        run."id" as "flowRunId",
        execution_node ->> 'nodeId' as "nodeId",
        work_item ->> 'itemKey' as "itemKey",
        (request_shard ->> 'requestIndex')::integer as "requestIndex",
        request_shard -> 'requestPayload' as "requestPayload"
      from "flowRuns" as run
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(run."graphSnapshot" #> '{plan,executionNodes}') = 'array'
            then run."graphSnapshot" #> '{plan,executionNodes}'
          else '[]'::jsonb
        end
      ) as execution_node
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(execution_node -> 'workItems') = 'array'
            then execution_node -> 'workItems'
          else '[]'::jsonb
        end
      ) as work_item
      cross join lateral jsonb_array_elements(
        case
          when jsonb_typeof(work_item -> 'requestShards') = 'array'
            then work_item -> 'requestShards'
          else '[]'::jsonb
        end
      ) as request_shard
      where request_shard ? 'requestPayload'
        and request_shard ->> 'requestIndex' ~ '^[0-9]+$'
    )
    update "generationJobs" as job
    set "requestPayload" = planned."requestPayload"
    from planned_requests as planned
    where planned."organizationId" = job."organizationId"
      and planned."flowRunId" = job."flowRunId"
      and planned."nodeId" = job."nodeId"
      and planned."itemKey" = job."itemKey"
      and planned."requestIndex" = job."requestIndex"
  `.execute(db)

  // Pre-M5 terminal rows cannot be executed or retried by the current reader,
  // but retain an explicit versioned payload instead of ambiguous null data.
  await sql`
    update "generationJobs"
    set "requestPayload" = jsonb_build_object(
      'requestPayloadVersion', 0,
      'legacyJobId', "id"
    )
    where "requestPayload" is null
  `.execute(db)

  await sql`
    alter table "generationJobs"
      alter column "requestPayload" set not null,
      add constraint "generationJobsRequestPayloadCheck"
        check (
          jsonb_typeof("requestPayload") = 'object'
          and ("requestPayload" ->> 'requestPayloadVersion') in ('0', '1')
        )
  `.execute(db)

  await sql`
    create function "protectGenerationJobRequest"()
    returns trigger
    language plpgsql
    as $$
    begin
      if old."requestPayload" is distinct from new."requestPayload"
        or old."requestHash" is distinct from new."requestHash"
      then
        raise exception 'generation job requests are immutable'
          using errcode = '23514';
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    create trigger "generationJobsRequestImmutableTrigger"
    before update on "generationJobs"
    for each row execute function "protectGenerationJobRequest"()
  `.execute(db)

  await sql`
    create index "flowRunsReconciliationIdx"
      on "flowRuns" (
        "lastReconciledAt" asc nulls first,
        "createdAt",
        "id"
      )
      where "status" in ('pending', 'running', 'canceled')
  `.execute(db)

  await sql`
    create index "generationJobsReconciliationIdx"
      on "generationJobs" (
        "lastReconciledAt" asc nulls first,
        "startedAt",
        "id"
      )
      where "status" = 'running'
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`
    drop index if exists "generationJobsReconciliationIdx";
    drop index if exists "flowRunsReconciliationIdx";
    drop trigger if exists "generationJobsRequestImmutableTrigger"
      on "generationJobs";
    drop function if exists "protectGenerationJobRequest"();

    alter table "generationJobs"
      drop constraint if exists "generationJobsRequestPayloadCheck",
      drop column if exists "lastReconciledAt",
      drop column if exists "requestPayload";

    alter table "flowRuns"
      drop column if exists "lastReconciledAt"
  `.execute(db)
}
