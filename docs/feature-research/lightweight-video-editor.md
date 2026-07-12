# Lightweight Video Editing and Export

**Status:** exploratory research, deliberately post-core-loop  
**Last researched:** 2026-07-12

## Product Conclusion

TaleLabs does not need to compete with Premiere, Resolve, or After Effects. A
lightweight editor can close the loop for simple ads and social videos by
assembling generated clips, audio, captions, and basic transitions. Professional
users must still be able to export Assets to their established NLE/VFX pipeline.

The initial boundary should be `Cut`, not “Studio”: one primary video track,
basic audio tracks, captions, trim/split/reorder, aspect ratio, and render.

## User Workflows

- combine several 5–15 second generations into one piece;
- trim failed frames and reorder accepted shots;
- add narration, music, sound effects, and captions;
- make vertical, square, and horizontal deliveries;
- preview a rough cut without downloading every Asset;
- export MP4 plus source Assets for professional finishing.

Community discussions confirm that creators still finish AI media in CapCut,
Premiere, Resolve, or After Effects. The recurring pain is moving many tiny clips
between generation, captions, audio, editing, and export—not a lack of advanced
color or compositing controls inside the generator.

## Competitor Patterns

Runway exposes a simple Studio/editor alongside generation. Adobe Firefly places
generated audio and video into a browser timeline. Descript uses transcript
editing for talking-head and podcast workflows. Professional tools continue to
own frame-accurate editing, color, sound, VFX, and delivery.

## Recommended V1 Scope

```txt
Timeline
  one primary video track
  two or more audio tracks
  one caption track
  clip trim, split, reorder, delete
  audio gain and fade
  simple crossfade/dissolve
  16:9, 9:16, 1:1, 4:5 canvas
  preview proxy
  MP4 export
```

Explicit non-goals: multicam, color grading, keyframe animation, masks, motion
graphics, advanced compositing, plugin hosting, and professional interchange in
the first version.

## Data and Render Model

```ts
type CutDocument = {
  canvas: { width: number; height: number; fps: number };
  durationMs: number;
  tracks: Array<{
    id: string;
    kind: "video" | "audio" | "captions";
    clips: Array<{
      id: string;
      assetId: string;
      timelineStartMs: number;
      sourceStartMs: number;
      sourceEndMs: number;
      gain?: number;
    }>;
  }>;
};
```

Edits are non-destructive references to immutable Assets. A render run snapshots
the complete document and exact Asset revisions. The final render becomes a new
canonical Asset.

## Architecture

- Use browser media elements/canvas only for preview and interaction.
- Create low-resolution proxies where necessary; do not load dozens of original
  4K videos into the browser.
- Perform final rendering in a durable Trigger.dev FFmpeg task.
- Validate codec, dimensions, duration, and signed-URL lifetime before render.
- Copy inputs into run-scoped storage or mint URLs that outlive the task safely.
- Record FFmpeg/build version and render settings.
- Export original Assets separately; never trap the user in the editor.

## Relationship to Flows

A Flow creates and transforms Assets. A Cut arranges accepted Assets over time.
The editor may invoke a Flow for a selected clip, but it should not store the
Flow graph inside the timeline. Likewise, an `Assemble Clips` Flow node can
produce a simple video without replacing the interactive editor.

## Evaluation

- preview/final render parity;
- frame and audio sync;
- trim accuracy and transition boundaries;
- caption timing and safe-area rendering;
- proxy performance on low-memory browsers;
- cancellation, retry, and large-file behavior;
- export compatibility with common players and NLEs.

## Sources

### Primary

- [Adobe Firefly workspace and timeline capabilities](https://helpx.adobe.com/uk/firefly/web/get-started/access-the-app/firefly-workspace-overview.html)
- [Adobe Firefly generated sound effects in the editor](https://helpx.adobe.com/ca/firefly/web/firefly-video-editor/generate-audio/generate-sound-effects.html)
- [Descript edit-like-a-document workflow](https://help.descript.com/hc/en-us/articles/15726742913933-Edit-like-a-doc)
- [Adobe Premiere text-based editing](https://helpx.adobe.com/premiere/desktop/edit-projects/edit-video-using-text-based-editing/overview-of-text-based-editing.html)
- [Adobe Premiere export settings](https://helpx.adobe.com/my_en/premiere/desktop/render-and-export/export-files/overview-of-export-settings.html)

### Community Signals

- [Creators seeking simple assembly of AI clips](https://www.reddit.com/r/PromptEngineering/comments/1s4wr0h/help_looking_for_aiassisted_video_editor/)
- [All-in-one workflow fragmentation](https://www.reddit.com/r/ContentCreators/comments/1unx9rk/is_there_an_all_in_one_ai_video_tool_in_2026/)
- [AI clips used inside conventional editing workflows](https://www.reddit.com/r/contentcreation/comments/1rkltot/has_ai_video_worked_into_anyones_regular_content/)
- [Professional edit workflows remain hybrid](https://www.reddit.com/r/editing/comments/1td336d/has_ai_actually_replaced_video_editing_workflows/)
