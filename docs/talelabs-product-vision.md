# TaleLabs Product Vision

This document is the source of truth for what TaleLabs is trying to become and what the first sellable product loop must prove. Read it before planning product work, designing UI, creating database models, defining APIs, or integrating AI providers.

> **Active MVP boundary:** read `assets-flows-mvp-contract.md` first.
> Elements are active; `docs/elements.md` is the binding Element design.

This document defines product direction and scope. It intentionally does not prescribe the database schema or API contract. Those documents must be redesigned separately after this vision is accepted.

## What TaleLabs Wants To Be

TaleLabs is a visual AI creative workspace for generating, organizing, and reusing media.

The product is not a generic directory of AI models and it is not initially an end-to-end video editor. Models are execution engines inside a visual creative process. TaleLabs should become the place where creators can collect references, preserve reusable context, connect creative steps, generate media, and continue iterating from previous outputs.

The active product loop is:

```txt
Create or Flows -> Generated Assets -> Assets -> Continued Iteration
```

The first sellable foundation is built around two primary product entities:

```txt
Assets
Flows
```

Each entity has one clear responsibility:

```txt
Assets = media the user owns and can reuse
Flows  = ordinary editable graphs and the visual environment for advanced work
Create = lightweight sessions for direct Image, Video, and Audio generation
```

Elements are the third product entity since 2026-07-18: named, ordered
collections of reference image Assets that accelerate reuse without ever
blocking the Asset-to-Flow generation loop.

The adaptive canvas, generation-node UX, and provider-independent M5 run engine
were approved on 2026-07-14. The active product goal is M6 provider-integration
verification: execute pinned OpenRouter routes through the approved durable run
engine, settle provider work safely, and persist every retained output as a
canonical Asset before user-owned paid acceptance.

## Product Navigation

The creative navigation is deliberately narrow:

```txt
Create
Flows
Assets
Elements
```

The root redirect remains `/flows`; adding Create does not silently change an
existing user's entry route.

## Build Order

The implementation order is:

```txt
1. Assets
2. Canvas foundation
3. Model-adaptive Video Generation node
4. Model-adaptive Image Generation and LLM nodes, followed by dedicated Speech,
   Music, Sound Effect, Voice Changer, and Voice Isolation nodes
5. User-approved adaptive canvas and node UX (complete)
6. Provider-independent durable run engine with deterministic mock adapters
7. User-owned run UX and end-to-end QA
8. Real provider integration
9. Billing and credits only after the creative loop is proven
```

Create is the lowest-friction path to one useful Asset. Flows remain the
advanced product experience and long-term differentiator. Assets come
first because every reference, generation input, and generation output depends
on a trustworthy media system. Generation-node UX comes next because it defines
the actual creative contract the later run engine and provider adapters must
execute.

M5 is approved. M6 OpenRouter integration is active under the verification and
paid-acceptance gates in `docs/m6-real-provider-integration.md`.

Image Generation is one dedicated, model-adaptive canvas node. The user selects
a curated TaleLabs model, not a provider operation: no selected image reference
means text-to-image, while one or more selected runtime image items means
image-to-image. The model contract controls whether the `imageReferences`
handle exists, its item limit, and visible settings. The approved Image canvas
contract fixes each generation to one image and therefore exposes no output
amount control. The result still travels through one stable `images` handle as
an `ImageSet`, preserving the typed collection boundary without implying Flow
iteration. The initial picker is deliberately smaller than external model
discovery. New runs capture a complete immutable provider binding;
deterministic mocks remain an offline verification seam rather than a historical
route catalog.

LLM is one dedicated, model-adaptive text-output node. It consumes a required
prompt, optional system instructions, and up to eight images when the selected
model supports vision. Image presence derives `visionToText`; absence derives
`textToText`. The approved M4 preview remains ephemeral; the durable M5 engine
and current M6 routes persist results without writing truth into mutable node
data.

