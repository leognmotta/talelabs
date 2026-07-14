# M5 Deterministic Mock Run Engine - Implementation Prompt

> **Status (2026-07-14): planned and approved, not implemented.** The current
> canvas Run action is an ephemeral browser preview from M4; it is not this
> durable engine.

Use this prompt in a fresh implementation session from the TaleLabs repository
root.

```txt
Implement TaleLabs M5: the provider-independent durable Flow run engine.

Repository:
/Users/leomotta/www/projects/talelabs

Before changing code
====================

1. Read the repository AGENTS.md and obey it.
2. Read these active source-of-truth documents in order:
   - docs/assets-flows-mvp-contract.md
   - docs/talelabs-product-vision.md
   - docs/m5-durable-run-engine-execution-plan.md
   - docs/flow-nodes-planning.md
   - docs/db-design-planning-v2.md
   - docs/api-design-planning-v2.md
   - docs/mvp-execution-plan.md, especially E-050 through E-058
3. Read and follow the installed React Flow, Trigger.dev tasks, Trigger.dev
   realtime, Hono, Kysely, TanStack Query, React i18next, and TaleLabs review
   skills where relevant.
4. Inspect the current dirty worktree. Preserve all existing user/other-agent
   work. Do not revert, reset, rewrite released migrations, commit, or push.
5. Inspect current implementation before designing replacements. In particular:
   - packages/flows/src/**
   - packages/db/src/schema.ts
   - packages/db/src/migrations/004_talelabs_core.ts
   - packages/db/src/migrations/009_remove_elements_from_flows.ts
   - apps/api/src/data/flows.data.ts
   - apps/api/src/routes/flows/**
   - apps/api/src/routes/config/**
   - packages/trigger/src/tasks/**
   - apps/dashboard/src/features/flows/**
   - apps/dashboard/src/features/flows/flow-mock-runtime-planner.ts
   - apps/dashboard/src/features/flows/flow-generation-toolbar-actions.tsx
   - apps/dashboard/src/features/flows/flow-canvas-header.tsx
   - apps/dashboard/src/features/flows/flow-canvas-pane-context-menu.tsx
   - apps/dashboard/src/features/flows/use-flow-canvas-selection.ts

The ordered checkpoints, edge-case semantics, persistence reconciliation,
dispatch recovery, cancellation, retry, and scalability requirements in
`docs/m5-durable-run-engine-execution-plan.md` are authoritative. This prompt is
the implementation handoff; do not reinterpret a shorter statement here as a
different runtime contract.

Research-backed implementation decisions
========================================

Treat the following as settled architecture, not optional inspiration:

- React Flow is the editor/interaction layer only. Use its
  `onSelectionContextMenu` event for selection right-click behavior and its
  selection APIs for presentation state, but never trust browser-selected IDs
  without server-side Flow ownership and graph validation.
- Trigger.dev is durable orchestration, not product-domain storage. PostgreSQL
  owns admitted scope, snapshots, node/item/job state, outputs, idempotency, and
  terminal-state truth.
- Use Trigger.dev parent/child waitpoints and bounded queues. Do not hold a
  worker open while polling children and do not fan out unbounded promises.
- Use Trigger.dev global idempotency for dispatch/child-task deduplication, but
  also enforce domain uniqueness in PostgreSQL. Trigger.dev clears an
  idempotency key after a failed run, so it cannot be the only exactly-once
  boundary.
- Use narrowly scoped, short-lived Trigger.dev realtime read tokens as a
  low-latency wake-up signal. The dashboard must refetch TaleLabs run detail;
  Trigger.dev state never replaces the domain state. Polling remains recovery.
- Preserve input-to-output item lineage explicitly. A downstream output must
  identify the exact upstream item(s) that produced it; positional array order
  alone is not sufficient once iteration and fan-in exist.
- Preserve immutable original-run snapshots so later retry/rerun behavior can
  deliberately choose the original snapshot or a newly admitted current Flow.
- Store media output bytes in R2 and metadata/lineage in PostgreSQL. Seed mock
  fixtures once and copy them through R2's S3-compatible object API; never
  download public stock media during a task run.

Primary references:

- https://reactflow.dev/api-reference/react-flow
- https://reactflow.dev/api-reference/hooks/use-on-selection-change
- https://trigger.dev/docs/idempotency
- https://trigger.dev/docs/queue-concurrency
- https://trigger.dev/docs/realtime/react-hooks/overview
- https://trigger.dev/docs/realtime/auth
- https://developers.cloudflare.com/r2/get-started/s3/
- https://developers.cloudflare.com/r2/reference/consistency/
- https://docs.n8n.io/workflows/executions/all-executions/
- https://docs.n8n.io/data/data-mapping/data-item-linking/item-linking-node-building/

Scope boundary
==============

This milestone uses real saved Flow graphs, Text values, canonical Assets, and
same-run upstream outputs. AI outputs are deterministic mocks. There must be no
OpenRouter/provider SDK call, provider HTTP request, provider credential read,
credit charge, or paid generation.

Elements are not part of M5. Do not import Element services, add Element nodes,
hydrate Element context, inspect Element references, or make M5 depend on the
dormant Element API/tables. Historical contracts may retain Element vocabulary
for old persisted records only; active graph and run code must reject it.

Do not redesign the approved adaptive Image, Video, LLM, Speech, Music, Sound
Effect, Voice Changer, or Voice Isolation node UX. Reuse the approved node
shells, settings cards, input rails, previews, toolbars, and action primitives.
Every current canvas button/action is user-approved.

Do not implement M6. Add a concise
`TODO(provider-integration): ...` only at the normalized adapter boundary where
real providers will replace mocks. Do not scatter provider TODOs through the
planner, persistence, or UI.

Approved run commands
=====================

All controls emit one shared command contract. Do not create separate execution
implementations for toolbar, dropdown, canvas, or context-menu actions:

```ts
type FlowRunCommand =
  | { mode: 'node' | 'downstream' | 'upstream'; targetNodeId: string }
  | { mode: 'selection'; selectedNodeIds: readonly string[] }
  | { mode: 'all' }
