# API Architecture

This app uses Hono with `@hono/zod-openapi`. Keep the API Hono-native, OpenAPI-first, and simple enough that generated SDKs stay accurate.

## Installed Skills

- `hono`: primary Hono skill for routing, middleware, validation, request testing, streaming, and Hono API reference.
- `hono-api-scaffolder`: secondary reference for structured Hono route scaffolding. It is Cloudflare Worker oriented, so adapt its patterns to this Node server instead of copying Worker bindings.

When Codex does not pick up newly installed skills in the current thread, restart Codex before relying on automatic skill activation.

## Directory Shape

Use this structure as the API grows:

```txt
src/
  index.ts                  # Node server only
  app.ts                    # Compose app and mount route modules
  openapi.ts                # OpenAPI metadata and docs route
  middleware/
    auth.ts
    cors.ts
    error.ts
  schemas/
    common.ts               # ErrorResponse, pagination, ids
  routes/
    system/
      system.routes.ts
      system.schemas.ts
    account/
      account.routes.ts
      account.schemas.ts
    organizations/
      organizations.routes.ts
      organizations.schemas.ts
  services/
    account.service.ts      # Hono-free business logic
    organization.service.ts
  data/
    account.queries.ts      # Kysely/db queries only
    organization.queries.ts
```

Do not create every folder ahead of need. Add the structure as soon as a second route group or shared concern appears.

## Boundaries

- `routes/*`: HTTP contract, `createRoute`, `app.openapi(route, handler)`, request parsing, response mapping.
- `*.schemas.ts`: Zod/OpenAPI schemas for route-local contracts.
- `schemas/common.ts`: shared schemas such as errors, pagination, ids, and reusable enums.
- `services/*`: business logic without Hono `Context`; services receive plain inputs and return plain results.
- `data/*`: database reads/writes only; no HTTP concerns and no response shaping.
- `middleware/*`: auth, CORS, errors, request ids, and other cross-cutting HTTP concerns.
- `app.ts`: app assembly only; no business logic.
- `index.ts`: server startup only; no routes.

## Single Responsibility

Keep each API file responsible for one architectural concern. Do not solve routing, validation, business logic, database access, provider integration, and response shaping in a single file just because the first implementation is small.

When a route starts doing more than request/response mapping, split the reusable parts into the right layer:

- Shared request/response contracts go in `*.schemas.ts` or `schemas/common.ts`.
- Business decisions, orchestration, and provider-independent behavior go in `services/*`.
- Database reads and writes go in `data/*`.
- Provider-specific adapters and clients should live behind reusable modules instead of inside route handlers.
- Cross-cutting HTTP behavior belongs in `middleware/*`.

Prefer small, composable modules with plain inputs and outputs. A feature should be easy to reuse from another endpoint, test independently, and move without dragging Hono `Context` or database details across layers. Respect the existing architecture boundaries even when adding a quick MVP endpoint.

## Hono Rules

- Keep `createRoute(...)` and `app.openapi(route, handler)` close together in `*.routes.ts`.
- Avoid Rails-style controller files. Hono infers params and validation best when route definitions and handlers stay together.
- Prefer route groups mounted with `app.route('/prefix', routeApp)` once a resource has multiple endpoints.
- Use `@hono/zod-openapi` schemas for request and response contracts so `/openapi.json` remains the source for SDK generation.
- Return JSON errors for API routes. Do not redirect from API handlers.
- Keep auth/session extraction in middleware or small helpers; pass plain auth data into services.

## Product Resources

For the generation product, model the API around these core resources:

```txt
Organization
  Project
    Asset
    Generation
    Board
    Workflow
```

Start with the MVP resources:

```txt
projects
assets
generations
models
uploads
```

Projects are lightweight containers for organizing assets, generation jobs, boards, and later workflows. The primary product action is creating a `Generation` from `modality`, `modelId`, prompt, reference assets, and params.

## Endpoint Conventions

Prefer resource-oriented routes:

```txt
GET    /projects
POST   /projects
GET    /projects/:projectId
PATCH  /projects/:projectId
DELETE /projects/:projectId

GET    /projects/:projectId/assets
POST   /uploads
POST   /assets
GET    /assets/:assetId

GET    /models?modality=image|video|audio

POST   /generations
GET    /generations/:generationId
POST   /generations/:generationId/cancel
GET    /projects/:projectId/generations
```

`POST /generations` should use one discriminator for the Runway-like media tabs:

```json
{
  "projectId": "project_123",
  "modality": "video",
  "modelId": "gen-4-turbo",
  "prompt": "A woman drinking a blue can in a cafe",
  "inputAssetIds": ["asset_first_frame"],
  "params": {
    "aspectRatio": "16:9",
    "durationSeconds": 5
  }
}
```

## Checks

Before finishing API architecture changes, run:

```bash
npm run lint
npm run build -w api
```

If SDK output depends on OpenAPI changes, also run:

```bash
npm run sdk:generate
```
