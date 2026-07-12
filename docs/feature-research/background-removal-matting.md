# Background Removal and Video Matting

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

Background removal is valuable when it produces a reusable foreground and
alpha matte for later compositing. A green-screen render alone is a weak
contract: it bakes a workaround into an Asset and loses edge transparency.

TaleLabs should model this as media analysis/processing, with a dedicated matte
artifact. The first UI can still offer simple “remove background” and “replace
background” outcomes, but the runtime should preserve the alpha result.

## User Workflows and Failure Modes

Users want to:

- isolate people or products without shooting on green screen;
- replace a background while keeping hair, motion blur, shadows, and transparent
  materials believable;
- composite a subject into generated environments;
- reuse the same cutout across campaign variants;
- export transparent media to professional tools;
- process many catalog or UGC clips automatically.

Community reports consistently identify hair, fast motion, occlusion, soft
edges, and edge chatter as the hard cases. Users also ask for manual correction
rather than accepting an all-or-nothing automatic result.

## Competitor Pattern

Hosted APIs such as Bria accept a source video and asynchronously return a
background-removed result. Research systems such as MatAnyone propagate a
user-provided first-frame mask through the video and expose alpha/foreground
outputs. Professional tools pair automatic masks with refinement controls.

The product implication is that TaleLabs needs two levels:

1. one-click automatic matting for common cases;
2. an optional correction input, initially a first-frame mask Asset.

## Candidate Engines

| Engine                               | Deployment                | Inputs                       | Outputs/caveats                                       |
| ------------------------------------ | ------------------------- | ---------------------------- | ----------------------------------------------------- |
| Bria video background removal        | hosted API through fal    | video                        | managed result; verify alpha format and limits        |
| MatAnyone                            | self-hosted research code | video + first-frame mask     | foreground and alpha; review NTU S-Lab license        |
| Robust Video Matting family          | self-hosted               | video                        | proven baseline; validate current license/checkpoints |
| conventional segmentation + tracking | self-hosted pipeline      | video + optional clicks/mask | more control, more engineering                        |

## Proposed Types and Nodes

```txt
Remove Background
  video: VideoSet (1)
  correctionMask?: MatteSet (1)
  quality: preview | final

  foreground: VideoSet
  matte: MatteSet

Replace Background
  foreground: VideoSet (1)
  matte: MatteSet (1)
  background: ImageSet (1) | VideoSet (1)

  output: VideoSet
```

`MatteSet` should be introduced only when the feature is approved. It represents
a grayscale or alpha-bearing technical artifact and must not masquerade as an
ordinary user image.

```ts
type MatteArtifact = {
  assetId: string;
  mediaType: "image" | "video";
  semanticType: "alpha-matte";
  sourceAssetId: string;
  frameCount?: number;
};
```

## Execution and Storage

- Validate codec, duration, dimensions, and frame count before admission.
- Snapshot exact source/background/correction Asset revisions.
- Run extraction through Trigger.dev and record model/checkpoint version.
- Keep foreground and matte as separate outputs; a composite is another Asset.
- Use lossless or alpha-capable formats for the matte path.
- Do not expose temporary masks or frames through public URLs.
- Preserve provenance so replacing a background does not obscure the source.
- Allow retry from the last durable stage when the provider permits it.

## UX Recommendation

The node should start with a preview-quality run over a short range or reduced
resolution. A detail view should show:

- original;
- cutout over checkerboard;
- matte view;
- composite preview;
- edge/refinement warnings.

Manual frame-by-frame roto is outside TaleLabs' initial scope. A future
correction mode can accept a painted first-frame mask and a few positive or
negative points.

## Evaluation Gate

Test hair, glass, motion blur, fast movement, partial occlusion, low contrast,
camera cuts, and multiple people. Measure matte stability and edge chatter, not
only single-frame segmentation quality.

## Sources

### Primary

- [Bria video background removal API](https://fal.ai/models/bria/video/background-removal/api)
- [MatAnyone repository](https://github.com/pq-yang/MatAnyone)
- [MatAnyone paper](https://arxiv.org/abs/2501.14677)

### Community Signals

- [Clean cutouts and edge cleanup](https://www.reddit.com/r/VideoEditing/comments/1q0mkv1/how_to_get_such_clean_remove_background_video/)
- [Transparent export demand](https://www.reddit.com/r/VideoEditing/comments/1lvo312/background_removal_without_green_screen/)
- [Hair and manual-control expectations](https://www.reddit.com/r/editing/comments/1ufbf9x/what_app_can_remove_background_from_video_without/)
- [High-volume API workflow](https://www.reddit.com/r/VideoEditing/comments/126xbva/automatic_background_removal_better_than_unscreen/)