Audio is one output media family but not one creative intent. TaleLabs exposes
five dedicated model-adaptive nodes: Speech, Music, Sound Effect, Voice Changer,
and Voice Isolation. Model operations carry an authoritative node-intent tag,
so one provider-neutral product model may appear in more than one compatible
picker without appearing in unrelated ones. Users never choose a native
operation. All five nodes emit one typed `AudioSet` through stable handle
`audio`; their inputs, settings, and readiness remain intent-specific. Historical
M5 snapshots retain deterministic adapters; active supported operations use M6
routes and the same canonical Asset ingestion path.

## Core Technology Choices

The initial Flow product is built around two primary tools with separate responsibilities:

```txt
React Flow  = visual graph and node interaction
Trigger.dev = durable asynchronous execution of generation nodes
```

### React Flow

Use React Flow (`@xyflow/react`) to build the Flow canvas.

React Flow is responsible for:

```txt
rendering nodes and edges
node positioning and selection
connecting compatible handles
canvas pan and zoom
adding, moving, duplicating, and deleting nodes
visualizing branches and creative provenance
future collaboration integration
```

React Flow is a UI and graph-interaction library. It is not the source of truth for generation jobs, billing, Assets, permissions, or provider execution. The TaleLabs application must persist and validate the graph through its own domain and API boundaries.

### Trigger.dev

Use Trigger.dev as the durable background job runner for generation nodes and other long-running media operations.

Trigger.dev is responsible for:

```txt
queued generation execution
long-running provider calls and polling
retries and failure handling
concurrency and queue limits
idempotent task dispatch
cancellation
execution observability
realtime run-status updates
output ingestion work that should not block the API request
```

The first execution boundary is:

```txt
User clicks Run node
-> TaleLabs API authenticates and validates
-> API resolves and snapshots connected context
-> API creates the generation job
-> API triggers one Trigger.dev task and returns immediately
-> Trigger.dev executes that one generation job
-> successful output is persisted as an Asset
-> the Flow node receives the resulting Asset reference
```

Trigger.dev durably supports five explicit engine commands: Run node, Run from
here, Run till here, Run selection, and Run all. The normal canvas exposes the
first four; Run all remains reserved for future Tools or another explicitly
approved workflow. Connecting nodes never starts execution. Run selection
executes only the chosen executable nodes and reuses compatible prior upstream
results, avoiding unexpected regeneration and spend.

Short deterministic operations remain in the TaleLabs API, including graph persistence, connection validation, input previews, cost estimates, signed-upload creation, and ordinary Asset updates.

## Assets

Assets are the canonical media records in TaleLabs. Every uploaded file and every successful generation output becomes an Asset.

Successful image, video, and audio node outputs are organized automatically in
the Asset library under `Flow/<Flow name>`. This is an output-materialization
rule only: ordinary uploads remain in the folder chosen by the user, including
uploads initiated from the Flow canvas.

Asset visibility is captured durably when the Asset is created. Direct uploads
and reference Assets remain private. Until billing can identify the funding
source, every newly generated image, video, and audio output uses the temporary
public-storage policy; existing Assets are never backfilled or published. The
future billing decision replaces that temporary policy by choosing visibility
from the funding source, without changing the canonical Asset lifecycle.

Public storage and showcase featuring are different contracts. A public Asset
may later be considered for a showcase, but it is not automatically featured,
moderated, or approved for a landing-page gallery. Before M6 release, free and
promotional generation must have clear localized disclosure that its outputs
may be public. The disclosure UX itself is not part of this storage task.

Assets are the first and most important implementation foundation. The asset experience should feel like a lightweight, media-aware drive rather than a social gallery.

Initial asset types should support:

```txt
image
video
audio
text or document when needed by Flows
```

The first useful asset-management system should support:

```txt
direct upload
folders
search
media-type filtering
workspace tags and tag filtering
per-user favorites and favorite filtering
grid and list presentation
preview and playback
technical metadata
rename
move between folders
download
archive or soft delete
permanent deletion with explicit confirmation
cursor pagination
reusable asset selection
generated-output ingestion
```

Assets must be globally available within the user's workspace. They are not owned exclusively by a Flow; one Asset may be referenced by many Flows and nodes.