```

The API request also includes the saved `expectedFlowRevision`. The client must
flush pending autosave before planning or admitting a run. It sends IDs and the
expected revision, never the browser's graph JSON.

Implement exactly five user-visible M5 modes:

1. `node` / Run node
   - Execute the target executable node.
   - Resolve required static Text/Asset sources.
   - Do not automatically execute unrelated executable ancestors.

2. `downstream` / Run from here
   - Execute the target and executable descendants.
   - Resolve required static sources for the selected subgraph.

3. `upstream` / Run till here
   - Execute the target and executable ancestors required to reach it.

4. `selection` / Run selection
   - Start from selected executable nodes.
   - Add their minimum required executable upstream dependency closure.
   - Ignore selected edges for execution semantics.
   - Reject an empty selection or a selection with no executable node.
   - Return/show both selected executable count and actual planned executable
     count so hidden dependency expansion is disclosed before admission.
   - The React Flow integration uses `onSelectionContextMenu`; selected edges
     are ignored and selected node IDs are revalidated on the server.

5. `all` / Run all
   - Execute every executable node in the saved Flow.

Text, Asset, Iterator/Map, Collect, Zip, Prompt Iterator, and other deterministic
control/source nodes may participate in planning without creating AI jobs.

Approved UI placement:

- Node toolbar primary Run executes `node`.
- Existing node Run dropdown keeps Run from here and Run till here.
- Add Run all to the main canvas action bar/header using existing toolbar
  primitives and visual conventions.
- Add Run selection to the right-click context menu only when the selection
  contains at least one executable node.
- Do not call React Flow nodes "elements" in product copy.
- Preserve existing selection, keyboard, toolbar, and context-menu behavior.

Architecture requirements
=========================

Keep React Flow as the editor. The API/server is the execution authority.

Build small, explicit layers instead of one run-engine file:

1. Pure graph selection and planning in `@talelabs/flows`
2. API admission/domain service
3. Kysely persistence/data functions
4. Trigger.dev orchestration and job tasks
5. Deterministic mock adapters
6. Output persistence/Asset ingestion
7. Hono/OpenAPI routes and regenerated SDK
8. Dashboard query/mutation/state bindings
9. Small reusable run UI components

There is one path after command capture:

```txt
canvas command
  -> flush autosave and capture expected Flow revision
  -> server plan/preflight
  -> immutable run admission
  -> durable Trigger.dev dispatch
  -> normalized mock adapter
  -> canonical output persistence/Asset ingestion
  -> domain status query + realtime wake-up
