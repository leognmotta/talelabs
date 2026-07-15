# Video Generation Node Refactor - Implementation Prompt

Use this prompt in a dedicated implementation session.

## Objective

Replace the current TaleLabs Video Generation node with a new, dedicated,
model-adaptive node built from first principles.

This is not an incremental restyle of the existing generic generation node.
Do not reuse the current Video Generation renderer, its operation picker, its
layout, or its user-facing interaction model. Shared infrastructure may remain
where it is still correct: React Flow graph persistence, stable node IDs, typed
edges, Asset inputs, model-contract versioning, autosave, and reusable node-shell
primitives. The new video node itself must be a clean implementation designed
around the behavior in this document and the supplied visual references.

The product direction for this task is deliberately narrow:

```txt
Step 1: Assets + a high-quality canvas + deterministic mocked video output
Step 2: real AI integration only after the canvas product design is approved
```

Do not call OpenRouter or any other generation provider. Do not spend credits.
Do not implement provider adapters. Preserve the `TODO(provider-integration)`
boundary required by the execution plan wherever mocked behavior will later be
replaced.

## Read Before Editing

Read the repository instructions and these source-of-truth documents before
planning or changing code:

```txt
AGENTS.md
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/db-design-planning-v2.md
docs/api-design-planning-v2.md
docs/mvp-execution-plan.md
```

Inspect the current implementation to understand what must be replaced and what
shared infrastructure can remain:

```txt
packages/flows/src/generation-registry-types.ts
packages/flows/src/generation-models/video.ts
packages/flows/src/generation-registry.ts
packages/flows/src/generation-evaluator.ts
packages/flows/src/node-registry.ts
packages/flows/src/handles.ts
packages/flows/src/graph-validation.ts
apps/api/src/routes/config/generation-provider-routes.ts
apps/dashboard/src/features/flows/nodes/generation-flow-node.tsx
apps/dashboard/src/features/flows/flow-dashboard-node-registry.ts
apps/dashboard/src/features/flows/flow-generation-settings-card.tsx
apps/dashboard/src/features/flows/use-flow-generation-settings.ts
apps/dashboard/src/features/flows/use-flow-canvas-controller.ts
```

Use the installed React Flow, React, composition, i18n, and review skills. Read
the current official React Flow and OpenRouter documentation instead of relying
on remembered APIs.

## Product Lesson To Encode

Users should not choose a technical operation such as `textToVideo`,
`imageToVideo`, `referenceToVideo`, `videoToVideo`, or `audioToVideo`.

There is one Video Generation node. The selected model determines which input
ports exist. Connected inputs determine the compatible generation mode. The
node makes invalid combinations impossible and tells the user how to resolve a
conflict.

Internally, TaleLabs must still resolve a concrete operation for validation,
planning, immutable snapshots, provider routing, and provenance. The operation
is an implementation fact, not a user-facing mode selector.

Examples observed in competitor products:

- A multimodal/omni model may expose only image and video references.
- Seedance may expose first frame, last frame, image references, video
  references, and audio references. Connecting a frame disables the reference
  family; connecting a reference disables the frame family.
- Veo 3.1 Lite exposes first and last frames without generic references.
- A start-frame-only model exposes only its first-frame input.
- An audio-to-video model may expose audio plus an optional image reference.

These examples define the interaction pattern. They are not permission to
claim unsupported provider capabilities.

## Required User Experience

Build a dedicated `VideoGenerationFlowNode`. Do not render video through the
current generic `GenerationFlowNode` branch.

The node should follow the supplied visual references:

- A compact vertical video canvas/preview is the main body.
- A stable icon rail on the left contains only the model's supported inputs.
- Inputs may include first frame, last frame, image references, video
  references, audio references, and text prompt.
- Connected media appears as small, inspectable thumbnails/previews adjacent to
  the relevant input rather than as a separate administrative form.
- The prompt editor is part of the video node's creative surface.
- A compact footer contains model, aspect ratio, resolution, duration, audio,
  and other settings only when the selected model/current operation supports
  them.
- There is no operation/mode dropdown.
- A single output handle emits `VideoSet`.

This task establishes behavior and architecture. Preserve room for a later
visual-polish pass, but the implementation must already feel like one coherent
creative tool rather than a generic settings card attached to a blank preview.

