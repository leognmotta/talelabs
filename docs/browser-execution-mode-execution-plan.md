# TaleLabs Browser Execution Mode - Execution Plan

**Status:** proposed implementation plan. No browser run executor is implemented
by this document.

**Product decision:** Browser execution is the initial local BYOK path. It uses
a provider key stored only in the current browser and supports **Run node only**.
Multi-node commands remain part of managed Trigger.dev execution and may become
paid features later.

This plan extends the trust-boundary design in
`docs/provider-execution-modes.md`. It does not replace the existing managed run
engine, immutable run snapshots, PostgreSQL authority, or canonical Asset
pipeline.

## Outcome

The first browser execution release must support this complete loop:

```txt
user selects Browser mode
-> user clicks Run on one executable node
-> API validates and admits one immutable node run
-> browser obtains the admitted browser execution manifest
-> browser resolves the local provider key
-> browser calls the provider directly
-> browser waits or polls when the provider is asynchronous
-> browser uploads the output through a scoped TaleLabs grant
-> API validates and finalizes the output as a canonical Asset
-> the existing run query projects the output onto the canvas
-> refreshing the page preserves the completed output
```

The provider key must never be sent to TaleLabs API, PostgreSQL, R2,
Trigger.dev, analytics, logs, traces, errors, session replay, or Flow data.

## Deliberate V1 Boundary

Browser execution supports only:

```txt
command mode       node
executable nodes   exactly 1
planned jobs       exactly 1
provider route     explicitly browser eligible
credential source  encrypted browser Secure Store
```

Browser execution does not support:

```txt
Run from here
Run till here
Run selection
Run all
automatic upstream execution
iteration or outer runtime-item expansion
provider webhooks
managed BYOK
silent fallback to a TaleLabs credential
silent fallback to Trigger.dev
```

`Run node` continues to reuse already persisted compatible upstream outputs.
It does not regenerate upstream nodes. If required upstream output is missing,
the run fails admission with a localized, actionable validation error.

The existing managed runtime retains every approved run mode. Billing and
entitlement enforcement are separate future work; this implementation only
establishes the runtime capability boundary.

## Naming: Two Independent Dimensions

The current `executionMode` means real versus deterministic provider behavior:

```ts
type ExecutionMode = 'live' | 'debug'
```

Browser versus managed execution is a different decision and must not overload
that field:

```ts
type ExecutionRuntime = 'browser' | 'managed'
```

Examples:

```txt
managed + live   = Trigger.dev with a TaleLabs platform credential
managed + debug  = Trigger.dev with the deterministic mock adapter
browser + live   = local BYOK request from the current browser
browser + debug  = optional local deterministic development path
```

V1 product UI needs only `managed + live` and `browser + live`. The debug
combination remains an engineering seam and must not add product controls.

## Architectural Rules

### One run model

Do not create `localRuns`, browser-only generation tables, or a second Flow
planner. Browser and managed runs share:

- server-side graph validation;
- immutable snapshots and plan hashes;
- `flowRuns`, run nodes, items, jobs, sources, inputs, and outputs;
- tenant isolation and authorization;
- model and provider binding capture;
- canonical Asset creation and provenance;
- run and node status APIs;
- canvas output hydration after refresh;
- retry and cancellation state vocabulary where behavior is supported.

The runtime changes who performs the provider lifecycle, not what a TaleLabs
run means.

### Clear state ownership

| State | Owner | Notes |
| --- | --- | --- |
| Flow nodes, edges, selection, viewport, editor history | Canvas Zustand store | Transient controlled React Flow state only. |
| Flow graph and revision | PostgreSQL through Flow API | Authoritative saved creative document. |
| Run, job, snapshot, inputs, outputs, status | PostgreSQL | Authoritative execution state. |
| Server state in React | TanStack Query | Queries and invalidation; never copy into a second global store. |
| Provider key | Existing encrypted Secure Store IndexedDB database | Never expose through Zustand or TanStack Query. |
| Browser recovery checkpoint | Separate non-secret IndexedDB journal | Recovery cache, never source of truth. |
| Browser runtime preference | `localStorage`, scoped to the current user | Non-sensitive device preference. |
| Executor tab identity | `sessionStorage` | Random non-secret ID per tab session. |
| Active in-tab work | Small `p-queue` instance | Disposable scheduling, reconstructed from API and journal. |
| Cross-tab leadership | Web Locks API | Local coordination only; server lease remains authoritative. |
| Cross-tab status hints | BroadcastChannel | Invalidation hints only, never authoritative state. |

