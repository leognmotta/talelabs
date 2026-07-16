# AI Agent Rules for `@talelabs/providers`

Read [`README.md`](README.md), `docs/assets-flows-mvp-contract.md`, and the root
`AGENTS.md` before changing this package. Read provider-specific current
documentation before changing a catalog binding or wire protocol.

## Ownership boundaries

- Keep the provider protocol core browser-safe so TaleLabs can add browser-local
  BYOK later without rewriting provider request and response behavior. Do not
  treat this as approval to implement browser BYOK now.
- Do not force the entire package into a browser bundle. Separate universal,
  browser, and server composition through explicit package entry points:
  `@talelabs/providers/core`, `@talelabs/providers/browser`, and
  `@talelabs/providers/server`. The package root must export only universal
  browser-safe contracts and behavior. Dashboard code must never import the
  server entry point.
- Keep credentials, private bindings, routing policy, provider callbacks,
  accounting reconciliation, managed BYOK storage, durable polling, and
  Trigger.dev composition server-only. Never expose these concerns through
  public Flow contracts or browser exports.
- Keep the root `registry.ts` explicit and small. It dispatches immutable
  bindings by `binding.provider`; it is not a model catalog or plugin framework.
- Keep every provider implementation in `src/<provider>/`. OpenRouter owns its
  image, video, speech, and chat protocols, transport, client helpers, errors,
  accounting lookup, and webhook authentication under `src/openrouter/`.
- `@talelabs/models-catalog` owns capabilities and bindings. Providers execute a
  captured binding and never rediscover current routing during a retry.
- `@talelabs/flows` owns normalized provider-neutral request and result
  contracts. Trigger owns durable lifecycle orchestration and Asset ingestion.

## Credentials and transport

- Provider adapters receive a typed runtime credential resolver. They must not
  read environment variables or serialize the resolver or returned secret.
- The explicit `@talelabs/providers/server` composition boundary may resolve
  managed platform credentials from the environment. Future BYOK may use the
  same injected runtime seam but must not be implemented implicitly.
- Prefer the official provider SDK where it supports the required operation.
  Keep raw HTTP bounded, abortable, and explicit about response delivery.
- Preserve safe provider identifiers needed for diagnosis without logging
  prompts, signed input URLs, credentials, or complete provider payloads.
- Automated verification injects fake HTTP and must never make paid requests.

## Browser compatibility

- Universal provider code must receive `fetch`, credential resolution, asset
  resolution, clocks, delays, and other runtime services through narrow typed
  interfaces. It must not read `process.env` or global server configuration.
- Universal and browser entry points must not import `node:*`, Node `Buffer`,
  filesystem APIs, Trigger.dev, PostgreSQL, Infisical, server storage clients,
  webhook verification, or accounting reconciliation.
- Prefer web-platform primitives in shared code: `Uint8Array`, `Blob`, `File`,
  `ReadableStream`, `AbortSignal`, URL APIs, and Web Crypto. Node-specific
  conversion and cryptography belong behind the server entry point.
- Asset inputs must support runtime-specific resolution. Server composition may
  resolve an Asset to a short-lived signed URL; browser composition may resolve
  it to a `Blob`, `File`, object URL, or provider-supported remote URL. Protocol
  code consumes a normalized source and must not know where the Asset came from.
- Keep protocol adapters environment-neutral where practical. Secret storage,
  webhook authentication, provider accounting, durable retries, and callback
  handling are runtime composition concerns, not protocol behavior.
- Browser-local execution has different durability and capability constraints.
  Do not silently claim parity with managed Trigger.dev execution. Provider
  CORS support, browser lifecycle, async callbacks, retries, and upload recovery
  must be evaluated explicitly before exposing a provider in browser mode.
- Package exports must prevent accidental server-code inclusion in dashboard
  bundles. Import server behavior through an explicit `/server` entry point;
  never rely on tree-shaking to protect credentials or Node-only modules.
- Before browser BYOK ships, add a browser-only TypeScript and bundle gate that
  imports `/core` and `/browser` without Node types and fails on Node built-ins.
  Keep the existing server build and provider verification gates as well.

## Source organization

- OpenRouter protocol translation stays in `src/openrouter/protocols/`,
  transport mechanics in `src/openrouter/transport/`, official SDK helpers in
  `src/openrouter/client/`, and callback verification in
  `src/openrouter/webhooks/`.
- Use one protocol adapter per real wire protocol, never one per model.
- Keep the root code-structure limits: no authored source file above 600 lines
  or more than three functions.
- Use direct internal imports; barrels are deliberate package/provider public
  boundaries only.

## Required checks

```bash
npm run check-types -w @talelabs/providers
npm run build -w @talelabs/providers
npm run providers:verify -w @talelabs/trigger
```

If bindings, transport, normalized outputs, or public exports change, also run
catalog validation, planner/snapshot scenarios, repository type checks, lint,
TSDoc validation, and the forced production build.
