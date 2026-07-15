# TaleLabs - Flow Node And Runtime Planning

> **MVP scope notice (2026-07-14):** `assets-flows-mvp-contract.md` supersedes
> every Element-specific graph and runtime requirement in this document. The
> active graph accepts Text, canonical Assets, and prior node outputs only.
> Element sections remain historical design research and are not implementation
> requirements. The adaptive canvas UX is approved; M5 now implements the
> provider-independent durable engine described by the active sections below.

**Purpose:** define one durable mental model for the TaleLabs Flow canvas and
execution engine. This document explains what nodes and wires represent, how
Assets become reusable inputs, how generation executes, and how
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

| Concept          | Example                                     | Meaning                              |
| ---------------- | ------------------------------------------- | ------------------------------------ |
| Multiple handles | Video has first frame, references, and audio | Different semantic inputs             |
| Collection       | One upstream output contains four images     | Several references consumed together  |
| Provider outputs | One image request asks for four variations  | One job produces several Assets      |
| Batch items      | Four prompts leave a Text Iterator          | Several node executions              |

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
- dynamic model input-slot handles;
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
type ActiveFlowValueType =
  | "Text"
  | "Asset"
  | "ImageSet"
  | "VideoSet"
  | "AudioSet";
```

`ImageSet`, `VideoSet`, and `AudioSet` are deliberate. A set is a collection of
references that may be consumed together. It is not equivalent to iteration.

Saved edge identity defines source priority: ascending persistent edge ID is the
canonical edge order in the editor, API hydration, graph snapshots, and planner.
Automatic input selection must sort by that rule before applying model limits;
it must never depend on browser insertion order or database row order.

The current `packages/flows` registry already follows this direction. Asset and
generation nodes emit typed media sets, and model input slots state which set
types they accept. Released historical contracts may still decode
`ElementContext`, but current nodes must not expose or produce it.

---

## 5. Runtime Value Contract

Every resolved output port returns an ordered array of runtime items:

```ts
interface FlowItem<T> {
  /** Stable identity used by lineage, caching, retries, and idempotency. */
  key: string;

  /** The value carried by this execution item. */
  value: T;

  /** Upstream items that contributed to this item. */
  lineage: readonly FlowItemReference[];

  /** Explicit batch axes and the selected coordinate on each axis. */
  dimensions: Readonly<Record<string, string>>;
}

interface FlowItemReference {
  handleId: string;
  itemKey: string;
  nodeId: string;
}

type PortValue<T> = readonly FlowItem<T>[];
```

Media values are collections:

```ts
interface AssetReference {
  assetId: string;
  mediaType: "image" | "video" | "audio" | "document";
}

interface ImageSet {
  assets: readonly AssetReference[];
}

interface VideoSet {
  assets: readonly AssetReference[];
}

interface AudioSet {
  assets: readonly AssetReference[];
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
    key: "asset:asset_123",
    value: {
      assets: [{ assetId: "asset_123", mediaType: "image" }],
    },
    lineage: [],
    dimensions: {},
  },
];
```

### Media collection

A prior image-generation result with three outputs produces one runtime item
containing three references:

```ts
const appearanceOutput: PortValue<ImageSet> = [
  {
    key: "run-node:image-generation:outputs",
    value: {
      assets: [frontImage, profileImage, fullBodyImage],
    },
    lineage: [],
    dimensions: {},
  },
];
```

This means one reusable collection. Connecting it to a references input does
not create three jobs.

### Image Iterator

An Image Iterator transforms that one collection into three runtime items:

```ts
const iteratorOutput: PortValue<ImageSet> = [
  {
    key: "iterator_1:0",
    value: { assets: [frontImage] },
    lineage: [appearanceReference],
    dimensions: { iterator_1: "0" },
  },
  {
    key: "iterator_1:1",
    value: { assets: [profileImage] },
    lineage: [appearanceReference],
    dimensions: { iterator_1: "1" },
  },
  {
    key: "iterator_1:2",
    value: { assets: [fullBodyImage] },
    lineage: [appearanceReference],
    dimensions: { iterator_1: "2" },
  },
];
```

The Iterator explicitly introduces an execution axis. A downstream generation
node can now plan three work items.

This distinction cannot be represented by a flat `image[]` alone because a
collection consumed together and an Iterator batch would become
indistinguishable.

---

## 7. Input Aggregation Is Separate From Batch Expansion

An input-slot definition controls how values at one batch coordinate combine:

```ts
type InputAggregation =
  | "compose" // combine ordered Text fragments
  | "gather" // combine media references into one candidate set
  | "single"; // resolve exactly one selected value
