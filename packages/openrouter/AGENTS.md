# AI Agent Rules for `@talelabs/openrouter`

Read [`README.md`](README.md), `docs/assets-flows-mvp-contract.md`, and the root `AGENTS.md` before changing this package. Use the installed OpenRouter skills when researching or modifying provider capabilities.

## Ownership boundaries

- Keep this package server-only. Never import it into browser-only dashboard code or expose API keys, private endpoints, provider model IDs, fallbacks, or routing policy through public Flow contracts.
- `@talelabs/flows` owns the active provider-neutral model catalog. This package owns the single private route registry that maps exact model contracts and operations to OpenRouter.
- Shared execution lifecycle adapters belong to `@talelabs/trigger`. Do not create one route adapter per model; models using the same protocol must resolve to the same image, video, speech, or chat adapter family.
- Keep product prompts and workflow behavior in consuming domains, not in the SDK or transport layers.

## Route registry rules

- Maintain routes in TypeScript. Do not check in provider-discovery snapshots, dated inventories, or runtime-generated route configuration.
- Research OpenRouter's current read-only model and endpoint APIs before changing a model route, then encode the reviewed decision in the typed registry.
- Every active TaleLabs model operation must resolve to exactly one compatible route. Missing, duplicate, or protocol-incompatible routes must fail route checks and package startup.
- Keep current executable routes under `routes/current/`, cohesive large families under `routes/major/`, and immutable prior facts under `routes/history/`.
- Never rewrite historical route identity used by persisted snapshots. Add an explicit versioned route when provider facts change incompatibly.
- Keep model-specific differences in typed request profiles. Do not fork the HTTP transport or lifecycle adapter merely because settings differ.

## Transport and credential rules

- Read `OPENROUTER_API_KEY` only at server runtime or accept it explicitly from server code. Never log it or serialize it into a route/snapshot.
- Prefer the official `@openrouter/sdk` for supported SDK operations. Keep raw HTTP transport bounded, abortable, and explicit about JSON, byte, or stream delivery.
- Preserve provider error bodies and identifiers needed for diagnosis without logging prompts, reference URLs, credentials, or full provider payloads.
- Verification must consume the production route registry and inject only fake HTTP. Do not reconstruct production route constants in a verifier and do not make paid requests.

## Source organization

- Keep route declarations, transport mechanics, SDK convenience methods, and webhook verification in their existing top-level domains.
- Put modules in the narrowest owning directory. Do not rebuild a flat source folder or create generic `helpers/` and `utils/` dumping grounds.
- Keep the root code-structure limits: no authored source file above 600 physical lines or three functions.
- Use direct internal imports from the owning module. Barrels are reserved for deliberate public boundaries such as `src/index.ts` and `routes/index.ts`.

## Required checks

Run these after changes in this package:

```bash
npm run check-types -w @talelabs/openrouter
npm run routes:check -w @talelabs/openrouter
npm run build -w @talelabs/openrouter
```

If routes, profiles, transport contracts, or public exports changed, also run Trigger.dev provider verification, repository type checks, and the forced production build.
