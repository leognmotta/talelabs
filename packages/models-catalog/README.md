# `@talelabs/models-catalog`

This package owns TaleLabs' reviewed current generation-model inventory. It is
a checked-in library, not a service, database, discovery cache, or provider
client.

## Ownership

- `catalog.json` owns the format version, content revision, and media defaults.
- `models/image.json`, `models/video.json`, `models/text.json`, and
  `models/audio.json` own complete explicit model records by output family.
- `src/catalog-source.ts` assembles those files and rejects category drift.
- `src/catalog.ts` parses, validates, indexes, and freezes the complete catalog.
- `src/public-catalog.ts` removes private provider bindings.
- `src/provider-binding.ts` resolves an exact binding during run admission.
- `src/providers/schema.ts` owns the provider-discriminated binding union.
- `src/providers/openrouter.ts` owns OpenRouter-only endpoint, protocol,
  request-profile, routing schema fields, and compatibility validation.
- `src/providers/validation.ts` dispatches each binding to its provider-owned
  validator without adding provider policy to generic catalog validation.
- `scripts/check.ts` fails closed on schema, coverage, default, and privacy
  drift without contacting a provider.

The package does not own Flow planning, HTTP calls, PostgreSQL, Trigger.dev,
storage, or UI components.

## Common trace

```text
catalog.json + models/<media>.json
  -> one assembled catalog
  -> validated catalog
  -> public model projection or private admission binding
```

## Adding a model

Add one complete record to the matching `models/<media>.json` file, then run:

```bash
npm run catalog:check -w @talelabs/models-catalog
```

Then run the Flow, API, and fake-provider checks. No discovery command rewrites
the catalog and no automated verification makes paid provider calls. Keep each
record explicit; the package deliberately has no inheritance, templates, JSON
references, or deep-merge rules.
