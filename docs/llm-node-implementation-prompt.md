# LLM Node - Implementation Prompt

Use this prompt in a dedicated implementation session after the approved Video
Generation node is stable. Reconcile it with the current Image and Audio node
work before editing shared generation contracts.

## Objective

Add one dedicated, model-adaptive `LLM` node to the TaleLabs Flow canvas.

The node is a one-shot creative text transformation step. It can enhance a
prompt, analyze reference images, write scripts or shot descriptions, summarize
creative material, and produce text for downstream image, video, audio, or LLM
nodes.

Follow the design direction already approved for the dedicated Video Generation
node:

- one product node instead of one node per provider or operation;
- the selected model determines which inputs and settings exist;
- connected inputs determine the internal operation;
- unsupported controls are absent rather than disabled clutter;
- conflicting model changes are explicit and reversible;
- the canvas is a compact creative surface, not an API playground;
- the inspector contains detailed configuration and input/output summaries;
- public product contracts use stable TaleLabs IDs;
- provider IDs, routing, credentials, and payload translation remain server-only;
- deterministic mocked behavior comes before any paid model call.

The active sequence remains:

```txt
Assets
-> approved model-adaptive canvas nodes
-> deterministic mocked canvas behavior
-> user-owned UX approval
-> rewritten run-engine plan
-> real provider integration
```

Do not call OpenRouter or another LLM provider. Do not spend credits. Do not add
Trigger.dev tasks, run admission, chat history, agents, tools, web search, or
real streaming in this task. Keep the future provider seam at the normalized
adapter boundary.

## Read Before Editing

Read:

```txt
AGENTS.md
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/mvp-execution-plan.md
docs/video-generation-node-refactor-implementation-prompt.md
docs/image-generation-node-refactor-implementation-prompt.md
```

Inspect the current implementation, especially the approved Video node:

```txt
packages/flows/src/types.ts
packages/flows/src/node-registry.ts
packages/flows/src/handles.ts
packages/flows/src/graph-validation.ts
packages/flows/src/generation-registry-types.ts
packages/flows/src/generation-registry-current.ts
packages/flows/src/generation-registry-history.ts
packages/flows/src/generation-registry.ts
packages/flows/src/generation-evaluator.ts
packages/flows/src/generation-models/
apps/api/src/routes/config/config.routes.ts
apps/api/src/routes/config/config.schemas.ts
apps/dashboard/src/features/flows/flow-dashboard-node-registry.ts
apps/dashboard/src/features/flows/flow-generation-settings-card.tsx
apps/dashboard/src/features/flows/flow-node-toolbar.tsx
apps/dashboard/src/features/flows/flow-input-state.ts
apps/dashboard/src/features/flows/use-flow-canvas-controller.ts
apps/dashboard/src/features/flows/nodes/video-generation/
```

Use the installed React Flow, React composition, i18n, OpenRouter model, and
review skills. Recheck the live OpenRouter Models API and official documentation
during implementation. Dated capability evidence in this prompt is not a
permanent production registry.

## Product Contract

There is one LLM node.

It has these semantic ports:

```txt
instructions     Text input, optional
prompt           Text input, required unless the inline prompt is non-empty
imageReferences  ImageSet input, only when the selected model supports images
text             Text output
```

The first version deliberately does not expose document, audio, or video input,
even when a selected OpenRouter model can technically accept them. Those media
families need their own researched file-size, duration, tokenization, URL,
privacy, and UX contracts. Do not advertise a capability only because it appears
in a provider discovery response.

The user never chooses `textToText`, `visionToText`, Chat Completions, Responses
API, or another technical operation. TaleLabs derives the operation:

```txt
no image references connected -> textToText
one or more images connected   -> visionToText
```

`instructions` does not define another operation. It is optional system-level
guidance used by either operation.

The resolved operation remains an internal validation, snapshot, routing, cost,
and provenance fact. It is not a user-facing mode selector.

## User Jobs

Optimize the first node for common creative workflow jobs:

```txt
enhance or rewrite a media-generation prompt
analyze the style, subject, composition, or mood of images
turn a brief into shot ideas or scene descriptions
create copy, scripts, captions, or voiceover text
summarize creative context for a downstream node
transform one text value into another reusable text value
```

This is not a chat surface. One run consumes the current connected inputs and
produces one text result. Multi-turn conversation state and agent execution are
separate product concepts.

