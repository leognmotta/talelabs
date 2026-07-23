# Direct AI Asset Creation

**Status:** active product and architecture contract, revised 2026-07-23.

This document defines TaleLabs Create as a direct-generation playground. It
supersedes the retired design in which Create drafts were persisted as ordinary
Flows.

## Product Decision

Create is one low-friction workspace for generating an Image, Video, or Audio
Asset:

```txt
open /create
-> describe or attach inputs
-> select a model and settings
-> generate
-> receive canonical Assets
-> continue from a result or start another request
```

Create has:

- one route, `/create`;
- one browser-local mutable draft;
- same-tab recovery storage for that unsent draft;
- durable creator-scoped run history;
- the same model catalog, generation compiler, execution runtimes, provider
  adapters, accounting, and Asset ingestion used by Flows.

Create has no:

- session;
- Flow identity;
- graph, node, edge, viewport, or graph revision;
- graph autosave or revision-conflict workflow;
- Create-to-Canvas clone or conversion action;
- server-side draft persistence;
- Create-specific execution engine.

Flows remain the spatial multi-step authoring product. Create and Flows share
generation compilation and execution, not editable persistence.

## Ownership Boundary

The shared architecture is:

```txt
CreateDraft
  -> direct request validation
  -> compileGenerationJob()
  -> ExecutionPlan

FlowGraph
  -> DAG selection, topology, dependency resolution, and input materialization
  -> compileGenerationJob()
  -> ExecutionPlan

ExecutionPlan
  -> immutable run snapshot
  -> durable run, step, item, and generation-job persistence
  -> browser or managed execution
  -> existing provider adapter
  -> existing output finalizer
  -> canonical Assets
```

`@talelabs/flows` owns provider-neutral model resolution, prompt contracts,
generation-job compilation, execution plans, and immutable snapshot contracts.
The Flow planner calls the shared compiler only after it has resolved graph
dependencies. Direct Create admission calls the same compiler once after it has
validated the request and locked every Asset input.

The compiler is the one authoritative constructor for the canonical
provider-neutral generation-job request. Neither Create nor the Flow planner
may independently construct:

- prompt reference resolution;
- normalized settings;
- ordered provider inputs;
- input selection;
- output count;
- catalog/model/operation identity;
- request hashes.

Create must never construct even a temporary Flow graph. Reusing graph planning
for a one-step request would make graph persistence and execution accidentally
inseparable again.

## Browser-Local Draft

The mutable Create draft contains only presentation and request facts:

- selected media mode;
- selected task-specific Audio intent;
- current model contract, model, and resolved operation;
- structured `PromptTemplate` fields;
- operation-specific inline fields such as Music lyrics;
- normalized provider-neutral settings;
- ordered canonical Asset IDs assigned to semantic input slots.

The draft is keyed by the authenticated user and active organization, not by a
Flow or run. It may be recovered from same-tab storage after navigation or a
refresh. Opening or editing `/create` must not create a database row and must
not issue a graph-save request.

Asset uploads still create canonical Assets through the Asset system. Adding an
uploaded or existing Asset to the draft stores only its canonical identity and
display projection.

Model transitions first normalize all supported legacy input-slot aliases in
attachments and structured prompt parts. Only then may the resolver compute
unsupported inputs, capacity, or detachment. A compatible legacy occurrence
must never be dropped merely because its historical slot name changed.

## Direct Request Contract

`POST /runs/create` admits one direct generation command. Its bounded public
request contains:

- `mediaMode` and `audioIntent` when the mode is Audio;
- `modelContractVersion`, `modelId`, and `operationId`;
- `promptTemplates`;
- operation-specific `inline` text;
- provider-neutral `settings`;
- ordered `{ assetId, slotId }` input occurrences;
- `outputCount`;
- `fundingSource`;
- `executionRuntime`;
- `executionMode`;
- non-secret connected-provider identifiers only when browser execution needs
  eligibility selection.

Provider credentials and private provider bindings never enter this request.
Browser BYOK secrets stay in browser Secure Store.

The server independently:

1. authenticates the user and organization;
2. authorizes debug mode when requested;
3. validates the current public model contract;
4. derives the task-specific operation and readiness;
5. normalizes current and legacy semantic input slots;
6. validates prompt references and normalized settings;
7. locks referenced Asset rows in deterministic order;
8. verifies tenant ownership, processing state, purge state, media family,
   MIME type, size, duration, and current slot limits;
9. recompiles from the locked authoritative Asset facts;
10. applies shared active-run capacity policy;
11. resolves advisory cost with the existing cost router;
12. resolves and freezes one exact private provider binding;
13. persists one immutable run and its ordinary generation job;
14. dispatches through the selected existing runtime.

Admission uses the run domain's stable organization-scoped idempotency
boundary. Reusing a key with a different request is rejected. A retry clones
the immutable source and execution facts through the generic retry path rather
than reconstructing a mutable draft.

`POST /runs/create/estimate` accepts the same creative request shape and invokes
the same resolver, compiler, and cost router. Admission repeats validation and
cost resolution after Asset locks; a client estimate is never authoritative.

## Generic Run Source

Every new durable run has a source discriminator:

```ts
type RunSource =
  | {
      kind: 'flow'
      flowId: string
      flowRevision: number
      flowPlanHash: string
      graph: FrozenFlowSource
    }
  | {
      kind: 'create'
      request: FrozenDirectGenerationRequest
    }
```

A Flow run references a persisted Flow and freezes the exact graph evidence
used by DAG planning. A Create run has `flowId = null`, mode `direct`, and
source `create`.

The current immutable snapshot envelope contains:

```txt
source
executionPlan
executionContracts
executionMode
executionRuntime
catalog and executor compatibility facts
```

