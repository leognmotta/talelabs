# TaleLabs Element Consistency Foundation - Implementation Prompt

## Prompt

Implement the foundational Element consistency redesign described in
`docs/elements-consistency-planning.md`.

The product goal is not to expose a reference-management system. The user-facing
experience must remain:

```txt
create an Element -> add references -> use it in a Flow
```

The internal implementation may distinguish source evidence, approved master
references, identity rules, readiness, and model-compatible selection, but users
must not be required to understand those concepts. Optimize for:

1. simple interaction;
2. strong, quiet UX;
3. better identity consistency across AI generation.

This is a foundation change, not the AI-assisted reference-pack feature. Do not
add provider calls, reference analysis, missing-angle generation, consistency
scoring, or automatic replacement of references.

## Before Editing

1. Read `AGENTS.md` completely.
2. Read these source-of-truth documents:
   - `docs/talelabs-product-vision.md`
   - `docs/elements-consistency-planning.md`
   - `docs/flow-nodes-planning.md`
   - `docs/db-design-planning-v2.md`
   - `docs/api-design-planning-v2.md`
   - `docs/mvp-execution-plan.md`
3. Inspect the complete current implementation before proposing edits:
   - `packages/elements/src/**`
   - Element tables and Kysely types in `packages/db/src/**`
   - `apps/api/src/data/elements.data.ts`
   - `apps/api/src/services/elements.service.ts`
   - `apps/api/src/domain/elements/**`
   - `apps/api/src/routes/elements/**`
   - both Flow reference-loading paths in
     `apps/api/src/data/flows.data.ts`
   - Asset registration, reverse Element relations, archive/purge behavior, and
     upload attachment under `apps/api/src/data/assets.data.ts`,
     `apps/api/src/services/assets.service.ts`, and
     `apps/api/src/routes/assets/**`
   - Element forms, detail views, Asset-role UI, queries, upload intents, and
     caches under `apps/dashboard/src/features/elements/**`
   - the global upload manager and Element upload-intent bridge under
     `apps/dashboard/src/features/assets/**`
   - Element Flow-node hydration and rendering under
     `apps/dashboard/src/features/flows/**`
4. Inspect the dirty worktree and preserve all existing user and other-agent
   changes. Do not revert, overwrite, or reformat unrelated work.
5. Read the project skills relevant to Kysely, Hono, React, TanStack Query,
   React Hook Form, React Flow, i18n, and React performance before editing.
6. Produce a short implementation plan tied to the current files. Do not invent
   a parallel Element system or a second Asset library.

## Architectural Contract

An Element remains a model-independent source of truth:

```txt
Element
├── identity guidance
├── source evidence
└── approved master references
```

Flows consume approved masters only. Raw sources remain canonical Assets linked
to the Element, but they never silently reach a provider or appear in normal
Element role outputs.

The Element Flow-node shape does not change:

```txt
context -> ElementContext
role    -> ImageSet | VideoSet | AudioSet
```

One handle continues to represent one typed collection. Never create one handle
per Asset.

## Persistence Changes

Create the next additive database migration following repository conventions.

Add to `elementAssets`:

```sql
"referenceKind" text not null default 'master'
  check ("referenceKind" in ('source', 'master'))
"referenceMetadata" jsonb not null default '{}'
check ("referenceKind" <> 'source' or not "isPrimary")
```

Requirements:

- Existing rows become `master` and preserve current behavior.
- Supported kinds are exactly `source` and `master` for this phase.
- Do not add `approvalStatus`, persisted readiness, or an audit-history claim.
- Keep `role`, `sortOrder`, and `isPrimary` as the semantic relationship data.
- Treat `sortOrder` as an application-enforced sequence within
  `(organizationId, elementId, role, referenceKind)`. Existing master ordering is
  preserved. Promotion/demotion removes the link from one sequence, normalizes
  that sequence, and inserts it into the destination sequence at an explicit
  target or at the end. Source ordering must never create gaps or unexpected
  movement in the visible master ordering.
- A source must never be primary. Enforce this structurally with the row-local
  check above and transactionally in application code. Demoting a primary master
  to source clears its primary state in the same transaction. Preserve the
  existing `elementAssetsPrimaryIdx` partial unique index: together these
  constraints make `primary` structurally mean one primary master per role.
- Master capacity remains per role using the registry's `maxAssets` value.
- Master-capacity queries count masters only.
- Sources use one bounded, organization-safe, element-wide cap from shared code
  configuration. Start with the planned limit of 50 unless current repository
  constraints justify a lower value. This is abuse protection, not visible
  product vocabulary.
- Add one element-level advisory-lock helper for the source cap, keyed by
  organization and Element. Keep the existing role-level advisory lock for
  master capacity, keyed by organization, Element, and role.