```

Examples:

```txt
prompt       -> compose
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
- accepted media MIME, byte, duration, frame-rate, resolution, and aspect-ratio
  constraints where a media slot needs them;
- maximum incoming connections;
- declared per-slot and total operation reference limits;
- a researched lower recommended maximum when evidence supports one;
- reference purposes, multiple-subject support, and contact-sheet policy;
- required inputs, exact-one (`oneOf`) input groups, and at-least-one
  (`atLeastOne`) groups that allow several members together;
- operation output media and fixed or configurable output count;
- settings, visibility conditions, and incompatible option combinations;
- automatic versus manual selection behavior.

Enumeration settings render as finite selection controls. Numeric settings stay
numeric end to end and render through a bounded number input, slider, or stepper
using the registry's `min`, `max`, and `step`; the editor never expands a numeric
range into a generated option list. This avoids floating-point string identity
bugs and keeps large ranges renderable.

### Curated Model Registry And Provider Routes

#### Adaptive Video Operation Resolution

The Video Generation node has no operation picker. Its model exposes all
reviewed semantic inputs, while `resolveVideoGenerationState` derives one
operation from connection counts, selected item counts, settings, and the inline
prompt. The same React-free resolver drives handle availability, global
connection admission, setting visibility, graph validation, and future run
admission. Server validation rederives the operation and rejects a stored
`operationId` mismatch; the persisted field is derived compatibility/snapshot
data, never client authority.

The stable video input IDs are `prompt`, `firstFrame`, `lastFrame`,
`imageReferences`, `videoReferences`, and `audioReferences`. Unsupported handles
are absent. Conflicting supported handles remain visible and disabled. Frame
intent is established by either frame, but a last frame alone stays incomplete
until the required first frame is present. Reference-mode operations may use an
`atLeastOne` group so reviewed image, video, and audio references can coexist.
Frame and reference families remain mutually exclusive whenever no curated
operation accepts both.

Model changes apply immediately. They preserve compatible edges and settings,
remove or reset incompatible state without an interrupting confirmation dialog,
and update the model, edge reconciliation, setting normalization, input
selections, and derived operation in one canvas mutation. React Flow renders
stable handle IDs, keeps connected handles measurable, and refreshes node
internals after the model-supported handle set changes.

#### Adaptive Image Operation Resolution

Image Generation is also one dedicated model-adaptive node with no operation
picker. Its only semantic handles are `prompt`, optional `imageReferences`, and
the `images` output. `resolveImageGenerationState` derives `textToImage` when no
reference runtime items are selected and `imageToImage` when at least one is
selected. It combines connection counts with selected item counts, so one
incoming `ImageSet` edge can fill a model's multi-image limit. The same pure
resolver drives handle availability, connection admission, setting visibility,
setting normalization, draft validation, and later server admission; the server
rederives and verifies the stored compatibility `operationId`.

The selected product model decides whether references are supported, their hard
limit, and the settings visible in the inspector. The current Image catalog
fixes output count to one, so the node exposes no output amount control. Fixed
facts are not disabled controls. Model changes immediately
preserve compatible state and atomically remove or reset incompatible edges,
selections, and settings. The historical `references` handle is rewritten once
to `imageReferences` only during an explicit contract upgrade; immutable old
contracts remain unchanged.

The reviewed Image setting surface is route-specific:

- Nano Banana 2 Lite exposes aspect ratio; resolution is fixed at 1K.
- Nano Banana 2 exposes aspect ratio and 512/1K/2K/4K resolution.
- Nano Banana Pro exposes aspect ratio and the safe 1K/2K endpoint
  intersection.
- GPT Image 2 exposes quality, plus background as an advanced setting.
- Seedream 4.5 exposes aspect ratio (including provider `auto`) and
  1K/2K/4K resolution.
