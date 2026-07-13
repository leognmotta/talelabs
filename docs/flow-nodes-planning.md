# TaleLabs - Flow Node And Runtime Planning

**Purpose:** define one durable mental model for the TaleLabs Flow canvas and
execution engine. This document explains what nodes and wires represent, how
Assets and Elements become reusable context, how generation executes, and how
iteration, multiple outputs, full-flow runs, caching, Recipes, and Tools can ship
without replacing the initial foundation.

Companions:

```txt
talelabs-product-vision.md = product direction
db-design-planning-v2.md   = persistence and provenance
api-design-planning-v2.md  = public API contracts
mvp-execution-plan.md      = implementation order
```

---

## 1. Verdict

The core product instinct is correct:

```txt
Assets are nodes.
Elements are nodes whose reusable roles are outputs.
Generation is a node for image, video, or audio.
Every successful generated file becomes a canonical Asset.
Tools are immutable, versioned Flows exposed behind declared ports.
```

The important correction is:

> A collection of references is not automatically a batch of executions.

TaleLabs must preserve the difference between values consumed together and
values that cause repeated execution. This distinction is necessary for
predictable behavior, cost previews, provenance, retries, caching, and Tools.

React Flow is the graph editor, not the execution engine. It renders nodes,
handles, edges, selection, and viewport state. TaleLabs owns all type checking,
value resolution, planning, execution, persistence, and billing behavior.

---

## 2. Four Different Meanings Of "Multiple"

The word "multiple" describes four independent concepts. They must not share
one accidental implementation.

| Concept | Example | Meaning |
| --- | --- | --- |
| Multiple handles | Character has Appearance, Motion, and Voice | Different semantic outputs |
| Collection | Appearance contains eight images | Several references consumed together |
| Provider outputs | One image request asks for four variations | One job produces several Assets |
| Batch items | Four prompts leave a Text Iterator | Several node executions |

There is also node history: running the same node again creates another run and
another immutable result set. History is not a batch and is not stored in node
configuration.

---

## 3. What Existing Systems Teach

### React Flow - graph editing

React Flow provides custom nodes, named handles, edges, connection interaction,
and viewport behavior. Multiple handles require stable unique IDs, which maps
directly to TaleLabs role IDs and model input-slot IDs.

Reference: <https://reactflow.dev/learn/customization/handles>

Take:

- named, typed-looking ports;
- dynamic Element role handles;
- controlled graph state;
- custom node and edge rendering.

Do not expect React Flow to provide:

- execution order;
- runtime values;
- iteration;
- retries;
- provider calls;
- result persistence.

### n8n - uniform runtime items and lineage

n8n passes arrays of items between nodes. Nodes commonly process each item, and
item-linking metadata records which inputs produced each output.

References:

- <https://docs.n8n.io/data/data-structure/>
- <https://docs.n8n.io/data/data-mapping/data-item-linking/item-linking-concepts/>
- <https://docs.n8n.io/flow-logic/looping/>

Take:

- every runtime port resolves to an ordered list;
- scalar values are lists of one;
- every item has stable identity and lineage;
- singleton inputs can be broadcast across batch items.

Reject:

- automatically mapping every media list;
- treating five references as five provider calls;
- untyped generic JSON as the product-facing port model.

Automatic mapping is appropriate for processing emails. It is dangerous for AI
media generation because it can silently multiply spend.

### LTX - explicit creative batching

LTX demonstrates Prompt Iterators, Image Iterators, prompt builders, full-flow
execution, cached reruns, parallel branches, and Cartesian batch expansion.

Reference: <https://ltx.io/blog/ltx-studio-flows>

Take:

- iteration is a visible creative operation;
- users see batch previews and multiplication;
- unchanged work can be reused;
- individual nodes and full workflows can run;
- results remain available for continued iteration.

Do not copy the mutually exclusive `References` and `Reference Set` UX. TaleLabs
can keep one references input because its runtime distinguishes a reference set
from a batch of reference sets.

### FLORA - reusable workflows as products

FLORA demonstrates reusable workflows that can run as a canvas node, standalone
experience, API operation, or MCP tool. Its Batch nodes make collection fan-out
explicit rather than hiding execution multiplication.

References:

- <https://flora.ai/blog/techniques>
- <https://flora.ai/updates/techniques-text-layers-router-node>

