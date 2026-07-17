# TaleLabs Agent Instructions

Before planning, editing, or implementing product work in this repository, read:

```txt
docs/assets-flows-mvp-contract.md
docs/talelabs-product-vision.md
```

That document defines what TaleLabs is. The current product reset narrows the
active product to an Asset foundation and a visual creation canvas:

```txt
Assets -> Flows -> Generated Assets -> Continued Iteration
```

Keep implementation aligned with this active build order unless the user
explicitly changes it:

```txt
1. Assets
2. Canvas foundation
3. Model-adaptive Video, Image, and Audio Generation nodes
4. Deterministic mocked canvas behavior
5. User-owned canvas and node UX approval (approved 2026-07-14)
6. Provider-independent durable run engine with deterministic mock adapters
7. User-owned run UX and end-to-end QA
8. Real provider integration
```

Elements are deferred and are not a prerequisite for the canvas, generation
nodes, mocked output, or the first real provider loop. Existing Element code may
remain dormant, but active product work must not expose it, depend on it, or
expand it. The active Flow graph and reference APIs are Asset-only.

The user approved the generation-node product design and M5 run-engine scope on
2026-07-14. M5 may implement Trigger.dev orchestration, immutable run snapshots,
generation-job persistence, deterministic mock adapters, multiple outputs,
canonical mock output Assets, and the approved run modes. Explicit iteration
nodes are deferred until real product usage demonstrates the need. Real OpenRouter/provider calls
remain M6 scope. The curated, code-versioned model capability registry continues
to drive node handles, settings, validation, planning, and snapshot contracts.

Source-of-truth design documents:

```txt
docs/assets-flows-mvp-contract.md = binding active MVP boundary
docs/talelabs-product-vision.md   = product direction and scope
docs/flow-nodes-planning.md       = Flow node, runtime-value, batching, execution, and Tool semantics
docs/db-design-planning-v2.md     = database schema (PostgreSQL, Kysely, camelCase)
docs/api-design-planning-v2.md    = API contract for the base features
docs/mvp-execution-plan.md        = phased MVP implementation order and acceptance gates
docs/observability-planning.md     = deferred production observability and Run Inspector contract
docs/provider-execution-modes.md   = local BYOK, managed execution, and future managed BYOK trust boundaries
docs/credits-planning.md          = credit system planning (Phase 2 — do not implement)
docs/feature-research/            = researched future capabilities; one self-contained file per feature
```

Feature research is evidence and implementation guidance, not approved scope.
Before planning or implementing a researched capability, read its file under
`docs/feature-research/` and reconcile it with the product vision, Flow contract,
database/API designs, and execution plan. Adding a research document must not
silently add the feature to an MVP milestone.

Deprecated documents — do not implement from these; they describe the retired Generate/Projects/Brands/Products/Characters architecture:

```txt
docs/db-design-planning.md
docs/api-design-planning.md
```

Execution rules for the active Flow runtime:

1. Every execution is a `flowRuns` row. M5 supports `node`, `downstream`,
   `upstream`, `selection`, and `all`; `tool` remains a future compatibility
   seam. Every provider/mock request belongs to a durable run item and job.
2. Every successful generation output is persisted as a canonical Asset.
3. Generation provenance is immutable — later edits to Flows or Assets never rewrite historical job inputs.
4. Node and model vocabularies live in code registries, not the database.
5. Costs (`creditCost`, `providerCostUsd`) are recorded on every generation job from day one; no balances or enforcement until the credit system ships.
6. Credits and billing belong in account/header/billing UI, never the main creative navigation.
7. Before changing Flow nodes, handles, planning, execution, iteration, caching,
   Recipes, or Tools, read `docs/flow-nodes-planning.md`. Preserve its distinction
   between an inner typed collection consumed together and outer runtime items
   that represent execution multiplicity.
8. Run admission creates an immutable, bounded `flowRuns.graphSnapshot` only
   after revalidating the captured Flow revision and locking exact Asset inputs.
   Trigger.dev receives tenant-scoped run/job IDs and loads the
   snapshot from PostgreSQL; never execute from mutable Flow rows after admission.
9. A Tool is mutable identity backed by an ordinary editable draft Flow. A
   ToolVersion is an immutable, monotonically numbered published snapshot. Tool
   nodes and runs pin a concrete version; a current-version pointer is only a
   mutable default alias for new invocations.
