# TaleLabs MVP Execution Plan

**Status:** active source of truth, updated 2026-07-14.

This plan implements the binding scope in
`docs/assets-flows-mvp-contract.md`. It replaces the former Elements-first and
run-engine-first milestone sequence.

Read before starting any task:

```txt
AGENTS.md
docs/assets-flows-mvp-contract.md
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/db-design-planning-v2.md
docs/api-design-planning-v2.md
docs/mvp-execution-plan.md
```

## Objective

Deliver one focused creative loop:

```txt
upload or find an Asset
-> create or open a Flow
-> connect Text, Asset, and creative nodes
-> validate the canvas with deterministic mocked output
-> obtain explicit user UX approval
-> integrate one real provider path
-> persist the output as an Asset
-> reuse the output in the same or another Flow
```

The active MVP entities are only:

```txt
Assets
Flows
```

Elements are deferred. Existing standalone Element code and data may remain
dormant, but no active milestone may expose, extend, or depend on them.

## Mandatory Build Order

```txt
1. Asset foundation
2. Flow canvas foundation
3. Model-adaptive generation-node UX
4. User-owned canvas approval
5. Provider-independent durable run engine with deterministic mock adapters
6. User-owned run UX and end-to-end QA
7. One real provider vertical slice
8. Reliability and internal MVP staging
9. Billing and credits as a separate productization phase
```

The user approved the adaptive node behavior and M5 scope on 2026-07-14.
Trigger.dev orchestration and deterministic mock execution are authorized.
OpenRouter/provider calls, credit charging, and Tool execution are not.

## Deferred Scope

The following are not MVP acceptance requirements:

```txt
Elements or reusable-context packs
Tools and public API/MCP execution
Recipes or community templates
Storyboard
simple Generate page
video editor or cuts
projects
collaboration and comments
triggers, schedules, and webhooks
public galleries or share links
credits, subscriptions, and Stripe billing
```

Feature research is evidence, not authorization to implement a feature.

## Session Rules

Use one small task per AI session unless a task explicitly says otherwise.

Every implementation session must:

1. Read the applicable source-of-truth documents and package instructions.
2. Inspect the dirty worktree and preserve unrelated user work.
3. Trace the changed behavior end to end before editing.
4. Keep tenant-owned reads and writes scoped by `organizationId`.
5. Keep graph semantics in TaleLabs code, not React Flow components.
6. Update OpenAPI and regenerate `@talelabs/sdk` when a public contract changes.
7. Preserve internationalization for all supported locales.
8. Run proportional type, contract, i18n, lint, smoke, and build checks.
9. Report what is ready for user QA without declaring user QA complete.
10. Stop at the task boundary.

Automated tests are not an MVP acceptance requirement. Their absence alone
must not block a milestone, but a high-risk invariant still needs an objective,
repeatable verification path.

## Product And QA Ownership

The AI owns implementation and objective engineering verification. The user
owns browser QA, interaction critique, visual consistency, and final approval.

Passing builds never implies canvas approval. The approval gate requires an
explicit user decision after exercising the product.

## Milestones

| Milestone | Status | Outcome |
| --- | --- | --- |
| M0: Database foundation | Complete | The initial schema and tenant constraints migrate successfully. |
| M1: API foundation | Complete | Hono/OpenAPI/SDK share one tenant-safe API foundation. |
| M2: Assets | Complete | Private media is durable, processed, searchable, organized, and reusable. |
| M3: Canvas foundation | Implemented, refining | Flows persist and reopen with typed manual graph editing. |
| M4: Canvas product reset | Complete, user approved | Every approved creative node is model-adaptive and its canvas UX is accepted. |
| M5: Provider-independent run engine | Active - implementation and review in progress | Durable runs execute real canvas inputs through deterministic mock adapters and persist canonical output Assets. |
| M6: Provider integration | Pending | One real provider path creates a canonical Asset end to end. |
| M7: MVP candidate | Pending | Reliability, tenancy, staging, and user acceptance gates pass. |

---

## M0-M2 - Completed Foundation

The database, API foundation, and Asset system are implemented. Preserve these
behaviors while changing the canvas:

```txt
private R2 storage for uploads and reference Assets
direct and resumable uploads
durable media processing
thumbnails and metadata
folders, search, tags, and favorites
asset lifecycle and purge
visibility-aware signed delivery
organization isolation
global upload progress
```

Do not reopen M0-M2 unless an active canvas requirement exposes a concrete
defect or missing Asset contract.

## M3 - Canvas Foundation

The implemented foundation includes:

```txt
Flow CRUD
normalized flowNodes and flowEdges
revision-based autosave
refresh-safe graph hydration
React Flow interaction layer
Text and Asset nodes
typed handles and connection validation
model capability registry
```

