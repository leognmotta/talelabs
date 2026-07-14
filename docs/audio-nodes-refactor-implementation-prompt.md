# Audio Nodes Refactor - Implementation Prompt

Use this prompt in a dedicated implementation session after the approved Video
Generation and Image Generation node work is present in the worktree.

## Objective

Replace the current generic `audioGeneration` experience with five dedicated,
model-adaptive TaleLabs nodes:

```txt
Generate
  Speech Generation
  Music Generation
  Sound Effect Generation

Transform
  Voice Changer
  Voice Isolation
```

Do not build one universal Audio node with an operation dropdown. Audio is one
output media family, but these are different user jobs with different inputs,
settings, validation, provider routes, and mental models.

Do not build one node per provider or one node per native model. The product
rule is:

> One node per stable user intent. Models adapt inside that node.

Follow the visual language and architecture established by the user-approved
Video Generation and Image Generation nodes. The current generic Audio
Generation renderer is not an approved reference and must not constrain this
redesign.

This task remains provider independent:

```txt
Step 1: real TaleLabs Assets + high-quality canvas nodes + deterministic mocks
Step 2: real provider integration only after the user approves the node UX
```

Do not call OpenRouter, ElevenLabs, OpenAI, Google, Stability AI, Cartesia,
Resemble, NVIDIA, or any other generation provider in this task. Do not spend
credits.

## Read Before Editing

Read the following before planning or changing code:

```txt
AGENTS.md
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/db-design-planning-v2.md
docs/api-design-planning-v2.md
docs/mvp-execution-plan.md
docs/video-generation-node-refactor-implementation-prompt.md
docs/image-generation-node-refactor-implementation-prompt.md
docs/llm-node-implementation-prompt.md
docs/feature-research/music-sound-effects.md
docs/feature-research/voice-cloning-speech-generation.md
```

Read the project React Flow skill and inspect the current implementation rather
than reconstructing its conventions from memory.

At minimum inspect:

```txt
packages/flows/src/types.ts
packages/flows/src/handles.ts
packages/flows/src/node-registry.ts
packages/flows/src/graph-validation.ts
packages/flows/src/generation-registry-types.ts
packages/flows/src/generation-registry-current.ts
packages/flows/src/generation-registry-history.ts
packages/flows/src/generation-models/
packages/flows/src/video-generation-resolver.ts
packages/flows/src/image-generation-resolver.ts

apps/api/config/generation-discovery-baseline.json
apps/api/src/routes/config/generation-provider-routes.ts

apps/dashboard/src/features/flows/flow-dashboard-node-registry.ts
apps/dashboard/src/features/flows/flow-generation-contract.ts
apps/dashboard/src/features/flows/flow-generation-settings-card.tsx
apps/dashboard/src/features/flows/flow-generation-toolbar-actions.tsx
apps/dashboard/src/features/flows/flow-node-connections-card.tsx
apps/dashboard/src/features/flows/flow-node-toolbar.tsx
apps/dashboard/src/features/flows/nodes/flow-handle.tsx
apps/dashboard/src/features/flows/nodes/flow-node-shell.tsx
apps/dashboard/src/features/flows/nodes/generation-node-frame.tsx
apps/dashboard/src/features/flows/nodes/generation-node-preview-area.tsx
apps/dashboard/src/features/flows/nodes/generation-node-prompt-section.tsx
apps/dashboard/src/features/flows/nodes/generation-settings-card.tsx
apps/dashboard/src/features/flows/nodes/generation-settings-section.tsx
apps/dashboard/src/features/flows/nodes/generation-setting-field.tsx
apps/dashboard/src/features/flows/nodes/video-generation/
apps/dashboard/src/features/flows/nodes/image-generation/
apps/dashboard/src/features/flows/nodes/llm/
```

Treat the rendered Video Generation, Image Generation, and LLM nodes in the
current worktree as the authoritative visual specification. Inspect them in the
browser before coding and compare against them again before completion. The
older generic Audio Generation node and external competitor screenshots are
product-research evidence, not TaleLabs component or styling references.

The worktree is intentionally dirty. Preserve all existing user and AI changes.
Do not revert or rewrite unrelated work.

## Research Conclusion To Encode

Provider taxonomies are evidence, not TaleLabs product structure.

Research across OpenRouter, OpenAI, Google, Adobe, Stability AI, ElevenLabs,
Cartesia, Resemble, and NVIDIA establishes these boundaries:

| User intent | Typical inputs | Typical output | Why it is separate |
| --- | --- | --- | --- |
| Speech Generation | text + voice | spoken audio | narration/dialogue with voice, language, speed, and delivery controls |
| Music Generation | prompt, optional lyrics/creative guide | song or soundtrack | musical structure, duration, instrumental/vocal behavior, and composition controls |
| Sound Effect Generation | description, optional timing guide in future | effect or ambience | short event/ambience clips with duration and looping semantics |
| Voice Changer | source audio/video + target voice | transformed speech | preserves timing, delivery, and performance while changing voice identity |
| Voice Isolation | source audio/video | cleaned speech | removes noise, music, ambience, or interfering sound; usually needs no creative prompt |

