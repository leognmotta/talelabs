# Direct AI Asset Creation

**Status:** architecture-reviewed feature proposal, awaiting product approval

**Last researched:** 2026-07-22

**Architecture reviewed:** 2026-07-22 against the current TaleLabs repository

**UX researched:** 2026-07-22 against current competitor product guidance,
TaleLabs dashboard conventions, Tiptap interaction contracts, and WCAG 2.2

**Proposed route:** `/create`

**Primary surfaces:** Image, Video, Audio

**Editor:** Tiptap with structured `@` media references

## Executive Conclusion

TaleLabs should add a direct creation page as a low-friction front door for
generating individual Assets. The page should provide three primary modes:

```txt
Image
Video
Audio
```

It should feel conversation-shaped because requests and results appear in a
session stream, but the first version is **not an autonomous AI agent or a text
chatbot**. Each submission is a deterministic generation request whose model,
inputs, settings, estimated cost, execution runtime, run snapshot, and output
Assets remain visible and auditable.

The product relationship should be:

```txt
Create = fastest path to one useful Asset
Flows  = spatial composition and multi-step creative work
Assets = durable source of truth for uploaded and generated media
```

Create must be a thin product surface over TaleLabs' existing architecture:

```txt
models catalog
-> model-adaptive operation resolver
-> PromptTemplate
-> Flow planning and immutable run snapshot
-> browser or managed execution
-> provider adapter
-> canonical Asset ingestion
```

It must not introduce a second model registry, provider path, run engine,
upload system, result format, cost estimator, or prompt contract.

This page is strategically valuable because it reduces the time from opening
TaleLabs to generating a first Asset. It also gives users who do not yet need a
canvas a complete product loop. The Flow canvas remains TaleLabs' advanced and
differentiating surface.

Adding this research file does not approve or schedule the feature. After UX
approval, its stable contract must be incorporated into the binding product,
Flow, database, API, and execution documents before implementation.

### Reader map

- Read **Product Decision Summary** and **TaleLabs Product Boundary** for the
  product contract.
- Read **Market Research** and **UX Research Outcome** for evidence and
  competitor patterns.
- Read **UX Spatial and Interaction Specification** before designing or
  implementing the route.
- Read the Image, Video, Audio, Tiptap, and Result Stream sections for UX
  behavior.
- Read **Architecture and Reuse Contract** before changing code or schema.
- Execute only through **Delivery Plan** and judge implementation with
  **Implementation Review Gate**.

## Product Decision Summary

The recommended first release has these properties:

- one direct creation route with Image, Video, and Audio tabs;
- a session stream containing generation requests and results;
- one model-adaptive composer shared by the three media surfaces;
- task-specific Audio intents rather than one ambiguous Audio form;
- uploads and Asset-library selection through the existing Asset system;
- Tiptap `@` references for media already attached to the current request;
- dedicated attachment roles such as `Start frame` and `Source audio`;
- one ordinary TaleLabs run for every submitted request;
- browser BYOK and managed execution through the existing runtime drivers;
- every successful result persisted immediately as a canonical Asset;
- continuation actions such as `Use as reference` and `Make video`;
- an `Open in Flow` action that moves advanced work to the canvas;
- model-specific settings and constraints driven by the Models Catalog;
- truthful long-running progress that survives navigation and refresh.

The first release should not include:

- autonomous planning or an LLM choosing a sequence of tools;
- general-purpose questions, assistant answers, or conversation memory;
- assistant text replies mixed with generation results;
- multi-step generation from one message;
- a second provider or execution architecture;
- a timeline, video editor, or audio workstation;
- Apps, Recipes, Tools, or a preset marketplace;
- silent use of every prior session result as model context;
- model controls that are invalid for the selected operation;
- a generic Audio form that pretends speech, music, sound effects, voice
  conversion, and isolation are the same task.

## Architecture Review Outcome

The product direction is viable, but only as a **second presentation of the
existing Flow and run system**. The reviewed implementation boundary is:

```txt
Create UI
-> ordinary Flow draft marked as a Create session
-> existing graph synchronization and model-adaptive resolution
-> existing run admission and immutable snapshot
-> existing browser or managed execution
-> existing canonical Asset ingestion
```

The following alternatives were reviewed and rejected because they duplicate
ownership or increase maintenance cost:

- a `createRequests` or `createMessages` execution table;
- a second generation endpoint that calls providers directly;
- a parallel `/create-sessions` CRUD stack with its own persistence service;
- a `direct-creation` planner or runtime inside `@talelabs/flows`;
- a second model/settings matrix maintained by the Create page;
- a Create-specific upload queue, realtime observer, or result format;
- a feature-wide Zustand store before the draft has demonstrated distant,
  high-frequency consumers.

The current repository already contains the expensive and difficult parts:
revisioned Flow drafts, immutable run snapshots, managed and browser execution,
global run observation, canonical Asset ingestion, a model-adaptive catalog,
and a structured `PromptTemplate`. Create should compose those capabilities,
not reinterpret them.

This conclusion follows React's single-source-of-truth guidance: each piece of
state has one owner, but unrelated state does not need to be centralized in one
global store. Server state remains in TanStack Query, the Tiptap editor owns its
ephemeral editing mechanics, and the route-level Create draft owns only the
current unsaved request.

## Why This Surface Matters

The current TaleLabs loop is powerful but assumes that the user understands a
visual graph. That is appropriate for reusable, branching, and multi-step work,
but it is unnecessary friction for common jobs such as:

- generate one product image;
- edit an existing image using two references;
- animate a still image;
- create a video between a start and end frame;
- transform a source video using visual references;
- generate a voiceover;
- generate a music bed or sound effect;
- change a voice;
- isolate speech from an audio or video recording.

A direct surface expands TaleLabs' usable audience without weakening the
canvas. The user can begin with a simple request, inspect the result, reuse it,
and open the exact work in a Flow only when the task becomes more complex.

The direct page is therefore not a replacement for Flows. It is an onboarding
and rapid-iteration surface that feeds Assets and Flows.

## User Jobs

### Fast first generation

```txt
Open Create
-> choose Image, Video, or Audio
-> describe the result
-> optionally attach references
-> Generate
-> inspect the result
```

The first successful generation should not require understanding nodes,
handles, graph execution, provider protocols, or technical operation names.

### Iterate from a result

```txt
Generate image
-> Use as reference
-> change prompt
-> generate a variation
```

or:

```txt
Generate image
-> Make video
-> image becomes Start frame
-> describe motion
-> generate video
```

### Combine references explicitly

```txt
Attach product photo
Attach location photo
Prompt:
"Place @Image 1 in the environment from @Image 2"
```

The user must be able to see which files are attached, what role each file has,
and which file an inline reference means.

### Perform a task-specific audio operation

```txt
Speech          = script + voice + speech settings
Music           = prompt + optional lyrics + music settings
Sound effect    = prompt + duration/loop settings
Voice changer   = source audio/video + target voice
Voice isolation = source audio/video
```

These operations should share a page and design language, not one misleading
input schema.

## Market Research

### Evidence method

Product behavior was checked first against official competitor documentation.
Community discussions are used only to identify recurring confusion or desired
outcomes; they are not treated as capability, market-size, or architecture
evidence. Technical recommendations were checked against the current TaleLabs
repository and the official React, TanStack Query, React Flow, and Tiptap
documentation.

The competitor interfaces still require user-owned screenshot review because
visual details and logged-in product behavior can change faster than published
documentation. Provider input rules are deliberately not copied into this
document: the reviewed Models Catalog remains authoritative at runtime.

### Runway

