# AI Agent Rules for `@talelabs/flows`

Read [`README.md`](README.md), `docs/assets-flows-mvp-contract.md`, and `docs/flow-nodes-planning.md` before changing this package. The root `AGENTS.md` rules also apply.

## Ownership boundaries

- Keep this package deterministic and provider-neutral. Do not import React, browser APIs, PostgreSQL clients, Trigger.dev, storage clients, or private provider credentials/routes.
- Treat `src/index.ts` as the public package boundary. Preserve existing root exports unless an intentional repository-wide contract migration changes every consumer.
- Keep graph vocabulary under `graph/`, node contracts under `nodes/`, generation capabilities under `generation/`, and immutable execution planning under `runtime/`.
- Put modules in the narrowest owning directory. Do not rebuild a flat source folder or create generic dumping grounds such as `helpers/` or `utils/`.

## Catalog and snapshot rules

- `@talelabs/models-catalog` is the active product catalog. Flow may project its
  provider-neutral public definitions, but must not copy model declarations,
  bindings, route history, or provider-native facts.
- Persist canonical `vendor/model` IDs and per-model revisions. A provider or
  endpoint change must not change a Flow's creative identity.
- New snapshots are self-contained. Preserve supported production snapshot
  readers explicitly; never reconstruct an admitted binding from current
  catalog state.
- Every active model operation must be validated against its input slots, setting visibility, constraints, and output contract. Registry initialization must fail closed on drift.

## Graph and runtime invariants

- Preserve the distinction between a typed collection consumed by one operation and outer runtime items representing execution multiplicity.
- Validate drafts without requiring every executable input; require completeness only for the run-selected executable nodes.
- Planning must remain deterministic for the same canonical graph, command, locked Assets, and prior outputs.
- Do not execute from mutable graph rows. Plans and provider-neutral job requests must be immutable, bounded, canonically serialized, and hashable.
- Changes to plan hashes, job hashes, runtime item keys, snapshot shapes, or request payload versions require an explicit compatibility review across API and Trigger.dev consumers.

## Source organization

- Keep the root code-structure limits: no authored source file above 600 physical lines or three functions.
- Split by ownership: declarations, queries, validation, resolution, selection, topology, serialization, and snapshot reading are separate responsibilities.
- Use direct internal imports from the owning module. Add a barrel only where it is a deliberate public boundary, such as `src/index.ts`, `nodes/registry/index.ts`, `generation/registry/index.ts`, or `runtime/index.ts`.
- Do not hide substantial logic in anonymous callbacks or thin numbered fragments.

## Required checks

Run these after changes in this package:

```bash
npm run generation:check -w @talelabs/flows
npm run provider-output:check -w @talelabs/flows
npm run run:check -w @talelabs/flows
npm run check-types -w @talelabs/flows
npm run build -w @talelabs/flows
```

If public types, generation contracts, request identity, or snapshots changed, also run SDK generation, API/Trigger.dev type checks, provider verification, and the production build.
