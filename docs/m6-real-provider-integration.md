# Real Provider Integration

Status: static, non-paid verification in progress; paid acceptance remains
user-owned (2026-07-15).

This milestone replaces only the normalized provider boundary. Admission,
immutable snapshots, graph planning, Trigger.dev orchestration, job and
provenance persistence, canonical Asset ingestion, run history, and output
presentation remain provider-independent.

## Executable surface

The active TypeScript registry in `@talelabs/flows` is the public model catalog.
`GENERATION_PROVIDER_ROUTES` in `@talelabs/openrouter` is the single private
routing source. Do not copy the current model inventory into this document.

Current availability has one definition:

```txt
active catalog model operation
+ exactly one compatible provider route
= executable operation
```

Route validation fails application startup, generation checks, and production
builds when an active operation has a missing, duplicate, or incompatible
route. Historical model and route contracts remain readable for durable retry.
There is no public `executionAvailable` flag, no secondary allowlist, and no
fallback to a mock, alternate model, provider, or endpoint.

All active OpenRouter models reuse one of four protocol adapters:

```txt
openrouter-image-v1
openrouter-video-v1
openrouter-speech-v1
openrouter-chat-v1
```

Typed request profiles express protocol-level setting or input differences.
They do not create one adapter per model. A listed model that OpenRouter cannot
execute is excluded from the current catalog while its released historical
contract remains readable.

## Route and spend safety

Each new snapshot and job pins the TaleLabs model contract, registry version,
operation, provider, native model, route version, exact API endpoint, reviewed
provider endpoint tag, adapter version, and lifecycle/delivery contract. The
worker asserts that relational job fields, the immutable snapshot, and the
production route registry agree before resolving any Asset or calling a
provider.

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

Image, speech, chat, and video-status JSON have code-owned response limits and
timeouts. Completed video content streams through prefix and byte-count
validation directly into its deterministic multipart R2 checkpoint with one
upload part in flight; the Trigger worker never assembles the complete video in
memory. Video polling uses Trigger.dev durable waits rather than a browser or
server busy loop. Cancellation describes the reviewed provider lifecycle and
never claims remote cancellation when the endpoint lacks it.

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
reported cost. A retry resumes the checkpoint and repeats only metadata
reconciliation, never speech submission; cost remains null only when OpenRouter
still does not provide it.

## Verification and paid acceptance

Automated provider scenarios consume the production route registry and inject
only fake HTTP. They assert route coverage, adapter reuse, exact endpoint tags,
provider pinning with fallback disabled, protocol payload normalization,
response validation, signed callback handling, asynchronous polling, durable
completed-result recovery, and the Nano Banana 2 `16:9`/`4K` image-reference
request without making a paid call.

Before user-owned paid QA:

- apply all production migrations in the target environment;
- pass route coverage and provider adapter scenarios;
- pass generation registry/drift checks and SDK generation;
- pass 15/15 type checks, i18n validation, lint, and forced production build;
- pass the Trigger.dev deployment dry run and `git diff --check`;
- confirm the paid request is for an active model/operation and that its
  snapshot contains the reviewed endpoint tag.

Paid browser/UI QA is explicitly user-owned. Static verification must not make
provider generation requests.

## Provider documentation

- [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [OpenRouter text-to-speech](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [OpenRouter provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)
- [OpenRouter API reference](https://openrouter.ai/docs/api/reference/overview)

Live discovery responses are research evidence only. Production behavior is
encoded in versioned TypeScript; there is no checked-in provider discovery
snapshot, dated inventory JSON, or runtime UI configuration derived from live
OpenRouter responses.
