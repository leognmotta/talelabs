# Audio Provider Strategy: OpenRouter and ElevenLabs

**Status:** fal execution implemented; direct ElevenLabs remains exploratory
**Last researched:** 2026-07-20

## Product Conclusion

OpenRouter does not currently expose ElevenLabs models. On 2026-07-20, fal's
official model API returned eleven active ElevenLabs endpoints. Seven fit the
approved TaleLabs audio intents and are now exact checked-in fal bindings:

| TaleLabs node | Canonical model | fal endpoint | Exposed safe controls |
| --- | --- | --- | --- |
| Speech | `elevenlabs/eleven-v3` | `fal-ai/elevenlabs/tts/eleven-v3` | voice, stability |
| Speech | `elevenlabs/multilingual-v2` | `fal-ai/elevenlabs/tts/multilingual-v2` | voice, stability, speed 0.7–1.2 |
| Speech | `elevenlabs/turbo-v2.5` | `fal-ai/elevenlabs/tts/turbo-v2.5` | voice, stability, speed 0.7–1.2 |
| Music | `elevenlabs/music` | `fal-ai/elevenlabs/music` | auto or 3–600 second duration, instrumental |
| Sound Effect | `elevenlabs/sound-effects-v2` | `fal-ai/elevenlabs/sound-effects/v2` | auto or 0.5–22 second duration, loop, prompt influence |
| Voice Changer | `elevenlabs/voice-changer` | `fal-ai/elevenlabs/voice-changer` | target voice, background-noise removal |
| Voice Isolation | `elevenlabs/audio-isolation` | `fal-ai/elevenlabs/audio-isolation` | no creative settings |

The four other active fal endpoints remain excluded: both speech-to-text routes
emit transcription rather than an Asset, text-to-dialogue requires a structured
dialogue array and speaker contract, and dubbing is a separate translation and
video-output product intent. fal now provides the managed and local-BYOK path
for the seven implemented models, so they require no direct ElevenLabs key.

The 2026-07-15 OpenRouter review remains relevant for non-ElevenLabs speech and
music routes. Documentation examples are not sufficient evidence that a model
remains available. Live discovery is research evidence only; TaleLabs' reviewed
JSON catalog remains the runtime source of truth.

## Direct Answer: Is an ElevenLabs Subscription Required?

An ElevenLabs account is required to create an API key, but a paid monthly
subscription is not required merely to create that key or make basic API calls.
ElevenLabs states that its API is included in every plan, including Free. API
requests consume the account's credits in the same way as generations in the
website.

The practical distinction is:

| Need | Account requirement |
| --- | --- |
| Create a user API key | Sign up; the account starts on Free |
| Test basic TTS within the free quota | Free account and API key |
| Continue after included quota | PAYG top-up or paid subscription |
| Use gated APIs such as Music and Sound Effects | PAYG or an eligible paid subscription; verify the endpoint entitlement on the account |
| Commercial use | Paid-plan rights are required; Free outputs are documented as non-commercial with attribution |
| Production backend/service-account key | Multi-seat/service-account capability or a carefully managed user key initially |

ElevenLabs' newer PAYG option is available to Free accounts and is explicitly
intended to unlock APIs that may otherwise be disabled, including Music and
Sound Effects. It requires a payment method and a prepaid balance, currently
with a minimum top-up of USD 5. ElevenLabs' Music documentation also says its
API is available to paid users. For TaleLabs, PAYG should therefore be treated
as paid access, but endpoint entitlement must still be checked before coding a
route.

For a commercial TaleLabs launch, do not depend on Free-plan licensing or
quotas. Use PAYG or a suitable paid plan and record the applicable provider
terms in generation provenance.

## API Key Setup

ElevenLabs API requests authenticate with an `xi-api-key` header. The key is a
secret and belongs only in server/worker configuration. It must never be sent to
the dashboard, embedded in a Flow snapshot, written to logs, or exposed through
the public generation registry.

The implemented fal routes use the existing `FAL_API_KEY` for managed execution
or the browser-stored fal key for local BYOK. They do not add an ElevenLabs
secret. If a future direct integration is approved, the appropriate secret is:

```txt
ELEVENLABS_API_KEY
```

This complies with TaleLabs' environment-variable policy because it is a
sensitive credential. Do not add this variable until the direct ElevenLabs
adapter is actually implemented.

Recommended initial setup:

1. create an ElevenLabs account;
2. open **Developers -> API Keys**;
3. create a restricted user API key;
4. enable only the endpoints TaleLabs is implementing;
5. set a conservative credit quota on the key;
6. keep the key in API/Trigger.dev secrets only;
7. rotate it before production if it was used during local development.

