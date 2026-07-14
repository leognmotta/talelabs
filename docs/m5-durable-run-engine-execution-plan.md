# M5 Durable Run Engine Execution Plan

**Status:** proposed architecture, implementation not started.

**Updated:** 2026-07-14.

This document is the authoritative engineering sequence for TaleLabs M5. It
turns the approved canvas commands into a production-shaped execution system
while keeping every AI/provider result deterministic and free. M6 replaces the
mock adapter boundary with real provider adapters; it must not replace the run
engine.

Read these documents first:

```txt
docs/assets-flows-mvp-contract.md
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/db-design-planning-v2.md
docs/api-design-planning-v2.md
docs/mvp-execution-plan.md
docs/m5-deterministic-mock-run-engine-implementation-prompt.md
```

## 1. Architecture Decision

The supplied external research agrees with the TaleLabs design on the important
boundaries:

```txt
React Flow   = editing, selection, command capture, and visualization
PostgreSQL   = authoritative run ledger and immutable execution snapshot
Trigger.dev  = durable orchestration, waits, retries, queues, and cancellation
R2           = private fixture bytes and canonical generated media bytes
```

The browser submits intent, IDs, and a saved Flow revision. It never submits an
authoritative graph for execution. The API recompiles the saved graph, freezes
the run, and persists domain state before Trigger.dev receives work.

This is deliberately not a simple topological `for` loop. A topological planner
is necessary, but production execution also requires durable work items,
idempotent dispatch, bounded concurrency, lineage, cancellation, recovery, and
canonical output ingestion.

### Accepted conclusions

- Execute one exact saved Flow revision through an immutable snapshot.
- Revalidate every client-provided node ID, selection, Flow ID, and Asset ID on
  the server under organization scope.
- Use one pure planner for all five run commands.
- Use one parent Trigger.dev task for every run mode, including one-node runs.
- Keep PostgreSQL as product truth; Trigger.dev is execution infrastructure.
- Pass only tenant-scoped IDs to Trigger tasks.
- Use Trigger.dev global idempotency plus PostgreSQL uniqueness. Neither replaces
  the other.
- Execute independent DAG branches through bounded child-task batches, never
  `Promise.all()` around Trigger wait functions.
- Seed mock fixtures once, copy them into unique output keys, and run them
  through the real Asset pipeline.
- Treat Realtime as an invalidation signal. Render the PostgreSQL-backed run API.
- Preserve item-level input/output lineage explicitly.

### Deliberate TaleLabs refinements

- `canceled` is the durable cancellation intent and terminal domain state. Do
  not add a parallel `cancelRequestedAt` state machine. A guarded status update
  chooses the completion-versus-cancel winner; Trigger cancellation and repair
  happen after that durable decision.
- Trigger.dev retries are infrastructure attempts, not product reruns. A user
  retry creates a new immutable TaleLabs run.
- The immutable snapshot freezes exact static inputs and rules for same-run
  dynamic outputs. It cannot contain generated Asset IDs that do not exist yet.
- Topological tie-breaking uses persisted stable IDs/order, never canvas
  position. Moving a node must not change execution semantics.
- The current normalized `flowNodes`/`flowEdges` tables remain the editable
  document. Per-run JSONB is the immutable execution artifact, not a replacement
  for normalized Flow persistence.

## 2. M5 Scope

M5 must execute real saved inputs through the complete durable path:

```txt
saved Flow + Text + Assets
-> server preflight
-> immutable admission
-> Trigger.dev orchestration
-> deterministic mock provider result
-> canonical Asset or durable text output
-> run history, progress, cancellation, and rerun
```

M5 includes:

- `node`, `downstream`, `upstream`, `selection`, and `all` commands;
- immutable snapshots and deterministic hashes;
- item and request-shard execution;
- explicit iteration and multiple outputs;
- durable run/node/item/job states;
- deterministic text, image, video, and audio mocks;
- canonical media output Assets and text output rows;
- partial failure, cancellation, retry/rerun, and reconciliation;
- root-level progress observation and run history.

M5 excludes:

- OpenRouter/provider calls or credentials;
- credits, charging, or non-zero mock cost;
- Elements or Element context;
- Tools, public API, MCP, Recipes, or collaborative execution;
- provider-specific execution branches outside the normalized adapter boundary;
- implicit fan-out from an ordinary media collection.

Every mock replacement point uses exactly one boundary comment:

```ts
// TODO(provider-integration): Replace deterministic mocks with pinned M6
// provider adapters without changing the run contract.
```

## 3. Non-Negotiable Runtime Invariants

1. One run executes one immutable snapshot and one executor version.
2. Flow edits after admission cannot alter an active or historical run.
3. Static Asset inputs are exact, ordered, tenant-owned, ready, and locked at
   admission.
4. Same-run outputs resolve only from the same `flowRunId` and compatible item
   lineage.
5. Trigger tasks receive IDs, never graph JSON, media bytes, signed URLs, or
   credentials.
6. A database row and unique key define each logical run/job/output. Trigger
   idempotency only suppresses duplicate task dispatch.
7. A media job succeeds only after every required output is a canonical,
   processed, usable Asset.
8. An ordinary `ImageSet`, `VideoSet`, or `AudioSet` is one inner collection. It
   does not multiply downstream work without an explicit Iterator/Map.
9. Independent branches continue after an unrelated branch fails.
10. Every domain transition is tenant-scoped, guarded, and monotonic.
11. Realtime can wake the UI but cannot become the source of product truth.
12. No in-memory lock, queue, rate limiter, cache, or metric is allowed to
    coordinate API or worker replicas.

## 4. Canonical Run Commands

All canvas controls use one request union:

```ts
type FlowRunCommand =
  | { mode: 'node' | 'downstream' | 'upstream'; targetNodeId: string }
  | { mode: 'selection'; selectedNodeIds: readonly string[] }
  | { mode: 'all' }
```

The API request also carries `flowId`, `expectedFlowRevision`, optional
`expectedPlanHash`, and the required `Idempotency-Key` header.

### `node` - Run node

Execute only the target executable node.

- Direct Text and Asset sources resolve from the saved graph.
- A connected upstream executable node is not silently executed.
- If an explicit pinned result exists, use it.
- Otherwise, resolve the latest compatible successful result deterministically
  by `completedAt desc, id desc` and freeze the exact job/output IDs.
- If no compatible durable output exists, reject preflight with
  `missing_upstream_output` and suggest Run till here.

### `downstream` - Run from here

Execute the target and every reachable executable descendant.

- Executable ancestors before the target are not silently added.
- Their values resolve through the same pinned/latest-result rule as `node`.
- Missing external upstream values reject preflight.

### `upstream` - Run till here

Execute the target plus its complete required executable ancestor closure.
Static Text and Asset nodes participate as immutable sources without jobs.

### `selection` - Run selection

Execute selected executable nodes only. Required upstream executable values are
resolved from pinned/latest prior outputs; unselected executable ancestors are
not silently added to the run.

- Ignore selected edges for execution semantics.
- Reject an empty selection or one containing no executable node.
- Return selected count, planned count, and inclusion reasons.
- Missing prior upstream outputs reject preflight/admission instead of
  regenerating ancestors.
- The browser uses React Flow selection hooks for UX only. The API recomputes
  the selected executable set from the saved revision.

### `all` - Run all

Execute every executable node in the saved Flow, including all disconnected
branches. Text and Asset nodes remain static inputs.

### Deterministic ordering

The planner returns topological levels. Within a level, use stable persisted
node IDs as the tie-break. Source edges and selected input items preserve their
documented semantic order. Canvas coordinates never influence execution.

## 5. Two-Stage Planner

Do not combine graph algorithms, database resolution, and admission into one
file or function.

### Stage A - pure compile

Location: `@talelabs/flows`.

Inputs:

- upcast saved nodes and edges;
- run command;
- model capability registry;
- typed descriptors for available static sources and prior outputs.

Responsibilities:

- validate node schemas, handles, connections, settings, operation choice, and
  model constraints;
- detect executable cycles;
- select the exact subgraph for the command;
- derive deterministic topological levels and inclusion reasons;
- preserve inner typed collections;
- expand only explicit iterator/control semantics;
- calculate planned item, request, and output upper bounds;
- return stable validation codes with node/slot IDs;
- produce a serializable plan candidate without framework or IO dependencies.