The canvas Zustand store may project whether a node is selected or display a
run result already obtained from run queries. It must not own provider
credentials, durable job status, provider job IDs, leases, or recovery truth.

### Shared logic without a universal engine

Reuse only deterministic policy across runtimes:

- snapshot and manifest schemas;
- job readiness;
- request normalization;
- provider output validation;
- normalized provider lifecycle results;
- retry/backoff calculations;
- cancellation transition rules;
- safe error normalization.

Keep runtime effects separate:

```txt
managed driver  -> Trigger.dev, PostgreSQL, R2, managed credential, reconciliation
browser driver  -> browser key, fetch, IndexedDB journal, browser lease, upload grant
```

Do not create a giant generic executor with dozens of callbacks. Shared modules
must remain pure, small, and named after one domain responsibility.

## Package Changes

### New dependencies

Install in the dashboard workspace:

```bash
npm install idb p-queue -w dashboard
```

`idb` is a small promise-based IndexedDB wrapper. It keeps the recovery journal
readable without introducing a second database abstraction or reworking the
existing encrypted credential store.

`p-queue` is not the Flow engine. It provides bounded scheduling for multiple
independent single-node browser runs started by the user. Start with a
code-owned concurrency limit of `2`. The API and PostgreSQL remain authoritative;
the queue can always be discarded and reconstructed.

### Existing dependencies to reuse

```txt
zustand                 canvas interaction and transient presentation
@tanstack/react-query   server state and run invalidation
@xyflow/react           canvas rendering and interactions
@talelabs/flows         deterministic planning and snapshot contracts
@talelabs/providers     browser-safe protocol behavior and Secure Store
@talelabs/sdk           generated authenticated TaleLabs API client
zod                     strict untrusted manifest and journal parsing
```

### Packages explicitly not required

Do not add:

```txt
Dexie
Redux
XState
Workbox
a service-worker queue
a Web Worker framework
a BroadcastChannel polyfill
a browser DAG/workflow engine
```

Native Web Locks and BroadcastChannel are sufficient for current browser
targets. Service Worker Background Sync is not a reliable execution host for
multi-minute generation and must not be presented as durability equivalent to
Trigger.dev.

## Proposed Folder Structure

Only create a module when its phase is implemented. Do not scaffold empty files.

### Provider-neutral runtime policy

```txt
packages/flows/src/runtime/execution/
  contracts.ts
  browser-manifest.ts
  job-readiness.ts
  job-transitions.ts
  retry-policy.ts
```

- `contracts.ts`: `ExecutionRuntime` and runtime-neutral execution types.
- `browser-manifest.ts`: strict sanitized manifest schema and parser.
- `job-readiness.ts`: pure readiness decisions for one admitted job.
- `job-transitions.ts`: legal provider-independent state transitions.
- `retry-policy.ts`: pure backoff and retry eligibility calculations; no timers.

Do not move PostgreSQL, R2, Trigger.dev, credentials, React, or browser APIs into
`@talelabs/flows`.

### Browser provider composition

```txt
packages/providers/src/browser/execution/
  contracts.ts
  eligibility.ts
  registry.ts
  lifecycle.ts
```

- `contracts.ts`: injected browser execution dependencies and normalized result.
- `eligibility.ts`: explicit provider/protocol browser capability checks.
- `registry.ts`: maps one captured browser binding to an existing protocol
  adapter; no model-specific adapters.
- `lifecycle.ts`: immediate submit or asynchronous submit/poll/cancel using the
  injected credential and fetch implementation.

Extend `packages/providers/src/browser.ts` with only the stable public browser
execution API. Keep Node built-ins, environment access, Trigger.dev, accounting,
webhook verification, and server credential fallback behind `/server`.

### API browser-run boundary

