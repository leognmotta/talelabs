# Trigger.dev Package

This package owns server-side Trigger.dev SDK wiring for TaleLabs.

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

## Checks

Before finishing changes here, run:

```bash
npm run check-types -w @talelabs/trigger
npm run build -w @talelabs/trigger
```
