# TaleLabs Product Vision

This document is the source of truth for what TaleLabs is trying to become and what the first sellable product loop must prove. Read it before planning product work, designing UI, creating database models, defining APIs, or integrating AI providers.

This document defines product direction and scope. It intentionally does not prescribe the database schema or API contract. Those documents must be redesigned separately after this vision is accepted.

## What TaleLabs Wants To Be

TaleLabs is a visual AI creative workspace for generating, organizing, and reusing media.

The product is not a generic directory of AI models and it is not initially an end-to-end video editor. Models are execution engines inside a visual creative process. TaleLabs should become the place where creators can collect references, preserve reusable context, connect creative steps, generate media, and continue iterating from previous outputs.

The core product loop is:

```txt
Assets -> Elements -> Flows -> Generated Assets -> Continued Iteration
```

TaleLabs is built around three primary product entities:

```txt
Assets
Elements
Flows
```

Each entity has one clear responsibility:

```txt
Assets   = media the user owns and can reuse
Elements = reusable context assembled from assets and instructions
Flows    = the visual environment where users create
```

The interface and implementation should remain centered on these three concepts until the first product loop is reliable and valuable enough to monetize.

## Product Navigation

The initial navigation is deliberately narrow:

```txt
Assets
Flows
Elements
```

## Build Order

The implementation order is:

```txt
1. Assets
2. Elements
3. Flows
4. Complete generation loop
5. Billing and credits
```

Flows are the main product experience and long-term differentiator. Assets must be implemented first because every upload, reference, Element, generation input, and generation output depends on a trustworthy asset system. Elements come second because they define how reusable context is represented and selected inside Flows.

Do not begin by building a large canvas with placeholder data. Establish the asset foundation, then the reusable context layer, then the visual creation surface.

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

Do not use Trigger.dev as evidence that TaleLabs needs a run-all Flow engine. In the first product loop, every generation node is executed manually and independently. Trigger.dev provides durability for that one execution; it does not change the manual Flow product model.

Short deterministic operations remain in the TaleLabs API, including graph persistence, connection validation, context previews, cost estimates, signed-upload creation, and ordinary Asset or Element updates.

## Assets

Assets are the canonical media records in TaleLabs. Every uploaded file and every successful generation output becomes an Asset.

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

Assets must be globally available within the user's workspace. They should not be owned exclusively by a Flow or Element. A single Asset may be referenced by multiple Elements and multiple Flows.

Every generated Asset should preserve useful provenance:

```txt
source: upload | generation
media type
storage reference
model and provider
generation settings
resolved prompt or instructions
input asset references
input Element references
generation job
creator
created date
```

The asset picker is a core shared component. Elements and Flow nodes should select existing Assets through the same picker rather than creating separate media libraries.

Tags are lightweight workspace organization shared by workspace members. Favorites are a personal view for each user within a workspace. Neither changes Asset ownership, visibility, or provenance, and both belong to the canonical Asset library and picker rather than separate media collections.

The initial asset system should not expand into a complete Google Drive replacement. Defer public galleries, public links, complex permissions, review workflows, advanced versioning, and elaborate taxonomies beyond simple tags until real usage demonstrates a need.

## Elements

Elements are reusable creative context.

An Element combines a durable identity or concept with instructions and reference Assets. It allows users to reuse the same subject, object, place, style, or identity without rebuilding its context in every prompt.

Examples include:

```txt
a recurring character
a physical product or prop
a location or environment
a visual style
a brand identity
a color palette
a wardrobe or object
```

The initial Element concept should remain generic. It should not recreate separate product systems for Brands, Products, and Characters.

An Element initially needs:

```txt
name
type
description or generation instructions
reference Assets
optional labels or lightweight metadata when proven necessary
```

The first implemented types should be:

```txt
Character
Product
```

Later types may include:

```txt
Object
Location
Style
Brand
```

Types help presentation and selection, but all Elements share the same core behavior: they provide text context and reference media to generation nodes.

### Element Type Registry

Element behavior should be defined through typed runtime registries in code. Selecting an Element type changes its validation, form, supported asset roles, and the server-only function that turns its stored information into generation context. Keep these as three explicit boundaries: shared framework-neutral definitions, dashboard-only React forms, and API-only context builders. React components and server builders must never be combined in one registry object.

The initial direction is:

```ts
const elementTypes = {
  character: {
    currentVersion: 1,
    schemas: { 1: characterSchemaV1 },
    migrations: {},
    assetRoles: [
      { id: "appearance", accepts: ["image"] },
      { id: "expression", accepts: ["image"] },
      { id: "motion", accepts: ["video"] },
      { id: "voice", accepts: ["audio"] },
    ],
  },

  product: {
    currentVersion: 1,
    schemas: { 1: productSchemaV1 },
    migrations: {},
    assetRoles: [
      { id: "packshot", accepts: ["image"] },
      { id: "detail", accepts: ["image"] },
      { id: "lifestyle", accepts: ["image", "video"] },
      { id: "demonstration", accepts: ["video"] },
    ],
  },
};

const elementForms = {
  character: CharacterElementForm,
  product: ProductElementForm,
};

const elementContextBuilders = {
  character: buildCharacterContext,
  product: buildProductContext,
};
```

The registry is product-controlled runtime configuration. Do not put Element type definitions in the database or build an admin UI for them during the MVP.

Each registry entry owns:

```txt
stable type ID
version-specific validation schemas and sequential migrations
supported asset roles and media types
preview role
```

The shared registry is deliberately not a form-definition language. Every Element type has a dedicated React form in the dashboard and a dedicated server context builder in the API. The shared registry owns only schemas, schema evolution, and structural Asset-role metadata; the dashboard form registry owns React components; the API context-builder registry owns context composition.

```txt
Dedicated React form
        ↓
Shared versioned Zod schema
        ↓
Generic Element API validation
        ↓
Type-specific JSONB data
        ↓
Dedicated server context builder
```

Shared Element definitions must not contain user-facing English display copy. Type names, type descriptions, field labels/help text, and Asset-role labels/descriptions are localized by the dashboard from stable type, field, and role IDs (or stable translation keys). For example, the `character` / `personality` pair resolves to a dashboard catalog key such as `elements.types.character.fields.personality.label`. The shared package must not import React, `react-i18next`, or dashboard catalogs; the dashboard calls `t(...)` at the rendering boundary. Every supported locale must receive the same Element keys and pass catalog validation. Server-generated model context is a separate concern and must not reuse UI translations implicitly.

### Element Schema Evolution

`schemaVersion` is an active runtime contract, not decorative metadata. Every Element type retains the schemas needed to validate supported stored versions and an explicit migration for every sequential transition:

```ts
const characterDefinition = {
  currentVersion: 2,
  schemas: {
    1: characterSchemaV1,
    2: characterSchemaV2,
  },
  migrations: {
    1: migrateCharacterV1ToV2,
  },
};
```

Reading an Element validates the stored payload with the schema matching its stored version, applies migrations sequentially (`v1 -> v2 -> v3`), and validates the final current shape. Unknown future versions, missing schemas, migration gaps, and invalid historical payloads fail safely. Creates and updates persist only the current version; reads may upcast in memory without rewriting the row, while the next successful save persists the current representation.

Required-field additions, renames, removals, type changes, and semantic changes require a version increment and migration. Historical schema definitions must not be mutated after production data uses them. Asset-role changes require equal care: removing or renaming a role needs a link migration or a deprecation window because existing `elementAssets` rows carry that role.

Use dedicated typed form components rather than a generic form renderer, schema-driven field language, or field-definition DSL. Reuse ordinary controls and layout components only when multiple forms exhibit the same concrete behavior. Each form may evolve its validation-bound controls, layout, help text, and specialized interactions independently while the API continues to validate its shared Zod schema.

Element creation has two consistent sections: `Data` and `Assets`. Data asks only for the small set of guidelines that materially improves reuse for that type. Assets renders one role-aware drop zone per registered Asset role. Dropped `File` objects and preview object URLs stay only in the creation page's local memory until the Element and its Asset folder are created successfully; creation failure uploads nothing.

After creation, the files and their structured intent transfer to a non-persisted, dashboard-level Zustand queue. Each intent retains the `File`, `assetFolderId`, Element ID, role, order, and primary state across SPA navigation, but is never serialized to browser storage. The bounded worker owns only the local transfer and registration lifecycle: `queued -> hashing -> uploading -> registering -> linking -> completed`, with `failed` retaining the failed stage. It uploads to R2, registers the canonical Asset in the Element folder, stores the returned Asset ID as a recovery checkpoint, and then creates the `elementAssets` relationship. Trigger.dev media processing continues independently after registration; its feedback comes from organization-scoped Asset queries rather than the local upload manager. A linking retry starts from the stored Asset ID and never uploads or registers the media again. Browser refresh or closure may still lose unfinished local files; resumable uploads are deferred.