```txt
apps/api/src/domain/runs/browser/
  contracts.ts
  manifest.service.ts
  lease.service.ts
  checkpoint.service.ts
  output.service.ts

apps/api/src/data/
  browser-run-leases.data.ts
  browser-run-checkpoints.data.ts

apps/api/src/routes/runs/
  browser-runs.routes.ts
  browser-runs.schemas.ts
```

- `manifest.service.ts`: projects the already admitted immutable snapshot into
  the minimum safe browser execution manifest.
- `lease.service.ts`: tenant-scoped compare-and-set ownership and renewal.
- `checkpoint.service.ts`: validates and persists normalized progress and
  provider job identity without accepting secrets.
- `output.service.ts`: issues scoped output upload grants and finalizes text or
  media through the existing canonical Asset pipeline.
- data modules own SQL only; routes own HTTP validation only.

Do not duplicate admission, snapshot reading, run aggregation, output ingestion,
or Asset folder policy.

### Dashboard browser executor

```txt
apps/dashboard/src/features/browser-execution/
  contracts.ts
  executor-root.tsx
  run-controller.ts
  job-runner.ts
  scheduler.ts
  recovery.ts
  journal.ts
  leader-lock.ts
  channel.ts
  output-transfer.ts
  runtime-preference.ts
  browser-run.queries.ts
```

- `executor-root.tsx`: mounts once under the authenticated dashboard layout and
  starts/stops the controller for the current user and organization.
- `run-controller.ts`: coordinates admitted browser runs; no React rendering.
- `job-runner.ts`: resolves the local credential, executes one manifest job, and
  reports checkpoints.
- `scheduler.ts`: one small `p-queue` instance for independent single-node runs.
- `recovery.ts`: reconciles API active runs with the non-secret local journal.
- `journal.ts`: typed IndexedDB read/write/delete operations.
- `leader-lock.ts`: one Web Lock per user and organization executor.
- `channel.ts`: cross-tab query-invalidation and takeover hints.
- `output-transfer.ts`: bounded provider output download and scoped R2 upload.
- `runtime-preference.ts`: user-scoped non-secret `managed | browser` device
  preference.
- `browser-run.queries.ts`: generated SDK mutations and TanStack Query keys.

Do not place browser execution state inside `flow-canvas-store/`. The canvas
store remains focused on editing the graph.

### Settings integration

Modify the existing provider settings rather than adding a second API-key page:

```txt
apps/dashboard/src/features/settings/
  secure-store-settings.tsx
  provider-execution-mode.tsx
```

`provider-execution-mode.tsx` renders a segmented or radio control for:

```txt
Browser  -> use the key stored in this browser
Managed  -> use TaleLabs managed execution
```

The visible label may be **Browser mode**, but internal code uses
`ExecutionRuntime`. Never call this `executionMode`, because that name already
means `live | debug`.

## Data Model

### `flowRuns`

Add a forward-only migration with:

```txt
executionRuntime text not null default 'managed'
check executionRuntime in ('managed', 'browser')
```

Persist it in the immutable snapshot envelope and expose it in run responses.
Existing rows remain `managed`.

For a browser run, enforce at admission:

```txt
mode = 'node'
planned executable count = 1
planned job count = 1
captured binding is browser eligible
execution mode = 'live' for product use
```

Do not infer the runtime from `triggerRunId` or credential availability.

### Browser executor lease

Add one tenant-scoped table:

```txt
flowRunBrowserLeases
  organizationId
  flowRunId
  userId
  executorId
  expiresAt
  heartbeatAt
  createdAt
  updatedAt
```

Required invariants:

- one active lease per browser run;
- Flow run and lease organization must match;
- only the admitting user or an explicitly authorized workspace actor may
  acquire the lease;
- acquisition, renewal, takeover, and release use guarded SQL updates;
- takeover is allowed only after expiration;
- run cancellation or terminal completion retires the lease;
- `executorId` is a random non-secret tab identifier, not a credential.

Use database time for expiry comparisons. Web Locks reduce duplicate work in
one browser profile, but the PostgreSQL lease is the concurrency authority.

### Existing job and output tables