Every generated Asset should preserve useful provenance:

```txt
source: upload | generation
media type
storage reference
model and provider
generation settings
resolved prompt or instructions
input asset references
generation job
creator
created date
```

The Asset picker is a core shared component. Every Flow node that needs existing media should use the same canonical picker rather than creating another media library.

Tags are lightweight workspace organization shared by workspace members. Favorites are a personal view for each user within a workspace. Neither changes Asset ownership, visibility, or provenance, and both belong to the canonical Asset library and picker rather than separate media collections.

The initial asset system should not expand into a complete Google Drive replacement. Defer public galleries, public links, complex permissions, review workflows, advanced versioning, and elaborate taxonomies beyond simple tags until real usage demonstrates a need.

## Elements

**Active since 2026-07-18.** The binding design is `docs/elements.md`. The earlier detailed Element
architecture that previously lived in this section (typed schemas with
versioned migrations, per-role asset kits, source/master reference kinds,
readiness derivation, custom roles, reference budgets, and the multi-output
Element node) was implemented, judged too complex to use, and deleted with its
data by migration `027_reset_elements`. Do not reintroduce it.

An Element is a named, ordered collection of reference image Assets — a
character, a prop, a location, a style — saved once and reused in any Flow:

```txt
name          "Maya", "Acme Bottle", "Neo-Tokyo Alley"
kind          character | prop | location | style | other   (label only)
description   optional prose; not sent to providers
references    1–8 ordered image Assets; the first is the cover
```

Kinds are presentation only: they choose an icon and a library filter and
never change validation, forms, or behavior. All Elements share one dialog,
one API shape, and one node contract.

On the canvas an Element is one node with exactly one output:

```txt
Character: Maya                       Image Generation
┌───────────────────┐                ┌────────────────────────┐
│ [img][img][img]+3 │                │ image references       │
│ 6 references   ● ─┼───────────────►│ prompt                 │
└───────────────────┘                └────────────────────────┘
        references → ImageSet
```

The output is the same `ImageSet` value an image Asset node emits, so it
connects everywhere Assets already connect. Model input limits and the
auto/manual selection inspector are owned by the consuming generation slot,
exactly as with multiple raw Asset sources. Run admission expands the Element
to its exact ordered Asset IDs inside the immutable snapshot, so later Element
edits never rewrite an admitted run.

Elements are optional accelerators. A user must still be able to connect raw
Assets directly to a generation node without first creating an Element.

## Create And Flows

Create is a direct-generation playground split into lightweight durable
sessions. A session provides a stable route, user-authored name, and
creator-scoped run history. It is not an editable document: the unsent request
is recovered from browser-local same-tab storage keyed by session, while the
server stores no Create draft, Flow identity, graph, revision, or autosave.
There is no implicit conversion into Canvas.

Flows are the advanced spatial creative surface. Their persisted graphs own DAG
selection, topology, dependency planning, and multi-step authoring.

Create and Flows share generation compilation and execution, not editable
document persistence. Create persists only session identity and durable run
history; Flows persist graphs.
After validating current-catalog request facts, Create calls the same
provider-neutral generation-job compiler that the Flow planner calls after
resolving graph dependencies. Both produce the same generic execution-plan and
immutable job contracts, use browser or managed execution, reuse provider
adapters and output finalization, and ingest canonical Assets. The execution
stack does not know whether a job originated from Create or a Flow.

Create provides Image, Video, and task-specific Audio generation,
model-adaptive controls, exact `PromptTemplate` media references, durable run
and result history, and explicit continuation into its next local request. It
is deterministic direct generation, not general chat or an autonomous agent.
`docs/feature-research/direct-ai-asset-creation.md` is the detailed approved
interaction and delivery contract.

The canonical technical model for Flow handles, runtime values, reference sets,
batch items, lineage, generation execution, iteration, full-flow orchestration,
caching, Recipes, and Tools lives in `docs/flow-nodes-planning.md`. Flow work
must preserve that document's distinction between collections consumed together
and runtime items that multiply execution.

