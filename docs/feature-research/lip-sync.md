# TaleLabs Feature Research: Lip Sync

Status: product and technical research for a future Flow capability. This
document does not add lip sync to the current MVP milestone.

Last researched: July 12, 2026.

## 1. Purpose

Lip sync fits TaleLabs as a media transformation inside a Flow:

```txt
Source video + target speech audio -> synchronized video Asset
```

The output must become a canonical TaleLabs Asset with immutable provenance,
just like every other successful generation output.

Lip sync is especially relevant to:

- dubbing and localization;
- product advertisements with presenters;
- recurring Character dialogue;
- virtual presenters and educational content;
- replacing dialogue without reshooting footage.

It is a future capability. The provider-independent execution engine and its
snapshot/provenance foundation should be completed before a real lip-sync
provider is integrated.

### 1.1 Product conclusion

Lip sync is a credible future TaleLabs node because it composes directly with
existing Assets, future audio-generation nodes, Elements, and reusable Flows.
The first useful contract is intentionally narrow:

```txt
One existing Video + one clean speech Audio -> one synchronized VideoSet
```

The first release should optimize for one clearly visible speaker and preserve
the source shot. It should not attempt to become a complete translation suite,
avatar studio, voice-cloning product, or multi-speaker editor. Those workflows
can be assembled from separate nodes after the core transformation is reliable.

### 1.2 What users are trying to accomplish

Official products and community discussions point to five recurring jobs:

1. **Localization and dubbing.** Translate presenter, education, marketing, and
   social videos while making the new speech visually believable. HeyGen and
   Captions both position lip sync as part of video translation rather than an
   isolated visual effect.
2. **Bring-your-own speech.** Upload a finished voice track and synchronize an
   existing video without buying voice generation from the same vendor.
3. **Recurring-character dialogue.** Reuse generated Character footage in new
   languages or with revised dialogue.
4. **Long-form and batch processing.** Creators ask for six-to-ten-minute and
   even longer videos, while production providers expose concurrency and batch
   APIs rather than assuming every job is a short avatar clip.
5. **Preservation-first correction.** Users care as much about retaining the
   original face, animation, body motion, and image quality as they do about
   phoneme synchronization.

Community reports are qualitative, but the same failure themes recur:

- full-frame or full-face regeneration can damage an otherwise finished source
  video, creating a demand for mouth-region-only processing;
- open-source workflows are difficult to install and can require substantial
  VRAM;
- long clips, scene cuts, multiple speakers, profiles, occlusions, stylized
  characters, teeth, and beards remain difficult;
- creators frequently trade quality against speed and cost rather than finding
  one model that wins on all three.