### Stage B - server resolution and freeze

Location: API domain services and data functions.

Responsibilities:

- resolve exact direct Assets and prior job outputs under tenant scope;
- apply deterministic auto/manual item selection and provider payload order;
- lock exact static Asset rows in stable ID order;
- compose resolved prompts/instructions;
- pin the generation registry version/hash, model contract, operation, settings,
  normalized adapter route/version, and executor version;
- derive deterministic item keys and request shards known at admission;
- calculate canonical `planHash`, `requestHash`, and `snapshotHash`;
- persist the immutable run transactionally.

Preflight runs both stages without inserting. Admission runs both again and
requires the same saved Flow revision and, when supplied, the same `planHash`.
Preflight is advisory, never trusted input.

## 6. Canonical Hashing

Implement one shared versioned canonical serializer. It must:

- recursively sort object keys;
- omit non-contract `undefined` values consistently;
- preserve arrays whose order has domain meaning;
- normalize supported numeric values before serialization;
- reject unsupported values such as functions, symbols, non-finite numbers, and
  cyclic structures;
- encode the serializer version into every hash domain.

Use domain prefixes so identical JSON in different contexts cannot collide:

```txt
talelabs:run-request:v1
talelabs:run-plan:v1
talelabs:run-snapshot:v1
talelabs:mock-request:v1
```

Do not hash ad hoc `JSON.stringify()` output assembled from Maps or database row
order.

## 7. Immutable Snapshot Contract

The snapshot is bounded, versioned, insert-only JSONB. It freezes:

- snapshot and canonical-serializer versions;
- saved Flow ID and revision;
- requested command, target/selection, planned executable set, and inclusion reasons;
- normalized executable nodes and deterministic edge/source order;
- model IDs, contract versions/hashes, derived operations, and settings;
- topological levels and control-node/item-expansion rules;
- exact static Asset IDs and exact prior-run job/output IDs;
- considered candidates, exclusions, selected inputs, and payload order;
- resolved text/prompt/instructions where known at admission;
- planner version, adapter contract version, and executor deployment version;
- planned upper bounds for items, jobs, outputs, and snapshot bytes.

The snapshot never contains:

- signed URLs or raw R2 storage keys;
- credentials or native provider secrets;
- media bytes;
- React state, selection objects, or presentation-only labels;
- mutable Flow row references as execution truth.

Same-run generated Asset IDs cannot exist at admission. The snapshot freezes the
edge and item-binding rules; later item/job/source rows bind the exact outputs
under the same `flowRunId` without mutating the snapshot.

## 8. Forward-Only Persistence Migration

Never edit migration `004_talelabs_core.ts`. Add a new forward-only migration
that reconciles the implemented baseline with the M5 design.

### `flowRuns`

- add `upstream` and `selection` to the mode constraint;
- require `targetNodeId` for `node`, `downstream`, and `upstream`;
- add immutable `snapshotHash` and `executorVersion`;
- keep one parent `triggerRunId` for every mode;
- remove the old undispatched-index exclusion for `node`;
- keep organization-scoped API idempotency uniqueness;
- keep `creditCost` and provider-cost aggregation fields at zero/null in M5;
- add `retryOfRunId` as a nullable self-reference so a user retry remains a new
  immutable run with explicit ancestry;
- do not add `cancelRequestedAt`; `canceled` is the durable decision.

### `flowRunNodes`

- remove the singular `jobId` assumption;
- keep one node-level summary row per run and planned executable node;
- support `partial` in addition to pending/running/succeeded/failed/skipped/
  canceled;
- do not foreign-key `nodeId` to mutable Flow rows.

### `flowRunNodeItems`

Add the explicit work-item relation described in the DB design:

```txt
(flowRunId, nodeId, itemKey) unique logical item
sortOrder                       deterministic presentation order
dimensions                      explicit iterator dimensions
lineage                         exact predecessor item identities
status                          item-level progress/outcome
```