Runway's current product documentation distinguishes precise direct generation,
guided Apps, Agent, and node-based Workflows. Its
[Sessions documentation](https://help.runwayml.com/hc/en-us/articles/33545310653203-Generating-with-Sessions)
describes the chronological generation container:

```txt
Custom   = precise direct generation
Apps     = guided use-case forms
Agent    = conversational creative partner
Workflows = node-based pipelines
```

Custom, Apps, and Agent create Sessions. Results remain scrollable within the
session, and completed results expose a `Use` action for continued work.
Sessions organize related iterations without owning the generated Assets;
deleting a Session does not delete its Assets.

Runway's
[reference-media documentation](https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations)
is the closest direct reference for TaleLabs' prompt interaction. Uploaded
media receives labels such as `Image 1`, `Video 1`, and `Audio 1`. Typing `@`
inserts one of those references into the prompt. The available media types
depend on the selected model.

Important lessons:

- direct creation and Workflows can coexist in one product;
- a session is an iteration container, not the media source of truth;
- generated results need immediate continuation actions;
- references need visible labels and inline semantic mentions;
- the selected model controls which references are valid;
- direct deterministic generation and an autonomous Agent are distinct
  products and should not be conflated.

### Luma Dream Machine

Luma's
[web quick start](https://lumalabs.ai/learning-hub/web-quick-start)
shows a Board workflow that starts with a prompt, returns several images, and
makes each result actionable through operations such as More Like This,
Brainstorm, Modify, and Make Video. Selecting an image and choosing Make Video
produces video variations beneath it.

Luma's
[Boards and Ideas guidance](https://lumalabs.ai/learning-hub/navigating-boards-ideas)
distinguishes related-work containers from the broader generated-media
collection. Its image guidance describes images as reusable inputs that can be
edited, reframed, animated, or placed into a larger workflow.

Important lessons:

- the best next action should be attached to the result;
- users should not need to return to an empty form after every generation;
- related iterations benefit from a session or board;
- global Assets remain separate from session organization;
- image-to-video is a primary continuation path, not an advanced corner case.

### Krea

Krea markets a simple direct Image and Video experience alongside Nodes and
Apps. Its
[Image product documentation](https://www.krea.ai/features/ai-image-generator)
supports model choice, image references, editing, and continuation without
requiring the node canvas.

Important lessons:

- direct creation can be the broad onboarding surface while Nodes serve
  advanced users;
- model choice should be accessible but not dominate the empty state;
- reference attachments and result operations belong in the same workflow;
- the product should make trying another model cheap in interaction terms even
  when generation itself has a monetary cost.

### Higgsfield

Higgsfield exposes a direct
[AI Video Generator](https://higgsfield.ai/ai-video) where the user chooses a
model, supplies a prompt, and adds model-dependent first/last images, source
video, or motion references. It separately positions
[Higgsfield Canvas](https://higgsfield.ai/canvas-intro) as a node-based space
for chaining prompts, references, image generations, and video generations.

Important lessons:

- direct generation and a node canvas can share models while serving different
  task complexity;
- the direct surface should expose natural media roles rather than graph
  handles or provider operation IDs;
- reference controls must follow the selected model instead of appearing as a
  universal attachment list;
- opening advanced work in a canvas is a continuation path, not a requirement
  for the first generation.

### Leonardo

Leonardo's
[Image Guidance documentation](https://intercom.help/leonardo-ai/en/articles/8497988-image-guidance)
describes reference controls whose availability varies by model. Its
[Video documentation](https://intercom.help/leonardo-ai/en/articles/11027827-generating-video-on-leonardo-ai)
and
[start/end-frame guidance](https://intercom.help/leonardo-ai/en/articles/12504736-creating-videos-with-start-frames-and-end-frames)
show model-dependent video inputs and continuation from existing generated
media.

Important lessons:

- default-simple and advanced controls can share the same engine;
- incompatible inputs must be absent or clearly unavailable;
- an end frame may require a start frame;
- model capability labels reduce trial-and-error;
- output-to-next-operation shortcuts are expected behavior.

### Adobe Firefly

Adobe Firefly's
[video-generation documentation](https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-video-using-firefly-models.html)
exposes prompt, model-dependent settings, first and last frames, references,
and camera controls. Controls change when an input makes another mode
incompatible.

Important lesson: media attachments are not an undifferentiated list. `Start
frame`, `End frame`, `Reference image`, `Source video`, and `Motion reference`
have different semantics. The UI must represent those roles and enforce the
model's mutually exclusive combinations.

### Freepik and Magnific

Magnific's
[video-generator documentation](https://www.magnific.com/ai/docs/video-generator)
distinguishes text-to-video, a start image, start and end images, and supported
visual-prompt modes. Existing generated images can be reused directly as a
video input.

Important lessons:

- use natural role names instead of exposing provider operation IDs;
- prefill the correct role when a user continues from an existing result;
- prompt guidance should change with the selected input mode;
- model-specific visual controls should not appear universally.

### ElevenLabs

ElevenLabs documents
[speech](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech),
[music](https://elevenlabs.io/docs/overview/capabilities/music),
[sound effects](https://elevenlabs.io/docs/overview/capabilities/sound-effects),
[voice changing](https://elevenlabs.io/docs/overview/capabilities/voice-changer),
and
[voice isolation](https://elevenlabs.io/docs/overview/capabilities/voice-isolator)
as separate tasks because their input and setting contracts differ
substantially:

- Speech uses text, a target voice, a model, and speech settings.
- Music uses natural-language musical direction, optional vocals or lyrics,
  structure, and duration.
- Sound Effects uses a description, optional duration, and loop behavior.
- Voice Changer transforms source audio into a target voice while preserving
  delivery.
- Voice Isolation extracts speech from source audio or video.

Important lesson: TaleLabs should use one Audio area with explicit intents,
not one universal Audio prompt form.

### Qualitative Community Signals

Community discussions are not market-size evidence, but they reveal recurring
interaction problems:

- users confuse a reference image with a start frame;
- users are unsure whether references apply to image generation, video
  generation, or both;
- similar model names and different input capabilities make model selection
  hard to understand;
- users report wasting credits while discovering unsupported or ineffective
  combinations;
- creators commonly generate or refine a still image before animating it;
- users want simple prompting for simple requests, not a required prompt
  engineering workflow.

These signals reinforce three design requirements:

1. Attachments need explicit roles.
2. Available roles and settings must be model-adaptive.
3. Inline references must identify exact attached media.

## Competitor Pattern Matrix

| Product | Direct surface | Advanced surface | Reference behavior | Result continuation |
| --- | --- | --- | --- | --- |
| Runway | Custom, Apps, Agent | Workflows | Labeled image/video/audio references with `@` | `Use` actions inside Sessions |
| Luma | Board composer | Canvas/workflow capabilities | Visual, style, character, and keyframe references | Modify, variations, Make Video |
| Krea | Image, Video, Realtime | Nodes and Apps | One or more references, model-specific | Edit, upscale, animate, compare |
| Higgsfield | Image and Video generators | Canvas | First/last image, video and motion references vary by model | Continue into editing or Canvas |
| Leonardo | Home prompt and creation tools | Advanced creation/editor controls | Guidance types vary by model | Existing images become video inputs |
| Firefly | Image/video generation forms | Video editor | Role-specific frames and references | Continue into editing tools |
| Freepik/Magnific | Image/video/audio tools | Editors and specialized tools | Start/end/reference inputs | Reuse generated media in another mode |
| ElevenLabs | Dedicated audio task pages | Studio and Flows | Source media or voice per task | Reuse/download/edit audio results |

The market does not support a conclusion that every successful product must
have an autonomous chat. It does support a strong conclusion that broad
creative platforms need a simple direct generation path in addition to an
advanced canvas.

## UX Research Outcome

### Evidence-to-decision map

The research supports a **session workspace**, not a generic chat interface and
not a compressed copy of the Flow canvas.

| Observed pattern | Primary evidence | TaleLabs decision |
| --- | --- | --- |
| Iterations need a lightweight container ordered by recent activity. | [Runway Sessions](https://help.runwayml.com/hc/en-us/articles/33545310653203-Generating-with-Sessions) groups related generations, names a session from its first prompt, and keeps deleted-session Assets available. | Use a compact Sessions rail backed by ordinary Create-surface Flows. A session is organization, not a second media store. |
| Users need both temporary uploads and durable reusable media. | [Runway reference media](https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations) accepts dashboard Assets or drag-and-drop uploads, gives them stable labels, and exposes them through `@`. | Reuse TaleLabs uploads and Asset picking. Label attached media by type and order, and let Tiptap mention only attached inputs. |
| The fastest creative loop is result-first and continuation-driven. | [Luma's web quick start](https://lumalabs.ai/learning-hub/web-quick-start) moves from prompt to image batches, then More Like This, Modify, and Make Video without forcing a new project model. | Keep results visually dominant and place continuation actions beside each result. Do not make users manually reconstruct the next request. |
| Multiple outputs are useful for comparison, not separate conversations. | [Krea Image](https://www.krea.ai/features/ai-image-generator) presents multiple results, variations, references, and model switching in one generation surface. | Group siblings from one run in one result group with a stable comparison layout and honest partial-success state. |
| Inputs must change with model capability. | [Higgsfield Video](https://higgsfield.ai/ai-video) exposes text, first/last images, video editing, and motion control as model-dependent paths. | The selected model and existing resolver determine visible attachment roles. Never show every theoretical input at once. |
| Mutually exclusive inputs should be prevented before generation. | [Adobe Firefly Video](https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-video-using-firefly-models.html) disables composition, motion, camera, and style controls when first/last frames make them incompatible. | Apply the same capability rules as generation nodes. Hide unavailable roles, disable blocked combinations with a reason, and never defer basic validation until a paid run. |
| Audio creation is several distinct jobs, not one universal prompt box. | [ElevenCreative Studio](https://elevenlabs.io/docs/eleven-creative/products/studio), [Music](https://elevenlabs.io/docs/eleven-creative/products/music), [Sound Effects](https://elevenlabs.io/docs/overview/capabilities/sound-effects), [Voice Changer](https://elevenlabs.io/docs/overview/capabilities/voice-changer), and [Voice Isolator](https://elevenlabs.io/docs/overview/capabilities/voice-isolator) expose different source, target, prompt, voice, duration, and output contracts. | Audio uses a required secondary intent. Each intent composes the same shell but owns a task-specific form. |
| Dense creative work benefits from persistent context, not stacked dialogs. | [ElevenCreative Studio](https://elevenlabs.io/docs/eleven-creative/products/studio) uses a contextual sidebar for selected media and generation controls. | Keep model/settings visible in a right inspector on wide screens and move that same content into a sheet on narrow screens. Do not place settings inside nested modal flows. |
| Mention selection is an editable combobox interaction. | [WAI-ARIA Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) and [Tiptap Suggestion](https://tiptap.dev/docs/editor/api/utilities/suggestion) define popup state, keyboard acceptance, Escape behavior, and focus ownership. | The `@` menu keeps DOM focus in the composer, supports arrows/Enter/Escape, and announces its active option and result count. |
| The page must collapse without hiding functionality. | [WCAG Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) requires ordinary content to remain usable at narrow equivalent widths; [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) sets a 24 CSS pixel minimum target expectation. | Sessions and Settings become drawers/sheets, results become one column, and the composer respects mobile safe areas. Icon targets remain at least 32 CSS pixels in TaleLabs even when glyphs are smaller. |

### Design read

Read this as a **professional creative workspace for repeated generation**, not
a landing page, social chat, or media editor. The visual language should be:

```txt
quiet
dark-neutral
media-led
dense enough for repeated work
predictable enough for first-time use
consistent with Assets, Flows, and Elements
```

The generated media supplies visual color. Chrome should use existing TaleLabs
surface, border, muted, foreground, focus-ring, spacing, radius, and icon
tokens. Do not introduce gradients, decorative glows, large hero typography,
floating page sections, or a new accent palette.

### UX principles

1. **The primary object is the current request.** Users should be able to
   identify its output type, inputs, prompt, model, settings, cost, and Generate
   command without opening a second workflow.
2. **Results receive the most space.** History and settings support the result;
   they do not visually compete with it.
3. **Progressive disclosure follows capability.** Show controls only when the
   active media intent, operation, model, and inputs make them relevant.
4. **Iteration is explicit.** A prior result affects the next run only after a
   user invokes a continuation action or attaches it.
5. **The interface never pretends generation is instant.** Reserve output
   space, show truthful stages and elapsed time, and allow navigation while the
   global run system continues.
6. **Changing models is immediate.** Do not show a confirmation dialog. If a
   switch makes an input unusable, detach it from execution without deleting
   its Asset and present one nearby undoable notice.
7. **No Save theater.** Uploads and outputs already become Assets; drafts and
   session identity synchronize automatically through the existing Flow path.
8. **No hidden chat memory.** Historical requests are visible evidence, not
   implicit context for a later request.

### Patterns intentionally not copied

- Chat bubbles that imply an assistant or make media narrow.
- A centered marketing-style hero above the first usable control.
- A grid of mode cards before the user can type a prompt.
- One generic attachment tray that hides whether media is a start frame,
  source video, voice source, or reference.
- A settings modal for every model change.
- Technical provider payloads, binding IDs, contract versions, or Flow
  revisions in the default UI.
- Separate `Save`, `Add to Assets`, or `Import result` actions for media that is
  already a canonical Asset.
- A permanently visible three-column layout on tablet or mobile.

## TaleLabs Product Boundary

### Create is not Agent

The interface may resemble a conversation because it presents requests and
results in chronological order. The system should not imply that an assistant
is reasoning, planning, or selecting hidden multi-step workflows.

Each user submission has an explicit contract:

```txt
media intent
model
attached inputs and roles
structured prompt
settings
output count
execution runtime
estimated provider cost when applicable
```

This makes behavior predictable and preserves TaleLabs' current provenance and
run-debugging strengths.

### Interaction model: conversational rhythm, explicit creation commands

Create may have the chronological rhythm of a chat, but it is a
**command-oriented media creation workspace**, not a general-purpose AI
conversation.

The selected mode and Audio intent define what submitting means:

| Active surface | Submission command |
| --- | --- |
| Image | Generate or transform image Assets. |
| Video | Generate, transform, or extend video according to the selected operation and attached roles. |
| Speech | Generate speech from the authored text and selected voice/model. |
| Music | Generate music from prompt, lyrics, and supported references. |
| Sound Effect | Generate an audio effect from its task prompt and settings. |
| Voice Changer | Transform the explicitly attached source using the selected target voice/model. |
| Voice Isolation | Isolate speech from the explicitly attached source. |

Use command-specific labels such as `Generate image`, `Generate video`,
`Generate speech`, or `Isolate voice`. Never use a generic `Send` button or a
paper-plane affordance that implies TaleLabs will decide what kind of response
to return.

The behavior for ambiguous or conversational-looking input is deliberate:

| User input | MVP behavior |
| --- | --- |
| `Create a cinematic product shot of @Image 1` in Image mode | Admit an Image generation request using the explicit attachment and prompt. |
| `Make it warmer` after a prior result, with that result attached or selected through a continuation action | Admit a new generation using the explicit prior Asset. |
| `Make it warmer` without attaching a prior result | Do not infer hidden history. The words remain an ordinary creative prompt; nearby guidance should explain how to reuse a result. |
| `What is a Dutch angle?` in Video mode | Do not produce an assistant text reply. If submitted, treat it as the literal Video prompt under the visible `Generate video` command. |
| `How do I use references?` | Do not invoke a hidden support agent. Offer ordinary contextual help or documentation outside the result stream. |

Do not add an LLM intent classifier to decide whether a submission is a
question, generation prompt, edit, or support request. That would introduce
hidden routing, latency, cost, uncertain behavior, and a second product contract.
The visible mode, intent, attachment roles, and model capability resolver are
the router.

The result stream therefore contains only:

```txt
immutable generation request summary
run status
generated media Assets
persistent generation errors
explicit continuation actions
```

It does not contain assistant prose, greetings, clarifying questions, tool-call
transcripts, hidden memory summaries, or citations. Inline guidance and
validation are ordinary product UI, not messages authored by an AI persona.

### How competitors separate generation and conversation

Current competitors do not generally use one ambiguous composer that silently
decides whether to answer, research, edit, or generate. They expose a visible
product or mode boundary:

| Product | Direct creation behavior | Conversational behavior | Boundary presented to the user |
| --- | --- | --- | --- |
| Runway | `Custom` exposes explicit model, input, prompt, and generation controls inside a Session. | `Agent` is a separate generation method that analyzes a request, creates a plan, may ask clarifying questions, chooses models, and can wait for approval before spending credits. | `Custom`, `Apps`, `Agent`, and `Workflow` are separately named methods inside Sessions. General creative collaboration belongs to Agent, not Custom. |
| Luma | Earlier Boards supported direct prompt, batch, Modify, and Make Video actions. | The current Luma Agent is intentionally agent-first: Research Mode can answer questions and perform web research; Create Mode can choose models and orchestrate image, video, audio, voice, and other tasks with shared context. | `Research` and `Create` are explicit modes. Luma chose a broad agent product rather than pretending a deterministic generator is a chat. |
| Adobe Firefly | Dedicated Generate Image and Generate Video tools expose prompt, model, references, camera, and output settings. | Firefly AI Assistant is a separately named conversational interface that selects tools and executes multi-step creative work. | Direct tools remain available alongside AI Assistant. |
| ElevenLabs | Speech, Music, Sound Effects, Voice Changer, Voice Isolation, Flows, and Studio retain task-specific contracts. | Studio Agent is a contextual video co-editor with `Plan` and `Create` modes. It asks questions, plans timeline work, and acts on the current project. ElevenAgents is a separate conversational-agent product. | The agent is explicitly entered inside a Studio video project; ordinary audio generators do not become general Q&A. |
| Krea and Higgsfield | Current researched surfaces are predominantly mode-, model-, and task-driven Image, Video, Realtime, and Canvas tools. | No equivalent general-purpose creative chat contract was confirmed in the reviewed official material. | The visible mode and selected model determine the operation. Do not infer broader behavior without new evidence. |

Sources: [Runway navigation](https://help.runwayml.com/hc/en-us/articles/24298206897043-Navigating-Runway),
[Runway Agent](https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent),
[Luma Agent](https://lumalabs.ai/learning-center/articles/about-the-luma-agent),
[Luma research](https://lumalabs.ai/learning-center/articles/research-with-luma),
[Firefly overview](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/adobe-firefly-overview.html),
[Firefly AI Assistant](https://helpx.adobe.com/ca/firefly/web/firefly-ai-assistant/ai-assistant-faq.html),
and [ElevenCreative Studio](https://elevenlabs.io/docs/eleven-creative/products/studio).

The market lesson is not that TaleLabs must add general chat to compete. It is
that **direct control and agentic collaboration are different product
contracts**. Runway and Firefly support both by naming them separately. Luma's
agent-first approach also confirms the scope required to do chat honestly:
research, memory, planning, model routing, clarifying questions, multi-step
execution, and explicit execution modes.

TaleLabs should first ship the direct contract because its current advantage is
already production-shaped Assets, adaptive models, cost visibility, browser
BYOK, managed execution, and Flows. A future Agent can invoke those same
capabilities later without making the first Create surface unpredictable.

### General chat is a separate future product decision

If product evidence later supports general questions, research, prompt
coaching, or autonomous multi-step help, expose it as a clearly named Agent or
Ask surface with its own contract. That decision would require explicit answers
for:

- whether responses are text, media, or both;
- what conversation history becomes model context;
- which tools the assistant may invoke and when confirmation is required;
- citation and web-research behavior;
- assistant/model selection, cost estimation, and cancellation;
- persistence, deletion, privacy, moderation, and observability;
- how an assistant-created request becomes an ordinary Flow run.

Do not prepare speculative chat persistence, generic message tables, tool-call
renderers, or assistant components inside Create. The current session and run
model should remain optimized for explicit Asset creation.

### Create is not a second runtime

Create should assemble an ordinary one-step Flow graph and invoke the ordinary
run engine. It should not call providers through a new direct-generation API.

Recommended internal representation:

```txt
Create Session
  -> backed by an ordinary Flow identity marked with surface=create
  -> current draft represented by Asset input nodes plus one generation node
  -> each submission admitted as an ordinary immutable Flow run
  -> every result ingested as a canonical Asset
```

This research recommends one explicit Flow `surface` discriminator, not a
parallel generation schema. It still requires product approval and updates to
the binding database/API documents before implementation:

```txt
canvas = visible in the Flows library and editor
create = visible in Create session history
```

An `Open in Flow` action should clone the current session graph into a new
ordinary canvas Flow. Historical runs remain attached to their original Create
session and immutable snapshots.

### Create does not replace Assets

Uploaded references should use the existing upload manager and become
canonical Assets. Generated outputs already become canonical Assets. A session
organizes requests and results but does not own the underlying media lifecycle.

Deleting a session should not delete its Assets. Asset purge behavior remains
owned by the Asset system.

## UX Spatial and Interaction Specification

This section is the visual and interaction contract for implementation. It is
deliberately more specific than the architecture sections so an implementation
session does not have to invent the page hierarchy.

### Primary navigation and route behavior

Add one command-oriented entry:

```txt
Create
Flows
Assets
Elements
```

`Create` is the lowest-friction entry. `Flows` remains the advanced spatial
surface. The route model should support:

```txt
/create                 new unsaved request
/create/:sessionId      existing session
```

An existing session must have a stable, shareable-within-the-workspace URL.
Browser back and forward should move between session routes without losing an
unsaved draft in the session being left. Do not encode prompt content or Asset
IDs in the URL.

### Relationship to the dashboard shell

Keep the existing TaleLabs application sidebar, 64-pixel global header, global
search, upload indicator, Asset shortcut, settings, organization scope, global
upload provider, browser runtime root, and run-realtime observer.

The Create route itself is a full-height work surface below the existing global
header:

```txt
Dashboard sidebar
└── Dashboard header
    └── Create workspace
        ├── Sessions rail
        ├── Creation workspace
        └── Settings inspector
```

Do not render a second app header, a second global search, another upload
provider, or another run observer. The route must own its internal scrolling
instead of placing the whole three-zone workspace inside the ordinary
dashboard page scroll and `p-6` browse-page wrapper.

### Wide desktop layout

At a content viewport of approximately 1280 CSS pixels or wider, use three
full-height bands separated by one-pixel borders:

```txt
┌──────────────────┬──────────────────────────────────────┬───────────────────┐
│ Sessions         │ Session workspace                    │ Settings          │
│ 240-264 px       │ min 520 px / fluid                   │ 304-336 px        │
│                  │                                      │                   │
│ New              │ Session header                       │ Model             │
│ Search           │                                      │ Output            │
│ Recent sessions  │ Scrollable request/result history    │ Model controls    │
│                  │                                      │ Runtime summary   │
│ Load more        │ Docked composer                      │                   │
└──────────────────┴──────────────────────────────────────┴───────────────────┘
```

Recommended grid constraint:

```txt
minmax(240px, 264px) minmax(520px, 1fr) minmax(304px, 336px)
```

These are layout constraints, not JavaScript measurements. The center column
may grow on wide monitors, but prompt and result text should remain in an inner
reading column no wider than approximately 880 pixels. Large image and video
previews may use more of the center column when their aspect ratio benefits.

The outer bands are page regions, not cards. Use the current background plus
separators. Reserve cards for individual media results, attachment tools, and
framed controls.

### Medium desktop layout

Between approximately 1024 and 1279 CSS pixels:

- keep the Sessions rail visible only when there is at least 720 pixels left
  for the creation workspace;
- otherwise collapse Sessions to one icon command that opens a left drawer;
- move Settings behind an inspector button in the session header;
- open Settings as a right sheet, using the exact same settings composition as
  the wide inspector;
- preserve the center stream and composer width rather than squeezing all
  three columns.

Do not shrink the inspector into an unreadable sliver or allow it to overlap the
composer.

### Tablet and mobile layout

Below approximately 1024 CSS pixels, use one content column:

```txt
Session header
Mode and intent controls
Request/result stream
Docked composer
```

- Sessions opens from the header as a left drawer.
- Settings opens as a right sheet on tablet and a bottom sheet on narrow mobile.
- Media result grids collapse to one column below 640 pixels.
- Mode tabs remain visible above the composer. If translated labels do not fit,
  use equal-width tabs with wrapping inside the segment rather than reducing
  font size with viewport width.
- The composer uses `env(safe-area-inset-bottom)` and never covers the last
  result or mobile browser controls.
- Attachment rows scroll horizontally only within their own strip; the page
  must not gain horizontal scrolling.
- A full-screen Asset picker is acceptable on mobile; do not compress the
  desktop dialog into an unusable viewport.
- Do not auto-focus the composer on mobile and force the keyboard open when the
  route loads.

The interface should remain functional at 320 CSS pixels of ordinary content
width. Media itself may retain aspect-ratio-specific layout, but labels,
controls, settings, errors, and result actions must reflow without two-axis
page scrolling.

### Visual system

Match the current dashboard instead of inventing a separate Create aesthetic:

| Element | Contract |
| --- | --- |
| Page/session title | 20px-equivalent semibold, zero negative letter spacing, single line with truncation and full-name tooltip when needed. |
| Section heading | 14-16px semibold; no oversized panel headings. |
| Body and controls | Existing 14px dashboard scale; muted text must still pass contrast. |
| Borders | Existing subtle one-pixel border token. Use borders and space before elevation. |
| Radius | Existing dashboard scale, no more than 8px for cards/tools unless a shared component requires otherwise. Pills are reserved for compact statuses, tabs, and segmented controls. |
| Icons | Existing Tabler icon family and shared domain icons. Never draw feature-local SVGs. |
| Color | Existing semantic tokens. Generated media is the visual focal point; do not color-code each mode with a new palette. |
| Motion | Short opacity/transform transitions only, interruptible, with reduced-motion behavior. No ambient decorative animation. |

Every fixed-format media preview, attachment thumbnail, result grid, toolbar,
and composer action row needs stable dimensions or aspect-ratio constraints so
loading, status text, hover actions, and translated labels do not shift the
workspace.

### Sessions rail

The rail is an organizer, not a second Assets browser.

Top-to-bottom structure:

```txt
[ + New ]
[ Search sessions… ]

Today
  [thumbnail] Session name        status/time
  [thumbnail] Session name        status/time

Previous
  ...

[ Load more ]
```

Interaction contract:

- `New` navigates to `/create` and leaves the previous session recoverable.
- Search is server-backed after debounce/deferred input; do not filter only the
  currently loaded page.
- Rows are compact, approximately 48-56 pixels high, with a 32-40 pixel media
  thumbnail when one exists.
- A session without output uses a restrained media-intent icon, not an empty
  broken thumbnail.
- The active session uses background/border emphasis, not only text color.
- Show the session name and one secondary line: relative last activity or an
  active state such as `Generating`.
- Use `Intl.RelativeTimeFormat` or the existing localized date utilities.
- Rename and Delete live in the row overflow menu. Deleting a session requires
  confirmation because it is irreversible, and copy must state that its Assets
  remain available.
- Cursor pagination uses `Load more`; do not infinite-scroll the rail without
  an explicit loading boundary.
- When a new session receives its first successful output, update its thumbnail
  without moving keyboard focus.
- Do not subscribe every row to live run details. Active session summaries may
  update from shared query invalidation.

### Session header

The center workspace begins with one compact 48-56 pixel header:

```txt
[Sessions]  Session name / Draft                      [Open in Flow] [Settings]
```

- Hide the Sessions button when the rail is visible.
- The name is inline-renamable after session identity exists.
- `Draft` is a subtle state, not a warning.
- `Open in Flow` appears only after a backing Flow exists. It clones the current
  draft into a canvas Flow; it does not mutate the historical session.
- Settings is icon-only on constrained screens and needs an accessible label.
- Keep secondary commands in one overflow menu. Do not put download, favorite,
  or media-specific actions in the session header.
- Do not show Flow revision, model contract, provider route, run ID, or other
  engineering metadata in the ordinary product header.

### Empty workspace

Before the first request, the route should present the real creation tool in
the first viewport. Use a vertically biased composition, with the composer
starting around the upper-middle of the available workspace rather than
exactly centered.

```txt
              Image | Video | Audio
              [ Audio intent when Audio ]

              ┌────────────────────────────────────┐
              │ attachment roles when applicable   │
              │                                    │
              │ prompt or task-specific input      │
              │                                    │
              │ model / settings / cost / Generate │
              └────────────────────────────────────┘
```

Do not add:

- a marketing headline;
- feature descriptions;
- keyboard-shortcut instructions;
- mode cards;
- example-gallery cards inside the composer;
- a decorative image that competes with the request tool.

An optional compact rotating prompt suggestion may be considered later, but it
is not required for the first release and must never replace a visible label.

### Established session workspace

After the first request, the center column becomes a chronological work log:

```txt
oldest loaded request
result group

next request
result group

active request
reserved result frame and truthful progress

composer docked at bottom
```

This should **not** look like alternating left/right chat bubbles. Request
summaries are compact full-width rows. Results are larger media-led groups
directly below the request that produced them.

The scroll container owns history. The composer is a sibling docked to its
bottom edge, not a child that scrolls away. Add bottom padding to history equal
to the composer's measured stable footprint without reading layout on every
render.

### Composer anatomy

The composer is one framed tool with a maximum 8-pixel radius. Do not place
cards inside it.

Recommended order:

```txt
┌────────────────────────────────────────────────────────────┐
│ Image | Video | Audio     [secondary Audio intent]         │
├────────────────────────────────────────────────────────────┤
│ role-specific attachment slots and attached media          │
│                                                            │
│ Tiptap prompt / script / lyrics / task-specific input       │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Model   primary controls   estimate/runtime     Generate    │
└────────────────────────────────────────────────────────────┘
```

Composer rules:

- Use one active Tiptap editor, mounted only for intents that accept structured
  text.
- Use mode-specific labels and placeholders such as `Describe the image`,
  `Describe the motion, camera, and scene`, `Enter the speech`, or `Describe
  the sound`. Never use `Ask anything`, `Message TaleLabs`, or another label
  that promises general conversation.
- Use a labeled ordinary textarea or structured task field where Tiptap adds no
  value, such as a simple source-only isolation task.
- Prompt area minimum height is approximately 112 pixels. It may grow to about
  240 pixels, then scroll internally so a long prompt does not push Generate
  out of view.
- Preserve standard browser editing, paste, selection, undo, and IME behavior.
- `Cmd/Ctrl + Enter` invokes Generate when the request is valid. Plain Enter
  inserts a paragraph.
- Generate remains a text button with the media-intent command. Do not use only
  an arrow icon for a paid or consequential action.
- While admission is pending, disable duplicate submission and preserve the
  entire draft. After admission, the user may prepare the next request while
  the previous run continues.
- A disabled Generate button must have a nearby visible reason such as `Add a
  start frame` or `Connect an OpenRouter key`, not a tooltip-only explanation.
- Managed mode shows the current estimate adjacent to Generate. Browser BYOK
  shows the executing provider/key state and no platform-cost estimate.
- Common controls such as aspect ratio or duration may remain in the action row
  only when they fit without wrapping. Otherwise they stay in Settings.
- Never duplicate a setting in both the action row and inspector as separate
  state owners; both presentations must bind to one draft field.

### Attachment slots

Attachment roles belong above the prompt because they determine the operation
and the available prompt references.

Each role is one labeled field composed from shared Asset primitives:

```txt
Start frame                         1 / 1
[ thumbnail  Asset name  remove ]  [Choose]

Image references                    2 / 4
[thumb] [thumb]                     [Add]
```

- The field label names the semantic role, not just the media type.
- Show current count and model limit when the role accepts several inputs.
- `Choose` or `Add` opens the existing Asset library dialog with accepted media
  filters; drag-and-drop/device upload uses the existing global upload manager.
- Uploading must show local progress through the existing global indicator.
  Completed uploads become ordinary Assets before attachment.
- A thumbnail includes an accessible name, media type, processing/error state,
  and remove command.
- Click media to inspect it in the existing Asset viewer; do not make the whole
  attachment row both a picker and viewer.
- Model-specific mutual exclusion is enforced immediately. Unavailable roles
  are absent; temporarily blocked roles remain visible only when showing the
  reason helps the user understand an existing selection.
- Switching model never deletes an Asset. Inputs that cannot be retained are
  detached from execution with one local undo affordance and a concise inline
  status. Do not open a confirmation modal.
- Attachment role and inline `@` mention remain separate contracts.

### Settings inspector

The inspector is contextual to the current draft, not to a selected historical
result.

Order settings by user decision frequency:

```txt
Model
Output
  aspect ratio / resolution / duration / output count
Generation controls
  only settings supported by the selected model and operation
Advanced
  seed or uncommon controls
Execution
  managed or browser provider, estimated cost when applicable
```

- Use labels above or beside compact controls consistently with the existing
  dashboard form system.
- Model selection shows display name and media capability, not provider route
  internals.
- Controls appear, disappear, or constrain their options through the existing
  model-adaptive resolver.
- Preserve compatible values across model changes. Reset incompatible values
  to reviewed defaults and surface the change near the field; do not keep
  hidden invalid state.
- Keep Advanced collapsed by default.
- Place field errors adjacent to fields.
- The inspector scrolls independently on wide screens. Its header and close
  command remain visible in sheet presentation.
- Do not make the user open Settings merely to discover why Generate is
  disabled; readiness errors must also appear at the composer command.

### Session persistence behavior

- Do not create a persisted session merely because `/create` was opened.
- Create the backing Flow lazily when the first server-backed action requires
  an identity. In managed execution this may be the first cost estimate because
  the canonical estimator operates on a saved Flow; in browser BYOK it may be
  the first Generate attempt because estimation is intentionally absent.
- After identity creation, synchronize the canonical draft graph before cost
  estimation or run admission. Claiming that persistence begins only after
  provider success would be dishonest without a new atomic server operation.
- If admission fails after the Flow is created, keep a recoverable Draft session
  rather than deleting data through compensating client calls. Empty drafts may
  be hidden from the default recent list or labeled `Draft`.
- Derive an initial name synchronously from a bounded first-prompt preview. Do
  not block submission on an LLM naming request.
- Allow explicit rename and new session.
- Order recent sessions by last activity.
- Cursor-paginate sessions and their `flowRuns` history independently.
- Preserve request configuration and result lineage per run.
- Do not automatically send prior results to the next request.
- Make reuse explicit through result actions or attached media.

The current saved graph represents the **next editable request**. Each submitted
request is preserved by its immutable run snapshot. The history stream is a
projection of cursor-paginated runs for the session Flow, not a second message
store.

### Scrolling and focus behavior

- On initial session load, position the user at the newest request without an
  animated jump.
- If the user is already near the bottom, newly admitted or completed results
  may keep the stream anchored to the bottom.
- If the user has scrolled upward, never pull the viewport away. Show one
  `New result` affordance that returns to the latest group.
- Loading older history must preserve the current visible anchor rather than
  jumping as rows prepend.
- Starting a generation returns focus to the composer only on desktop and only
  when the user initiated the command from the composer.
- Closing Sessions, Settings, an Asset picker, or an `@` menu returns focus to
  the command that opened it.
- Escape closes only the topmost popup, menu, drawer, or sheet; it must not
  cancel an active run or clear the prompt.

### Accessibility contract

- Use semantic `aside`, `header`, `main`, `section`, `form`, and list markup
  before adding ARIA.
- Provide a skip target for the creation workspace after the dashboard shell.
- Icon-only buttons need localized accessible names and visible focus states.
- Every form control has a persistent label; placeholder text is never the only
  label.
- The `@` suggestion menu follows the editable combobox/listbox keyboard model:
  DOM focus remains in the editor, arrows move the active suggestion, Enter
  accepts, and Escape dismisses without changing prior content.
- Announce suggestion count, validation changes, admission, terminal run state,
  and new completed results with bounded `aria-live="polite"` regions. Do not
  announce elapsed-time ticks continuously.
- Status cannot rely on color alone.
- Controls use at least a 24-by-24 CSS pixel target; TaleLabs should normally
  retain 32-by-32 or larger button hit areas.
- Media needs meaningful alternative text when it conveys user content;
  decorative placeholders use empty alternatives.
- Respect reduced motion and never make animated progress the only status
  signal.
- Verify translated labels, 200% text zoom, and 400% reflow. The media area may
  preserve necessary aspect ratios, but controls and text may not overlap.

## Shared Composer Contract

The composer has four layers:

```txt
1. media intent
2. attachment roles
3. structured prompt when the intent accepts text
4. model-specific settings
```

These layers must use the same model-adaptive resolver as generation nodes.
The page must never maintain a second hand-written matrix of valid inputs,
settings, or constraints.

### Media intent

The primary tab chooses the output family. Audio adds a required secondary
intent because its operations are fundamentally different.

### Attachment roles

Users add media through:

- upload from the device;
- choose from Assets;
- use a previous result;
- later, choose an Element reference when explicitly approved.

Every attachment displays:

- thumbnail or media icon;
- filename or short Asset name;
- role;
- media type;
- remove action;
- invalid state if the selected model no longer accepts it.

### Prompt

Use the existing Tiptap prompt-composer primitives and existing
`PromptTemplate` contract. Do not persist Tiptap JSON or HTML.

### Settings

Show only settings allowed by the selected model and effective input mode.
Primary settings remain near the Generate command. Less common settings use an
Advanced disclosure or the Settings inspector.

## Image Mode

### User-facing states

```txt
No image attached
  -> text-to-image

One or more images attached as references
  -> image-guided generation or editing

Selected model accepts no images
  -> reference controls are absent
```

Do not require the user to select a technical operation when the attachment
state and selected model determine it unambiguously.

### Inputs

- prompt, when required by the model;
- zero or more reference images within the active model limit;
- optional model-supported masks or specialized roles in later phases.

### Settings

Examples are aspect ratio, resolution, output count, seed, and quality. The
Models Catalog remains authoritative. The page must not assume every image
model supports every setting.

### Results

Primary actions:

```txt
Use as reference
Make video
Generate variation
Download
Open Asset
Open in Flow
```

Only show actions supported by the selected result type and current product
scope.

## Video Mode

Video needs role-aware inputs because a source image can mean different things.

### Supported conceptual modes

The UI may describe these modes to the user, but execution must resolve them
through existing model operations and slot constraints:

```txt
Text to video
Image to video
First and last frame
Reference images to video
Video to video
Audio to video
```

### Attachment roles

Potential roles include:

```txt
Start frame
End frame
Reference image
Source video
Reference video
Source audio
Reference audio
```

The selected model determines which roles are available and which combinations
are mutually exclusive. Examples:

- an end frame may require a start frame;
- a source video may disable start and end frames;
- general references may disable keyframes for a particular model;
- an audio-to-video model may require audio and optionally accept an image;
- a text-to-video-only model may show no media inputs.

Do not keep disabled controls for every theoretical role. Prefer showing the
valid roles for the current model, with a concise explanation when switching a
model would remove an existing input.

### Prompt guidance

Prompt placeholder and helper copy should reflect the effective operation:

```txt
Text to video  -> describe scene, subjects, motion, and camera
Image to video -> describe motion, camera, and change; do not repeat the image
Video to video -> describe the transformation to apply
Audio to video -> describe visuals and how they should respond to the audio
```

### Results

Primary actions:

```txt
Use as video reference
Use last frame as image
Generate variation
Download
Open Asset
Open in Flow
```

## Audio Mode

Audio should expose an intent selector below the main Audio tab.

### Speech

```txt
required: script or connected text equivalent
required: target voice when the model requires one
optional: model-supported voice settings
output: Audio Asset
```

The Tiptap composer may reference attached image/video/audio context only when
the selected speech model and TaleLabs operation support that input. Ordinary
text-to-speech should remain a script field rather than pretending media
references are universal.

### Music

```txt
required: musical prompt
optional: lyrics
optional: image/audio guidance when supported
optional: instrumental/vocal, duration, structure, loop, format
output: Audio Asset
```

Lyrics should be a separate structured field when the model distinguishes
lyrics from the musical prompt.

### Sound Effect

```txt
required: sound description
optional: duration, loop, prompt influence
output: Audio Asset
```

### Voice Changer

```txt
required: one source audio or video
required: target voice or provider-supported voice choice
optional: noise removal and model-specific controls
output: Audio Asset
```

This is not text-to-speech. The source performance supplies timing, emotion,
and delivery.

### Voice Isolation

```txt
required: one source audio or video
prompt: none
output: isolated speech Audio Asset
```

When an intent has no natural-language prompt, do not render an empty chat box.
Render the task-specific source input and command. Consistent page layout is
not a reason to add meaningless controls.

## Tiptap `@` Media References

### Product semantics

An attachment role and an inline mention solve different problems:

```txt
Attachment role
  tells TaleLabs and the provider how media enters the operation
  example: this image is the Start frame

Inline @ reference
  tells the prompt which attached media the user's words refer to
  example: place @Image 1 behind @Image 2
```

An attachment can be valid without appearing in the text. A start frame is
still a start frame even when the prompt never says `@Image 1`.

An inline reference is valid only while its exact media input remains attached
to the appropriate slot.

### Suggestion behavior

Typing `@` opens a Tiptap Suggestion menu grouped by:

```txt
Images
Videos
Audio
```

The menu should include only media already attached to the current request and
accepted by the effective operation. It should not search the entire Asset
library on every keystroke.

If no matching media is attached, show an empty state with an explicit `Add
media` command outside the editor selection contract. Choosing an Asset first
adds it through the attachment system; only then can it become a prompt token.

Each suggestion should show:

- a thumbnail or media icon;
- `Image 1`, `Video 1`, or `Audio 1`;
- the Asset name;
- its role when useful, such as `Start frame`;
- keyboard selection state.

The inserted value is an atomic inline chip. Backspace removes the whole chip.
Arrow keys navigate suggestions, Enter selects, and Escape closes the menu.

### Persistence

Reuse TaleLabs' existing `PromptTemplate`:

```ts
interface PromptTemplateInputPart {
  type: 'input'
  slotId: string
  index: number
  mediaType: 'audio' | 'image' | 'video'
}
```

Persist only the provider-neutral template. Filenames, thumbnails, labels, and
Tiptap document JSON remain presentation state.

The current Flow resolver already produces deterministic provider wording and
an exact token-to-input provenance mapping. Create should call that same
resolver through ordinary Flow planning.

### Attachment ordering and mutation

The current prompt contract identifies media by slot and selected-input index.
To avoid a token silently changing meaning:

- attachments are append-ordered within a role;
- v1 does not support manual attachment reordering;
- removing an attached item removes or explicitly invalidates tokens pointing
  to that item before indexes are compacted;
- indexes for later references are rewritten deterministically in the same
  draft update;
- a model switch never silently maps a token to another Asset;
- invalid tokens remain visible and block Generate until fixed.

If later product usage requires free reordering, introduce a reviewed stable
reference identity and a versioned PromptTemplate migration. Do not store
Asset IDs directly inside editor-specific Tiptap nodes as an ad hoc shortcut.

### Tiptap implementation guidance

Reuse the current TaleLabs prompt composer rather than building another rich
text editor. Tiptap's Suggestion utility already supports the `@` trigger,
keyboard lifecycle, asynchronous item loading with cancellation, managed popup
positioning, and teardown.

For this page:

- suggestions are local and derived from the current attachment draft;
- no network call is required for each typed character;
- mount only the active composer editor;
- use the existing inline atom extension and PromptTemplate adapter;
- render read-only historical prompts without mounting Tiptap editors;
- place upload, Asset selection, model, settings, and Generate controls outside
  the editor document;
- do not add Tiptap AI Toolkit for this feature.

### Accessibility

- Give the composer an intent-specific accessible label.
- Announce the suggestion count and active suggestion.
- Support complete keyboard insertion and removal.
- Preserve visible focus for chips, menus, and Generate.
- Expose invalid-token reason text, not color alone.
- Ensure the popup remains inside the current dialog/sheet stacking context.
- Preserve prompt text and attachments after validation failures.

## Result Stream

The stream is a product history projection over `flowRuns`, not a chat transcript.
Every visual group maps to one immutable admitted request and its outputs.

### Request entry

Each submitted request should display a compact immutable summary:

- media intent;
- model;
- prompt with resolved reference labels;
- attached inputs and roles;
- important settings;
- estimated cost when applicable;
- execution runtime;
- submitted time.

Do not render raw provider payloads or technical binding data in the product UI.

Recommended presentation:

```txt
Image generation · Nano Banana 2 · 2 outputs                  14:32
Create a clean product photograph of @Image 1 on a dark studio set
[Image 1 · Reference]   16:9 · 2K
```

- Use one quiet full-width band above its results, not a right-aligned user chat
  bubble.
- Clamp long prompts to three lines in collapsed history and provide an
  accessible expand/collapse command.
- Render structured `@` references as read-only inline chips with media labels.
- Show only settings that materially explain the output. Full diagnostics belong
  in a future Run Inspector, not the ordinary stream.
- `Reuse request` restores a copy into the current draft without mutating the
  historical run.

### Running entry

Use TaleLabs' existing realtime run state. Show truthful states:

```txt
Queued
Preparing inputs
Generating
Processing output
Completed
Failed
Canceled
```

Do not invent a percentage unless the provider supplies meaningful progress.
Long-running video should show elapsed time and a live activity signal. The
user may navigate elsewhere; the global run observer should keep recovery and
notifications working.

Reserve the final media footprint immediately after admission:

- image uses the selected aspect ratio;
- video uses a poster-shaped frame at the selected aspect ratio;
- audio uses a fixed-height player/waveform row;
- several expected outputs reserve the final grid shape.

Inside the reserved frame show:

```txt
Generating video
1m 42s elapsed
You can continue working while this finishes.
[Cancel]
```

Use the existing alive signal, subtle shimmer, or border activity, but never an
invented percentage. After roughly 20 seconds, add calm elapsed-time copy so the
surface still looks active rather than broken. Provider-supplied progress may be
shown only when it is meaningful and monotonic.

Queued, retrying, and processing states need distinct text. `Retrying` should
show the attempt only when doing so helps the user; never expose internal queue
names or Trigger task IDs.

### Result entry

Display media at an appropriate inspection size. Load poster thumbnails first.
Do not attach every video source in a long session until hover, focus, playback,
or detail opening requires it.

The result already exists as an Asset. Avoid a redundant `Save` command. Use
`Open Asset`, `Favorite`, or continuation actions instead.

Media-specific layouts:

| Result | Presentation |
| --- | --- |
| Image | Preserve intrinsic aspect ratio inside a stable preview; click opens the shared Asset viewer. |
| Video | Load poster first; attach playback source only on explicit play or detail open; use native controls in the inspection state. |
| Audio | Full-width compact player with name, duration, waveform/poster treatment when available, and no empty image frame. |
| Text, if later approved | Readable prose block with Copy and continuation actions; not part of the first media release. |

Action hierarchy:

```txt
Primary continuation  Use as reference / Make video / Reuse request
Asset actions          Open Asset / Favorite / Download
Advanced               Open in Flow
```

- Put the most likely continuation action in a visible button below or beside
  the media; secondary actions may use a compact action row or overflow menu.
- Hover may reveal secondary actions on pointer devices, but every action must
  also appear on focus and remain reachable on touch.
- Keep action geometry stable so hover does not resize the result.
- Use familiar icons for Favorite, Download, and overflow, with tooltips and
  localized accessible names.
- `Open in Flow` clones the current draft context and selected result into a new
  canvas Flow. It does not transfer hidden session history.

### Multiple outputs

Keep outputs from one request grouped together. Preserve output order and show
partial success honestly. A failed sibling must not hide successful canonical
Assets.

Responsive grouping:

```txt
1 output   one inspection-sized preview
2 outputs  two equal columns on desktop, one column on narrow mobile
3 outputs  one lead plus two supporting cells when aspect ratios agree;
           otherwise a regular two-column grid
4 outputs  regular two-by-two grid
5+         bounded grid with explicit expansion; do not mount all full media
```

Do not use a horizontal carousel as the only way to compare generated options.
Users should be able to see at least the first four sibling outputs together on
desktop. Selection/favorite state belongs to each Asset, while status and retry
belong to the request/run group.

### Failure and partial success presentation

- A request-level failure occupies the reserved output frame and includes one
  actionable explanation plus `Retry request` when retry is valid.
- A failed sibling keeps its cell with the reason while successful siblings
  remain usable.
- Provider balance, credential, unsupported-model, validation, moderation,
  timeout, canceled, transfer, and ingestion failures need distinct localized
  codes and next actions.
- Do not rely on a disappearing toast for a durable run failure. A toast may
  announce it, but the stream remains authoritative.
- Preserve the user's next draft. Retrying a historical request clones its
  immutable configuration into a new run rather than mutating the old result.

### History pagination and media lifecycle

- Load newest groups first and prepend older cursor pages on request.
- Use an explicit `Load earlier` boundary initially. Consider virtualization
  only after measured sessions routinely exceed 50 mounted groups.
- Historical rows use read-only prompt rendering and thumbnails/posters.
- Full media URLs are acquired only for visible inspection or playback.
- Stop and release video playback when it leaves the active inspection state.
- Signed-URL refresh and Asset detail remain owned by the existing Asset query
  system.

## Architecture and Reuse Contract

### Current repository seams

The plan was checked against the current code, not only against the intended
architecture.

| Concern | Current owner | Reuse decision |
| --- | --- | --- |
| Model capabilities, presentation and bindings | `packages/models-catalog` | Reuse directly. Never add Create model records. |
| Provider-neutral generation resolution | `packages/flows/src/generation/resolution/` | Reuse directly through a small UI adapter. |
| Prompt persistence | `PromptTemplate` in `@talelabs/flows` | Reuse unchanged. |
| Tiptap editing | `apps/dashboard/src/features/flows/nodes/shared/prompt-composer/` | Extract the neutral editor capability once; retain a thin Flow wrapper for canvas classes and behavior. |
| Generation configuration | `apps/dashboard/src/features/flows/generation/flow-generation-configuration.ts` and shared setting fields | Reuse provider-neutral transitions and setting primitives; keep canvas mutation in Flow-specific wrappers. |
| Upload lifecycle | dashboard-global upload provider and `features/assets/upload/` | Reuse directly. Do not create a Create upload queue. |
| Asset selection | `features/assets/library/asset-library-dialog.tsx` | Reuse directly with media constraints. |
| Draft persistence | `/flows`, `/flows/:id/graph`, Flow revision checks | Reuse directly with an explicit Flow surface discriminator. |
| Planning and snapshots | `@talelabs/flows` plus API run admission | Reuse without a Create planner. |
| Cost estimation | `/flows/:id/run-cost-estimates` and canonical estimator | Reuse through a thin query capability, not copied formulas. |
| Run admission | `/flows/:flowId/runs` | Reuse; extract only the non-canvas request command from `use-flow-run-admission.ts`. |
| Run history | cursor-paginated `/runs?flowId=...` and `/runs/:id` | Reuse as the session stream source. |
| Active-run updates | dashboard-global realtime subscriptions and run queries | Reuse. Do not mount a second realtime root. |
| Browser BYOK | dashboard-global `BrowserRunRoot` | Reuse. Create only admits and observes runs. |
| Managed execution | Trigger.dev runtime | Reuse unchanged. |
| Result persistence | canonical generated Asset ingestion | Reuse unchanged. |

### One owner for each state

| State | Owner |
| --- | --- |
| Session identity and current saved draft | PostgreSQL Flow rows and graph rows |
| Request history and terminal results | immutable `flowRuns` and run output Assets |
| Server session/run/Asset queries | TanStack Query |
| Current unsaved request | route-level reducer or local React state |
| Tiptap selection, caret and suggestion popup | Tiptap |
| Upload progress across navigation | existing global upload store |
| Active run recovery across navigation | existing global runtime observers |

Do not add a Create Zustand store initially. Lift the request draft to the
closest common Create screen owner and pass controlled values to mode,
attachment, composer, and settings sections. Zustand becomes justified only if
profiling demonstrates frequent distant consumers that cannot remain behind a
narrow route-level context or reducer.

### Maintainer-readable dependency path

One request must be traceable without hidden registration or duplicate
business rules:

```txt
Create route
-> Create draft controller
-> shared generation composer/configuration capability
-> existing Flow graph synchronization
-> existing run-cost and admission APIs
-> immutable Flow run
-> existing runtime and canonical Asset ingestion
```

A maintainer adding a model changes the Models Catalog, not Create. A
maintainer adding a provider changes provider bindings/adapters, not Create. A
maintainer changing run durability changes the existing run system, not Create.

### Dashboard organization

Start with the smallest purpose-bearing structure and add a folder only when it
owns several cohesive modules:

```txt
apps/dashboard/src/features/create/
  create-route.tsx
  create-screen.tsx
  create-draft.ts
  data/
    create-session.queries.ts
    create-session.mutations.ts
  composer/
    create-composer.tsx
    create-attachments.tsx
    create-settings.tsx
  history/
    create-session-list.tsx
    create-run-stream.tsx
    create-result-actions.tsx
```

Expected shared extraction after Create becomes the second consumer:

```txt
apps/dashboard/src/features/generation/
  prompt-composer/
    prompt-composer.tsx
    prompt-template-adapter.ts
    input-reference-extension.ts
    input-reference-menu.tsx
  configuration/
    generation-setting-field.tsx
    generation-settings-list.tsx
  runs/
    admit-generation-run.ts
```

The Flow feature keeps wrappers that add React Flow interaction classes,
canvas-store mutation, node preview projection, and autosave. Create must not
import `useGenerationNodeController`, canvas Zustand state, or canvas preview
projection merely to reuse business rules.

File names are a starting map, not a requirement to create every file. Do not
create one-file folders, forwarding wrappers, `utils.ts`, `helpers.ts`, or a
generic intent engine. Image, Video, and each Audio task may have a focused
view when their form composition materially differs; shared controls should
remain controlled primitives rather than one component with many boolean
flags.

### Draft graph projection

Create needs one explicit, provider-neutral projection from a direct request to
registered Flow nodes:

```txt
CreateDraft
  -> zero or more existing Asset input nodes
  -> one existing generation node
  -> ordinary typed edges
```

Keep this projection in the dashboard feature while it only serves one UI and
uses existing public Flow contracts. Promote it to `@talelabs/flows` only when a
second non-React caller needs the same projection. It is not a planner and must
not validate model behavior independently; canonical graph synchronization and
run admission remain authoritative.

The saved graph represents the current editable request, not every historical
request. Submitting again updates that small graph and creates a new immutable
run snapshot. This avoids unbounded graph growth while preserving full history.

The projection must be pure and deterministic for a given draft. The session
owns one stable generation-node ID. Every attachment instance owns a stable
input-node ID that is not derived from its array position; the same Asset may
legitimately occupy two different roles. Do not generate new node IDs during
React rendering or every save. Reload reconstructs the draft and stable IDs
from the saved graph.

### Draft synchronization and estimate ordering

The local draft may change faster than network requests. Use one explicit
serialized synchronization controller rather than several effects:

```txt
local draft change
-> derive draft fingerprint
-> debounce managed estimate work
-> ensure backing Flow exists
-> synchronize graph with expected revision
-> request estimate for that saved revision
```

Generate performs the same sequence without debounce and waits for the latest
draft synchronization before admission. A stale save or estimate response must
not replace state for a newer fingerprint. Revision conflicts use the existing
Flow conflict contract and present a recoverable error; do not silently overwrite
another tab's graph.

Browser BYOK skips cost estimation but still flushes the saved graph before run
admission because the immutable snapshot is created from server-owned Flow
state. The controller may reuse narrow graph-save and estimate transports, but
it must not import the canvas autosave hook or duplicate its entire state
machine.

### API boundary

Extend existing Flow contracts rather than creating parallel session CRUD:

```txt
GET  /flows?surface=create
POST /flows                  { surface: 'create', name }
GET  /flows/:id/graph
POST /flows/:id/graph
POST /flows/:id/run-cost-estimates
POST /flows/:id/runs
GET  /runs?flowId=:id
GET  /runs/:id
```

Flow list and create operations take an explicit surface, and the API returns
the surface on every Flow summary. The Flows library requests `surface=canvas`;
Create requests `surface=create`. Client-side filtering of an unscoped list is
not acceptable.

The shared graph synchronization, cost, and run endpoints should remain
surface-agnostic because both surfaces intentionally use the same runtime.
Route loaders verify that a requested Flow belongs to the screen being opened
and redirect or reject a mismatch. `surface` is a presentation boundary, not a
second authorization model or execution switch.

Add a sanitized request presentation to run reads only if the session stream
cannot render prompt/model/attachment summaries from existing fields. The API
presenter may derive this from the immutable snapshot, but it must not expose
the complete graph snapshot, provider bindings, credentials, signed URLs, or
private routing policy.

Do not add a combined create-save-run endpoint initially. If production
evidence shows that first-submission partial persistence is materially harmful,
an atomic façade may be added later, but it must call the same Flow sync,
planning, and admission owners.

### Database direction

The smallest reviewed schema change is a non-null Flow discriminator:

```txt
flows.surface = 'canvas' | 'create'
```

Migration requirements:

- backfill every existing Flow as `canvas`;
- enforce allowed values with a database check constraint;
- index tenant-scoped browse order, for example
  `(organizationId, surface, updatedAt, id)`;
- keep graph, revision, run, job, lineage, cost, and Asset tables unchanged;
- do not add session-message, request, result, or attachment tables.

If the field later supports more surfaces, it remains a presentation identity,
not a runtime switch. Runtime behavior continues to come from the saved graph
and immutable run snapshot.

### History read model

The session stream is derived as follows:

```txt
Flow summary
-> cursor-paginated run summaries filtered by flowId
-> active/recent run details
-> ordered output Assets
```

Do not hydrate every historical run in one request. Return a bounded sanitized
request summary with list rows, then load full run detail only for active,
visible, or expanded entries. This preserves one durable source of truth while
avoiding an N+1 history screen.

## Model-Adaptive Behavior

The Models Catalog is the only source for:

- selectable models by media intent;
- valid operations;
- accepted media slots;
- reference counts;
- mutually exclusive combinations;
- required inputs;
- settings and defaults;
- output counts and media types;
- provider bindings and browser eligibility.

The Create page should ask the same resolver used by generation nodes for the
effective state. It must not infer capability from model name, provider name,
or media tab.

### Model switching

When a user switches models:

1. preserve prompt text;
2. preserve settings that remain valid;
3. preserve compatible attachments and roles;
4. clearly mark incompatible attachments before removal;
5. require explicit confirmation only when switching would discard meaningful
   draft data;
6. never remap a role or prompt reference silently.

### Default model

Choose a reviewed recommended default per intent from the catalog. Do not hide
the model selector, but keep it secondary to the creative request.

Model auto-selection by an LLM belongs to a later Agent experience. A simple
deterministic default does not require an agent.

## Cost and Execution Runtime

### Managed execution

- Show the current advisory estimate near Generate.
- Keep Generate disabled when current policy requires an estimate and the
  estimate is unavailable.
- Admission remains authoritative.
- Do not duplicate rate or estimate formulas in Create.

### Browser BYOK

- Use the existing browser runtime and browser-only provider credentials.
- Do not send the key to TaleLabs' API, Trigger.dev, graph data, run snapshots,
  logs, or analytics.
- Show which connected provider will execute the selected binding.
- Keep estimation behavior consistent with the existing BYOK product decision.
- Read credentials only through the existing browser Secure Store. Do not copy
  provider keys into Create state, TanStack Query, Flow data, session data, or
  a Create-specific storage layer.
- Use the same browser-eligible catalog bindings, provider availability,
  credential resolution, binding priority, request translation, cancellation,
  recovery, and output-finalization path as canvas execution.
- Admit the request as an ordinary durable Flow run with browser execution. The
  provider request occurs in the browser runtime; the server remains the source
  of truth for admission, snapshots, jobs, lineage, and canonical output
  registration without receiving the credential.
- Keep browser execution alive through the dashboard-global `BrowserRunRoot`
  when the user navigates between Create, Flows, and Assets, subject to the
  documented browser-lifecycle limitations.
- When no compatible connected provider can execute the selected model and
  operation, disable Generate with a localized explanation and a direct command
  to connect a supported provider in Secure Store.

### Runtime selection

The settings preference chooses browser or managed execution. Create should not
invent a third runtime. When the selected model has no compatible binding for
the active runtime, explain the missing provider/key or offer compatible models.

Runtime preference is one product setting shared with the canvas, not a
per-session execution implementation. Switching it changes how the next request
is admitted; it does not rewrite historical runs or outputs.

### Canvas runtime parity acceptance

For the same saved one-step graph, model, operation, prompt, attachments, and
settings, Create and canvas must resolve the same:

```txt
effective model capability
provider binding and priority
browser eligibility
readiness and validation errors
normalized provider request
immutable snapshot contract
cancel/retry/recovery behavior
provider cost facts where applicable
canonical output Asset and provenance
```

Create may present those facts differently, but it must not calculate or own
different facts. Debug verification should admit equivalent requests from both
surfaces and compare their persisted binding, request payload, selected inputs,
and outputs. Any difference needs an explicit product reason rather than a
Create-specific fallback.

## Failure and Recovery

The page must preserve the draft and show actionable failures for:

- missing required prompt;
- invalid or removed `@` reference;
- incompatible attachment role;
- too many references;
- unsupported file type, size, duration, or dimensions;
- missing browser provider credential;
- no compatible provider binding;
- unavailable managed estimate;
- provider rejection or insufficient balance;
- queue timeout or transient provider failure;
- cancellation;
- partial output success;
- output download or canonical Asset ingestion failure.

Runs remain durable. Reloading the page must restore terminal results and
active run state from the API, not only from component memory.

## Performance and Scalability

### Session history

- Cursor-paginate sessions and request/result groups.
- Scope every TanStack Query key by organization and then by `surface` or
  `flowId`; changing workspaces must never reuse another tenant's history.
- Load recent results first.
- Query runs by the backing `flowId`; do not duplicate them into a session
  message store.
- Include a bounded sanitized request summary in run list rows so the browser
  does not download snapshots or issue one detail request per history item.
- Hydrate full detail only for active, visible, or explicitly expanded runs.
- Virtualize only after measured history size justifies it.
- Keep historical prompts as lightweight read-only rendering.
- Do not mount one Tiptap editor per request.

### Media

- Use thumbnails and posters in the stream.
- Load full image/video/audio only when inspected or played.
- Remove idle video sources when previews stop.
- Reuse signed-URL and Asset-detail query behavior.

### Composer

- Keep `@` suggestions local to attached draft media.
- Do not query global search per keystroke.
- Use explicit Asset selection for global lookup.
- Derive valid settings from the locally available public Models Catalog
  projection.
- Keep the active draft in one route-level owner. Do not subscribe the entire
  result stream or session list to every keystroke.
- Preserve the existing narrow `PromptTemplate`; never serialize Tiptap JSON or
  HTML into Flow node data.

### Server

- Reuse current admission limits and provider concurrency.
- Avoid a Create-specific in-memory queue.
- Use the existing run and Trigger/browser execution systems.
- Keep PostgreSQL as the product source of truth.
- Use server-side `surface` filtering and tenant-scoped indexes for session and
  canvas browse queries.
- Keep run history cursor-based and bounded. Do not return full immutable
  snapshots to render ordinary history rows.

### Attachment uploads before first submission

Device uploads should enter the existing private Asset library through the
global upload manager before they are referenced by the draft graph. Do not
hold raw `File` objects inside a persisted Create session or invent a temporary
session upload store.

This means the first version may place uploaded references in the ordinary
private Asset hierarchy rather than a session-specific folder. Coupling uploads
to a session folder would require creating the backing Flow earlier and does
not justify a second upload lifecycle.

## Privacy, Safety, and Consent

- Never place provider credentials in session data, Flows, prompts, snapshots,
  or analytics.
- Never place signed URLs in PromptTemplate parts.
- Do not log prompt or media contents by default.
- Preserve tenant isolation for session, Flow, Asset, and run reads.
- Voice changing requires users to have permission to use the source and target
  voice; add explicit consent language before supporting cloned voices.
- Voice isolation accepts audio/video source media but must not imply ownership
  rights over uploaded material.
- Reuse TaleLabs' current public/private generated-output policy rather than
  inventing a Create-specific visibility rule.
- Session sharing is out of the first release unless its authorization and
  Asset visibility contract are explicitly designed.

## Analytics Without Content Collection

Useful events:

- Create route opened;
- media mode selected;
- audio intent selected;
- first attachment added;
- `@` reference inserted;
- Generate attempted, admitted, succeeded, failed, or canceled;
- time to first admitted run;
- time to first successful Asset;
- second generation in the same session;
- result reused as an input;
- image continued into video;
- result opened as an Asset;
- session opened in a Flow;
- validation abandonment by stable error code.

Do not include prompt text, filenames, media URLs, media bytes, provider keys,
or user-authored content in analytics payloads.

## Delivery Plan

### R0: Product approval and architecture proof

Before implementation:

- collect competitor screenshots for the states listed below;
- approve desktop and narrow layouts;
- approve naming for Create, Sessions, and Audio intents;
- approve result actions;
- decide whether Create is first navigation or follows Flows;
- confirm that the first managed estimate or Generate attempt may persist a
  recoverable Draft session;
- approve `flows.surface = 'canvas' | 'create'` and server-side browse filtering;
- prototype one request projection using registered Asset and generation nodes;
- prove that the ordinary Flow sync and run APIs can execute it and restore its
  result from run history after reload;
- inventory each planned shared extraction and identify both real consumers.

The architecture proof may use local development data, but it must not add a
second runtime or speculative framework. Stop if the proof requires duplicating
planning, provider, upload, or result ownership.

### R1: Session identity and shared generation seams

- add the forward-only Flow surface migration, constraint, and tenant-scoped
  browse index;
- extend existing Flow list/create contracts with the surface discriminator;
- keep the Flows library and Create history server-filtered and separate;
- add cursor-paginated session and run-history queries;
- add a sanitized run request summary only if required by the stream;
- extract the neutral PromptComposer capability from its Flow wrapper;
- extract controlled generation setting primitives only where Create becomes a
  second consumer;
- add a small shared run-admission command while retaining Flow autosave and
  canvas projection in Flow-specific hooks.

Acceptance:

- there is one Flow identity model and one run history;
- existing canvas Flows remain unchanged and absent from Create history;
- Create sessions never appear in the Flows library;
- no new provider, planner, upload, runtime observer, or result architecture
  exists;
- a maintainer can trace one Create submission through the dependency path in
  this document without hidden registration.

### R2: Image vertical slice

Deliver one complete vertical slice:

- route and navigation;
- Image mode;
- uploads and Asset selection;
- Tiptap prompt composer with `@Image` references;
- model-adaptive Image settings;
- managed and browser execution;
- realtime status;
- canonical Asset results;
- result reuse as an Image reference.

Acceptance:

- text-to-image and supported image-guided requests use existing runs;
- refresh restores requests and outputs;
- attached media and `@` references resolve to exact immutable inputs;
- removing or reordering attachments updates tokens atomically and never causes
  a token to reference a different Asset silently;
- no second model, planner, provider, or output architecture exists.

### R3: Video modes

- add valid video attachment roles;
- support prompt-only, start frame, start/end, references, source video, and
  audio guidance only where the catalog allows them;
- preserve model-switch constraints;
- add image-to-video continuation;
- validate long-running progress, navigation, cancellation, and reload.

### R4: Audio intents

- Speech;
- Music;
- Sound Effect;
- Voice Changer;
- Voice Isolation;
- task-specific settings and source-media behavior;
- audio playback and continuation UX.

Do not block Audio delivery on unsupported providers or models. Show only
catalog operations with an executable binding for the selected runtime.

### R5: Iteration, Flow handoff, and polish

- result variations;
- compare outputs from one request;
- refined session naming/history;
- `Open in Flow` implemented as a server-owned clone into a new
  `surface=canvas` Flow so Create history remains stable;
- keyboard and accessibility pass;
- responsive layout;
- long-history performance;
- focused error recovery;
- final user-owned browser QA.

Acceptance:

- the clone preserves current prompt, model, operation, settings, exact Asset
  inputs, and graph structure;
- the original Create session and its historical runs remain unchanged;
- no client-side graph reconstruction is used for the clone;
- desktop and narrow layouts pass user-owned product QA.

### Deferred follow-ups

- autonomous Agent mode;
- Apps or guided presets;
- Elements in the direct composer;
- session collaboration/sharing;
- web search and research inputs;
- multi-step requests;
- prompt enhancement;
- storyboard or editor handoff;
- public community sessions.

## Implementation Review Gate

The feature is not accepted merely because Image, Video, and Audio can produce
media. A review must confirm the following architecture properties.

### Single-source checks

- adding a model or changing a capability requires no Create-specific registry
  edit;
- adding a provider requires no Create UI or request-projection edit;
- run admission, retries, cancellation, realtime recovery, accounting, and
  Asset ingestion still have their existing owners;
- the current request exists once as a saved Flow draft and each historical
  request exists once as an immutable run snapshot;
- prompt content exists as `PromptTemplate`, never as duplicate plain text plus
  Tiptap JSON representations;
- server data is not copied into Zustand or a second client cache.

### Readability checks

- a developer can follow the dependency path from `create-route.tsx` to the
  ordinary run API without discovering hidden registration or side effects;
- each file has one cohesive product or infrastructure responsibility and
  remains below the repository's authored-source line guardrail;
- shared extraction has at least two real consumers and reduces reasoning cost;
- no `utils.ts`, `helpers.ts`, generic schema-driven form engine, giant mode
  switch, or many-boolean component hides ownership;
- React Flow behavior remains in Flow wrappers and direct-page behavior remains
  in Create composition;
- exported contracts and module ownership have useful TSDoc; function-body
  comments are reserved for non-obvious invariants;
- all user-facing copy uses shared i18n keys across every supported locale.

### Scale and lifecycle checks

- session and run lists use tenant-scoped cursor pagination;
- history does not cause one full run-detail request per row;
- stream rows use thumbnails/posters and lazy full-media loading;
- only one active Tiptap editor is mounted for the current request;
- navigation does not interrupt global uploads, browser execution recovery, or
  managed-run realtime observation;
- first-submission partial failures leave an understandable recoverable state;
- a generated output is visible in the stream only through its canonical Asset
  and remains available after reload.

### Extension-cost probes

Before approval, answer these with concrete file paths:

1. Which file changes to expose one newly cataloged Image model? Expected:
   none in Create.
2. Which file changes to add one provider binding for an existing model?
   Expected: none in Create.
3. Which file owns a new Audio task whose input composition is genuinely new?
   Expected: one focused Audio intent composition plus existing catalog/runtime
   contracts, not edits across every mode.
4. Which owner changes if run cancellation semantics change? Expected: the
   existing run/runtime subsystem, not Create.
5. Which owner changes if `@` token persistence changes? Expected: the shared
   prompt contract and adapter with a versioned migration, not per-surface
   editors.

Required engineering verification follows repository policy: generated SDK
contracts where API schemas change, all workspace type checks, i18n validation,
lint, TSDoc coverage, focused planner/snapshot/provider smoke checks, production
build, and `git diff --check`. Browser visual and end-to-end product approval
remain user-owned.

## UX Acceptance Matrix

The executing session must treat this matrix as the minimum visual and
interaction evidence set. A single desktop screenshot, a working provider
request, or a generic responsive claim is not enough to approve the feature.

### Required product states

Capture and inspect every state below with real TaleLabs components and
localized product copy:

| Area | Required states | What must remain visually stable |
| --- | --- | --- |
| New session | Image, Video, Audio plus every shipped Audio intent | Session header, mode controls, composer footprint, Generate placement, and settings access. |
| Composer | Empty, focused, multiline, one attachment, several attachments, `@` menu open, invalid attachment, estimated, and estimate unavailable | Prompt width, attachment strip height, keyboard focus, readiness message, and Generate action must not jump or overlap. |
| Settings | Default model, model search, basic settings, Advanced expanded, unsupported control, browser runtime, managed runtime | Inspector width, field alignment, close command, error placement, and composer visibility. |
| Admission | Valid, invalid, insufficient provider balance, missing browser credential, and rate/capacity limited | The blocking reason must appear beside the command and remain available after a toast disappears. |
| Running | Queued, preparing, generating under 20 seconds, long-running generation, retrying, processing output, and canceling | Reserved output geometry, truthful status, elapsed time, and Cancel placement. No fake percentage or indefinite spinner-only state. |
| Results | One image, two images, four images, one video, one audio result, partial success, failure, and canceled | Media aspect ratio, sibling grouping, action geometry, request summary, and stream anchor. |
| History | First request, several requests, older-page loading, reload restoration, and a new result while the user is reading older history | Scroll anchor, `New result` affordance, read-only prompts, lazy media loading, and stable session identity. |
| Session rail | Empty, active Draft, generating, completed with thumbnail, long translated name, search results, load more, and delete confirmation | Row height, truncation, active indication, focus, and rail width. |

### Viewport evidence

Use these as evidence viewports, not device-specific CSS breakpoints. Layout
must be driven by available space and the constraints in the spatial
specification.

| Evidence viewport | Expected composition |
| --- | --- |
| `1440 × 900` or wider | Sessions rail, fluid center workspace, and Settings inspector are simultaneously visible. The center remains at least 520 pixels wide. |
| `1180 × 800` | The center workspace keeps priority. At least one support band collapses into a drawer or sheet instead of squeezing the composer. |
| `768 × 1024` | One primary content column, Sessions drawer, Settings sheet, readable result media, and no page-level horizontal scroll. |
| `390 × 844` | Docked composer respects the safe area, sheets fit the viewport, attachment strips remain usable, and the latest result is never covered. |
| `320` CSS-pixel equivalent or 400% reflow | All text, errors, controls, and actions remain available without two-axis page scrolling. Media may preserve its necessary aspect ratio. |

Also verify 200% text zoom, reduced motion, light and dark themes if both are
still supported by the dashboard, and the longest representative translations.
Do not scale typography with viewport width to force content to fit.

### Interaction acceptance

The executing session must demonstrate the following behaviors:

1. A new user can focus the prompt and reach Generate without dismissing an
   onboarding modal or choosing from a grid of marketing cards.
2. Mode, intent, and model changes immediately update valid attachment roles,
   settings, readiness, and cost behavior through the existing catalog and
   resolver contracts.
3. An incompatible model change never deletes an Asset. The affected input is
   excluded from execution, the reason is visible, and the user can undo when
   the product contract allows it.
4. Dragged uploads and Assets chosen from the library enter the same ordered
   attachment model. Reordering preserves stable Asset identity and updates
   visible labels and structured prompt tokens atomically.
5. The `@` popup supports pointer and keyboard selection, scrolls the active
   option into view, closes with Escape, restores focus correctly, and never
   inserts a reference that is not attached to the current request.
6. Generate remains a clear command when Settings is closed. A disabled command
   has a nearby, readable reason and does not rely on a tooltip alone.
7. Submitting creates one immutable request group, clears or preserves the next
   draft according to the approved iteration contract, and does not turn prior
   results into hidden context.
8. The user may navigate to Assets or Flows during generation. Returning to the
   session restores authoritative status and completed outputs through the
   existing global run systems.
9. Selecting a result continuation action explicitly composes the next request;
   it never mutates the historical run or silently selects additional media.
10. Browser back/forward, session switching, reload, and older-history loading
    preserve drafts, URLs, scroll position where appropriate, and canonical
    output visibility.
11. A general question submitted from a media mode never creates an assistant
    reply, chat bubble, or hidden tool call. The visible media command remains
    authoritative, and contextual help stays outside the result stream.

### Accessibility evidence

Provide keyboard-only evidence for:

- entering and leaving the Sessions rail;
- opening and closing Sessions and Settings drawers/sheets;
- choosing a mode and Audio intent;
- selecting a model and changing settings;
- attaching, reordering, and removing media;
- operating the `@` suggestion list;
- submitting and canceling a request;
- reaching every result action and opening the shared Asset viewer.

Inspect the accessibility tree for persistent field labels, semantic regions,
localized icon-button names, correct dialog/sheet naming, and one bounded polite
announcement for admission and terminal results. Do not repeatedly announce
elapsed-time updates or decorative loading motion.

### Implementation evidence package

Before the user-owned final QA, the implementation session must provide:

- screenshots for the required states at the evidence viewports;
- one short recording of keyboard-only `@` mention selection;
- one long-running generation state that remains visibly alive without fake
  progress;
- one reload showing restored request history and canonical outputs;
- one navigation-away-and-return case during an active run;
- one partial or failed run with an actionable persistent error;
- browser network evidence showing reuse of the existing run, upload, Asset,
  model-catalog, estimate, and realtime contracts rather than parallel APIs;
- the concrete shared components reused from Assets, Flows, generation nodes,
  settings, and the prompt composer.

This package is engineering evidence. Final visual hierarchy, responsive feel,
copy quality, and product approval remain explicitly user-owned.

## Competitor Screenshot Checklist

Capture the following before visual implementation:

### Runway

- Custom empty state;
- media attachments with `Image 1`, `Video 1`, and `Audio 1`;
- open `@` reference menu;
- model-specific input change;
- running state;
- completed result and `Use` menu;
- Sessions list.

### Luma

- Board empty composer;
- generated image group;
- selected image actions;
- Make Video continuation;
- result hierarchy after image-to-video.

### Krea

- Image and Video mode navigation;
- model selector;
- reference attachment strip;
- result actions;
- Nodes entry point from direct generation.

### Leonardo

- quick home prompt;
- advanced Image Guidance;
- start/end-frame model labels;
- disabled incompatible guidance;
- Generate Video from an existing image.

### Firefly

- first/last frame configuration;
- reference video or motion reference;
- model switch with changing controls.

### Freepik or Magnific

- start-image and start/end-image modes;
- reuse generated image as video;
- visual prompt affordance.

### ElevenLabs

- Speech form;
- Music form;
- Sound Effects form;
- Voice Changer source and target controls;
- Voice Isolation source-only flow.

For each product, capture empty, configured, generating, completed, and error
states where possible. Screenshots are visual references, not contracts to
copy.

## Evaluation Criteria

The feature is successful if it improves the simple creation loop without
splitting the architecture.

Measure:

- median time from opening Create to first admitted run;
- completion rate for first generation;
- percentage of users who generate a second Asset;
- percentage of outputs reused in another request;
- percentage of generated images continued into video;
- use of `@` references among requests with multiple attachments;
- validation failure and abandonment by mode;
- direct-session to Flow conversion;
- provider cost per successful reusable Asset;
- support questions about models, reference roles, and missing outputs.

Initial qualitative acceptance:

- a new user can generate without learning the canvas;
- a Flow user recognizes the same model, setting, input, and result semantics;
- a user can always tell which media a prompt references;
- invalid model/input combinations are prevented before paid execution;
- outputs survive refresh and are immediately available in Assets;
- opening the work in a Flow does not lose prompt, inputs, settings, or
  provenance.

## Open Product Questions

1. Should the navigation label be `Create`, `Generate`, or another command?
2. Should Create become the default route for new users while existing users
   retain Flows as their entry point?
3. Should empty Draft sessions created for managed cost estimation be hidden
   automatically or shown explicitly in recent sessions?
4. Should advanced settings remain in a right inspector or expand beneath the
   composer?
5. Which result actions belong in the first vertical slice?
6. What default name and thumbnail should a Create session receive before its
   first successful output?
7. How should session deletion interact with generated-output folders while
   preserving Assets?
8. Should a direct request support several simultaneous in-flight generations
   in one session?
9. When should Elements become available as direct references?
10. Should the first release expose model comparison, or only one model per
    request?

## Sources

### Competitor product documentation

- [Runway: Getting Started with Generative Video](https://help.runwayml.com/hc/en-us/articles/37425232841875-Getting-Started-with-Generative-Video)
- [Runway: Using reference media to guide generations](https://help.runwayml.com/hc/en-us/articles/52963720640275-Using-reference-media-to-guide-your-generations)
- [Runway: Generating with Sessions](https://help.runwayml.com/hc/en-us/articles/33545310653203-Generating-with-Sessions)
- [Runway: Navigating Runway](https://help.runwayml.com/hc/en-us/articles/24298206897043-Navigating-Runway)
- [Runway: Creating with Runway Agent](https://help.runwayml.com/hc/en-us/articles/51601639579667-Creating-with-Runway-Agent)
- [Luma Dream Machine: Web quick start](https://lumalabs.ai/learning-hub/web-quick-start)
- [Luma Dream Machine: Boards and Ideas](https://lumalabs.ai/learning-hub/navigating-boards-ideas)
- [Luma: Image capabilities and workflows](https://lumalabs.ai/learning-hub/luma-image-capabilities-ai-image-editing-animation-workflows)
- [Luma: The Luma Agent](https://lumalabs.ai/learning-center/articles/about-the-luma-agent)
- [Luma: Research with Luma](https://lumalabs.ai/learning-center/articles/research-with-luma)
- [Krea: AI Image Generator](https://www.krea.ai/features/ai-image-generator)
- [Higgsfield: AI Video Generator](https://higgsfield.ai/ai-video)
- [Higgsfield: AI Canvas](https://higgsfield.ai/canvas-intro)
- [Leonardo: Image Guidance](https://intercom.help/leonardo-ai/en/articles/8497988-image-guidance)
- [Leonardo: Generating Video](https://intercom.help/leonardo-ai/en/articles/11027827-generating-video-on-leonardo-ai)
- [Leonardo: Start and End Frames](https://intercom.help/leonardo-ai/en/articles/12504736-creating-videos-with-start-frames-and-end-frames)
- [Adobe Firefly: Generate videos using Firefly models](https://helpx.adobe.com/firefly/web/firefly-video-editor/generate-videos/generate-video-using-firefly-models.html)
- [Adobe Firefly: Match camera motion to a reference video](https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/match-camera-motion-to-reference-video.html)
- [Adobe Firefly: Product overview](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/adobe-firefly-overview.html)
- [Adobe Firefly: AI Assistant FAQ](https://helpx.adobe.com/ca/firefly/web/firefly-ai-assistant/ai-assistant-faq.html)
- [Magnific/Freepik: Video Generator](https://www.magnific.com/ai/docs/video-generator)
- [ElevenLabs: Studio](https://elevenlabs.io/docs/eleven-creative/products/studio)
- [ElevenLabs: Text to Speech](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- [ElevenLabs: Music](https://elevenlabs.io/docs/overview/capabilities/music)
- [ElevenLabs: Sound Effects](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- [ElevenLabs: Voice Changer](https://elevenlabs.io/docs/overview/capabilities/voice-changer)
- [ElevenLabs: Voice Isolator](https://elevenlabs.io/docs/overview/capabilities/voice-isolator)

### Editor documentation

- [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
- [TanStack Query: Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [TanStack Query: Infinite Queries](https://tanstack.com/query/latest/docs/framework/react/guides/infinite-queries)
- [React Flow: Performance](https://reactflow.dev/learn/advanced-use/performance)
- [Tiptap: Suggestion utility](https://tiptap.dev/docs/editor/api/utilities/suggestion)
- [Tiptap: Mention node](https://tiptap.dev/docs/editor/extensions/nodes/mention)
- [Tiptap: Custom nodes](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)
- [Tiptap: React NodeViews](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react)

### UX and accessibility references

- [WAI-ARIA Authoring Practices: Editable Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [WCAG 2.2: Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [WCAG 2.2: Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)

### Qualitative community evidence

- [Runway community: confusion about references and video](https://www.reddit.com/r/runwayml/comments/1kgnm5i/trying_to_understand_how_to_use_the_new_references/)
- [Runway community: model and feature-selection confusion](https://www.reddit.com/r/runwayml/comments/1opwmr5/a_couple_of_questions_about_the_new_tools_and_the/)
- [Runway community: desire for simpler prompting](https://www.reddit.com/r/runwayml/comments/1kh0n7m/how_to_actually_generate_cool_videos_with_runwayml/)
- [Runway community: distinction between reference image and first frame](https://www.reddit.com/r/runwayml/comments/1ta0x89/is_seedance_the_only_model_that_supports_true/)

Community links are used only as qualitative signals. Product and technical
contracts must continue to come from TaleLabs' reviewed source-of-truth
documents and official provider documentation.