The same text input cannot determine whether the user wants narration, a song,
or a door slam. The same audio input cannot determine whether the user wants
voice conversion, noise removal, remixing, or source separation. Therefore a
single Audio node would require a top-level operation mode and radically change
its ports and settings. That repeats the product mistake already removed from
Video Generation.

Provider and product boundaries are also not one-to-one:

- OpenRouter exposes dedicated TTS plus broader audio-capable models, but does
  not normalize every music, sound-effect, voice-conversion, or isolation route.
- Adobe exposes Soundtrack and Sound Effects as separate creator workflows.
- Cartesia and Resemble expose TTS separately from voice conversion.
- Stability Audio can serve both music and sound-design use cases through
  related routes.
- NVIDIA and ElevenLabs expose cleanup/isolation independently from generation.

Consequently, one provider route may be eligible for multiple TaleLabs nodes.
For example, a reviewed Stable Audio route may appear under both Music and Sound
Effect. That sharing belongs in the registry and server routing; it is not a
reason to merge the user-facing nodes.

## Product Taxonomy

Add these first-class Flow node types:

```ts
type AudioFlowNodeType =
  | 'speechGeneration'
  | 'musicGeneration'
  | 'soundEffectGeneration'
  | 'voiceChanger'
  | 'voiceIsolation'
```

The picker should present:

```txt
Generation
  Image Generation
  Video Generation
  Speech Generation
  Music Generation
  Sound Effect Generation
  LLM

Transform
  Voice Changer
  Voice Isolation
```

Extend the existing code-owned dashboard registry and picker groups. Do not
create a second node-picker registry or hard-code these nodes in picker JSX.

The word `Audio` may appear as a descriptive category or output media type. It
must not remain as a selectable catch-all node.

## Registry Design

`mediaType: 'audio'` is insufficient to decide which node can use a model.
Extend the public, versioned capability contract so every operation declares
the TaleLabs node type or stable product intent it supports.

A concrete direction is:

```ts
interface GenerationOperationDefinition {
  // existing fields remain
  nodeType:
    | 'imageGeneration'
    | 'llm'
    | 'musicGeneration'
    | 'soundEffectGeneration'
    | 'speechGeneration'
    | 'videoGeneration'
    | 'voiceChanger'
    | 'voiceIsolation'
}
```

An equivalent stable `productIntent` discriminator is acceptable if it avoids
coupling the shared registry to dashboard naming, but there must be exactly one
authoritative discriminator. Do not infer intent from operation-name strings,
model IDs, provider IDs, labels, or `mediaType`.

Model pickers must filter by enabled operations compatible with the current
node type. A model with two eligible operations may appear in two node pickers.
The resolver may consider only operations belonging to the current node type.

For example:

```ts
stableAudio.operations = [
  { id: 'textToMusic', nodeType: 'musicGeneration', /* ... */ },
  {
    id: 'textToSoundEffect',
    nodeType: 'soundEffectGeneration',
    /* ... */
  },
]
```

This is an example of the product contract, not permission to claim unsupported
native behavior. Enable only operations backed by current primary evidence.

Persist stable TaleLabs model IDs and the internally resolved operation ID.
Keep native provider model IDs, endpoints, passthrough fields, credentials,
fallbacks, lifecycle rules, and cost policy server-only.

Do not mutate immutable released registry versions. If the operation schema
needs a new capability version, publish a new version and add the corresponding
historical loading/hash evidence required by the existing registry.

## Node Contracts

All five nodes output one `AudioSet` through the stable handle ID `audio`.
Initially, one invocation produces one audio Asset/runtime item. A provider that
natively returns alternatives may later place them inside one `AudioSet`; it
must not silently create Flow iteration.

### 1. Speech Generation

User job:

```txt
Turn a script into spoken narration or dialogue using a selected voice.
```

Stable handles:

```txt
input  prompt  : Text, maximum one connection
output audio   : AudioSet
```

Use the user-facing label `Script` for the `prompt` handle and inline editor,
while retaining one stable internal handle ID. A connected Text input is
authoritative. Preserve the inline draft so disconnecting the edge restores it.
Do not concatenate connected and inline text silently.

First-version settings:

```txt
model
voice (required)
speed (only for supporting contracts)
delivery/instructions (only for supporting contracts)
language or locale (only when the model requires or supports an explicit value)
output format (advanced, only when useful to the user)
```

Do not expose a raw native `voice_id` input. Persist a stable TaleLabs voice
option ID from the reviewed public contract and resolve it to provider-native
identity server-side. In this phase, built-in curated voices are sufficient.
Custom voice creation, cloning, consent workflows, and a reusable Voice entity
are separate future work and must not reactivate Elements.

Candidate route families to inventory and verify:

```txt
OpenRouter TTS endpoint
  OpenAI GPT-4o mini TTS snapshots
  Microsoft MAI-Voice
  xAI Grok Voice TTS
  Mistral Voxtral TTS

Direct providers
  ElevenLabs TTS
  Cartesia TTS
  Resemble TTS
```

Do not enable all discovered models automatically. Capture discovery as dated
evidence and curate a small initial picker.

### 2. Music Generation

User job:

```txt
Create a soundtrack, song, cue, loop, or musical bed.
```

Stable handles:

```txt
input  prompt          : Text, maximum one connection
input  lyrics          : Text, maximum one connection, only when supported
input  imageReferences : ImageSet, optional, only when route evidence supports it
output audio           : AudioSet
```

The prompt remains the required creative direction. Lyrics and image guidance
are model-adaptive inputs, not universal controls. Unsupported handles are
absent.

First-version settings:

```txt
model
duration mode: auto | custom, when supported
duration seconds, visible only in custom mode
instrumental, only when supported
seed, advanced and only when supported
output format, advanced and only when supported
```

If lyrics are connected, an incompatible `instrumental: true` setting must be
blocked or normalized through declarative constraints with a localized reason.
Do not rely on React model-ID conditionals.

ElevenLabs composition plans, sections, inpainting, continuation, stems, and a
music editor are not part of the first node. The registry may preserve evidence
for later contracts, but the initial UX remains prompt-oriented.

Candidate route families to inventory and verify:

```txt
OpenRouter
  Google Lyria 3 Clip
  Google Lyria 3 Pro

Direct providers
  Google Lyria stable/Vertex routes where appropriate
  ElevenLabs Music v2
  Stability Stable Audio
```

### 3. Sound Effect Generation

User job:

```txt
Create a short effect, Foley sound, transition, impact, texture, or ambience.
```

Stable handles:

```txt
input  prompt : Text, maximum one connection
output audio  : AudioSet
```

First-version settings:

```txt
model
duration mode: auto | custom
duration seconds, visible only in custom mode
loop, only when supported
prompt influence/adherence, advanced and only when supported
output format, advanced and only when supported
```

Adobe demonstrates voice timing and media-aligned SFX as useful creator UX, and
Stability supports audio-guided transformation. Do not expose a timing-guide or
source-audio handle in the first contract unless there is an enabled provider
route with sufficient API evidence and the resulting operation still matches
the Sound Effect user intent. Otherwise document it as a follow-up.

Candidate route families to inventory and verify:

```txt
ElevenLabs Sound Effects v2
Stability Stable Audio sound-design operation
```

Adobe Firefly is product/UX evidence, not an assumed API route.

### 4. Voice Changer

User job:

```txt
Preserve a recorded performance while changing the speaker identity.
```

Stable handles:

```txt
input  sourceMedia : AudioSet | VideoSet, exactly one selected media item
output audio       : AudioSet
```

First-version settings:

```txt
model, hidden when there is only one enabled TaleLabs contract
target voice (required)
remove background noise, only when supported
output format, advanced and only when supported
```

Do not add a required prompt. Provider-specific optional style instructions may
be introduced later through an evidence-backed model-adaptive Text input or
setting. Do not conflate voice conversion with voice cloning: the source media
is the performance, while target voice identity is a reviewed option/resource.

Candidate route families to inventory and verify:

```txt
ElevenLabs Voice Changer
Cartesia Voice Changer
Resemble Speech-to-Speech
NVIDIA Voice Font as future self-hosted/enterprise evidence
```

### 5. Voice Isolation

User job:

```txt
Extract and clean spoken voice from noisy audio or video.
```

Stable handles:

```txt
input  sourceMedia : AudioSet | VideoSet, exactly one selected media item
output audio       : AudioSet
```

This is a utility node, not a prompt-driven generation node. Do not render a
fake prompt field. Keep the canvas surface simple. Hide the model picker when
there is only one enabled curated TaleLabs contract, while still persisting a
stable model/contract ID for snapshots and future routing.

First-version settings:

```txt
model, normally hidden for one eligible contract
output format, advanced and only when supported
```

Candidate route families to inventory and verify:

```txt
ElevenLabs Voice Isolator
NVIDIA Background Noise Removal / Maxine as future direct or self-hosted route
Dolby Enhance or another reviewed enhancement route as future evidence
```

Voice isolation is not vocal/music stem separation. Do not claim that this node
extracts vocals from songs unless a future explicit Stem Separation node and
provider contract are researched and approved.

## Input Availability And Resolution

Build pure resolver logic in `@talelabs/flows`. React must consume the result;
it must not reproduce model capability rules.

Use small operation-specific resolvers or one shared audio resolver with thin
intent-specific policies. Do not create one giant function containing five
unrelated branches. A reasonable shape is:

```txt
audio-generation-resolver.ts   = shared count, settings, and readiness helpers
speech-generation-resolver.ts  = speech operation resolution
music-generation-resolver.ts   = music operation resolution
sound-effect-resolver.ts        = sound-effect operation resolution
voice-changer-resolver.ts       = source/voice validation
voice-isolation-resolver.ts     = source validation
```