Materialize admission-known items transactionally. Create downstream dynamic
items just in time when same-run outputs exist; derive keys only from frozen
lineage and dimensions.

### `generationJobs`

- add `text` to media/output kind support;
- add `itemKey` and `requestIndex`;
- enforce one logical job per
  `(flowRunId, nodeId, itemKey, requestIndex)`;
- retain one domain idempotency key and one Trigger child run ID;
- preserve zero-valued mock cost fields and future provider submission fields;
- keep provider/model identity server-controlled.

### Text and media outputs

- add `generationJobTextOutputs(jobId, outputIndex, text)` with replay-safe
  uniqueness;
- keep image/video/audio outputs as canonical Assets through
  `(generationJobId, outputIndex)` uniqueness;
- add exact source/input rows for direct Assets, prior run outputs, and same-run
  item lineage where the current relations do not already express them.

### Database guards

- snapshot columns are not exposed through broad update helpers;
- add a database trigger/guard if generic row patches could mutate snapshot
  columns;
- every cross-table relationship includes organization-safe identity where the
  schema already follows that pattern;
- indexes support active-run counts, undispatched runs, Flow history, node
  history, item status aggregation, and output lookup.

## 9. Admission Transaction

The API follows this sequence:

```txt
lock-free idempotency replay lookup
-> begin READ COMMITTED transaction
-> organization advisory transaction lock as first statement
-> authoritative idempotency recheck
-> admission limits
-> load exact Flow revision and graph
-> pure compile
-> tenant-scoped static/prior-output resolution
-> lock selected Asset rows in stable ID order
-> final Flow revision re-read
-> canonicalize/hash
-> insert run + nodes + known items + ready initial jobs + provenance
-> commit
-> best-effort Trigger parent dispatch
-> return 202 persisted run even when dispatch needs reconciliation
```

Use `READ COMMITTED`: after waiting for the organization advisory lock, later
statements see current committed data. Coherence comes from explicit Flow
revision validation before and immediately before insertion.

The dashboard must make `saveNow()` expose the committed revision, not only a
boolean. A command captures that revision and sends it to preflight/admission.
If autosave cannot produce a clean saved revision, do not run.

## 10. Dispatch And Recovery

The committed pending run is the durable dispatch outbox; a separate outbox
table is unnecessary for M5.

### Immediate dispatch

- dispatch after commit with payload `{ flowRunId, organizationId }`;
- use an explicit global Trigger idempotency key derived from `flowRunId`;
- dispatch the run's recorded compatible Trigger deployment version;
- record the returned Trigger run ID using a guarded compare-and-set.

### Parent startup claim

The parent obtains its own Trigger run ID from Trigger context and attempts the
same guarded claim. This closes a crash after Trigger accepted the task but
before the API stored the handle.

- no existing claim: store this parent ID and continue;
- same claim: continue idempotently;
- different winning claim: exit without executing work.

This PostgreSQL claim is required because Trigger clears failed-run idempotency
keys. Trigger global idempotency is still used to suppress ordinary duplicate
submissions.

### Reconciliation

Add one Trigger scheduled reconciliation task:

- pending + no `triggerRunId`: dispatch with the same global key/version;
- domain-active + Trigger terminal: repair the domain state from persisted job
  rows and safe Trigger status;
- domain-canceled + Trigger active: reissue cancellation;
- stale running jobs: reconcile from their domain/output state;
- never start a second product run from mutable Flow data.

Do not hold a database transaction open across Trigger network calls. Do not
automatically create endless replacement parents after a terminal executor bug;
repair the run to failed and let the user create an explicit retry run.

## 11. Trigger.dev Task Topology

Use runtime-validated `schemaTask` payloads.

```txt
flow-run-orchestrator { organizationId, flowRunId }
  -> generation-job   { organizationId, generationJobId }
       -> asset-ingest { organizationId, assetId }  (media only)
```

The parent:

1. claims the run and verifies snapshot hash/version/executor compatibility;
2. atomically changes pending to running;
3. loads the immutable plan from PostgreSQL;
4. finds the next runnable topological level from domain rows;
5. creates missing dynamic items/jobs idempotently;
6. dispatches bounded child batches with `batchTriggerAndWait()`;
7. aggregates outcomes and skips only blocked descendants;
8. repeats until no runnable work remains;
9. performs one guarded terminal aggregation.

