# TaleLabs Browser Execution Runtime - Execution Plan

Status: Implemented behind a code-owned flag; engineering verification is
complete, while browser interaction, visual QA, and final product approval
remain user-owned.

This plan adds browser-local BYOK execution as a second driver for the existing
TaleLabs run engine. Browser and managed execution must use the same saved Flow,
planner, immutable snapshot, run tables, job contracts, canonical Assets, and
canvas output projection.

The central design is:

```txt
saved Flow
-> server admission and canonical planning
-> immutable run snapshot and persisted jobs
-> selected execution driver
   -> managed: Trigger.dev
   -> browser: browser scheduler plus local provider credential
-> canonical output Assets
-> persisted canvas outputs
```

The browser is not a second workflow product. It is a less durable execution
driver for the same admitted plan.

## Product Outcome

Users can choose **Browser mode** under **Providers -> Secure Store** and run a
Flow with the provider key stored in that browser. TaleLabs and Trigger.dev do
not receive the plaintext key.

Browser mode must support the same approved commands as managed execution:

```txt
Run node
Run from here
Run till here
Run selection
Run all
```

The command selects the same subgraph in both runtimes. Only the component that
performs provider requests changes.

Browser mode is intentionally less durable:

- route navigation inside TaleLabs must not stop a run;
- reload recovery is supported when enough non-secret provider state was saved;
- another tab may safely take over an expired execution lease;
- a frozen, discarded, closed, or sleeping browser may interrupt progress;
- managed execution remains the durable option for work that must continue
  independently of the user's browser.

Never silently switch a browser run to managed execution or use a TaleLabs
credential when a local key is missing. Runtime selection changes the security,
durability, and cost boundary and must remain explicit.

## Non-Negotiable Approval Gate

This feature is not approved because one node can call one provider. It is
approved only after every existing run command works through both execution
drivers in `debug` mode.

Required matrix:

| Execution runtime | `node`   | `downstream` | `upstream` | `selection` | `all`    |
| ----------------- | -------- | ------------ | ---------- | ----------- | -------- |
| `managed + debug` | Required | Required     | Required   | Required    | Required |
| `browser + debug` | Required | Required     | Required   | Required    | Required |

All ten cells must prove:

1. The same saved Flow revision is admitted.
2. The same canonical planner selects the command scope.
3. The immutable snapshot and plan hashes are valid.
4. The expected executable nodes, items, jobs, prerequisites, and disconnected
   branches are persisted.
5. Jobs execute only after their prerequisites are satisfied.
6. Multiple outputs retain item, output-index, and lineage ordering.
7. Terminal node and run aggregation is correct, including `partial`.
8. Debug media outputs become canonical Assets through the real ingestion path.
9. Refresh restores completed outputs on the canvas.
10. Retry and cancellation do not duplicate provider work or canonical Assets.

`Run selection` keeps the user-approved selected-only contract: execute selected
executable nodes and reuse compatible prior upstream outputs. It must not
silently regenerate unselected ancestors.

Engineering must provide a repeatable debug-mode verification command for the
matrix. Browser interaction and visual QA remain user-owned. An AI session may
report the implementation as engineering-complete, but must not call the
feature approved until the user validates the browser and managed command
matrix from the product UI.

No paid provider request is required for this gate.

## Naming: Two Independent Dimensions

Real versus deterministic behavior remains:

```ts
type ExecutionMode = "live" | "debug";
```

The execution driver is a separate dimension:

```ts
type ExecutionRuntime = "browser" | "managed";
```

Examples:

```txt
managed + live   = Trigger.dev with a TaleLabs platform credential
managed + debug  = Trigger.dev with the deterministic mock adapter
browser + live   = local provider request with the browser-owned key
browser + debug  = browser scheduler with deterministic browser fixtures
```

Do not overload `executionMode`, infer runtime from `triggerRunId`, or encode
runtime choice in model IDs.

## Research Conclusions

The architecture follows these verified platform properties.

### React Flow and Zustand

React Flow documents Zustand as an appropriate state-management option for
controlled, growing Flow editors. It also recommends narrow selectors and
memoized callbacks to avoid rerendering components on unrelated node changes.
TaleLabs already follows this model for canvas editing.

Browser run execution must not be added to the canvas Zustand store. Canvas
state is editor state; durable run state belongs to PostgreSQL and TanStack
Query. The browser executor mounts outside the editor so navigation does not
destroy it.