Each Element Asset role has its own capacity, determined by the role's media family: image roles accept up to eight Assets, while video and audio roles accept one Asset by default. These are per-role context limits, not Element-wide media totals and not provider/model input limits. An Element may therefore retain richer reusable collections across several roles; the consuming Flow node later selects a model-compatible subset. The dashboard prevents excess pending selections, while both existing-Asset attachment and upload registration enforce the same role capacity transactionally so concurrent requests cannot exceed it.

The `Other` Element is the deliberate escape hatch for reusable context that does not fit a product-controlled type. It keeps Data to name and instructions, and lets the user define up to three custom Asset-role names. Those names are validated and stored in the Element's versioned data before any Asset upload begins, then persisted as the role on each Element-to-Asset relationship. Other accepts image, video, and audio references without weakening the fixed role contracts of specialized Element types.

### Element Details And Assets

Every Element detail page should have two primary surfaces:

```txt
Details
Assets
```

`Details` renders the dedicated type-specific form selected by the dashboard form registry. Shared fields such as name and type remain consistent, while each type composes its own context fields explicitly.

`Assets` reuses the same asset-library components and behavior as the global Assets page, with a fixed filter for the current Element. It is not a second media library.

Conceptually:

```txt
/assets                     = all workspace Assets
/assets?elementId=:id       = global Assets filtered by Element
/elements/:elementId/assets = the same filtered asset experience
```

From the Element Assets tab, users should be able to:

```txt
upload a new Asset and attach it automatically
attach an existing Asset
filter by image, video, and audio
assign an allowed role
set ordering or primary-reference priority
remove the Element relationship
open the canonical Asset detail
```

Every Element supports zero or more related Assets. An Element does not need to contain every media type and may be created before references are available.

The Element-to-Asset relationship carries meaning beyond membership:

```txt
role
position
primary or reference priority
```

One Asset may be related to multiple Elements. Removing an Asset from an Element must not delete it, and deleting an Element must not delete its canonical Assets.

New Element uploads receive automatic folder organization without changing the semantic model. The workspace has one lazily provisioned, internally identified `Elements` root folder, and each Element stores the stable ID of its own child folder. Duplicate Element names receive collision-safe folder names such as `Maya 2`; later Element renames do not rename user-customized folders. Moving or renaming a folder is safe because the association uses its ID, never a reconstructed path.

Only files uploaded from an Element surface are placed into that associated folder. Linking an existing canonical Asset never moves or copies it. Deleting an Element leaves its folder and Assets intact. Deleting the associated folder clears the Element's folder reference through the database relationship, and the next new upload provisions a replacement lazily.

Elements provide a semantic filter for Assets, but they do not replace folders:

```txt
Folder  = where the user manually organizes an Asset
Element = why the Asset is reusable as AI context
```

### Element Flow Node

An Element can be placed in a Flow as a reusable context node. It exposes its resolved text context and one typed collection output for each registered Asset role:

```txt
context                 -> ElementContext
appearance              -> ImageSet
expression              -> ImageSet
motion                  -> VideoSet
voice                   -> AudioSet
```

The role output is a collection, not one handle per Asset. For example, a Character's `appearance` role has one handle that can resolve to as many as eight candidate images. This keeps the canvas stable when Assets are added, removed, reordered, or reprioritized inside the Element.

The complete Element context resolves to a bundle containing:

```txt
Element identity and type
text context produced by buildContext
related Asset IDs
Asset media types, roles, and priority
```

The server contract is deliberately provider-independent:

```ts
type BuiltElementContext = {
  elementId: string;
  type: string;
  schemaVersion: number;
  text: string;
  assets: {
    assetId: string;
    role: string;
    sortOrder: number;
    isPrimary: boolean;
    mediaType: "image" | "video" | "audio";
    mimeType: string;
  }[];
};

const context = await buildElementContext(elementId);
```

`buildElementContext` upcasts and validates Element data, composes stable text, resolves kit Assets in deterministic role/order/id order, identifies primary references, and excludes processing, failed, purging, and purged Assets from executable context. It returns stable IDs and metadata, never signed URLs or storage keys. Signed URLs expire; provider-specific URLs or uploads are resolved only at execution time and must never be stored in graph or generation snapshots.

