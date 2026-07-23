/**
 * Restores durable Create session identity without reintroducing Flow graphs.
 *
 * Direct Create runs remain graph-free, while `createSessions` groups related
 * requests and gives the dashboard a stable route and history boundary.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Adds Create sessions and binds every direct run to exactly one session. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table "createSessions" (
      "id" text primary key,
      "organizationId" text not null
        references "organization"("id") on delete cascade,
      "createdBy" text
        references "user"("id") on delete set null,
      "name" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      "deletedAt" timestamptz,
      constraint "createSessionsIdentityUnique"
        unique ("id", "organizationId"),
      constraint "createSessionsNameCheck"
        check (
          "name" is null
          or char_length(btrim("name")) between 1 and 120
        )
    )
  `.execute(db)

  await sql`
    alter table "flowRuns"
      add column "createSessionId" text
  `.execute(db)

  await sql`
    insert into "createSessions" (
      "id",
      "organizationId",
      "createdBy",
      "createdAt",
      "updatedAt"
    )
    select
      run."id",
      run."organizationId",
      run."createdBy",
      run."createdAt",
      greatest(
        run."createdAt",
        coalesce(run."completedAt", run."createdAt")
      )
    from "flowRuns" run
    where run."source" = 'create'
    on conflict ("id") do nothing
  `.execute(db)

  await sql`
    update "flowRuns"
    set "createSessionId" = "id"
    where "source" = 'create'
      and "createSessionId" is null
  `.execute(db)

  await sql`
    alter table "flowRuns"
      add constraint "flowRunsCreateSessionOrganizationFk"
        foreign key ("createSessionId", "organizationId")
        references "createSessions"("id", "organizationId")
        on delete restrict,
      drop constraint "flowRunsSourceIdentityCheck",
      add constraint "flowRunsSourceIdentityCheck"
        check (
          (
            "source" = 'create'
            and "flowId" is null
            and "createSessionId" is not null
            and "mode" = 'direct'
            and "targetNodeId" is null
          )
          or (
            "source" = 'flow'
            and "createSessionId" is null
            and "mode" <> 'direct'
          )
        )
  `.execute(db)

  await sql`drop index "flowRunsCreateHistoryIdx"`.execute(db)
  await sql`
    create index "flowRunsCreateSessionHistoryIdx"
      on "flowRuns" (
        "organizationId",
        "createSessionId",
        "createdAt" desc,
        "id" desc
      )
      where "source" = 'create'
  `.execute(db)
  await sql`
    create index "createSessionsOwnerUpdatedIdx"
      on "createSessions" (
        "organizationId",
        "createdBy",
        "updatedAt" desc,
        "id" desc
      )
      where "deletedAt" is null
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
        or old."createSessionId" is distinct from new."createSessionId"
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

/** Create-session restoration is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