### A browser queue controls concurrency, not durability

`p-queue` is a lightweight Promise scheduler with concurrency, backpressure,
AbortSignal, and rate-limit support. It is suitable for limiting local provider
requests. Its own documentation distinguishes this from a durable server queue.

Therefore:

- `p-queue` may bound active browser jobs;
- it must not select the Flow subgraph;
- it must not own canonical job state;
- it must not contain every job in a large run at once;
- it must be reconstructable from the API and local journal;
- losing the in-memory queue must not lose the admitted run.

### Browser lifecycle is not a background worker guarantee

Browsers may freeze a hidden tab, suspending timers and fetch callbacks, and may
discard it without firing a final event. `beforeunload` and `unload` are not
reliable recovery boundaries. Browser mode must checkpoint as state changes and
when the document becomes hidden, then recover from server state on startup.

This is why local execution cannot claim managed durability even when
IndexedDB, Web Locks, and a queue are used.

### IndexedDB is a recovery journal, not the source of truth

IndexedDB supports persistent structured browser data, but active transactions
can be aborted during browser shutdown and best-effort storage can be evicted.
`navigator.storage.persist()` may improve retention but can be denied.

Store only minimal non-secret recovery checkpoints. PostgreSQL remains
authoritative.

### Cross-tab coordination requires two layers

Web Locks coordinate same-origin tabs and release when the lock callback ends.
They do not protect against another browser profile, device, or stale server
state. BroadcastChannel transports same-origin hints but defines no application
protocol and provides no persistence.

Use:

```txt
Web Lock          -> local leader election
PostgreSQL lease  -> authoritative run/job ownership
BroadcastChannel  -> query invalidation and takeover hints only
```

### Trigger.dev remains the managed driver

Trigger.dev queues, concurrency keys, retries, cancellation, and idempotency
continue to provide managed durability. Browser parity means command and output
semantics match; it does not mean replacing those managed guarantees with web
APIs.

## Architectural Invariants

### One planner and one immutable run model

Do not create a browser planner, browser graph traversal implementation,
`localRuns` table, browser-only job schema, or browser-specific output format.

Both runtimes share:

- server authorization and tenant isolation;
- Flow revision validation and autosave flush;
- graph validation and command-scope selection;
- immutable snapshots, plan hashes, and executor compatibility checks;
- persisted run nodes, items, jobs, sources, inputs, and outputs;
- exact captured provider bindings and operation contracts;
- job prerequisite and topological-level semantics;
- canonical Asset ingestion and provenance;
- node/run aggregation, retry, cancellation, and error vocabulary;
- run detail queries and canvas output hydration.

The browser receives an already admitted execution manifest. It never decides
what the command means.

### One direct progression model

The same provider-neutral progression rules must answer:

```txt
Which persisted jobs are ready?
Which required inputs are now resolvable?
Which transitions are legal?
When is a node partial, failed, canceled, or succeeded?
When is the run terminal?
```

Pure transition/readiness logic belongs in `@talelabs/flows`. PostgreSQL row
locking, job claims, Asset resolution, and aggregation remain server-owned.
Trigger.dev and the browser driver consume these contracts rather than
reimplementing them.

### Server validates every browser transition

Browser code is untrusted. Before returning a job manifest, the API atomically:

1. validates organization, user, run, execution runtime, and lease;
2. confirms the job belongs to the immutable snapshot;
3. confirms prerequisites and reusable upstream outputs;
4. claims the job with compare-and-set semantics;
5. resolves current short-lived Asset access without persisting signed URLs;
6. returns only the sanitized executable job contract.

Completion, failure, cancellation, retry, and output finalization receive the
same tenant-scoped and state-guarded treatment.

### Debug and live use the same driver boundary

Browser debug mode must exercise admission, claims, scheduling, prerequisites,
output transfer, canonical ingestion, aggregation, and canvas hydration. It may
replace only the external provider operation.

Use versioned non-secret fixtures:

```txt
text   -> deterministic text from request hash
image  -> versioned public image fixture
audio  -> versioned public audio fixture
video  -> versioned public short-video fixture
```

Each debug output is copied or uploaded to a unique generated-output object and
passes through the real canonical Asset pipeline. Do not return fake data only
to React state.