Take:

- reusable workflow logic can become a product surface;
- batch behavior belongs in visible nodes;
- Tools need stable, declared input and output contracts;
- the same execution engine should power canvas, API, and MCP usage.

### Runway - simple and advanced surfaces

Runway separates quick generation from reusable Workflows. Workflows support
typed links, individual-node runs, Run All, branches, and node execution history.

References:

- <https://help.runwayml.com/hc/en-us/articles/45763528999699-Introduction-to-Workflows>
- <https://help.runwayml.com/hc/en-us/articles/45769159004691-Building-your-first-Workflows>

Take:

- running one node and running a whole graph are complementary;
- node history is important for creative comparison;
- a Flow should not force simple generation users to understand orchestration.

---

## 4. Graph-Time Types Versus Runtime Values

The saved graph stores configuration and topology:

```txt
flowNodes = node identity, type, position, references, draft configuration
flowEdges = source node/handle -> target node/handle
```

It never stores transient runtime values or generated result IDs in node data.

Graph-time handle types remain the current creative vocabulary:

```ts
type FlowValueType =
  | 'Text'
  | 'ElementContext'
  | 'Asset'
  | 'ImageSet'
  | 'VideoSet'
  | 'AudioSet'
```

`ImageSet`, `VideoSet`, and `AudioSet` are deliberate. A set is a collection of
references that may be consumed together. It is not equivalent to iteration.

Saved edge identity defines source priority: ascending persistent edge ID is the
canonical edge order in the editor, API hydration, graph snapshots, and planner.
Automatic input selection must sort by that rule before applying model limits;
it must never depend on browser insertion order or database row order.

The current `packages/flows` registry already follows this direction. Asset
nodes emit a typed media set, Element role handles emit typed sets, and model
input slots state which set types they accept.

---

## 5. Runtime Value Contract

Every resolved output port returns an ordered array of runtime items:

```ts
interface FlowItem<T> {
  /** Stable identity used by lineage, caching, retries, and idempotency. */
  key: string

  /** The value carried by this execution item. */
  value: T

  /** Upstream items that contributed to this item. */
  lineage: readonly FlowItemReference[]

  /** Explicit batch axes and the selected coordinate on each axis. */
  dimensions: Readonly<Record<string, string>>
}

interface FlowItemReference {
  handleId: string
  itemKey: string
  nodeId: string
}

type PortValue<T> = readonly FlowItem<T>[]
```

Media values are collections:

```ts
interface AssetReference {
  assetId: string
  mediaType: 'image' | 'video' | 'audio' | 'document'
}

interface ImageSet {
  assets: readonly AssetReference[]
}

interface VideoSet {
  assets: readonly AssetReference[]
}

interface AudioSet {
  assets: readonly AssetReference[]
}
```

This creates two independent levels:

```txt
PortValue items = execution or batch multiplicity
Set assets      = values consumed together
```

Runtime values are planner/executor objects. They are not persisted onto
`flowEdges` or copied into live `flowNodes.data`. Immutable run snapshots,
sources, selected inputs, jobs, and output Assets persist the relevant facts.

---

## 6. The Distinction In Practice

### Asset node

An image Asset produces one runtime item containing one reference:

```ts
const assetOutput: PortValue<ImageSet> = [
  {
    key: 'asset:asset_123',
    value: {
      assets: [{ assetId: 'asset_123', mediaType: 'image' }],
    },
    lineage: [],
    dimensions: {},
  },
]
```

### Element role

Maya's Appearance role with three images produces one runtime item containing
three references:

```ts
const appearanceOutput: PortValue<ImageSet> = [
  {
    key: 'element:maya:appearance',
    value: {
      assets: [frontImage, profileImage, fullBodyImage],
    },
    lineage: [],
    dimensions: {},
  },
]
```

This means one reusable collection. Connecting it to References does not create
three jobs.

### Image Iterator

An Image Iterator transforms that one collection into three runtime items:

```ts
const iteratorOutput: PortValue<ImageSet> = [
  {
    key: 'iterator_1:0',
    value: { assets: [frontImage] },
    lineage: [appearanceReference],
    dimensions: { iterator_1: '0' },
  },
  {
    key: 'iterator_1:1',
    value: { assets: [profileImage] },
    lineage: [appearanceReference],
    dimensions: { iterator_1: '1' },
  },
  {
    key: 'iterator_1:2',
    value: { assets: [fullBodyImage] },
    lineage: [appearanceReference],
    dimensions: { iterator_1: '2' },
  },
]
```