## Research Baseline - 2026-07-13

The live OpenRouter Models API and official OpenRouter documentation were
reviewed on 2026-07-13. The API exposes input/output modalities,
`supported_parameters`, context limits, output limits, and a model-specific
`reasoning` object. It does not justify copying all provider parameters into the
TaleLabs UI.

Runway's official Workflow documentation confirms a useful competitor pattern:

- LLM nodes require a prompt;
- system instructions are a separate optional text input;
- LLM nodes can analyze images;
- text outputs can feed media-model prompts;
- advanced settings may include temperature and maximum output tokens.

TaleLabs should keep that typed composability while using the cleaner,
model-adaptive UX established by the Video node.

### Curated initial model matrix

Use stable TaleLabs model IDs in persisted Flow data. Native OpenRouter IDs in
the evidence column are discovery facts and future server-only route candidates.

| TaleLabs model | OpenRouter evidence | Images | Reasoning UI | Notes |
| --- | --- | --- | --- | --- |
| `talelabs/gemini-3.1-flash-lite` | `google/gemini-3.1-flash-lite` | yes | optional; `off`, `auto`, `minimal`, `low`, `medium`, `high` | Recommended economical default. Live metadata says reasoning defaults on at `minimal`. |
| `talelabs/claude-sonnet-4.6` | `anthropic/claude-sonnet-4.6` | yes | optional; `off`, `auto`, `low`, `medium`, `high`, `max` | Supports `verbosity`, but do not expose it separately in the first UI. |
| `talelabs/gpt-5.4` | `openai/gpt-5.4` | yes | optional; `off`, `auto`, `low`, `medium`, `high`, `xhigh` | OpenRouter does not advertise `temperature` for this model. Do not render one. |
| `talelabs/gemini-3.1-pro` | `google/gemini-3.1-pro-preview` | yes | mandatory; `auto`, `low`, `medium`, `high` | Reasoning cannot be turned off. The UI must never offer `off`. |
| `talelabs/deepseek-v3.2` | `deepseek/deepseek-v3.2` | no | optional; `off`, `auto` | Text-only. Current metadata does not expose selectable effort levels. |
| `talelabs/mistral-large-3` | `mistralai/mistral-large-2512` | yes | unsupported | Supports sampling controls, but no reasoning control. |

Do not add dynamic routers such as `openrouter/auto` to the first curated
contract. A dynamic route makes capabilities, reasoning behavior, input
modalities, pricing, and reproducibility vary after a Flow is saved.

Do not expose OpenRouter free variants as durable product models. Their
availability and expiration are unsuitable for a saved creative contract.

### Image-reference limit

The general OpenRouter Models API identifies image capability but does not
publish a reliable cross-provider maximum image count for every LLM route.
Use a conservative TaleLabs product limit of eight images per runtime item for
the initial vision-capable contracts.

This is a curated product limit, not a claim that each native provider has an
eight-image hard limit. Before real provider integration, pin each route and
verify its endpoint-specific payload, byte, image-count, and URL constraints.
If a safe route accepts fewer than eight, narrow that model contract before
shipping the route.

## Required User Experience

Build a dedicated `LlmFlowNode`. Do not render it through the generic
`GenerationFlowNode`.

### Canvas node

- Match the approved Video node's width, shell hierarchy, selected state,
  toolbar position, borders, spacing, typography, handle treatment, and
  inspector relationship.
- Use `LLM` as the user-facing node name. Do not use the provider endpoint name.
- The model label may appear in the node header, as it does for Video.
- The main body is a stable text-output preview.
- Before a run, show a localized empty state such as "Generated text will appear
  here."
- After mocked/real output exists, show a readable preview without allowing a
  long answer to resize the node indefinitely.
- Clamp long output on the canvas. Clicking the preview should open the full
  output in the existing inspector/detail pattern rather than creating a nested
  scroll area that competes with canvas wheel and pan gestures.
- Put the inline prompt editor below the output preview, following the Video
  node's authoritative-connected-prompt behavior.
- A connected `prompt` Text value is authoritative. Preserve the inline draft
  so disconnecting the edge restores the user's draft.
- Keep `instructions` out of the compact canvas body. It has a left-side Text
  handle and an editable inspector field.
- Render the optional image-reference handle on the stable left input rail only
  for image-capable models.