Child jobs use an explicit global key derived from:

```txt
flowRunId:nodeId:itemKey:requestIndex
```

Use queues by work family (`mock-text`, `mock-image`, `mock-video`,
`mock-audio`, and existing Asset ingestion) and a per-organization
`concurrencyKey`. Waiting parents release their queue/environment slot. Subtasks
do not inherit parent queues automatically, so declare queues explicitly.

Use awaited child APIs so child tasks remain version-locked to the parent.
Deploy the application and Trigger tasks atomically; persist that exact executor
version on admission and use it for reconciliation dispatch.

## 12. Runtime Values, Items, And Iteration

Preserve two different dimensions:

```txt
inner value = one Text, ImageSet, VideoSet, or AudioSet consumed together
outer item  = one explicit repeated execution with dimensions and lineage
```

A generation node returning four images creates one `ImageSet` runtime value
unless an Iterator/Map explicitly expands it. Do not infer fan-out from array
length or number of connected Assets.

M5 control nodes:

- Iterator/Map: one input collection to N outer items;
- Collect: compatible N outer items to one collection value;
- Zip: pair dimensions by deterministic index/key, rejecting incompatible
  cardinality unless the node contract defines a policy;
- Prompt Iterator: explicit prompt/text variants to N outer items.

The planner computes bounded structural upper limits. Admission materializes
known items. The parent materializes output-dependent items just in time after
upstream completion. Every resulting job and Asset points back to exact input
item keys.

## 13. Deterministic Mock Adapter

Create one normalized adapter interface shared by M5 and M6. Mock behavior is an
adapter implementation, not a browser shortcut.

### Fixture catalog

- seed one repository-owned/licensed valid image, short video, and audio file;
- store them privately under `system/mock-generation/v1/`;
- commit a manifest containing fixture ID, modality, MIME type, checksum,
  dimensions/duration, source/license, and catalog version;
- provide repeatable seed and integrity-verification scripts;
- never download stock media during a run.

### Deterministic result

Hash the normalized immutable request plus mock-adapter version and map it to a
compatible fixture. Equivalent requests choose equivalent fixture bytes and
metadata, while every output is copied to a unique generation output key.

Text output is deterministic useful placeholder content derived from the request
hash and prompt. It is stored as text, not an Asset.

Media output sequence:

```txt
select fixture
-> copy to unique job/output R2 key
-> insert canonical generation Asset in processing state
-> await the existing Asset ingestion task
-> require usable ready Asset
-> atomically complete output/job/item summaries
```

R2 copied objects are immediately readable after copy completion, but database
uniqueness and guarded completion still decide the domain winner. Retry must not
create duplicate Assets. Losing copied objects are cleaned only when no domain
row owns them.

Mock controls for retryable error, permanent error, partial output, timeout, and
cancellation are development/verifier-only configuration. They must not become
user-visible node settings.

## 14. State Machines

### Run

```txt
pending -> running -> succeeded | partial | failed | canceled
pending -> canceled
```

### Node/item/job

```txt
pending -> running -> succeeded | partial | failed | skipped | canceled
pending -> skipped | canceled
```

Use compare-and-set updates that name allowed previous states. Never apply a
blind status patch.

### Terminal aggregation

- `succeeded`: every planned executable item succeeded;
- `partial`: at least one item succeeded and at least one failed/skipped because
  of failure;
- `failed`: no executable item succeeded and at least one failed;
- `canceled`: cancellation won before normal terminal aggregation; already
  completed successful outputs remain honest and reusable;
- `skipped`: item/node only; a required predecessor failed or was canceled.

Infrastructure failure and provider/mock failure use stable error codes and safe
messages. Raw internal errors remain in server observability only.

## 15. Cancellation

`POST /runs/:id/cancel`:

1. tenant-scoped load and authorization;
2. atomically update a nonterminal run to `canceled` and mark still-pending
   items/nodes/jobs canceled;