The Iterator explicitly introduces an execution axis. A downstream generation
node can now plan three work items.

This distinction cannot be represented by a flat `image[]` alone because an
Element collection and an Iterator batch would become indistinguishable.

---

## 7. Input Aggregation Is Separate From Batch Expansion

An input-slot definition controls how values at one batch coordinate combine:

```ts
type InputAggregation =
  | 'compose' // combine ordered Text or ElementContext fragments
  | 'gather'  // combine media references into one candidate set
  | 'single'  // resolve exactly one selected value
```

Examples:

```txt
prompt       -> compose
context      -> compose
references   -> gather
firstFrame   -> single
endFrame     -> single
audioTrack   -> single or gather, depending on model capability
```

Aggregation does not decide how many jobs run. Explicit batch dimensions do.

For a References input:

```txt
Asset A + Asset B + Maya.Appearance
                    |
                    v
one ordered candidate collection
                    |
                    v
model-compatible automatic/manual subset
                    |
                    v
one provider request for that batch coordinate
```

This preserves one References port while allowing several incoming edges.

Model capabilities continue to define:

- accepted value types;
- maximum incoming connections;
- maximum selected items;
- required inputs;
- settings and output count;
- automatic versus manual selection behavior.

### Curated Model Registry And Provider Routes

TaleLabs owns the production model catalog in versioned code. OpenRouter and
direct-provider discovery endpoints are research and drift-detection inputs, not
runtime sources of truth for the canvas. A remote catalog change must never add,
remove, or alter a production control without review and deployment.

Every persisted model reference uses a stable TaleLabs identity:

```ts
type ProductModelDefinition = {
  id: 'talelabs/veo-3.1'
  mediaType: 'video'
  operations: GenerationOperationDefinition[]
  settings: GenerationSettingDefinition[]
  constraints: GenerationConstraintDefinition[]
}
```

The provider route is server-only and independently replaceable:

```ts
type ProviderRoute = {
  productModelId: 'talelabs/veo-3.1'
  modelContractVersion: string
  operationId: 'textToVideo'
  adapter: 'openrouter-video'
  providerModelId: 'google/veo-3.1'
  providerTag?: 'google'
  routeVersion: string
}
```

Changing OpenRouter to a direct API for the same underlying model may update the
route without changing the TaleLabs model ID or Flow schema. Replacing the
underlying creative model with materially different behavior requires a new
TaleLabs model identity; it must not silently change historical semantics.

Persisted nodes keep their immutable model contract version. Historical
contracts remain readable and editable, but they are executable only when the
server retains an exact route keyed by `(productModelId, modelContractVersion,
operationId)`. The initial execution milestone routes only the current contract;
the editor must offer an explicit same-model upgrade that rewrites the pinned
version, reconciles settings, and confirms removal of incompatible connections.
It must never silently reinterpret an old node through the current contract.

A capability definition is not just a flat collection of independent fields.
It describes valid operations and relationships between inputs/settings:

```ts
operations: [
  { id: 'textToVideo', inputSlots: ['prompt'] },
  { id: 'imageToVideo', inputSlots: ['prompt', 'firstFrame', 'lastFrame'] },
  { id: 'referenceToVideo', inputSlots: ['prompt', 'references'] },
]

constraints: [
  {
    when: { slot: 'references', minimumItems: 1 },
    require: { duration: 8 },
  },
  {
    when: { setting: 'resolution', oneOf: ['1080p', '4k'] },
    require: { duration: 8 },
  },
]
```

The shared public registry drives node rendering, handle visibility, connection
validation, selection limits, settings, and server validation. Private routing,
credentials, provider fallbacks, negotiated pricing, and emergency controls stay
in a server-only registry. `GET /config/generation` returns only the resolved
public product contract.

Provider discovery has two safe policies:

1. pin a concrete provider endpoint and expose that endpoint's verified
   capabilities; or
2. allow routing across eligible endpoints and expose only the intersection of
   capabilities guaranteed by every eligible endpoint.

Never expose a model-level union while allowing routing to an endpoint that may
ignore one of those parameters. A manual/CI drift report may compare the curated
registry with OpenRouter's image/video/model discovery APIs, but it cannot edit
production behavior automatically.

