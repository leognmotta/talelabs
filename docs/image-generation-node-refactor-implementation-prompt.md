# Image Generation Node Refactor - Implementation Prompt

Use this prompt in a dedicated implementation session after the approved Video
Generation node refactor is stable.

## Objective

Replace the current TaleLabs Image Generation node with a dedicated,
model-adaptive node built from first principles.

This is not a restyle of the current generic `GenerationFlowNode`. Do not reuse
the generic Image Generation renderer, its operation picker, its layout, or its
user-facing interaction model. Remove the Image branch from that renderer after
the dedicated component is registered. Audio may continue using the generic
renderer until its own approved refactor.

Follow the design direction already approved for the dedicated Video Generation
node:

- the node is a compact creative surface, not an administrative form;
- model selection determines the available inputs and settings;
- connected inputs determine the internal operation;
- there is no user-facing operation or mode selector;
- the selected node's inspector contains model configuration and a clear input/
  output summary;
- the node toolbar contains the same generation actions and visual language;
- advanced/provider-specific facts never crowd the canvas;
- the implementation is Asset-first and independent from Elements.

The active product sequence remains:

```txt
Assets
-> approved model-adaptive canvas nodes
-> deterministic mocked canvas behavior
-> user-owned UX approval
-> rewritten run-engine plan
-> real provider integration
```

Do not call OpenRouter or another generation provider. Do not spend credits. Do
not implement adapters, Trigger.dev tasks, run admission, or generation jobs.
Keep the later provider replacement isolated to the normalized adapter boundary.

## Read Before Editing

Read:

```txt
AGENTS.md
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/mvp-execution-plan.md
docs/video-generation-node-refactor-implementation-prompt.md
```

Inspect the current implementation and the approved Video node before planning:

```txt
packages/flows/src/generation-registry-types.ts
packages/flows/src/generation-models/common.ts
packages/flows/src/generation-models/image.ts
packages/flows/src/generation-registry.ts
packages/flows/src/generation-evaluator.ts
packages/flows/src/video-generation-resolver.ts
packages/flows/src/node-registry.ts
packages/flows/src/handles.ts
packages/flows/src/graph-validation.ts
apps/api/src/routes/config/config.routes.ts
apps/api/src/routes/config/config.schemas.ts
apps/api/src/routes/config/generation-provider-routes.ts
apps/dashboard/src/features/flows/nodes/generation-flow-node.tsx
apps/dashboard/src/features/flows/nodes/video-generation/
apps/dashboard/src/features/flows/flow-dashboard-node-registry.ts
apps/dashboard/src/features/flows/flow-generation-settings-card.tsx
apps/dashboard/src/features/flows/flow-node-toolbar.tsx
apps/dashboard/src/features/flows/use-flow-canvas-controller.ts
```

Use the installed React Flow, React composition, i18n, OpenRouter image/model,
and review skills. Recheck current official OpenRouter discovery and provider
documentation during implementation; dated capability facts in this prompt are
evidence, not permanent truth.

## Product Contract

There is one Image Generation node.

The node has only three semantic ports:

```txt
prompt          Text input
imageReferences ImageSet input, only when the selected model supports it
images          ImageSet output
```

The user never chooses `textToImage`, `imageToImage`, `edit`, or another
technical operation. TaleLabs derives the operation:

```txt
no image references connected -> textToImage
one or more image references   -> imageToImage
```

The operation remains an internal validation, snapshot, routing, and provenance
fact. It is not a user-facing mode selector.

Unlike Video Generation, Image Generation has no competing frame/reference
families. Do not copy Video's mode complexity into this node. The meaningful
variation is:

- whether image references are supported;
- the hard reference-item limit;
- fixed or configurable output count;
- model-specific settings and constraints;
- raster versus vector output, when a vector model is intentionally enabled in
  a later registry release.

## Required User Experience

Build a dedicated `ImageGenerationFlowNode` that visually belongs beside the
approved `VideoGenerationFlowNode`.

### Node surface

- Reuse the approved Video node's shell width, header hierarchy, selected state,
  toolbar position, borders, spacing, typography, and output-handle treatment.
- Use an image preview as the main body. Keep the node's outer dimensions stable
  while fitting the selected aspect ratio inside the preview area; switching
  from portrait to landscape must not cause a disruptive canvas layout shift.
- Render an image placeholder before generation and a representative output
  after mocked/real output exists.
- If `outputCount` is greater than one, keep one `images` output handle and show
  a compact count/stack indicator. Do not render one output handle per image.
- Put the prompt editor below the preview using the same external-prompt
  behavior as the Video node: a connected Text input is authoritative while the
  inline draft remains preserved.
