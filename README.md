# Connecto

Connecto monorepo with a Hono API, React dashboard, shared shadcn UI package, Kysely/Postgres database package, and Better Auth organization-based authentication.

## Workspaces

- `apps/api` - Hono API
- `apps/dashboard` - React/Vite dashboard
- `packages/ui` - shared shadcn UI components
- `packages/db` - shared Kysely/Postgres database client
- `packages/auth` - Better Auth server config and organization session guards

## Development

```sh
npm install
npm run dev
```

## Verification

```sh
npm run lint
npm run check-types
npm run build
```