### Input presentation states

Every potential input must resolve to one explicit presentation state:

```ts
type VideoInputAvailability =
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

Rules:

1. `unsupported`: do not render the input for this model.
2. `available`: render an enabled handle.
3. `connected`: render the handle, connected state, and media preview/count.
4. `blocked`: keep the model-supported input visible but disabled/faded. Give a
   localized tooltip or accessible description such as "Disconnect Start frame
   to use references." This makes the model capability discoverable.
5. `full`: keep the input visible and explain the model's limit.

Do not silently accept combinations that the provider would ignore. In
particular, OpenRouter documents that `frame_images` takes precedence when both
`frame_images` and `input_references` are sent. TaleLabs must treat those input
families as mutually exclusive for models that offer both.

### Mode inference

Implement a shared, pure, server-compatible resolver in `@talelabs/flows`. Do
not encode model IDs in React components.

Conceptually:

```ts
resolveVideoGenerationState({
  model,
  connectionCounts,
  itemCounts,
  settings,
}) => {
  candidateOperationIds,
  resolvedOperationId,
  readiness,
  inputAvailability,
  visibleSettingIds,
  issues,
}
```

Required behavior:

1. Start from the selected model's curated operations and constraints.
2. Eliminate operations that cannot accept the current connected slots.
3. Infer frame mode when either first or last frame is connected.
4. Infer reference mode when any supported image/video/audio reference is
   connected.
5. Frame mode and reference mode are mutually exclusive unless a researched
   model contract explicitly says otherwise.
6. A last frame may establish frame-mode intent while the node remains not ready
   until its required first frame exists.
7. For a model with no media connected, use its curated default operation,
   normally text-to-video.
8. An operation may require at least one member of a group while allowing more
   than one member, for example image + video + audio references. Do not misuse
   the existing exact-one `oneOf` contract. Add an explicit, well-named
   at-least-one group contract if needed.
9. A run is enabled only when one compatible operation is resolved and all
   required inputs/settings validate.
10. The same resolver must drive input rendering, connection admission, setting
    visibility, graph validation, run planning, and server validation. Do not
    create separate frontend and backend truth tables.

The resolver must be deterministic and free of React, browser, database, or
provider dependencies.

### Internal operation persistence

`operationId` may remain in persisted node data only as a derived compatibility
and snapshot field. It must not remain a user-selected setting.

- Recompute it from the model contract and current graph whenever relevant
  edges/model/settings change.
- Server validation and future run admission must rederive it and reject a
  mismatched stored value; never trust the client field as authority.
- Immutable run snapshots and generation jobs must store the concrete resolved
  operation.
- Preserve historical Video Generation node schemas and contracts. Add a new
  node schema version/upcaster if the current schema cannot express the new
  invariant safely.
- Do not rewrite historical registry versions in place.

If a different persistence design is materially safer, document the tradeoff in
the implementation summary before using it. Do not retain the existing explicit
operation picker merely to avoid a schema change.

### Connection rules

Use stable semantic handle IDs:

```txt
prompt
firstFrame
lastFrame
imageReferences
videoReferences
audioReferences
videos (output)
```

Do not collapse media references into a generic `references` handle. Separate
typed handles let React Flow prefilter compatible Assets and let model contracts
enforce per-media limits.

- Use React Flow's global `isValidConnection` path for graph-aware validation.
- Use `useUpdateNodeInternals(nodeId)` after the model changes or the rendered
  handle set/positions change.
- Keep handle IDs stable across visual states.
- Do not use `display: none` for a connected handle. A model change that would
  invalidate an existing edge must be reconciled before handles disappear.
- Add accessible disabled state and an explanatory tooltip to blocked handles.
- Connecting an Asset output to a video node should choose the matching typed
  slot only when unambiguous. Otherwise let the user choose among compatible
  slots; never guess between first frame and image reference without an explicit
  deterministic rule.

### Changing models

Changing the selected model applies immediately. The user's selection is the
confirmation; do not show a confirmation dialog, notification modal, or required
follow-up action.

1. Preserve compatible incoming edges, selections, drafts, and settings.
2. Remove or reset incompatible state deterministically.
3. Apply the model change, edge reconciliation, derived operation update, and
   setting normalization as one canvas mutation so autosave never observes a
   knowingly inconsistent intermediate state.
4. Record that mutation as one Undo step so the user can restore the previous
   model and graph state.

Never reinterpret an edge as a different semantic input merely to preserve it.

## Curated Capability Registry

Do not drive production UI directly from OpenRouter discovery. TaleLabs owns a
reviewed, code-versioned TypeScript model registry and server-only TypeScript
provider routes. Provider discovery may inform research but is not preserved as
checked-in configuration.

At implementation time, fetch the current read-only catalog:

```bash
curl -fsSL https://openrouter.ai/api/v1/videos/models
```

Do not send `POST /api/v1/videos` and do not use `OPENROUTER_API_KEY` for this
task.

On 2026-07-13, the endpoint returned the following 16 models:

| OpenRouter model | Frames reported by discovery | Output audio | Duration | Resolution |
| --- | --- | --- | --- | --- |
| `alibaba/happyhorse-1.1` | first | no advertised flag | 3-15s | 720p, 1080p |
| `alibaba/happyhorse-1.0` | first | no advertised flag | 3-15s | 720p, 1080p |
| `x-ai/grok-imagine-video` | first | no advertised flag | 1-15s | 480p, 720p |
| `kwaivgi/kling-v3.0-pro` | first + last | yes | 3-15s | 720p |
| `kwaivgi/kling-v3.0-std` | first + last | yes | 3-15s | 720p |
| `google/veo-3.1-fast` | first + last | yes | 4s, 6s, 8s | 720p, 1080p, 4K |
| `google/veo-3.1-lite` | first + last | yes | 4s, 6s, 8s | 720p, 1080p |
| `kwaivgi/kling-video-o1` | first + last | yes | 5s, 10s | 720p |
| `minimax/hailuo-2.3` | first | no | 6s, 10s | 1080p |
| `bytedance/seedance-2.0` | first + last | yes | 4-15s | 480p, 720p, 1080p, 4K |
| `alibaba/wan-2.7` | first + last | yes | 2-10s | 720p, 1080p |
| `bytedance/seedance-2.0-fast` | first + last | yes | 4-15s | 480p, 720p |
| `alibaba/wan-2.6` | first | yes | 5s, 10s | 720p, 1080p |
| `bytedance/seedance-1-5-pro` | first + last | yes | 4-12s | 480p, 720p, 1080p |
| `openai/sora-2-pro` | none reported | yes | 4s, 8s, 12s, 16s, 20s | 720p, 1080p |
| `google/veo-3.1` | first + last | yes | 4s, 6s, 8s | 720p, 1080p, 4K |

Review every model against current official evidence and add it to one of two
checked-in concepts:

1. `discovered inventory`: every current OpenRouter video model and raw evidence.
2. `enabled TaleLabs contract`: only capabilities we can safely validate and
   later route.

Do not equate those lists. Examples:

- Superseded versions may remain in inventory but be disabled.
- A model with conflicting discovery/model-page claims stays disabled or gets a
  deliberately narrow contract until resolved.
- The OpenRouter endpoint reliably exposes frames, durations, resolutions,
  aspect ratios, audio generation, seed, pricing SKUs, and passthrough names. It
  does not expose a complete typed reference-media/count contract for every
  provider.
- The OpenRouter request schema says audio/video `input_references` are currently
  honored by BytePlus Seedance 2.0. Do not expose audio/video references on other
  OpenRouter models based only on marketing copy or passthrough parameter names.
- OpenRouter descriptions currently support image-reference contracts for
  HappyHorse, Grok Imagine Video, Seedance 2.0/Fast, and Wan 2.7. Grok explicitly
  advertises up to seven image references. If an exact hard count is not
  documented for another model, use a clearly documented conservative limit;
  do not invent a provider maximum.
- `Gemini Omni Flash`, competitor-observed `Wan 2.5`, and `LTX Audio-to-Video`
  are useful UX examples but are not members of the 2026-07-13 OpenRouter video
  catalog. Do not label them OpenRouter routes. Existing LTX direct-provider
  research may remain a separate server-only route/contract.

The enabled contracts should cover enough real variation to exercise the UX:

```txt
text only
first frame only
first + optional last frame
image references
multimodal image/video/audio references
frame family versus reference family exclusion
audio + optional image for a direct audio-to-video model
native output audio on/off
different duration/resolution/aspect-ratio intersections
```

Keep stable TaleLabs model IDs in Flow data. Provider IDs, routes, endpoint
versions, evidence, and pricing remain server-only. Regenerate the public config
and SDK only from the curated public contracts.

## Architecture And File Structure

Do not solve this in one large component.

A reasonable structure is:

```txt
packages/flows/src/
  video-generation-resolver.ts
  generation-models/video.ts
  generation-registry-types.ts

