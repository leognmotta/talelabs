# TaleLabs Trigger Runtime

This package owns TaleLabs background execution: Asset processing, durable Flow
runs, provider calls, output recovery, and scheduled reconciliation.

The organizing rule is simple:

- `src/tasks` answers **what Trigger.dev deploys**.
- Feature folders answer **how the work is performed**.
- `src/index.ts` answers **what the API may import from this package**.

Trigger.dev recursively discovers TypeScript task files under the directories in
the root [`trigger.config.ts`](../../trigger.config.ts). TaleLabs configures only
`packages/trigger/src/tasks` as that discovery boundary. This follows
Trigger.dev's documented `dirs` configuration while keeping business logic out
of the deployment-entrypoint folder:

- [Trigger.dev configuration: `dirs`](https://trigger.dev/docs/config/config-file#dirs)
- [Trigger.dev task overview](https://trigger.dev/docs/tasks/overview)
- [Trigger.dev manual setup and monorepo examples](https://trigger.dev/docs/manual-setup)

## Start here

Read these files in order for the shortest path through the runtime:

1. [`../../trigger.config.ts`](../../trigger.config.ts) — runtime, task discovery,
   retries, duration, and build extensions.
2. [`src/tasks/flow-runs/orchestrator.task.ts`](src/tasks/flow-runs/orchestrator.task.ts)
   — deployed parent task for a Flow run.
3. [`src/flow-runs/orchestration/run.ts`](src/flow-runs/orchestration/run.ts) —
   reads the immutable snapshot and dispatches each topological level.
4. [`src/tasks/flow-runs/generation-job.task.ts`](src/tasks/flow-runs/generation-job.task.ts)
   — deployed task for one planned generation job.
5. [`src/flow-runs/execution/job/run.ts`](src/flow-runs/execution/job/run.ts) —
   validates the snapshot contract, materializes inputs, runs the provider, and
   finalizes outputs.
6. [`src/generation/adapters/registry.ts`](src/generation/adapters/registry.ts) —
   resolves an immutable provider route to one compatible shared adapter.
7. [`src/generation/adapters/lifecycle/runner.ts`](src/generation/adapters/lifecycle/runner.ts)
   — submit, checkpoint, resume, poll, and reconcile provider facts.
8. [`src/flow-runs/execution/outputs/finalizer.ts`](src/flow-runs/execution/outputs/finalizer.ts)
   — converts normalized results into canonical text outputs or Assets.
9. [`src/flow-runs/reconciliation/provider-accounting.ts`](src/flow-runs/reconciliation/provider-accounting.ts)
   — recovers eventual OpenRouter cost without reopening successful output work.

## Package map

```text
src/
├── index.ts                  Public server-side package API
├── platform/                 Trigger SDK client, dispatch, env, task contracts
├── tasks/                    Trigger.dev discovery boundary; thin entrypoints
│   ├── assets/               Ingest, purge, and reconciliation tasks
│   └── flow-runs/            Orchestrator, generation job, reconciliation tasks
├── assets/                   Asset processing and generated-output storage
│   ├── media/                Format probing and media-specific processing
│   ├── processing/           Ingest, purge, metadata, and reconciliation
│   └── outputs/              Output folders and public generated storage
├── flow-runs/                Durable run and job execution
│   ├── contracts/            Immutable execution/snapshot compatibility
│   ├── orchestration/        Parent-run traversal and graph failure behavior
│   ├── execution/            Per-job inputs, provider checkpoints, and outputs
│   ├── persistence/          Claims and terminal state transitions
│   ├── reconciliation/       Recovery of undispatched or stale work
│   └── observability/        Safe structured runtime logging
├── generation/               Provider-independent generation boundary
│   ├── inputs/               Tenant-scoped Asset resolution for providers
│   └── adapters/             Contracts, lifecycle, mock, and OpenRouter
│       └── openrouter/        Shared protocol families and common HTTP semantics
│           ├── image/
│           ├── video/
│           ├── speech/
│           ├── chat/
│           └── shared/
└── shared/                   Cross-feature failures and binary helpers
```

## Deployed task entrypoints

All deployed task definitions end in `.task.ts`. Their IDs are stable runtime
contracts used by persisted runs and Trigger.dev.

| Task ID | Entry point | Responsibility |
| --- | --- | --- |
| `asset-ingest` | `tasks/assets/ingest.task.ts` | Download, validate, process, and persist Asset metadata |
| `asset-purge` | `tasks/assets/purge.task.ts` | Remove deleted Asset objects safely |
| `asset-reconcile` | `tasks/assets/reconcile.task.ts` | Redispatch stalled Asset processing/purging |
| `flow-run-orchestrator` | `tasks/flow-runs/orchestrator.task.ts` | Traverse an immutable Flow plan and wait for child jobs |
| `generation-job` | `tasks/flow-runs/generation-job.task.ts` | Execute one tenant-scoped generation job durably |
| `flow-run-reconcile` | `tasks/flow-runs/reconcile.task.ts` | Repair run state and dispatch admitted runs missing a parent task |
| `provider-cost-reconcile` | `tasks/flow-runs/provider-accounting.task.ts` | Recover eventual OpenRouter cost independently of output and dispatch state |

Task files contain the Trigger.dev-facing task ID, payload schema, queue, retry
policy, schedule, and lifecycle-handler wiring. The owning feature folder
contains the implementation behind each entrypoint.

## Flow execution path

```mermaid
flowchart TD
  API["API admits Flow run"] --> Dispatch["platform/dispatch.ts"]
  Dispatch --> Parent["flow-run-orchestrator task"]
  Parent --> Plan["flow-runs/orchestration/run.ts"]
  Plan --> Child["generation-job task"]
  Child --> Job["flow-runs/execution/job/run.ts"]
  Job --> Inputs["Materialize immutable inputs"]
  Inputs --> Registry["generation/adapters/registry.ts"]
  Registry --> Lifecycle["Shared provider lifecycle"]
  Lifecycle --> Checkpoint["Durable provider-result checkpoint"]
  Checkpoint --> Finalize["Text output or canonical Asset"]
  Finalize --> Aggregate["Aggregate job and Flow-run state"]
  Checkpoint -. "eventual cost" .-> Accounting["Bounded accounting reconciliation"]
  Accounting -.-> Aggregate
```

The API creates and locks the graph snapshot before dispatch. Trigger tasks load
tenant-scoped rows from PostgreSQL and never execute from the mutable canvas.
Provider results are normalized before output persistence. Paid submissions and
immediate results use durable boundaries so retries resume instead of charging
again.

## Provider adapter map

The adapter architecture is protocol-first, not model-first:

- `openrouter/image` handles models using OpenRouter's image API.
- `openrouter/video` handles asynchronous video submission, callback wakeups,
  polling recovery, and streamed output staging.
- `openrouter/speech` handles speech requests and generation-cost metadata.
- `openrouter/chat` handles text/LLM requests.
- `openrouter/shared` contains only behavior genuinely shared across those four
  protocol families.

Model capabilities live in `@talelabs/flows`; private OpenRouter routes and
typed request profiles live in `@talelabs/openrouter`. The Trigger package owns
the normalized protocol behavior shared by those models.

## Where to make a change

| Goal | Primary location |
| --- | --- |
| Add or change a deployed task | `src/tasks/<feature>/*.task.ts` plus the owning feature module |
| Change Flow traversal | `src/flow-runs/orchestration/` |
| Change one generation job | `src/flow-runs/execution/job/` |
| Change exact input provenance | `src/flow-runs/execution/inputs/` |
| Change retry-safe provider recovery | `src/flow-runs/execution/provider-results/` and `generation/adapters/lifecycle/` |
| Change eventual provider accounting | `src/flow-runs/reconciliation/provider-accounting.ts` and `flow-runs/persistence/accounting-queries.ts` |
| Change canonical output persistence | `src/flow-runs/execution/outputs/` |
| Add a model using an existing protocol | `@talelabs/flows` registry and `@talelabs/openrouter` routes, not a new Trigger adapter |
| Add a genuinely new provider protocol | `src/generation/adapters/<provider-or-protocol>/` and the adapter registry |
| Change API-side dispatch | `src/platform/dispatch.ts` and `src/index.ts` |

## Verification

From the repository root:

```bash
npm run check-types -w @talelabs/trigger
npm run build -w @talelabs/trigger
npm run providers:verify -w @talelabs/trigger
npm run provider-results:verify -w @talelabs/trigger
npm run trigger:deploy:check
```

The provider verification command exercises production routes with fake HTTP;
it does not make paid provider requests.