Reuse existing generation jobs, provider checkpoints, provider output rows,
text outputs, sources, inputs, and Asset provenance. Do not create browser
copies.

Browser checkpoint writes may populate the existing normalized fields:

```txt
providerGenerationId
providerJobId
provider lifecycle/status
submission time
completion status
normalized provider metadata
```

Every write remains tenant-scoped and guarded by the current job state and
browser lease.

### Browser journal

Create a separate IndexedDB database:

```txt
talelabs-browser-execution-v1
  runCheckpoints
```

Journal record:

```ts
interface BrowserRunCheckpoint {
  flowRunId: string
  generationJobId: string
  organizationId: string
  userId: string
  state:
    | 'admitted'
    | 'submitting'
    | 'providerProcessing'
    | 'downloading'
    | 'uploading'
    | 'finalizing'
    | 'interrupted'
  providerJobId?: string
  nextPollAt?: string
  updatedAt: string
}
```

Never store provider credentials, Authorization headers, signed URLs, full
provider request/response bodies, prompts, generated media, lease credentials,
or telemetry payloads. The journal assists recovery; API state always wins.

## Models Catalog Changes

Browser execution eligibility belongs to the captured provider binding, not the
public model record and not a dashboard allowlist.

Extend the provider binding schema with an explicit runtime policy:

```json
{
  "executionRuntimes": ["managed", "browser"]
}
```

Rules:

1. `managed` remains supported for current bindings.
2. Add `browser` only after verifying the exact protocol and endpoint.
3. Browser eligibility must validate CORS, request delivery, polling,
   cancellation behavior, output delivery, and browser-safe adapter imports.
4. One model may be managed-only even when another model using the same
   provider is browser eligible.
5. Admission captures the exact binding and runtime policy into the snapshot.
6. Changing current eligibility never changes historical admitted runs.
7. Catalog validation fails if a browser-eligible binding points at a
   server-only adapter or unsupported lifecycle.

The dashboard must not maintain a second model/runtime matrix.

## API Contract

### Run admission

Extend the existing run admission request:

```json
{
  "executionRuntime": "browser",
  "executionMode": "live",
  "mode": "node",
  "targetNodeId": "node_id",
  "expectedFlowRevision": 42
}
```

The API performs the same authorization, Flow revision check, graph validation,
Asset locking, planning, snapshot capture, and persistence used by managed
execution.

For `executionRuntime = browser`, it additionally:

- rejects every command except `node`;
- rejects plans with anything other than one executable and one job;
- rejects a binding without browser eligibility;
- persists the run but does not dispatch Trigger.dev;
- returns the admitted run summary; the browser obtains a lease and manifest
  through authenticated endpoints.

Stable error examples:

```txt
browser_runtime_node_only
browser_runtime_multiple_jobs_unsupported
browser_runtime_binding_unsupported
browser_runtime_credential_required
browser_runtime_lease_conflict
browser_runtime_interrupted
```

API errors remain machine-readable; the dashboard translates them.

### Browser endpoints

Add explicit endpoints rather than a generic event ingestion API:

```txt
POST /runs/:runId/browser/lease
GET  /runs/:runId/browser/manifest
POST /runs/:runId/browser/jobs/:jobId/checkpoint
POST /runs/:runId/browser/jobs/:jobId/output-grant
POST /runs/:runId/browser/jobs/:jobId/finalize-media
POST /runs/:runId/browser/jobs/:jobId/finalize-text
POST /runs/:runId/browser/jobs/:jobId/fail
POST /runs/:runId/browser/release
```

Every endpoint must:

- authenticate the Better Auth session;
- authorize organization membership and run ownership;
- match run, job, node, organization, user, and active lease;
- validate runtime is `browser` and command is `node`;
- validate current state with compare-and-set semantics;
- accept only normalized bounded metadata;
- remain idempotent under request replay;
- return no provider credential or managed route secret.

The manifest contains only the exact admitted job, normalized request,
sanitized captured provider binding, expected output contract, and source Asset
descriptors required by the browser adapter. The server revalidates every
checkpoint and finalization against its immutable snapshot.

## Browser Execution Lifecycle