The exact filenames may follow existing project conventions, but each resolver
must remain usable by dashboard and server validation without React, browser,
database, or provider dependencies.

Every resolver returns at least:

```ts
interface AudioNodeResolution {
  inputAvailability: Readonly<Record<string, GenerationInputAvailability>>
  issues: readonly GenerationContractIssue[]
  normalizedSettings: Readonly<Record<string, GenerationSettingValue>>
  readiness: 'incomplete' | 'invalid' | 'ready'
  resolvedOperationId: null | string
  visibleSettingIds: readonly string[]
}
```

Rules:

1. The current node type limits the operation candidates.
2. Connected inputs and settings derive the operation internally.
3. There is no user-facing operation selector.
4. Unsupported inputs are absent.
5. Supported but conflicting inputs remain visible and disabled with a localized
   reason when that helps users understand how to unblock the node.
6. Item limits apply after Asset/reference selection, not only to edge count.
7. `sourceMedia` accepts AudioSet or VideoSet but resolves exactly one selected
   media item for Voice Changer and Voice Isolation.
8. The server rederives node type, operation, exact selected inputs, and settings
   before run admission. Client operation IDs are not authoritative.
9. Reference order and selected payload order remain deterministic and recorded
   in provenance.

## Node Data And Legacy Migration

Reuse the shared generation data contract where it remains correct, but define
intent-specific node-data types instead of pretending every audio node has a
prompt:

```ts
type SpeechGenerationNodeData = GenerationNodeData & { prompt: string }
type MusicGenerationNodeData = GenerationNodeData & {
  lyrics: string
  prompt: string
}
type SoundEffectGenerationNodeData = GenerationNodeData & { prompt: string }
type VoiceChangerNodeData = GenerationNodeData
type VoiceIsolationNodeData = GenerationNodeData
```

The exact persisted fields may be adjusted to the existing schema/versioning
system. Do not store output URLs, transient previews, provider job IDs, native
voice IDs, or mock results in live Flow node data.

The existing `audioGeneration` type currently represents more than one intent.
Handle it explicitly:

- inspect every current schema version and operation;
- migrate a TTS node to `speechGeneration`;
- migrate a sound-effect node to `soundEffectGeneration`;
- do not guess when legacy data is ambiguous;
- preserve immutable registry history;
- keep a hidden compatibility renderer/parser temporarily if an atomic
  persisted type migration is not safe in this task;
- never silently reinterpret one creative intent as another.

Because the work is still pre-release, prefer a clean final product model, but
do not corrupt local/user data to obtain it. Document the chosen migration path
and include deterministic verification scenarios.

## Non-Negotiable Visual Consistency Contract

Visual consistency is an acceptance requirement, not a suggestion. The approved
Video Generation, Image Generation, and LLM implementations already define the
TaleLabs generation-node system. Audio work may add new intent logic, slots,
settings, previews, and icons, but it must not invent another shell, toolbar,
inspector, spacing system, or interaction model.

Reuse these shared primitives directly:

```txt
Canvas frame        -> GenerationNodeFrame -> FlowNodeShell
Preview surface     -> GenerationNodePreviewArea
Prompt area         -> GenerationNodePromptSection
Output footer       -> GenerationOutputFooter through GenerationNodeFrame
Selected actions    -> FlowNodeToolbar + FlowGenerationToolbarActions
Settings inspector  -> GenerationSettingsCard
Settings rows       -> GenerationSettingsSection + GenerationSettingField
Input/output pane   -> FlowNodeConnectionsCard
Model selection     -> ModelPicker through GenerationSettingsCard
Handles             -> FlowHandle and the approved generation input-rail pattern
```

Do not copy their Tailwind classes into five audio components. Do not create an
audio-only version of a shared component merely to obtain different spacing or
styling. If an audio use case exposes a genuine missing capability, extend or
compose the existing shared primitive so every relevant generation node can use
it while preserving the current Video, Image, and LLM rendering exactly.

Do not visually redesign the approved nodes in this task. A shared extraction
is allowed only when it preserves their rendered result and behavior.

### Exact canvas anatomy

Every audio node uses this structure:

```txt
GenerationNodeFrame (same w-96 shell, radius, border, shadow, selection state)
  Header (same h-10, padding, icon size, model-name typography)
  GenerationNodePreviewArea
    Stable left input rail using shared handle visuals
    Intent-appropriate preview inside the same media frame geometry
    Shared readiness/status treatment in the same position
  GenerationNodePromptSection (prompt-driven nodes only)
  GenerationOutputFooter (same height, divider, label and output handle position)
```

The following must match the approved nodes:

- node width, header height, border radius, border color, selected ring, shadow,
  internal padding, dividers, typography, and muted/active colors;
- model name in the header, not a generic node name and not a provider name;
- input handles on the left, output handle in the shared footer on the right;
- readiness/status indicator placement and visual hierarchy;
- prompt editor height, padding, connected-prompt behavior, help text placement,
  `nodrag`/`nopan` behavior, focus ring, and disabled/read-only treatment;
