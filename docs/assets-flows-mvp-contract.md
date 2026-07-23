# TaleLabs Assets + Flows MVP Contract

**Status:** active source of truth, updated 2026-07-22.

This document defines the product boundary until the first sellable creative
loop is validated. It supersedes every older requirement that makes Elements a
dependency of the canvas, graph, mocked execution, provider integration, or
MVP navigation.

## Product Boundary

The MVP has three durable product entities and two creation surfaces:

```txt
Assets   = canonical reusable media
Flows    = editable creative documents and the spatial execution graph
Elements = optional ordered image-reference collections

Create = browser-local direct Image, Video, and Audio generation
Canvas = spatial editing of an ordinary Flow
```

The product loop is:

```txt
find or upload an Asset
-> place it in a Flow
-> connect it to model-adaptive creative nodes
-> admit an immutable run
-> execute through deterministic provider mocks
-> store mocked media outputs as canonical Assets
-> integrate real providers
-> store every successful media output as an Asset
-> reuse that Asset in another step
```

The primary creative navigation is:

```txt
Create
Flows
Assets
Elements
```

`Create` is a direct-generation playground organized into lightweight durable
sessions. A session is only a stable route and history grouping identity; it is
not a graph document. The unsent mutable draft is recovered from browser-local
same-tab storage keyed by session. Create has no Flow identity, node, edge,
graph revision, graph autosave, or implicit conversion into Canvas.

Create and Flows share generation compilation and execution, not editable
document persistence. Create persists session identity and durable runs; Flows
persist spatial graphs.
Create validates one direct request and invokes the same provider-neutral
generation-job compiler used by the Flow planner after DAG resolution. Both
produce a generic immutable execution plan, execute through the same browser or
managed drivers, and ingest outputs as canonical Assets. Create owns no Flow
projection, planner, Trigger task, generation-job executor, provider adapter,
input materializer, output finalizer, or result format.

## Elements Are Active

The simplified Elements feature was approved on 2026-07-18.
An Element is a named, ordered collection of up to 8 reference image Assets
with a presentation-only kind label (`character`, `prop`, `location`, `style`,
`other`) and an optional description. Its Flow node exposes exactly one
`references → ImageSet` output; run admission expands it to exact Asset IDs so
snapshots stay Asset-only and Trigger/provider layers remain untouched.

`docs/elements.md` is the binding Element design. The retired
multi-role/consistency Element architecture (typed schemas, asset roles,
source/master kinds, readiness, custom roles, reference budgets, multi-output
nodes) was deleted with its data in migration `027_reset_elements` and must
not return without a new explicit product decision.

Elements remain optional accelerators: every Flow must stay fully usable with
raw Assets connected directly to generation nodes.

## Active Flow Node Families

MVP inputs:

```txt
Text
Asset
Element
prior node output
```

MVP creative nodes:

```txt
LLM
Image Generation
Video Generation
Speech
Music
Sound Effect
Voice Changer
Voice Isolation
```

One creative intent may adapt to several provider models. Model capabilities
control visible handles, compatible media, connection limits, settings,
operation selection, conflicts, and readiness. Users choose a model and create;
they do not choose provider operation IDs.

## Asset Contract

Assets are the only reusable media source in the MVP.

- Uploaded and generated media use the same canonical Asset record.
- Generated image, video, and audio outputs are automatically organized under
  `Flow/<Flow name>`. Ordinary uploads keep the folder explicitly chosen by the
  user and are never moved merely because they were uploaded from the canvas.
- Asset visibility is a durable write-time fact. Ordinary uploads and reference
  Assets are `private`; under the temporary pre-billing policy, newly generated
  image, video, and audio outputs are `public`. Existing Assets are not
  reclassified or published.
- Public storage only makes an output eligible for future public delivery or
  showcase consideration. Featuring, moderation, and gallery approval remain a
  separate future decision; no public output is automatically showcased.
- Asset nodes store one canonical Asset ID, never a signed URL or file copy.
- Signed URLs are short-lived presentation data and are never persisted in a
  Flow.
- An Asset output remains a typed collection (`ImageSet`, `VideoSet`, or
  `AudioSet`) even when it contains one item.
- A consumer node applies its selected model's combined item limit across all
  connected sources.
- Provider outputs become Assets before downstream nodes consume them in a real
  run.

## Canvas Contract

React Flow owns interaction and rendering only. TaleLabs owns graph semantics,
validation, persistence, planning, and execution.

The canvas must provide:

```txt
typed named handles
model-adaptive inputs and settings
connection validation
node selection and inspectors
stable node and edge IDs
revision-based autosave
refresh-safe graph hydration
deterministic ordering
mock output states for product QA
```