A generation node can receive multiple Element nodes, Element role collections, and raw Asset nodes. Role handles are generated from the product-controlled Element registry and remain stable IDs; the node never creates one dynamic handle per Asset.

### Consumer-Owned Reference Selection

Reference selection does not happen inside the Element node and never modifies the Element's reusable Asset kit. The Element offers an ordered collection of candidates; the consuming generation node chooses which compatible members of that collection it will use for that specific node.

Conceptually:

```txt
Character: Maya                         Veo 3.1
┌─────────────────────┐                ┌────────────────────────┐
│ Appearance       ●  ├───────────────►│ Subject references     │
│ 8 images            │                │ [img][img][img]  3 refs│
│ Expressions       ● │                │                        │
└─────────────────────┘                └────────────────────────┘
```

The interaction is:

```txt
connect one Element role handle to a compatible generation input
-> resolve the role's ordered candidate collection
-> select primary references first, then role order
-> show selected count versus candidates and model limit
-> click the generation input to inspect or change its selection
```

The canvas node stays compact. It shows a thumbnail stack, a concise selected-reference count, and validation state. It does not expose selection-strategy terminology or a persistent `Change selection` button. The connected input row itself is the inspector affordance.

Selection uses progressive disclosure. Connecting a compatible collection is immediately runnable and requires no confirmation step. Detailed selection appears only when the user clicks the consuming input:

```txt
Subject references
3 selected
8 available · Veo 3.1 accepts up to 3 images

[1] Maya front           Primary
[2] Maya profile
[3] Maya full body
[ ] Maya smiling
[ ] Maya seated
[ ] Maya outdoors

Using Element defaults                         Customize
```

The product language is deliberately `Using Element defaults`, `Customize`, `Custom references`, and `Reset to Element defaults` — never an exposed `Automatic / Manual` mode toggle. Clicking `Customize` or changing any candidate implicitly creates a custom selection. Selected candidates receive visible order numbers because provider payload order may affect the result. `Reset to Element defaults` discards only the local override and returns to deterministic primary and role ordering.

Internally, defaults map to `auto` and a customized choice maps to `manual`. Incoming React Flow edges remain the sole source of graph topology; generation-node `data` stores only the per-input selection policy, without duplicating source node IDs or handles:

```ts
type InputSelection =
  | { mode: "auto" }
  | { mode: "manual"; assetIds: string[] };

type GenerationNodeInputSelections = Record<string, InputSelection>;
```

At graph validation and run creation, every manually selected Asset ID must still be a compatible member of the candidate set resolved from the input's incoming edges. A stale, removed, unavailable, or incompatible manual selection makes the input visibly invalid; the system must not silently replace it.

The consuming input has four product states:

```txt
Unconnected  -> Add references
Default      -> 3 references
Customized   -> 3 custom references
Invalid      -> Select no more than 3
```

When several Element or Asset sources feed the same input, the inspector groups candidates by source while applying one aggregate input limit:

```txt
Maya · Appearance
[1] Front
[2] Profile
[ ] Full body

Acme Bottle · Packshot
[3] Front package
[ ] Side package

3 selected · maximum 3
```

Model limits apply to the consuming input, across all connected sources combined. If two Element collections contribute twelve candidate images to an input whose selected model accepts three, the input can select no more than three in total. Connecting a collection to a singular semantic slot such as `firstFrame` requires selecting exactly one candidate.

Changing models or candidate collections revalidates the input according to who owns the decision:

```txt
Element defaults -> recompute automatically from the current compatible candidates and model limit
Custom references -> preserve the explicit choice; show an actionable error if it becomes stale or exceeds the limit
```

If a model change reduces the maximum below a custom selection, TaleLabs preserves the user's selection, displays an actionable overflow error, and blocks execution until the user reduces it. If a selected custom Asset is removed, unavailable, or incompatible, it remains visibly unresolved until the user replaces it or resets to Element defaults. TaleLabs must never truncate or replace a custom selection silently.

Singular semantic inputs use the same model with less ceremony. Connecting an `ImageSet` to `firstFrame` selects one default candidate and shows one thumbnail; clicking it opens the same inspector constrained to one selection.

The generation node is responsible for showing which compatible references will be used. Models have different media support and input limits, so a connected Element does not imply that every related Asset will be sent to the provider.

When a generation node runs, the server resolves and snapshots the connected Element's upcasted data, resolved text, schema version, complete candidate references, selection policy, selection exclusions, and exact selected Asset references. Later Element edits affect future runs but must not change historical generation provenance. M4 exposes the context and role collection handles; M5 applies the consuming model's capability limits and writes immutable job sources and exact provider inputs.