apps/dashboard/src/features/flows/nodes/video-generation/
  video-generation-flow-node.tsx
  video-generation-input-rail.tsx
  video-generation-media-input.tsx
  video-generation-preview.tsx
  video-generation-prompt.tsx
  video-generation-footer.tsx
  use-video-generation-node.ts
```

Use the repository's actual conventions and avoid splitting tiny files with no
ownership value. The important boundaries are:

- pure capability/mode resolution in `@talelabs/flows`;
- React Flow adapter/controller behavior;
- visual node composition;
- curated model data;
- server-only provider evidence/routes.

Register `videoGeneration` with `VideoGenerationFlowNode` in the dashboard node
registry. Remove the video-specific branch from the generic generation
renderer. Image and audio nodes may continue using the generic renderer until
their own refactors.

Do not add model-ID `if`/`switch` statements in React. All model variation must
come from the versioned capability contract and the shared resolver.

## Asset-First Scope

The node consumes real TaleLabs Asset nodes and prior typed node outputs.

- Image Assets can connect to first frame, last frame, or image references when
  supported.
- Video Assets can connect to video references when supported.
- Audio Assets can connect to audio references when supported.
- Text may come from the node prompt and/or an existing Text input according to
  one documented composition rule. Do not silently concatenate conflicting
  prompts.

Elements are not part of this refactor. Do not add Element-specific handles,
source/master behavior, readiness rules, or Element UI. Do not delete the
existing Element feature in this task; simply keep the new Video Generation node
independent from it.

## Mocked Execution Boundary

This task remains provider independent.

- Use production-shaped normalized requests/results and current mock boundaries.
- The model/operation resolver must produce the same normalized facts a future
  provider adapter will consume.
- Mock output must not bypass canonical Asset ingestion once M5 output ingestion
  exists.
- Do not create a second planner, mock-only graph shape, or mock-only node type.
- Do not call a remote generation endpoint.
- If this task lands before the run engine can execute the node, expose a
  deterministic development inspection state showing the resolved operation,
  active inputs, settings, and readiness without pretending a video was
  generated.

## Documentation Updates Required In The Implementation

Update the source-of-truth documents so future sessions do not restore the old
operation-picker UX:

```txt
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/mvp-execution-plan.md
```

Document these invariants:

1. One generation node per media type, with model-adaptive inputs.
2. Operation/mode is inferred internally from model + connected inputs.
3. Unsupported inputs are absent; conflicting supported inputs are visible but
   disabled with a reason.
4. Frame and reference families are mutually exclusive where the provider route
   requires it.
5. Model discovery is evidence, never live production UI configuration.
6. The server rederives and validates the operation before admission.
7. The first approved product loop is Asset-driven and mocked; real provider
   integration comes after canvas UX approval.

If the public API or persisted node schema changes, update the corresponding API
and database design documents before treating implementation behavior as the new
contract.

## Internationalization

Follow the repository i18n rules. Do not hard-code user-facing text.

Add natural translations for every supported locale for:

- input labels;
- blocked/full reasons;
- model-change reconciliation and Undo labels;
- readiness and validation messages;
- prompt/settings labels;
- tooltips and accessibility text.

Run `npm run i18n:check` and preserve all locale catalogs.

## Explicit Non-Goals

Do not:

- reuse the current Video Generation node renderer or merely restyle it;
- keep a user-facing operation selector;
- implement real OpenRouter/provider video generation;
- spend generation credits;
- redesign Elements or add Element dependencies;
- implement image/audio node redesigns;
- implement arbitrary loops, Recipes, Tools, billing, or credits;
- drive UI directly from live provider discovery;
- leave incompatible edges or settings behind after a model change;
- add model-specific conditionals to React components;
- rewrite historical registry versions;
- make browser/UI QA an AI-owned acceptance claim.

## Implementation Order

1. Review the current OpenRouter video catalog and official model documentation.
2. Extend the curated model/operation contracts conservatively.
3. Implement the pure adaptive resolver and registry validation rules.
4. Add/migrate the current Video Generation node schema if required.
5. Change handles and graph validation to use all model-supported slots plus the
   resolver, rather than the explicitly selected operation.
6. Implement the dedicated Video Generation node components.
7. Remove the operation selector from the video node/settings UI.
8. Implement atomic model-change reconciliation and localized explanations.
9. Expose deterministic mocked/development resolution behavior without provider
   calls.
10. Update source-of-truth docs, generated contracts, and translations.
11. Run repository verification and leave the app ready for user-owned QA.

## Acceptance Criteria

The task is complete only when all of the following are true:

- Video Generation renders through a new dedicated component, not the generic
  generation renderer.
- No operation selector is visible anywhere for the video node.
- Selecting different video models changes the available input rail from the
  curated contract.
- Unsupported inputs are absent.
- Supported but conflicting inputs stay visible, disabled, and explain why.
- Connecting a frame blocks reference inputs for a frame/reference-exclusive
  model.
- Connecting a reference blocks frame inputs for the same model.
- Removing the conflicting connection re-enables the other family.
- Seedance-style multimodal reference mode can accept its reviewed combination
  of image/video/audio reference inputs.
- Start-only and start/end-frame-only models present the correct reduced UI.
- LTX-style audio-to-video behavior can be represented without a separate video
  node type or operation dropdown.
- Explicit model changes immediately remove incompatible edges as part of one
  undoable reconciliation mutation, without confirmation UI.
- Model/operation/settings/input validation is shared between frontend and
  server logic.
- The server can rederive the resolved operation and detect client drift.
- Stable handle IDs and `useUpdateNodeInternals` keep React Flow edges correctly
  positioned after model/input-layout changes.
- The public model picker exposes TaleLabs IDs/labels, not native provider route
  details.
- All currently discovered OpenRouter video models appear in reviewed inventory;
  only evidence-backed contracts are enabled.
- No paid generation request or external provider adapter was added.
- `TODO(provider-integration)` remains at every future replacement boundary.
- Existing Flow autosave, organization isolation, graph size limits, typed edge
  validation, and historical contract loading remain intact.
- SDK generation, type checks, `npm run i18n:check`, lint, production build,
  generation drift validation, and `git diff --check` pass.

UI and end-to-end product QA belong to the user. In the implementation summary,
list the exact model/input combinations the user should verify manually.

## Evidence

Primary sources reviewed for this prompt:

- [OpenRouter video generation guide](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter create-video API](https://openrouter.ai/docs/api/api-reference/video-generation/create-videos)
- [OpenRouter video-model list API](https://openrouter.ai/docs/api/api-reference/video-generation/list-videos-models)
- [OpenRouter model selection cookbook](https://openrouter.ai/docs/cookbook/video-generation/choose-video-model)
- [OpenRouter image-to-video cookbook](https://openrouter.ai/docs/cookbook/video-generation/image-to-video)
- [OpenRouter reference-to-video cookbook](https://openrouter.ai/docs/cookbook/video-generation/reference-to-video)
- [OpenRouter Seedance 2.0 model evidence](https://openrouter.ai/bytedance/seedance-2.0)
- [OpenRouter Grok Imagine Video model evidence](https://openrouter.ai/x-ai/grok-imagine-video)
- [OpenRouter HappyHorse 1.1 model evidence](https://openrouter.ai/alibaba/happyhorse-1.1)
- [LTX Flow behavior](https://ltx.io/blog/ltx-studio-flows)
- [Runway reference-media behavior](https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations)
- [React Flow handles](https://reactflow.dev/learn/customization/handles)
- [React Flow connection validation](https://reactflow.dev/examples/interaction/validation)
- [React Flow `useUpdateNodeInternals`](https://reactflow.dev/api-reference/hooks/use-update-node-internals)

Treat dated model facts as evidence captured on 2026-07-13. Recheck them when
implementing because provider catalogs and model capabilities change.