A Create source contains only the bounded direct request. It contains no Flow
node, edge, viewport, revision, graph closure, or synthetic graph data.

`ExecutionPlan` uses generic executable steps, prerequisites, levels, work
items, and canonical generation-job request shards. Workers receive this plan
without needing to know whether its source was Create or a Flow. Historical
Flow snapshots are hash-verified in their original form and normalized through
the strict snapshot reader. Malformed or unsupported snapshots fail closed.

The physical run tables remain shared. Existing historical names such as
`flowRuns`, `flowRunNodes`, and `generationJobs` are retained to avoid a second
run engine or destructive table replacement; new source-neutral runtime
contracts call executable units steps. No Create-specific task, planner,
executor branch, provider adapter, input materializer, output finalizer, job
table, or Asset ingestion path is allowed.

## Execution

Managed requests continue through the existing Trigger.dev Flow-run
orchestrator. The orchestrator schedules generic execution-plan dependencies,
aggregates ordinary durable step/item/job state, and invokes the existing
generation-job executor.

Browser requests receive the same server-admitted snapshot and private
execution contract, minus credentials. The browser coordinator materializes
the same canonical request, invokes the same browser-compatible provider
protocol, and reports lifecycle transitions through existing fenced APIs.

The generation-job executor, provider registry, provider adapters, accounting,
reconciliation, cancellation, output validation, finalizer, and canonical
Asset ingestion do not branch on Create versus Flow.

Every successful media output becomes a canonical Asset with immutable
generation provenance. A refresh hydrates completed outputs from durable run
and Asset state, never from the unsent local draft.

## History And Observation

`GET /runs?source=create` returns cursor-paginated direct history filtered by:

- active organization;
- authenticated creator;
- run source `create`;
- `flowId is null`.

Create history is not grouped by a session or Flow. Its newest page is a
separate refreshable query. Older pages are immutable, retained with a bounded
`maxPages`, and are not invalidated by ordinary realtime transitions, focus,
or reconnect.

`GET /runs/active` is a lean identity read: it does not load snapshots, jobs,
outputs, or signed media URLs. Run detail remains the explicit hydrated read.
Ordinary history reads select a bounded presentation projection, one
representative validated request, and at most the configured output-preview
limit.

Managed realtime tokens and browser manifests carry the run source. Completion
invalidates the exact newest Create-history prefix. Browser manifests also
retain nullable `flowId` for exact Flow history invalidation without pretending
a Create run owns one.

## Approved Interaction

The Create workspace preserves:

- Image, Video, and Audio mode selection;
- distinct Speech, Music, Sound Effect, Voice Changer, and Voice Isolation
  intents;
- catalog-driven model selection;
- model-adaptive settings and semantic Asset slots;
- Tiptap structured prompt mentions;
- upload and Asset-library attachment choices;
- advisory credit estimation;
- browser BYOK and managed runtime selection;
- authorized debug toggle;
- media-specific result presentation;
- cancel and retry actions;
- explicit result continuation into the next local request.

The composer is a clean command surface. A disabled Generate button is enough;
it uses a not-allowed cursor and does not add redundant red warning copy.
Audio results use a compact audio-specific playback row rather than an empty
image frame.

Create is deterministic direct generation, not general chat and not an
autonomous agent. The user explicitly controls the request and every
continuation.

## Route And Persistence Rules

- `/create` is the only Create route.
- `/create/:id` does not exist.
- Create does not call Flow create, graph batch-save, rename, delete, or clone
  endpoints.
- Flow list endpoints contain only ordinary Flows and have no surface filter.
- There is no `flows.surface` product contract.
- Deleting obsolete historical Create Flow identities during the forward
  migration must preserve durable runs, generation jobs, and canonical Assets
  through nullable Flow references.
- There is no Create-to-Canvas conversion contract.

## Security And Tenant Boundaries

- Every request is scoped by authenticated organization middleware.
- Direct history is creator-scoped in addition to tenant scoping.
- Asset reads and row locks include the organization.
- Provider-private bindings are resolved server-side and frozen only in the
  immutable private snapshot.
- Credentials never enter snapshots, database rows, logs, API responses, or
  Trigger payloads.
- Debug execution retains the existing system-administrator authorization.
- Browser executor claims and lifecycle writes retain existing fencing.

## Non-Goals

This feature does not add:

- conversations, agents, or tool use;
- server-side Create drafts;
- templates or reusable Create sessions;
- graph synthesis;
- Create-specific provider routing;
- new provider protocols;
- implicit conversion to a Flow;
- billing balances or credit enforcement.

Any future action that saves a Create request as a Flow is a separate product
decision and must define its own explicit user intent and provenance semantics.

## Acceptance Contract

The feature is acceptable only when:

1. opening and editing `/create` creates no Flow and sends no graph mutation;
2. Generate issues one direct admission request;
3. the run is source `create`, mode `direct`, and has `flowId = null`;
4. the snapshot contains a direct source and generic execution plan with no
   graph data;
5. direct and Flow generation use the same `compileGenerationJob()` function;
6. browser BYOK and managed debug execution use the existing fake-provider
   verification paths;
7. every referenced Asset is tenant-validated and locked;
8. Image, Video, Speech, Music, and Sound Effect requests compile;
9. estimate and admission produce the same canonical job shape;
10. cancellation, retry, realtime recovery, accounting, finalization, and
    canonical Asset ingestion remain shared;
11. outputs hydrate after refresh;
12. Create history is cursor-paginated, creator-scoped, and bounded;
13. Canvas planning and browser/managed snapshot parity remain unchanged;
14. no Create identity appears in the Flow library;
15. compatible legacy input aliases survive model-contract upgrades.
