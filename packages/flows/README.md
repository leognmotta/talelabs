# `@talelabs/flows`

This package is TaleLabs' provider-neutral graph and deterministic planning
engine. It owns nodes, handles, runtime values, graph validation, command
selection, item/job expansion, canonical hashes, and immutable snapshot shapes.

It reads public model definitions from `@talelabs/models-catalog`. It does not
own provider bindings, native endpoints, HTTP calls, PostgreSQL, React, or
Trigger.dev tasks.

## Start here

1. [`src/index.ts`](src/index.ts) — public API and startup validation.
2. [`src/graph/types.ts`](src/graph/types.ts) — graph vocabulary.
3. [`src/nodes/registry/types.ts`](src/nodes/registry/types.ts) — node schemas and handles.
4. [`src/generation/registry/contracts.ts`](src/generation/registry/contracts.ts) — catalog-to-Flow projection.
5. [`src/generation/resolution/`](src/generation/resolution/) — node-family capability resolution.
6. [`src/runtime/planning/planner.ts`](src/runtime/planning/planner.ts) — graph-to-plan entry point.
7. [`src/runtime/snapshots/contracts.ts`](src/runtime/snapshots/contracts.ts) — current self-contained snapshot contract.

## Planning path

```text
run command selection
  -> graph validation and topological selection
  -> ordered input materialization
  -> runtime coordinate and job expansion
  -> canonical plan/snapshot assembly and hashes
```

The planner freezes the creative contract: canonical model ID and revision,
operation, settings, exact inputs, runtime dimensions, request identity, and
output expectations. The API resolves a private provider binding only during
admission and captures it in the immutable snapshot.

## Package map

```text
src/
├── graph/                  Graph vocabulary, ordering, limits, validation
├── nodes/                  Current node schemas, defaults, handles, upcasters
├── generation/
│   ├── contracts/          Provider-neutral adapter contracts
│   ├── outputs/            Output compatibility and validation
│   ├── registry/           Catalog projection, queries, and invariants
│   ├── resolution/         Pure capability resolution by node family
│   └── scenarios/          Executable capability checks
└── runtime/
    ├── planning/           Selection, materialization, expansion, assembly
    ├── serialization/      Canonical JSON and deterministic hashes
    ├── snapshots/          Immutable execution artifacts and readers
    └── values/             Runtime collections and normalized requests
```

There are no provider route catalogs or copied current/major/history model
registries here. Production compatibility belongs in explicit snapshot readers,
not mutable catalog reconstruction.

## Where to make a change

| Change | Primary location |
| --- | --- |
| Add/change a current model | Matching `packages/models-catalog/models/<media>.json` file |
| Change provider-neutral node behavior | `src/generation/resolution/<family>.ts` |
| Change graph validity | `src/graph/validation*.ts` |
| Change run selection | `src/runtime/planning/selection*.ts` |
| Change job identity or multiplicity | `src/runtime/planning/` and serialization |
| Change snapshot shape | `src/runtime/snapshots/` plus API/Trigger consumers |

## Verification

```bash
npm run generation:check -w @talelabs/flows
npm run provider-output:check -w @talelabs/flows
npm run run:check -w @talelabs/flows
npm run check-types -w @talelabs/flows
npm run build -w @talelabs/flows
```