- Render the prompt handle and optional image-reference handle on a stable left
  rail. Render the `images` output handle on the right.
- Show connected image references as compact, inspectable thumbnails/counts.
  Full reference selection belongs in the existing input inspector, not in an
  oversized node.
- Use the same node toolbar actions and language as the Video node. Generalize
  toolbar eligibility through node registry metadata or a focused helper; do
  not replace `isVideoGeneration` with an accumulating chain such as
  `isVideoGeneration || isImageGeneration || ...`.

### Inspector

Create a dedicated `ImageGenerationSettingsCard` following the approved Video
inspector:

1. model picker;
2. only configurable settings supported by the selected product contract;
3. the existing clear Inputs and outputs summary;
4. explicit contract-upgrade action when the saved node uses an older contract;
5. no provider logos, native provider IDs, endpoint names, or routing controls.

Do not render disabled controls for fixed facts. For example, a model with one
fixed output does not need an output-count selector. A fixed resolution may be
shown as compact informational metadata if it helps the user understand the
result, but it is not an interactive setting.

### Settings vocabulary

The public registry may use these stable TaleLabs setting IDs when supported by
the selected model contract:

```txt
aspectRatio
resolution
outputCount
quality
background
outputFormat
outputCompression
seed
```

Do not add every setting to every model. The inspector is generated from the
curated contract for the selected model and resolved operation.

Use progressive disclosure:

- primary: aspect ratio, resolution, output count, quality;
- advanced: background, output format, compression, seed;
- provider passthrough such as `steps`, `guidance`, `safety_tolerance`, Recraft
  `controls`, or moderation policy stays server-only until TaleLabs deliberately
  designs and validates a provider-independent product control.

Do not use a magic numeric seed such as `-1` to mean random. Either extend the
shared setting contract with a properly optional integer representation or keep
seed in reviewed evidence and defer its UI. Do not add a malformed control only
to claim feature completeness.

### Conditional settings

Encode cross-field rules in the shared capability contract/resolver, not React:

- transparent background is valid only when the product route supports it and
  the selected format carries alpha;
- output compression is meaningful only for a format/route that supports it;
- output count must stay inside the selected model's declared range;
- aspect ratio and resolution values must come from the selected route's safe
  capability set;
- unsupported saved settings are removed/reset atomically when the model
  changes or a contract is upgraded.

## Input Availability And Operation Resolution

Reuse a shared input-availability vocabulary where the semantics genuinely
match Video. Do not make a second frontend-only truth table.

```ts
type GenerationInputAvailability =
  | { state: 'unsupported' }
  | { state: 'available' }
  | { state: 'connected'; connectionCount: number; itemCount: number }
  | {
      state: 'blocked'
      reasonKey: string
      conflictingSlotIds: readonly string[]
    }
  | { state: 'full'; reasonKey: string }
```

For the initial Image node:

1. Prompt is supported and required by every enabled model.
2. `imageReferences` is absent for a deliberately text-only product contract.
3. A supported reference handle is available until the selected runtime items
   reach its hard limit.
4. At the limit, keep the supported handle visible in `full` state and explain
   the limit through localized accessible copy.
5. Image inputs have no frame/reference conflict. Do not render a blocked state
   unless a real reviewed constraint requires it.

Implement a pure, deterministic, React-free resolver in `@talelabs/flows`:

```ts
resolveImageGenerationState({
  model,
  connectionCounts,
  itemCounts,
  inlinePrompt,
  settings,
}) => {
  resolvedOperationId,
  readiness,
  inputAvailability,
  visibleSettingIds,
  normalizedSettings,
  issues,
}
```

Required behavior:

1. Resolve `imageToImage` when at least one image-reference runtime item is
   selected and the model contract supports the operation.
2. Otherwise resolve the curated default `textToImage` operation.
3. Require an effective prompt from either the connected Text input or the
   inline prompt according to the existing documented composition rule.
4. Validate both connection count and selected item count. One incoming
   `ImageSet` edge may contain several image references.
5. Apply per-slot and total reference limits deterministically.
6. Drive handle visibility, global connection admission, graph validation,
   setting visibility, and future server admission from the same resolver.
7. Rederive the operation on the server and reject a mismatched stored value.

`operationId` may remain in node data only as a derived compatibility/snapshot
field. It is never user-selected authority.

## Collection Semantics

Preserve the Flow runtime distinction:

```txt
ImageSet assets = images consumed together by one generation request
PortValue items = explicit execution/batch multiplicity
```

If `outputCount = 4`, one generation produces one `ImageSet` containing four
output Assets. It does not silently create four outer batch coordinates or four
independent downstream executions. Iteration remains an explicit future Flow
operation.

