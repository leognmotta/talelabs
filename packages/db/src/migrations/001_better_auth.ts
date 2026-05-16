import type { Kysely } from 'kysely'

import { sql } from 'kysely'

export async function up(db: Kysely<unknown>) {
  await sql`
    create table if not exists "user" (
      "id" text primary key,
      "name" text not null,
      "email" text not null unique,
      "emailVerified" boolean not null,
      "image" text,
      "createdAt" timestamp with time zone not null default current_timestamp,
      "updatedAt" timestamp with time zone not null default current_timestamp
    )
  `.execute(db)

  await sql`
    create table if not exists "verification" (
      "id" text primary key,
      "identifier" text not null,
      "value" text not null,
      "expiresAt" timestamp with time zone not null,
      "createdAt" timestamp with time zone not null default current_timestamp,
      "updatedAt" timestamp with time zone not null default current_timestamp
    )
  `.execute(db)

  await sql`
    create table if not exists "organization" (
      "id" text primary key,
      "name" text not null,
      "slug" text not null unique,
      "logo" text,
      "createdAt" timestamp with time zone not null,
      "metadata" text
    )
  `.execute(db)

  await sql`
    create table if not exists "session" (
      "id" text primary key,
      "expiresAt" timestamp with time zone not null,
      "token" text not null unique,
      "createdAt" timestamp with time zone not null default current_timestamp,
      "updatedAt" timestamp with time zone not null,
      "ipAddress" text,
      "userAgent" text,
      "userId" text not null references "user"("id") on delete cascade,
      "activeOrganizationId" text
    )
  `.execute(db)

  await sql`
    create table if not exists "account" (
      "id" text primary key,
      "accountId" text not null,
      "providerId" text not null,
      "userId" text not null references "user"("id") on delete cascade,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamp with time zone,
      "refreshTokenExpiresAt" timestamp with time zone,
      "scope" text,
      "password" text,
      "createdAt" timestamp with time zone not null default current_timestamp,
      "updatedAt" timestamp with time zone not null
    )
  `.execute(db)

  await sql`
    create table if not exists "member" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "userId" text not null references "user"("id") on delete cascade,
      "role" text not null,
      "createdAt" timestamp with time zone not null
    )
  `.execute(db)

  await sql`
    create table if not exists "invitation" (
      "id" text primary key,
      "organizationId" text not null references "organization"("id") on delete cascade,
      "email" text not null,
      "role" text,
      "status" text not null,
      "expiresAt" timestamp with time zone not null,
      "createdAt" timestamp with time zone not null default current_timestamp,
      "inviterId" text not null references "user"("id") on delete cascade
    )
  `.execute(db)

  await sql`create index if not exists "session_userId_idx" on "session" ("userId")`.execute(db)
  await sql`create index if not exists "account_userId_idx" on "account" ("userId")`.execute(db)
  await sql`create index if not exists "verification_identifier_idx" on "verification" ("identifier")`.execute(db)
  await sql`create unique index if not exists "organization_slug_uidx" on "organization" ("slug")`.execute(db)
  await sql`create index if not exists "member_organizationId_idx" on "member" ("organizationId")`.execute(db)
  await sql`create index if not exists "member_userId_idx" on "member" ("userId")`.execute(db)
  await sql`create index if not exists "invitation_organizationId_idx" on "invitation" ("organizationId")`.execute(db)
  await sql`create index if not exists "invitation_email_idx" on "invitation" ("email")`.execute(db)
}

export async function down(db: Kysely<unknown>) {
  await sql`drop table if exists "invitation"`.execute(db)
  await sql`drop table if exists "member"`.execute(db)
  await sql`drop table if exists "account"`.execute(db)
  await sql`drop table if exists "session"`.execute(db)
  await sql`drop table if exists "organization"`.execute(db)
  await sql`drop table if exists "verification"`.execute(db)
  await sql`drop table if exists "user"`.execute(db)
}