3. commit the durable domain decision;
4. call `runs.cancel(triggerRunId)` outside the transaction;
5. reconciliation retries the Trigger cancellation when needed.

Trigger cancellation propagates to child runs, but every worker also checks the
domain run state before mock execution, R2 copy, Asset insertion, and terminal
commit. If completion changed the run first, cancel returns `invalid_state`. If
cancel changed it first, completion updates affect zero rows and any unowned
object is cleaned safely.

## 16. Retry And Rerun

Do not use Trigger replay as the user-facing retry contract.

- **Retry failed:** create a new run derived from the original immutable
  snapshot, limited to failed/skipped/canceled work and its required dependency
  closure. Freeze every reused successful output in the new snapshot, set
  `retryOfRunId`, select the current compatible executor, and preserve the
  original snapshot lineage.
- **Rerun current Flow:** perform ordinary preflight/admission from the current
  saved Flow revision with a new idempotency key.
- Never mutate a terminal run back to pending.
- Never silently switch a retry from the original snapshot to current canvas
  data.

If snapshot-limited partial retry cannot be implemented safely during M5, ship
snapshot-preserving whole-run retry first. Do not improvise mixed semantics.

## 17. Run API

Implement organization-scoped Hono/OpenAPI endpoints:

```txt
POST /flows/:id/run-plans
POST /runs
GET  /runs/:id
GET  /runs?flowId=&status=&limit=&cursor=
POST /runs/:id/cancel
POST /runs/:id/retry
GET  /flows/:id/nodes/:nodeId/results
POST /runs/:id/realtime-token
```

The detail response is render-complete but bounded: run summary, per-node/item/
job states, safe errors, text outputs, and canonical output Asset summaries.
List responses expose counts, not unbounded nested work.

Never expose storage keys, provider credentials, raw adapter payloads, internal
stack traces, or cross-organization existence. Regenerate the Kubb SDK; do not
maintain duplicate dashboard response types.

## 18. Dashboard Binding

Preserve every user-approved canvas control and visual primitive.

- node primary Run -> `node`;
- node dropdown -> `downstream` and `upstream`;
- main canvas action bar -> `all`;
- selected-node context menu -> `selection` when at least one selected node is
  executable.

Command capture:

```txt
saveNow and obtain committed revision
-> preflight
-> disclose expanded/multiplicative scope when needed
-> admit with revision + plan hash + idempotency key
-> render durable run state
```

Do not write run results into mutable node `data`. Query result/history by
`flowId` and `nodeId`, and derive canvas status overlays from the active run.

Add one root-level active-run observer so navigation does not stop updates.
Issue short-lived Trigger read tokens scoped to exact parent run IDs. Realtime
events invalidate organization-scoped TanStack Query keys; the UI refetches the
TaleLabs run API. Use bounded polling only while a run is active as fallback and
refresh expired tokens for long media jobs.

All new copy uses `@talelabs/i18n` across every supported locale. Reuse shared
toolbar, menu, status, preview, progress, and Asset primitives. Do not recreate
run controls per generation-node family.

## 19. Scalability And Safety Limits

Add one shared `FLOW_RUN_LIMITS` code-level policy beside graph limits. Suggested
initial guards, to validate during M5.1 before admission code ships:

```txt
planned executable nodes per run  256
topological depth                 256
outer items per node              100
jobs per run                     1000
outputs per run                  1000
snapshot bytes                 16 MiB
selection IDs                    2000 (never above FLOW_GRAPH_LIMITS.nodes)
```

The 1,000-job ceiling aligns with Trigger.dev's current maximum batch size, but
the parent should still dispatch smaller level/chunk batches. These are safety
limits, not promises to users, and belong in one shared configuration module.

Also implement:

- per-organization active-run and queued-exposure admission limits;
- per-organization Trigger `concurrencyKey` limits;
- bounded cursor pagination for history/detail collections;
- no N+1 run-detail queries;
- no transaction or PostgreSQL connection held while a Trigger waitpoint or
  network request is active;
- conservative PostgreSQL pool sizing for Trigger worker processes.