## State Ownership

| State                                              | Owner                                | Rule                                                            |
| -------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| Nodes, edges, selection, viewport, editor history  | Canvas Zustand store                 | Transient controlled React Flow state only.                     |
| Saved Flow graph and revision                      | PostgreSQL through Flow API          | Authoritative creative document.                                |
| Run snapshot, jobs, prerequisites, outputs, status | PostgreSQL                           | Authoritative execution state.                                  |
| Server state in React                              | TanStack Query                       | Queries and invalidation; do not copy into Zustand.             |
| Provider credential                                | Existing encrypted Secure Store      | Never enter Zustand, query cache, journal, or API traffic.      |
| Runtime preference                                 | User-scoped `localStorage` initially | Non-sensitive device preference; future billing may replace it. |
| Tab identity                                       | `sessionStorage`                     | Random non-secret identifier.                                   |
| Active local scheduling                            | One small `p-queue`                  | Disposable and bounded.                                         |
| Browser recovery checkpoint                        | IndexedDB journal                    | Non-secret recovery cache only.                                 |
| Local leader                                       | Web Locks                            | Same-origin coordination only.                                  |
| Authoritative executor ownership                   | PostgreSQL lease                     | Prevents duplicate execution across tabs/sessions.              |
| Cross-tab notifications                            | BroadcastChannel                     | Invalidation hints only.                                        |

The canvas may project outputs from run queries. It must not own leases,
provider job IDs, credentials, queue truth, or durable statuses.

## Browser Scheduling Model

### Queue unit

The queue unit is one persisted generation job, not one node and not one entire
run. A node may create several jobs because of output count or runtime-item
multiplicity.

Use one layout-scoped queue for the current user and organization. Start with a
code-owned concurrency of `2`. Do not add an environment variable.

### Bounded fill, not eager enqueue

Do not enqueue thousands of functions when a large run is admitted. The
scheduler keeps a small fill window, for example no more than twice current
concurrency, and asks the API for claimable jobs only when capacity is
available. Use `p-queue` backpressure rather than an unbounded array.

When several browser runs are active, fill capacity round-robin by run so one
large `Run all` does not starve a newer `Run node`.

### Dependency progression

The admitted snapshot contains selected nodes, jobs, prerequisites, levels,
and lineage. The browser scheduler may use shared pure readiness helpers for
presentation and wake-up decisions, but the API performs the authoritative
claim check.

Lifecycle:

```txt
admit run
-> acquire run lease
-> request claimable jobs up to available capacity
-> API claims and returns exact job manifests
-> p-queue executes claimed jobs
-> checkpoint provider lifecycle
-> finalize output or failure
-> API aggregates and releases newly ready jobs
-> refill queue
-> repeat until terminal
```

Disconnected branches in `Run all` become ready independently. Downstream jobs
wait for required upstream terminal outputs. `Run selection` uses the prior
output references captured by admission and does not schedule unselected
ancestors.

### Retry and throttling

Reuse normalized retry classifications and `Retry-After` handling. Do not keep
a sleeping retry inside an active queue slot. Persist the next eligible time,
release the slot, and refill when eligible.

Provider/account policy may lower concurrency or interval capacity. These are
typed code/catalog decisions, not new environment variables.

### Cancellation

- queued unclaimed jobs are canceled server-side;
- claimed but not submitted jobs abort through `AbortSignal`;
- submitted asynchronous jobs call provider cancel when supported;
- unsupported provider cancellation records `cancelRequested` and ignores or
  safely cleans late outputs according to shared transition rules;
- the queue and journal are never the only place cancellation is recorded.

## Package and Folder Organization

Create files only when their phase is implemented. Do not scaffold empty
modules. Names below express ownership; adjust exact filenames to existing
feature conventions without flattening everything into one directory.

### `@talelabs/flows`: pure execution contracts

```txt
packages/flows/src/runtime/execution/
  contracts.ts
  browser-manifest.ts
  job-readiness.ts
  job-transitions.ts
  retry-policy.ts
```

Responsibilities:

- runtime-neutral types and strict manifest schemas;
- pure job readiness and legal transition decisions;
- retry eligibility/backoff calculations;
- no React, browser APIs, provider clients, PostgreSQL, R2, or Trigger.dev.

Do not duplicate the existing planner or snapshot reader here. Reuse them.