- Any mutation that needs both locks takes them in one fixed order: Element lock
  first, role lock second. Source attachment takes the Element lock and enforces
  the source cap. Master attachment takes the role lock and enforces master
  capacity. Promotion takes both, decreases the source set, and enforces the
  destination role's master capacity. Demotion takes both, clears primary,
  decreases the master set, and enforces the element-wide source cap. Document
  this order next to the helpers so later code cannot introduce a deadlock by
  reversing it.
- Preserve tenant-safe composite foreign keys and organization predicates on
  every read and mutation.
- Add only indexes justified by the actual master-filtered and Element-detail
  queries. Explain each new index in the migration or planning documentation.
- Update Kysely database types and every affected projection explicitly.
- `referenceMetadata` is a database `not null` column with a server default. It
  is never a required client field; omitted API values resolve to `{}`.

Do not add `elements.revision` early merely as part of this migration. Preserve
the existing plan to add it with M5 run admission. Update the M5 contract so
mutations to `referenceKind` and execution-relevant `referenceMetadata` increment
the revision in the same transaction.

## Identity Guidance

Add a shared, versioned identity block to specialized Element data schemas:

```ts
type ElementIdentity = {
  summary: string
  mustKeep: string[]
  mayVary: string[]
  avoid: string[]
}
```

Requirements:

- Add a shared Zod schema with conservative lengths and item-count limits.
- Advance every affected Element type's schema version.
- Retain every historical schema unchanged.
- Add a gap-free sequential in-code migration for every version transition.
- Migrations initialize the identity block safely; do not eagerly rewrite all
  stored JSONB rows in SQL.
- Dedicated type forms and dedicated API context builders remain. Do not build
  a generic form DSL.
- Context builders include non-empty identity guidance deterministically and do
  not duplicate empty headings or UI translations in provider context.
- Preserve type-specific fields such as product selling points, character
  personality, brand colors, and voice guidance.

### Simple UI Boundary

Do not expose the four internal arrays as a required questionnaire.

For this phase, the only new user-facing control is one optional natural-language
field:

```txt
Consistency notes
What should always remain recognizable?
```

Map that field to `identity.summary`. Keep `mustKeep`, `mayVary`, and `avoid`
available internally for later AI extraction, but initialize them empty and do
not force users to maintain them.

Only `name` remains required during Element creation. One valid reference must
make the Element immediately usable. Do not add a creation wizard, mandatory
angle labeling, quality score, pack-approval step, or model selector.

All normal Element uploads and existing-Asset attachments continue to create
`master` links by default. Do not expose `source`, `master`, promotion, or
reference metadata terminology in the current creation/edit UI. The future
consistency assistant will introduce source ingestion when it can curate it.

Add one localized, non-blocking hint next to Element reference upload surfaces:

```txt
Clean, well-lit references with one clear subject work best.
```

Do not validate or reject media against this guidance in this phase.

## Reference Metadata

`referenceMetadata` is relationship-specific interpretation, not general Asset
metadata. Keep intrinsic facts such as width, duration, and technical processing
metadata on the canonical Asset.

Define a framework-neutral, registry-owned validation boundary for supported
relationship metadata. Initial common fields may include:

```ts
{
  view?: 'front' | 'threeQuarter' | 'profile' | 'rear'
  framing?: 'portrait' | 'halfBody' | 'fullBody' | 'detail'
  background?: 'clean' | 'environment'
  variant?: string
}
```

Requirements:

- Validate input through shared code, not arbitrary unchecked JSON.
- Reject unknown keys and invalid values.
- Keep the default `{}` valid for every current role.
- Do not add manual metadata controls to the current UI. The future consistency
  assistant may infer metadata and let users correct mistakes.
- Do not store signed URLs, provider upload IDs, credentials, or ephemeral data.

## API And SDK

Update the Element Asset contracts and generated SDK:

- Responses include `referenceKind` and validated `referenceMetadata`.
- Create-link requests accept them only where needed, defaulting omitted
  `referenceKind` to `master` and metadata to `{}`.
- Update-link requests can promote/demote and update metadata atomically with
  role/order/primary changes.
- Use stable machine-readable error codes for source capacity, master role
  capacity, invalid metadata, and invalid primary state.
- Keep all endpoints organization-scoped and preserve existing authorization.
- Avoid read-modify-write races. Capacity checks and mutations belong in one
  transaction under the existing Element/role locking discipline.
- Regenerate OpenAPI/Kubb outputs. Never hand-edit generated SDK files.

Preserve compatibility for current dashboard callers by making new create-link
fields optional with server defaults.

## Cross-Feature Impact Audit