### 1. Select Browser mode

- Store the non-sensitive preference under a user-scoped localStorage key.
- Confirm Web Crypto, IndexedDB, fetch, Web Locks, and BroadcastChannel support.
- Confirm the selected provider credential exists without resolving it into UI
  state.
- Request persistent storage with `navigator.storage.persist()` as a best-effort
  improvement. Never promise that the browser grants it.

### 2. Admit Run node

- Flush Flow autosave.
- POST one run admission request with `executionRuntime: 'browser'` and
  `mode: 'node'`.
- Do not call a separate planning endpoint from the Run button.
- Seed the shared run query cache from the admission response.
- Add the admitted run ID to the local journal and scheduler.

### 3. Acquire execution ownership

- The root executor attempts the organization/user Web Lock.
- It creates or renews the server lease with the tab's `executorId`.
- If another tab owns the server lease, this tab becomes an observer.
- Observers receive BroadcastChannel hints and refetch authoritative run state.

### 4. Load manifest and inputs

- Fetch and strictly parse the browser manifest.
- Confirm it has one executable node and one job.
- Resolve short-lived read grants for private input Assets when needed.
- Never persist signed URLs.
- Materialize provider input as URL, Blob, File, bytes, or data URL according to
  the captured protocol profile.

### 5. Resolve credential and execute provider

- Resolve plaintext through `@talelabs/providers/browser` only inside the job
  runner immediately before the request.
- Keep it in the narrowest possible scope.
- Inject it into the existing provider protocol adapter.
- Persist only normalized non-secret checkpoints.

Immediate providers continue directly to output handling. Asynchronous
providers persist the provider job ID locally and through the checkpoint API,
then poll according to the captured lifecycle. Browser mode does not use
webhooks.

### 6. Transfer output

Text:

- validate output count and bounds with the shared provider-output validator;
- finalize through the text endpoint;
- persist in the existing text output table.

Image, video, or audio:

- validate MIME type, count, and delivery form;
- request an output grant scoped to run, job, output index, media type, size
  limit, public generated-output bucket, and server-owned object key;
- download authenticated provider output in the browser when necessary;
- stream to R2 when the browser and protocol support it;
- otherwise use a bounded Blob fallback;
- finalize only after R2 confirms the object exists;
- pass the object through existing canonical Asset ingestion and Flow folder
  policy.

The output grant must never allow arbitrary bucket names, object keys, MIME
types, or unlimited size.

### 7. Complete and project

- API performs the authoritative terminal job/run transition.
- Browser invalidates existing run detail and Asset queries.
- Existing canvas output projection displays the Asset.
- PostgreSQL and canonical Assets restore the result after refresh.
- Delete the local checkpoint only after terminal state is confirmed.

## Interruption and Recovery

### Navigation within TaleLabs

Mount the executor under the authenticated dashboard layout, not under the Flow
canvas. Route navigation must not stop an active browser run.

### Reload or renderer crash

On startup:

1. list active browser runs for the current user and organization;
2. read and validate matching local checkpoints;
3. obtain the Web Lock and a fresh or renewed server lease;
4. reconcile API state against the local checkpoint;
5. resume polling, output transfer, or finalization when safe;
6. mark the run `credential_required` or `interrupted` when recovery is
   impossible.

### Browser close, device sleep, or device switch

Browser mode cannot promise uninterrupted execution. If the provider accepted
the request and a provider job ID was persisted, TaleLabs may resume polling
when the same browser and credential return. Another device cannot resume the
credential-bearing lifecycle unless the user enters the key there.

### Multiple tabs

- Web Locks selects one local leader.
- PostgreSQL lease prevents split-brain execution.
- BroadcastChannel only signals `runChanged` or `leaseReleased`.
- Receiving tabs refetch via TanStack Query.
- Never broadcast credentials, manifests, signed URLs, prompts, provider
  payloads, or output bytes.

## UX Contract

### Settings

Under **Providers -> Secure Store**:

- show Browser and Managed runtime choices;
- explain Browser mode uses the key stored only in this browser;
- show Browser mode unavailable when no key is stored;
- retain the precise security claim from `provider-execution-modes.md`;
- disclose that closing the browser may interrupt local execution;
- do not claim managed-grade durability.

