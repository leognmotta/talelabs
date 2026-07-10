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
docs/api-design-planning-v2.md    = API contract for the base features
docs/mvp-execution-plan.md        = phased MVP implementation order and acceptance gates
docs/credits-planning.md          = credit system planning (Phase 2 — do not implement)
```

Deprecated documents — do not implement from these; they describe the retired Generate/Projects/Brands/Products/Characters architecture:

```txt
docs/db-design-planning.md
docs/api-design-planning.md
```

Execution rules that hold across all work:

1. Every execution is a `flowRuns` row — the `flowRuns`/`flowRunNodes` tables are part of the **initial migration**, with every job belonging to a run from day one. Only the multi-node orchestration modes (`downstream`/`all`) and their parent orchestrator task ship later; the first product experience runs one selected generation node (mode `node`).
2. Every successful generation output is persisted as a canonical Asset.
3. Generation provenance is immutable — later edits to Flows, Elements, or Asset relationships never rewrite historical job inputs.
4. Element and node type vocabularies live in code registries, not the database.
5. Costs (`creditCost`, `providerCostUsd`) are recorded on every generation job from day one; no balances or enforcement until the credit system ships.
6. Credits and billing belong in account/header/billing UI, never the main creative navigation.

## Internationalization rules

TaleLabs is internationalized through `@talelabs/i18n` and `react-i18next`.
Every new feature and every change to user-facing copy must preserve full support
for these locales:

```txt
en
pt-BR
pt-PT
es
fr
de
it
nl
pl
ro
```

Rules that hold across all product work:

1. Never hard-code user-facing text in UI code. This includes headings, buttons, labels, placeholders, helper text, validation messages, toasts, dialogs, empty/loading/error states, tooltips, and accessibility text such as `aria-label`.
2. Add or update the English source key and every supported locale in the same change. Run `npm run i18n:check`; missing keys, unknown keys, interpolation mismatches, and protected terminology must fail validation.
3. Translate meaning and product intent, not words literally. Follow `packages/i18n/TRANSLATION_GUIDE.md` for approved terminology, regional voice, brand terms, and words intentionally retained in English. When a term is ambiguous, research established usage in that language before choosing it.
4. Keep `TaleLabs` unchanged in every locale. Keep internal domain names such as `Asset` or database fields separate from user-facing terminology; for example, the Assets navigation describes image/video/audio files using the natural local word for “Files.”
5. Use `useTranslation` for React UI and `Trans` only when translated copy contains React elements. Reuse the shared locale registry and lazy-loaded catalogs from `@talelabs/i18n`; do not create feature-local locale lists or a second i18n instance.
6. Zod and React Hook Form schemas must emit stable translation keys or structured validation codes, never final English sentences. Translate errors at render time with the shared localized field-error path.
7. API errors must keep stable machine-readable `code`, `field`, and `params` values. Clients translate known codes and may use the server message only as a fallback. Continue sending the resolved locale through `Accept-Language`.
8. Default language selection follows the browser’s preferred locales, falls back from a region to a supported base language, and always falls back to `en` when unsupported. A saved explicit user preference overrides browser detection; “Auto-detect” restores browser-based selection.
9. Use the resolved locale with `Intl` for dates, times, numbers, currencies, and plural-sensitive copy. Do not manually assemble locale-sensitive output.
10. Before completing a feature, run the catalog check, relevant tests, type-checking, lint, and a production build to catch missing translations and lazy-loading failures.
