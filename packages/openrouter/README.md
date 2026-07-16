# `@talelabs/openrouter`

This server-only package translates normalized TaleLabs generation requests into
OpenRouter's four supported wire protocols. It owns HTTP transport, response
normalization, provider errors, accounting lookup, and webhook signatures.

It does not own the model inventory, Flow planning, PostgreSQL, Trigger tasks,
or durable run state. Model capabilities and immutable provider bindings live in
`@talelabs/models-catalog`; Trigger passes the binding captured at admission.

## Start here

1. [`src/adapter.ts`](src/adapter.ts) — provider-level protocol dispatch.
2. [`src/protocols/image.ts`](src/protocols/image.ts) — immediate image facade.
3. [`src/protocols/video/index.ts`](src/protocols/video/index.ts) — asynchronous video protocol facade.
4. [`src/protocols/speech.ts`](src/protocols/speech.ts) — immediate speech facade.
5. [`src/protocols/chat.ts`](src/protocols/chat.ts) — immediate text/chat facade.
6. [`src/transport/client.ts`](src/transport/client.ts) — bounded HTTP boundary.
7. [`src/errors.ts`](src/errors.ts) — stable provider error mapping.
8. [`src/webhooks/signature.ts`](src/webhooks/signature.ts) — callback signature verification.

## Execution path

```text
normalized request + immutable catalog binding
  -> adapter.ts protocol dispatch
  -> protocol facade
  -> protocol-owned preparation and execution modules
  -> bounded transport
  -> normalized provider result + metadata
```

Models sharing a protocol share its adapter. Captured request profiles carry the
small model-specific shaping policy; there are no model route builders or
historical route catalogs in this package. An admitted retry never looks up
current catalog state.

## Package map

```text
src/
├── adapter.ts              Provider-level protocol dispatcher
├── protocols/
│   ├── image.ts            Image protocol facade
│   ├── image/              Image preparation and immediate execution
│   ├── speech.ts           Speech protocol facade
│   ├── speech/             Speech preparation, execution, and accounting
│   ├── chat.ts             Chat protocol facade
│   ├── chat/               Chat preparation and immediate execution
│   ├── immediate-adapter.ts Shared immediate submission plumbing
│   └── video/              Video facade, submission, polling, and media concerns
├── transport/              Bounded JSON, byte, and stream HTTP execution
├── sdk/                    Official SDK convenience boundary
└── webhooks/               Callback signature verification
```

## Where to make a change

| Change | Primary location |
| --- | --- |
| Add a model using an existing protocol | Matching `packages/models-catalog/models/<media>.json` file only |
| Change one reviewed binding/profile | Matching media catalog, incrementing its model revision |
| Change image/video/speech/chat wire behavior | Matching protocol module |
| Change HTTP bounds or transport errors | `src/transport/` and `src/errors.ts` |
| Change callback authentication | `src/webhooks/` and API callback verification |

## Verification

```bash
npm run check-types -w @talelabs/openrouter
npm run build -w @talelabs/openrouter
npm run providers:verify -w @talelabs/trigger
```

Provider verification iterates production catalog bindings with fake HTTP. It
never makes a paid provider request.
