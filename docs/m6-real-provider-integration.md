# Real Provider Integration

Status: static, non-paid verification complete; paid acceptance remains
user-owned (2026-07-20).

This milestone replaces only the normalized provider boundary. Admission,
immutable snapshots, graph planning, Trigger.dev orchestration, job and
provenance persistence, canonical Asset ingestion, run history, and output
presentation remain provider-independent.

## Executable surface

`packages/models-catalog` is the single current model and private binding
inventory. It assembles `catalog.json` and the explicit `models/<media>.json`
records into one validated catalog. `@talelabs/flows` consumes its
provider-neutral projection; admission selects and captures one complete binding
whose runtime and credential are currently available. The OpenRouter and fal
implementations inside `@talelabs/providers/server` execute managed work through
one registry. Reviewed bindings also reuse browser-compatible protocol behavior
from `@talelabs/providers/core` in the local BYOK driver.
Do not copy the current inventory into this document.

Current availability has one definition:

```txt
active catalog model operation
+ a compatible private binding for the selected runtime
+ a ready platform or browser credential
= executable operation
```

Catalog validation fails startup, generation checks, and production builds when
an active operation has a missing or incompatible binding. Admitted retries use
their self-contained snapshot rather than current catalog state.
There is no public `executionAvailable` flag or secondary model registry.
Admission walks reviewed bindings by priority and may choose a lower-priority
provider only when the preferred provider lacks a credential for that runtime.
Once captured, execution never reroutes, re-discovers, or falls back.

Managed availability is derived from whether the existing platform credential
for each policy-approved provider is actually configured in API/worker
composition. It is not inferred from catalog membership or an availability
flag. Seedance 2.0 prioritizes OpenRouter and uses its exact fal binding only
when OpenRouter is unavailable before admission.

All active OpenRouter models reuse one of four protocol adapters:

```txt
openrouter-image-v1
openrouter-video-v1
openrouter-speech-v1
openrouter-chat-v1
```

Reviewed fal models reuse one asynchronous adapter:

```txt
fal-queue-v1
```

Typed request profiles express protocol-level setting or input differences.
fal profiles map every accepted media slot to an exact provider field and
cardinality, including a reviewed media-specific field when one product slot
accepts audio or video. Declarative scalar, enum, conditional, scaled,
output-count, and combined-setting maps cover provider parameters without
model-specific adapter code; any unconsumed setting or Asset fails before
submission.
They do not create one adapter per model. A listed model that OpenRouter cannot
execute is excluded from the current catalog while its released historical
contract remains readable.

fal coverage is exact-model-only. An operation receives a binding only when the
current fal endpoint represents the same creative model and can honor the full
TaleLabs operation contract. Deprecated routes, substitutes, generic nested
routers, and endpoints that silently drop an accepted input or setting remain
unbound. The canonical Seedream 5.0 Lite and Seedream 5.0 Pro entries use this
same catalog/profile path for text generation and reference editing, including
ordered multi-output normalization.

The current ElevenLabs audio surface is executed only through exact fal
bindings; OpenRouter has no ElevenLabs binding. Speech includes Eleven v3,
Multilingual v2, and Turbo v2.5. The other audio intents use ElevenLabs Music,
Sound Effects v2, Voice Changer, and Audio Isolation. Capabilities follow each
fal wrapper's safe contract rather than the broader direct ElevenLabs API:
Voice Changer accepts an MP3 source, while Audio Isolation accepts one MP3 or
MP4 source and selects `audio_url` or `video_url` accordingly. Composition
plans, dialogue arrays, speech-to-text, and dubbing remain separate unimplemented
product contracts.

## Route and spend safety

Each new snapshot and job pins the canonical model ID and revision, catalog
version, operation, provider, protocol, native model, route version, exact API
endpoint, reviewed endpoint tag, request profile, adapter version, and lifecycle
contract. The worker asserts that relational job fields and immutable binding
agree before resolving any Asset or calling a provider.

Pinned OpenRouter requests send:

```json
{
  "provider": {
    "only": ["reviewed-endpoint-tag"],
    "allow_fallbacks": false
  }
}
```

Chat routes also require parameter support. Historical snapshots admitted
before endpoint-tag provenance remain readable, but newly admitted current
contracts fail closed when the tag is absent or differs from the route.
Pinned fal requests use the captured native queue endpoint ID and derive submit,
status, result, and cancel URLs from that immutable route plus fal's request ID.
Every fal inference submission also sends `x-app-fal-disable-fallback: true`, so
fal cannot silently execute an equivalent endpoint that disagrees with the
captured provenance.