Treat this as a relationship-model change that crosses Assets, Elements, Flows,
uploads, and future execution. Do not report completion until every path below
has been inspected and either changed or explicitly shown to be unaffected.

### Asset System

- Update the atomic upload-registration path in `apps/api/src/data/assets.data.ts`.
  Its optional Element attachment must use the same defaults, metadata validation,
  lock order, capacity rules, and primary invariant as attaching an existing Asset.
  Do not create two implementations of link policy.
- Prefer one shared transactional policy/helper used by upload registration,
  existing-Asset attachment, promotion/demotion, and future generated-Asset
  attachment. Do not let the Asset and Element data modules drift.
- Asset records remain canonical and are never duplicated into Elements. Source
  and master links point to the same Asset table and use the existing Element
  folder organization.
- Asset archive and purge semantics remain unchanged. Archived Assets may remain
  linked; purging/purged/failed/processing media must not become executable Flow
  candidates. Do not delete relationship or provenance rows merely because bytes
  are archived or purged.
- Asset detail reverse relations must include enough relationship information to
  distinguish source/master and role without exposing internal storage data.
  Usage counts include both kinds because both are real Element relationships.
- Audit Asset optimistic updates, detail/list caches, Element kit caches, preview
  caches, and Flow-reference caches. Any kind/metadata/primary/order/role change
  must invalidate every presentation derived from that relationship.
- Preserve the dashboard-level Zustand upload queue. Current intents may omit
  `referenceKind` and receive the server-side `master` default. Do not persist
  Files or sensitive upload state merely to support the new fields.

### Element System

- Update create, attach, update, reorder, primary, detach, custom-role mutation,
  preview, detail, readiness, and context paths. Master counts and source counts
  are separate policies even if they share one table.
- Element list/detail preview selection uses usable masters only: ready media,
  primary first, then stable role/order/Asset-ID ordering.
- Normal role ordering and primary interactions continue to operate on visible
  masters. Hidden source media must not unexpectedly shift the visible master
  ranking. Define and reuse the ordering semantics instead of leaving each query
  to interpret `sortOrder` differently.
- Role removal or media-family changes must account for links of both kinds and
  preserve the existing fail-closed registry/versioning behavior.
- Element detail may load both kinds for future curation, but the current user
  surface renders only References (masters). Do not silently count hidden sources
  against visible role capacity in React.

### Flow System

- Filter to masters in both authoritative server paths:
  `listFlowGraphReferenceRows` for graph validation and
  `listFlowGraphHydrationRows` for dashboard hydration.
- Update Flow response/link schemas and dashboard reference types only if they
  genuinely need the new fields. Do not send raw sources to the canvas simply
  because Element detail returns them.
- Element node handles remain stable typed collections. A kind change may alter
  candidates but never add/remove one handle per Asset.
- Auto selection, manual selection validation, Element preview, and model input
  counts see masters only. If a manually selected Asset is demoted, it becomes an
  invalid candidate and the existing Flow-reference cache must refresh so the UI
  can request a replacement.
- Reconcile this work with the Flow reference-budget invariant: adding sources
  must not consume `referenceAssets`/`referenceLinks`, while master promotion must
  not allow a persisted Flow to become impossible to hydrate. Reuse one budget
  calculation rather than duplicating limits between graph sync and `/references`.
- Future run and Tool snapshots capture exact selected master Asset IDs, resolved
  Element identity/context, relationship metadata used for selection, and Element
  revision. They never capture source media, signed URLs, or storage keys.

### Search, Organization Isolation, And Presentation

- Global search and the Asset library continue to search canonical Assets. Do not
  create a separate searchable copy for Element references.
- Every new query and mutation carries organization scope, including joins and
  advisory-lock keys. Cross-organization identifiers must remain indistinguishable
  from missing resources.
- Keep signed URLs in presentation services only. Neither `referenceMetadata` nor
  Element identity JSON may contain URLs, credentials, provider IDs, or secrets.
- Update all affected i18n keys naturally across every supported locale. Shared
  packages and API data never store translated UI strings.

## Master-Only Runtime Behavior

Audit every path that resolves Element references. Filter to
`referenceKind = 'master'` in the authoritative server query, not only in React.

This includes at least:

- `buildElementContext` and its underlying data query;
- Element role-handle hydration;
- `listFlowGraphReferenceRows`;
- `listFlowGraphHydrationRows`;
- graph limits that count Element reference Assets;
- Element preview selection;
- default reference ordering and primary selection;
- future run-snapshot planning contracts in the docs.

Raw source links must not:

- appear in Element role output sets;
- affect model input limits;
- become preview thumbnails;
- count against master role capacity;
- silently enter graph snapshots or provider payloads.