The current `@talelabs/db` pool uses the `pg` default. Trigger child tasks run in
separate processes, so unbounded fan-out can multiply connection pools. Add a
small code default plus deployment override for worker pool size, instantiate
one pool per worker process, and use the pooled Neon connection endpoint. Do not
create a pool per item/job function call.

## 20. Security And Tenant Isolation

- Every API query includes authenticated `organizationId` and membership.
- Every task payload includes both object ID and `organizationId`; every worker
  query verifies the pair.
- Every Asset/prior-output lookup is organization scoped before existence is
  disclosed.
- All generated media remains in the private bucket and is returned through
  authorized short-lived signed delivery.
- Realtime tokens are server-issued, short-lived, read-only, and scoped to exact
  Trigger run IDs.
- Provider route IDs, storage keys, and raw errors stay server-only.
- Rate/admission limits are shared/durable or enforced transactionally; never a
  process-local Map.
- Snapshot input is server-built. Never deserialize executable code or trust
  browser-supplied snapshot JSON.

## 21. Code Structure

Use cohesive modules rather than a run-engine monolith. Exact filenames may
follow existing naming, but responsibilities remain separate:

```txt
packages/flows/src/runtime/
  run-command.ts
  graph-selection.ts
  topological-plan.ts
  runtime-values.ts
  item-expansion.ts
  run-limits.ts
  canonical-json.ts
  snapshot-contract.ts
  planner.ts

apps/api/src/domain/runs/
  preflight.service.ts
  admission.service.ts
  prior-output-resolution.service.ts
  cancellation.service.ts
  retry.service.ts
  reconciliation.service.ts

apps/api/src/data/
  flow-runs.data.ts
  flow-run-items.data.ts
  generation-jobs.data.ts
  generation-outputs.data.ts

apps/api/src/routes/runs/
  runs.schemas.ts
  runs.routes.ts

packages/trigger/src/tasks/flow-runs/
  contracts.ts
  orchestrator.ts
  generation-job.ts
  reconciliation.ts
  state-aggregation.ts

packages/trigger/src/adapters/
  generation-adapter.ts
  deterministic-mock-adapter.ts
  mock-fixture-catalog.ts

apps/dashboard/src/features/flow-runs/
  flow-run.queries.ts
  flow-run-query-keys.ts
  active-run-observer.tsx
  run-command-controller.ts
  run-status-overlay.tsx
  run-history.tsx
```

Share the model registry, graph registry, canonical serializer, state helpers,
and UI primitives. Do not create one planner, settings renderer, status model, or
run controller per generation-node family.

## 22. Ordered Implementation Checkpoints

### M5.1 - Persistence and pure planner

Deliver:

- forward-only migration and updated Kysely types;
- canonical serializer/hashes;
- command selection and deterministic topological planner;
- runtime value/item/lineage types;
- shared safety limits;
- pure scenarios covering all five commands and explicit iteration.

Gate:

- fresh migration and upgrade-from-current both succeed;
- same input produces the same plan/hash;
- disconnected `all`, selected-only selection, cycles, missing prior
  outputs, and safety-limit failures are deterministic.

### M5.2 - Preflight and immutable admission

Deliver:

- preflight endpoint;
- tenant-safe static/prior-output resolution;
- exact Asset locking and Flow revision revalidation;
- idempotent transactional admission;
- run/detail/list query foundation;
- API SDK regeneration.

Gate:

- revision and plan races never insert a mixed run;
- same key/body replays and same key/different body conflicts;
- cross-tenant IDs never disclose or execute;
- snapshot is immutable and contains no forbidden data.

### M5.3 - Trigger orchestration and recovery

Deliver:

- parent and child `schemaTask`s;
- version-pinned two-writer dispatch claim;
- bounded queues/batches and per-org concurrency;
- just-in-time downstream items/jobs;
- scheduled reconciliation;
- guarded state aggregation and database pool safeguards.

Gate:

- API/Trigger crash windows reconcile;
- parent/child retries do not duplicate jobs;
- independent branches run concurrently within bounds;
- failed inputs skip only dependent lineage.

### M5.4 - Deterministic outputs and canonical Assets

Deliver:

- fixture manifest and seed/verify scripts;
- normalized adapter boundary;
- deterministic text/image/video/audio mocks;
- R2 copy to unique output keys;
- canonical Asset ingestion and text outputs;
- exact output/input lineage and zero cost recording.

