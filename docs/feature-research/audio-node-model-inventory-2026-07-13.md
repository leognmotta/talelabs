# Audio Node Model Inventory — 2026-07-13

**Status:** reviewed canvas-infrastructure evidence, not execution approval
**Reviewed:** 2026-07-13

This document records the evidence used to curate the first five audio-intent
node contracts. It does not add provider execution, billing, or run-engine
scope. The checked-in registry remains authoritative; discovery never edits the
product catalog at runtime.

## Product boundary

Audio is one output media family, not one user intent. The reviewed canvas
contract therefore exposes Speech, Music, Sound Effect, Voice Changer, and
Voice Isolation as separate nodes. Every successful invocation will eventually
produce one `AudioSet` item through the stable `audio` handle, but each node has
its own inputs, settings, validation, and provider request shape.

The authoritative discriminator is `operation.nodeType`. Model pickers filter
operations by this field rather than by `mediaType`. This lets one product model
support more than one compatible intent without appearing in unrelated pickers.
Stable Audio 2.5 is the initial proof: separately tagged operations make it
eligible for Music and Sound Effect, but not Speech.

## Enabled canvas contracts

| Node | TaleLabs model | Inputs | Reviewed controls | Private route family |
|---|---|---|---|---|
| Speech | Eleven Multilingual v2 | Script (`prompt`) | stable voice option, speed, MP3/WAV | ElevenLabs TTS |
| Speech | GPT-4o mini TTS | Script (`prompt`) | stable voice option, speed, delivery, MP3/WAV | direct OpenAI Speech |
| Music | Eleven Music v2 | Prompt | auto/custom duration, instrumental, MP3/WAV | ElevenLabs Music |
| Music | Stable Audio 2.5 | Prompt | auto/custom duration, seed, MP3/WAV | Stability Audio |
| Sound Effect | Eleven Sound Effects v2 | Prompt | auto/custom duration, loop, prompt influence, MP3/WAV | ElevenLabs Sound Effects |
| Sound Effect | Stable Audio 2.5 | Prompt | auto/custom duration, seed, prompt influence, MP3/WAV | Stability Audio |
| Voice Changer | Eleven Voice Changer | exactly one AudioSet or VideoSet source | stable target voice, background-noise removal, MP3/WAV | ElevenLabs speech-to-speech |
| Voice Isolation | Eleven Voice Isolator | exactly one AudioSet or VideoSet source | no creative settings | ElevenLabs Audio Isolation |

Provider-native model IDs, endpoint paths, voice IDs, and value mappings live
only in `apps/api/src/routes/config/generation-provider-routes.ts`. The public
contract contains stable TaleLabs IDs and stable voice option IDs.

No enabled route currently has sufficient evidence for a separate lyrics input
or image-guidance input, so those handles are absent. Voice Isolation is speech
cleanup, not vocal/music stem separation. Voice cloning, custom voices,
consent workflows, transcription, translation, dubbing, remixing, and a DAW are
outside this contract.

## OpenRouter discovery

The read-only query
`GET https://openrouter.ai/api/v1/models?output_modalities=speech` returned nine
speech-output models on 2026-07-13. This was research input only; TaleLabs does
not preserve provider discovery payloads as runtime or validation configuration.

All nine remain inventory-only. OpenRouter documents a dedicated
`/api/v1/audio/speech` endpoint, whereas generic audio input/output uses the chat
API and does not imply TTS eligibility. The dedicated endpoint also notes that
voice choices and speed support vary by model. TaleLabs therefore does not
derive a safe public union from discovery results. The first Speech picker uses
two narrower direct-provider routes with explicit, privately mapped controls.

Primary OpenRouter evidence:

- <https://openrouter.ai/docs/guides/overview/multimodal/tts>
- <https://openrouter.ai/docs/api/api-reference/speech/create-audio-speech>
- <https://openrouter.ai/docs/guides/overview/multimodal/audio>
- <https://openrouter.ai/docs/api/api-reference/models/get-models>

## Direct-provider evidence

The private route review uses these primary sources:

- OpenAI Speech API:
  <https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create>
- ElevenLabs TTS:
  <https://elevenlabs.io/docs/api-reference/text-to-speech/convert>
- ElevenLabs Music:
  <https://elevenlabs.io/docs/api-reference/music/compose>
- ElevenLabs Sound Effects:
  <https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert>
- ElevenLabs Voice Changer:
  <https://elevenlabs.io/docs/api-reference/speech-to-speech/convert>
- ElevenLabs Audio Isolation:
  <https://elevenlabs.io/docs/api-reference/audio-isolation/convert>
- Stability Audio API:
  <https://platform.stability.ai/docs/api-reference>

Google Lyria, Cartesia Voice Changer, Resemble speech products, Adobe audio
creation experiences, and NVIDIA Maxine remain research candidates. They are
not enabled because their reviewed evidence was unnecessary for the deliberately
small first catalog or did not yet justify an additional safe contract.

## Review policy

The current private audio routes are pinned to route version `2026-07-13.9` and
contract version `2026-07-13.8`. Public capabilities and private provider routes
are maintained only in their respective TypeScript registries. The server-only
provider-route registry validates its model and operation coverage when the API
configuration is loaded, without making network or generation requests.

Any future model or capability change requires primary-source research, a new
immutable registry version when creative capabilities change, private route
review, deterministic scenarios, and normal deployment. Live discovery and
checked-in discovery payloads must never become production configuration.