ElevenLabs also supports IP allowlisting and service-account keys. Service
accounts are a better production ownership model but require a workspace setup
that supports them. A user key is acceptable for an early controlled test if it
is scoped, quota-limited, and rotated.

## Current OpenRouter Coverage

The following matrix reflects OpenRouter's live catalog and official API
documentation on the research date.

| TaleLabs node | OpenRouter coverage | Recommended first route | Decision |
| --- | --- | --- | --- |
| Speech Generation | Strong | `google/gemini-3.1-flash-tts-preview` through `/api/v1/audio/speech` | Keep and test |
| Music Generation | Strong | `google/lyria-3-clip-preview`; add `google/lyria-3-pro-preview` later | Implement through OpenRouter |
| Sound Effect Generation | No dedicated model confirmed | None | Defer or integrate ElevenLabs directly |
| Voice Changer | No dedicated speech-to-speech conversion contract confirmed | None | Direct provider later |
| Voice Isolation | No dedicated source-separation/isolation contract confirmed | None | Direct provider later |

OpenRouter additionally exposes transcription and conversational audio models.
Those are separate product intents. Speech-to-text does not satisfy voice
isolation, and a model that accepts and emits audio is not automatically a
reliable voice changer.

### Live OpenRouter Speech Models

The OpenRouter Models API returned these `speech` output models on 2026-07-15:

```txt
microsoft/mai-voice-2
x-ai/grok-voice-tts-1.0
google/gemini-3.1-flash-tts-preview
zyphra/zonos-v0.1-transformer
zyphra/zonos-v0.1-hybrid
canopylabs/orpheus-3b-0.1-ft
sesame/csm-1b
hexgrad/kokoro-82m
mistralai/voxtral-mini-tts-2603
```

The list is research evidence, not runtime configuration. TaleLabs should add a
model only after reviewing its voices, languages, formats, limits, settings,
cost semantics, and endpoint behavior, then encode the decision in the
TypeScript model and provider-route registries.

### OpenRouter Speech Contract

OpenRouter's dedicated endpoint is:

```txt
POST /api/v1/audio/speech
```

Its normalized request includes:

```ts
type OpenRouterSpeechRequest = {
  model: string;
  input: string;
  voice: string;
  response_format?: "mp3" | "pcm";
  speed?: number;
  provider?: {
    options?: Record<string, unknown>;
  };
};
```

The response is raw audio bytes, not JSON. Available voices, speed support,
provider options, languages, and formats are model-specific. The public
TaleLabs contract must expose only settings guaranteed by the selected model's
reviewed route.

### OpenRouter Music Contract

OpenRouter currently lists:

| Model | Input | Output | Current listed price |
| --- | --- | --- | --- |
| `google/lyria-3-clip-preview` | text and optional image | 30-second music clip | USD 0.04 per clip |
| `google/lyria-3-pro-preview` | text and optional image | full structured song | USD 0.08 per song |

Lyria is materially different from TTS. It needs a Music Generation operation
and adapter profile rather than being added to the speech adapter. The first
TaleLabs route should use Clip for low-cost product validation. Pro should be
added only after the output response, duration behavior, lyrics controls,
licensing, and cost records have been verified with a paid smoke run.

## Direct ElevenLabs Coverage

ElevenLabs directly exposes the remaining approved TaleLabs audio intents.

| TaleLabs node | Direct endpoint | Key request concepts | Current public price indicator |
| --- | --- | --- | --- |
| Speech Generation | `POST /v1/text-to-speech/:voice_id` | text, model, voice settings, format, streaming | Flash/Turbo about USD 0.05 per 1K characters; Multilingual/v3 about USD 0.10 |
| Music Generation | `POST /v1/music` | prompt or composition plan, 3s-600s, model, seed, instrumental | USD 0.15 per generated minute |
| Sound Effect Generation | `POST /v1/sound-generation` | prompt, 0.5s-30s, loop, prompt influence | USD 0.12 per generated minute |
| Voice Changer | `POST /v1/speech-to-speech/:voice_id` | source audio, target voice, conversion model, voice settings | USD 0.12 per input minute |
| Voice Isolation | `POST /v1/audio-isolation` | source audio/video file and format | USD 0.12 per input minute |

Prices are provider list indicators, exclude taxes, and can change. TaleLabs'
pricing engine must use reviewed code-owned route costs and persist actual
provider costs when returned. This document must never be imported as runtime
configuration.

### ElevenLabs-Specific Product Advantages

Direct ElevenLabs access adds capabilities not currently represented by
OpenRouter's standard TTS contract:

- provider voice library and user-owned voice IDs;
- speech-to-speech performance transfer;
- explicit noise/isolation processing;
- prompted and loopable sound effects;
- long-form music and composition plans;
- streaming for TTS, Voice Changer, and Audio Isolation;
- provider request, trace, credit-cost, and song identifiers.