Legacy Element nodes, Flow references, routes, and graph persistence have been
removed from the active product. Migration `009_remove_elements_from_flows`
removes legacy Element graph nodes and the `flowNodes.elementId` column while
preserving standalone Element records and Assets.

### E-030 - Verify The Assets-Only Graph Boundary

**Status:** complete when the repository gates pass.

Acceptance:

- Primary navigation contains only Flows and Assets.
- `/` and unknown dashboard routes resolve to Flows.
- Element screens are unreachable from active dashboard routes.
- Global search returns only Assets and folders.
- `FlowNodeType`, Flow schemas, graph sync, hydration, validation, and mocked
  planning contain no Element node or Element ID.
- Current generation configuration exposes no Element type catalog or
  Element-context input.
- Historical released contracts may retain `ElementContext` only for snapshot
  compatibility.
- Existing standalone Element rows and Asset links are not deleted.

## M4 - Canvas Product Reset

M4 established the approved product surface. Inputs are real Text and canonical
Assets. Its local previews remain ephemeral; M5 now turns the same contracts
into durable deterministic runs.

### E-040 - Video Generation Node

Implement one Video Generation node whose selected model determines:

```txt
available input handles
operation mode
mutually exclusive input groups
combined reference limits
aspect ratio, duration, resolution, and audio settings
readiness and validation messages
output collection type
```

The user chooses a model and supplies compatible inputs; the UI must not ask the
user to select a provider operation ID.

### E-041 - Image Generation Node

Apply the approved Video-node interaction system to image generation while
preserving image-specific contracts such as text-only models, editing/reference
models, output count, aspect ratio, resolution, quality, and format.

Reuse the shared node frame, preview stage, prompt section, settings controls,
input rail, inspector, actions toolbar, and model-transition behavior. Do not
rebuild equivalent UI per node.

### E-042 - LLM Node

Add a text-output node with model-adaptive text and image inputs, instructions,
prompt, reasoning support, output-length control, copy/download behavior, and a
typed Text output.

### E-043 - Dedicated Audio Nodes

Implement separate intent nodes rather than one universal audio node:

```txt
Speech
Music
Sound Effect
Voice Changer
Voice Isolation
```

Share structural primitives and controller behavior, but preserve each intent's
distinct required inputs, settings, output semantics, and model catalog.

### E-044 - Cross-Node Consistency And Extensibility

Before adding more node families, verify that approved behavior is implemented
once and reused where appropriate:

```txt
node frame and header
preview and empty/loading/error/success states
prompt editing
model picker and model transitions
settings rendering
input/output inspector
actions toolbar
download and copy actions
connection badges and disabled/conflict states
keyboard behavior
internationalized labels and errors
```

Adding a model should normally change the curated registry and provider-private
route data, not add a new React node component. Adding a genuinely new creative
intent may add one thin node composition backed by shared primitives.

### E-045 - Deterministic Mocked Output

Add only enough deterministic behavior to evaluate the product:

- Mock output is stable for equivalent node inputs and settings.
- Mock output never calls an external provider or spends credits.
- Graph validation and connection semantics remain real.
- Autosave persists node configuration and mocked presentation state safely.
- Mocked media is clearly isolated at the future adapter boundary with:

```ts
// TODO(provider-integration): Replace this deterministic mock with the
// normalized provider adapter while preserving the request/result contract.
```

Do not create a parallel mock database model, alternate graph planner, or fake
tenant/auth path.

### E-046 - Canvas User Approval Gate

**Owner:** User

**Status:** complete. Approved 2026-07-14.

The user validates:

```txt
node layout and consistency
model switching
input availability and conflicts
settings and progressive disclosure
connecting Text and Assets
keyboard and pointer workflows
autosave, refresh, and navigation
mock output states
long labels and responsive constraints
```

## M5 - Provider-Independent Durable Run Engine

M5 is approved and active. It uses real saved Flow graphs, Text values, Asset
records, model contracts, settings, and connections. Only the normalized
provider result boundary is mocked. The mock engine must use the same admission,
planning, persistence, orchestration, ingestion, status, and provenance path
that M6 provider adapters will use.

**Current implementation status (2026-07-14): implementation and review in
progress.** Durable run admission, immutable snapshots, Trigger.dev
orchestration, deterministic mock generation, canonical output Assets, status
hydration, cancellation, reconciliation, and first dashboard bindings exist and
are under correction review. M5 is not accepted until the remaining review
findings and user-owned run QA are complete.

Implement M5 through these reviewable checkpoints, in order:

```txt
M5.1  forward-only run schema migration + pure server planner
M5.2  server preflight + immutable admission, snapshots, idempotency, and run API
M5.3  Trigger.dev parent orchestration + deterministic mock adapters
M5.4  canonical mock outputs, text outputs, provenance, cancel/reconcile APIs
M5.5  dashboard binding, durable statuses/history, Run all, Run selection
M5.6  engineering verification + user-owned run UX/E2E QA
```

Do not replace the browser preview piecemeal before M5.2 exists. Once the durable
path is available, bind every approved Run command to that single server-owned
execution path; do not retain a second production-shaped browser executor.

Every canvas command must first flush pending autosave and pin an
`expectedFlowRevision`. The server plans and executes only that saved revision;
revision drift is a typed conflict, never a silent switch to newer graph data.

Implementation instructions live in
`docs/m5-deterministic-mock-run-engine-implementation-prompt.md`. The detailed
ordered architecture and execution checkpoints live in
`docs/m5-durable-run-engine-execution-plan.md` and are authoritative for M5
edge-case semantics.

### E-050 - Run Modes And Planner Contract

Add one server-owned planner for five user-visible modes:

```txt
node        Run node
downstream  Run from here
upstream    Run till here
selection   Run selection
all         Run all
```

`node`, `downstream`, and `upstream` require `targetNodeId`. `selection`
requires a non-empty deduplicated `selectedNodeIds` array. `all` accepts neither.

Mode semantics:

- `node`: execute only the target executable node. Connected Text/Asset sources
  are resolved directly; an upstream executable dependency outside this run
  must have a valid pinned/latest successful result.
- `downstream`: execute the target and all reachable executable descendants.
  Dependencies before the target are not rerun and must resolve as above.
- `upstream`: execute the target and its complete executable ancestor closure.
- `selection`: execute only the selected executable nodes. Unselected executable
  ancestors are never regenerated; their inputs resolve from a compatible
  pinned/latest successful result or admission fails with
  `missing_upstream_output`.
- `all`: execute every executable node in the Flow in deterministic topological
  order. Disconnected executable branches are included.

Text, Asset, collection, and deterministic transform/control nodes may
participate in snapshots and planning without creating provider jobs.

### E-051 - Immutable Admission And Snapshot

Run admission must:

1. Enforce tenant ownership and run-rate/concurrency limits.
2. Reuse an organization-scoped idempotency key only for the same request hash.
3. Load and validate the client-pinned `expectedFlowRevision` after autosave.
4. Select and validate a bounded DAG/subgraph for the requested mode.
5. Resolve only direct Assets, Text, and same-run/prior pinned node outputs.
6. Lock exact Asset inputs in stable ID order and require usable processing and
   lifecycle states.
7. Pin node schema versions, stable TaleLabs model IDs, model contract versions,
   derived operations, normalized settings, edge order, selected inputs, and
   executor/snapshot versions.
8. Revalidate the Flow revision before inserting the run; drift returns a typed
   conflict rather than silently executing newer graph data.
9. Insert the immutable run snapshot, planned nodes/items, jobs, source lineage,
   and exact input rows transactionally.

Mutable Flow rows must never be execution truth after admission. Snapshot JSON
contains no credentials, signed URLs, storage keys, provider bytes, or Element
context.

### E-052 - Multiplicity Foundation

Preserve the distinction between:

```txt
inner collection  = ImageSet, VideoSet, AudioSet, or Text consumed together
outer items       = explicit repeated executions with dimensions and lineage
```

Support multiple outputs, request sharding, deterministic `itemKey`, dimensions,
and lineage without exposing iteration control nodes. A generation node returning
multiple files produces one typed collection consumed together.

No ordinary collection edge may multiply downstream spending implicitly.
Planning must expose item counts, request counts, and expected output counts
before admission and enforce bounded limits. Iterator/Map, Collect, Zip, Prompt
Iterator, and output-dependent dynamic expansion are deferred until real product
usage demonstrates the need.

### E-053 - Trigger.dev Orchestration

Use Trigger.dev for durable orchestration, retries, waiting, cancellation,
concurrency, and progress metadata. PostgreSQL remains the product-domain truth.

- Trigger payloads contain only tenant-scoped run/job IDs.
- Tasks load immutable snapshots and inputs from PostgreSQL.
- Dispatch is idempotent and reconcilable after an API/Trigger failure.
- Parallel DAG branches may run concurrently within configured organization and
  provider/mock limits.
- Descendants of failed required inputs become `skipped`.
- A run may finish `succeeded`, `partial`, `failed`, or `canceled`.
- Task retries must never duplicate jobs or output Assets.

### E-054 - Deterministic Mock Adapters And Canonical Assets

Implement normalized deterministic adapters for text, image, video, and audio.
Equivalent immutable request snapshots produce equivalent mock results. Mock
adapters make no external AI request and record zero provider/credit cost.

