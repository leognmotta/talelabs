import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/**
 * Separates TaleLabs snapshot compatibility from the Trigger deployment that
 * actually accepted a run. The deployment is discovered after dispatch and is
 * write-once; existing immutable snapshots are deliberately not rewritten.
 */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table "flowRuns"
      add column "triggerDeploymentVersion" text,
      add constraint "flowRunsTriggerDeploymentVersionCheck"
        check (
          "triggerDeploymentVersion" is null
          or length("triggerDeploymentVersion") > 0
        )
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

export async function down(db: Kysely<unknown>) {
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
      then
        raise exception 'flow run snapshots are immutable'
          using errcode = '23514';
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    alter table "flowRuns"
      drop constraint if exists "flowRunsTriggerDeploymentVersionCheck",
      drop column if exists "triggerDeploymentVersion"
  `.execute(db)
}
