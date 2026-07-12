# TaleLabs Feature Research: AI-Assisted VFX and Generative Video Editing

Status: product and technical research for future Flow capabilities. This file
does not add these capabilities to the current MVP.

Last researched: July 12, 2026.

## 1. Product conclusion

AI-assisted VFX fits TaleLabs, but it is not one feature or one generic node.
Research supports three distinct future operations:

```txt
Video Transform
Existing video + direction/references -> restyled or reimagined video

Video Edit
Existing video + edit instruction/references -> locally changed video

Performance Transfer
Driving performance + Character reference -> animated Character video
```

They can share Flow primitives, provider adapters, run admission, Trigger.dev,
Asset ingestion, and provenance. Their public node contracts must remain
different because they solve different jobs and accept different inputs.

The recommended TaleLabs position is an AI shot-production workspace, not a
replacement for Premiere, Resolve, After Effects, or Nuke. TaleLabs should make
transformations reproducible, comparable, and reusable, then let professional
users continue in conventional post-production when they need deterministic
layer control or frame-perfect finishing.

## 2. What users are trying to accomplish

Official product workflows and community discussions point to these recurring
jobs:

1. **Campaign variation without a reshoot.** Swap a product colorway, season,
   location, wardrobe, lighting treatment, or background.
2. **Fix missed production details.** Remove a distraction, replace a prop,
   correct a continuity problem, or add an effect after filming.
3. **Restyle existing footage.** Convert live action to animation, CG, fantasy,
   period footage, or another visual treatment while retaining the performance.
4. **Low-cost character and creature work.** Use an actor's performance as the
   motion source for a different person, creature, product mascot, or stylized
   Character.
5. **Social adaptation.** Reframe, extend, or regenerate surrounding content for
   new aspect ratios and placements.
6. **Previsualization and client exploration.** Produce several visual variants
   from one source performance before committing to conventional VFX or a shoot.

Runway explicitly positions Edit Studio for campaign variants, footage fixes,
seasonal versions, product swaps, background changes, and lighting changes.
Luma positions Modify Video around motion preservation, puppeteering, world
replacement, and isolated effects.

### 2.1 Community demand and failure signals

Community reports are qualitative rather than controlled benchmarks, but they
show what makes an output usable:

- users reject edits that satisfy the prompt but degrade the face, source
  quality, motion, camera path, or background;
- long videos are commonly split into short clips and recombined, creating
  temporal and seam-management work;
- users fall back to masks, clean background plates, fades, and conventional
  compositing when generative preservation is unreliable;
- simple replacement instructions sometimes outperform elaborate prompts;
- users want a preview before spending credits on a full video;
- fast action, multiple moving subjects, chaotic backgrounds, occlusion, and
  major camera-angle changes remain weak cases.

Examples include a Runway community workflow that recommends splitting a long
clip, retaining a clean background plate, masking the desired foreground, and
recompositing the result, plus reports that video-to-video can reproduce defects
or lower the source quality:

- [Long object-removal workflow](https://www.reddit.com/r/runwayml/comments/1quwhes/reliable_video_object_removal_inpainting_model/)
- [Video-to-video preservation concerns](https://www.reddit.com/r/runwayml/comments/1t75ma1/is_it_possible_to_do_video2video_with_runway/)
- [Mixed Aleph results and iteration](https://www.reddit.com/r/runwayml/comments/1ml1xem/deep_dive_into_aleph/)

These findings lead to an important TaleLabs rule: **preservation intent is a
first-class setting and evaluation dimension, not merely prose appended to a
prompt.**

## 3. Domain boundaries

### 3.1 Video-to-video transformation

Video transformation uses the source video's motion, timing, composition, and
possibly audio as structural guidance while regenerating some or all pixels.

```txt
Source Video + prompt + optional references -> transformed VideoSet
```

Examples include style transfer, environment replacement, relighting,
retexturing, wardrobe changes, and mapping a performer to a non-human form.

Preservation exists on a spectrum. Luma exposes Adhere, Flex, and Reimagine
modes; its newer product UI separates motion and structure adherence. A stronger
transformation usually allows more drift.

### 3.2 Generative video editing or AI compositing

Generative editing changes a requested region, object, or visual property while
attempting to preserve everything else.

```txt
Source Video + edit instruction + optional reference/keyframe/mask
  -> edited VideoSet
```

Examples include adding a creature, replacing a product, removing a person, or
adding smoke and fire.

Calling this "AI compositing" can be misleading. Most current models resynthesize
pixels; they do not necessarily return an independent foreground layer with an
alpha channel. The change may not be isolated, reversible, or deterministic.
Traditional compositing remains more reliable for legal text, exact logos,
pixel-perfect products, repeatable mattes, and independent layer delivery.

### 3.3 Motion-guided generation and performance transfer

Performance transfer uses filmed movement as control and a separate image or
video as Character identity.

```txt
Driving Video + Character reference -> performed Character VideoSet
```

It may transfer body movement, gesture, facial expression, eye line, speech, and
camera/environment behavior. This is different from lip sync, which primarily
changes mouth motion in an existing shot. See [Lip sync](./lip-sync.md).

### 3.4 Non-goals

These capabilities are not:

- a complete non-linear editor;
- deterministic Nuke-style compositing;
- ordinary text-to-video or image-to-video generation;
- automatic approval of all edits for commercial delivery;
- proof that conventional VFX cleanup is unnecessary.

## 4. Competitor workflow research

| Product                        | Current workflow                                                                                                                      | TaleLabs lesson                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runway Aleph 2.0 / Edit Studio | Upload footage, describe an edit, preview the change as an image, refine it, then generate across up to 30 seconds and multiple shots | Preview-before-video directly reduces wasted credits; source preservation is the main product promise                                                     |
| Luma Dream Machine Modify      | Select an existing Board video, add prompt, Character reference and optional keyframes, then control transformation/adherence         | Assets remain the center of the workflow; motion and structure deserve independent controls when the model supports them                                  |
| Gemini Omni Flash              | Upload an existing clip or generate one, then make conversational edits using prior interaction state                                 | Iterative editing is useful, but TaleLabs must still snapshot every turn and retain each output as an Asset instead of depending on opaque provider state |
| Adobe Firefly / Premiere       | Extend clips inside a timeline and use generated content as part of an established editor                                             | TaleLabs should integrate with professional post workflows rather than build a full editor first                                                          |
| Runway Act-Two                 | Provide driving performance and Character image/video, optionally preserve source environment and camera behavior                     | Performance transfer needs named inputs, not a generic References slot                                                                                    |
| Luma Ray3.2 product controls   | Independently lock motion, structure, face, body, and pose behavior                                                                   | Preservation controls can be translated into a stable TaleLabs vocabulary while adapters map them to provider-specific settings                           |

The strongest reusable competitor pattern is:

```txt
Choose existing footage
  -> define one primary change
  -> preview/anchor the intended appearance
  -> choose what must be preserved
  -> generate variants
  -> compare and continue from an accepted Asset
```

## 5. Model and provider landscape

Capabilities and availability change quickly. TaleLabs' reviewed code registry,
not this table, must be the runtime source of truth.

### 5.1 Hosted APIs

| Model/API                       | Best fit                                                                 | Current documented limits or notes                                                                                                                  | Integration status                      |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Runway Aleph 2.0                | Local edits, object changes, restyling, keyframe-guided editing          | Input video 2-30s, up to 1080p, 30 FPS or lower, up to five timestamped keyframe images; 28 Runway credits/sec ($0.28/sec before TaleLabs overhead) | Direct production API                   |
| Luma Ray 2 / Ray Flash 2 Modify | Motion-preserving transformation and element-level changes               | Ray 2 up to 10s; Ray Flash 2 up to 15s; 100 MB; first frame optional; Adhere/Flex/Reimagine modes                                                   | Direct production API                   |
| Gemini Omni Flash Preview       | Conversational video editing and multimodal edit instructions            | Uploaded video up to 10s; output 3-10s at 720p/24 FPS; regional and recognizable-person restrictions; preview model                                 | Direct preview API                      |
| Runway Act-Two                  | Driving-performance transfer to a Character image/video                  | Driving performance plus Character reference; API price 5 credits/sec ($0.05/sec)                                                                   | Direct production API                   |
| Seedance 2.0                    | General video/reference generation, choreography and multimodal guidance | Video/audio/image references vary by endpoint; not equivalent to a guaranteed localized edit or explicit performance-transfer contract              | OpenRouter and direct/aggregated routes |

Runway's newer Aleph product claims precise localized preservation. TaleLabs
must still evaluate it independently against representative footage before
making the same promise.

Luma's Ray3.2 application exposes richer motion, structure, face, body, and pose
controls than the currently documented public Modify API. Do not expose app-only
controls in TaleLabs until API support is verified.

### 5.2 Open-source and self-hosting candidates

| Model              | Capability                                                                               | Operational note                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wan2.2-Animate-14B | Character animation and replacement from driving video plus Character image              | Official code and weights are available; preprocessing produces pose/face materials; benchmark GPU memory, latency, and commercial terms before use |
| VACE / Wan2.1-VACE | Video-to-video, reference-guided generation, inpainting, masks, depth and other controls | Apache 2.0 variants include 1.3B 480p and 14B 720p models; requires a preprocessing pipeline for source video, mask, and reference images           |

Open weights do not create an inexpensive production service by themselves.
Self-hosting adds GPU scheduling, warm pools, preprocessing, model caching,
security patching, observability, quality evaluation, retries, and rollout risk.
The official Wan2.2 reference paths demonstrate that these 14B video workloads
are operationally heavy; they should be evaluated only after TaleLabs has real
usage and provider-cost data.

## 6. Proposed TaleLabs node contracts

Do not expose provider model names as node types. TaleLabs should own stable
operation identifiers and let its model registry determine eligible routes.

### 6.1 Video Transform node

```txt
Video Transform

Inputs
  Source video       VideoSet, exactly one item per runtime invocation
  Direction          Text, optional when a visual reference is sufficient
  Visual references  ImageSet, model-limited
  First frame        ImageSet, optional, maximum one

Settings
  Transformation mode
  Motion preservation
  Structure preservation
  Preserve source audio
  Output count
  Model/quality route

Output
  Videos             VideoSet
```

### 6.2 Video Edit node

```txt
Video Edit

Inputs
  Source video       VideoSet, exactly one item per runtime invocation
  Edit instruction   Text, exactly one effective instruction
  Subject reference  ImageSet, optional and model-limited
  Keyframes           ImageSet, optional and timestamp-bound
  Mask                future typed mask input, only after a mask editor exists

Settings
  Preserve everything else
  Time range
  Preserve/regenerate audio
  Output count
  Model/quality route

Output
  Videos             VideoSet
```

Do not represent a temporal mask as an ordinary image or video merely to avoid
adding a type. If TaleLabs ships mask-guided editing, add a real mask value type
and define its timeline, dimensions, and source-video relationship.

### 6.3 Performance Transfer node

```txt
Performance Transfer

Inputs
  Driving performance  VideoSet, exactly one item per runtime invocation
  Character reference  ImageSet or VideoSet, model-dependent
  Speech audio          AudioSet, optional and model-dependent

Settings
  Transfer face/body/gestures
  Preserve source camera
  Preserve source environment
  Output count
  Model/quality route

Output
  Videos               VideoSet
```

### 6.4 Iteration semantics

The source slot accepts one inner video item per invocation. Batch behavior must
use the existing outer runtime-item and iterator semantics from
`docs/flow-nodes-planning.md`; connecting a `VideoSet` containing five source
videos must not silently invent a provider-specific batch or Cartesian product.

Every output remains a `VideoSet`, even when the provider normally returns one
file, so variants and outer iteration preserve the same Flow contract.

## 7. Illustrative registry design

The existing generation registry already has reusable slot, setting, operation,
and cross-field-constraint primitives. A future implementation can extend those
primitives into a media-operation registry rather than adding provider-specific
React nodes.

```ts
type MediaOperationId = "performanceTransfer" | "videoEdit" | "videoTransform";

interface MediaOperationModelDefinition {
  constraints: readonly GenerationConstraintDefinition[];
  id: string; // Stable TaleLabs model ID
  inputSlots: readonly GenerationInputSlotDefinition[];
  operation: MediaOperationId;
  outputValueType: "VideoSet";
  settings: readonly GenerationSettingDefinition[];
}

const videoTransformModel: MediaOperationModelDefinition = {
  constraints: [],
  id: "talelabs/video-transform-standard",
  inputSlots: [
    {
      accepts: ["VideoSet"],
      descriptionKey: "flows.inputs.sourceVideoDescription",
      id: "sourceVideo",
      labelKey: "flows.inputs.sourceVideo",
      maxConnections: 1,
      maxItems: 1,
      minConnections: 1,
    },
    {
      accepts: ["Text"],
      descriptionKey: "flows.inputs.directionDescription",
      id: "direction",
      labelKey: "flows.inputs.direction",
      maxConnections: 1,
      maxItems: 1,
      minConnections: 0,
    },
    {
      accepts: ["ImageSet"],
      descriptionKey: "flows.inputs.referencesDescription",
      id: "references",
      labelKey: "flows.inputs.references",
      maxConnections: 8,
      maxItems: 8,
      minConnections: 0,
    },
  ],
  operation: "videoTransform",
  outputValueType: "VideoSet",
  settings: [],
};
```

The values above illustrate the contract shape. A shipped model must use its
reviewed provider limits and localized translation keys. Avoid adding another
independent registry if the current generation registry can be generalized
without weakening its type safety.

## 8. User experience

### 8.1 Outcome-first default

The default node should state the source, requested change, preservation level,
duration, and estimated credits without requiring provider knowledge.

```txt
Video Transform

Source          Connected - 8.2s
Change          Turn the actor into a practical-effects dragon
Preservation    Keep motion and camera
Quality         Standard

Estimated cost  N credits
```

Model selection can remain in advanced controls. A TaleLabs quality route is a
better default than asking every user to understand Aleph, Ray, or Omni.

### 8.2 Preview before expensive generation

Runway's image-preview step solves a real cost problem. TaleLabs should consider:

1. select or extract a representative source frame;
2. create the intended edit as an image preview;
3. let the user accept or refine it;
4. use the accepted frame as a keyframe/reference for video generation.

If the preview is AI-generated, it should become a canonical Asset under the
normal TaleLabs rule that successful generation outputs are Assets. Preview cost
and provenance must be visible rather than hidden.

### 8.3 Comparison and refinement

The result experience should support:

- original/variant comparison;
- scrubbable before/after view when practical;
- visible model, duration, cost, and preservation settings;
- rerun with changed preservation strength;
- continue editing from a selected output Asset;
- export the original and output for conventional post-production.

TaleLabs should not imply that a generated creature is an independent VFX layer
unless the provider actually returns a mask or alpha-capable asset.

## 9. Execution and Asset pipeline

Every operation uses the same production-shaped lifecycle:

1. Resolve one source/driving Video and all references from typed Flow values.
2. Revalidate tenant ownership, Element revisions, and exact Asset revisions.
3. Probe duration, dimensions, FPS, codec, audio streams, and file size.
4. Validate the selected operation and cross-field constraints against the
   pinned TaleLabs model contract.
5. Normalize footage with FFmpeg only when the provider route requires it.
6. Store exact inputs, settings, prompt, model contract version, and provider
   route in the immutable run/job snapshot.
7. Dispatch a tenant-scoped Trigger.dev task.
8. Give the provider short-lived signed URLs or use its file-upload API.
9. Store provider job ID and idempotency state before waiting.
10. Receive a verified webhook or poll with bounded backoff.
11. Download the output before the provider URL expires.
12. Ingest the result into private R2 as a canonical Asset.
13. Generate poster/thumbnail derivatives and record immutable lineage.
14. Capture provider cost, TaleLabs credits, timing, warnings, and failure code.

The source Asset remains immutable. Every transform or edit creates a derived
Asset linked to the source and all controlling references.

### 9.1 Audio policy

Providers differ on whether they preserve, drop, or regenerate source audio.
The model registry needs an explicit audio policy:

```ts
type VideoEditAudioPolicy =
  | "drop"
  | "preserve"
  | "regenerate"
  | "user-selectable";
```

Adapters must not silently change audio behavior. If the visual provider drops
audio, TaleLabs may preserve and remux the source audio through a separate,
documented pipeline only when that matches the user's selected policy.

## 10. Provider-adapter reference

Provider adapters translate a normalized TaleLabs request into a concrete API
without leaking provider fields into Flow snapshots or public node contracts.

```ts
interface VideoTransformAdapterRequest {
  firstFrameUrl?: string;
  mode: "adhere" | "flex" | "reimagine";
  prompt: string;
  providerModelId: string;
  sourceVideoUrl: string;
  webhookUrl: string;
}

interface ProviderSubmission {
  providerJobId: string;
  status: "pending";
}

async function submitLumaVideoTransform(
  request: VideoTransformAdapterRequest,
): Promise<ProviderSubmission> {
  const response = await fetch(
    "https://api.lumalabs.ai/dream-machine/v1/generations/video/modify",
    {
      body: JSON.stringify({
        callback_url: request.webhookUrl,
        first_frame: request.firstFrameUrl
          ? { url: request.firstFrameUrl }
          : undefined,
        generation_type: "modify_video",
        media: { url: request.sourceVideoUrl },
        mode: `${request.mode}_1`,
        model: request.providerModelId,
        prompt: request.prompt,
      }),
      headers: {
        Authorization: `Bearer ${process.env.LUMA_API_KEY!}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok)
    throw new Error(`Luma submission failed: ${response.status}`);

  const generation = (await response.json()) as { id: string };
  return { providerJobId: generation.id, status: "pending" };
}
```

This is reference code only. Production code must use TaleLabs' shared provider
errors, verified callbacks, idempotent submission, secrets handling, URL expiry
policy, timeout policy, and output ingestion.

## 11. OpenRouter implications

OpenRouter now has an asynchronous video API with text prompts, first/last frame
images, and input references. Its create-video contract can accept image, audio,
and video references, but audio/video references are currently honored only by
Seedance 2.0 provider routes.

The current standardized OpenRouter contract does not expose a universal mask,
localized-edit, preservation-strength, or explicit driving-performance schema.
Therefore:

- use OpenRouter for ordinary text/image/reference-to-video where its contract
  matches the operation;
- do not describe a reference video as deterministic source-preserving editing;
- integrate Runway, Luma, Gemini, or another provider directly for advanced
  editing until OpenRouter exposes equivalent reviewed capabilities;
- keep the public TaleLabs node stable so routing can change later.

OpenRouter states that asynchronous video generation is not eligible for Zero
Data Retention. This matters when users upload unreleased footage or identifiable
performances and must be disclosed in route/privacy decisions.

## 12. Security, consent, and rights

Performance transfer and generative editing can alter what a real person did,
wore, endorsed, or appeared beside. Before broad release TaleLabs needs:

- explicit confirmation that the user has rights to source footage and any
  Character likeness;
- rules against deceptive impersonation, non-consensual sexual content, fraud,
  harassment, and misleading endorsements;
- immutable provenance linking every output to source Assets and model route;
- tenant-isolated private media and short-lived provider access;
- provider retention and regional restrictions recorded in route metadata;
- abuse reporting, account suspension, and audit retention;
- additional review before exposing these operations through public API, Tool,
  Blueprint, or MCP execution.

Gemini Omni Flash currently restricts editing uploaded footage in some regions
and limits editing of certain recognizable people. Provider policy differences
must be represented in server-side routing, not discovered after charging a job.

## 13. Recommended delivery phases

### Phase A: provider-independent prototype

- Add mock `videoTransform`, `videoEdit`, and `performanceTransfer` operation
  definitions only when the Flow engine is ready to exercise them.
- Use real source Assets and production-shaped snapshots/jobs.
- Mock only the provider boundary with `TODO(provider-integration)`.
- Validate collection and outer-iteration semantics.

### Phase B: Video Transform

- Integrate one direct provider route, likely Luma Modify or Aleph 2.0.
- Support source video, prompt, optional image reference, preservation mode,
  audio policy, cost estimate, variants, and canonical output Assets.
- Keep the first release to short, single-shot clips.

### Phase C: Performance Transfer

- Integrate Act-Two or evaluate Wan2.2-Animate through a hosted route.
- Connect Element/Character appearance outputs directly to the Character slot.
- Add consent, recognizable-person restrictions, and driving-video guidance.

### Phase D: Localized Video Edit

- Add edit preview/keyframe workflow before full-video generation.
- Start with prompt plus reference and strict preservation.
- Add masks only after a real temporal mask editor and value type are designed.

### Phase E: self-hosting and professional interchange

- Evaluate VACE or Wan from measured workload and provider spend.
- Add optional alpha/mask outputs only when models reliably produce them.
- Explore EDL/XML or other handoff formats after users demonstrate demand.

## 14. Evaluation criteria

Maintain a controlled internal evaluation set. Demo-reel quality is not enough.

Measure:

- source-motion preservation;
- camera-motion preservation;
- scene-structure and geometry preservation;
- identity, face, hands, clothing, and product fidelity;
- edit localization and unintended-change area;
- temporal flicker and object consistency;
- prompt adherence;
- occlusion and fast-motion behavior;
- multiple-subject behavior;
- audio preservation/synchronization;
- visible seams across chunked clips;
- output resolution and compression;
- processing latency per source second;
- provider failure and moderation rates;
- actual provider cost and output acceptance rate;
- commercial licensing, retention, and regional availability.

The most important business metric is **cost per accepted output**, not cost per
generation. A cheaper model that requires many failed attempts can be the more
expensive route.

## 15. Open product questions

Before implementation decide:

1. Is the first audience advertising variation, filmmakers, or broad creators?
2. Should the first transform node preserve source audio by default?
3. Does TaleLabs create an AI image preview before every expensive edit, or only
   when the selected route supports keyframe guidance?
4. How are provider retention and recognizable-person restrictions shown before
   execution?
5. Which preservation controls form a stable TaleLabs vocabulary across routes?
6. When does a source clip need automatic shot splitting, and should the user
   approve boundaries before spending credits?
7. Is mask-guided editing valuable enough to justify a temporal mask editor?

## 16. Sources

Primary product and API sources:

- [Runway Aleph 2.0 and Edit Studio](https://runwayml.com/news/introducing-aleph-2-and-edit-studio)
- [Runway Aleph research and operation examples](https://runwayml.com/research/introducing-runway-aleph)
- [Runway API inputs and Aleph limits](https://docs.dev.runwayml.com/assets/inputs/)
- [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/)
- [Runway Act-Two performance capture](https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two)
- [Luma Modify Video API](https://docs.lumalabs.ai/docs/modify-video)
- [Luma Ray3 Modify guide](https://lumalabs.ai/learning-hub/ray3-modify-user-guide)
- [Luma Ray3.2 motion and structure controls](https://lumalabs.ai/learning-center/articles/ray-3-2-introduction-and-core-concepts)
- [Gemini Omni Flash video editing](https://ai.google.dev/gemini-api/docs/omni)
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter create-video API](https://openrouter.ai/docs/api/api-reference/video-generation/create-videos)
- [Wan2.2 official repository and Wan-Animate](https://github.com/Wan-Video/Wan2.2)
- [VACE official repository](https://github.com/ali-vilab/VACE)
- [VACE ICCV 2025 paper](https://openaccess.thecvf.com/content/ICCV2025/papers/Jiang_VACE_All-in-One_Video_Creation_and_Editing_ICCV_2025_paper.pdf)
- [Adobe Premiere Generative Extend](https://community.adobe.com/announcements-727/generative-extend-is-now-in-premiere-pro-1546584)

Community workflow and failure signals:

- [Long object removal with chunking and conventional recompositing](https://www.reddit.com/r/runwayml/comments/1quwhes/reliable_video_object_removal_inpainting_model/)
- [Video-to-video preservation and quality concerns](https://www.reddit.com/r/runwayml/comments/1t75ma1/is_it_possible_to_do_video2video_with_runway/)
- [Mixed Aleph outcomes and simple-prompt workflows](https://www.reddit.com/r/runwayml/comments/1ml1xem/deep_dive_into_aleph/)
- [Adobe community demand for easier video extension](https://community.adobe.com/feature-requests-405/generative-extend-video-in-firefly-1623034)