Relevant discussions include community comparisons of
[LatentSync and MuseTalk](https://www.reddit.com/r/StableDiffusion/comments/1kx862k/looking_for_lip_sync_models_anything_better_than/),
[source-quality preservation](https://www.reddit.com/r/StableDiffusion/comments/1r91zf9/add_good_lipsync_to_existing_video_without/), and
[long no-code videos](https://www.reddit.com/r/StableDiffusion/comments/1siajcu/help_with_lipsync/).
These reports should guide TaleLabs evaluation cases, not be treated as verified
benchmarks or market-size estimates.

### 1.3 Competitor workflow research

| Product                  | User workflow                                                                                                                       | What TaleLabs should learn                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Sync Labs                | Supply video/image plus audio/text, choose a quality model, estimate cost, submit asynchronously, optionally detect active speakers | Strong specialist API reference; separates model tiers, cost, long-form limits, and advanced speaker behavior |
| HeyGen Video Translation | Upload or link a video, choose audio-only or video dubbing, language, duration behavior, and quality path                           | Translation is a multi-stage outcome; lip sync should remain one composable stage in TaleLabs                 |
| Captions Lipdub          | Submit translation with optional Lipdub through its app/API                                                                         | Users expect localization to be an outcome preset, not necessarily a low-level model screen                   |
| Runway Act-Two           | Combine a driving performance with a Character image/video; multi-character scenes are assembled from controlled passes             | Performance transfer is adjacent to lip sync but deserves a separate node contract                            |
| Luma Dream Machine       | Any video can be lip-synced, captioned, transformed, and reused on a Board                                                          | Asset-first composition fits TaleLabs; generated output should immediately remain reusable in the Flow        |
| Fal                      | Select a concrete hosted endpoint such as Sync, LatentSync, MuseTalk, or Kling and submit through a common queue/file API           | Useful for initial model comparison, but TaleLabs still needs model-specific registry entries and evaluation  |

The most relevant official references are
[HeyGen Video Translation](https://help.heygen.com/en/articles/10029081-how-to-get-started-with-video-translation),
[Captions AI Translate API](https://help.captions.ai/api-reference/ai-translate),
[Runway multi-character dialogue](https://help.runwayml.com/hc/en-us/articles/41748090660499-Creating-Multi-Character-Dialogues-with-Act-Two), and
[Luma video capabilities](https://lumalabs.ai/learning-hub/luma-video-capabilities-ai-video-generation-editing-lip-sync).

## 2. Domain boundaries

### 2.1 Lip sync

Lip sync modifies an existing video so a visible speaker's mouth movements
match target speech audio. Most of the original performance and composition
remain intact.

```txt
Video + speech audio -> transformed video
```

### 2.2 Talking Character or avatar animation

Talking Character generation starts from a still image and creates motion as
well as speech animation.

```txt
Image + speech audio -> newly animated video
```

This should eventually be a separate operation or node family. It has different
identity, motion, duration, and quality semantics from video-to-video lip sync.

### 2.3 Native audiovisual video generation

Some general video models generate visuals, speech, ambience, and synchronized
mouth motion together. This is still video generation, not deterministic
redubbing of an existing performance.

```txt
Prompt and references -> newly generated video with audio
```

An audio-capable video model must not automatically be classified as a lip-sync
model.

### 2.4 Dubbing pipeline

Lip sync is one stage in a larger dubbing pipeline:

```txt
Source video
  -> speech transcription
  -> translation or script editing
  -> TTS or cloned voice generation
  -> lip sync
  -> voice, music, and ambience mix
  -> final video Asset
```

TaleLabs should treat the lip-sync input as a clean speech stem when possible.
Music and ambience should be preserved separately and mixed after lip sync.

## 3. How lip-sync systems work

A typical implementation performs the following steps:

1. Decode and normalize video and audio.
2. Detect and track faces through the source frames.
3. Determine the active speaker or selected face.
4. Convert speech into time-aligned audio features.
5. Regenerate or inpaint the mouth and surrounding facial region.
6. Blend generated regions into the original frames.
7. Mux the target audio into the result.
8. Encode the resulting video.

Approaches differ by model:

- **LatentSync** uses Whisper-derived audio embeddings and audio-conditioned
  latent diffusion.
- **MuseTalk** performs single-step latent-space face-region inpainting and is
  optimized for fast inference.
- hosted commercial models may modify a larger facial or full-shot region to
  preserve expression, handle occlusion, and support difficult camera angles.

Long videos may be divided into shots or chunks. This makes scene boundaries,
face tracking, temporal continuity, retries, and partial failure important.

## 4. TaleLabs Flow contract

Lip sync should be represented as a dedicated transformation node, not as a
setting on a general video-generation node.

```txt
Lip Sync
  Inputs
    Video          Video, exactly 1
    Speech audio   Audio, exactly 1
    Speaker        optional selector or active-speaker policy

  Output
    Video          VideoSet, normally containing 1 Asset
```

The output remains a typed collection because all Flow ports use collection
semantics. The normal provider result contains one video, but a future provider
or outer iteration may create several runtime outputs.

### 4.1 Stable operation family

TaleLabs should own a stable operation identifier such as:

```ts
type GenerationOperation =
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "lip-sync";
```

Provider endpoint names must not become the public Flow contract.

### 4.2 Illustrative model definition

The exact shape should follow the code-owned generation-model registry rather
than introduce a second registry:

```ts
const lipSyncModel = {
  id: "talelabs/lipsync-standard",
  operation: "lip-sync",
  inputSlots: [
    { id: "video", accepts: ["Video"], minConnections: 1, maxConnections: 1 },
    { id: "audio", accepts: ["Audio"], minConnections: 1, maxConnections: 1 },
  ],
  outputSlots: [{ id: "video", produces: "VideoSet" }],
  constraints: {
    minDurationSeconds: 2,
    maxDurationSeconds: 600,
    maxVideoBytes: 100_000_000,
    supportedVideoFormats: ["mp4", "mov"],
    supportedAudioFormats: ["wav", "mp3"],
  },
  pricing: {
    unit: "output-second",
  },
} as const;
```

These values are illustrative. Every shipped model must use its reviewed,
provider-specific constraints from the TaleLabs model registry.

## 5. Input resolution and execution

Run admission follows the same production contract as other generation jobs:

1. Resolve exactly one source Video Asset and one speech Audio Asset.
2. Validate both Assets against the selected model's capabilities.
3. Lock exact Asset IDs and revisions in the run snapshot.
4. Record duration, dimensions, format, and selected speaker policy.
5. Estimate provider cost before dispatch.
6. Dispatch an asynchronous Trigger.dev task using tenant-scoped run and job
   IDs.
7. Have the provider adapter load short-lived signed input URLs.
8. Ingest the provider result into private R2 storage as a canonical Asset.
9. Record provider, model route, cost, timing, inputs, and output provenance.

The worker must execute from the immutable run snapshot, never mutable Flow or
Element rows.

Lip-sync jobs should be asynchronous even when a provider can respond quickly.
Video decoding, provider queues, downloads, result ingestion, and retries make
request-bound execution inappropriate.

### 5.1 Provider-adapter reference

The adapter receives normalized, already-authorized inputs from a locked run
snapshot. Provider credentials, URLs, and model names remain server-only.

```ts
interface LipSyncAdapterRequest {
  audioUrl: string;
  idempotencyKey: string;
  providerModelId: string;
  videoUrl: string;
  webhookUrl: string;
}

interface ProviderSubmission {
  providerJobId: string;
  status: "pending";
}

async function submitSyncLabsLipSync(
  request: LipSyncAdapterRequest,
): Promise<ProviderSubmission> {
  const response = await fetch("https://api.sync.so/v2/generate", {
    body: JSON.stringify({
      input: [
        { type: "video", url: request.videoUrl },
        { type: "audio", url: request.audioUrl },
      ],
      model: request.providerModelId,
      webhookUrl: request.webhookUrl,
    }),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.SYNC_API_KEY!,
    },
    method: "POST",
  });

  if (!response.ok)
    throw new Error(`Sync submission failed: ${response.status}`);

  const generation = (await response.json()) as { id: string };
  return { providerJobId: generation.id, status: "pending" };
}
```

This is reference code, not a ready TaleLabs adapter. Production code must use
the shared provider error taxonomy, verified webhook signatures, Trigger.dev
idempotency, short-lived input access, and immediate output ingestion. Sync's
official request shape requires exactly one visual input and one audio or text
input for normal lip sync.

## 6. Duration mismatch

Source video and target audio frequently have different durations. Providers
offer policies such as:

- `cut_off`: stop at the shorter input;
- `loop`: repeat the source video;
- `bounce`: alternate forward and reverse source playback;
- `silence`: preserve portions without target speech;
- `remap`: adjust timing to fit.

TaleLabs should expose a stable duration policy and translate it in provider
adapters. `cut_off` is the safest initial default. Unsupported policies must not
be silently approximated by an adapter.

The UI must show the source and target durations before execution and explain
the selected mismatch behavior.

## 7. Face and speaker selection

Multiple faces are a separate capability, not an assumption.

The first implementation should:

- support one clearly visible speaking face;
- reject or warn when no face is detected;
- warn when multiple plausible speakers are detected;
- allow provider-side automatic active-speaker detection only when explicitly
  supported by the selected model.

A later version may add:

- face detection before admission;
- a frame-based speaker picker;
- track IDs that persist across shots;
- per-shot speaker assignments;
- automatic active-speaker detection with manual override.

Speaker decisions must be stored in job provenance.

## 8. Validation and expected failures

The registry and adapter must distinguish validation failures from retryable
infrastructure failures.

### 8.1 Preflight validation

Validate where metadata is available:

- media type and container format;
- file size;
- source and target duration;
- resolution and dimensions;
- frame rate when constrained;
- detectable speech in the audio;
- detectable face in the video;
- model concurrency and account limits.

### 8.2 Content-quality warnings

Warn about conditions likely to reduce quality:

- face too small in the frame;
- extreme profile angle;
- mouth or face obstruction;
- frozen or non-speaking source footage;
- rapid scene cuts;
- several visible speakers;
- low-resolution face region;
- heavy compression;
- music or background noise mixed into the speech input.

### 8.3 Retry policy

Invalid media, unsupported constraints, or no detectable face should terminate
without infrastructure retries. Provider timeouts, transient download failures,
and temporary provider errors may retry according to the provider route policy.
Idempotency must prevent duplicate billable provider requests and duplicate
output Assets.

## 9. Provider landscape

Provider capabilities and prices change. The code-owned TaleLabs registry is the
runtime source of truth; this section records the strategic landscape only.

### 9.1 Sync Labs

Sync Labs is a specialist production provider with REST and TypeScript/Python
SDKs, asynchronous generation, cost estimation, batch processing, and several
quality tiers.

Research snapshot at 25 FPS:

| Model         | Approximate raw provider price | 15-second raw cost |
| ------------- | -----------------------------: | -----------------: |
| lipsync-2     |                $0.04-$0.05/sec |        $0.60-$0.75 |
| lipsync-2-pro |              $0.067-$0.083/sec |        $1.01-$1.25 |
| sync-3        |              $0.107-$0.133/sec |        $1.61-$2.00 |

Sync Labs is the strongest candidate when TaleLabs needs long-form dubbing,
complex shots, premium quality, and production support.

### 9.2 Fal

Fal exposes multiple lip-sync model families through one queue and file API,
including Sync models, LatentSync, MuseTalk, and Kling LipSync.

Fal is a strong first integration candidate because TaleLabs can compare several
models without immediately maintaining several provider integrations. It also
offers open-source-backed options that may later be self-hosted.

Provider aggregation does not remove model-specific capability definitions.
Each Fal endpoint still needs a reviewed TaleLabs registry entry and adapter.

### 9.3 OpenRouter

OpenRouter has an asynchronous video-generation API and some video models accept
audio or video references. At the time of this research, its public video model
registry did not expose dedicated Sync, LatentSync, MuseTalk, or equivalent
video-to-video lip-sync endpoints.

Audio-conditioned general video generation must not be treated as a replacement
for deterministic redubbing. TaleLabs should plan a separate lip-sync provider
integration unless OpenRouter later exposes a suitable dedicated operation.

OpenRouter remains useful elsewhere in the same Flow: an audio model can create
the speech Asset and a video model can create source footage, while the final
lip-sync node routes to a specialist provider.

### 9.4 Self-hosting

Self-hosting can improve margins after sustained volume justifies GPU operations.

**LatentSync**

- Apache 2.0 repository;
- quality-oriented latent diffusion;
- documented minimum inference memory around 8 GB for version 1.5 and 18 GB for
  version 1.6;
- higher inference cost and latency than single-step approaches.

**MuseTalk**

- code and released model permit commercial use;
- designed for fast audio-driven facial inpainting;
- documented real-time performance on high-end GPU reference hardware;
- known limitations include facial-detail preservation and jitter.

**Wav2Lip**

- historically important reference implementation;
- public pretrained weights are restricted to non-commercial use;
- must not be used as TaleLabs' commercial self-hosted model without separate
  licensing.

Self-hosting requires more than a model container: GPU scheduling, warm pools,
input preprocessing, FFmpeg, face tracking, observability, capacity control,
fallbacks, model rollout, and output-quality evaluation all become TaleLabs
responsibilities.

## 10. Pricing and credits

Lip sync is normally priced by processed frame or output second. TaleLabs should
estimate cost from:

```txt
billable duration
  x provider price per second or frame
  + input/output transfer and processing overhead
  + TaleLabs risk and margin policy
```

The estimate shown before execution should include:

- selected quality tier;
- billable duration after mismatch policy;
- expected credits;
- whether the estimate can vary after provider inspection.

Provider cost and TaleLabs credit cost must be captured on every job from the
first implementation, even before balance enforcement ships.

Never market an unlimited lip-sync plan backed directly by an unbounded
usage-priced provider. A future unlimited plan requires fair-use limits,
concurrency controls, lower-cost routing, or self-hosted capacity.

## 11. User experience

The default node should remain outcome-oriented:

```txt
Lip Sync

Video          Connected
Speech audio   Connected
Duration       14.8s video / 15.0s audio
Quality        Standard

Estimated cost: N credits
```

The model may be selectable in advanced controls, but the default should be a
TaleLabs quality tier or recommended route.

Advanced controls may include:

- model or quality tier;
- duration mismatch policy;
- active-speaker behavior;
- output resolution when supported;
- expression or performance intensity when supported.

Do not expose unsupported settings merely because another provider offers them.

## 12. Safety and consent

Lip sync can make a real person appear to say something they never said.
TaleLabs therefore needs stronger controls than ordinary image generation:

- clear user confirmation that they have permission to use the person's image
  and voice;
- terms prohibiting impersonation, fraud, harassment, and deceptive political or
  commercial content;
- moderation and abuse-reporting paths;
- immutable job provenance and audit records;
- the ability to suspend accounts and preserve evidence of abuse;
- provenance metadata or disclosure mechanisms where practical;
- extra review before exposing lip sync through public API, Tool, or MCP access.

Specific legal requirements vary by jurisdiction and must be reviewed before
commercial launch.

## 13. Recommended delivery phases

### Phase A: provider-independent engine

- Define the `lip-sync` operation family and typed slots only when required by
  engine prototyping.
- Use mock provider output.
- Preserve production-shaped runs, jobs, snapshots, and Assets.
- Mark provider replacement boundaries with `TODO(provider-integration)`.

### Phase B: hosted comparison

- Integrate Fal behind a server-only provider adapter.
- Compare Sync, LatentSync, MuseTalk, and Kling on a controlled evaluation set.
- Measure quality, sync, latency, failure rate, and actual cost.
- Keep model and provider routes code-owned.

### Phase C: production route

- Choose a standard and premium default.
- Add preflight validation and duration-cost estimation.
- Add direct Sync Labs integration if quality, duration, volume pricing, or
  reliability warrants it.
- Add consent and abuse controls before broad release.

### Phase D: margin optimization

- Evaluate self-hosted MuseTalk or LatentSync from measured production volume.
- Introduce GPU capacity and fallback routing gradually.
- Preserve the same public TaleLabs model ID when provider routing changes do
  not change the creative contract.

## 14. Evaluation criteria

Do not select a model from demo quality alone. Maintain a representative internal
evaluation set and measure:

- phoneme and mouth synchronization;
- identity preservation;
- teeth, beard, and lip-detail preservation;
- temporal jitter;
- profile and occlusion handling;
- expression preservation;
- multiple-face behavior;
- scene-cut behavior;
- output resolution and compression;
- processing latency per output second;
- provider failure rate;
- actual provider cost;
- commercial licensing and data-retention terms.

Automatic sync metrics can help detect regressions, but visual human review
remains necessary for release decisions.

## 15. Sources

- [Sync Labs API overview](https://sync.so/docs/api-reference/api-overview)
- [Sync Labs create-generation contract](https://sync.so/docs/api-reference/api/generate-api/create)
- [Sync Labs lip-sync models](https://sync.so/docs/models/lipsync)
- [Sync Labs billing](https://sync.so/docs/product/billing)
- [HeyGen Video Translation](https://help.heygen.com/en/articles/10029081-how-to-get-started-with-video-translation)
- [HeyGen API pricing and uploaded-audio lip sync](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained)
- [Captions AI Translate API](https://help.captions.ai/api-reference/ai-translate)
- [Runway multi-character dialogue with Act-Two](https://help.runwayml.com/hc/en-us/articles/41748090660499-Creating-Multi-Character-Dialogues-with-Act-Two)
- [Luma video capabilities](https://lumalabs.ai/learning-hub/luma-video-capabilities-ai-video-generation-editing-lip-sync)
- [Fal Sync Lipsync 2 API](https://fal.ai/models/fal-ai/sync-lipsync/v2/api)
- [Fal Kling LipSync API](https://fal.ai/models/fal-ai/kling-video/lipsync/audio-to-video/api)
- [Fal LatentSync](https://fal.ai/models/fal-ai/latentsync)
- [Fal MuseTalk](https://fal.ai/models/fal-ai/musetalk)
- [OpenRouter video generation documentation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter video model registry](https://openrouter.ai/api/v1/videos/models)
- [ByteDance LatentSync](https://github.com/bytedance/LatentSync)
- [Tencent Music MuseTalk](https://github.com/TMElyralab/MuseTalk)
- [Wav2Lip](https://github.com/Rudrabha/Wav2Lip)

Community workflow and failure signals:

- [Preserving source video while adding lip sync](https://www.reddit.com/r/StableDiffusion/comments/1r91zf9/add_good_lipsync_to_existing_video_without/)
- [Open-source model comparison and setup issues](https://www.reddit.com/r/StableDiffusion/comments/1kx862k/looking_for_lip_sync_models_anything_better_than/)
- [Long-form, no-code lip-sync demand](https://www.reddit.com/r/StableDiffusion/comments/1siajcu/help_with_lipsync/)
- [Motion preservation versus synchronization quality](https://www.reddit.com/r/StableDiffusion/comments/1qywph6/best_audio_video_to_lipsynced_video_solution/)