### `@talelabs/providers/browser`: credential-bearing provider calls

```txt
packages/providers/src/browser/execution/
  contracts.ts
  eligibility.ts
  registry.ts
  lifecycle.ts
```

Responsibilities:

- resolve a captured binding to an existing browser-safe protocol adapter;
- receive a credential through injection immediately before the request;
- execute immediate or submit/poll/cancel lifecycles;
- return normalized provider results and safe errors.

Do not add model-specific adapters when models share a protocol. Do not import
Node built-ins, environment variables, managed credentials, accounting,
webhook verification, Trigger.dev, or database code.

### API: admission, claims, and authoritative transitions

```txt
apps/api/src/domain/runs/browser/
  browser-run-manifest.service.ts
  browser-run-lease.service.ts
  browser-job-claim.service.ts
  browser-job-transition.service.ts
  browser-output.service.ts

apps/api/src/data/runs/browser/
  browser-run-lease.data.ts
  browser-job-claim.data.ts
  browser-job-transition.data.ts

apps/api/src/routes/runs/
  browser-runs.routes.ts
  browser-runs.schemas.ts
```

Keep routes limited to HTTP validation/translation, domain modules focused on
one use case, and data modules limited to SQL. Reuse existing admission,
snapshot, run aggregation, retry, output ingestion, and generated-folder policy.

### Dashboard: one cohesive browser-run feature

```txt
apps/dashboard/src/features/flows/runs/browser/
  controller/
    browser-run-root.tsx
    browser-run-controller.ts
  scheduling/
    browser-run-queue.ts
    browser-run-scheduler.ts
  execution/
    browser-job-runner.ts
    browser-output-transfer.ts
  recovery/
    browser-run-journal.ts
    browser-run-recovery.ts
    browser-run-coordination.ts
  data/
    browser-run.queries.ts
  contracts.ts
```

Mount `browser-run-root.tsx` under the authenticated dashboard layout so route
navigation does not stop execution. Do not put the executor in `flow-canvas.tsx`
or the canvas Zustand store.

Provider key management remains under the existing Settings/Secure Store
feature. Do not create another credential screen.

## Organization and Readability Principles

The implementation is rejected if it works only by concentrating the whole
runtime in one controller or by scattering duplicate rules across packages.

1. **One direct trace.** A developer must be able to follow admission -> claim
   -> provider call -> output finalization -> aggregation without discovering a
   second planner or hidden registry.
2. **One owner per fact.** Command selection belongs to the canonical planner;
   capabilities and browser eligibility belong to the models catalog; provider
   translation belongs to `@talelabs/providers`; durable state belongs to the
   API/database; local scheduling belongs to the browser feature.
3. **Group by responsibility.** Use the domain folders above. Do not add another
   large set of flat `use-flow-*` files or catch-all `helpers.ts`, `utils.ts`,
   `manager.ts`, or `engine.ts` modules.
4. **Compose small explicit operations.** Prefer named admission, claim,
   execute, checkpoint, finalize, and refill operations over a universal
   executor configured by many callbacks.
5. **Share stable policy, not effects.** Readiness, transitions, validation,
   and retry policy may be shared. Browser fetch, Web Locks, IndexedDB,
   Trigger.dev, SQL, and R2 remain runtime-specific effects.
6. **No mechanical fragmentation.** The 600-line source limit is hard. Function
   count is a diagnostic, not a reason to create thin wrappers. Keep cohesive
   related functions together and split mixed responsibilities.
7. **Narrow exports.** Avoid broad barrels and internal exports. Each directory
   exposes only the contract required by its consumer.
8. **Useful TSDoc.** Document module ownership, exported contracts, invariants,
   lifecycle, units, and security boundaries. Do not narrate routine function
   bodies.
9. **No parallel state.** Do not mirror TanStack Query run data in Zustand,
   mirror the queue in React state, or persist graph/output truth in IndexedDB.
10. **No speculative framework.** Do not add a universal workflow framework,
    service worker, Web Worker framework, XState, Dexie, Redux, or browser
    provider gateway unless measured product needs require it.

Before creating a component, hook, query key, validation helper, or status
presentation, search the existing Flow run implementation and reuse its owner.

## Dependencies

Install in the dashboard workspace when implementation starts:

```bash
npm install idb p-queue -w dashboard
```