- FLUX.2 Pro exposes output format as an advanced setting.
- Recraft 4.1 has no editable scalar setting on the reviewed OpenRouter route.

There is no generic `creativity` setting. Seed, guidance, steps, Recraft
controls, and other provider passthrough values remain evidence-only until
TaleLabs defines an honest provider-independent control and its validation.

One request emits one `PortValue` item whose `ImageSet` contains one Asset. The
typed collection remains stable for downstream compatibility and does not create
an outer runtime item. The initial seven-model catalog is a deliberately curated
product selection. It has no Element input, provider route, or live provider
dependency on the canvas.

TaleLabs owns the production model catalog and private provider routes in
versioned TypeScript. Provider documentation is reviewed when those registries
change; TaleLabs does not maintain provider discovery snapshots or inventory
JSON. A remote catalog change must never add, remove, or alter a production
control without review and deployment.

Every persisted model reference uses a stable TaleLabs identity:

```ts
type ProductModelDefinition = {
  id: "talelabs/veo-3.1";
  capabilitySchemaVersion: 2;
  labelKey: "flows.models.veo31";
  mediaType: "video";
  inputSlots: GenerationInputSlotDefinition[];
  operations: GenerationOperationDefinition[];
  settings: GenerationSettingDefinition[];
  constraints: GenerationConstraintDefinition[];
};
```

The provider route is server-only and independently replaceable:

```ts
type ProviderRoute = {
  productModelId: "talelabs/veo-3.1";
  modelContractVersion: string;
  operationId: "textToVideo";
  adapter: "google-vertex";
  providerRoute: {
    policy: "pinned";
    endpoint: ":predictLongRunning";
    nativeModelId: "veo-3.1-generate-001";
    supportedParameters: string[];
  };
  lifecycle: {
    submission: "asynchronous";
    completions: ["poll"];
    deliveries: ["url"];
    cancellation: "unsupported";
  };
  evidence: { reviewedAt: string; sources: [string, ...string[]] };
  mockPricing: { source: "mock"; creditCost: 0; providerCostUsd: 0 };
  routeVersion: string;
};
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
version and reconciles incompatible connections, selections, and settings
immediately as one undoable canvas mutation. The user's model or contract
selection is the confirmation: do not interrupt it with a confirmation dialog,
notification modal, or required follow-up action. This explicit transition is
separate from passive hydration; loading an old node must never silently
reinterpret it through the current contract.

A capability definition is not just a flat collection of independent fields.
It describes valid operations and relationships between inputs/settings:

```ts
operations: [
  {
    id: "textToVideo",
    inputs: { prompt: { required: true } },
    inputSlotIds: ["prompt"],
    settingIds: ["aspectRatio", "durationSeconds", "resolution", "outputCount"],
    output: {
      mediaType: "video",
      count: { min: 1, max: 4, default: 1, settingId: "outputCount" },
    },
    referenceLimit: { maxItems: 0, slotIds: [] },
  },
  {
    id: "firstLastFrameToVideo",
    inputs: { prompt: { required: true }, firstFrame: { required: true } },
    inputSlotIds: ["prompt", "firstFrame", "lastFrame"],
    referenceLimit: { maxItems: 2, slotIds: ["firstFrame", "lastFrame"] },
  },
  {
    id: "referencesToVideo",
    inputs: { prompt: { required: true }, imageReferences: { required: true } },
    inputSlotIds: ["prompt", "imageReferences"],
    referenceLimit: { maxItems: 3, slotIds: ["imageReferences"] },
  },
  {
    id: "extendVideo",
    inputs: { videoReferences: { required: true } },
    inputSlotIds: ["prompt", "videoReferences"],
    referenceLimit: { maxItems: 1, slotIds: ["videoReferences"] },
  },
];