All generated media mocks must traverse the canonical visibility-aware storage
and ingestion pipeline and become `public` generation Assets with output order
and immutable provenance. Uploads and reference Assets remain `private`. Text
results remain durable run/job outputs under the documented text-output
contract; do not create fake media Assets for text. This is a temporary
pre-billing policy: billing later chooses visibility from the funding source.

Mock media comes from a small, versioned private fixture catalog seeded once per
environment. A run never downloads stock media. The adapter deterministically
selects a fixture, copies it to the real generation job/output key, and continues
through the exact completion/ingestion path used by M6. Each output Asset owns a
unique output key even when fixture bytes are identical.

Every mock replacement boundary includes:

```ts
// TODO(provider-integration): Replace the deterministic mock adapter with the
// normalized provider adapter while preserving this request/result contract.
```

### E-055 - Run API And Realtime State

Implement tenant-scoped APIs to:

```txt
preflight a run command against one saved Flow revision
create/admit a run
get run detail with per-node/item/job state and outputs
list Flow and node run history
cancel a run
retry failed work through a new immutable run
reconcile undispatched or stuck domain work
issue narrowly scoped Trigger.dev realtime read tokens when used by the client
```

The database remains authoritative even when Trigger.dev Realtime improves the
UX. Polling is the fallback and recovery path.

### E-056 - Run UX

Preserve the approved node toolbar:

```txt
primary Run button = Run node
dropdown           = Run from here / Run till here
```

Add:

- `Run all` to the main canvas action bar.
- `Run selection` to the context menu shown when one or more nodes are selected
  and the selection contains at least one executable node.
- A plan summary when an action includes more executable nodes than the visible
  target/selection.
- Queued, running, succeeded, partial, failed, skipped, and canceled states.
- Per-node progress and outputs, run history, cancellation, retry/rerun, and
  output navigation without writing result truth into mutable node `data`.
- A root-level active-run observer so navigation away from the Flow never stops
  progress updates. Trigger.dev Realtime is a wake-up signal; the run API remains
  the rendered source of truth.

In React Flow terminology, this command operates on selected nodes. Do not
reintroduce the TaleLabs Element product or call selected nodes “Elements” in
user-facing copy.

### E-057 - M5 Engineering Verification

Provide repeatable checks for:

```txt
tenant isolation and cross-organization IDs
all five subgraph-selection modes
cycle and graph-limit rejection
revision race rollback
idempotent replay and conflicting request hashes
stable snapshots and hashes
multiple outputs remain collection-valued without implicit iteration
partial failure and skipped descendants
cancellation and retry races
dispatch reconciliation
canonical Asset ingestion without duplicates
no provider network requests or non-zero mock costs
```

### E-058 - User Run QA Gate

**Owner:** User

The user validates run actions, planned scope clarity, selection behavior,
statuses, history, cancellation, rerun, output presentation, navigation during
active runs, and overall canvas UX. M6 remains blocked until explicit approval.

## M6 - First Real Provider Loop

After the M5 rewrite is approved, implement one narrow path first:

```txt
one generation node
-> validate and admit
-> snapshot exact inputs
-> dispatch durable work
-> call one normalized provider adapter
-> reconcile status and retries
-> ingest output through the canonical visibility-aware storage policy
-> create canonical Asset
-> show the result on the node
```

Add spending limits, timeouts, cancellation semantics, provider error mapping,
and observability before expanding model coverage. Keep provider credentials,
native endpoints, fallback policy, and costs server-only.

The observability implementation is deferred while M5 completes. Before beta,
implement the baseline in `observability-planning.md`: `flowRunId` correlation,
shared structured events, Trigger.dev telemetry and alerts, Sentry, and an
internal PostgreSQL-backed Run Inspector. A centralized OpenTelemetry backend is
not required until production volume demonstrates the need.

## M7 - Internal MVP Candidate

The MVP candidate requires:

```txt
tenant-isolation audit
upload and generation failure recovery
idempotency and replay verification
bounded query and graph behavior
observability baseline and failure alerts
staging deployment
production build and contract checks
user-owned end-to-end acceptance
```

Credits, subscriptions, public API/MCP, Elements, Tools, Recipes, and other
expansion layers require separate plans after this gate.

## Standard Verification

Run the relevant subset for every task and the complete set before milestone
approval:

```bash
npm run sdk:generate
npm run check-types
npm run i18n:check
npm run lint
npm run generation:check -w @talelabs/flows
npm run generation:check-drift -w api
npm run build
git diff --check
```

Also verify that no temporary SDK `.gen-*` directories remain and that generated
files were produced by the repository generator rather than edited manually.
