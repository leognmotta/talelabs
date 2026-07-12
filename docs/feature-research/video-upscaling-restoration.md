# Video Upscaling and Restoration

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

Video enhancement is a credible TaleLabs feature because generated clips often
need delivery-resolution upscaling, denoising, deblocking, stabilization, or
frame interpolation before they leave the creative workflow. It should be
presented as a technical finishing step, not as another prompt-based generator.

The recommended first capability is a single `Enhance Video` node with reviewed
presets. Advanced controls can be exposed later. Every result remains a new
canonical Asset linked to its source; TaleLabs never overwrites the original.

## What Users Are Trying to Do

- turn 720p or 1080p AI generations into acceptable 4K delivery files;
- reduce compression, noise, softness, and flicker without inventing detail;
- interpolate low-frame-rate footage or generated clips;
- stabilize handheld or synthetic motion;
- process batches without keeping a workstation occupied;
- compare the enhanced output with the source before export.

Community discussions repeatedly distinguish “larger” from “better.” Users
complain about plastic texture, invented facial detail, temporal flicker, and
the storage/runtime cost of indiscriminate 4x enhancement. That makes preview,
comparison, and conservative presets more important than a prominent 8K badge.

## Competitor and Tool Behavior

Topaz Video exposes enhancement, frame interpolation, stabilization, motion
deblur, denoise, and SDR-to-HDR as separate filters and supports automation via
CLI. Runway added a Magnific Video Upscaler to its API in June 2026. Adobe
Firefly also places upscaling in the broader generate-then-refine workflow.

The useful pattern is:

1. inspect the source metadata;
2. select a goal or preset;
3. estimate runtime and output size;
4. enqueue a durable job;
5. show before/after comparison;
6. retain both source and derivative.

## Candidate Engines

| Engine                    | Deployment                | Useful for                              | Caveat                                                 |
| ------------------------- | ------------------------- | --------------------------------------- | ------------------------------------------------------ |
| Topaz Video               | commercial desktop/CLI    | broad production enhancement            | licensing and server automation must be negotiated     |
| Runway Magnific           | hosted API                | simple managed upscaling                | provider pricing and limits can change                 |
| Real-ESRGAN               | self-hosted, BSD-3-Clause | image/frame super-resolution            | video needs decoding, batching, and temporal handling  |
| FFmpeg filters            | self-hosted code          | scaling, denoise, stabilization helpers | conventional processing, not restoration by itself     |
| RIFE-family interpolation | self-hosted               | frame-rate conversion                   | evaluate license and temporal artifacts per checkpoint |

Open-source image upscalers can be applied frame-by-frame, but that alone is not
a production video upscaler. TaleLabs must account for decode/encode quality,
color metadata, audio remuxing, frame consistency, and failure recovery.

## Proposed Flow Contract

```txt
Enhance Video
  video: VideoSet (exactly 1 item per runtime item)
  mode: upscale | restore | interpolate | stabilize
  preset: conservative | balanced | strong
  targetResolution?: 1080p | 4k
  targetFps?: 24 | 30 | 60

  output: VideoSet
```

Do not silently combine every operation. The first implementation may offer
presets backed by a pipeline, but the immutable run snapshot must record every
applied operation and engine version.

```ts
type VideoEnhancementRequest = {
  sourceAssetId: string;
  operations: Array<
    | { type: "upscale"; targetHeight: 1080 | 2160 }
    | { type: "restore"; strength: "conservative" | "balanced" | "strong" }
    | { type: "interpolate"; targetFps: 24 | 30 | 60 }
    | { type: "stabilize"; strength: number }
  >;
};
```

## TaleLabs Implementation Notes

- Read source dimensions, duration, codec, frame rate, and audio tracks before
  admission.
- Reject configurations that exceed engine-specific duration, frame, pixel, or
  output-size limits.
- Run processing through Trigger.dev with explicit CPU/GPU class and progress.
- Write temporary frames and intermediates under a run-scoped prefix and clean
  them after success or terminal failure.
- Preserve audio, rotation, aspect ratio, and relevant color metadata.
- Store `parentAssetId`, engine/model version, operations, and output metadata.
- Generate the normal TaleLabs poster thumbnail for the resulting Asset.
- Treat cancellation as cooperative; do not publish a partially encoded file.

## UX and Evaluation

The node should default to `Balanced, keep original frame rate`. Advanced
settings belong in a secondary panel. The Asset viewer should support a synced
before/after scrub or split comparison.

Evaluate with real TaleLabs inputs, not model demo reels:

- text, logo, and face preservation;
- temporal flicker and invented detail;
- motion smoothness;
- audio sync and metadata preservation;
- runtime and provider cost per source minute;
- output byte growth;
- cancellation and retry behavior.

## Delivery Sequence

1. Metadata-only validation and mocked derivative ingestion.
2. One managed provider behind a TaleLabs adapter.
3. Before/after review and preset metrics.
4. Optional self-hosted pipeline after usage justifies GPU operations.
5. Batch enhancement only after per-Asset behavior is reliable.

## Sources

### Primary

- [Topaz Video quick start](https://docs.topazlabs.com/topaz-video/quick-start)
- [Topaz enhancement filter](https://docs.topazlabs.com/video-ai/filters/enhancement)
- [Topaz stabilization](https://docs.topazlabs.com/video-ai/filters/stabilization)
- [Topaz Video command-line interface](https://docs.topazlabs.com/video-ai/advanced-functions-in-topaz-video-ai/command-line-interface)
- [Runway API changelog](https://docs.dev.runwayml.com/api-details/api_changelog/)
- [Real-ESRGAN repository](https://github.com/xinntao/Real-ESRGAN)
- [Real-ESRGAN license](https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE)

### Community Signals

- [Batch-upscaling many videos](https://www.reddit.com/r/VideoEditing/comments/1rvgmq0/most_efficient_way_to_upscale_lots_of_videos/)
- [Natural restoration versus hallucinated detail](https://www.reddit.com/r/upscaling/comments/1tqg3mz/best_ai_upscaling_workflow_for_restoring_a/)
- [Automated 4K/8K segmented workflow](https://www.reddit.com/r/TopazLabs/comments/1srjfe8/4k_8k_vr_upscaling_pipeline_using_topaz_video_ai/)
- [Avoiding aggressive 4x artifacts](https://www.reddit.com/r/TopazLabs/comments/1lo5l4q/how_to_upscale_from_and_to/)