A Flow is a visual document built with React Flow. Users connect prompts, Assets, prior outputs, and AI generation nodes to explore ideas, preserve creative provenance, branch into alternatives, and reuse previous outputs.

The first Flow experience is a manual visual creative process. It is not an automation engine.

The engine-foundation node set should remain narrow by purpose, while covering
the three media types TaleLabs intends to execute through one runtime:

```txt
Text or Prompt node
Asset node
Image Generation node
LLM node
Video Generation node
Speech Generation node
Music Generation node
Sound Effect Generation node
Voice Changer node
Voice Isolation node
```

All dedicated generation-node surfaces and their model capability rules are built
before external provider integration. Utility and control nodes should come from
demonstrated needs rather than speculative completeness. Explicit iteration nodes
remain deferred until real workflow usage demonstrates that need.

The first Flow version should support:

```txt
create and rename a Flow
add, move, connect, duplicate, and delete nodes
autosave graph state
select Assets
configure a generation node
run one selected generation node manually
run a downstream branch or complete Flow when explicitly requested
resolve compatible connected inputs
show queued, running, succeeded, and failed states
persist successful output as an Asset
place or expose the output in the Flow
connect an output to another generation node
branch and remix without losing earlier results
preserve generation history and provenance
```

All execution remains explicit and manual:

```txt
Run node       = only the target node
Run from here  = target plus descendants
Run till here  = target plus ancestors
Run selection  = selected executable nodes only, reusing prior upstream outputs
Run all        = every executable node (engine support; hidden on normal canvas)
```

The node footer owns the first three commands. `Run selection` belongs in the
selected-node context menu. `Run all` remains supported by the planner,
snapshots, and executor for future Tools, but the normal canvas displays no
Run All action and does not request a whole-Flow estimate. Connecting nodes
never starts execution by itself.

Do not build the following into the first Flow engine:

```txt
triggers
schedules
webhooks
conditional nodes
external integrations
general-purpose automation
```

The engine milestone preserves typed items, dimensions, and lineage as a future
iteration seam, but does not add Iterator/Map, Collect, Zip, or Prompt Iterator
nodes. Arbitrary scripting, hidden batch matrices, triggers, and general-purpose
automation remain deferred.

### Simple Flows

The canvas must not require complexity for simple creation. A Flow containing one prompt and one generation node is a valid first-class Flow.

The product should make this path quick:

```txt
New Flow -> enter prompt -> choose model/settings -> run node -> receive Asset
```

Users can progressively add Assets, prior outputs, and branches when their creative process becomes more complex.

## First Sellable Product Loop

The first sellable loop is:

```txt
Upload or find an Asset
-> create or open a Flow
-> add Text, Asset, and Generation nodes
-> connect the required context
-> execute the graph against deterministic provider mocks
-> process the job asynchronously
-> save the output as an Asset
-> reuse the output in the same or another Flow
-> replace only the provider adapter with a controlled real integration
```

The loop is not complete if generation results are temporary, if outputs cannot be found again, or if the user must re-upload the same references for every generation.

The canvas loop was validated with deterministic image, video, text, and audio
previews before any paid generation request. M5 now makes planning, snapshots,
runs, jobs, provenance, output ingestion, and canonical Assets production-shaped
while keeping only the normalized provider adapter deterministic and mocked.

## Generation Principles

Model choice belongs inside generation nodes. Power users should be able to choose a supported model and compatible settings, but provider terminology should not dominate the creative experience.

### Model-Adaptive Generation Nodes

Generation nodes follow a stable creative intent. Image, Video, and LLM each
have a dedicated output-family surface; audio deliberately splits into Speech,
Music, Sound Effect, Voice Changer, and Voice Isolation because those intents
have different inputs and request shapes despite sharing `AudioSet`. Users
choose a model and connect creative inputs; they never choose a provider operation such as
text-to-video, image-to-video, reference-to-video, or audio-to-video. The model's
curated contract determines which semantic handles exist, and one shared pure
resolver derives the concrete operation from the connected inputs for graph
validation, planning, routing, snapshots, and provenance.