- Show connected images as compact thumbnails/counts. Full inspection and
  manual selection belong in the shared input inspector.
- Render one `text` output handle on the right. One run produces one Text runtime
  item, not a hidden array of alternatives.
- Add a Copy output action with an icon and tooltip. Disable it when no output is
  available and use the Clipboard API with localized success/failure feedback.
- Use the shared generation toolbar metadata. Do not add another branch such as
  `isVideoGeneration || isImageGeneration || isLlm`.

### Inspector

Create a dedicated `LlmSettingsCard`, following the dedicated Video inspector:

1. model picker;
2. system instructions editor;
3. response-length control;
4. reasoning control only when supported;
5. clear Inputs and outputs summary;
6. explicit model-contract upgrade action for old saved contracts;
7. no provider logos, native IDs, endpoint names, token prices, or routing UI.

The inspector must not repeat the inline prompt editor. `prompt` belongs to the
creative node surface; `instructions` belongs to configuration.

### Compact settings

The two primary first-version settings are:

```txt
responseLength
reasoningMode
```

Do not expose a universal temperature control. Live evidence shows that some
models support it and others, including GPT-5.4, do not. Temperature also has
different useful defaults across models. It may be added later as an advanced,
model-specific control after the setting contract supports an honest `auto`
state without overwriting provider defaults.

Do not expose `top_p`, `top_k`, penalties, seed, stop sequences, verbosity,
reasoning token budgets, raw max tokens, or provider passthrough fields in the
first UI.

## Response-Length Contract

Expose one provider-independent preset:

```ts
type LlmResponseLength = 'auto' | 'short' | 'medium' | 'long'
```

Use the localized label `Response length`, not `Token count`. Explain that this
is a maximum/intent and the model may answer sooner.

For the mocked phase, preserve only the semantic preset. At real integration,
the server adapter must resolve it to a route-specific output ceiling and record
the resolved value in immutable provenance.

Initial safe ceilings for the curated contracts:

```txt
auto   -> omit TaleLabs max-token override
short  -> at most 256 output tokens
medium -> at most 1,024 output tokens
long   -> at most 4,096 output tokens
```

These are upper limits, not promised response sizes. Do not inject invisible
style instructions merely to force a word count. If a future model supports a
native verbosity parameter, map it only through a reviewed route policy and
preserve both the semantic preset and resolved payload in provenance.

## Reasoning Contract

Use one semantic setting rather than a boolean plus a second effort selector:

```ts
type LlmReasoningMode
  = | 'off'
    | 'auto'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'max'
    | 'xhigh'
```

Each model contract declares:

```ts
interface LlmReasoningCapability {
  default: LlmReasoningMode
  mandatory: boolean
  options: readonly LlmReasoningMode[]
}
```

Rules:

1. A non-reasoning model has no reasoning setting or control.
2. An optional reasoning model may include `off`.
3. A mandatory reasoning model must not include `off`.
4. `auto` means use the curated model/route default. It does not mean choose a
   different model.
5. Render only the effort levels declared by the selected TaleLabs contract.
6. Changing to a model that cannot represent the saved reasoning value resets
   it to the new model's default through the normal immediate reconciliation
   path.
7. The future adapter maps the semantic mode to OpenRouter's unified
   `reasoning` object. Do not use deprecated `include_reasoning` as the primary
   contract.
8. Reasoning tokens are billable output tokens. Future cost estimates and
   provenance must include them.
9. Do not show chain-of-thought or raw reasoning by default. The creative output
   is the model's final Text response.

The current generic setting definition can represent `responseLength` and
`reasoningMode` as model-specific enums. Do not introduce an optional-number
setting or raw provider parameter only for this task.

## Input Availability And Operation Resolution

Reuse the same shared availability vocabulary used by the approved Video and
planned Image nodes. Do not create a frontend-only LLM truth table.

```ts
type GenerationInputAvailability
  = | { state: 'unsupported' }
  | { state: 'available' }
  | { state: 'connected'; connectionCount: number; itemCount: number }
  | {
      state: 'blocked'
      reasonKey: string
      conflictingSlotIds: readonly string[]
    }
  | { state: 'full'; reasonKey: string }
```

Implement a pure, deterministic, React-free resolver in `@talelabs/flows`:

```ts
resolveLlmState({
  model,
  connectionCounts,
  itemCounts,
  inlinePrompt,
  inlineInstructions,
  settings,
}) => {
  resolvedOperationId,
  readiness,
  inputAvailability,
  normalizedSettings,
  issues,
}
```

Required behavior:

1. Resolve `textToText` when no images are connected.
2. Resolve `visionToText` when at least one image is connected.
3. A text-only model never renders or accepts `imageReferences`.
4. Vision models accept one ImageSet collection with up to the curated hard
   item limit. Multiple images are consumed together; they do not create one
   LLM run per image.
5. A prompt is ready when either the inline prompt is non-empty or one external
   `prompt` connection exists.
6. One external prompt connection is the maximum. Iteration happens through the
   outer runtime item list of that connection, not by concatenating unrelated
   prompt edges.
7. `instructions` allows at most one Text connection. Its absence is valid.
8. If external instructions are connected, preserve but disable the local
   instructions draft just as the node preserves its inline prompt draft.
9. `imageReferences` stays visible in `full` state at its item limit and exposes
   localized limit guidance.
10. Unknown or unsupported settings fail validation. Do not silently send them.
11. The same resolver drives handle rendering, connection admission, graph
    validation, model switching, mocked run readiness, future run admission,
    and server validation.

The resolver must have no React, browser, database, OpenRouter, or provider SDK
dependency.

## Runtime Semantics

Preserve the Flow document's distinction between collections and execution
multiplicity:

```txt
ImageSet assets       = images consumed together in one LLM request
PortValue<Text> items = one or more LLM executions caused by explicit batching
```

Connecting an eight-image ImageSet to `imageReferences` means one LLM execution
with eight image references. It never means eight LLM calls.

Connecting a Text Iterator that produces four prompt runtime items means four
LLM executions. A singleton `instructions` value may broadcast across those
four prompt items under the future planner's explicit broadcast rules.

Do not implement iterator execution in this node task, but do not encode a data
shape that prevents it later.

## Model Switching

Changing models must follow the approved Video-node reconciliation behavior.

1. Compare all current edges, settings, and drafts against the target contract.
2. Preserve compatible prompt and instruction edges.
3. Preserve image edges only when the target model accepts images and its limit
   can contain the current selected items.
4. Remove image edges immediately when the target model cannot accept them.
5. Reset unsupported reasoning settings to the target contract's default.
6. Apply model change, edge reconciliation, operation inference, and setting
   normalization as one canvas history/autosave mutation.
7. Do not show a confirmation dialog, notification modal, or required follow-up
   action. The user's model selection is the confirmation.
8. Undo restores the entire previous state in one step.

Never reinterpret an image edge as another slot. Immediate deterministic
removal during an explicit model change is intentional product behavior.

## Shared Registry And Type Design

Do not create a second disconnected live model registry in the dashboard.
Extend the existing curated, versioned generation contract so Text output can
be represented without weakening media-reference types.

Preferred minimal direction:

```ts
type GenerationOutputType = 'audio' | 'image' | 'text' | 'video'
type GenerationReferenceMediaType = Exclude<GenerationOutputType, 'text'>
```

Use the output type for model/output definitions. Keep Asset reference
candidates constrained to actual Asset media types. If a smaller additive
change to the current `GenerationMediaType` is safer, document the choice and
ensure reference candidates cannot accidentally accept `text` as a media Asset.

Add `llm` as one explicit `FlowNodeType` and generation-node type. Do not call it
`text` because the existing Text node is a manual input node. Do not call it
`agent`; this node performs one model request.

Recommended files:

```txt
packages/flows/src/generation-models/llm.ts
packages/flows/src/llm-resolver.ts
apps/dashboard/src/features/flows/nodes/llm/llm-flow-node.tsx
apps/dashboard/src/features/flows/nodes/llm/llm-input-rail.tsx
apps/dashboard/src/features/flows/nodes/llm/llm-output-preview.tsx
apps/dashboard/src/features/flows/nodes/llm/llm-prompt.tsx
apps/dashboard/src/features/flows/nodes/llm/llm-settings-card.tsx
apps/dashboard/src/features/flows/nodes/llm/use-llm-node.ts
```

Split by responsibility as the Video node does. Do not put registry lookup,
resolver logic, React Flow connection inspection, settings UI, output rendering,
and copy behavior in one component.

### Node data

The initial node schema should preserve editable drafts and shared generation
metadata:

```ts
interface LlmNodeData extends GenerationNodeData {
  instructions: string
  prompt: string
}
```

Use strict Zod schemas, bounded string lengths, the current model-contract
version, strict settings, and input-selection validation. Add a first schema
version for the new node. Do not mutate historical schema/registry versions.

Do not persist mocked output inside `flowNodes.data`. Output belongs to run/node
result state and later immutable run provenance, not mutable node configuration.

### Stable handles

Use exactly:

```txt
instructions
prompt
imageReferences
text
```

Call `useUpdateNodeInternals(nodeId)` after a model change alters the rendered
handle set or positions. Never hide a connected handle before reconciliation.

## Mocked Output Boundary

Use the same deterministic mocked-generation boundary established for the other
approved canvas nodes.

- Running the node must never call OpenRouter in this phase.
- The mock result must be deterministic for the same normalized node data and
  resolved inputs.
- The UI must clearly behave like a result preview, not claim that a real model
  was called.
- Copy uses the current mocked output.
- Changing prompt, instructions, references, model, response length, or
  reasoning marks the previous result stale under the shared mocked-output
  behavior.
- Do not invent a second LLM-only execution store.
- Keep provider replacement at the normalized adapter boundary.

When real execution ships, one successful LLM result must preserve immutable
prompt, instructions, selected image IDs and ordering, model contract, resolved
operation, semantic settings, resolved provider payload, reasoning usage, token
usage, cost, and final text. Reconcile the AGENTS.md canonical-Asset rule before
integration: the Text runtime value must be backed by the approved canonical
text/document Asset or run-output persistence design, not transient browser
state.

## Public And Private Configuration

Public config may expose only:

```txt
stable TaleLabs model ID
localized model label key
recommended/enabled state
supported inputs
input item limits
reasoning options and default
response-length options
output type
contract version
```

Keep server-only:

```txt
OpenRouter/native model ID
provider route and fallback policy
API endpoint choice
credentials
raw supported_parameters
reasoning payload translation
response-length token mapping
pricing and margin policy
provider-specific payload quirks
```

Capture a dated OpenRouter LLM inventory/evidence artifact for drift review, but
do not build production UI directly from it. Registry changes require code
review, a contract-version bump, generated SDK updates, and deployment.

## Settings Deliberately Deferred

Research and record these capabilities, but do not add them to the first LLM UI:

```txt
temperature and other sampling controls
raw max tokens
provider verbosity
structured JSON output and JSON Schema
function/tool calling
web search
PDF/document inputs
audio/video understanding
conversation memory
reasoning traces
prompt caching controls
provider routing and fallbacks
```

Reasons:

- support differs by model and provider endpoint;
- some require new typed ports or output types;
- tools require a multi-step execution protocol, not a checkbox;
- structured output needs a schema editor and a non-Text runtime contract;
- web search changes cost, provenance, and citations;
- files, audio, and video need separate ingestion and limit contracts;
- exposing every sampler turns a creative node into an API console.

Future additions must be capability-driven and justified by user workflows.

## Cross-Cutting Implementation Impact

Update every exhaustive registry and generated contract affected by a new
`FlowNodeType`:

```txt
@talelabs/flows FlowNodeType and generation-node types
node schema registry and defaults
dynamic handle derivation
connection validation and admissibility
graph validation and model-contract checks
generation model registry and historical immutability checks
generation config API schemas
OpenAPI and generated SDK
dashboard node/component registry
node picker group/order/search
canvas creation defaults and history
settings-card dispatch
toolbar capability metadata
input inspector summaries
mocked output/readiness behavior
all source documentation that enumerates active canvas nodes
```

Do not add scattered `node.type === 'llm'` checks when registry metadata or a
focused type guard can express the capability once. Preserve exhaustive
TypeScript checks.

## Internationalization And Accessibility

All user-facing copy must use `@talelabs/i18n` and exist in:

```txt
en
pt-BR
pt-PT
es
fr
de
it
nl
pl
ro
```

Add natural translations for:

```txt
LLM node name and picker description
instructions and prompt labels/descriptions
image-reference label/limit guidance
generated-text empty, stale, pending, and error states
response-length label, helper, and options
reasoning label, helper, and supported options
mandatory-reasoning explanation
copy output action and feedback
model-change reconciliation messages
readiness and validation issues
```