Reference ordering follows persistent edge order and then the existing stable
selection order. Automatic selection may take the first compatible items up to
the model limit; the inspector must show the exact selection and allow the user
to change it. Never depend on browser insertion order.

## Stable Handles And Connections

Use these handle IDs:

```txt
prompt
imageReferences
images
```

The existing image slot named `references` must not coexist indefinitely with
`imageReferences`. Add a node schema version/upcaster or an explicit migration
path that preserves compatible saved edges and rewrites the old semantic handle
once. Do not mutate immutable historical model contracts.

- `imageReferences` accepts `ImageSet` only.
- `images` emits `ImageSet` only.
- An image Asset connection is unambiguous and may target
  `imageReferences` automatically when that handle exists.
- Use React Flow's global `isValidConnection` path and shared graph validation.
- Call `useUpdateNodeInternals(nodeId)` when a model/contract change changes the
  rendered handle set or positions.
- Do not hide a connected handle with CSS before graph reconciliation.
- Keep stable handle IDs across available, connected, full, and disabled visual
  states.

Elements are not part of this task. Do not add Element handles, context slots,
source/master selection, or Element readiness behavior. Existing Element code
may remain elsewhere, but the new Image node must work completely through Text,
Assets, and prior typed Flow outputs.

## Changing Models

Changing models must use the same approved non-interrupting reconciliation
behavior as the current Video node unless current product QA has deliberately
changed that behavior:

1. preserve compatible prompt, edges, selections, and settings;
2. remove/reset incompatible edges, excess selected items, and unsupported
   settings as one canvas mutation;
3. normalize defaults from the target contract;
4. recompute the derived operation;
5. update React Flow internals after the handle set changes;
6. rely on the updated node state and Undo history for recovery; do not require a
   confirmation dialog, notification modal, toast, or follow-up action.

Do not show a confirmation dialog if the approved Video node now applies changes
immediately. Image and Video must use one product rule for model changes.

## Curated Initial Model Catalog

On 2026-07-13, the read-only OpenRouter Image Models API returned 39 models.
Capture the complete external inventory for evidence/drift reporting, but do not
put all variants, previews, superseded models, utility models, vector models,
and `openrouter/auto` into the initial TaleLabs picker.

Use this focused initial catalog unless implementation-time evidence requires a
narrower contract:

| TaleLabs product model | OpenRouter evidence model | Image references | Verified normalized settings |
| --- | --- | ---: | --- |
| Nano Banana 2 Lite | `google/gemini-3.1-flash-lite-image` | 0-14 | resolution fixed at 1K, aspect ratio, output fixed at 1 |
| Nano Banana 2 | `google/gemini-3.1-flash-image` | 0-14 | 512/1K/2K/4K, aspect ratio, output fixed at 1 |
| Nano Banana Pro | `google/gemini-3-pro-image` | 0-14 | 1K/2K safe endpoint intersection, aspect ratio, output fixed at 1 |
| GPT Image 2 | `openai/gpt-image-2` | 0-16 | quality, background auto/opaque, output 1-10; compression is evidence-only until its format behavior is safely modeled |
| Seedream 4.5 | `bytedance-seed/seedream-4.5` | 0-14 | 2K/4K, explicit aspect ratio, output 1-10, seed if optional integers are modeled correctly; 2K must map to an explicit size of at least 3,686,400 pixels |
| FLUX.2 Pro | `black-forest-labs/flux.2-pro` | 0-8 | png/jpeg, output fixed at 1, seed if optional integers are modeled correctly |
| Recraft 4.1 | `recraft/recraft-v4.1` | deliberately text-only in the first TaleLabs contract | output 1-6; aspect ratio only if the chosen private route verifies Recraft `size` support |

### Important capability notes

- OpenRouter's dedicated image endpoint is the authoritative source for the
  capabilities guaranteed by an OpenRouter route. An absent endpoint capability
  is unsupported for that route, even when the native provider has a feature.
- Nano Banana Pro currently has two OpenRouter endpoints. Their safe resolution
  intersection is 1K/2K. Expose 4K only if the server-only route pins the Google
  AI Studio endpoint and disables incompatible fallback, or if discovery later
  proves 4K across every eligible endpoint.
- GPT Image 2's current OpenRouter endpoint descriptor does not advertise a
  normalized aspect-ratio/resolution control. Do not copy a competitor's 16:9/
  1K controls into the OpenRouter-backed product contract without route evidence.
  The existing direct OpenAI route may retain its own separately evidenced size
  contract; do not merge provider capability unions.
