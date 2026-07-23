/**
 * Removes Create-owned Flow surfaces and admits direct generation run sources.
 *
 * Obsolete Create-surface Flow identities are removed; their durable runs,
 * generation jobs, and canonical Assets retain history through existing
 * nullable foreign keys. New Create work uses the shared run, step, item, job,
 * source, input, and output tables with no Flow reference.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Applies the forward-only direct-run source model and removes Flow surfaces. */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      add column "source" text
  `.execute(db)
  await sql`
    update "flowRuns"
    set "source" = 'flow'
    where "source" is null
  `.execute(db)
  await sql`
    alter table "flowRuns"
      alter column "source" set default 'flow',
      alter column "source" set not null,
      drop constraint if exists "flowRunsModeCheck",
      drop constraint if exists "flowRunsTargetNodeCheck",
      add constraint "flowRunsSourceCheck"
        check ("source" in ('flow', 'create')),
      add constraint "flowRunsModeCheck"
        check (
          "mode" in (
            'node',
            'downstream',
            'upstream',
            'selection',
            'all',
            'tool',
            'direct'
          )
        ),
      add constraint "flowRunsTargetNodeCheck"
        check (
          "mode" not in ('node', 'downstream', 'upstream')
          or "targetNodeId" is not null
        ),
      add constraint "flowRunsSourceIdentityCheck"
        check (
          (
            "source" = 'create'
            and "flowId" is null
            and "mode" = 'direct'
            and "targetNodeId" is null
          )
          or (
            "source" = 'flow'
            and "mode" <> 'direct'
          )
        )
  `.execute(db)

  await sql`
    create index "flowRunsCreateHistoryIdx"
      on "flowRuns" (
        "organizationId",
        "createdBy",
        "createdAt" desc,
        "id" desc
      )
      where "source" = 'create'
  `.execute(db)

  await sql`
    alter table "generationJobs"
      drop constraint "generationJobsRequestPayloadCheck",
      add constraint "generationJobsRequestPayloadCheck"
        check (
          jsonb_typeof("requestPayload") = 'object'
          and ("requestPayload" ->> 'requestPayloadVersion')
            in ('0', '1', '2', '3', '4', '5', '6')
        )
  `.execute(db)

  await sql`drop index if exists "flowsOrgSurfaceUpdatedIdx"`.execute(db)
  await sql`
    delete from "flows"
    where "surface" = 'create'
  `.execute(db)
  await sql`
    alter table "flows"
      drop constraint if exists "flowsSurfaceCheck",
      drop column "surface"
  `.execute(db)
  await sql`
    create index "flowsOrgUpdatedIdx"
      on "flows" ("organizationId", "updatedAt" desc, "id" desc)
  `.execute(db)

  await sql`
    create or replace function "protectFlowRunSnapshot"()
    returns trigger
    language plpgsql
    as $$
    begin
      if old."graphSnapshot" is distinct from new."graphSnapshot"
        or old."snapshotVersion" is distinct from new."snapshotVersion"
        or old."snapshotHash" is distinct from new."snapshotHash"
        or old."executorVersion" is distinct from new."executorVersion"
        or old."source" is distinct from new."source"
        or (
          old."triggerDeploymentVersion" is not null
          and old."triggerDeploymentVersion"
            is distinct from new."triggerDeploymentVersion"
        )
      then
        raise exception 'flow run snapshots and executor identity are immutable'
          using errcode = '23514';
      end if;
      return new;
    end;
    $$
  `.execute(db)
}

/** Direct-run source migration is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