Users should be able to:

```txt
create an Element from existing Assets
upload Assets while creating an Element
add or remove reference Assets
edit its instructions
find and select it from a Flow
inspect where it is used later
save a useful generated result back to an Element
```

Elements are optional accelerators. A user must still be able to connect raw Assets directly to a generation node without first creating an Element.

## Flows

Flows are the main creative product surface.

The canonical technical model for Flow handles, runtime values, reference sets,
batch items, lineage, generation execution, iteration, full-flow orchestration,
caching, Recipes, and Tools lives in `docs/flow-nodes-planning.md`. Flow work
must preserve that document's distinction between collections consumed together
and runtime items that multiply execution.

A Flow is a visual document built with React Flow. Users connect prompts, Assets, Elements, and AI generation nodes to explore ideas, preserve creative provenance, branch into alternatives, and reuse previous outputs.

The first Flow experience is a manual visual creative process. It is not an automation engine.

The engine-foundation node set should remain narrow by purpose, while covering
the three media types TaleLabs intends to execute through one runtime:

```txt
Text or Prompt node
Asset node
Element node
Image Generation node
Video Generation node
Audio Generation node
```

All three generation-node surfaces and their model capability rules are built
before external provider integration. Utility/control nodes remain limited to
the explicit iteration set authorized by the execution plan; other transformation
nodes should still come from demonstrated needs rather than speculative completeness.

The first Flow version should support:

```txt
create and rename a Flow
add, move, connect, duplicate, and delete nodes
autosave graph state
select Assets and Elements
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

The first UI action remains explicit and manual:

```txt
Run selected node only.
```

The mock-engine milestone then adds explicit `Run downstream` and `Run all`
commands. Connecting nodes never starts execution by itself.

Do not build the following into the first Flow engine:

```txt
triggers
schedules
webhooks
conditional nodes
external integrations
general-purpose automation
```

The engine milestone may add bounded Iterator/Map, Collect, Zip, and Prompt
Iterator semantics. Arbitrary scripting, hidden batch matrices, triggers, and
general-purpose automation remain deferred.

### Simple Flows

The canvas must not require complexity for simple creation. A Flow containing one prompt and one generation node is a valid first-class Flow.

The product should make this path quick:

```txt
Create Flow -> enter prompt -> choose model/settings -> run node -> receive Asset
```

Users can progressively add Assets, Elements, and branches when their creative process becomes more complex.

## First Sellable Product Loop

The first sellable loop is:

```txt
Upload or find an Asset
-> optionally create an Element
-> create or open a Flow
-> add Text, Asset, Element, and Generation nodes
-> connect the required context
-> execute the graph against deterministic provider mocks
-> process the job asynchronously
-> save the output as an Asset
-> reuse the output in the same or another Flow
-> replace only the provider adapter with a controlled real integration
```

The loop is not complete if generation results are temporary, if outputs cannot be found again, or if the user must re-upload the same references for every generation.

The shared loop is validated with deterministic image, video, and audio outputs
before any paid generation request. Inputs, planning, durable execution,
provenance, and output ingestion are production-shaped; only provider responses
are mocked. Real integrations must reuse that foundation rather than creating
independent products.

## Generation Principles

Model choice belongs inside generation nodes. Power users should be able to choose a supported model and compatible settings, but provider terminology should not dominate the creative experience.

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

Provider metadata can inform the interface, but TaleLabs owns a curated,
code-versioned model registry for enabled models, labels, defaults, operations,
typed slots, cross-field constraints, pricing behavior, and feature flags. Live
OpenRouter/provider discovery responses never directly control production UI or
validation; they feed an explicit review and drift-check process.

Flows persist stable TaleLabs model identities. Public capabilities are shared
between the API and dashboard, while provider model IDs, endpoint pinning,
fallbacks, credentials, negotiated costs, and routing policy remain server-only.
TaleLabs may replace OpenRouter with a direct route for the same underlying model
without migrating Flows. A materially different creative model receives a new
TaleLabs model ID rather than silently changing existing semantics.

Capabilities must describe generation modes and dependent constraints, not only
independent controls. Examples include text-to-video versus image-to-video,
first/last-frame requirements, reference-image limits, resolutions that force a
specific duration, mutually exclusive inputs, and operation-specific audio
contracts such as TTS versus sound effects.

Generation must remain server-authoritative. The server resolves connected context, validates compatibility, records immutable job inputs, estimates cost later when credits exist, calls the provider, and ingests successful outputs into Assets.

The provider adapter boundary supports both immediate results and asynchronous
jobs. Images may complete immediately or stream, videos commonly submit and
poll/webhook, and audio may return or stream raw bytes. Trigger.dev owns durable
polling, reconciliation, retries, cancellation, and ingestion without creating a
separate execution engine per media type.

### Multi-Context Generation

Multi-context generation is a foundational Flow requirement and must be supported from the first generation-job design.

A generation node can receive several context sources in one manually initiated run:

```txt
Character Element ─┐
Character Element ─┤
Product Element ───┼─> Image Generation
Location Element ──┤
Style Element ─────┤
Raw Asset ─────────┤
Text Prompt ───────┘
```

The system must support multiplicity at two levels:

```txt
one generation job -> multiple connected context sources
one Element        -> multiple related reference Assets
```

A context source may come from:

```txt
Text or Prompt node
Element node
raw Asset node
compatible output from another Flow node
```

Context sources should preserve deterministic ordering, role, and priority where those values affect prompt composition or provider input selection.

Multi-context does not mean that every Asset from every connected Element is sent to the provider. The selected model may support only certain media types or a limited number of references. Resolution must follow this sequence:

```txt
collect connected context sources
-> resolve Element instructions and related Assets
-> apply source roles, ordering, and priority
-> validate selected model capabilities and limits
-> select or ask the user to select compatible references
-> show exclusions and input-limit warnings
-> snapshot the exact provider inputs
```

The generation record must preserve both:

```txt
all context sources connected to the generation node
the exact subset of text and Asset inputs submitted to the provider
```

At execution time, snapshot:

```txt
connected node IDs and source types
Element IDs and Element types
resolved Element text context
candidate Asset references and roles
selected provider Asset inputs
final resolved prompt or instructions
model and generation settings
```

Later edits to a Flow, Element, or Asset relationship must not rewrite historical generation inputs.

Future database and API designs must not reduce generation context to a single `characterId`, `elementId`, or `assetId`. Generation inputs are plural by design. Retired relationships such as a job-level `characterId` or `brandCharacters` do not represent the new Element and Flow architecture.

Multi-context is separate from batch generation, multiple prompts, and run-all execution. The MVP may still execute one generation node and produce one requested result while resolving several context sources for that run.

## Workspace Scope

Assets, Elements, and Flows belong to a user workspace or organization boundary. Tenant isolation is required for every read, write, selection, generation input, storage operation, and realtime room.

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

### Simple AI Generation Page

A dedicated simple generation page may return later for users who want a direct form instead of opening a Flow. This corresponds to the earlier Generate page concept.

It would provide a fast path for one-off image, video, or audio generation while still using the same underlying systems:

```txt
same Assets
same Elements
same model configuration
same generation jobs
same billing rules
same output ingestion
```

It must not become a second independent generation architecture. A simple generation could internally create a lightweight session or one-step Flow, but that implementation decision belongs to later planning.

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

When introduced, billing must support:

```txt
generation cost estimation
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

1. Build Assets before Elements and Elements before Flows.
2. Treat Flows as the main product experience, not as an auxiliary feature.
3. Make simple one-node generation easy inside a Flow.
4. Run one selected node manually before considering graph automation.
5. Persist every successful output as a reusable Asset.
6. Keep Assets canonical and globally reusable within a workspace.
7. Use Elements to unify reusable context instead of building separate Brand, Product, and Character products.
8. Treat multiple connected context sources as a core generation capability, not a later migration.
9. Preserve immutable generation provenance even when Elements later change.
10. Add new surfaces only when they extend the core loop and have evidence behind them.
11. Defer Storyboard, simple Generate, editing, collaboration, Recipes, and Tools until the core loop works.
12. Keep models behind a creative, capability-aware interface.
13. Keep provider integrations replaceable so direct APIs can be added as TaleLabs scales.
14. Keep storage, async jobs, tenant isolation, and generation reliability as foundational infrastructure.
15. Do not confuse a larger navigation menu with a more valuable product.

## Scope Test

Before adding a feature, ask:

```txt
Does this make Assets more reliable or reusable?
Does this make Elements more useful as context?
Does this make manual Flows better for creating media?
Does this complete or monetize the current product loop?
```

If the answer is no, defer it unless the product vision is explicitly changed.