These features also create provider-specific product work. TaleLabs must model
voice ownership, consent, allowed use, provider voice mappings, output formats,
commercial rights, and revocation before exposing cloning or user-created
voices.

## Recommended TaleLabs Delivery Sequence

### Phase A: Complete Audio Through OpenRouter

1. Keep the existing Speech Generation node and Gemini TTS route.
2. Run one controlled paid speech smoke test.
3. Add Lyria 3 Clip to Music Generation.
4. Verify text-to-music first; add image guidance only after its exact payload
   and output contract are proven.
5. Add Lyria 3 Pro only after Clip is stable and users need complete songs.
6. Keep Sound Effect, Voice Changer, and Voice Isolation unavailable rather than
   attaching semantically incorrect models.

This phase uses the existing `OPENROUTER_API_KEY` and does not require an
ElevenLabs account.

### Phase B: Direct ElevenLabs Adapter

Add direct ElevenLabs only when at least one of these is a validated user need:

- short sound effects and ambience;
- performance-preserving voice conversion;
- dialogue isolation and cleanup;
- ElevenLabs voices unavailable through OpenRouter;
- composition plans or longer iterative music.

Start with Sound Effect Generation because it has a compact contract and is
directly useful for generated video. Then evaluate Voice Isolation. Voice
Changer comes later because it needs target-voice identity, permissions, and
consent safeguards.

### Phase C: Voice Identity and Advanced Music

Defer these until the first commercial audio loop works:

- voice cloning and voice marketplace access;
- reusable TaleLabs Voice resources;
- music composition-plan editing;
- section regeneration and inpainting;
- stem separation;
- video-to-music;
- direct ElevenLabs dubbing.

## Runtime Architecture

Do not build one universal audio provider adapter. Keep the five approved audio
nodes as distinct intents while reusing shared transport and output utilities.

```txt
Speech Generation
  -> openrouter-speech-v1
  -> future elevenlabs-tts-v1

Music Generation
  -> openrouter-music-v1
  -> future elevenlabs-music-v1

Sound Effect Generation
  -> future elevenlabs-sound-effect-v1

Voice Changer
  -> future elevenlabs-voice-changer-v1

Voice Isolation
  -> future elevenlabs-voice-isolation-v1
```

The direct adapters may share:

- authenticated ElevenLabs HTTP transport;
- retry/error normalization;
- raw and streamed byte handling;
- cost/request/trace header capture;
- MIME and output-size validation;
- R2 staging and canonical Asset finalization;
- redacted structured logging.

They must not share one request schema because each operation has different
inputs, settings, pricing units, safety concerns, and response behavior.

## Execution and Asset Contract

All audio providers must continue through the existing durable TaleLabs engine:

```txt
immutable Flow snapshot
  -> generation job
  -> pinned provider route
  -> Trigger.dev execution
  -> provider bytes or stream
  -> validated staged R2 object
  -> canonical audio Asset
  -> persisted provenance and actual cost
  -> canvas output projection
```

Required provenance includes:

- stable TaleLabs model ID and operation;
- provider, native model, route, and adapter versions;
- input text and exact source Asset IDs through the immutable snapshot;
- target voice identifier where applicable;
- duration, format, sample rate, and channel metadata;
- provider request/generation/song ID when available;
- provider cost and pricing unit;
- licensing/terms version or provider-policy reference;
- generated output checksum and canonical Asset ID.

Do not store the API key, raw authorization headers, signed URLs, or unrestricted
provider responses in snapshots or provenance.

## Failure and Retry Behavior

Most direct ElevenLabs conversion endpoints return bytes or streams. A provider
success followed by R2 or Asset failure must resume from TaleLabs' durable
provider-result checkpoint and must not repeat the paid request.

The adapter must distinguish:

- authentication or insufficient-plan errors;
- exhausted credits or PAYG balance;
- unsupported voice/model/format combinations;
- invalid or oversized source audio;
- moderation, consent, or voice-access rejection;
- provider throttling and transient errors;
- successful provider bytes followed by internal storage failure.

Only transient failures before a provider-success checkpoint may automatically
retry the paid call. Every response must be size- and MIME-validated before it
becomes a canonical Asset.

## Security, Licensing, and Abuse

1. Keep ElevenLabs keys restricted, quota-limited, and server-only.
2. Never let a client choose an arbitrary native provider endpoint or model ID.
3. Treat source voice recordings as private Assets.
4. Require consent and ownership controls before voice cloning or conversion of
   a reusable identity.
5. Retain an audit trail for target voice, source Asset, organization, and run.
6. Do not present Free-plan outputs as commercially licensed.
7. Record provider terms for music and voice outputs so future exports can show
   their provenance.
