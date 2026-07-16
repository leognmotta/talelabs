# AI Agent Rules for `@talelabs/openrouter`

Read [`README.md`](README.md), `docs/assets-flows-mvp-contract.md`, and the root `AGENTS.md` before changing this package. Use the installed OpenRouter skills when researching or modifying provider capabilities.

## Ownership boundaries

- Keep this package server-only. Never import it into browser-only dashboard code or expose API keys, private endpoints, provider model IDs, fallbacks, or routing policy through public Flow contracts.
- `@talelabs/models-catalog` owns model capabilities and immutable provider
  bindings. This package accepts a captured binding; it must not recreate a
  route or product catalog.
- This package owns shared image, video, speech, and chat protocol translation.
  Trigger owns durable lifecycle orchestration. Never create one adapter per
  model.
- Keep product prompts and workflow behavior in consuming domains, not in the SDK or transport layers.

## Binding and protocol rules

- Research OpenRouter's current APIs before changing a catalog binding, then
  encode reviewed facts in the matching
  `packages/models-catalog/models/<media>.json` file.
- Each protocol validates the immutable binding and normalized request it
  receives. Do not query current catalog state or infer a route during retries.
- Keep model-specific differences in captured request profiles. Do not fork the
  transport or protocol merely because settings differ.

## Transport and credential rules

- Read `OPENROUTER_API_KEY` only at server runtime or accept it explicitly from server code. Never log it or serialize it into a route/snapshot.
- Prefer the official `@openrouter/sdk` for supported SDK operations. Keep raw HTTP transport bounded, abortable, and explicit about JSON, byte, or stream delivery.
- Preserve provider error bodies and identifiers needed for diagnosis without logging prompts, reference URLs, credentials, or full provider payloads.
- Verification must consume production catalog bindings and inject only fake
  HTTP. Never make paid requests.

## Source organization

- Keep protocol translation under `src/protocols/`, transport mechanics under
  `src/transport/`, SDK convenience methods under `src/sdk/`, and webhook
  verification under `src/webhooks/`.
- Use one clear protocol facade per protocol. Chat, image, and speech keep
  preparation and immediate execution in their matching protocol directories.
  Video's facade is `src/protocols/video/index.ts`; its narrow preparation,
  execution, polling, input, media, reference, response, setting, and wire-type
  modules stay in that same cohesive directory.
- Put modules in the narrowest owning directory. Do not rebuild a flat source folder or create generic `helpers/` and `utils/` dumping grounds.
- Keep the root code-structure limits: no authored source file above 600 physical lines or three functions.
- Use direct internal imports from the owning module. Barrels are reserved for
  deliberate public boundaries such as `src/index.ts`.

## Required checks

Run these after changes in this package:

```bash
npm run check-types -w @talelabs/openrouter
npm run build -w @talelabs/openrouter
```

If routes, profiles, transport contracts, or public exports changed, also run Trigger.dev provider verification, repository type checks, and the forced production build.