constraints: [
  {
    id: "references-require-eight-seconds",
    when: [
      { field: "operation", operator: "equals", value: "referencesToVideo" },
    ],
    require: [
      {
        field: "setting",
        id: "durationSeconds",
        operator: "equals",
        value: "8",
      },
    ],
  },
  {
    id: "last-frame-requires-first-frame",
    when: [{ field: "slot", id: "lastFrame", operator: "connected" }],
    require: [{ field: "slot", id: "firstFrame", operator: "connected" }],
  },
];
```

The shared public registry drives node rendering, handle visibility, connection
validation, exact-one and at-least-one input rules, output counts, accepted-media/reference
profiles, selection limits, settings, and server validation. Public presentation
uses translation keys rather than provider-name mapping tables. Native provider
identity and endpoints, lifecycle/cancellation behavior, dated evidence, route
versions, credentials, fallbacks, mock pricing, negotiated costs, and emergency
controls stay in a server-only registry. `GET /config/generation` returns only the
resolved public product contract.

Provider discovery has two safe policies:

1. pin a concrete provider endpoint and expose that endpoint's verified
   capabilities; or
2. allow routing across eligible endpoints and expose only the intersection of
   capabilities guaranteed by every eligible endpoint.

Never expose a model-level union while allowing routing to an endpoint that may
ignore one of those parameters. A manual/CI drift report may compare the curated
registry with OpenRouter's image/video/model discovery APIs, but it cannot edit
production behavior automatically.

Audio remains one output media family but is not one product intent. The canvas
has separate `speechGeneration`, `musicGeneration`, `soundEffectGeneration`,
`voiceChanger`, and `voiceIsolation` nodes. Every operation carries an
authoritative `nodeType`; pickers and server validation filter by that tag, not
by model ID, provider ID, operation label, or `mediaType`. A single model may
therefore expose separately tagged Music and Sound Effect operations while
remaining absent from Speech. Users never choose an operation from a dropdown.
All five nodes emit `AudioSet` through stable output handle `audio`, but they do
not share one provider request shape.

Known legacy `audioGeneration` nodes are lazily upcast during graph hydration:
ElevenLabs `textToSpeech` becomes `speechGeneration`, while
`textToSoundEffect` becomes `soundEffectGeneration`. Lock state, compatible
input selection, and compatible sound-effect controls are preserved. Unknown or
ambiguous legacy contracts remain on a hidden compatibility parser/renderer and
are never guessed into a new intent. The next ordinary graph save persists the
upcasted node type and schema.

The provider boundary uses one lifecycle contract without pretending every
provider completes synchronously:

```ts
type NormalizedGenerationSubmission =
  | { status: "completed"; outputs: NormalizedGenerationOutput[] }
  | { status: "submitted"; externalJobId: string; pollAfterMs?: number };

type NormalizedGenerationCompletionResult =
  | { status: "pending"; pollAfterMs?: number }
  | { status: "completed"; outputs: NormalizedGenerationOutput[] }
  | { status: "failed"; code: string; message: string; retryable: boolean };

type ProviderLifecycle = {
  submission: "immediate" | "asynchronous";
  completions: ("response" | "poll" | "webhook")[];
  deliveries: ("bytes" | "stream" | "url")[];
  cancellation: "supported" | "best-effort" | "unsupported";
};

type CompletionAdapter =
  | {
      lifecycle: ImmediateLifecycle;
      submit: CompletedSubmit;
      poll?: never;
      normalizeWebhook?: never;
    }
  | {
      lifecycle: PollLifecycle;
      submit: SubmittedSubmit;
      poll: Poll;
      normalizeWebhook?: never;
    }
  | {
      lifecycle: WebhookLifecycle;
      submit: SubmittedSubmit;
      poll?: never;
      normalizeWebhook: NormalizeWebhook;
    }
  | {
      lifecycle: PollWebhookLifecycle;
      submit: SubmittedSubmit;
      poll: Poll;
      normalizeWebhook: NormalizeWebhook;
    };

type CancellationAdapter =
  | { lifecycle: { cancellation: "unsupported" }; cancel?: never }
  | {
      lifecycle: { cancellation: "supported" | "best-effort" };
      cancel: Cancel;
    };