The engine-approved execution commands are:

```txt
Run node       = execute only one target executable node
Run from here  = execute the target and its executable descendants
Run till here  = execute the target and its executable ancestors
Run selection  = execute selected executable nodes only, reusing prior upstream outputs
Run all        = execute every executable node in the Flow
```

Command placement (user decision 2026-07-19 — supersedes the earlier floating
node toolbar): there is no per-node floating toolbar. `Run node` and the
`Run from here` / `Run till here` dropdown live in the node's output footer as
a compact run control. Output commands (download, crop, copy, add to Element,
fullscreen) are hover actions on the node's media preview, also revealed by
selection and keyboard focus. Delete, lock, and Element switching live in the
node context menu. `Run selection` belongs in the selection context menu and is
available only when the selection contains at least one executable node. Text
and Asset nodes
contribute immutable inputs but do not create jobs. Connecting nodes never
starts execution automatically. `Run all` remains supported by planning,
admission, snapshots, and execution for future Tools or another explicitly
approved workflow, but the normal canvas exposes no Run All action and requests
no whole-Flow cost estimate.

## Build Sequence

### Phase 1 - Asset foundation

Keep the existing media-aware Asset library stable: upload, background
processing, folders, search, tags, favorites, visibility-aware delivery, detail view,
drag/drop organization, and global upload progress.

### Phase 2 - Canvas and node UX (approved)

Finish the Flow editor and every model-adaptive node family. Inputs are real
Assets and Text nodes. Outputs are deterministic mocks. No external generation
request, credit charge, or production run orchestration belongs here.

The user approved the adaptive generation-node designs on 2026-07-14. M5 kept
the normalized provider boundary explicit; M6 now implements the approved real
routes at that boundary without changing graph or output semantics.

### Phase 3 - Provider-independent durable run engine

Build the production-shaped run spine with immutable snapshots, deterministic
planning, Trigger.dev orchestration, mock provider adapters, canonical output
Assets, multiple outputs, status/history, retry, and cancellation. Preserve the
typed runtime-item seam for future iteration, but do not add Iterator/Map,
Collect, Zip, or Prompt Iterator nodes during the MVP. Real provider calls and
provider charges are forbidden.

### Phase 4 - User run QA

The user owns browser QA, interaction critique, visual consistency, and final
run-behavior approval. Passing engineering gates does not complete this phase.

### Phase 5 - Real provider loop (M6)

Integrate the approved narrow vertical slices:

```txt
admit one generation node
-> snapshot its reachable inputs
-> dispatch durable work
-> normalize provider status and output
-> ingest output through the canonical visibility-aware storage policy
-> create canonical Asset
-> expose result on the node
```

`packages/models-catalog` is the single current generation catalog. Its
`catalog.json` metadata and explicit `models/<media>.json` records are assembled
and validated as one catalog. Its sanitized projection drives public capabilities, while admission resolves
and captures one complete private provider binding. Every active operation must
have a compatible binding; startup, catalog checks, and production builds fail
closed on drift. Workers execute the captured binding directly and never
reconstruct a route from current catalog state. See
`docs/m6-real-provider-integration.md`
for provider-boundary and user-owned paid-QA requirements without duplicating
the code-owned model inventory here.

## Persistence And Compatibility

- Flow graphs remain normalized in `flows`, `flowNodes`, and `flowEdges`.
- Create drafts never enter those tables. `/create` is a new local draft and
  `/create/:sessionId` reopens one durable history grouping. First Generate
  creates the session and run atomically. The session contains no graph.
- Durable runs have a discriminated `flow | create` source. A Create run has
  `flowId = null`, a required `createSessionId`, mode `direct`, a bounded frozen
  request, and the same generic execution plan consumed by Flow runs.
- Flow browsing has no Create surface filter, and there is no Create-to-Canvas
  clone or conversion contract.
- `flowNodes` has no Element foreign key in the active schema.
- A cleanup migration removes legacy Element nodes and their incident edges;
  standalone Element records and Assets are not deleted.
- Flow revision compare-and-swap remains the autosave concurrency boundary.
- Released generation model contracts remain immutable and resolvable by
  version.
- Newly created nodes use only the current curated model contract.

## MVP Acceptance

The approved MVP foundation gate that enabled the active real-provider phase
required a user to be able to:

1. Upload or locate an Asset.
2. Create and reopen a Flow.
3. Add Text and Asset nodes.
4. Add every approved creative node family.
5. Connect only compatible inputs.
6. Switch models and see handles/settings adapt predictably.
7. Produce deterministic mocked output without losing graph state.
8. Navigate away and return without corrupting the Flow.

No Element creation, Element node, Element context, or Element consistency
workflow is required to pass this gate.