Unsupported inputs are absent. Model-supported inputs that conflict with the
current connection family remain visible but disabled with a localized reason.
For routes where frame inputs take precedence over references, TaleLabs makes
the frame and reference families mutually exclusive instead of silently sending
inputs the provider would ignore. Changing models preserves compatible
connections and settings and applies the reconciled graph and derived operation
atomically. Every generation node reconciles immediately, including LLM and
audio nodes. The user's model selection is the confirmation: incompatible
connections, selections, and settings may be removed or reset without a modal
or notification, and Undo restores the previous graph state in one step.

Video nodes use stable semantic handles: `prompt`, `firstFrame`, `lastFrame`,
`imageReferences`, `videoReferences`, `audioReferences`, and output `videos`.
The inline video prompt is preserved in node data. When an external Text edge is
connected to `prompt`, that text is authoritative and the inline editor is
disabled; TaleLabs never silently concatenates both sources.

LLM nodes use stable semantic handles: `instructions`, `prompt`, optional
`imageReferences`, and output `text`. Connected prompt or instructions are
authoritative while the corresponding inline draft remains preserved. The
selected curated model controls vision support and the exact response-length
and reasoning options; provider parameters, native model IDs, prices, and raw
reasoning traces do not belong on the canvas.

The first approved loop is Asset-driven and deterministic-provider-mocked.
Elements do not shape Video Generation readiness or input presentation in this
phase. Real provider integration begins only after user-owned canvas UX approval.

The node UI should expose only controls supported by the selected model, such as:

```txt
reference input count
aspect ratio
resolution
duration
first or last frame
audio support
quality
seed
other verified model capabilities
```

Provider documentation informs reviewed implementation decisions, but TaleLabs
owns one curated, checked-in model catalog assembled from explicit JSON media
files for enabled models, labels, defaults, operations, typed slots,
cross-field constraints, and private provider bindings. The runtime-validating
`@talelabs/models-catalog` package exposes a
sanitized public projection and exact admission-time binding lookup. TaleLabs
does not maintain parallel TypeScript route registries, provider discovery
snapshots, or dated inventories, and live provider responses never control
production UI or validation.

Flows persist canonical `vendor/model` creative identities. Public capabilities are shared
between the API and dashboard, while provider model IDs, endpoint pinning,
fallbacks, credentials, negotiated costs, and routing policy remain server-only.
TaleLabs may replace OpenRouter with a direct route for the same underlying model
without migrating Flows. A materially different creative model receives a new
canonical model ID rather than silently changing existing semantics.

Capabilities must describe internal generation operations and dependent
constraints, not only independent controls. Examples include text-to-video versus image-to-video,
first/last-frame requirements, reference-image limits, resolutions that force a
specific duration, mutually exclusive inputs, and operation-specific audio
contracts such as TTS versus sound effects.

Generation must remain server-authoritative. The server resolves connected
context, validates compatibility, calculates the current advisory provider-cost
estimate for Credits-funded managed runs, records immutable job inputs and quote
evidence, calls the provider, and ingests successful outputs into Assets. This
pre-billing estimate is not a credit balance, reservation, charge, or enforcement
system.

The provider adapter boundary supports both immediate results and asynchronous
jobs. Images may complete immediately or stream, videos commonly submit and
poll/webhook, and audio may return or stream raw bytes. Trigger.dev owns durable
polling, reconciliation, retries, cancellation, and ingestion without creating a
separate execution engine per media type.

External provider protocol behavior lives in the browser-compatible
`@talelabs/providers/core`, while managed execution uses the small private
registry in `@talelabs/providers/server`. The server registry dispatches the
exact binding captured at admission and resolves provider credentials only as
non-serializable runtime services. Credentials never enter model bindings,
snapshots, jobs, task payloads, logs, or public configuration. The explicit
`/browser` entry point is the provider boundary for the approved browser-local
BYOK runtime. Browser execution is implementation-pending and must reuse server
admission, canonical planning, immutable snapshots, persisted jobs, and
canonical output Assets. It must not introduce browser-owned graph semantics or
claim managed durability. Its binding implementation and approval matrix are
defined in `docs/browser-execution-mode-execution-plan.md`.