Gate:

- runtime performs no provider call or stock download;
- every media output becomes one ready reusable Asset;
- retries and completion races do not duplicate Asset rows;
- text remains durable without becoming a fake file.

### M5.5 - Cancellation, retry, API completion, and realtime

Deliver:

- guarded cancel behavior and reconciliation;
- snapshot-preserving new-run retry;
- complete bounded run detail/history APIs;
- exact-run realtime token endpoint;
- safe errors and terminal aggregation.

Gate:

- completion-versus-cancel has one winner;
- cancellation propagates and is repaired after transient failures;
- retry never mutates or silently changes the original run;
- API state remains sufficient without Trigger dashboard access.

### M5.6 - Dashboard binding

Deliver:

- replace browser-only Run actions with durable commands;
- Run all and Run selection bindings;
- plan disclosure when scope expands;
- durable overlays, progress, outputs, history, cancel, and rerun;
- root active-run observer, Realtime invalidation, and polling fallback;
- complete i18n.

Gate:

- navigation does not stop an active run or lose progress;
- refresh reconstructs state from the API;
- node data remains creative configuration only;
- approved node/toolbars remain visually consistent.

### M5.7 - Engineering verification and user QA handoff

Add repeatable verifier scripts for:

```txt
all five command closures
deterministic plan/snapshot hashing
revision and idempotency races
tenant isolation
dispatch crash recovery
bounded iteration and multiple outputs
partial failure and skipped descendants
cancellation/completion races
snapshot-preserving retry
canonical output deduplication
zero provider calls and zero mock cost
```

Run repository gates:

```txt
npm run sdk:generate
npm run check-types
npm run i18n:check
npm run lint
generation registry/drift validation
npm run build
npm run trigger:deploy:check
git diff --check
generated-file and .gen-* audit
```

Automated tests are not an MVP acceptance requirement. Focused pure scenarios
and repeatable smoke/verifier scripts are still required where they protect
determinism, tenancy, idempotency, and races. Browser/UI/E2E product approval
belongs to the user.

## 23. M5 Exit Criteria

M5 is engineering-complete only when:

1. All five approved commands execute through one server-owned durable path.
2. Editing or navigating away cannot alter or stop an admitted run.
3. PostgreSQL reconstructs complete state after refresh or Trigger reconnect.
4. Mock image/video/audio outputs become canonical reusable Assets.
5. LLM output is durable text with exact lineage.
6. Iteration and multiple outputs are explicit, bounded, and visible.
7. Cancellation, partial failure, retry, and dispatch recovery are honest.
8. No provider request, credential read, or non-zero mock cost occurs.
9. Elements are absent from the active execution path.
10. The user completes run UX/E2E QA and explicitly approves M6.

## 24. Research References

Primary implementation evidence:

- [React Flow component API](https://reactflow.dev/api-reference/react-flow)
- [React Flow selection hook](https://reactflow.dev/api-reference/hooks/use-on-selection-change)
- [Trigger.dev idempotency](https://trigger.dev/docs/idempotency)
- [Trigger.dev triggering and batch waits](https://trigger.dev/docs/triggering)
- [Trigger.dev queues and concurrency](https://trigger.dev/docs/queue-concurrency)
- [Trigger.dev task versioning](https://trigger.dev/docs/versioning)
- [Trigger.dev atomic deployments](https://trigger.dev/docs/deployment/atomic-deployment)
- [Trigger.dev runs and cancellation](https://trigger.dev/docs/runs)
- [Trigger.dev Realtime authentication](https://trigger.dev/docs/realtime/auth)
- [Trigger.dev platform limits](https://trigger.dev/docs/limits)
- [Cloudflare R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/)
- [Cloudflare R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL `SET TRANSACTION`](https://www.postgresql.org/docs/current/sql-set-transaction.html)
- [PostgreSQL `SELECT` locking](https://www.postgresql.org/docs/current/sql-select.html)
- [n8n item linking](https://docs.n8n.io/data/data-mapping/data-item-linking/item-linking-node-building/)