### Canvas commands

When Browser mode is selected:

- node Run button remains available for browser-eligible nodes;
- hide or disable Run from here and Run till here;
- hide or disable Run selection;
- hide or disable Run all in the main toolbar;
- do not show a fake billing checkout before billing exists;
- use localized copy such as “Available with managed execution”;
- never silently switch runtimes when a command is unavailable.

When Managed mode is selected, preserve every currently approved command and
the existing Trigger.dev behavior.

### Progress

Use the existing run and node status presentation. Add browser-specific
substates only where they answer what is happening or what the user should do:

```txt
waiting for this browser
provider request submitted
provider is generating
downloading result
uploading result
finalizing Asset
browser interrupted
credential required
```

Do not add a second progress panel or make the canvas read IndexedDB directly.

## Security Requirements

1. Browser admission never includes a provider key.
2. The API never returns a managed platform credential.
3. Credential resolution occurs only inside the browser job runner.
4. Browser manifests contain no secrets and are strictly parsed.
5. Lease and job updates are tenant-scoped, state-guarded, and idempotent.
6. Provider output grants are run/job/output-specific and short-lived.
7. Prompts, signed URLs, provider payloads, credentials, and media are excluded
   from logs, analytics, traces, errors, session replay, BroadcastChannel, and
   local journal storage.
8. Browser-reported provider cost is informational and untrusted for billing.
9. Add a strict CSP and audit third-party scripts before release.
10. Browser eligibility is explicit per captured provider binding.
11. Browser failure never falls back to managed credentials.
12. Logout clears the local credential and stops/releases local execution.

## Implementation Phases

### Phase 0 - Reconcile binding documents

Before implementation, update active documentation to approve Browser execution
as a second runtime. Replace the stale instruction in
`docs/mvp-execution-plan.md` that says not to retain a production-shaped
browser executor.

Update together:

```txt
docs/assets-flows-mvp-contract.md
docs/talelabs-product-vision.md
docs/mvp-execution-plan.md
docs/flow-nodes-planning.md
docs/api-design-planning-v2.md
docs/db-design-planning-v2.md
docs/provider-execution-modes.md
```

Acceptance:

- Browser mode is explicitly Run node only.
- Managed mode retains every existing run command.
- `executionRuntime` and `executionMode` are distinct everywhere.
- No document promises browser durability equivalent to Trigger.dev.

### Phase 1 - Contracts and catalog eligibility

1. Add provider-neutral `ExecutionRuntime`.
2. Add strict browser manifest contracts.
3. Add explicit browser eligibility to captured provider bindings.
4. Validate browser/server package boundaries in catalog checks.
5. Preserve current managed route selection and historical snapshots.

Acceptance:

- Catalog fails closed on incompatible browser bindings.
- Browser entry points bundle without Node built-ins.
- No dashboard allowlist duplicates catalog eligibility.
- No provider credential is part of any contract.

### Phase 2 - Persistence and admission

1. Add `flowRuns.executionRuntime` and the browser lease table.
2. Extend admission request/response and generated SDK.
3. Reuse current admission and snapshot code.
4. Reject non-node commands and multi-job browser plans.
5. Persist browser runs without Trigger.dev dispatch.
6. Add tenant-scoped lease operations.

Acceptance:

- Managed admission behavior is unchanged.
- Browser admission creates the same immutable run spine.
- A browser run never receives `triggerRunId`.
- Concurrent tabs cannot both own one run.
- Existing rows migrate to `managed`.

### Phase 3 - Settings and runtime command binding

1. Add Browser/Managed preference under Secure Store.
2. Store preference locally and scope it by user ID.
3. Add capability checks for browser APIs and stored credential status.
4. Pass selected runtime to run admission.
5. Gate canvas commands without changing managed behavior.

Acceptance:

- No key is resolved by Settings UI.
- Browser mode cannot run without a local credential.
- Browser mode exposes Run node only.
- Managed mode still exposes all approved commands.
- Copy is translated across all ten supported locales.

### Phase 4 - Browser executor and immediate outputs