Local BYOK, managed platform execution, and future managed BYOK follow the
trust-boundary contract in `docs/provider-execution-modes.md`. In particular,
Trigger.dev must never receive a user-owned provider credential in managed BYOK;
a future thin TaleLabs Provider Gateway performs only credential-bearing
provider operations while Trigger.dev continues to own durable orchestration.

### Multi-Source Generation

Generation nodes must support several connected sources without introducing an
Element abstraction. A source may be:

```txt
Text node
Asset node
compatible output from another Flow node
```

Multiplicity has two distinct meanings:

```txt
one consumer input may receive a typed collection consumed together
one upstream iterator or multi-output run may create multiple runtime items
```

Do not conflate a collection of image references with repeated execution. The
selected model contract determines accepted media, connection limits, combined
item limits, mutually exclusive input families, and payload order.

Resolution follows this sequence:

```txt
collect connected Text, Asset, and prior-output sources
-> resolve canonical ready Asset records
-> apply deterministic edge and item ordering
-> validate the selected model operation and limits
-> apply automatic or explicit item selection where required
-> show exclusions and input-limit errors
-> snapshot exact submitted text and Asset IDs during future run admission
```

Future execution records preserve both the connected source lineage and the
exact subset submitted to the provider. Later edits to a Flow or Asset must not
rewrite historical inputs.

Multi-source input is separate from iteration, batch generation, multiple
outputs, and run-all execution. Those runtime semantics must remain explicit.
## Workspace Scope

Assets and Flows belong to a user workspace or organization boundary. Tenant isolation is required for every read, write, selection, generation input, storage operation, and realtime room.

The MVP does not need a separate Project entity. A Flow is the primary creative document, and folders organize Assets. Do not introduce Projects as an additional organizing layer until user behavior proves that Flows and folders are insufficient.

## Collaboration

Realtime collaboration is a later enhancement, not part of the initial billable loop.

Flow architecture should use stable node and edge identifiers so collaboration can be added later without redesigning the graph. When implemented, collaboration should distinguish:

```txt
durable shared state: nodes, edges, positions, compatible node data
ephemeral presence: cursors, selections, active dragging, connected users
server state: generation jobs, Assets, billing, permissions
```

Do not add a collaboration provider before the single-user Flow experience is proven.

## Later Product Layers

Later features must extend the core entities rather than bypass them.

### Recipes

A `Recipe` is a reusable, transparent collection of Flow nodes and their internal connections. A Recipe may represent a complete starter Flow or a smaller graph fragment that can be inserted into an existing Flow.

Internally, the domain may use an explicit name such as `flowTemplate` or `graphTemplate`, but the product language is:

```txt
Flow   = a working creative graph
Recipe = a reusable graph template that can create or extend a Flow
```

Any Flow should eventually expose Recipe actions at two levels:

```txt
Save Flow as Recipe      = capture the complete reusable graph
Save Selection as Recipe = capture selected nodes and their internal edges
```

Recipe scopes are:

```txt
Workspace = available only to members of the current workspace
Community = publicly discoverable and reusable by TaleLabs users
```

Creating a Recipe should capture:

```txt
node types and positions
edges between captured nodes
reusable node configuration
placeholder prompts and instructions
recommended models and settings
input requirements
intended creative outcome
title, description, preview, and author metadata
explicitly included example references when allowed
```

A Recipe should not include transient execution state by default:

```txt
generation runs
queued or running jobs
private output history
credit and billing information
provider credentials
temporary errors or progress
collaborator presence
```

A Recipe has two primary consumption paths:

```txt
Start new Flow = create a new Flow initialized with the Recipe graph
Add to Flow    = insert the Recipe graph into an existing Flow
```

Both paths produce an independent working copy. Later edits to the source Flow or Recipe must not silently modify Flows that already use it.