8. Rate-limit expensive audio operations by organization through the shared API
   and run-admission policies.

## QA Before Enabling a Route

For each model/operation, verify:

- endpoint availability with the intended account tier;
- one real low-cost request using production adapter code;
- voice IDs and language compatibility;
- input length, duration, and file-size limits;
- every exposed setting actually affects the provider request;
- returned format, MIME, sample rate, channels, duration, and checksum;
- actual cost capture;
- cancellation semantics and timeout behavior;
- no duplicate paid call after storage or ingestion failure;
- output restoration after canvas reload;
- tenant isolation and public/private output policy;
- commercial-use terms for the account tier.

## Decisions for TaleLabs

### Approved Direction

- Do not assume OpenRouter currently routes ElevenLabs.
- Keep Sound Effect, Voice Changer, and Voice Isolation as separate nodes.
- Execute the seven compatible ElevenLabs audio models through exact fal queue
  bindings for both managed and browser BYOK runtimes.
- Keep the four structurally incompatible fal endpoints out of the catalog.
- Do not add a direct ElevenLabs credential while fal covers the approved
  surface.
- Keep creative models and private provider bindings code-owned in the reviewed
  JSON catalog.

### Explicit Non-Goals of This Research

- no direct ElevenLabs adapter is approved by this document;
- no new environment variable should be added yet;
- no voice cloning or reusable Voice resource is approved;
- no billing or credit enforcement is introduced;
- no provider inventory JSON or live runtime discovery is introduced;
- no audio node should silently change intent based on model selection.

## Open Questions

1. Does the first TaleLabs audience value sound effects more than long-form
   music?
2. Which curated voices can TaleLabs legally expose without implementing a full
   voice-resource system?
3. Which commercial rights and attribution must be surfaced during export?
4. After paid QA, which additional fal-supported audio formats and MIME types
   should become product capabilities?

## Sources

### fal

- [fal ElevenLabs model collection](https://fal.ai/elevenlabs)
- [fal model-search API](https://fal.ai/docs/platform-apis/v1/models)
- [fal Eleven v3 API](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/api)
- [fal Multilingual v2 API](https://fal.ai/models/fal-ai/elevenlabs/tts/multilingual-v2/api)
- [fal Turbo v2.5 API](https://fal.ai/models/fal-ai/elevenlabs/tts/turbo-v2.5/api)
- [fal ElevenLabs Music API](https://fal.ai/models/fal-ai/elevenlabs/music/api)
- [fal Sound Effects v2 API](https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2/api)
- [fal Voice Changer API](https://fal.ai/models/fal-ai/elevenlabs/voice-changer/api)
- [fal Audio Isolation API](https://fal.ai/models/fal-ai/elevenlabs/audio-isolation/api)

### OpenRouter

- [OpenRouter Text-to-Speech guide](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [OpenRouter Create Speech API](https://openrouter.ai/docs/api/api-reference/speech/create-audio-speech)
- [OpenRouter live speech-model query](https://openrouter.ai/api/v1/models?output_modalities=speech)
- [OpenRouter live model catalog](https://openrouter.ai/api/v1/models)
- [OpenRouter audio input/output guide](https://openrouter.ai/docs/guides/overview/multimodal/audio)
- [OpenRouter audio model collection](https://openrouter.ai/collections/audio-models)
- [Lyria 3 Clip Preview](https://openrouter.ai/google/lyria-3-clip-preview)
- [Lyria 3 Pro Preview](https://openrouter.ai/google/lyria-3-pro-preview)
- [OpenRouter transcription API](https://openrouter.ai/docs/api/api-reference/transcriptions/create-audio-transcriptions)

### ElevenLabs

- [ElevenLabs API pricing](https://elevenlabs.io/pricing/api?price.platform=api)
- [ElevenLabs API authentication](https://elevenlabs.io/docs/api-reference/authentication)
- [ElevenLabs API key administration](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys)
- [ElevenLabs API availability on Free](https://help.elevenlabs.io/hc/en-us/articles/28184926326033-How-much-does-it-cost-to-use-the-API)
- [ElevenLabs PAYG](https://elevenlabs.io/docs/overview/administration/pay-as-you-go)
- [ElevenLabs billing and commercial rights](https://elevenlabs.io/docs/overview/administration/billing)
- [ElevenLabs Text-to-Speech](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [ElevenLabs Music API](https://elevenlabs.io/docs/api-reference/music/compose)
- [ElevenLabs Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)
- [ElevenLabs Voice Changer API](https://elevenlabs.io/docs/api-reference/speech-to-speech/convert)
- [ElevenLabs Audio Isolation API](https://elevenlabs.io/docs/api-reference/audio-isolation/convert)
- [ElevenLabs streaming API](https://elevenlabs.io/docs/api-reference/streaming)