Input Assets remain IDs in plans and snapshots. Immediately before request
materialization the worker rechecks organization ownership, expected media
type, readiness, and deletion state, then creates a short-lived signed read URL.
Provider-input URLs use a code-owned lifetime separate from presentation URLs.
They are minted immediately before submission and cover the full accepted
eight-hour asynchronous execution window plus one hour of provider-fetch and
clock-skew grace; the five-minute UI lifetime remains unchanged.
For every paid request the worker writes `providerSubmittedAt` before network
submission. Asynchronous external job IDs are persisted before the first
durable wait, and later Trigger attempts resume polling rather than repeating
submission. Complete provider results are staged in deterministic public output
storage with tenant-scoped checkpoint rows before Asset finalization. Retries
recover ready checkpoint outputs, inspect and promote atomically stored objects
left in `staging`, or reuse existing canonical outputs without repeating a paid
request. Active checkpoint rows retain ownership of their storage objects during
terminal cleanup. Only a crash inside the provider submission uncertainty
window fails closed instead of risking a second charge.

## Protocol behavior

Image, speech, chat, video-status, and fal queue JSON have code-owned response
limits and timeouts. Completed media content streams through byte-count
validation directly into its deterministic multipart R2 checkpoint with one
upload part in flight; the Trigger worker never assembles the complete video in
memory. Asynchronous polling uses durable waits rather than a browser or server
busy loop. fal cancellation sends its documented request-ID-scoped
`PUT .../cancel` and remains explicitly best-effort while work is in progress.
An accepted `CANCELLATION_REQUESTED` response is non-terminal: managed work
keeps polling and browser work keeps reconciling until fal independently reports
that the request already completed or no longer exists. An
`ALREADY_COMPLETED` response is recorded separately from accepted cancellation.
Other routes never claim remote cancellation when the endpoint lacks it.

User cancellation is immediate at the Flow-run boundary but does not retire
already-submitted provider work. Submitted jobs retain their Trigger execution
until bounded settlement completes or becomes explicitly unknown. When
cancellation wins before canonical output persistence, a settled result records
terminal provider status and actual-or-unknown cost, then discards its output
instead of creating an Asset. Retry admission fails closed while any provider
settlement is pending or unknown, or while a provider-result object remains in
`staging`.

When `BETTER_AUTH_URL` is public HTTPS and the sensitive
`OPENROUTER_WEBHOOK_SECRET` is configured to match the OpenRouter workspace,
video requests include a per-job `callback_url`. Hono rejects callback bodies
over 64 KiB while reading the request stream, before the handler materializes
the bounded raw bytes used for OpenRouter HMAC verification. The API persists
and deduplicates the terminal event and completes the current Trigger.dev wait
token. The worker consumes that callback wake once, then restores bounded delay
if the provider status endpoint still reports pending. A missing or delayed
callback falls back to bounded polling; local HTTP development uses a
five-second first recovery poll.

Reference validation is selected by an explicit typed route policy. Seedance
reference routes use `seedance-2-reference-v1`; unrelated video models never
inherit Seedance MIME, size, dimension, duration, or aggregate limits through a
generic reference heuristic.

Every adapter uses the same immutable request-versus-route assertion for model
ID, contract version, operation, output type/count, and route identity. Only
protocol-specific setting and reference validation stays local.

## Privacy and errors

Provider telemetry is restricted to allowlisted structural facts: stable model
and operation IDs, endpoint tag, reference counts/media types, duration,
resolution, status class, timings, and bounded machine error codes.

fal inference submissions disable stored JSON input/output payloads with
`X-Fal-Store-IO: 0` and set generated CDN media to expire after nine hours. fal
CDN URLs remain provider-public during that bounded interval; TaleLabs copies
successful outputs into its own storage before the expiry and never relies on
fal for durable product retention.

Never persist or log:

```txt
prompts or generated text
provider request or response bodies
signed URLs, storage keys, credentials, or media bytes
provider messages that may echo customer content
```

The end-user error surface may show a bounded, sanitized provider message. Logs
omit it. Only allowlisted provider error codes cross the worker boundary.

## Results and costs

Normalized provider output enters the existing finalizer. It writes the
visibility-owned public object, creates a canonical generation Asset linked to
its job, runs ordinary Asset ingestion, and exposes the ready Asset through Flow
reload and history queries.