- `idb` keeps the small recovery journal readable.
- `p-queue` limits active Promise work and supports backpressure/AbortSignal.

Reuse:

```txt
zustand                 canvas editor state only
@tanstack/react-query   authoritative server-state projection
@xyflow/react           canvas UI and command selection
@talelabs/flows         planner, snapshots, readiness, transitions
@talelabs/providers     browser-safe provider protocols and Secure Store
@talelabs/sdk           generated TaleLabs API client
zod                     strict manifest/journal parsing
```

Do not add a Redis-style browser queue, service-worker queue, or second state
library.

## Persistence

### `flowRuns`

Add or reuse:

```txt
executionRuntime text not null default 'managed'
check executionRuntime in ('managed', 'browser')
```

Capture it in the immutable snapshot envelope and expose it in run responses.
Existing rows remain `managed`. Never infer it from credential availability or
`triggerRunId`.

For browser runs:

- every approved run command is valid;
- debug mode is valid without a provider credential;
- live mode requires every captured executable binding to be browser eligible
  and its credential available locally;
- no Trigger task is dispatched.

### Browser execution leases

Use one tenant-scoped lease table or an equivalent explicit existing run lease:

```txt
flowRunBrowserLeases
  organizationId
  flowRunId
  userId
  executorId
  fenceToken
  expiresAt
  heartbeatAt
  createdAt
  updatedAt
```

Invariants:

- one active executor lease per browser run;
- run and lease organization must match;
- acquisition, renewal, release, and expired takeover use guarded SQL;
- database time determines expiry;
- every expired takeover increments a monotonic fence token;
- acquisition, release, and fenced mutations serialize on one transaction-scoped
  PostgreSQL advisory lock keyed by organization and run, so canonical
  finalization can safely use its existing database transactions without a
  cross-connection row-lock cycle;
- normal release expires the retained lease row instead of deleting it, which
  preserves the monotonic fence generation until terminal aggregation retires
  the lease;
- every claim, checkpoint, output, failure, completion, and cancellation
  acknowledgement must match the current executor and fence while the lease
  row is locked;
- terminal runs retire the lease;
- `executorId` is a random tab-session ID, never a credential;
- claiming an individual job also uses state-guarded persistence so a stale
  lease holder cannot submit it.

Provider submission has a separate durable one-shot boundary. The API records
`submitting` immediately before the browser calls the provider. If ownership is
lost before a resumable provider job ID is checkpointed, takeover marks the job
`provider_submission_uncertain` and never resubmits it. Only an explicit
provider response proving that no work was accepted may reset the boundary for
a safe retry.

Run cancellation serializes on the same advisory fence. If an asynchronous
submission returns its provider job ID after cancellation wins, the fenced
checkpoint may record that ID without reopening the canceled job so recovery
can still attempt and durably acknowledge provider cancellation.

### Browser recovery journal

Use a separate IndexedDB database:

```txt
talelabs-browser-execution-v1
  runCheckpoints
```

Record only:

```ts
interface BrowserJobCheckpoint {
  flowRunId: string;
  generationJobId: string;
  organizationId: string;
  userId: string;
  state:
    | "claimed"
    | "submitting"
    | "providerProcessing"
    | "downloading"
    | "uploading"
    | "finalizing"
    | "interrupted";
  providerJobId?: string;
  nextEligibleAt?: string;
  updatedAt: string;
}
```

Never store credentials, authorization headers, signed URLs, prompts, full
provider payloads, generated media, or output bytes. Keep each journal mutation
atomic and schema-validated.

## Models Catalog Contract

Browser eligibility belongs to each private execution binding, not the public
model and not a dashboard allowlist:

```json
{
  "executionRuntimes": ["managed", "browser"]
}
```

Rules:

1. `managed` remains the default current capability.
2. Add `browser` only after verifying the exact endpoint's CORS, authentication,
   request body, media input delivery, polling, cancellation, output delivery,
   and browser-safe imports.
3. Browser eligibility is operation/binding-specific, not inferred from a model
   being present in the catalog.
4. Admission captures the exact binding and runtime policy.
5. Catalog validation rejects a browser binding that resolves only through a
   server adapter.
6. The dashboard consumes the sanitized catalog projection and keeps no second
   runtime matrix.
7. `debug` uses an explicit deterministic binding and does not need a key.

