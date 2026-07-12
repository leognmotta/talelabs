# Voice Cloning and Speech Generation

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

Speech generation should treat a voice as reusable, consented creative context,
not a stringly typed provider ID. A TaleLabs voice can eventually be represented
by an Element or a specialized voice resource that owns samples, consent status,
language coverage, provider mappings, and usage policy.

The first Flow feature can support library voices and user-owned instant clones.
Professional cloning, marketplaces, and public sharing should remain out of
scope until identity verification and abuse operations are mature.

## User Workflows

- generate narration, dialogue, ads, podcasts, and character speech;
- keep one voice consistent across many scenes and revisions;
- patch a sentence without re-recording a complete voiceover;
- vary pacing, emotion, pauses, and language;
- use one approved voice as input to lip sync or dubbing;
- export audio for an external editor.

Creators value segment regeneration and timing control more than one long
uneditable waveform. Community reports also identify robotic delivery,
inconsistent long-form cadence, and fragmented voice/avatar/caption workflows.

## Voice Lifecycle

```txt
sample Assets -> consent/ownership check -> provider clone or design
              -> reusable voice identity -> speech jobs -> Audio Assets
```

A voice identity should not expose provider credentials or raw provider IDs to
clients. TaleLabs resolves it through a server-side route.

```ts
type VoiceProfile = {
  id: string;
  name: string;
  ownership: "user" | "licensed-library" | "synthetic";
  consentStatus: "required" | "verified" | "revoked";
  supportedLocales: string[];
  providerRoutes: Array<{ provider: string; voiceId: string }>;
};
```

## Proposed Nodes

```txt
Generate Speech
  text: Text (1)
  voice: VoiceRef (1)
  locale?: Text/enum
  delivery?: structured settings
  durationTargetMs?: number

  audio: AudioSet

Transform Voice
  performance: AudioSet (1)
  voice: VoiceRef (1)
  audio: AudioSet
```

`VoiceRef` is preferable to treating an arbitrary AudioSet as a clone. It can
carry verified identity, language support, and provider routing while keeping
sample Assets private.

## Candidate Providers and Models

| Provider/model family                   | Strength                                 | Consideration                                           |
| --------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| ElevenLabs v3 / Multilingual v2 / Flash | expressive, multilingual, streaming      | model limits and price differ; voice policy is critical |
| ElevenLabs Voice Changer                | preserves source performance             | requires source performance Asset                       |
| Fish Audio API                          | TTS and instant/persistent cloning       | review provider policy and reliability                  |
| self-hosted open-source TTS             | control and possible lower marginal cost | GPU operations, license, safety, and quality burden     |

Provider capabilities are code-owned registry data: language list, maximum text
length, streaming support, formats, voice compatibility, and settings.

## Runtime and Storage

- Split long scripts into semantically stable segments but preserve the user's
  original text and order.
- Snapshot the resolved voice version and settings for every run.
- Store each accepted segment and an optional joined output as canonical Assets.
- Use lossless intermediates and avoid repeated lossy transcodes.
- Record character/credit cost and exact provider model.
- Support deterministic segment replacement in a later editor.
- Keep sample audio private and access-controlled.
- Revoke future use immediately when consent is withdrawn; historical outputs
  follow the applicable legal and contractual policy.

## Safety and Consent

Voice cloning has impersonation and fraud risk. Before launch, TaleLabs needs:

- explicit attestation and recorded consent;
- prohibited-person and high-risk-use policies;
- separate permissions for cloning and generating;
- audit logs and abuse reporting;
- disclosure guidance and provenance metadata;
- deletion/revocation behavior;
- restrictions on public/community sharing of cloned voices.

## Evaluation

Test pronunciation, names, numbers, locale/accent match, emotion, long-form
consistency, segment seams, latency, output formats, and duration fitting. Use
native speakers for multilingual evaluation.

## Sources

### Primary

- [ElevenLabs text-to-speech overview](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [ElevenLabs TTS model guide](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech)
- [ElevenLabs voice cloning overview](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning)
- [ElevenLabs professional cloning](https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning)
- [ElevenLabs voice changer](https://elevenlabs.io/docs/overview/capabilities/voice-changer)
- [Fish Audio official Python SDK](https://github.com/fishaudio/fish-audio-python)

### Community Signals

- [Voice clones as patch tools](https://www.reddit.com/r/ContentCreators/comments/1svibf8/i_stopped_recording_every_youtube_voiceover/)
- [Long-form voice workflow needs](https://www.reddit.com/r/aitubers/comments/1t2kbak/for_ai_youtube_channels_is_the_hard_part_voice/)
- [Fragmented avatar, voice, edit, and caption workflow](https://www.reddit.com/r/AI_UGC_Marketing/comments/1t9ezue/ai_ugc_tool_for_best_script_avatar_creation_voice/)
