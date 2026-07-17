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

The default development command prepares the compiled workspace packages and
SDK once, then keeps only the API, dashboard, Trigger.dev, and required package
build watchers running. SDK generation is deliberately not a default persistent
watcher because republishing generated clients can reload an active browser run.

For browser-run and execution-matrix QA, use the stable E2E runtime. It performs
the same one-shot bootstrap, then starts only the API, dashboard, and Trigger.dev
without persistent package compilers. Restart it after changing package source;
its purpose is uninterrupted execution testing rather than live package editing.

```sh
npm run dev:e2e
```

When changing an OpenAPI route or schema, regenerate explicitly:

```sh
npm run sdk:generate
```

For a focused API-contract session, start the opt-in SDK watcher in a separate
terminal. It skips generation when the serialized OpenAPI contract is unchanged
and only republishes generated files whose contents changed:

```sh
npm run dev:sdk
```

## Verification

```sh
npm run lint
npm run check-types
npm run build
```