OpenRouter documents bearer-token authentication and CORS-related request
errors. Do not assume that this makes every provider endpoint or output URL
browser compatible; verify each enabled binding.

## API Contract

### Admission

Extend the existing request without adding another planning endpoint:

```json
{
  "executionRuntime": "browser",
  "executionMode": "debug",
  "mode": "all",
  "expectedFlowRevision": 42
}
```

Existing command-specific fields remain:

```txt
node/downstream/upstream -> targetNodeId
selection               -> selectedNodeIds
all                     -> no node IDs
```

The API performs the same autosave/revision check, authorization, validation,
planning, snapshot capture, Asset locking, and persistence as managed
admission. For browser runtime it persists the admitted run without dispatching
Trigger.dev.

Stable failures include:

```txt
browser_runtime_binding_unsupported
browser_runtime_credential_required
browser_runtime_lease_conflict
browser_runtime_interrupted
browser_runtime_job_not_ready
browser_runtime_recovery_unavailable
```

Remove the old `browser_runtime_node_only` and
`browser_runtime_multiple_jobs_unsupported` concepts.

### Browser endpoints

Prefer explicit use-case endpoints:

```txt
PUT    /runs/:runId/browser-lease
DELETE /runs/:runId/browser-lease
GET    /runs/:runId/browser-manifest
POST   /runs/:runId/browser-jobs/claim
POST   /runs/:runId/browser-jobs/:jobId/begin-submission
POST   /runs/:runId/browser-jobs/:jobId/checkpoint
POST   /runs/:runId/browser-jobs/:jobId/output-grant
POST   /runs/:runId/browser-jobs/:jobId/finalize-media
POST   /runs/:runId/browser-jobs/:jobId/finalize-text
POST   /runs/:runId/browser-jobs/:jobId/complete
POST   /runs/:runId/browser-jobs/:jobId/fail
POST   /runs/:runId/browser-jobs/:jobId/cancel-ack
PUT    /runs/:runId/browser-executor-status
```

`claim-jobs` accepts a bounded requested capacity and returns only atomically
claimed jobs that are ready. It must not return every pending job or trust the
browser's readiness claim.

Every endpoint:

- authenticates and authorizes organization membership;
- matches run, job, user, organization, runtime, snapshot, and active lease;
- uses fenced compare-and-set transitions and replay-safe results;
- accepts bounded normalized metadata only;
- is idempotent under replay;
- never returns credentials or managed route secrets.

The browser manifest contains topology/progress data needed to schedule the
admitted plan. The claimed-job response contains the exact normalized request,
sanitized captured binding, expected output contract, and short-lived input
descriptors required for that job.

## Execution Lifecycle

1. Flush Flow autosave and admit the chosen command with the selected runtime.
2. Seed the shared run query cache from the admission response.
3. The layout-scoped browser root discovers the active browser run.
4. Acquire the organization/user Web Lock and the run's server lease.
5. Load and strictly parse the admitted browser manifest.
6. Fill available queue capacity with atomically claimed ready jobs.
7. In live mode, resolve the plaintext key only inside the job runner.
8. In debug mode, execute the deterministic browser fixture adapter.
9. Persist normalized provider checkpoints without secret material.
10. Validate and upload outputs through scoped server-owned grants.
11. Finalize through existing text/media and canonical Asset paths.
12. API aggregates the job, node, and run and exposes newly ready work.
13. Refill until the run is terminal.
14. Invalidate run/Asset queries and remove confirmed terminal journal rows.

## Output Transfer

Text finalizes through the existing text output contract.

Image, video, and audio:

- validate count, MIME, size, delivery form, and output indexes;
- request a grant scoped to run, job, output index, public generated-output
  bucket policy, media type, and server-owned key;
- stream when supported;
- use a bounded Blob fallback only within code-owned memory limits;
- never persist media or signed URLs in IndexedDB;
- finalize only after object existence is verified;
- pass output through the existing canonical Asset ingestion, metadata,
  thumbnails, provenance, and managed Flow folder policy.

Do not enqueue another job while an output transfer would exceed the browser's
bounded memory/concurrency policy.

## Navigation, Reload, and Multi-Tab Recovery

Mount the executor at authenticated dashboard layout scope. Navigating between
Flows, Assets, and Settings must not stop active work.

On startup or resume:

1. list active browser runs for current user and organization;
2. read and validate matching local checkpoints;
3. acquire Web Lock and server lease;
4. reconcile each claimed/provider job with authoritative API state;
5. resume poll, output transfer, finalization, or refill when safe;
6. mark an honest `credential_required` or `interrupted` state when recovery is
   impossible.

On `visibilitychange` to hidden, persist the latest non-secret checkpoint
immediately. Do not depend on `unload` or `beforeunload` for correctness.

Web Locks elect one local leader. PostgreSQL prevents split-brain execution.
BroadcastChannel sends only `runChanged` and `leaseReleased` hints; receivers
refetch with TanStack Query.

## UX Contract

### Settings

Under **Providers -> Secure Store**:

- allow Browser and Managed runtime selection;
- explain that Browser mode uses keys stored only in this browser;
- disclose that the browser must remain able to run for reliable progress;
- show missing-key status for live browser execution;
- do not resolve plaintext credentials into component state;
- do not claim Trigger.dev-level durability.

The initial runtime preference is local device state for concept validation.
Billing/entitlement data may own this choice later.

### Canvas commands

Do not hide commands merely because Browser mode is selected. Preserve:

```txt
node toolbar menu       -> Run node, Run from here, Run till here
selection context menu  -> Run selection
main canvas action bar  -> Run all
```

Availability depends on the admitted command, debug/live mode, and binding
eligibility, not a browser-wide node-only rule. An unsupported live binding
fails before provider spend with localized, actionable copy. Never silently
switch execution runtime.

### Progress

Reuse existing run/node state and output UI. Add browser-specific detail only
when actionable:

```txt
waiting for this browser
waiting for dependencies
queued in browser
provider request submitted
provider is generating
downloading result
uploading result
finalizing Asset
browser interrupted
credential required
```

The canvas reads run queries, not IndexedDB or `p-queue` directly.

## Security Requirements

1. Admission and every TaleLabs API request contain no provider key.
2. Credential resolution occurs only inside the browser job runner.
3. A managed credential is never returned to browser code.
4. Manifests and journal records are strictly parsed as untrusted data.
5. All claims/transitions are tenant-scoped, lease-guarded, and idempotent.
6. Output grants are short-lived and scoped to exact run/job/output contracts.
7. Credentials, signed URLs, prompts, payloads, and output bytes never enter
   logs, analytics, traces, session replay, BroadcastChannel, query keys,
   Zustand, or the recovery journal.
8. Browser-reported costs are informational and untrusted for billing.
   Browser-reported provider cost and generation identifiers are stored only in
   explicitly unverified fields; they never settle costs or overwrite trusted
   managed-provider facts.
9. CSP and third-party script review are release blockers for the local-key
   security claim.
10. Logout/key removal stops local execution and releases ownership.
11. A local failure never falls back to TaleLabs credentials.
12. Live binding eligibility fails closed.

## Implementation Phases

### Phase 0 - Reconcile active contracts

Update active binding documents together so none retain the old browser
node-only boundary. Preserve the five approved command semantics.

Acceptance:

- runtime and execution mode are separate;
- both runtimes admit all five commands;
- browser durability is described honestly;
- managed Trigger behavior remains unchanged.

### Phase 1 - Shared contracts and catalog eligibility

1. Add `ExecutionRuntime` to shared contracts and snapshots.
2. Add strict browser run/job manifest schemas.
3. Add pure shared readiness, transition, and retry policy where existing code
   does not already own it.
4. Add browser eligibility to exact provider bindings.
5. Add deterministic browser debug bindings for text/image/audio/video.

Acceptance:

- no second planner or catalog exists;
- browser package gate rejects server imports;
- every browser-eligible binding resolves to a compatible browser adapter;
- debug mode requires no credential or paid request.

### Phase 2 - Persistence, leases, and browser admission

1. Add `executionRuntime` persistence and snapshot capture.
2. Add tenant-scoped browser run leases.
3. Extend existing admission for all five browser commands.
4. Persist browser runs without Trigger dispatch.
5. Add claim/manifest/checkpoint/release contracts and generated SDK.

Acceptance:

- managed admission is unchanged;
- browser snapshots are identical in meaning to managed snapshots;
- concurrent browser admission/claim races cannot duplicate jobs;
- browser runs have no `triggerRunId`.