Element detail APIs may return both kinds for future curation, but current UI
should continue presenting active References only unless an explicit internal
filter is requested. Do not create a second Asset library.

## Derived Readiness

Readiness is computed, never persisted.

Add a registry-owned, framework-neutral evaluator shaped approximately as:

```ts
type ElementReadiness = {
  state: 'empty' | 'usable' | 'strong'
  missing: string[]
  recommendations: string[]
}
```

Requirements:

- `empty`: no usable master reference for the Element's relevant roles.
- `usable`: enough approved master context to use immediately.
- `strong`: only when type-specific evidence genuinely supports that claim.
- Do not infer a strong Character pack from image count alone when view/framing
  metadata is absent.
- Use stable recommendation IDs or translation keys, not English strings in the
  shared package.
- Avoid N+1 queries. Reuse already loaded Element and master-link data.
- Expose readiness only where it improves the current UX. Use quiet language
  such as `Ready to use` or `Can be improved`; never make an optional consistency
  recommendation look like a blocking error.
- Do not add a status dropdown or persisted status column.

If strong readiness cannot be presented honestly before inferred metadata
exists, implement the evaluator and API contract but keep the dashboard to the
honest `Ready to use`/empty distinction for now.

## Dashboard UX

Preserve the current polished Element creation, listing, detail, and edit
surfaces. Integrate narrowly.

Required visible behavior:

- One optional localized Consistency notes field.
- Existing reference upload/attach interactions behave as before.
- One uploaded reference is enough to proceed.
- No additional required confirmation after uploads.
- Show the single clean/well-lit/single-subject hint without making it an error.
- No technical source/master language.
- No mandatory classification or tagging.
- No AI-generated suggestions in this phase.
- No permanent banner telling every user their Element is incomplete.

Use progressive disclosure. The future experience documented in
`docs/elements-consistency-planning.md` may add `Improve consistency`, collapsed
source media, and one visual recommendation screen only when those capabilities
are real.

Preserve the existing improvement loop: a future successful generation may be
explicitly added to an Element's references. Do not implement that future run UI
as part of this task.

Document the later `@Element` mention interaction for prompt composers as a
future low-friction entry point. Do not implement mentions in this task.

## Documentation

Reconcile the implementation with all source-of-truth documents. Update them so
they consistently state:

- Elements are a consistency system.
- normal current uploads create masters directly;
- source ingestion and AI pack building are deferred;
- only masters reach Flow role outputs;
- source and master capacities differ;
- readiness is derived;
- identity schema changes use sequential migrations;
- `elements.revision` remains an M5 run-admission consistency guard and covers
  all execution-relevant identity and link changes.

Do not silently expand an MVP milestone beyond this foundation.

## Explicit Non-Goals

Do not implement:

- OpenRouter or provider calls;
- AI source analysis;
- face recognition or identity scoring;
- reference quality scores;
- automatic angle/framing detection;
- generation of missing views;
- contact-sheet generation;
- automatic source-to-master promotion;
- a multi-step Element wizard;
- manual metadata editors;
- provider/model selection inside Elements;
- voice cloning or training;
- LoRA, embeddings, provider-owned identity profiles, or fine-tuning;
- a second Asset store;
- billing or credits;
- automated tests as an acceptance requirement.

The repository already has a funded `OPENROUTER_API_KEY`. Its presence is not
authorization to spend credits. Do not read, print, validate, rotate, expose, or
use that key in this task. The AI consistency assistant and all paid provider
calls require a separate explicitly authorized implementation phase with spend
controls.

## Verification

Before reporting completion:

1. Generate the SDK and confirm no temporary generation directories remain.
2. Run all repository type-check tasks.
3. Run `npm run i18n:check` and confirm every supported locale has natural copy.
4. Run repository lint.
5. Run the production build.
6. Run `git diff --check`.
7. Inspect the final diff for unrelated changes and generated-file churn.
8. Add one repeatable, explicitly invoked verification script following existing
   repository script conventions. This is not a new general test harness; it is
   the reproducible acceptance record for the relationship invariants. It must
   fail closed, use an isolated development/test organization, clean up the data
   it creates, and never call an AI provider. Cover:
   - existing rows presented as masters;
   - source attachment and source-cap enforcement;
   - promotion under master-role capacity;
   - demotion of a primary master;
   - source exclusion from Flow hydration and context;
   - cross-organization rejection;
   - invalid metadata rejection;
   - upload registration with atomic Element attachment;
   - database rejection of a primary source;
   - fixed lock-order behavior under concurrent promotion/attachment attempts.

UI and end-to-end product QA remain user-owned. Report what changed, migration
behavior, verification results, residual risks, and any intentionally deferred
work. Do not push or commit unless explicitly requested in the current message.
