# `@talelabs/providers`

This package owns external generation-provider protocols behind explicit
universal, browser, and server entry points. It implements OpenRouter's protocol
families and fal's asynchronous queue protocol.

The protocol core is browser-compatible so the browser-local BYOK driver and
managed worker reuse request, response, polling, cancellation, and output
behavior. Exact catalog bindings independently declare whether each provider
route is reviewed for browser, managed, or both runtimes.

The binding execution modes and their trust boundaries are defined in
[`docs/provider-execution-modes.md`](../../docs/provider-execution-modes.md).

The package does not own the model inventory, Flow planning, PostgreSQL,
Trigger.dev tasks, or durable run state. Model capabilities and immutable
private bindings live in `@talelabs/models-catalog`; managed Trigger execution
passes the complete binding captured during admission to the server registry.

## Entry points

| Entry point | Ownership |
| --- | --- |
| `@talelabs/providers` | Browser-safe package root; re-exports `/core` only |
| `@talelabs/providers/core` | Universal protocol translation, normalized errors, provider facts, and fetch-based bounded transport |
| `@talelabs/providers/browser` | Browser-safe protocol exports plus user-scoped encrypted IndexedDB credential storage |
| `@talelabs/providers/server` | Managed registry, platform credentials, private binding dispatch, SDK helpers, accounting, and webhook cryptography |

`/core` and `/browser` never import Node built-ins, environment access,
Trigger.dev, PostgreSQL, storage SDKs, webhooks, or accounting. API and
Trigger.dev use `/server`; the dashboard's local driver uses `/browser`.

## Browser credential storage

`/browser` stores one credential per provider and immutable Better Auth user ID.
It persists a single non-extractable 256-bit AES-GCM `CryptoKey` through
IndexedDB structured cloning and stores only ciphertext records. Every write
uses a unique 96-bit initialization vector and authenticates the schema version,
user ID, and provider ID as additional data. Reads validate all IndexedDB values
as untrusted input and fail closed when a record, key, or browser capability is
invalid.

The browser API supports status, store or replace, remove, user-scoped sign-out
cleanup, and a plaintext resolver used only inside the browser job executor. The
dashboard settings surface never imports the resolver. No credential operation
makes a network request, logs secret material, or falls back to local storage,
session storage, cookies, URL state, or React state persistence.

Admission receives provider identifiers only. Each browser manifest job names
the provider frozen in its immutable run snapshot, and the coordinator requires
the complete current provider set before claiming live work. It therefore
supports fal-only, OpenRouter-only, and mixed-provider runs without assuming one
global key.

Encryption at rest limits accidental disclosure of copied browser storage; it
does not protect against malicious code running in the same origin, a compromised
browser extension, or a compromised device. Browser execution remains less
durable than managed execution and is enabled only for exact reviewed bindings.

## Managed execution path

```text
normalized request + immutable catalog binding
  -> @talelabs/providers/server registry
  -> captured binding's OpenRouter or fal adapter
  -> browser-safe protocol preparation and bounded fetch transport
  -> normalized provider result + metadata
  -> Trigger.dev reconciliation and canonical Asset ingestion
```

The server registry accepts an optional non-serializable runtime credential.
When none is supplied, server composition resolves the existing platform
`OPENROUTER_API_KEY` or `FAL_API_KEY`. Admission considers a managed provider
available only while its platform credential resolves. The resolver and returned
secret never belong in a catalog binding, Flow, snapshot, job, Trigger payload,
log, or API response.

Tenant-aware Asset resolution remains server composition. It converts an
authorized canonical Asset into a short-lived provider-readable URL before the
universal protocol core builds a request. The core does not know whether a URL
was signed by server storage or supplied by another future runtime.

## Package map

```text
src/
├── index.ts                 Browser-safe package root
├── core.ts                  Universal public protocol boundary
├── browser.ts               Browser-safe protocols and credential-store API
├── browser/                 IndexedDB schema, validation, AES-GCM, and lifecycle
├── server.ts                Managed server public boundary
├── contracts.ts             Universal runtime-service contracts
├── server/
│   ├── contracts.ts         Managed adapter construction
│   ├── credentials.ts       Explicit/platform credential resolution
│   └── registry.ts          binding.provider dispatch
├── fal/
│   ├── core.ts              Browser-safe fal exports
│   ├── adapter.ts           Captured fal binding dispatch
│   ├── protocols/queue/     Submit, poll, result, cancellation, and mapping
│   ├── transport/           Authenticated queue and bounded media transport
│   └── server/accounting.ts Managed request-level billing-event lookup
└── openrouter/
    ├── core.ts              Browser-safe OpenRouter exports
    ├── server.ts            Managed-only OpenRouter exports
    ├── adapter.ts           Private binding protocol dispatch
    ├── protocols/           Image, video, speech, and chat translation
    ├── transport/           Fetch, web streams, byte bounds, and errors
    ├── client/              Server-only official SDK helpers
    ├── server/              Server-only accounting lookup
    └── webhooks/            Server-only callback signature verification
```

## Where to make a change

| Change | Primary location |
| --- | --- |
| Add a model using an existing protocol | Matching `packages/models-catalog/models/<media>.json` only |
| Change one reviewed provider binding | Matching media catalog, incrementing the model revision |
| Change reusable provider wire behavior | Matching `src/<provider>/protocols/` module |
| Change managed auth, accounting, or callbacks | `/server` boundary or provider-owned server module |
| Add a genuinely new provider | Its catalog schema/validator, `src/<provider>/`, one server registry entry, and catalog bindings |

A new provider must not change canvas nodes, Flow planning, snapshot ownership,
canonical Assets, or Trigger lifecycle orchestration.

## Verification

```bash
npm run browser:check -w @talelabs/providers
npm run browser-credentials:verify -w @talelabs/providers
npm run check-types -w @talelabs/providers
npm run build -w @talelabs/providers
npm run providers:verify -w @talelabs/trigger
```

The build permanently bundles the package root, `/core`, and `/browser` for a
browser target and fails if Node-only dependencies enter any safe graph.
Provider verification uses production catalog bindings and fake HTTP only; it
never makes a paid request.
