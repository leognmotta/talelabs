# Dubbing and Video Translation

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

Dubbing is a multi-stage localization workflow, not a single text-to-speech
call. TaleLabs should preserve transcript segments, speaker assignments,
translations, generated speech, timing adjustments, background audio, and the
final mix as reviewable artifacts.

The best first product is `Dub Media`: one source Asset, one target language per
runtime item, automatic speakers, editable transcript/translation, and separate
audio plus muxed-video outputs. Lip sync remains an optional downstream node.

## What Users Need

- translate a video while preserving each speaker's identity and emotion;
- keep speech within the original edit timing;
- correct names, terminology, and brand language before synthesis;
- retain music and ambience while replacing dialogue;
- generate several languages from one approved transcript;
- review and regenerate one bad segment without paying for the whole video;
- export dubbed audio separately for a professional timeline.

Community reports show that translation length is a core engineering problem:
the same sentence can become much longer or shorter across languages. A perfect
voice clone still fails if it races, lands on the wrong cut, or masks the
background mix. Long-form users want segment-level control rather than a black
box.

## Competitor Workflow

ElevenLabs exposes automatic dubbing, optional voice cloning, background-audio
handling, speaker workflows, editable Dubbing Studio projects, and rendered
audio/video. Adobe Firefly provides video and audio translation inside its
creative workspace. Specialist tools commonly combine transcription,
translation, TTS, time fitting, mixing, and optional lip sync.

## Domain Model

```txt
DubbingProject
  sourceAssetId
  sourceLanguage
  targetLanguage
  speakers[]
  segments[]
  backgroundAssetId?
  status

DubbingSegment
  startMs / endMs
  sourceText
  translatedText
  speakerId
  voiceId
  generatedAssetId?
  reviewStatus
```

These may begin as immutable run input/output metadata rather than first-class
database tables. If TaleLabs adds an interactive dubbing editor, normalized
segments and revisions become justified.

## Proposed Flow Contract

```txt
Dub Media
  media: VideoSet (1) | AudioSet (1)
  targetLanguage: Text/enum (1)
  glossary?: structured configuration
  voices?: Element context or voice mappings
  mode: automatic | review-first

  dubbedAudio: AudioSet
  dubbedVideo?: VideoSet
  transcript: TranscriptSet
```

For several languages, outer iteration creates one runtime item per language.
The node does not hide multiple independent billable jobs inside an ordinary
media collection.

```ts
type DubbingAdapterRequest = {
  source: ResolvedAsset;
  sourceLanguage?: string;
  targetLanguage: string;
  speakerVoices: Array<{ speakerKey: string; providerVoiceId: string }>;
  glossary: Record<string, string>;
  preserveBackgroundAudio: boolean;
};
```

## Provider Candidates

| Provider                     | Useful capability                                    | Caveat                                              |
| ---------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| ElevenLabs Dubbing           | managed transcription, translation, voices, mix      | long-form cost and black-box timing need evaluation |
| Adobe Firefly                | integrated audio/video translation UX                | verify API availability separately from product UI  |
| specialist dubbing providers | lip-aware localization and review tools              | evaluate contracts, languages, and API maturity     |
| composable pipeline          | TaleLabs-controlled STT + translation + TTS + FFmpeg | most control, highest orchestration complexity      |

## Execution and Review

- Run asynchronously through Trigger.dev and persist provider job IDs.
- Keep source, isolated dialogue/background, segment audio, final mix, and muxed
  video as explicit artifacts where the provider exposes them.
- Record model and voice IDs, language codes, glossary, transcript revision, and
  timing method in the immutable run snapshot/provenance.
- Support partial segment retry where possible.
- Validate target-language/voice compatibility before charging or dispatching.
- Never publish a clone or dub without required consent and disclosure policy.
- Keep lip sync downstream so users can accept audio-only localization.

## Evaluation

Evaluate names, numbers, brand terms, multiple speakers, overlapping speech,
background music, code switching, emotional delivery, and different language
lengths. Human native-speaker review is required for launch quality.

Track word error rate only for transcription. Dubbing quality also needs
translation accuracy, speaker similarity, naturalness, timing, mix quality, and
lip alignment where used.

## Sources

### Primary

- [ElevenLabs Dubbing API](https://elevenlabs.io/docs/api-reference/dubbing/create)
- [ElevenLabs dubbed media retrieval](https://elevenlabs.io/docs/api-reference/dubbing/audio/get)
- [ElevenLabs Dubbing overview](https://elevenlabs.io/docs/eleven-creative/products/dubbing)
- [ElevenLabs Dubbing Studio](https://elevenlabs.io/docs/eleven-creative/products/dubbing/dubbing-studio)
- [Adobe Firefly workspace overview](https://helpx.adobe.com/uk/firefly/web/get-started/access-the-app/firefly-workspace-overview.html)

### Community Signals

- [Translation length and time-fitting problems](https://www.reddit.com/r/SaaS/comments/1thgtna/shipping_ai_voice_cloning_vs_demoing_it_4_things/)
- [Long-form dubbing control and cost](https://www.reddit.com/r/n8n/comments/1rqkh3i/is_ai_dubbing_actually_a_thing_people_pay_for/)
- [Creator workflow fragmentation](https://www.reddit.com/r/AI_UGC_Marketing/comments/1t9nxhg/when_too_many_tools_are_required_for_voice_avatar/)