When a Recipe is added to an existing Flow, TaleLabs should:

```txt
clone every imported node with a new node ID
clone internal edges with new endpoint IDs
preserve relative node positions
place the imported group around the user's insertion point
preserve compatible reusable configuration
leave required external inputs visibly unresolved
never overwrite existing Flow nodes or edges
```

Only edges whose source and target nodes are both part of the Recipe are imported automatically. Connections to nodes outside the captured selection become explicit unresolved inputs or outputs rather than broken references.

Workspace Recipes may intentionally reference Assets and Elements available within that workspace. Community Recipes must never leak private workspace data. Before community publication, TaleLabs must require a review step that converts private Asset and Element references into placeholders, removes them, or includes only references explicitly approved and licensed for public use.

The Recipe library should eventually support:

```txt
Workspace Recipes
Community Recipes
```

Users should be able to:

```txt
save an entire Flow as a Recipe
save selected Flow nodes as a Recipe
choose workspace or community scope
preview the reusable graph before publishing
create a new Flow from a Recipe
add a Recipe to an existing Flow
duplicate a Recipe into their workspace
publish a new Recipe version later
unpublish a community Recipe without deleting derived Flows
```

Examples could include:

```txt
Character Expression Study
Product Hero Variations
Background Replacement
Image To Cinematic Shot
Consistent Location Study
Storyboard Frame Exploration
```

Recipes should be implemented before Tools because they reuse visible graph state without requiring nested graph execution.

### Tools

A `Tool` is an executable Flow packaged as one composite node with a declared input and output contract.

```txt
Recipe = visible graph copied into a Flow and edited freely
Tool   = internal graph executed behind one reusable node
```

Users should eventually be able to build a Tool from a tested Flow:

```txt
build and test the internal Flow
-> choose which values or nodes become public inputs
-> choose which internal outputs become public outputs
-> name and type each input and output port
-> choose which settings remain configurable
-> test the packaged execution
-> publish a versioned Tool
```

The Tool identity and its published versions have different mutability rules:

```txt
Tool                = editable product identity and metadata
Tool draft          = an ordinary editable normalized Flow
ToolVersion         = immutable published executable contract
Tool invocation     = a run pinned to one resolved ToolVersion
```

Creating a Tool provisions or links an editable draft Flow. Users continue to
edit and test that draft through the normal Flow editor. Publishing captures the
draft's coherent Flow revision, declared ports, exposed settings, and static
context into a new immutable ToolVersion. Editing the draft after publication
never mutates an existing version; publishing again creates the next monotonic
version number. Deleted version numbers are never reused.

A Tool definition should include:

```txt
name, description, preview, author, and version
workspace or community visibility
typed required and optional inputs
typed named outputs
input and output cardinality
internal immutable Flow snapshot
exposed settings
supported or required models
estimated aggregate cost and time
```

Example:

```txt
Product To Ad Visuals

Input
└── Product image

Internal Flow
├── Summer advertising branch
├── Surreal installation branch
├── Advertising scene branch
└── Lifestyle scene branch

Outputs
├── Summer Advertising Concept
├── Surreal Installation
├── Advertising Scene
└── Lifestyle Scene
```

On the canvas, the Tool appears as one node:

```txt
Product image
      │
      ▼
Product To Ad Visuals
      ├── Summer Advertising Concept
      ├── Surreal Installation
      ├── Advertising Scene
      └── Lifestyle Scene
```

Running a Tool is still a manual user action. That one action executes the Tool's internal graph, including dependency ordering and parallel branches, and binds successful internal results to the declared output ports.

A Tool run may therefore require:

```txt
a parent orchestration run
internal node runs
dependency and parallel-branch execution
intermediate Asset passing
aggregate progress and cost
partial-failure behavior
internal caching and retries
multiple named output Assets
```

Every successful Tool output must be persisted as a canonical Asset and remain usable as a normal downstream Flow input.

Tool nodes should reference a specific published Tool version. Publishing a new version must not silently alter existing Tool nodes or historical runs. Unpublishing should prevent new installations without breaking already-derived outputs or execution history.