type GenerationAdapter = CompletionAdapter & CancellationAdapter;
```

An adapter may normalize immediate image results, raw/streamed media bytes, a
signature-verified webhook completion, or an asynchronous video job. Trigger.dev
durably coordinates submitted jobs, callbacks, polling, retries, cancellation,
and reconciliation; graph planning and output ingestion remain provider-
independent. The adapter discriminants require every method advertised by the
route lifecycle and prohibit poll, webhook, or cancellation methods when that
lifecycle does not support them.

### Research Baseline

The E-040 registry was reviewed against primary provider documentation on
2026-07-13:

- OpenAI marks GPT Image 1.5 deprecated with removal scheduled for 2026-12-01.
  It is absent from the current creative catalog and remains resolvable only in
  immutable historical contracts. New image nodes use stable TaleLabs ID
  `talelabs/gpt-image-2`, privately pinned to snapshot
  `gpt-image-2-2026-04-21`. The provider supports one through ten outputs, but
  the TaleLabs creative contract fixes that native parameter to one and does not
  expose it as a canvas setting. The curated safe contract keeps generate/edit,
  up to sixteen native image inputs, inline bytes or partial-image streaming,
  and no asynchronous job/cancel capability:
  <https://developers.openai.com/api/docs/deprecations>,
  <https://developers.openai.com/api/docs/models/gpt-image-2>, and
  <https://developers.openai.com/api/docs/guides/image-generation>.
- Veo 3.1 is privately pinned to stable `veo-3.1-generate-001` for text,
  first/last-frame, reference-image, and video-extension operations. The retired
  preview route is not eligible. The safe contract exposes 720p/1080p, both
  supported aspect ratios, at most three same-subject reference images, an
  eight-second reference operation, output count one through four, and async
  polling without claiming provider cancellation:
  <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate>,
  <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/use-reference-images-to-guide-video-generation>, and
  <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/extend-a-veo-video>.
- LTX 2.3 Pro evidence covers text and reference-audio operations with an
  optional image reference through asynchronous submit/poll jobs. TaleLabs
  deliberately retains the narrower verified 1080p product contract and one output:
  <https://docs.ltx.video/models> and
  <https://docs.ltx.video/api-documentation/api-reference/async-video-generation/get-job-status>.
- Eleven Multilingual v2 and Eleven Sound Effects v2 use distinct immediate
  audio contracts; TTS also has a pinned streaming route, while sound effects
  retain one output, duration 0.5–30 seconds, loop, and prompt influence:
  <https://elevenlabs.io/docs/api-reference/text-to-speech/convert>,
  <https://elevenlabs.io/docs/api-reference/text-to-speech/stream>, and
  <https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert>.

The checked-in 2026-07-13 OpenRouter inventory contains all sixteen models
returned by the read-only video catalog. It is evidence, not production
configuration. Narrow reviewed TaleLabs contracts enable Veo 3.1 Lite, Grok
Imagine Video, and Seedance 2.0 alongside the direct Veo 3.1 and LTX routes;
superseded, ambiguous, or insufficiently documented entries remain inventory-
only. No discovery response edits production behavior automatically. The
curated, versioned registry and its checked-in primary evidence remain
authoritative until an explicit reviewed deployment.

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
type NodeExecutionKind = "source" | "transform" | "executor" | "composite";
```

### Source nodes

Resolve existing state and do not require Trigger.dev:

```txt
Text
Asset
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
LLM
Video Generation
Speech Generation
Music Generation
Sound Effect Generation
Voice Changer
Voice Isolation
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

### Deferred Element node (historical, not registered)

The active graph registry has no Element node and M5 must not resolve this
contract. The following shape is retained only as prior research for a possible
post-billable-loop redesign:

```txt
elementId: relational FK
outputs:
  context       -> PortValue<ElementContext>
  role:<roleId> -> PortValue<ImageSet | VideoSet | AudioSet>
```

The Element has one stable handle per current registered role. Five roles mean
five reusable media outputs. Each role output is one runtime item containing its
ordered, ready, non-purging **master** Assets. Raw Element source evidence is not
part of the role value, does not count against model limits, and never reaches a
provider through an Element edge.

`context` remains `ElementContext`, not plain Text. This preserves semantic
origin, the upcasted Element identity contract, structured metadata, and
provenance. The planner composes its resolved text into the provider prompt when
appropriate.

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

### Audio intent nodes

```txt
Speech
  data: prompt + shared generation configuration
  input: prompt (shown as Script), Text, at most one connection

