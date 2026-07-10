# TaleLabs Agent Instructions

Before planning, editing, or implementing product work in this repository, read:

```txt
docs/talelabs-product-vision.md
```

That document defines what TaleLabs is: a visual AI creative workspace built around three primary entities and one core loop:

```txt
Assets -> Elements -> Flows -> Generated Assets -> Continued Iteration
```

Keep implementation aligned with that loop and its build order unless the user explicitly asks to expand scope:

```txt
1. Assets
2. Elements
3. Flows
4. Complete generation loop
5. Billing and credits
```

Source-of-truth design documents:

```txt
docs/talelabs-product-vision.md   = product direction and scope
docs/db-design-planning-v2.md     = database schema (PostgreSQL, Kysely, camelCase)
docs/credits-planning.md          = credit system planning (Phase 2 — do not implement)
```

Deprecated documents — do not implement from these; they describe the retired Generate/Projects/Brands/Products/Characters architecture:

```txt
docs/db-design-planning.md
docs/api-design-planning.md
docs/mvp-execution-plan.md
```

Execution rules that hold across all work:

1. Run one selected generation node manually; whole-graph runs are designed ahead (`flowRuns`) but ship later.
2. Every successful generation output is persisted as a canonical Asset.
3. Generation provenance is immutable — later edits to Flows, Elements, or Asset relationships never rewrite historical job inputs.
4. Element and node type vocabularies live in code registries, not the database.
5. Costs (`creditCost`, `providerCostUsd`) are recorded on every generation job from day one; no balances or enforcement until the credit system ships.
6. Credits and billing belong in account/header/billing UI, never the main creative navigation.