Audio remains one output media family but has distinct operations such as TTS,
sound effects, music, speech-to-speech, isolation, and dubbing. Operation-specific
contracts belong in the registry; sharing `AudioSet` does not imply sharing one
provider request shape.

The provider boundary uses one lifecycle contract without pretending every
provider completes synchronously:

```ts
type ProviderSubmission =
  | { status: 'completed'; outputs: NormalizedProviderOutput[] }
  | { status: 'pending'; externalJobId: string; pollAfterMs: number }

interface GenerationAdapter {
  submit(request: NormalizedGenerationRequest): Promise<ProviderSubmission>
  poll?(externalJobId: string): Promise<ProviderSubmission | ProviderFailure>
  cancel?(externalJobId: string): Promise<void>
}
```

An adapter may normalize immediate image results, raw/streamed audio bytes, or an
asynchronous video job. Trigger.dev durably coordinates pending jobs, callbacks,
polling, retries, cancellation, and reconciliation; graph planning and output
ingestion remain provider-independent.

### Research Baseline

The registry design is grounded in current official platform/provider behavior:

- FLORA connects text, image, and video blocks and makes reference-frame behavior
  model-dependent: <https://docs.flora.ai/editor/canvas>.
- Runway separates quick generation from repeatable Workflows and exposes input,
  media-model, and LLM nodes: <https://help.runwayml.com/hc/en-us/articles/45763528999699-Introduction-to-Workflows>.
- OpenRouter exposes dedicated image/video discovery APIs, per-endpoint image
  capability descriptors, asynchronous video jobs, polling, and webhooks:
  <https://openrouter.ai/docs/guides/overview/multimodal/image-generation> and
  <https://openrouter.ai/docs/guides/overview/multimodal/video-generation>.
- Veo demonstrates cross-field constraints: first/last frames, up to three
  references, operation-specific inputs, and duration/resolution combinations:
  <https://ai.google.dev/gemini-api/docs/video>.
- Runway's model catalog demonstrates that image, video, upscale, TTS, sound
  effect, isolation, dubbing, and speech-to-speech operations cannot share one
  flat request shape: <https://docs.dev.runwayml.com/guides/models/>.
- OpenRouter TTS and ElevenLabs sound effects demonstrate immediate/streamed
  audio responses and operation-specific duration/voice/looping controls:
  <https://openrouter.ai/docs/guides/overview/multimodal/tts> and
  <https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert>.

These sources are a research baseline, not a permanent runtime contract. The
curated registry remains authoritative until an explicit reviewed update.

Element role capacity and provider input capacity remain different constraints.
An Element may retain eight Appearance references while the selected model
accepts only three. The generation consumer chooses the compatible subset.

---

## 8. Batch Combination Rules

Batch behavior must be deterministic and previewable before execution.

Rules:

1. Values with no batch dimensions are singletons and broadcast.
2. One iterator dimension with `N` coordinates creates `N` work items.
3. Inputs sharing the same dimension remain paired by coordinate.
4. Independent dimensions create a Cartesian product.
5. A future Zip node deliberately creates one shared dimension from ordered
   inputs.
6. An Aggregate or Reference Set node deliberately removes a dimension and
   gathers its values into one collection.
7. Batch size and estimated cost are shown before an expensive run.
8. Hard organization/run limits reject unsafe expansion.

Example:

```txt
4 prompt items
x 3 image items
x 2 requested outputs
= 24 generated Assets
```

TaleLabs should display both provider calls and expected output Assets because
they are not always the same number:

```txt
12 provider jobs
2 outputs per job
24 expected Assets
```

No graph operation should silently create an unbounded product.

---

## 9. Node Execution Categories

The registry should distinguish execution behavior from visual node type:

```ts
type NodeExecutionKind =
  | 'source'
  | 'transform'
  | 'executor'
  | 'composite'
```

### Source nodes

Resolve existing state and do not require Trigger.dev:

```txt
Text
Asset
Element
future manual input nodes
```

### Transform nodes

Perform deterministic in-memory planning operations unless the transform itself
is expensive:

```txt
Text Iterator
Image Iterator
Prompt Builder
Aggregate / Reference Set
Zip
Router
```

### Executor nodes

Create durable jobs and usually run through Trigger.dev:

```txt
Image Generation
Video Generation
Audio Generation
Upscale
Background Removal
other provider-backed processing
```

### Composite nodes

Invoke a versioned internal graph:

```txt
Tool
```

Node React components remain separate from runtime resolvers and executors. A UI
component renders configuration; it must not contain provider or orchestration
logic.

---

## 10. Initial Node Contracts

### Text

```txt
data: { text }
output:
  text -> PortValue<Text>
```

One ordinary Text node produces one item. Several Text edges into a prompt slot
compose in deterministic edge order. A Text Iterator is a separate future node.

### Asset

```txt
assetId: relational FK
output:
  asset -> PortValue<ImageSet | VideoSet | AudioSet | Asset>
```

The output contains one item and normally one Asset reference.

### Element

```txt
elementId: relational FK
outputs:
  context       -> PortValue<ElementContext>
  role:<roleId> -> PortValue<ImageSet | VideoSet | AudioSet>
```

The Element has one stable handle per current registered role. Five roles mean
five reusable media outputs. Each role output is one runtime item containing its
ordered, ready, non-purging related Assets.

`context` remains `ElementContext`, not plain Text. This preserves semantic
origin, structured metadata, and provenance. The planner composes its resolved
text into the provider prompt when appropriate.

### Image Generation

```txt
data:
  modelId
  settings
  inputSelections

inputs:
  prompt
  context
  references
  model-specific slots

output:
  images -> PortValue<ImageSet>
```

Video and audio generation reuse the same execution architecture with their own
typed model registries and slots.

---

## 11. Generation Selection And Provenance

For each planned generation work item, the server:

1. resolves every connected source;
2. preserves deterministic source ordering;
3. gathers candidate media by input slot;
4. applies automatic or user-controlled selection;
5. enforces the chosen model's capabilities;
6. composes the final prompt/context;
7. snapshots every considered source and exclusion decision;
8. stores the exact provider input subset separately;
9. locks and validates selected canonical Assets;
10. creates the durable job.

This preserves two different facts:

```txt
generationJobSources = everything connected and considered
generationJobInputs  = exact binary Assets sent to the provider
```

Later edits to Elements, role relationships, node configuration, or Flow edges
must never rewrite historical provenance.

Manual selection currently applies naturally to static Asset and Element
candidates. When generated upstream outputs participate in full-flow runs, the
selection contract must also support runtime policies such as automatic, first,
all-within-limit, or a pinned prior result. Draft node data must not contain
future Asset IDs that do not exist yet.

---

## 12. Provider Outputs, Batch Outputs, And History

One generation job may request more than one provider output:

```txt
1 generationJob
  -> Asset outputIndex 0
  -> Asset outputIndex 1
  -> Asset outputIndex 2
  -> Asset outputIndex 3
```

These are one job's ordered result set. They are not four jobs.

The generation node's output resolves to one `ImageSet`, `VideoSet`, or
`AudioSet` item per planned work item. That set contains the successful job's
ordered output Assets. To execute a downstream node once per output Asset, the
user adds an explicit Iterator. This avoids surprising downstream spend.

Running the node again creates another immutable run and result set. The canvas
shows result history derived from jobs and Assets. The output handle resolves:

```txt
manual node chaining -> latest succeeded or explicitly pinned result
same full-flow run   -> upstream result from the same flowRunId and item lineage
```

A concurrent manual run must never replace an input inside an already-running
full Flow.

---

## 13. Planner And Executor

The server compiles a saved graph into an execution plan. React Flow is not
involved in server execution.

Planning stages:

```txt
1. Load the Flow and immutable revision.
2. Select the target subgraph for node, downstream, all, or Tool mode.
3. Validate node schemas, handles, edges, required inputs, and DAG acyclicity.
4. Snapshot graph configuration and deterministic edge order.
5. Topologically order dependencies.
6. Resolve source and deterministic transform nodes.
7. Build PortValue arrays with stable keys, dimensions, and lineage.
8. Expand explicit batch dimensions into PlannedNodeExecution[] work items.
9. Apply model limits and create immutable source/input snapshots.
10. Create run, run-item, and generation-job records transactionally.
11. Dispatch durable executor work through Trigger.dev.
```