Music
  data: prompt + lyrics draft + shared generation configuration
  input: prompt; lyrics/image guidance only when an enabled model documents them

Sound Effect
  data: prompt + shared generation configuration
  input: prompt, Text, at most one connection

Voice Changer
  data: shared generation configuration, no prompt
  input: sourceMedia, AudioSet | VideoSet, exactly one selected runtime item

Voice Isolation
  data: shared generation configuration, no prompt
  input: sourceMedia, AudioSet | VideoSet, exactly one selected runtime item

all outputs:
  audio -> PortValue<AudioSet>
```

`resolveSpeechGenerationState`, `resolveMusicGenerationState`,
`resolveSoundEffectGenerationState`, `resolveVoiceChangerState`, and
`resolveVoiceIsolationState` are React-free wrappers over the shared audio
contract evaluator. Connected Text is authoritative without erasing an inline
draft. Unsupported handles and controls are absent. Model changes preserve
compatible data, report reset settings, keep stable compatible edges, and never
silently reinterpret the node's intent. Voice Isolation does not claim music
stem separation. No custom-voice or Element-backed voice system is part of the
first contract.

### LLM

```txt
data:
  modelId
  modelContractVersion
  operationId
  prompt
  instructions
  settings
  inputSelections

inputs:
  instructions      -> Text, optional, at most one connection
  prompt            -> Text, required unless the inline draft is non-empty,
                       at most one connection
  imageReferences   -> ImageSet, vision models only, at most eight items

output:
  text -> PortValue<Text>
```

The LLM node has no operation picker. `resolveLlmState` derives `textToText`
when no image runtime items are selected and `visionToText` when one or more are
selected. Instructions remain a separate input and never select an operation.
Connected prompt and instructions override, but do not erase, their inline
drafts. The first canvas behavior produces one deterministic ephemeral mocked
Text preview; it does not authorize run-engine, provider, job, provenance,
credit, or Asset-persistence work.

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

For a direct Asset source, the candidate is the referenced canonical Asset. For
an upstream node output, candidates are the ordered runtime items emitted by the
same run and lineage. The source snapshot records every candidate and exclusion;
`generationJobInputs` stores only the exact canonical Asset subset selected for
the provider-facing request.

This preserves two different facts:

```txt
generationJobSources = everything connected and considered
generationJobInputs  = exact binary Assets sent to the provider
```

Later edits to Assets, node configuration, or Flow edges
must never rewrite historical provenance.

Manual selection applies naturally to static Asset candidates. When generated
upstream outputs participate in multi-node runs, the
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

The five approved commands select executable generation/LLM/audio nodes as
follows. Source and deterministic control nodes participate in dependency
resolution but do not create provider jobs by themselves:

```txt
node        Run node       target executable node only; resolve required sources
downstream  Run from here  target plus executable descendants
upstream    Run till here  target plus executable ancestors needed to reach it
selection   Run selection  selected executable nodes only; resolve unselected
                           executable ancestors from prior outputs
all         Run all        every executable node in the saved Flow
```

`Run selection` must not regenerate unselected ancestors. Missing required prior
outputs reject preflight/admission instead of silently adding dependency jobs.
Selected edges and non-executable nodes alone do not make the command available.
The node toolbar owns `node`, `downstream`, and `upstream`; the main canvas
action bar owns `all`; the selection context menu owns `selection`.

Planning stages:

```txt
1. Flush canvas autosave, then load and verify the expected saved Flow revision.
2. Select the target subgraph for node, downstream, upstream, selection, or all.
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

The browser submits only command IDs and the expected revision, never graph
JSON. A server preflight returns a canonical `planHash` and scope/multiplicity
summary. Final admission replans and rejects revision or plan drift; it never
silently changes the graph revision behind the user's command.

Snapshot admission is a consistency boundary, not merely serialization. The
planner reads the Flow revision, resolves the selected graph and every mutable
Asset dependency, and revalidates the Flow revision immediately before inserting
the run. `flows.revision` protects nodes and edges. Selected Asset rows are
locked in stable ID order and revalidated as ready and not purging. Any revision
change causes the admission transaction to roll back and retry; a run must never
contain graph topology from one revision and node configuration from another.

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
  itemKey: string;
  dimensions: Readonly<Record<string, string>>;
  inputs: ResolvedInputMap;
  lineage: readonly FlowItemReference[];
}