Use localized `aria-label`, tooltip, and status copy. Handles must remain
keyboard-discoverable, blocked/full states must be explained, and the output
preview/copy action must work without pointer-only interaction.

## Acceptance Scenarios

The implementation is not complete until these focused scenarios pass:

1. Gemini 3.1 Flash Lite shows prompt, instructions, and image-reference inputs.
2. DeepSeek V3.2 shows no image input and rejects an image connection at the
   shared graph-validation boundary.
3. Mistral Large 3 renders no reasoning control.
4. Gemini 3.1 Pro renders reasoning without an Off option.
5. GPT-5.4 renders only its curated reasoning options and no temperature field.
6. Connecting one image changes the internal operation to `visionToText` without
   displaying a mode selector.
7. Disconnecting all images returns the operation to `textToText`.
8. Eight images are accepted as one ImageSet consumed by one run; the ninth is
   rejected/full without creating a batch.
9. An external prompt disables the inline editor while preserving its draft.
10. External instructions preserve the local instructions draft in the same
    way.
11. Switching from a vision model to DeepSeek shows exact image-edge removals;
    cancel changes nothing and confirm is one undoable mutation.
12. Switching from optional to mandatory reasoning removes Off only after the
    normal reconciliation path.
13. Long output never grows the canvas node indefinitely.
14. Copy is disabled before output and copies the complete result after output,
    not only the clamped preview.
15. Node data contains configuration only; mocked output is not persisted in
    mutable Flow node data.
16. No OpenRouter request or paid provider call occurs.
17. The public config and SDK contain no native provider ID, endpoint, API key,
    route policy, or price.
18. Historical registry hashes/contracts remain unchanged.

## Verification

Run the repository's applicable gates:

```txt
npm run sdk:generate
npm run check-types
npm run i18n:check
npm run lint
npm run generation:check
npm run build
git diff --check
```

Also run focused deterministic resolver/registry scenarios for:

```txt
text-only versus vision model
reasoning unsupported/optional/mandatory
response-length normalization
eight-image limit
operation inference
model-change reconciliation
registry/history immutability
public/private model-data separation
```

Automated tests are not an MVP acceptance requirement. Commit a repeatable
focused smoke/scenario script when that is the repository's established pattern.
Browser/UI QA and visual critique remain user-owned.

## Non-Goals

Do not implement:

- real OpenRouter/provider calls;
- chat history or conversation threads;
- agent loops;
- tools/function calling;
- structured JSON outputs;
- web browsing/search;
- document, audio, or video inputs;
- raw chain-of-thought display;
- iterator/full-flow execution;
- Trigger.dev orchestration;
- billing or credit enforcement;
- provider/model discovery-driven runtime UI;
- Element requirements;
- a universal API-parameter form.

## Sources

Primary evidence reviewed on 2026-07-13:

- OpenRouter Models API and model metadata:
  <https://openrouter.ai/docs/guides/overview/models>
- OpenRouter multimodal input contract:
  <https://openrouter.ai/docs/guides/overview/multimodal/overview>
- OpenRouter unified reasoning contract:
  <https://openrouter.ai/docs/guides/best-practices/reasoning-tokens>
- OpenRouter request parameters:
  <https://openrouter.ai/docs/api/reference/parameters>
- OpenRouter structured output documentation:
  <https://openrouter.ai/docs/guides/features/structured-outputs>
- OpenRouter tool-calling documentation:
  <https://openrouter.ai/docs/guides/features/tool-calling>
- Runway Workflow and LLM-node behavior:
  <https://help.runwayml.com/hc/en-us/articles/45763528999699-Introduction-to-Workflows>
- Runway LLM creative-pipeline example:
  <https://help.runwayml.com/hc/en-us/articles/45769159004691-Building-your-first-Workflows>
- FLORA image-to-text creative workflow:
  <https://docs.flora.ai/blocks/text-block/image-to-text>
- Model pages:
  <https://openrouter.ai/google/gemini-3.1-flash-lite>
  <https://openrouter.ai/anthropic/claude-sonnet-4.6>
  <https://openrouter.ai/openai/gpt-5.4>
  <https://openrouter.ai/google/gemini-3.1-pro-preview>
  <https://openrouter.ai/deepseek/deepseek-v3.2>
  <https://openrouter.ai/mistralai/mistral-large-2512>
