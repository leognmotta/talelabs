# Music, Sound Effects, and Audio Generation

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

Music and sound effects solve different creative problems and must be distinct
node types. Sound effects are short, event- or ambience-oriented clips. Music
has structure, duration, licensing, and often iterative section/stem workflows.

TaleLabs should begin with text-to-sound-effects because its contract is small
and directly complements generated video. Full music generation should follow
only after licensing, duration, continuation, stems, and editing are understood.

## User Workflows

- create Foley, impacts, transitions, ambience, and loops for a video;
- describe a sound and control its duration or timing with a performance;
- score a generated sequence without searching stock libraries;
- generate multiple variations and choose one;
- extend or revise a musical section;
- retain stems for editing and mixing;
- document commercial usage rights with the resulting Asset.

Adobe's Firefly editor allows text prompts and voice timing for sound effects,
then adds generated variations to a timeline. ElevenLabs supports prompted
effects with duration, looping, and prompt influence and separates its Music
product for full compositions.

## Proposed Nodes

```txt
Generate Sound Effect
  prompt: Text (1)
  durationSeconds?: number
  loop: boolean
  timingGuide?: AudioSet (1)
  output: AudioSet

Generate Music
  prompt: Text (1)
  durationSeconds: number
  instrumental: boolean
  structure?: structured sections
  output: AudioSet
  stems?: AudioSet
```

Multiple alternatives are a collection from one invocation when the provider
returns them together. Repeating independent prompts or duration values belongs
to outer iteration.

```ts
type SoundEffectCapabilities = {
  durationSeconds: { min: number; max: number; optional: boolean };
  supportsLoop: boolean;
  supportsTimingGuide: boolean;
  outputFormats: string[];
  outputsPerInvocation: { min: number; max: number };
};
```

## Provider Candidates

| Provider                 | Feature                            | Current documented behavior                                   |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------- |
| ElevenLabs               | sound effects                      | prompted effects, duration, loop, influence, multiple formats |
| ElevenLabs Music         | full music and custom sound        | sections/iterations and API on eligible plans                 |
| Adobe Firefly            | sound effects/soundtrack in editor | text and voice-timed SFX inside creative timeline             |
| open-source audio models | self-host option                   | evaluate output quality, weights, and commercial license      |

## Execution and Asset Behavior

- Validate duration and output count against the model registry.
- Use Trigger.dev for nontrivial music and long audio jobs.
- Persist prompt, model, seed where available, duration, format, and license
  metadata in provenance.
- Store each variation as a canonical audio Asset.
- Store stems with semantic roles rather than opaque filenames.
- Preview with waveform and duration in Flow and Asset UI.
- Do not imply a generated track is cleared for every distribution channel;
  attach provider/license terms at generation time.

## UX

Sound effects should default to `Auto duration` and expose `Loop` as a toggle.
The result card should allow audition, favorite, attach to video, and regenerate.

Music needs a different experience: duration, instrumental/lyrics, mood, tempo,
section structure, and continuation. Avoid building a DAW in the first version;
export stems and let professional users continue externally.

## Evaluation

- prompt alignment and unwanted speech/music leakage;
- loop seam quality;
- timing and duration accuracy;
- clipping, noise, loudness, and sample rate;
- musical continuity across extension;
- rights metadata and provider policy stability;
- cost per generated second/minute.

## Sources

### Primary

- [ElevenLabs sound-effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- [ElevenLabs sound-effects overview](https://elevenlabs.io/docs/overview/capabilities/sound-effects)
- [ElevenLabs sound-effects product guide](https://elevenlabs.io/docs/eleven-creative/playground/sound-effects)
- [ElevenLabs Music overview](https://elevenlabs.io/docs/eleven-creative/products/music)
- [Adobe Firefly generated sound effects](https://helpx.adobe.com/ca/firefly/web/firefly-video-editor/generate-audio/generate-sound-effects.html)
- [Adobe Firefly workspace](https://helpx.adobe.com/uk/firefly/web/get-started/access-the-app/firefly-workspace-overview.html)

### Community Signals

- [Fragmentation across audio and video tools](https://www.reddit.com/r/AI_UGC_Marketing/comments/1t9nxhg/when_too_many_tools_are_required_for_voice_avatar/)
- [Current all-in-one AI video workflow pain](https://www.reddit.com/r/ContentCreators/comments/1unx9rk/is_there_an_all_in_one_ai_video_tool_in_2026/)