interface NodeExecutionPlan {
  nodeId: string;
  workItems: readonly PlannedNodeExecution[];
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

Production dispatch keeps executor compatibility separate from deployment
identity. `executorVersion` is a code-owned snapshot/runtime contract. Trigger
selects and locks the current deployment when the run is accepted; the parent or
reconciler discovers that actual version at runtime and records it once as
`triggerDeploymentVersion`. Awaited child tasks remain on the parent deployment.
Snapshot readers retain deterministic upcasters for every supported
`snapshotVersion`, so queued or retried old runs remain executable after
application deployments without a manually maintained version environment
variable.

Task payloads stay intentionally small:

```ts
{
  (flowRunId, organizationId);
}
{
  (generationJobId, organizationId);
}
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
  id: string;
  valueType: FlowValueType;
  aggregation: InputAggregation;
  required: boolean;
  maxItems: number | null;
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
  items: readonly FlowItem<T>[];
  portId: string;
  valueType: FlowValueType;
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

### Deferred Element node research

This section is historical product research. Elements are not active MVP nodes,
run inputs, or dependencies.

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
    Text and Asset source nodes
    Image, Video, LLM, Speech, Music, Sound Effect, Voice Changer, Voice Isolation
    curated stable TaleLabs model identities
    operation/mode, capability, and cross-field-constraint-driven node forms
    public capability registry separated from server-only provider routes
    typed handles and connection validation
    autosave and conflict handling
    approved adaptive node UX

Deferred Element experiment
    retained outside navigation, search, graph schemas, hydration, and execution
    reconsidered only after the Assets + Canvas billable loop works

M5  Provider-independent engine
    direct Asset and same-run upstream-output resolution
    immutable graph, model-contract, candidate, selection, and input snapshots
    Run node, Run from here, Run till here, Run selection, and Run all
    normalized immediate/asynchronous provider lifecycle contract
    deterministic image, video, audio, and text provider mocks
    versioned private media fixtures copied to unique canonical output keys
    multiple outputs and request sharding
    typed item, dimension, and lineage seams for future iteration
    Trigger.dev durability, retries, cancellation, partial failure
    immutable provenance and canonical output Assets
    node result history

M6  Controlled provider integration
    replace only normalized adapter boundaries
    first approved image, video, and audio adapters
    pinned endpoint or safe capability-intersection routing
    TypeScript registry/route validation and provider lifecycle parity
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

Explicit iteration nodes are deferred until real workflow usage demonstrates the
need. M5 preserves only the typed runtime seams required to add them later. Tools
remain a committed architectural direction for later productization. The engine
must leave its documented Tool/versioning seams without building that product
surface.

---

## 21. Non-Negotiable Invariants

1. Every successful generated file becomes a canonical Asset.
2. Graph topology and draft configuration never contain generated result truth.
3. Typed media collections and batch execution items remain distinct.
4. Ordinary collection edges never create implicit iteration or hidden spend;
   future iteration must be explicit and cost-visible if it ships.
5. Provider limits are enforced by consuming model slots after source resolution.
6. Every provider call has its own durable job, retry boundary, and cost record.
7. Every runtime item has stable identity and lineage.
8. Full-flow upstream outputs resolve within the same run and item lineage.
9. Historical provenance never changes after later Flow or Asset edits.
10. Tools execute through the same planner and run system as ordinary Flows.
11. Tool versions and run snapshots are immutable.
12. React Flow remains an editor; server planning remains authoritative.
13. Run admission revalidates the Flow revision and locks exact Asset inputs
    before commit.
14. Every run is pinned to compatible executor code and receives only ID-sized
    Trigger payloads.

The concise mental model is:

> A wire carries an ordered list of typed runtime items. Each item may contain a
> collection consumed together. Explicit iterator nodes create additional items.
> The planner expands those items into durable provider jobs, and every successful
> provider output becomes a canonical Asset with immutable lineage.