`providerCostUsd` records an authoritative provider cost when returned and
remains null otherwise. Real jobs never fabricate zero. Flow cost is null when
any real job cost is unknown; otherwise it is the sum of job costs. Credit
balance and enforcement remain deferred.

OpenRouter speech responses expose `X-Generation-Id` while returning raw audio
bytes. After the audio result is durably checkpointed, the speech adapter uses
that ID for a bounded, best-effort generation-metadata lookup and persists the
reported cost. fal queue request IDs are likewise used for exact request-level
billing-event lookup against the immutable native endpoint. Output success never
waits for accounting. Managed OpenRouter and fal jobs whose provider completed
but whose cost is absent remain `pending` and enter a separate durable
reconciliation queue, including outputs later discarded by cancellation or a
downstream finalization failure. The scheduled sweep fairly claims a small
batch, retries at 5-minute, 30-minute, and 4-hour intervals, and stops after 12
metadata requests over approximately one day. A recovered cost updates the
provider-result checkpoint and job in one transaction, then recomputes the
Flow-run aggregate even when the run is already terminal. Retries never
resubmit paid generation work; unresolved cost becomes explicitly `unknown`,
never falsely `settled`.

## Verification and paid acceptance

Automated provider scenarios consume production OpenRouter and fal catalog
bindings and inject only fake HTTP. They assert binding coverage, adapter reuse,
exact endpoint identity, provider pinning, protocol payload normalization,
response validation, signed callback handling, fal cancellation and output-host
handling, immutable routing and retention headers, terminal-error retry classes,
request-level accounting lookup, asynchronous polling, durable completed-result
recovery, and the Nano Banana 2 `16:9`/`4K` image-reference request without
making a paid call.

Before user-owned paid QA:

- apply all production migrations in the target environment;
- pass route coverage and provider adapter scenarios;
- pass generation registry/drift checks and SDK generation;
- pass all workspace type checks, i18n validation, lint, and production build;
- pass the Trigger.dev deployment dry run and `git diff --check`;
- confirm the paid request is for an active model/operation and that its
  snapshot contains the complete reviewed binding.

Paid browser/UI QA is explicitly user-owned. Static verification must not make
provider generation requests.

## Provider documentation

- [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter text-to-speech](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [OpenRouter provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter generation metadata](https://openrouter.ai/docs/api/api-reference/generations/get-generation)
- [OpenRouter usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
- [OpenRouter API reference](https://openrouter.ai/docs/api/reference/overview)
- [fal queue lifecycle](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal platform headers](https://fal.ai/docs/documentation/model-apis/common-parameters)
- [fal data retention](https://fal.ai/docs/documentation/model-apis/media-expiration)
- [fal request error types](https://fal.ai/docs/documentation/model-apis/request-errors)
- [fal billing events](https://fal.ai/docs/platform-apis/v1/models/billing-events)
- [fal model-search API](https://fal.ai/docs/platform-apis/v1/models)
- [fal ElevenLabs models](https://fal.ai/elevenlabs)
- [fal Eleven v3 API](https://fal.ai/models/fal-ai/elevenlabs/tts/eleven-v3/api)
- [fal Multilingual v2 API](https://fal.ai/models/fal-ai/elevenlabs/tts/multilingual-v2/api)
- [fal Turbo v2.5 API](https://fal.ai/models/fal-ai/elevenlabs/tts/turbo-v2.5/api)
- [fal ElevenLabs Music API](https://fal.ai/models/fal-ai/elevenlabs/music/api)
- [fal Sound Effects v2 API](https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2/api)
- [fal Voice Changer API](https://fal.ai/models/fal-ai/elevenlabs/voice-changer/api)
- [fal Audio Isolation API](https://fal.ai/models/fal-ai/elevenlabs/audio-isolation/api)
- [fal Seedream 5.0 Lite API](https://fal.ai/docs/model-api-reference/image-generation-api/bytedance-seedream-v5-lite)
- [fal Seedream 5.0 Pro API](https://fal.ai/seedream-5.0)
- [fal FLUX.2 Pro API](https://fal.ai/models/fal-ai/flux-2-pro/api)
- [fal FLUX.2 Max API](https://fal.ai/models/fal-ai/flux-2-max/api)

Live discovery responses are research evidence only. Production behavior is
encoded in the versioned JSON catalog; there is no checked-in provider discovery
snapshot, dated inventory JSON, or runtime UI configuration derived from live
provider responses.
