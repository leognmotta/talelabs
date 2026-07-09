import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`alter table "user" add column if not exists "role" text not null default 'user'`.execute(db)
  await sql`alter table "user" add column if not exists "banned" boolean not null default false`.execute(db)
  await sql`alter table "user" add column if not exists "banReason" text`.execute(db)
  await sql`alter table "user" add column if not exists "banExpires" timestamp with time zone`.execute(db)
  await sql`alter table "session" add column if not exists "impersonatedBy" text`.execute(db)

  await sql`create index if not exists "user_role_idx" on "user" ("role")`.execute(db)
  await sql`create index if not exists "invitation_status_idx" on "invitation" ("status")`.execute(db)
  await sql`create unique index if not exists "member_organizationId_userId_uidx" on "member" ("organizationId", "userId")`.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop index if exists "member_organizationId_userId_uidx"`.execute(db)
  await sql`drop index if exists "invitation_status_idx"`.execute(db)
  await sql`drop index if exists "user_role_idx"`.execute(db)

  await sql`alter table "session" drop column if exists "impersonatedBy"`.execute(db)
  await sql`alter table "user" drop column if exists "banExpires"`.execute(db)
  await sql`alter table "user" drop column if exists "banReason"`.execute(db)
  await sql`alter table "user" drop column if exists "banned"`.execute(db)
  await sql`alter table "user" drop column if exists "role"`.execute(db)
}