### Phase 3 - Browser scheduler and debug execution

1. Install `idb` and `p-queue`.
2. Mount the browser root at dashboard layout scope.
3. Implement bounded, fair queue filling and job claims.
4. Implement Web Lock plus server lease ownership.
5. Implement deterministic browser debug adapters.
6. Finalize debug outputs through the canonical Asset pipeline.

Acceptance:

- all five browser debug commands execute correctly;
- disconnected branches and prerequisites behave like managed execution;
- queue loss/reload reconstructs work from server/journal state;
- route navigation does not stop the queue;
- outputs survive refresh.

### Phase 4 - Dual-runtime debug parity gate

Run the complete ten-cell matrix from the non-negotiable approval gate. The
repeatable planner/snapshot verifier proves admission parity only; real driver,
canonical ingestion, cancellation, retry, and refresh behavior require the
separate runtime scenarios and product UI matrix.

Acceptance:

- every matrix cell passes;
- exact selected node/job sets match command semantics;
- output multiplicity and lineage match;
- retry, cancel, partial failure, and refresh hydration pass;
- no paid request occurs;
- user completes UI QA before approval.

### Phase 5 - Live browser providers

1. Wire the Secure Store credential resolver into browser lifecycle adapters.
2. Enable only verified browser-eligible bindings.
3. Support immediate and async submit/poll/cancel lifecycles.
4. Honor provider rate limits and `Retry-After`.
5. Implement bounded media transfer and recovery.

Acceptance:

- TaleLabs/Trigger traffic never contains the local key;
- image, video, audio, and text operations work for explicitly eligible routes;
- reload resumes when provider ID and key remain available;
- unsupported routes fail before spend;
- no silent managed fallback exists.

### Phase 6 - Security and rollout

1. Audit logs, traces, analytics, source maps, and session replay.
2. Enforce CSP for enabled provider hosts.
3. Verify logout, key removal, IndexedDB clearing, tab freeze, and lease expiry.
4. Verify multi-tab takeover and duplicate-submit prevention.
5. Add a code-owned rollback flag; do not add an environment variable.

Acceptance:

- the browser-only key claim is truthful and verified;
- active runs remain inspectable/cancelable if Browser mode is hidden;
- managed execution remains unaffected.

## Engineering Verification

Required checks:

```txt
dual-runtime product debug matrix for all five run modes
repeatable planner/snapshot parity matrix for all ten cells
planner and snapshot scenarios
browser manifest parsing scenarios
job readiness and transition scenarios
provider output validation scenarios
catalog/browser eligibility validation
providers root/core/browser bundle gate
tenant lease and duplicate-claim race smoke checks
bounded queue/backpressure and fair-fill smoke checks
reload/interruption recovery smoke checks
output-grant scope and canonical Asset ingestion checks
managed Trigger run regression and deployment dry run
SDK generation
all workspace type checks
i18n validation for all locales
TSDoc validation
repository lint with zero warnings
forced production build
git diff --check
no temporary generated SDK directories
```

No engineering script may make a paid request unless the user explicitly starts
paid QA.

## Rollback

Browser execution is additive. A code-owned flag may stop new browser
admissions while preserving:

- existing run history and snapshots;
- cancellation/interruption of active browser runs;
- canonical outputs already finalized;
- encrypted local credentials;
- managed execution behavior.

Never reinterpret an existing browser run as managed.

## References

- [TaleLabs provider execution modes](./provider-execution-modes.md)
- [React Flow: state management with Zustand](https://reactflow.dev/learn/advanced-use/state-management)
- [React Flow: performance](https://reactflow.dev/learn/advanced-use/performance)
- [`p-queue`: Promise queue with concurrency control](https://www.npmjs.com/package/p-queue)
- [`idb`: promise-based IndexedDB](https://github.com/jakearchibald/idb)
- [MDN: Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [MDN: Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API)
- [MDN: using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [MDN: persistent storage](https://developer.mozilla.org/docs/Web/API/StorageManager/persist)
- [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [Trigger.dev: concurrency and queues](https://trigger.dev/docs/queue-concurrency)
- [Trigger.dev: idempotency](https://trigger.dev/docs/idempotency)
- [OpenRouter: API authentication](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter: errors and retry behavior](https://openrouter.ai/docs/api/reference/errors-and-debugging)
