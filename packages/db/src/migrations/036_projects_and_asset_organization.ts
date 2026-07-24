/**
 * Adds optional Project organization, Project Briefs, and immutable output
 * destinations while preserving every existing entity as Private.
 */

import type { Kysely } from 'kysely'

import { sql } from 'kysely'

/** Applies the forward-only Project and generated-Asset destination model. */
export async function up(db: Kysely<unknown>) {
  await sql`
    create table "projects" (
      "id" text primary key,
      "organizationId" text not null
        references "organization"("id") on delete cascade,
      "createdBy" text
        references "user"("id") on delete set null,
      "name" text not null,
      "description" text not null default '',
      "coverAssetId" text,
      "defaultAssetFolderId" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now(),
      "archivedAt" timestamptz,
      constraint "projectsIdentityUnique"
        unique ("id", "organizationId"),
      constraint "projectsNameCheck"
        check (char_length(btrim("name")) between 1 and 120),
      constraint "projectsDescriptionCheck"
        check (char_length("description") <= 500)
    )
  `.execute(db)

  await sql`
    create table "projectBriefs" (
      "projectId" text primary key,
      "organizationId" text not null,
      "document" jsonb not null default '{"type":"doc","content":[]}'::jsonb,
      "revision" bigint not null default 0,
      "plainText" text not null default '',
      "updatedBy" text
        references "user"("id") on delete set null,
      "updatedAt" timestamptz not null default now(),
      constraint "projectBriefsProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete cascade,
      constraint "projectBriefsRevisionCheck"
        check ("revision" >= 0),
      constraint "projectBriefsDocumentCheck"
        check (
          jsonb_typeof("document") = 'object'
          and "document" ->> 'type' = 'doc'
          and pg_column_size("document") <= 262144
        ),
      constraint "projectBriefsPlainTextCheck"
        check (char_length("plainText") <= 100000)
    )
  `.execute(db)

  await sql`
    alter table "folders"
      add column "projectId" text,
      add constraint "foldersProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete restrict
  `.execute(db)
  await sql`
    alter table "assets"
      add column "projectId" text,
      add constraint "assetsProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete restrict
  `.execute(db)
  await sql`
    alter table "flows"
      add column "projectId" text,
      add constraint "flowsProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete restrict
  `.execute(db)
  await sql`
    alter table "createSessions"
      add column "projectId" text,
      add column "assetFolderId" text,
      add constraint "createSessionsProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete restrict,
      add constraint "createSessionsAssetFolderOrganizationFk"
        foreign key ("assetFolderId", "organizationId")
        references "folders"("id", "organizationId")
        on delete set null ("assetFolderId")
  `.execute(db)
  await sql`
    alter table "elements"
      add column "projectId" text,
      add constraint "elementsProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete restrict
  `.execute(db)
  await sql`
    alter table "flowRuns"
      add column "projectId" text,
      add column "assetFolderId" text,
      add constraint "flowRunsProjectOrganizationFk"
        foreign key ("projectId", "organizationId")
        references "projects"("id", "organizationId") on delete restrict
  `.execute(db)

  await sql`
    alter table "projects"
      add constraint "projectsCoverAssetOrganizationFk"
        foreign key ("coverAssetId", "organizationId")
        references "assets"("id", "organizationId")
        on delete set null ("coverAssetId"),
      add constraint "projectsDefaultFolderOrganizationFk"
        foreign key ("defaultAssetFolderId", "organizationId")
        references "folders"("id", "organizationId")
        on delete set null ("defaultAssetFolderId")
  `.execute(db)

  await sql`drop index if exists "foldersSystemRoleIdx"`.execute(db)
  await sql`
    create unique index "foldersSystemRoleIdx"
      on "folders" ("organizationId", "projectId", "systemRole")
      nulls not distinct
      where "systemRole" is not null
  `.execute(db)
  await sql`drop index if exists "flowsAssetFolderIdx"`.execute(db)
  await sql`
    create index "flowsAssetFolderIdx"
      on "flows" ("assetFolderId")
      where "assetFolderId" is not null
  `.execute(db)
  await sql`
    update "folders" folder
    set "systemRole" = 'flow_output:' || flow."id"
    from "flows" flow
    where flow."assetFolderId" = folder."id"
      and flow."organizationId" = folder."organizationId"
      and folder."systemRole" is null
  `.execute(db)

  await sql`
    create index "projectsOrgArchiveUpdatedIdx"
      on "projects" (
        "organizationId",
        "archivedAt",
        "updatedAt" desc,
        "id" desc
      )
  `.execute(db)
  await sql`
    create index "projectsNameSearchIdx"
      on "projects" using gin (
        lower("name" || ' ' || "description") gin_trgm_ops
      )
  `.execute(db)
  await sql`
    create index "projectBriefsOrgUpdatedIdx"
      on "projectBriefs" ("organizationId", "updatedAt" desc, "projectId")
  `.execute(db)
  await sql`
    create index "assetsOrgProjectFolderCreatedIdx"
      on "assets" (
        "organizationId",
        "projectId",
        "folderId",
        "createdAt" desc,
        "id" desc
      )
      where "deletedAt" is null
        and "purgeRequestedAt" is null
        and "purgedAt" is null
  `.execute(db)
  await sql`
    create index "foldersOrgProjectParentNameIdx"
      on "folders" (
        "organizationId",
        "projectId",
        "parentId",
        lower("name"),
        "id"
      )
  `.execute(db)
  await sql`
    create index "flowsOrgProjectUpdatedIdx"
      on "flows" (
        "organizationId",
        "projectId",
        "updatedAt" desc,
        "id" desc
      )
  `.execute(db)
  await sql`
    create index "createSessionsOwnerProjectUpdatedIdx"
      on "createSessions" (
        "organizationId",
        "createdBy",
        "projectId",
        "updatedAt" desc,
        "id" desc
      )
      where "deletedAt" is null
  `.execute(db)
  await sql`
    create index "elementsOrgProjectUpdatedIdx"
      on "elements" (
        "organizationId",
        "projectId",
        "updatedAt" desc,
        "id" desc
      )
  `.execute(db)
  await sql`
    create index "flowRunsOrgProjectCreatedIdx"
      on "flowRuns" (
        "organizationId",
        "projectId",
        "createdAt" desc,
        "id" desc
      )
  `.execute(db)

  await sql`
    create or replace function "assertFolderProjectScope"()
    returns trigger
    language plpgsql
    as $$
    declare
      current_parent_id text;
      current_project_id text;
      parent_project_id text;
    begin
      select folder."parentId", folder."projectId"
      into current_parent_id, current_project_id
      from "folders" folder
      where folder."id" = new."id"
        and folder."organizationId" = new."organizationId";

      if not found then
        return new;
      end if;
      if current_parent_id is not null then
        select parent."projectId"
        into parent_project_id
        from "folders" parent
        where parent."id" = current_parent_id
          and parent."organizationId" = new."organizationId";

        if found and current_project_id is distinct from parent_project_id then
          raise exception 'a child folder must belong to its parent project'
            using errcode = '23514',
              constraint = 'foldersProjectScopeCheck';
        end if;
      end if;
      if exists (
        select 1
        from "projects" project
        where project."organizationId" = new."organizationId"
          and project."defaultAssetFolderId" = new."id"
          and project."id" is distinct from current_project_id
      ) then
        raise exception 'a project default folder must remain in that project'
          using errcode = '23514',
            constraint = 'projectsDefaultFolderProjectScopeCheck';
      end if;
      if exists (
        select 1
        from "flows" flow
        where flow."organizationId" = new."organizationId"
          and flow."assetFolderId" = new."id"
          and flow."projectId" is distinct from current_project_id
      ) or exists (
        select 1
        from "createSessions" session
        where session."organizationId" = new."organizationId"
          and session."assetFolderId" = new."id"
          and session."projectId" is distinct from current_project_id
      ) then
        raise exception 'an output folder must remain in its source project'
          using errcode = '23514',
            constraint = 'sourceFolderProjectScopeCheck';
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    create or replace function "assertAssetFolderProjectScope"()
    returns trigger
    language plpgsql
    as $$
    declare
      current_folder_id text;
      current_project_id text;
      folder_project_id text;
    begin
      select asset."folderId", asset."projectId"
      into current_folder_id, current_project_id
      from "assets" asset
      where asset."id" = new."id"
        and asset."organizationId" = new."organizationId";

      if not found then
        return new;
      end if;
      if current_folder_id is not null then
        select folder."projectId"
        into folder_project_id
        from "folders" folder
        where folder."id" = current_folder_id
          and folder."organizationId" = new."organizationId";

        if found and current_project_id is distinct from folder_project_id then
          raise exception 'an asset must belong to its folder project'
            using errcode = '23514',
              constraint = 'assetsFolderProjectScopeCheck';
        end if;
      end if;
      if exists (
        select 1
        from "projects" project
        where project."organizationId" = new."organizationId"
          and project."coverAssetId" = new."id"
          and project."id" is distinct from current_project_id
      ) then
        raise exception 'a project cover asset must remain in that project'
          using errcode = '23514',
            constraint = 'projectsCoverProjectScopeCheck';
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    create or replace function "assertSourceFolderProjectScope"()
    returns trigger
    language plpgsql
    as $$
    declare
      current_folder_id text;
      current_project_id text;
      folder_project_id text;
    begin
      if tg_table_name = 'flows' then
        select source."assetFolderId", source."projectId"
        into current_folder_id, current_project_id
        from "flows" source
        where source."id" = new."id"
          and source."organizationId" = new."organizationId";
      else
        select source."assetFolderId", source."projectId"
        into current_folder_id, current_project_id
        from "createSessions" source
        where source."id" = new."id"
          and source."organizationId" = new."organizationId";
      end if;

      if not found or current_folder_id is null then
        return new;
      end if;

      select folder."projectId"
      into folder_project_id
      from "folders" folder
      where folder."id" = current_folder_id
        and folder."organizationId" = new."organizationId";

      if found and current_project_id is distinct from folder_project_id then
        raise exception 'an output folder must belong to its source project'
          using errcode = '23514',
            constraint = 'sourceFolderProjectScopeCheck';
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    create or replace function "assertRunDestinationProjectScope"()
    returns trigger
    language plpgsql
    as $$
    declare
      current_folder_id text;
      current_project_id text;
      folder_project_id text;
    begin
      select run."assetFolderId", run."projectId"
      into current_folder_id, current_project_id
      from "flowRuns" run
      where run."id" = new."id"
        and run."organizationId" = new."organizationId";

      if not found or current_folder_id is null then
        return new;
      end if;

      select folder."projectId"
      into folder_project_id
      from "folders" folder
      where folder."id" = current_folder_id
        and folder."organizationId" = new."organizationId";

      if not found then
        raise exception 'captured run destination folder does not exist'
          using errcode = '23503',
            constraint = 'flowRunsDestinationFolderCheck';
      end if;
      if current_project_id is distinct from folder_project_id then
        raise exception 'a run destination must belong to its captured project'
          using errcode = '23514',
            constraint = 'flowRunsDestinationProjectCheck';
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    create or replace function "assertProjectTargetScope"()
    returns trigger
    language plpgsql
    as $$
    declare
      current_cover_id text;
      current_default_folder_id text;
      target_project_id text;
    begin
      select project."coverAssetId", project."defaultAssetFolderId"
      into current_cover_id, current_default_folder_id
      from "projects" project
      where project."id" = new."id"
        and project."organizationId" = new."organizationId";

      if not found then
        return new;
      end if;
      if current_cover_id is not null then
        select asset."projectId"
        into target_project_id
        from "assets" asset
        where asset."id" = current_cover_id
          and asset."organizationId" = new."organizationId";
        if found and target_project_id is distinct from new."id" then
          raise exception 'a project cover must be an asset in that project'
            using errcode = '23514',
              constraint = 'projectsCoverProjectScopeCheck';
        end if;
      end if;
      if current_default_folder_id is not null then
        select folder."projectId"
        into target_project_id
        from "folders" folder
        where folder."id" = current_default_folder_id
          and folder."organizationId" = new."organizationId";
        if found and target_project_id is distinct from new."id" then
          raise exception 'a project default folder must belong to that project'
            using errcode = '23514',
              constraint = 'projectsDefaultFolderProjectScopeCheck';
        end if;
      end if;
      return new;
    end;
    $$
  `.execute(db)

  await sql`
    create constraint trigger "foldersProjectScopeTrigger"
    after insert or update of "parentId", "projectId", "organizationId"
    on "folders"
    deferrable initially deferred
    for each row execute function "assertFolderProjectScope"()
  `.execute(db)
  await sql`
    create constraint trigger "assetsFolderProjectScopeTrigger"
    after insert or update of "folderId", "projectId", "organizationId"
    on "assets"
    deferrable initially deferred
    for each row execute function "assertAssetFolderProjectScope"()
  `.execute(db)
  await sql`
    create constraint trigger "flowsFolderProjectScopeTrigger"
    after insert or update of "assetFolderId", "projectId", "organizationId"
    on "flows"
    deferrable initially deferred
    for each row execute function "assertSourceFolderProjectScope"()
  `.execute(db)
  await sql`
    create constraint trigger "createSessionsFolderProjectScopeTrigger"
    after insert or update of "assetFolderId", "projectId", "organizationId"
    on "createSessions"
    deferrable initially deferred
    for each row execute function "assertSourceFolderProjectScope"()
  `.execute(db)
  await sql`
    create constraint trigger "flowRunsDestinationProjectScopeTrigger"
    after insert or update of "assetFolderId", "projectId", "organizationId"
    on "flowRuns"
    deferrable initially deferred
    for each row execute function "assertRunDestinationProjectScope"()
  `.execute(db)
  await sql`
    create constraint trigger "projectsTargetScopeTrigger"
    after insert or update of
      "coverAssetId",
      "defaultAssetFolderId",
      "organizationId"
    on "projects"
    deferrable initially deferred
    for each row execute function "assertProjectTargetScope"()
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
        or old."projectId" is distinct from new."projectId"
        or old."assetFolderId" is distinct from new."assetFolderId"
        or (
          old."triggerDeploymentVersion" is not null
          and old."triggerDeploymentVersion"
            is distinct from new."triggerDeploymentVersion"
        )
      then
        raise exception 'flow run snapshots and destination identity are immutable'
          using errcode = '23514';
      end if;
      return new;
    end;
    $$
  `.execute(db)
}

/** Project organization is intentionally forward-only. */
export async function down(_db: Kysely<unknown>) {}