Snapshot admission is a consistency boundary, not merely serialization. The
planner reads the Flow revision, resolves the selected graph and every mutable
Element/Asset dependency, and revalidates all participating revisions immediately
before inserting the run. `flows.revision` protects nodes and edges. Each
Element has its own revision that increments in the same transaction as Element
data or Element-Asset role/order/primary changes. Selected Asset rows are locked
in stable ID order and revalidated as ready and not purging. Any revision change
causes the admission transaction to roll back and retry; a run must never contain
a graph from one moment and Element context from another.

The resulting `graphSnapshot` is immutable and contains the selected executable
subgraph, captured Flow revision, full node configuration, deterministic edge
order, execution plan, and static resolved context required by that run. Exact
provider inputs remain separately frozen in generation source/input provenance.
Later edits affect only future runs. Trigger tasks receive run/job identities and
load immutable state from PostgreSQL; the graph document is not copied into the
Trigger payload.

The M5 planner returns explicit work items for both simple and iterative graphs:

```ts
interface PlannedNodeExecution {
  itemKey: string
  dimensions: Readonly<Record<string, string>>
  inputs: ResolvedInputMap
  lineage: readonly FlowItemReference[]
}

interface NodeExecutionPlan {
  nodeId: string
  workItems: readonly PlannedNodeExecution[]
}

```

A simple graph naturally returns one item. Iterator, Zip, and independent input
dimensions may return several. Item multiplicity must always be visible in the
plan before admission and execution.

---

## 14. Durable Execution And Trigger.dev

Every provider call is one atomic `generationJobs` execution:

```txt
single provider
single model
single planned batch item
one retry/idempotency boundary
one cost record
one ordered output Asset set
```

Trigger.dev owns durable execution, retries, waiting, concurrency, and
orchestration. PostgreSQL owns product-domain state, immutable provenance,
idempotency, costs, and canonical Asset relationships.

Production dispatch also pins executor code. Trigger.dev deployments are
versioned; the API and Trigger tasks must be deployed atomically and the resolved
executor deployment version recorded for the domain run. Parent orchestration
and awaited child tasks remain on a compatible deployment version. Snapshot
readers retain deterministic upcasters for every supported `snapshotVersion`, so
queued or retried old runs remain executable after application deployments.

Task payloads stay intentionally small:

```ts
{ flowRunId, organizationId }
{ generationJobId, organizationId }
```

Workers load snapshots and provider inputs from PostgreSQL. Do not send graph
JSON, signed URLs, or provider media bytes through Trigger.dev payloads.

For a simple M5 node-mode run:

```txt
1 flowRun(mode=node)
1 logical flowRunNode
1 planned work item
1 generationJob
1..N output Assets
```

For M5 iterative or full-flow execution:

```txt
1 flowRun
1 logical Flow node
N planned work items
N generationJobs
N * outputCount Assets at maximum
```

Parallel graph branches and independent work items may execute concurrently
within organization/provider concurrency limits.

---

## 15. Database Seam For Iteration

The existing database correctly supports:

- one run containing several different generation-node jobs;
- one generation job producing several Assets through `outputIndex`;
- immutable source and exact-input provenance;
- run-scoped upstream output resolution.

It currently assumes one job per logical node per run:

```txt
flowRunNodes primary key = (flowRunId, nodeId)
flowRunNodes.jobId       = singular
job idempotency          = flowRunId:nodeId
```

That is sufficient for the M4 editor but not the M5 mock engine. Before M5
iteration execution ships, add an execution-item layer and allow one logical
item to own one or more provider-request jobs:

```txt
flowRunNodes
  one aggregate row per logical node
  status/progress summary for the canvas

flowRunNodeItems
  flowRunId
  nodeId
  itemKey
  dimensions + lineage snapshot
  status
  primary key (flowRunId, nodeId, itemKey)

generationJobs
  flowRunId
  nodeId
  itemKey
  requestIndex
  requestedOutputCount
  unique (flowRunId, nodeId, itemKey, requestIndex)
```

Generation-job idempotency becomes:

```txt
flowRunId:nodeId:itemKey:requestIndex
```

`itemKey` must be deterministic from the planned lineage and coordinate, not
merely the current array position. Reordering unrelated items should not make
completed work indistinguishable from different work.

Output multiplicity and execution multiplicity are different. Several provider
requests may contribute ordered output Assets to one item's inner typed
collection; only an explicit iterator creates additional outer items. Implement
this persistence seam during M5, after the planner proves the final item/request
contract and before iterative execution is admitted.

