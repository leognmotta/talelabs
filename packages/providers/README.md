# `@talelabs/providers`

This package owns external generation-provider protocols behind explicit
universal, browser, and server entry points. OpenRouter is the only implemented
provider today.

The protocol core is browser-compatible so a future browser-local BYOK product
can reuse request and response behavior. Browser BYOK itself is not implemented:
there is no browser credential storage, private binding delivery, provider
eligibility policy, or local durability claim.

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
| `@talelabs/providers/browser` | Deliberately browser-safe composition boundary; currently exposes only `/core` |
| `@talelabs/providers/server` | Managed registry, platform credentials, private binding dispatch, SDK helpers, accounting, and webhook cryptography |

`/core` and `/browser` never import Node built-ins, environment access,
Trigger.dev, PostgreSQL, storage SDKs, webhooks, or accounting. `/server` is the
only entry point used by API and Trigger.dev.

## Managed execution path

```text
normalized request + immutable catalog binding
  -> @talelabs/providers/server registry
  -> OpenRouter adapter
  -> browser-safe protocol preparation and bounded fetch transport
  -> normalized provider result + metadata
  -> Trigger.dev reconciliation and canonical Asset ingestion
```

The server registry accepts an optional non-serializable runtime credential.
When none is supplied, server composition resolves the existing platform
`OPENROUTER_API_KEY`. The resolver and returned secret never belong in a catalog
binding, Flow, snapshot, job, Trigger payload, log, or API response.

Tenant-aware Asset resolution remains server composition. It converts an
authorized canonical Asset into a short-lived provider-readable URL before the
universal protocol core builds a request. The core does not know whether a URL
was signed by server storage or supplied by another future runtime.

## Package map

```text
src/
├── index.ts                 Browser-safe package root
├── core.ts                  Universal public protocol boundary
├── browser.ts               Browser-safe future composition boundary
├── server.ts                Managed server public boundary
├── contracts.ts             Universal runtime-service contracts
├── server/
│   ├── contracts.ts         Managed adapter construction
│   ├── credentials.ts       Explicit/platform credential resolution
│   └── registry.ts          binding.provider dispatch
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
| Change one reviewed OpenRouter binding | Matching media catalog, incrementing the model revision |
| Change reusable OpenRouter wire behavior | Matching `src/openrouter/protocols/` module |
| Change managed auth, accounting, or callbacks | `/server` boundary or server-only OpenRouter module |
| Add a genuinely new provider | Its catalog schema/validator, `src/<provider>/`, one server registry entry, and catalog bindings |

A new provider must not change canvas nodes, Flow planning, snapshot ownership,
canonical Assets, or Trigger lifecycle orchestration.

## Verification

```bash
npm run browser:check -w @talelabs/providers
npm run check-types -w @talelabs/providers
npm run build -w @talelabs/providers
npm run providers:verify -w @talelabs/trigger
```

The build permanently bundles the package root, `/core`, and `/browser` for a
browser target and fails if Node-only dependencies enter any safe graph.
Provider verification uses production catalog bindings and fake HTTP only; it
never makes a paid request.
