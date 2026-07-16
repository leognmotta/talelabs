# TaleLabs Assets + Flows MVP Contract

**Status:** active source of truth, updated 2026-07-14.

This document defines the product boundary until the first sellable creative
loop is validated. It supersedes every older requirement that makes Elements a
dependency of the canvas, graph, mocked execution, provider integration, or
MVP navigation.

## Product Boundary

The MVP has two product entities:

```txt
Assets = canonical reusable media
Flows  = visual creative documents
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

The primary navigation is exactly:

```txt
Flows
Assets
```

## Elements Are Deferred

Elements are not part of the MVP. They must not appear in:

```txt
navigation
dashboard routes
global search
the node picker
Flow node types
Flow graph request or response schemas
Flow reference hydration
graph validation
mock planning or execution
provider payload planning
new run snapshots
MVP acceptance criteria
```

Existing standalone Element tables, API modules, SDK endpoints, and historical
research may remain dormant. Preserving that work is not permission to expose
or extend it. Active product code must not import Element data to make an Asset
or Flow operation succeed.

Historical generation contracts may retain `ElementContext` so persisted
snapshots remain readable. The current generation catalog and newly created
nodes must not expose an Element-context input.

Reintroducing reusable context requires a new explicit product decision after
the Asset-to-Flow generation loop works with real providers. It is not an
implicit next task.

## Active Flow Node Families

MVP inputs:

```txt
Text
Asset
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

The approved execution commands are:

```txt
Run node       = execute only one target executable node
Run from here  = execute the target and its executable descendants
Run till here  = execute the target and its executable ancestors
Run selection  = execute selected executable nodes only, reusing prior upstream outputs
Run all        = execute every executable node in the Flow
```

`Run all` belongs on the main canvas action bar. `Run selection` belongs in the
selection context menu and is available only when the selection contains at
least one executable node. Text and Asset nodes contribute immutable inputs but
do not create jobs. Connecting nodes never starts execution automatically.

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

The active TypeScript generation-model registry is the public catalog, and
`GENERATION_PROVIDER_ROUTES` is the single private execution-routing source.
Every active model operation must have exactly one compatible route; startup,
generation checks, and production builds fail closed on missing, duplicate, or
incompatible routes. Historical model and route contracts remain readable for
durable retry, but no secondary availability field or runtime fallback decides
whether a current model executes. See `docs/m6-real-provider-integration.md`
for provider-boundary and user-owned paid-QA requirements without duplicating
the code-owned model inventory here.

## Persistence And Compatibility

- Flow graphs remain normalized in `flows`, `flowNodes`, and `flowEdges`.
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
