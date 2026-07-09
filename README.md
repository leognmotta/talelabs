# TaleLabs

TaleLabs monorepo with a Hono API, React dashboard, shared shadcn UI package, Kysely/Postgres database package, and Better Auth organization-based authentication.

## Workspaces

- `apps/api` - Hono API
- `apps/dashboard` - React/Vite dashboard
- `packages/ui` - shared shadcn UI components
- `packages/db` - shared Kysely/Postgres database client
- `packages/auth` - Better Auth server config and organization session guards

## Development

```sh
npm install
cp .env.example .env
npm run dev
```

`POSTGRES_URL` must point to a running Postgres instance before auth and database routes can be used.

## Verification

```sh
npm run lint
npm run check-types
npm run build
```