---

## 16. Full-Flow Execution

Full-flow execution reuses the same jobs and runtime values:

```txt
1. Snapshot the selected graph.
2. Topologically group executable nodes into levels.
3. Resolve pure source/transform nodes in the planner.
4. Plan work items for the current executable level.
5. Execute independent jobs concurrently.
6. Persist successful outputs as canonical Assets.
7. Resolve those outputs into same-run PortValues.
8. Plan the next level just in time.
9. Skip blocked descendants after failures.
10. Aggregate run status and cost.
```

Just-in-time child creation is necessary because downstream inputs may be Assets
that do not exist until upstream jobs finish.

Failure semantics:

```txt
one failed item      -> that item and dependent lineage fail/skip
independent branches -> continue
some success         -> partial run
no success           -> failed run
cancellation         -> cancel active work and remaining planned items
```

---

## 17. Caching And Creative Iteration

Caching is an execution optimization, not graph state. A cache key must include
all facts that can affect the result:

```txt
node executor/version
provider and model
normalized settings
resolved prompt/context
exact ordered provider Asset inputs
relevant model/provider adapter version
batch item lineage where behavior depends on it
```

The request hash and immutable provenance provide the foundation. A future cache
lookup may reuse a prior succeeded result only when:

- the organization is authorized to access every output;
- the output Assets still exist and are usable;
- the complete normalized execution input matches;
- the user has not explicitly forced a rerun;
- product policy allows reuse for that provider/model.

Changing a prompt invalidates affected downstream work. Changing only a video
node should not regenerate an unchanged upstream image. Individual-node reruns
remain available for deliberate exploration.

---

## 18. Recipes And Tools

Recipes and Tools solve different problems.

### Recipe

A Recipe is a graph template:

```txt
saved nodes + edges
copied into a Flow with fresh IDs
transparent and editable after insertion
no independent runtime identity
```

### Tool

A Tool is an editable product identity backed by an editable draft Flow. A
ToolVersion is the immutable, published executable contract:

```txt
tool
  -> draftFlowId -> editable normalized Flow
  -> currentPublishedVersionId -> mutable default pointer
  -> toolVersion
     -> immutable graph snapshot
     -> declared typed inputs
     -> declared typed outputs
```

Publishing uses the same coherent snapshot builder as run admission and creates a
new monotonic version; versions are never updated or reused. Existing Tool nodes
and historical runs remain pinned to their original version unless the user
explicitly upgrades them. Editing the draft after publishing affects no installed
node or active/historical run.

Tool ports use the same runtime model as ordinary node ports:

```ts
interface ToolPortDefinition {
  id: string
  valueType: FlowValueType
  aggregation: InputAggregation
  required: boolean
  maxItems: number | null
}
```

A Tool invocation creates a child `flowRun` over its immutable graph snapshot.
Its internal provider calls remain ordinary generation jobs.

Default invocation through UI, API, or MCP resolves
`currentPublishedVersionId` once and records the concrete `toolVersionId` on the
run. Explicitly versioned invocation bypasses that pointer. The run copies or
references the exact immutable executable snapshot and never rereads the Tool
draft. API/MCP retries reuse the same domain idempotency key and resolved version.

Tool outputs must bind ordered runtime values, not a singular `portId -> assetId`
mapping:

```ts
interface ToolOutputBinding<T> {
  items: readonly FlowItem<T>[]
  portId: string
  valueType: FlowValueType
}
```

This allows the same Tool version to run from:

```txt
the TaleLabs canvas
another Flow
another Tool
the public API
MCP
```

API and MCP callers receive an asynchronous run identity and typed result
metadata. Binary outputs remain canonical Assets and are returned through
authorized signed URLs or resource endpoints rather than embedded permanently
inside the Tool record.

Before Tools or public API/MCP invocation ship, product-controlled limits must
bound published graph size, snapshot bytes, nested Tool depth, expanded work
items, executable nodes, outputs, run duration, and estimated provider exposure.
The planner enforces these after version resolution and before creating a run;
Trigger concurrency is queue protection, not cost or graph-complexity admission.

### Production references

