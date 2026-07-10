import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    create table brands (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      created_by text references "user"(id) on delete set null,
      name text not null,
      description text,
      tone_of_voice text,
      visual_style text,
      do_rules text,
      dont_rules text,
      colors jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index brands_org_idx on brands (organization_id)`.execute(
    db,
  )

  await sql`
    create table products (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      created_by text references "user"(id) on delete set null,
      brand_id text references brands(id) on delete set null,
      name text not null,
      description text,
      features text[] not null default '{}',
      benefits text[] not null default '{}',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index products_org_idx on products (organization_id)`.execute(
    db,
  )
  await sql`create index products_brand_idx on products (brand_id)`.execute(db)

  await sql`
    create table characters (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      created_by text references "user"(id) on delete set null,
      name text not null,
      role text,
      description text,
      personality text,
      visual_notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index characters_org_idx on characters (organization_id)`.execute(
    db,
  )

  await sql`
    create table projects (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      created_by text references "user"(id) on delete set null,
      name text not null,
      description text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index projects_org_idx on projects (organization_id)`.execute(
    db,
  )

  await sql`
    create table folders (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      parent_id text references folders(id) on delete cascade,
      name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `.execute(db)
  await sql`create index folders_org_idx on folders (organization_id)`.execute(
    db,
  )
  await sql`create index folders_parent_idx on folders (parent_id)`.execute(db)

  await sql`
    create table generation_jobs (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      created_by text references "user"(id) on delete set null,
      media_type text not null check (media_type in ('image', 'video', 'audio')),
      status text not null default 'pending'
        check (status in ('pending', 'running', 'succeeded', 'failed', 'canceled')),
      provider text not null,
      model text not null,
      app_id text,
      prompt text,
      resolved_prompt text,
      settings jsonb not null default '{}'::jsonb,
      brand_id text references brands(id) on delete set null,
      product_id text references products(id) on delete set null,
      project_id text references projects(id) on delete set null,
      idempotency_key text not null,
      request_hash text not null,
      credit_source text not null default 'unmetered'
        check (credit_source in ('unmetered', 'promotional', 'subscription', 'top_up')),
      credit_cost integer,
      error_code text,
      error_message text,
      provider_job_id text,
      cancel_requested_at timestamptz,
      created_at timestamptz not null default now(),
      started_at timestamptz,
      completed_at timestamptz
    )
  `.execute(db)
  await sql`
    create index generation_jobs_org_created_idx
      on generation_jobs (organization_id, created_at desc)
  `.execute(db)
  await sql`
    create index generation_jobs_active_idx on generation_jobs (status)
      where status in ('pending', 'running')
  `.execute(db)
  await sql`
    create unique index generation_jobs_idempotency_idx
      on generation_jobs (organization_id, idempotency_key)
  `.execute(db)

  await sql`
    create table assets (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      created_by text references "user"(id) on delete set null,
      name text not null,
      type text not null check (type in ('image', 'video', 'audio', 'document', 'font')),
      source text not null check (source in ('upload', 'generation', 'export')),
      storage_key text not null,
      visibility text not null default 'private'
        check (visibility in ('public', 'private')),
      thumbnail_key text,
      mime_type text not null,
      size_bytes bigint,
      width integer,
      height integer,
      duration_seconds numeric(10, 3),
      folder_id text references folders(id) on delete set null,
      generation_job_id text references generation_jobs(id) on delete set null,
      upload_id text,
      favorite boolean not null default false,
      featured_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `.execute(db)
  await sql`
    create index assets_org_created_idx on assets (organization_id, created_at desc)
      where deleted_at is null
  `.execute(db)
  await sql`
    create index assets_org_type_idx on assets (organization_id, type)
      where deleted_at is null
  `.execute(db)
  await sql`
    create index assets_folder_idx on assets (folder_id)
      where deleted_at is null
  `.execute(db)
  await sql`create index assets_job_idx on assets (generation_job_id)`.execute(
    db,
  )
  await sql`
    create unique index assets_upload_id_idx on assets (upload_id)
      where upload_id is not null
  `.execute(db)
  await sql`
    create index assets_favorite_idx on assets (organization_id)
      where favorite and deleted_at is null
  `.execute(db)

  await sql`
    create table generation_job_characters (
      job_id text not null references generation_jobs(id) on delete cascade,
      character_id text not null references characters(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (job_id, character_id)
    )
  `.execute(db)
  await sql`
    create index generation_job_characters_character_idx
      on generation_job_characters (character_id)
  `.execute(db)

  await sql`
    create table generation_job_inputs (
      job_id text not null references generation_jobs(id) on delete cascade,
      asset_id text not null references assets(id) on delete cascade,
      role text not null default 'reference'
        check (role in ('reference', 'first_frame', 'last_frame', 'source_image', 'audio_reference')),
      sort_order smallint not null default 0,
      primary key (job_id, asset_id, role)
    )
  `.execute(db)
  await sql`
    create index generation_job_inputs_asset_idx on generation_job_inputs (asset_id)
  `.execute(db)

  await sql`
    create table tags (
      id text primary key,
      organization_id text not null references "organization"(id) on delete cascade,
      name text not null,
      created_at timestamptz not null default now(),
      unique (organization_id, name)
    )
  `.execute(db)

  await sql`
    create table asset_tags (
      asset_id text not null references assets(id) on delete cascade,
      tag_id text not null references tags(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (asset_id, tag_id)
    )
  `.execute(db)
  await sql`create index asset_tags_tag_idx on asset_tags (tag_id)`.execute(db)

  await sql`
    create table brand_characters (
      brand_id text not null references brands(id) on delete cascade,
      character_id text not null references characters(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (brand_id, character_id)
    )
  `.execute(db)
  await sql`
    create index brand_characters_character_idx on brand_characters (character_id)
  `.execute(db)

  await sql`
    create table project_assets (
      project_id text not null references projects(id) on delete cascade,
      asset_id text not null references assets(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (project_id, asset_id)
    )
  `.execute(db)
  await sql`create index project_assets_asset_idx on project_assets (asset_id)`.execute(
    db,
  )

  await sql`
    create table project_brands (
      project_id text not null references projects(id) on delete cascade,
      brand_id text not null references brands(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (project_id, brand_id)
    )
  `.execute(db)
  await sql`create index project_brands_brand_idx on project_brands (brand_id)`.execute(
    db,
  )

  await sql`
    create table project_products (
      project_id text not null references projects(id) on delete cascade,
      product_id text not null references products(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (project_id, product_id)
    )
  `.execute(db)
  await sql`
    create index project_products_product_idx on project_products (product_id)
  `.execute(db)

  await sql`
    create table project_characters (
      project_id text not null references projects(id) on delete cascade,
      character_id text not null references characters(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (project_id, character_id)
    )
  `.execute(db)
  await sql`
    create index project_characters_character_idx on project_characters (character_id)
  `.execute(db)

  await sql`
    create table brand_assets (
      brand_id text not null references brands(id) on delete cascade,
      asset_id text not null references assets(id) on delete cascade,
      role text not null default 'reference'
        check (role in (
          'logo_primary', 'logo_horizontal', 'logo_icon', 'logo_wordmark',
          'logo_light', 'logo_dark', 'logo_mono', 'reference', 'approved_output'
        )),
      created_at timestamptz not null default now(),
      primary key (brand_id, asset_id, role)
    )
  `.execute(db)
  await sql`create index brand_assets_asset_idx on brand_assets (asset_id)`.execute(
    db,
  )

  await sql`
    create table product_assets (
      product_id text not null references products(id) on delete cascade,
      asset_id text not null references assets(id) on delete cascade,
      role text not null default 'reference'
        check (role in ('source_image', 'packaging', 'lifestyle', 'reference', 'approved_output')),
      created_at timestamptz not null default now(),
      primary key (product_id, asset_id, role)
    )
  `.execute(db)
  await sql`create index product_assets_asset_idx on product_assets (asset_id)`.execute(
    db,
  )

  await sql`
    create table character_assets (
      character_id text not null references characters(id) on delete cascade,
      asset_id text not null references assets(id) on delete cascade,
      role text not null default 'reference_image'
        check (role in (
          'reference_image', 'expression_sheet', 'pose_sheet', 'sample_video',
          'sample_audio', 'voice_reference', 'approved_output'
        )),
      created_at timestamptz not null default now(),
      primary key (character_id, asset_id, role)
    )
  `.execute(db)
  await sql`
    create index character_assets_asset_idx on character_assets (asset_id)
  `.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table if exists character_assets`.execute(db)
  await sql`drop table if exists product_assets`.execute(db)
  await sql`drop table if exists brand_assets`.execute(db)
  await sql`drop table if exists project_characters`.execute(db)
  await sql`drop table if exists project_products`.execute(db)
  await sql`drop table if exists project_brands`.execute(db)
  await sql`drop table if exists project_assets`.execute(db)
  await sql`drop table if exists brand_characters`.execute(db)
  await sql`drop table if exists asset_tags`.execute(db)
  await sql`drop table if exists tags`.execute(db)
  await sql`drop table if exists generation_job_inputs`.execute(db)
  await sql`drop table if exists generation_job_characters`.execute(db)
  await sql`drop table if exists assets`.execute(db)
  await sql`drop table if exists generation_jobs`.execute(db)
  await sql`drop table if exists folders`.execute(db)
  await sql`drop table if exists projects`.execute(db)
  await sql`drop table if exists characters`.execute(db)
  await sql`drop table if exists products`.execute(db)
  await sql`drop table if exists brands`.execute(db)
}