```

Add a server-owned preflight endpoint. It returns the canonical plan summary,
captured revision, and `planHash` without inserting a run. The dashboard may
auto-continue for an obvious one-node plan, but must disclose scope before
admission when dependency expansion or multiplicity makes the actual plan
larger than the visible target/selection. `POST /runs` replans and verifies the
same revision and plan hash; preflight is never an authorization bypass.

No React, Hono, Kysely, Trigger.dev, storage, signed URLs, or environment reads
belong in the pure planner package. Do not duplicate model capability knowledge
outside the existing generation registry and adaptive resolvers.

Phase 1 - reconcile persistence
================================

The current migration-004 schema predates the approved M5 contract. Add a new
forward-only migration; never edit a released migration.

Reconcile at least these facts:

- Extend FlowRunMode/check constraints with `upstream` and `selection` while
  retaining `node`, `downstream`, `all`, and deferred historical `tool`.
- Add immutable `snapshotHash` and `executorVersion` to flowRuns with a safe
  migration/backfill strategy.
- Treat `targetNodeId` as required for node/downstream/upstream.
- Store selection request IDs and expanded dependency closure in the immutable
  graph snapshot rather than mutable graph rows.
- Remove the one-job-per-node assumption represented by `flowRunNodes.jobId`.
- Keep `flowRunNodes` as node-level summary state.
- Add `flowRunNodeItems` keyed by flowRunId + nodeId + deterministic itemKey,
  with sortOrder, dimensions, lineage, status, timestamps, tenant-safe FKs, and
  indexes needed by progress/aggregation.
- Add generationJobs.itemKey and generationJobs.requestIndex. The unique domain
  execution boundary is flowRunId + nodeId + itemKey + requestIndex.
- Add `text` generation-job output support. Persist LLM text in a dedicated
  normalized text-output relation; never create a fake Asset for text.
- Keep each successful image/video/audio output as a canonical Asset using the
  existing generationJobId + outputIndex relationship.
- Add `partial` where item/node state aggregation requires it.
- Update packages/db/src/schema.ts and every affected type/data query.
- Preserve organization-scoped composite FKs and indexes. No cross-tenant ID may
  be accepted merely because the application forgot a predicate.

Use the target design in docs/db-design-planning-v2.md, but reconcile it against
the actual schema rather than copying SQL blindly. Ensure fresh migration and
upgrade-from-current both work.

Phase 2 - pure deterministic planner
=====================================

Implement a server-usable planner in `@talelabs/flows` with no framework IO.
It must:

- Accept a versioned graph, requested run mode/target/selection, resolved static
  source descriptors, and the checked-in generation capability registry.
- Select the exact mode-specific executable subgraph.
- Validate node schemas, handle existence, edge compatibility, required inputs,
  adaptive operation, model settings, cross-field constraints, and executable
  DAG acyclicity.
- Produce deterministic topological levels and deterministic edge/source order.
- Resolve Text and direct Asset values.
- Represent every wire as an ordered collection of typed runtime items with
  stable item keys and lineage.
- Implement explicit Iterator/Map, Collect, Zip, and Prompt Iterator semantics.
- Never multiply downstream execution implicitly just because a provider job
  returned several Assets. A generation result is one typed set item until an
  explicit iterator expands it.
- Expand work items and bounded request shards explicitly.
- Enforce hard safety limits before persistence: nodes, edges, items per node,
  total items/jobs per run, output count, dimensions, snapshot bytes, and
  recursion/depth where applicable. Limits live in shared code config.
- Return a serializable, versioned execution plan and actionable validation
  errors with node/slot IDs.
- Return a canonical `planHash`, selected versus planned executable counts,
  planned work-item/job/output counts, and the reason every executable node is
  included (`target`, `selected`, `dependency`, or `descendant`).

The existing dashboard `flow-mock-runtime-planner.ts` may remain as a UI preview
adapter, but it must not become a second source of domain rules. Move/reuse pure
logic where practical so browser readiness and server admission cannot drift.

Phase 3 - immutable admission
==============================

Create one application/domain service for run admission:

- Require Idempotency-Key and hash the canonical request body.
- Same key + same body returns the existing run; same key + different body is a
  conflict.
- Apply organization/user admission limits through existing API-level policy;
  do not add an unbounded in-memory cache or feature-local rate limiter.
- Require `expectedFlowRevision` and, when preflight was used,
  `expectedPlanHash`. A mismatch returns a typed
  `409 flow_revision_changed` or `409 run_plan_changed`; never silently execute
  a newer graph than the one the user clicked.
- Take the organization admission lock using the established PostgreSQL
  advisory-lock discipline.
- Read the saved Flow revision and graph, plan with the pure server planner,
  resolve direct Assets, lock exact existing Asset rows in stable ID order, and
  require usable lifecycle + processingState=ready.
- Re-read Flow revision immediately before insertion under READ COMMITTED.
- On revision drift, roll back and return the typed conflict. The dashboard may
  flush/replan/retry as a new explicit admission; the API must not silently move
  the command to a different revision.
- Persist one bounded immutable snapshot containing:
  - snapshot schema version and hash
  - captured Flow revision
  - requested mode, target/selection, and expanded closure
  - exact node configs and deterministic edge order
  - planner/executor version
  - stable TaleLabs model IDs and model-contract versions/hashes
  - derived operations and normalized settings
  - topological levels, work items, dimensions, and lineage
  - all considered static candidates/exclusions/selection decisions
  - exact static Asset IDs and source order
- Never snapshot signed URLs, storage keys, credentials, provider payload bytes,
  React state, or expiring presentation data.
- Insert run, node summaries, work items, initial jobs, sources, and exact inputs
  transactionally.

Create one shared canonical serializer for snapshotHash and requestHash. Sort
object keys recursively but preserve semantically ordered arrays. Do not hash
arbitrary JSON.stringify output assembled from Maps.

Phase 4 - Trigger.dev orchestration
===================================

Use one parent orchestration task for every M5 mode, including `node`. This
keeps cancellation, item expansion, and reconciliation on one execution path.

- Trigger payload is only `{ flowRunId, organizationId }`.
- Parent Trigger idempotency key is flowRunId.
- API and task both persist the Trigger run ID so the crash window reconciles.
- Treat an undispatched `flowRuns` row as a durable dispatch outbox. The API
  performs best-effort dispatch after commit and a reconciler scans stale
  undispatched rows. Both use one global key derived from flowRunId.
- At parent-task startup, compare-and-set the domain Trigger run ID/claim. If a
  second Trigger run exists after a crash or cleared failed idempotency key, it
  must observe the winning claim and exit without executing jobs.
- The task loads the immutable snapshot from PostgreSQL and verifies
  snapshotVersion/hash/executor compatibility before executing.
- Execute ready topological levels; parallel independent jobs may use Trigger.dev
  batch/child patterns with bounded concurrency.
- Create downstream jobs just in time when same-run upstream outputs exist.
- Derive job/child idempotency from flowRunId:nodeId:itemKey:requestIndex.
- Retry must resume persisted state, never duplicate a job or canonical output.
- A failed item skips only descendants that require it. Preserve independent
  successes and aggregate honest partial state.
- Cancellation cancels parent and active children and uses guarded terminal
  transitions. Completion-vs-cancel resolves to one winner.
- Add a reconciliation task/entrypoint for pending runs/jobs missing Trigger IDs.
- Keep Trigger payloads small. Never send graph JSON, media bytes, or signed URLs.

Phase 5 - deterministic mock adapters and outputs
=================================================

Create one normalized adapter interface that M6 can implement without changing
planner, API, persistence, orchestration, or UI. It must support the lifecycle
shapes already represented in generation-provider-contracts.ts while M5 routes
all operations to local deterministic mocks.

Mock behavior:

- No network calls and no provider credentials.
- Add a versioned private mock-fixture manifest and a repeatable seed/verify
  script. Start with one small valid image, one audio file, and one short video;
  prefer repository-owned generated fixtures. If external media is ever used,
  record its immutable source, license, and checksum.
- Seed fixtures once per environment under a reserved private prefix such as
  `system/mock-generation/v1/`. Never fetch or download fixtures during a run.
- Equivalent normalized request + mock-adapter version deterministically chooses
  the same fixture/text and metadata, although each admitted run still receives
  its own domain rows and unique output storage key.
- Text: deterministic useful placeholder derived from request hash and prompt;
  persist as text output, not Asset.
- Image/audio/video: copy the selected fixture to the real generation output key
  using the existing R2/S3 storage abstraction, then continue through the same
  completion and ingestion path M6 will use. R2 CopyObject is strongly
  read-after-write consistent after completion.
- Keep fixture duration/resolution bounded even if the requested production
  profile is expensive. Metadata records fixture catalog version, fixture ID,
  checksum, requested profile, and actual mock-produced profile.
- Add bounded mock latency so queued/running UI is observable. Provide
  verifier/development-only controls for retryable failure, permanent failure,
  partial output, timeout, and cancellation. These controls must not become
  customer node fields or a provider-specific public API contract.
- Honor requested output count and request sharding within safety limits.
- Store every result under a deterministic generation job/output key. Do not
  point several output Asset rows at the shared fixture source key.
- Reuse the canonical generation Asset completion path: output Asset insertion,
  processing/thumbnail metadata, guarded job completion, and replay-safe
  conflict handling happen transactionally.
- Explicitly record zero provider cost and mock adapter identity/version.
- Never mark a failed/canceled job succeeded merely because an object exists.
- Cleanup only unreferenced objects after a losing completion/cancel race.

Put the single provider replacement comment at this adapter registry/boundary:
`TODO(provider-integration): Replace deterministic mocks with pinned M6 provider adapters without changing the run contract.`

Phase 6 - Hono API and SDK
==========================

Implement organization-scoped OpenAPI routes and services following existing
route/schema/service/data separation:

- POST /flows/:id/run-plans
- POST /runs
- GET /runs/:id
- GET /runs?flowId=&status=&limit=&cursor=
- POST /runs/:id/cancel
- POST /runs/:id/retry creates a new idempotent, snapshot-derived run. It never
  mutates or reopens the original terminal run and never reads the current
  mutable Flow as retry truth.
- GET /flows/:id/nodes/:nodeId/results

Responses must expose planned/finished node and item counts, status hierarchy,
safe errors, jobs, text outputs, media output Assets, and the actual selected vs
planned count for selection mode. Never expose provider credentials, storage
keys, internal raw errors, or cross-organization existence.

Regenerate the Kubb SDK. Dashboard code consumes generated contracts/hooks where
the repo already does so; do not hand-maintain duplicate response types.

Phase 7 - dashboard run UX
==========================

Bind existing approved canvas controls to the real run API while preserving the
current visual design:

- Node Run / Run from here / Run till here.
- Main canvas Run all action.
- Right-click Run selection for selected executable nodes.
- Every action flushes Flow autosave and runs the saved revision; commands never
  submit unsaved browser graph JSON.
- Pre-admission summary for selection closure and any multiplicative plan.
- queued, running, succeeded, partial, failed, canceled, and skipped states.
- Item/output progress where iteration or multiple outputs exist.
- Node result previews/history derived from runs/jobs/Assets/text outputs, never
  copied into flowNodes.data.
- Cancel and snapshot-preserving rerun affordances.
- Use a root-level active-run subscription so progress survives canvas
  unmount/navigation. Use a narrowly scoped Trigger.dev Realtime read token to
  wake/refetch organization-scoped TanStack Query run data. Refresh expired
  tokens for long jobs. Fall back to bounded polling and always recover from the
  PostgreSQL-backed run API.
- Render status from domain rows, not directly from Trigger.dev. Realtime events
  cause invalidation/refetch and may carry safe progress hints only.
- Organization-scoped query keys and cache cleanup on organization switch.
- Full i18n coverage; no hard-coded English in React UI.
- Reuse current toolbar, button, menu, status, preview, card, and inspector
  primitives. If repeated behavior appears in two node families, extract it.
  Do not independently recreate components for each generation family.

Phase 8 - verification and handoff
==================================

Automated tests are not an MVP acceptance requirement, but add focused pure
planner scenarios and repeatable smoke/verifier scripts where they materially
protect run selection, snapshot immutability, tenancy, idempotency, iteration,
and completion races. Do not build a large new test framework.

Verify at minimum:

- Fresh database migration and upgrade from current migration state.
- All five subgraph-selection semantics on branching DAGs.
- Selection dependency closure is disclosed and deterministic.
- Cycle and invalid-slot/model combinations fail before run insertion.
- Same idempotency key/body replays; different body conflicts.
- Pending autosave is flushed before admission; concurrent Flow edits return a
  typed revision conflict and never silently run a newer revision.
- Preflight and admission hashes match; a changed plan returns a typed conflict.
- Concurrent admission cannot cross tenants or duplicate runs/jobs/items.
- Flow edit during admission causes bounded retry, never a mixed snapshot.
- Purge-vs-admission serializes safely.
- Iterator/Collect/Zip and output-count multiplication are explicit and bounded.
- Trigger retries do not duplicate jobs or Assets.
- Completion-vs-cancel has one terminal winner.
- Retryable/permanent/partial mock scenarios exercise the same guarded state
  transitions used by future provider adapters.
- Mock image/audio/video files are valid and become usable canonical Assets.
- Fixture seeding is repeatable; runtime execution performs no stock-media
  download and copies fixtures to unique output keys.
- LLM text remains durable without becoming an Asset.
- No active M5 import or runtime query depends on Elements.
- No code path reads OPENROUTER_API_KEY or performs provider network IO.

Run repository gates:

- npm run sdk:generate
- npm run check-types
- npm run i18n:check
- npm run lint
- generation registry/drift validation already used by the repo
- npm run build
- npm run trigger:deploy:check
- git diff --check
- generated-file and temporary `.gen-*` audit

UI/end-to-end product QA belongs to the user. Do not claim M5 accepted merely
because builds pass. Leave the dev environment in a usable state, report exact
changed files, migration state, verification results, remaining risks, and the
manual QA checklist. Do not commit or push.

Quality bar
===========

- Maintain strict tenant isolation in every query, FK, signed-media lookup, and
  Trigger task.
- Prefer domain types and discriminated unions over boolean-heavy APIs.
- Keep planner functions pure and deterministic.
- Keep files cohesive; split graph selection, planning, snapshotting,
  persistence, orchestration, adapters, and UI rather than creating a run-engine
  monolith.
- Reuse existing adaptive resolvers and canvas primitives. One model registry,
  one node registry, one planner, one snapshot serializer, one run service, and
  one adapter boundary.
- Do not add process-local caches, queues, locks, metrics aggregation, or rate
  limits that pretend to coordinate multiple API instances.
- Preserve readable code and explicit names. Add short comments only around
  concurrency, snapshot, or lineage rules that are not self-evident.
- If implementation evidence conflicts with a planning document, stop that
  subtask, document the discrepancy, and update the active contract deliberately
  rather than silently choosing one behavior.
```