A Tool may expose a mutable current-published-version pointer for convenient UI,
API, and MCP invocation. That pointer behaves like an alias, not execution truth:
the invocation resolves it once at admission, records the concrete
`toolVersionId`, and runs that immutable version. Callers that require stability
may request a concrete version directly. Existing canvas Tool nodes remain pinned
until the user explicitly upgrades them.

Tool scopes may eventually include:

```txt
Workspace Tools
Community Tools
```

Community Tools must contain only approved TaleLabs node types and configuration. They must never execute arbitrary creator-supplied server code or expose private Assets, Elements, prompts, credentials, or workspace data.

A Tool may later support two presentations:

```txt
Add to Flow = use it as one composite node
Open as Tool = use a simplified form generated from its declared inputs
```

Tools require the same internal graph executor introduced by the mock-engine
milestone. Do not build Tools, nested Tool execution, or community Tool
publishing merely because full-flow execution exists; manual Flows and the
versioned Tool lifecycle must be dependable first.

The intended progression is:

```txt
Manual Flow
-> Recipe: reusable visible graph
-> Tool: encapsulated executable Flow
-> simplified Tool form when useful
```

Do not build community discovery, ranking, moderation, licensing, or marketplace economics before private and workspace-scoped Recipes and Tools work reliably.

### Storyboard

Storyboard is a possible paid expansion after TaleLabs proves monetization.

It would organize selected Assets into ordered scenes and shots for narrative planning, continuity, and animatics. Storyboard is distinct from a Flow:

```txt
Flow       = spatial creative exploration and generation
Storyboard = sequential scene and shot structure
```

Do not build Storyboard as part of the first sellable loop.

### Additional Deferred Layers

Other possible later layers include:

```txt
Flow collaboration
comments and review
Flow version history
Brand Kit governance
simple editing or cuts
Community Recipes library
Community Tools library
API and MCP
external automation triggers
```

None are required to validate the first sellable loop.

## Billing And Credits

Credits and billing are necessary for a commercial generation product, but they should follow the proven single-user creation loop rather than lead implementation.

TaleLabs already calculates and displays an advisory provider-cost estimate for
Credits-funded managed runs and recalculates it authoritatively at admission.
Credit balances, reservations, capture, release, pricing margins, and enforcement
remain future billing work.

When introduced, billing must support:

```txt
credit-denominated run quotes derived from provider-cost estimates
credit reservation before execution
capture after billable success
release after non-billable failure
credit packs
subscription allowances
usage history
provider-cost and margin tracking
```

Credits belong in the header, account, usage, and billing experiences rather than the main creative navigation.

## Product Principles

1. Build Assets first, then make the Flow canvas and generation nodes excellent.
2. Treat Flows as the main product experience, not as an auxiliary feature.
3. Make simple one-node generation easy without requiring Elements or technical operation selection.
4. Approve model-adaptive node UX with deterministic mocks before designing the run engine.
5. Persist every successful output as a reusable Asset.
6. Keep Assets canonical and globally reusable within a workspace.
7. Treat Elements as optional accelerators with one output, never a core-loop dependency.
8. Treat multiple connected context sources as a core generation capability, not a later migration.
9. Preserve immutable generation provenance when execution work resumes.
10. Add new surfaces only when they extend the core loop and have evidence behind them.
11. Defer Storyboard, editing, collaboration, Recipes, and Tools until the core loop works.
12. Keep models behind a creative, capability-aware interface.
13. Keep provider integrations replaceable so direct APIs can be added as TaleLabs scales.
14. Keep storage, async jobs, tenant isolation, and generation reliability as foundational infrastructure.
15. Do not confuse a larger navigation menu with a more valuable product.

## Scope Test

Before adding a feature, ask:

```txt
Does this make Assets more reliable or reusable?
Does this make the canvas or its generation nodes easier and more capable?
Does this complete or monetize the current product loop?
```

If the answer is no, defer it unless the product vision is explicitly changed.