1. Install `idb` and `p-queue`.
2. Mount the executor at dashboard layout scope.
3. Implement journal, lock, lease, scheduler, and controller.
4. Implement one immediate provider lifecycle first.
5. Finalize text and one small media response through canonical output APIs.
6. Reuse existing run query projection.

Acceptance:

- One browser Run node completes without Trigger.dev.
- The provider sees the credential; TaleLabs traffic does not.
- Output becomes a canonical Asset.
- Refresh restores output from server state.
- Navigating to Assets does not stop the executor.

### Phase 5 - Asynchronous media and recovery

1. Support asynchronous submit/poll lifecycles for explicitly eligible routes.
2. Persist provider job identity and next-poll checkpoint without secrets.
3. Resume after reload in the same browser.
4. Implement bounded download/upload for image, audio, and video.
5. Implement cancel where the provider and binding support it.
6. Add interruption and credential-required states.

Acceptance:

- A long video can survive route navigation.
- Reload can resume a persisted provider job when the same key exists.
- Large outputs respect code-owned size and memory bounds.
- Closing the browser is reported as interruption, not hidden failure.
- No webhook is required for browser mode.

### Phase 6 - Multi-tab, security, and rollout gate

1. Add Web Lock leadership and server lease takeover.
2. Add BroadcastChannel invalidation hints.
3. Audit telemetry and session replay.
4. Add CSP suitable for provider calls and required delivery hosts.
5. Verify logout, key removal, and storage-clear behavior.
6. Verify every browser-eligible provider protocol independently.

Acceptance:

- Two tabs never submit the same job twice.
- Lease takeover works after expiry.
- Credentials do not appear in TaleLabs network requests, logs, browser journal,
  state devtools, errors, source maps, or analytics.
- Unsupported browsers and providers fail closed with localized copy.

### Phase 7 - User-owned QA

The user validates:

- Settings and security copy;
- Browser/Managed switching;
- node-only command behavior;
- immediate image/text generation;
- asynchronous video/audio generation;
- navigation during generation;
- reload and interruption recovery;
- cancellation;
- duplicate-click and multi-tab behavior;
- output persistence on canvas and in Assets;
- visual and interaction quality.

Automated browser E2E is not an MVP acceptance requirement unless the user
changes that rule.

## Verification Matrix

Engineering verification must cover:

```txt
catalog and browser-eligibility validation
providers browser-only type and bundle gate
strict manifest parsing
managed run regression checks
browser node-only admission checks
tenant and lease race smoke checks
output-grant scope checks
provider-output validation scenarios
snapshot and planner scenarios
SDK generation
complete workspace type checks
i18n validation for all locales
TSDoc validation
repository lint with zero warnings
forced production build
Trigger.dev deployment dry run for managed regression safety
git diff --check
no temporary SDK generation directories
```

No verification script may use a real paid provider request unless the user
explicitly starts paid QA.

## Rollback Strategy

Browser execution is additive. A code-owned product flag may hide Browser mode
while preserving encrypted credentials. Do not use an environment variable.

Rollback must:

- stop new browser admissions;
- leave existing browser runs readable;
- allow active browser runs to be canceled or marked interrupted;
- keep canonical outputs already finalized;
- preserve managed execution unchanged;
- never reinterpret browser runs as managed runs.

## Future Paid Expansion

After the single-node browser loop is validated, paid managed execution may
remain the only runtime for:

```txt
Run from here
Run till here
Run selection
Run all
durable provider webhooks
server-side retries and reconciliation
execution after browser close
team-visible managed run continuity
```

If product evidence later supports multi-node browser execution, extend the
same run model deliberately. Do not prematurely add browser DAG traversal,
dependency scheduling, iteration, or a durable local workflow engine in V1.

## References

- [TaleLabs provider execution modes](./provider-execution-modes.md)
- [React Flow state management with Zustand](https://reactflow.dev/learn/advanced-use/state-management)
- [`idb`: promise-based IndexedDB](https://github.com/jakearchibald/idb)
- [MDN Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [MDN BroadcastChannel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
- [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [OpenRouter API authentication](https://openrouter.ai/docs/api/reference/authentication)