- Recraft's OpenRouter page and endpoint currently advertise one image input,
  while the supplied competitor UI presents Recraft 4.1 as text-only and native
  Recraft documentation has operation/version nuances. The first TaleLabs
  contract should intentionally be text-only. Record the discovered one-image
  capability as evidence and enable it only in a later reviewed contract.
- Recraft V4.1 vector variants produce SVG and require Asset MIME/preview/export
  design. Do not add them to this task merely because discovery lists them.
- Provider passthrough settings are not automatically product settings. A
  checked-in provider option does not authorize a public control.
- Keep stable TaleLabs IDs in Flow data. OpenRouter/native model IDs, endpoints,
  provider tags, evidence, and pricing remain server-only.

The initial model set should be enough to validate the product architecture
without turning the model picker into a provider directory. Adding another model
requires a concrete user benefit or a missing capability class, not catalog
completeness.

## Registry And Evidence Rules

At implementation time, capture current read-only discovery:

```bash
curl -fsSL https://openrouter.ai/api/v1/images/models
curl -fsSL https://openrouter.ai/api/v1/images/models/{author}/{slug}/endpoints
```

Do not send `POST /api/v1/images` and do not use `OPENROUTER_API_KEY` for this
task.

Maintain two concepts:

1. discovered inventory: current external facts and dated evidence;
2. enabled TaleLabs contract: reviewed stable IDs, inputs, settings, constraints,
   and output behavior used by the canvas.

The UI and API must read the checked-in, versioned TaleLabs registry. They must
not fetch live OpenRouter discovery to render nodes.

When several provider endpoints can serve one product route, expose only their
safe capability intersection. A wider contract requires an explicitly pinned
server-only route. Do not rewrite an already released registry version; add a
new immutable version and preserve historical resolution.

## Architecture And Reuse

Do not solve this in one large component and do not create a universal
Video/Image/Audio node with boolean props.

A reasonable media-specific structure is:

```txt
packages/flows/src/
  image-generation-resolver.ts
  generation-models/image.ts

apps/dashboard/src/features/flows/nodes/image-generation/
  image-generation-flow-node.tsx
  image-generation-input-rail.tsx
  image-generation-media-input.tsx
  image-generation-preview.tsx
  image-generation-prompt.tsx
  image-generation-settings-card.tsx
  use-image-generation-node.ts
```

Use the repository's actual conventions. Extract shared primitives only where
Video and Image now prove identical semantics, for example:

- generation setting field rendering;
- model picker composition;
- prompt field/external-prompt behavior;
- shared input-availability types;
- output-count badge;
- common toolbar eligibility metadata.

Keep these media-specific:

- image operation resolution;
- image preview and aspect fitting;
- image-reference presentation;
- model-specific settings and constraints;
- image inspector composition.

Register `imageGeneration` with `ImageGenerationFlowNode` in the exhaustive
dashboard node registry. Route the generation inspector to the dedicated Image
settings card without accumulating media-specific conditionals. Keep Audio on
the old path only until its planned refactor.

Do not add model-ID `if`/`switch` statements to React. Variation comes from the
versioned model contract and pure resolver.

## Mocked Behavior

This remains a canvas product-design phase.

- No remote generation request.
- No provider adapter.
- No Trigger.dev execution.
- No production run engine.
- No fake result should be presented as provider output.
- Expose deterministic readiness/resolution inspection and, if the current
  canvas supports mocked output previews, use stable local fixtures keyed by
  node/model/settings rather than random images.
- Do not create mock-only graph types, ports, planners, or persistence shapes.

The later engine must be able to consume the normalized facts produced by the
resolver, but this task must not prematurely resume M5.

## Internationalization

Follow every repository i18n rule. Never hard-code user-facing text.

Add natural translations for all supported locales for:

- image input/output labels;
- prompt labels and helper copy;
- full/unsupported/readiness states;
- model and setting labels;
- model-change feedback;
- output-count summaries;
- tooltips, accessibility labels, empty states, and validation messages.

Run `npm run i18n:check` and preserve complete catalogs.

## Documentation Updates Required

Update:

```txt
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/mvp-execution-plan.md
```

Document:

1. Image Generation has one model-adaptive node and no operation picker.
2. Image references infer image-to-image; their absence infers text-to-image.
3. The selected product model controls reference limits and visible settings.
4. One `ImageSet` output may contain multiple images without implying batch
   iteration.
5. The initial catalog is curated and intentionally smaller than discovery.
6. Elements are not required by the first Asset-to-Flow product loop.
7. This task remains mocked/provider-independent until user UX approval.

If persisted node data, handles, public config, or API schemas change, update
the corresponding database/API design documents and regenerate the SDK.