10. Mock and real providers must implement the same normalized provider
    adapter/result boundary. Graph planning, snapshots, runs, jobs, Trigger.dev
    state, provenance, output ingestion, and canonical Assets remain
    provider-independent and production-shaped.
11. TaleLabs owns one curated, checked-in generation catalog in
    `packages/models-catalog`. `catalog.json` and the explicit
    `models/<media>.json` records assemble into one validated runtime catalog.
    This package is the only maintained source for current model capabilities,
    presentation metadata, defaults, and private provider bindings. Never add
    parallel TypeScript route/model registries,
    provider-discovery snapshots, dated inventories, or runtime configuration
    derived from live provider responses. Research provider documentation, then
    encode the reviewed decision in that catalog and ship it normally.
12. Persist canonical `vendor/model` creative IDs in Flows and snapshots. The
    API exposes only the catalog's sanitized public projection; credentials,
    bindings, fallbacks, evidence, and cost policy remain server-only. Admission
    captures the complete resolved binding so provider changes never rewrite a
    Flow's creative identity or an admitted run.
13. Model capabilities include operation modes, typed slots, settings, and
    cross-field constraints. Do not reduce them to independent input/setting
    lists. If routing across multiple provider endpoints, expose only their safe
    capability intersection unless the route is pinned to a concrete endpoint.

## Generation runtime architecture

The generation runtime must remain understandable as one direct execution path:

```txt
models catalog -> admission/planning -> immutable snapshot -> Trigger.dev
-> provider adapter -> canonical Asset
```

Package and ownership rules:

1. `@talelabs/models-catalog` is one logical source of truth. Splitting its
   records by media category is only a physical organization detail; do not add
   another catalog, route registry, capability registry, database configuration,
   provider inventory, or discovery snapshot beside it.
2. Catalog records use canonical provider-native creative IDs such as
   `bytedance/seedance-2.0`. A model may expose ordered `bindings[]` for multiple
   execution providers. Do not introduce a parallel `routes` concept or branded
   aliases for the same creative model.
3. Creative capabilities and execution bindings are separate concepts.
   Capabilities describe what the model can do. Private bindings describe where
   and how TaleLabs may execute it. The public API exposes only the sanitized
   creative contract.
4. `@talelabs/flows` owns provider-neutral graph values, validation, planning,
   snapshots, and execution contracts. It must not import provider clients,
   provider HTTP payloads, credentials, or transport-specific behavior.
5. Run admission resolves one exact binding according to current catalog and
   policy, then captures the complete resolved binding in the immutable
   snapshot. Workers execute that captured binding and never rediscover routing
   from the mutable current catalog.
6. `@talelabs/trigger` owns durable orchestration, retries, cancellation,
   reconciliation, accounting, and output finalization. Trigger tasks receive
   tenant-scoped IDs, load validated snapshots from PostgreSQL, and do not own
   model capabilities or provider request translation.
7. `@talelabs/providers` owns external provider protocols, HTTP clients,
   request/response translation, lifecycle handling, and a small explicit
   provider registry. Keep each provider in its own cohesive directory. Do not
   create a package per provider or let the root registry become a second model
   catalog.
8. Reuse one adapter for models that share a real provider protocol. Add a
   model-specific adapter only when the external protocol or lifecycle is truly
   different, not merely because settings or model IDs differ.
9. Adding a provider should normally require only its private binding schema,
   its implementation directory and registry entry, and catalog bindings. It
   must not require changes to canvas components, graph planning, run
   persistence, or Asset ingestion.
10. Provider adapters receive credentials through an injected runtime contract;
    they must not read environment variables directly. Platform credentials may
    currently be resolved by server/worker composition, while this seam remains
    ready for future BYOK without implementing BYOK prematurely.
11. Never place raw provider credentials in the catalog, Flow graphs, immutable
    snapshots, run/job rows, Trigger payloads, logs, metrics, API responses, or
    browser state. Provider authentication policy belongs to private runtime
    composition, not individual model bindings.

## Readability and documentation rules

The target architecture is not the most elaborate architecture. It is the
smallest explicit design that remains reliable, extensible, and understandable
to a good developer without AI assistance.

1. A reader must be able to locate a model definition, trace one request through
   the execution path above, identify the owner of each validation rule, and
   find the provider translation without searching through parallel registries
   or speculative abstraction layers.
2. Prefer direct control flow, explicit names, typed data, and narrow module
   boundaries. Reject hidden registration side effects, magic discovery,
   circular ownership, generic configuration engines, and abstractions whose
   behavior requires jumping through several files to understand.