- preview empty, ready, processing, success, stale, and error state geometry;
- no nested cards, decorative panels, bespoke toolbars, or permanent internal
  scrollbars.

Prompt-driven nodes use the complete shared anatomy. Transform nodes omit the
prompt section, but they still use `GenerationNodeFrame`, the same preview
surface, output footer, selection treatment, and toolbar. Do not compensate for
the missing prompt with arbitrary custom height or padding. If transform nodes
need a compact frame variant, add one explicit shared variant/token and apply it
consistently to Voice Changer and Voice Isolation.

### Exact selected-node action bar

Do not build an audio toolbar. Register each audio node's capabilities in
`FLOW_DASHBOARD_NODE_REGISTRY` and let the existing `FlowNodeToolbar` render the
bar above the selected node through `FlowGenerationToolbarActions`.

The approved action order and composition are:

```txt
Run split button | Download or copy when supported | Delete | separator | Lock
```

Preserve its `NodeToolbar` top anchoring, offset, border, radius, background,
shadow, padding, button sizes, tooltips, keyboard behavior, disabled states, and
spacing. Intent-specific capability metadata may hide or disable actions, but
must not reorder or restyle them. Do not duplicate Run, Download, Delete, Copy,
or Lock inside an audio node.

## Required Canvas UX

Within the visual contract above:

- use the model-adaptive stable input rail already established by Video/Image;
- show the output audio preview/player in the shared preview surface;
- show inline creative text only for prompt-driven nodes;
- expose no operation dropdown;
- expose no provider names, provider logos, or native route details;
- preserve keyboard, focus, and screen-reader behavior from approved nodes.

### Prompt-driven nodes

Speech, Music, and Sound Effect use the same connected-prompt authority rule as
approved Video and Image nodes:

```txt
no prompt edge   -> editable inline draft is used
prompt edge      -> connected Text is authoritative; inline draft is preserved
edge removed     -> preserved inline draft becomes active again
```

Music may expose a second inline lyrics editor only when the selected model
supports lyrics and no `lyrics` edge is connected. Keep it collapsed or compact
by default; do not turn the node into a song editor.

### Transform nodes

Voice Changer and Voice Isolation have no fake prompt area. Their body should
show the source-media state and output audio preview clearly. Voice Changer also
shows the selected target voice in a compact way. Configuration details remain
in the inspector.

### Audio preview

Create shared, accessible audio preview primitives:

```txt
AudioOutputPreview
AudioPlaybackControls
AudioEmptyState
AudioProcessingState
AudioErrorState
```

These are preview-content primitives placed inside
`GenerationNodePreviewArea`; they are not replacements for
`GenerationNodeFrame`, `FlowNodeShell`, or the shared toolbar/inspector.

Reuse browser-native media behavior where practical. Do not add a heavy
waveform or audio-editor dependency merely for decoration. If a waveform is
rendered, derive it from bounded metadata/peaks without decoding large files on
every card. The preview must have accessible play/pause labels and must not
autoplay. Its outer dimensions, border treatment, state placement, and visual
weight must match the approved Image/Video/LLM preview surfaces.

## Inspector UX

The inspector has one approved two-card composition. Every selected audio node
must use it:

```txt
GenerationSettingsCard
  Header: intent icon + localized node name
  ModelPicker
  GenerationSettingsSection
    GenerationSettingField rows

FlowNodeConnectionsCard
  Inputs
    shared thumbnail/icon row + name + slot/role subtitle
  Outputs, when a real or mocked output is available
    the same shared row treatment
```

The two cards must retain the same `w-80`, headers, borders, radius, content
padding, vertical gap, typography, model-picker dimensions, setting-row label
and control alignment, and inspector positioning used by approved generation
nodes. The panel may scroll as its existing outer surface does; do not add
independent scroll containers to ordinary settings sections.

`FlowNodeConnectionsCard` is the sole input/output summary. Extend its value
preview support for audio where necessary, but do not create an audio-specific
Inputs and Outputs card. It must continue to show the exact resolved connected
items, using the existing asset thumbnail/icon row, truncation, hover details,
and localized slot label. Audio without artwork may use the shared audio icon or
a bounded waveform thumbnail inside the existing row dimensions.

Each node may have a thin intent-specific settings component because its fields
differ, for example:

```txt
SpeechSettingsCard
MusicSettingsCard
SoundEffectSettingsCard
VoiceChangerSettingsCard
VoiceIsolationSettingsCard
```

These components are data/composition adapters around
`GenerationSettingsCard`, `GenerationSettingsSection`, and
`GenerationSettingField`; they are not independent card designs. Do not
implement five copies of the shared card. Do not implement one universal audio
component with dozens of boolean props.

The inspector must:

1. filter models by compatible node intent;
2. show only settings active for the resolved operation;
3. use declarative `visibleWhen` and constraints;
4. show a clear input/output summary;
5. expose explicit model-contract upgrade behavior for old nodes;
6. explain blocked inputs/settings with localized reasons;
7. preserve provider-independent labels and TaleLabs IDs.

It must also preserve the exact approved visual hierarchy:

- model picker first;
- optional contract-upgrade action in the shared position;
- one divider before setting rows;
- simple horizontal label/control rows;
- advanced settings use the same disclosure treatment already approved for
  Image Generation;
- inputs and outputs remain in the separate shared card below settings.

## Model Switching

Follow the approved Video/Image behavior:

- changing a model must not silently delete edges;
- reconcile settings atomically against the target model contract;
- retain compatible values;
- apply target defaults for unsupported or invalid saved values;
- surface incompatible connected inputs and require explicit user resolution;
- call `useUpdateNodeInternals` after dynamic handle changes;
- keep stable handle IDs so compatible edges remain attached;
- persist the new contract version only through the existing canvas update path;
- never add model-ID `if`/`switch` statements to React components.

## Shared Architecture And File Structure

The final structure should make a sixth audio intent straightforward without
editing one giant file.

Use the existing domain boundaries:

```txt
packages/flows
  node schemas and migrations
  operation-intent capability contracts
  model definitions
  pure resolvers
  graph validation
  deterministic capability scenarios

apps/dashboard
  dedicated React Flow node compositions
  audio preview/player primitives
  input rails
  prompt editors
  intent-specific inspectors
  thin hooks consuming pure resolvers

apps/api
  public provider-independent config
  server-only provider route evidence
  drift/inventory snapshots
  no provider execution in this task
```

A suggested dashboard structure is:

```txt
nodes/audio/
  shared/
    audio-output-preview.tsx
    audio-input-rail.tsx
    use-audio-node-models.ts
  speech-generation/
  music-generation/
  sound-effect-generation/
  voice-changer/
  voice-isolation/
```

Adapt names to established conventions. Keep files focused and readable. Do
not solve all audio behavior in `generation-flow-node.tsx`,
`flow-generation-settings-card.tsx`, or a new monolithic `audio-flow-node.tsx`.

The `shared/` directory contains audio media/content behavior only. Layout and
chrome remain in the existing generation primitives under `nodes/` and the
existing Flow inspector/toolbar components. Before creating any component,
classify it as either intent logic, media content, or shared generation chrome;
do not duplicate shared generation chrome under `nodes/audio/`.

After migration, the generic generation renderer should not own any of the five
new audio nodes. Remove dead audio-only branches when safe.

## Curated Model Evidence

Before finalizing enabled contracts:

1. capture a dated OpenRouter inventory for speech/audio-output models;
2. inspect OpenRouter's dedicated TTS endpoint separately from generic audio
   input/output chat models;
3. verify direct provider operations against official API documentation;
4. record primary evidence URLs and review dates;
5. pin native server routes and safe capability intersections;
6. leave ambiguous candidates disabled or inventory-only;
7. never populate production UI directly from discovery.

The initial catalog should be deliberately small. It should nevertheless prove
that the abstraction is provider-neutral:

```txt
Speech       -> at least two reviewed route families when evidence permits
Music        -> at least one reviewed contract
Sound Effect -> at least one reviewed contract
Voice Change -> at least one reviewed contract
Isolation    -> at least one reviewed contract
```

If a real route cannot yet be enabled safely, keep its mocked TaleLabs contract
disabled or clearly development-only. Do not invent parameters to satisfy the
matrix.

## Public And Private Configuration

Public `/config/generation` may expose only what the canvas needs:

```txt
stable TaleLabs model ID
contract version
compatible node intent/operation
translation keys
input slots and accepted media
item and connection limits
settings, defaults, options, and visibility constraints
output contract
presentation metadata
recommended/enabled state
```

Server-only route configuration owns:

```txt
provider and native model ID
endpoint and route version
request mapping
voice ID mapping
supported wire formats
delivery and lifecycle behavior
poll/webhook/cancellation behavior
provider limits and pricing evidence
fallbacks, emergency disable, and credentials
```

Do not leak provider credentials or assume an OpenRouter model can satisfy a
direct-provider operation merely because both output audio.

## Mocked Boundary

This task validates canvas product design and capability resolution.

- Reuse the existing normalized mock/provider boundary.
- Do not create a second audio run engine.
- Do not write provider-specific mock code into React components.
- If approved Image/Video nodes currently expose an unavailable Run action,
  preserve the same milestone boundary instead of inventing audio-only
  execution.
- If a shared deterministic mock adapter is already executable, use it through
  production-shaped normalized requests/results.
- Mark every future real integration replacement point with
  `TODO(provider-integration)` according to the execution plan.
- Do not persist mock output URLs in node data.
- Do not claim that a canonical generated Asset exists unless the shared mock
  run/output-ingestion path actually created it.

## Internationalization And Accessibility

Follow all repository internationalization rules.

Add or update every locale in the same change for:

- five node names and descriptions;
- Generate and Transform picker groups if changed;
- input/output labels;
- prompt/script/lyrics placeholders;
- voice and settings labels;
- empty, processing, ready, blocked, invalid, and error states;
- model-switch and contract-upgrade messages;
- audio player controls, tooltips, and `aria-label` values;
- localized validation reasons.

Do not hard-code user-facing English. Use stable translation keys/codes in Zod,
registry, resolver, API, and validation layers. Run `npm run i18n:check`.

## Documentation Updates Required

Update the source-of-truth documents so future sessions do not restore one
universal Audio Generation node:

```txt
docs/talelabs-product-vision.md
docs/flow-nodes-planning.md
docs/mvp-execution-plan.md
```

Update API/database design documents only if the public contract or persisted
node schema changes.

Document these invariants:

1. Audio is an output media family, not one user intent.
2. TaleLabs has separate Speech, Music, Sound Effect, Voice Changer, and Voice
   Isolation nodes.
3. One provider model may support multiple nodes through separately tagged
   operations.
4. Model pickers filter by node intent, not `mediaType` alone.
5. Operation is inferred and server-validated; users never choose a native
   operation from a dropdown.
6. Provider discovery remains dated evidence rather than live configuration.
7. The first phase is mocked and Asset-driven; real adapters follow UX approval.

## Explicit Non-Goals

Do not implement:

- one universal Audio node;
- one node per provider or per model;
- real provider calls or paid generation;
- voice cloning or consent workflows;
- an Element-backed voice system;
- transcription, translation, or dubbing;
- lip sync;
- vocal/music stem separation;
- audio-to-audio remix or inpainting unless separately approved;
- a DAW, timeline, multitrack mixer, or waveform editor;
- music composition plans, section editing, continuation, or inpainting;
- provider passthrough controls;
- live-discovery-driven UI;
- silent deletion of incompatible edges;
- a second execution engine;
- Recipes, Tools, billing, or credits;
- AI-owned browser/UI acceptance claims.

These may be future nodes or features after the first creative loop is proven.

## Implementation Order

1. Open the approved Video, Image, and LLM nodes in the browser and record a
   visual parity checklist covering shell, header, preview, prompt, footer,
   handles, selected toolbar, settings card, and Inputs and Outputs card.
2. Capture dated OpenRouter and direct-provider evidence.
3. Extend the registry with one authoritative operation-to-node-intent
   discriminator.
4. Define the five node schemas, stable handles, and explicit legacy migration.
5. Implement pure intent-specific resolvers and deterministic scenarios.
6. Update graph validation, hydration, defaults, duplication, autosave, and
   contract loading for all new node types.
7. Add the five registry-driven picker entries and Transform group.
8. Build only the missing shared audio media-content and input-rail primitives;
   reuse all existing generation chrome and inspector primitives directly.
9. Build thin dedicated node and settings adapters for each intent using the
   exact approved canvas and two-card inspector anatomy.
10. Reconcile model switching and dynamic handles by preserving compatible
    edges and removing incompatible state immediately as one undoable mutation.
11. Remove the generic `audioGeneration` product entry after compatibility is
    handled safely.
12. Regenerate public contracts/SDK and update translations/docs.
13. Compare every state against the visual parity checklist and correct code
    drift before presenting it to the user.
14. Run verification and provide a focused user-owned QA checklist.

## Required Deterministic Scenarios

At minimum verify without remote provider calls:

### Speech

- inline script resolves ready with required voice;
- connected Text overrides but does not erase inline draft;
- model without speed support hides speed;
- model switch preserves compatible voice/settings and flags incompatible ones;
- non-speech audio models never appear.

### Music

- prompt-only music resolves correctly;
- lyrics handle appears only for supporting models;
- lyrics plus instrumental conflict is explained and cannot be admitted;
- image guidance appears only for evidence-backed models;
- sound-effect-only models never appear.

### Sound Effect

- prompt-only effect resolves correctly;
- auto/custom duration behavior is deterministic;
- duration, loop, and prompt influence appear only when supported;
- music-only models never appear.

### Voice Changer

- exactly one selected audio Asset is valid;
- exactly one selected video Asset is valid when accepted by the contract;
- zero and multiple selected items are incomplete/invalid as appropriate;
- target voice is required;
- source performance and target voice remain distinct concepts.

### Voice Isolation

- exactly one selected audio or supported video Asset is valid;
- no prompt is required or rendered;
- one available model may be hidden from the visual settings while remaining
  persisted and validated;
- music stem-separation behavior is not claimed.

### Cross-cutting

- a multi-operation provider model appears only in compatible node pickers;
- public config contains no provider-native route details;
- historical registry hashes remain valid;
- legacy TTS and SFX nodes migrate without intent loss;
- changing models never silently removes edges;
- server and client resolve the same intent, operation, settings, and readiness;
- graph snapshots retain exact node type, model contract, operation, settings,
  and ordered selected inputs.

## Acceptance Criteria

The task is complete only when:

- the node picker has five separate audio-related nodes;
- no selectable generic Audio Generation node remains;
- each node has a dedicated product-appropriate canvas surface;
- the five nodes share focused primitives without one monolithic renderer;
- every audio node renders through `GenerationNodeFrame` and `FlowNodeShell`;
- prompt-driven audio nodes use `GenerationNodePromptSection`, and transform
  nodes omit it without creating a parallel frame;
- all output footers, handles, status treatments, node widths, headers,
  selection rings, spacing, borders, typography, and preview geometry match the
  approved Video/Image/LLM system;
- the selected-node action bar is rendered only by `FlowNodeToolbar` and
  `FlowGenerationToolbarActions`, with the approved Run, contextual action,
  Delete, separator, and Lock composition;
- every audio inspector uses `GenerationSettingsCard` followed by the shared
  `FlowNodeConnectionsCard`; no audio-specific settings shell or Inputs and
  Outputs card exists;
- setting rows use `GenerationSettingsSection` and `GenerationSettingField`,
  including the existing advanced-settings disclosure where applicable;
- audio-specific shared components are limited to media content, audio
  controls, and input-rail behavior rather than duplicating generation chrome;
- model filtering uses an explicit operation intent/node contract;
- a provider model can safely support multiple compatible node intents;
- Speech, Music, and Sound Effect are prompt-driven without an operation picker;
- Voice Changer requires source media and target voice without a fake prompt;
- Voice Isolation requires source media without a fake prompt;
- unsupported inputs/settings are absent;
- conflicting supported inputs/settings are disabled or rejected with localized
  reasons;
- model changes preserve compatible edges/data and immediately remove or reset
  incompatible state as one undoable mutation, without a confirmation dialog or
  notification modal;
- all output handles remain typed `AudioSet` with stable ID `audio`;
- no real provider request, credit spend, or second execution engine was added;
- registry history, graph persistence, tenant isolation, autosave, undo/redo,
  duplication, deletion, keyboard behavior, and dynamic handles still work;
- SDK generation, registry/drift checks, type checks, i18n validation, lint,
  production build, and `git diff --check` pass.

UI and end-to-end product QA belong to the user. The final implementation
summary must list exact node/model/input combinations for the user to verify and
must include this visual parity matrix for each node:

```txt
Node shell/header         matches approved system
Preview and state layout  matches approved system
Prompt/footer/handles     matches approved system or intentionally omitted
Selected action bar       shared component, correct capabilities and order
Configuration card       shared component, model first, shared setting rows
Inputs and Outputs card   shared component, exact connected item summaries
Keyboard/focus behavior   matches approved nodes
```

The implementer may report that the parity checks were performed, but only the
user can approve the final visual and end-to-end UX.

## Primary Research Evidence

Treat model facts as dated evidence reviewed on 2026-07-13 and recheck them at
implementation time.

### Cross-provider and OpenRouter

- [OpenRouter TTS guide](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [OpenRouter create-speech API](https://openrouter.ai/docs/api/api-reference/speech/create-audio-speech)
- [OpenRouter audio input/output guide](https://openrouter.ai/docs/guides/overview/multimodal/audio)
- [OpenRouter models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [OpenAI create-speech API](https://platform.openai.com/docs/api-reference/audio/speech-audio-done-event?lang=curl)

### Music and sound design

- [Google Lyria API](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/lyria-music-generation)
- [ElevenLabs Music compose API](https://elevenlabs.io/docs/api-reference/music/compose)
- [ElevenLabs Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- [Stability Audio API](https://platform.stability.ai/docs/api-reference)
- [Adobe Generate Soundtrack](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-audio/generate-soundtrack.html)
- [Adobe Generate Sound Effects](https://helpx.adobe.com/in/firefly/web/firefly-video-editor/generate-audio/generate-sound-effects.html)

### Speech and voice transformation

- [ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [ElevenLabs Voice Changer](https://elevenlabs.io/docs/overview/capabilities/voice-changer)
- [ElevenLabs Voice Isolator](https://elevenlabs.io/docs/overview/capabilities/voice-isolator)
- [Cartesia TTS endpoint comparison](https://docs.cartesia.ai/use-the-api/compare-tts-endpoints)
- [Cartesia Voice Changer API](https://docs.cartesia.ai/api-reference/voice-changer/sse)
- [Resemble TTS API](https://docs.resemble.ai/api-reference/text-to-speech/synthesize)
- [Resemble Speech-to-Speech](https://www.resemble.ai/products/speech-to-speech)
- [NVIDIA Maxine](https://developer.nvidia.com/maxine/)
- [NVIDIA Audio Effects SDK](https://docs.nvidia.com/maxine/afx/latest/index.html)

### Canvas architecture

- [React Flow custom handles](https://reactflow.dev/learn/customization/handles)
- [React Flow connection validation](https://reactflow.dev/examples/interaction/validation)
- [React Flow `useUpdateNodeInternals`](https://reactflow.dev/api-reference/hooks/use-update-node-internals)