## Explicit Non-Goals

Do not:

- reuse or restyle the generic Image branch;
- create a user-facing operation selector;
- add separate text-to-image and image-to-image node types;
- implement real generation or spend credits;
- resume M5 execution/Trigger.dev work;
- add Element dependencies;
- expose every discovered OpenRouter image model;
- enable vector models without Asset SVG design;
- expose provider passthrough settings automatically;
- put provider names/routes into persisted Flow data;
- add model-specific React conditionals;
- silently leave incompatible edges/settings after a model change;
- claim UI/E2E QA on the user's behalf.

## Implementation Order

1. Inspect the approved Video node and current Image/generic implementation.
2. Capture current OpenRouter image inventory and per-endpoint evidence.
3. Define the focused enabled catalog and new immutable capability version.
4. Implement/extend shared setting and input-availability primitives where
   semantics are truly identical.
5. Implement `resolveImageGenerationState` and deterministic capability cases.
6. Version/upcast the Image node and `references` handle if required.
7. Update connection admission and graph validation to use the resolver.
8. Implement the dedicated Image node components and preview.
9. Implement the dedicated Image settings inspector.
10. Generalize generation toolbar/inspector dispatch without a universal node.
11. Remove the Image branch from `GenerationFlowNode`.
12. Update config schemas, SDK, translations, and source-of-truth docs.
13. Run verification and leave the feature ready for user-owned canvas QA.

## Acceptance Criteria

- Image Generation renders through `ImageGenerationFlowNode`, not the generic
  generation renderer.
- Its visual language matches the approved Video node.
- There is no operation picker.
- Text-only product contracts do not render an image-reference handle.
- Reference-capable models render one `imageReferences` handle.
- Connected ImageSets show selected/available item counts and inspectable
  thumbnails.
- Hard reference limits use runtime item counts, not only edge counts.
- Reaching a limit keeps the handle visible and explains why it is full.
- No reference resolves `textToImage`; references resolve `imageToImage`.
- Prompt readiness behaves identically to the approved Video prompt contract.
- Model switching preserves compatible state and atomically reconciles
  incompatible edges, selections, and settings.
- Model-specific controls match the curated route contract; unsupported/fixed
  settings are not rendered as editable controls.
- Output count produces one `ImageSet` containing N outputs.
- The output handle remains one stable `images` handle.
- React Flow updates handle internals after dynamic handle changes.
- The server can rederive the operation and reject client drift in future
  admission without reading React state.
- The enabled picker contains the focused initial catalog, not all 39 discovery
  entries.
- Public config exposes TaleLabs IDs and translation keys only.
- No provider call, adapter, Trigger.dev task, or credit spend is added.
- Existing autosave, organization isolation, graph limits, historical contract
  loading, and Asset input behavior remain intact.
- SDK generation, type checks, i18n validation, lint, production build,
  generation drift validation, and `git diff --check` pass.

UI and end-to-end QA belong to the user. The implementation summary must list
the exact model/input/settings combinations the user should verify manually.

## Research Evidence

Primary sources reviewed on 2026-07-13:

- OpenRouter Image Generation guide:
  <https://openrouter.ai/docs/guides/overview/multimodal/image-generation>
- OpenRouter Image Models API:
  <https://openrouter.ai/api/v1/images/models>
- OpenRouter per-model endpoint API pattern:
  <https://openrouter.ai/api/v1/images/models/{author}/{slug}/endpoints>
- OpenRouter GPT Image 2:
  <https://openrouter.ai/openai/gpt-image-2>
- OpenRouter Nano Banana 2:
  <https://openrouter.ai/google/gemini-3.1-flash-image>
- OpenRouter Recraft 4.1:
  <https://openrouter.ai/recraft/recraft-v4.1>
- OpenRouter Seedream 4.5:
  <https://openrouter.ai/bytedance-seed/seedream-4.5>
- OpenRouter FLUX.2 Pro:
  <https://openrouter.ai/black-forest-labs/flux.2-pro>
- Recraft API endpoints and compatibility:
  <https://www.recraft.ai/docs/api-reference/endpoints>
- Recraft supported sizes:
  <https://www.recraft.ai/docs/api-reference/appendix>
- React Flow handles:
  <https://reactflow.dev/learn/customization/handles>
- React Flow connection validation:
  <https://reactflow.dev/examples/interaction/validation>
- React Flow `useUpdateNodeInternals`:
  <https://reactflow.dev/api-reference/hooks/use-update-node-internals>

Treat screenshots supplied with this planning request as product interaction
references, not provider capability evidence. Recheck every dated model fact
when implementing because model catalogs and endpoint capabilities change.