3. Keep one authoritative representation of each fact. Derived projections may
   exist only when generated or validated from that source. Do not manually
   maintain duplicated capabilities, defaults, bindings, request shapes, error
   maps, or UI metadata across packages.
4. Share stable repeated behavior, especially provider protocols, generation
   node primitives, validation, query keys, actions, inspectors, and status
   presentation. Do not create generic abstractions before the repeated contract
   is understood, and do not copy existing behavior to avoid finding its owner.
5. Each file owns one cohesive responsibility and exposes a narrow public API.
   Split by domain ownership rather than by arbitrary numbered fragments. The
   600-line limit and cohesion rules below are guardrails, not substitutes for
   engineering judgment.
6. Every authored TypeScript module begins with a short TSDoc overview explaining
   its ownership and purpose. Use `@packageDocumentation` only for package public
   entry points.
7. Every exported function, type, interface, class, and constant has useful
   TSDoc. Every field of an exported object type or interface documents what the
   field represents, when it is populated, and any important invariant or unit.
8. TSDoc explains contracts, ownership, invariants, units, lifecycle, and the
   reason a boundary exists. It must not merely restate names or narrate obvious
   implementation.
9. Routine function bodies should be self-explanatory and free of narration.
   Add an inline body comment only for a rare algorithmic, concurrency, provider,
   or compatibility constraint that cannot be made clear through names and
   extraction.
10. Reviews must treat unnecessary indirection, duplicate sources of truth,
    provider leakage, repeated UI/business logic, misleading documentation, and
    high extension cost as architecture defects, even when the code compiles.

## Code structure rules

These rules apply to every authored source file. Generated SDK artifacts,
lockfiles, and machine-generated catalogs are not refactoring targets.

1. An authored source file must not exceed 600 physical lines. Split the file
   before it crosses this limit, using domain ownership and single
   responsibility as the boundary rather than arbitrary numbered fragments.
2. Function count is a review signal, not a hard limit. A file may define
   multiple closely related functions, React components, hooks, state actions,
   or query-key factories when they collectively implement one clear domain
   responsibility and are easier to understand together.
3. Split a file when it mixes unrelated workflows or architectural layers,
   exposes a broad or incoherent API, repeats independently useful behavior, or
   forces a reader to scan unrelated code to understand a change. Report the
   concrete responsibility or readability problem, not the raw function count.
4. Do not create thin wrappers, numbered fragments, one-file folders, giant
   classes, oversized anonymous callbacks, or generic dumping-ground helpers to
   make files look smaller. Every extracted module must reduce reasoning cost
   and have a clear owner and narrow public API.
5. Before adding code to a file near the line limit or adding a second domain
   responsibility, extract a cohesive boundary where one exists. Reviews must
   reject spaghetti structure, but must not demand mechanical splitting of a
   cohesive module solely because it contains several functions.

## Environment variable rules

Environment variables are reserved for sensitive values. Agents must not add a
new environment variable for ordinary application or deployment configuration
without the user's explicit approval.

1. Environment variables are appropriate for secrets and sensitive credentials,
   including API keys, access tokens, passwords, private keys, signing secrets,
   and private connection strings.
2. Keep non-sensitive values in typed runtime code configuration. This includes
   versions, feature flags, limits, timeouts, public URLs, bucket names, model
   identifiers, queue names, deployment identifiers, and capability metadata.
3. Prefer code-owned constants, typed configuration modules, and versioned
   registries so non-sensitive behavior is reviewable, searchable, and deployed
   with the code that consumes it.
4. Never introduce an environment variable merely to avoid designing a runtime
   configuration or versioning contract. Automatically discovered runtime
   metadata should be persisted or resolved by code instead of becoming a
   manually maintained environment variable.
5. Existing non-sensitive environment variables are not precedent for adding
   more. Do not expand their use. Refactor them only when the current task calls
   for it, without silently changing deployment behavior.
6. If a platform genuinely requires a new non-sensitive environment variable,
   stop and obtain explicit user approval before adding it.

## Acceptance review rules

Automated tests are not an MVP acceptance requirement. Do not block a task or
milestone review because tests are absent, incomplete, skipped, or failing unless
the user explicitly restores testing as a requirement for that specific task.
Acceptance reviews should focus on implementation correctness, executable
behavior, builds, type safety, linting, generated contracts, focused smoke checks,
and user-owned product QA.

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
10. Before completing a feature, run the catalog check, type-checking, lint, and a production build to catch missing translations and lazy-loading failures.
