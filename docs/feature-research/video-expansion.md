# Video Expansion: Extend, Reframe, and Outpaint

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

“Expand video” describes two different jobs and TaleLabs must not collapse them
into one ambiguous node:

1. **Temporal extension** generates frames before or after an existing clip.
2. **Spatial expansion** changes framing or aspect ratio by tracking/reframing
   the subject and, when necessary, generating pixels outside the source frame.

They may share a feature page and provider adapter family, but they need
separate node contracts and capability rules.

## User Problems

- a shot ends too early for an edit or transition;
- a generated action needs a few additional seconds;
- a horizontal campaign needs vertical and square variants;
- simple crop-based auto-reframe cuts off the subject or product;
- letterboxing is unacceptable, but generative borders must match motion;
- creators need platform variants without regenerating the central performance.

## Competitor Behavior and Limits

Adobe Premiere's Generative Extend adds media directly at an edit boundary and
creates new media without changing the source. Current documentation describes
short extensions and important limitations such as muted dialogue in generated
video. Google Veo extension works only with qualifying Veo-generated clips and
adds fixed increments with provider-specific resolution and retention rules.

Auto-reframe products generally track a subject and crop. Generative reframe
goes further by synthesizing missing areas. The latter is more expensive and
can introduce edge discontinuity or identity drift.

## Proposed Nodes

```txt
Extend Video
  video: VideoSet (1)
  direction: before | after
  durationSeconds: provider-constrained
  prompt?: Text

  output: VideoSet

Reframe Video
  video: VideoSet (1)
  targetAspectRatio: 9:16 | 1:1 | 4:5 | 16:9 | custom
  strategy: crop-track | generative-expand
  focus?: Point/Box metadata or Text

  output: VideoSet
```

The model registry must express constraints such as source provenance,
resolution, duration increments, audio behavior, and maximum chained extends.

```ts
type VideoExtensionCapabilities = {
  allowedSource: "any" | "provider-generated";
  directions: ReadonlyArray<"before" | "after">;
  duration:
    | { mode: "fixed"; seconds: number }
    | { mode: "range"; min: number; max: number };
  preservesAudio: boolean;
  maxChainCount?: number;
  sourceResolution?: ReadonlyArray<string>;
};
```

## Runtime Behavior

- Inspect and lock the source Asset before run admission.
- Persist the actual provider/source generation ID when extension depends on it.
- Never concatenate silently. The raw extension and an optional joined edit are
  separate Assets with separate provenance.
- For reframe, persist the target crop/expansion policy and focus metadata.
- Normalize audio behavior explicitly; do not imply dialogue continuation when
  the engine cannot produce it.
- Validate chain count and provider retention before accepting a run.
- Use Trigger.dev because both operations are asynchronous and expensive.

## UX

Temporal extension should be initiated from a video node or Asset action, with
a visible seam preview and a choice to keep only the extension or produce a
joined clip.

Reframe should show the source frame inside the target aspect ratio. Default to
crop-and-track when it preserves the content; offer generative expansion only
when required. A user-set focus point is more dependable than prompt-only
framing.

## Evaluation

- seam continuity, motion, and subject identity;
- whether camera direction and lighting continue naturally;
- audio discontinuity and lip-sync behavior;
- crop tracking across cuts and multiple subjects;
- border flicker in generative reframe;
- product/logo deformation at expanded edges;
- cost versus regenerating the shot.

## Sources

### Primary

- [Adobe Premiere Generative Extend overview](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-with-generative-ai/generative-extend-overview.html)
- [Adobe Generative Extend FAQ and limits](https://helpx.adobe.com/in/premiere/desktop/edit-projects/edit-with-generative-ai/generative-extend-faq.html)
- [Google Veo extension documentation](https://ai.google.dev/gemini-api/docs/veo?hl=en)
- [Adobe Generative Media Tool](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-with-generative-ai/generative-media-tool-faq.html)

### Community Signals

- [Horizontal-to-vertical uncrop problems](https://www.reddit.com/r/VideoEditing/comments/18ky5ln/)
- [Auto-reframe workflow discussion](https://www.reddit.com/r/VideoEditing/comments/1ndo1sq/)
- [Social workflow combining cuts, captions, and reframe](https://www.reddit.com/r/AIToolTesting/comments/1shdyxh/what_does_everyones_2026_social_video_workflow/)