The draft/version/alias/run distinction follows the production model used by
AWS Step Functions: versions are immutable numbered snapshots, aliases are
mutable pointers, and executions are associated with the concrete version
resolved at start. Trigger.dev similarly version-locks task runs and supports
atomic application/task deployments. PostgreSQL's JSONB guidance supports the
hybrid used here: normalized mutable graph rows plus bounded immutable snapshot
documents.

- https://docs.aws.amazon.com/step-functions/latest/dg/concepts-cd-aliasing-versioning.html
- https://docs.aws.amazon.com/step-functions/latest/dg/execution-alias-version-associate.html
- https://trigger.dev/docs/deployment/overview
- https://trigger.dev/docs/deployment/atomic-deployment
- https://trigger.dev/docs/limits
- https://www.postgresql.org/docs/current/datatype-json.html#JSON-DOC-DESIGN

---

## 19. UX Contract

The engine model should make the UI clearer, not expose implementation details.

### Element node

```txt
Character: Maya
  Context       -> structured instructions
  Appearance    -> 8 images
  Expressions   -> 4 images
  Motion        -> 1 video
  Voice         -> 1 audio
```

One role has one handle. Do not render one handle per Asset.

### Generation input

```txt
Subject references
3 of 8 selected
Selection: Automatic | Manual
```

The consumer selects a model-compatible subset. The Element node remains a
stable reusable collection.

### Batch preview

Before execution, show:

```txt
Prompt variations:       4
Reference variations:    3
Provider jobs:           12
Outputs per job:          2
Expected Assets:         24
Estimated credits:      ...
```

Do not hide multiplication behind an edge connection.

### Results

The node presents:

- queued/running/failed state;
- latest result set;
- previous execution history;
- output count and navigation;
- rerun and force-rerun actions;
- ability to pin/select an output for downstream manual chaining.

---

## 20. Milestone Path

```txt
M4  Canvas foundation
    Text, Asset, Element
    Image, Video, Audio Generation
    curated stable TaleLabs model identities
    operation/mode, capability, and cross-field-constraint-driven node forms
    public capability registry separated from server-only provider routes
    typed handles and connection validation
    dynamic Element role handles
    autosave and conflict handling
    no execution

M5  Provider-independent engine
    real input resolution and immutable snapshots
    selected-node, downstream, and full-flow execution
    normalized immediate/asynchronous provider lifecycle contract
    deterministic image, video, and audio provider mocks
    multiple outputs and request sharding
    Iterator/Map, Collect, Zip, Prompt Iterator
    Trigger.dev durability, retries, cancellation, partial failure
    immutable provenance and canonical output Assets
    node result history

M6  Controlled provider integration
    replace only normalized adapter boundaries
    first approved image, video, and audio adapters
    pinned endpoint or safe capability-intersection routing
    registry drift checks and provider lifecycle parity
    provider parity, spend controls, controlled smoke checks

M7  Internal MVP candidate
    tenant and reliability audit
    operational cleanup and staging
    engineering and user acceptance gates

Later productization milestone
    Recipes
    versioned Tools
    API and MCP execution
```

Iteration is an authorized M5 engine concern, not M4 scope. Tools remain a
committed architectural direction for later productization. The engine must
leave its documented Tool/versioning seams without building that product surface.

---

## 21. Non-Negotiable Invariants

1. Every successful generated file becomes a canonical Asset.
2. Graph topology and draft configuration never contain generated result truth.
3. Element role collections and batch execution items remain distinct.
4. Iteration is explicit and cost-visible.
5. Provider limits are enforced by consuming model slots, not Element capacity.
6. Every provider call has its own durable job, retry boundary, and cost record.
7. Every runtime item has stable identity and lineage.
8. Full-flow upstream outputs resolve within the same run and item lineage.
9. Historical provenance never changes after later Flow, Element, or Asset-link
   edits.
10. Tools execute through the same planner and run system as ordinary Flows.
11. Tool versions and run snapshots are immutable.
12. React Flow remains an editor; server planning remains authoritative.
13. Run admission revalidates Flow and Element revisions before commit.
14. Every run is pinned to compatible executor code and receives only ID-sized
    Trigger payloads.

The concise mental model is:

> A wire carries an ordered list of typed runtime items. Each item may contain a
> collection consumed together. Explicit iterator nodes create additional items.
> The planner expands those items into durable provider jobs, and every successful
> provider output becomes a canonical Asset with immutable lineage.
