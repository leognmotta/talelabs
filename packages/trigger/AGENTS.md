# Trigger.dev Package

This package owns server-side Trigger.dev SDK wiring for TaleLabs.

Before changing this package, read [`README.md`](README.md). It documents the
task entrypoints, feature boundaries, execution path, and dependency direction.

## Rules

- Keep `TRIGGER_SECRET_KEY` server-side. Never import this package directly into browser-only dashboard code.
- Keep `TRIGGER_PROJECT_REF` as deployment/runtime configuration for `trigger.config.ts`.
- Use the installed Trigger.dev skills before adding tasks, schedules, agents, realtime UI, queues, or build extensions:
  - `trigger-setup`
  - `trigger-config`
  - `trigger-tasks`
  - `trigger-agents`
  - `trigger-realtime`
  - `trigger-cost-savings`
- Prefer the v4 `@trigger.dev/sdk` APIs. Do not use deprecated `client.defineJob`.
- App code should import Trigger.dev primitives from this package when it needs a shared boundary; task files may import directly from `@trigger.dev/sdk` when Trigger.dev requires it.
- Task payloads that operate on tenant-owned data must include `organizationId` and must validate or enforce organization scoping before doing work.
- Keep `src/tasks` as the only Trigger.dev discovery boundary. Deployed task
  definitions use the `.task.ts` suffix and stay thin: task ID, schema, queue,
  retries/schedule, and lifecycle wiring only.
- Put substantial behavior in the owning `assets`, `flow-runs`, or `generation`
  feature. Do not recreate a flat `providers` or `tasks/flow-runs` helper dump.
- Organize OpenRouter adapters by shared protocol (`image`, `video`, `speech`,
  and `chat`), never one adapter per model.
- Prefer direct internal imports over barrel files so ownership and dependency
  direction remain visible.
- Preserve the stable task IDs documented in `README.md`. Renaming files must
  not rename deployed task IDs or change persisted run contracts.
- Keep persistence and lifecycle behavior in the owning feature. Do not create
  generic helper folders that mix unrelated responsibilities.
- Orchestration may import only the specific task object it durably dispatches.
  Other domain modules must not depend on task entrypoints.
- Provider adapters return normalized results. They must not create Assets or
  decide Flow-run terminal state.
- Keep `shared` limited to code used by multiple top-level features. Prefer a
  feature-local module until cross-feature ownership is proven.
- Keep every tenant-owned query scoped by `organizationId`.
- Preserve immutable snapshots, durable submission and result checkpoints,
  cancellation, retries, provider facts and costs, and canonical output Assets.
- Model capabilities belong in `@talelabs/flows`; private routes and request
  profiles belong in `@talelabs/openrouter`. Do not put model catalogs in this
  package.
- Provider verification must inject fake HTTP. Never make a paid provider
  request as part of automated verification.

## Checks

Before finishing changes here, run:

```bash
npm run check-types -w @talelabs/trigger
npm run build -w @talelabs/trigger
npm run providers:verify -w @talelabs/trigger
npm run provider-results:verify -w @talelabs/trigger
npm run trigger:deploy:check
```
