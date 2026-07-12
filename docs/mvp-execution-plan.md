# TaleLabs MVP Execution Plan

This document turns the approved TaleLabs product, database, and API designs into small implementation sessions. It defines implementation order and acceptance gates; it does not replace the source-of-truth designs.

Read these before starting any task:

```txt
AGENTS.md
docs/talelabs-product-vision.md
docs/db-design-planning-v2.md
docs/api-design-planning-v2.md
docs/mvp-execution-plan.md
```

`docs/credits-planning.md` is relevant only when the plan reaches billing and credits. Do not implement from the deprecated v1 database or API documents.

## Objective

Build and validate the first TaleLabs creative loop:

```txt
Upload or find an Asset
-> optionally create an Element
-> create or open a Flow
-> connect Text, Asset, Element, and Image/Video/Audio Generation nodes
-> validate the complete runtime with deterministic provider mocks
-> replace only the provider boundary with controlled real integrations
-> persist the output as an Asset
-> reuse that output in the same or another Flow
```

The engine phase proves this loop for image, video, and audio without spending on
AI generation. Inputs, graph state, snapshots, runs, jobs, Trigger.dev execution,
provenance, and canonical output Assets are real. Only the provider submission
and response are mocked. Real provider integrations begin only after that shared
runtime is stable.

## Product Scope

The primary MVP navigation is:

```txt
Assets
Elements
Flows
```

The implementation order is mandatory unless the user explicitly changes the product direction:

```txt
1. Database foundation
2. API foundation
3. Assets and folders
4. Elements
5. Flows, graph editing, and image/video/audio generation-node configuration
6. Provider-independent run engine using deterministic mocks
7. Controlled real-provider integration
8. Complete iteration, reliability, and internal MVP staging
9. Billing and credits in a separate productization phase
```

Explicitly deferred from the MVP:

```txt
Tools
Recipes
Storyboard
simple Generate page
collaboration and comments
Flow version history
triggers, schedules, and webhooks
editor or cuts
public API and MCP
public galleries and links
projects
credits, subscriptions, and Stripe billing
```

The initial database includes `flowRuns` and `flowRunNodes` because every
execution belongs to a run from day one. M5 explicitly authorizes the bounded
engine semantics listed there, including full-flow execution and explicit
iteration primitives. It does not authorize triggers, schedules, arbitrary
conditionals, or a general automation language.

## How To Execute A Task

Use one task per AI session unless the task explicitly states otherwise.

For every implementation task:

1. Read the source-of-truth documents and the relevant package `AGENTS.md` files.
2. Inspect the current implementation and dirty worktree before editing.
3. Implement only the task's stated scope.
4. Add implementation validation proportional to the change.
5. Run the listed non-test checks and focused smoke checks required by the task.
6. Review the diff for accidental scope expansion or generated-file mistakes.
7. Update the database/API design documents only when implementation proves that an approved contract is impossible or incorrect.
8. Report exactly what was verified and what remains for user QA.
9. Stop when the acceptance criteria are met.

When a task implements behavior that stands in for a future external AI
provider, mark the exact replacement boundary with this searchable comment:

```ts
// TODO(provider-integration): Replace this deterministic mock with the real
// provider adapter in M6; preserve the normalized request/result contract.
```

Use the comment only at the adapter or fixture-response boundary, not throughout
ordinary engine code. Mock planners, alternate schemas, or mock persistence are
forbidden: the provider response is mocked, not TaleLabs architecture. M6 must
remove every applicable `TODO(provider-integration)` as each adapter becomes
real, and its acceptance review must inventory any markers intentionally left.

Do not combine a backend contract, a large UI implementation, and a visual-polish pass into one session.

## QA And Design Ownership

The AI owns implementation and objective engineering verification. The user owns product QA, browser acceptance, and subjective UI/design critique.

The AI must:

- Run relevant type checks, builds, API contract checks, and focused smoke checks.
- Start the application when browser testing by the user is required.
- Provide the local URL and a concise handoff checklist.
- Report unverified failure modes and external-provider limitations.
- Stop after engineering verification instead of self-approving the product experience.

The AI must not:

- Declare user QA complete.
- Mark an `Owner: User` gate complete.
- Substitute its own visual opinion for user acceptance.
- Add UI polish or extra features that were not requested by the active task.
- Treat a Playwright screenshot as product approval.

The normal screen-delivery rhythm is:

```txt
AI: backend contract
-> AI: functional UI plus engineering verification
-> User: browser QA and UI/design critique
-> AI: narrowly scoped corrections requested by the user
```

## Definition Of Done

An AI-owned task is ready for user QA only when:

- Its acceptance criteria are satisfied.
- Relevant builds, type checks, contract generation, and smoke checks pass.
- Tenant-owned operations are scoped by `organizationId`.
- Cross-tenant identifiers return tenant-safe `404` responses.
- API changes are represented in OpenAPI.
- `@talelabs/sdk` is regenerated when OpenAPI changes.
- Generated SDK files are not edited manually.
- Loading, empty, error, and success states exist where relevant.
- Long-running work is durable and idempotent where required.
- No unrelated user changes were reverted.
- Deferred features were not pulled into the task.
- The final handoff states what the user should validate.

User QA should cover the relevant subset of:

```txt
desktop and mobile layout
keyboard navigation and focus
empty, loading, error, populated, and destructive states
long names and text
missing, processing, failed, archived, and purged media
slow uploads and slow generation
refresh and direct URL behavior
browser console and network failures
text overflow and incoherent overlap
```

Automated tests are not an MVP acceptance requirement. Their absence or failure must not block a milestone acceptance review unless the user explicitly restores that requirement for a specific task. Reviews should focus on implementation correctness, executable behavior, builds, type safety, generated contracts, smoke checks, and user-owned QA.

## Milestones

| Milestone               | Outcome                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| M0: Database foundation | The complete v2 schema migrates and its structural tenant/data guarantees are inspectable.                                 |
| M1: API foundation      | Product routes have one tenant-safe Hono/OpenAPI/SDK foundation.                                                         |
| M2: Assets              | Private uploads become durable, processed, searchable, organized, and reusable Assets.                                   |
| M3: Elements            | Generic reusable context with typed data and role-based Asset kits works end to end.                                     |
| M4: Flows               | Users build valid graphs with real inputs and capability-aware Image, Video, and Audio Generation nodes.                  |
| M5: Mock run engine     | The production-shaped runtime executes node/full-flow scenarios against deterministic provider mocks without AI spend.    |
| M6: Provider integration | Approved image, video, and audio adapters replace mocks without changing graph, run, job, provenance, or Asset contracts. |
| M7: MVP candidate       | The integrated creative loop passes tenant, reliability, staging, engineering, and user-acceptance gates.                |

---

## M0 - Database Foundation

### E-001 - Implement And Run The V2 Database Migration

**Status:** Next

This is the first implementation task.

**Scope**

- Create the next migration after the repository's current `003_user_locale.ts`, expected to be `004_talelabs_core.ts`.
- Implement the complete initial schema from `docs/db-design-planning-v2.md`.
- Add matching Kysely table interfaces to `packages/db/src/schema.ts` and register them in `Database`.
- Preserve quoted camelCase physical identifiers; do not add `CamelCasePlugin`.
- Implement a complete `down` migration in reverse dependency order.
- Run the migration against the development database.
- Do not add routes, repositories, fixtures, seed data, Trigger.dev tasks, or UI.

**Required creation order**

```txt
folders
flows
flowRuns
generationJobs
flowRunNodes
assets
elements
elementAssets
flowNodes
flowEdges
generationJobSources
generationJobInputs
```

`flowRuns` and `flowRunNodes` are part of this migration even though only `mode = 'node'` is exposed initially.

**Acceptance criteria**

- A clean database migrates through `004` successfully.
- Re-running the migrator reports no pending migration and changes nothing.
- Every table, composite tenant FK, check constraint, unique constraint, and index from the v2 database design exists.
- The schema includes the Asset processing and deletion lifecycles.
- `generationJobs.flowRunId` is required from day one.
- The Kysely `Database` type contains every new table without `any`.
- The existing Better Auth and organization schema remains functional.
- The down migration succeeds only on a disposable database.

**Checks**

```bash
npm run build -w @talelabs/db
npm run db:migrate
npm run check-types -w @talelabs/db
```

Also inspect PostgreSQL metadata for tables, indexes, FKs, and checks. Exercise `down` only against a disposable database, never against shared or production data.

**M0 gate**

The complete v2 schema exists, migrates cleanly, and exposes the approved structural guarantees before product API work begins.

---

## M1 - API Foundation

### E-003 - Harden The Product API Foundation

**Status:** Blocked by M0

**Scope**

- Use the existing `organizationMiddleware` for every new product route.
- Add shared cuid2, pagination, cursor, lifecycle, and error schemas required by the v2 API.
- Implement the opaque cursor codec and sort/order mismatch validation.
- Preserve the existing Hono route/schema/service/data boundaries.
- Do not add a product CRUD endpoint yet.

**Acceptance criteria**

- Product routes cannot run without an active organization.
- Cross-tenant resources remain indistinguishable from missing resources.
- Common errors match `docs/api-design-planning-v2.md`.
- `/openapi.json` remains valid.

**Checks**

```bash
npm run build -w api
npm run sdk:generate
npm run build -w @talelabs/sdk
```

**M1 gate**

New product routes can use one tenant-safe Hono/OpenAPI/SDK foundation without bundling any product CRUD.

---

## M2 - Assets And Folders

Assets are implemented before Elements and Flows because every upload, reusable reference, input, and generated output depends on them.

### E-010 - Verify And Harden The R2 Storage Boundary

**Status:** Blocked by M1

**Scope**

- Run the documented R2 spike for presigned `PUT` with `If-None-Match: *`.
- Verify whether R2 accepts and returns the required SHA-256 checksum; select the documented MD5 fallback if it does not.
- Finalize the accepted checksum algorithm in code configuration without changing the API's algorithm/value shape.
- Configure browser upload CORS for the exact signed headers and methods.
- Add tenant-safe object-key builders for uploads, originals, generated outputs, and deterministic thumbnails.
- Keep credentials in environment variables; keep non-sensitive bucket names and product policy in code configuration.
- Keep all MVP media private and expose only signed URLs.

**Acceptance criteria**

- A browser-compatible presigned upload can write an object exactly once.
- A mismatched checksum or second PUT is rejected by R2.
- `HEAD`, signed inline read, attachment download, and delete are verified.
- Object keys cannot collide across organizations.
- The deterministic thumbnail suffix is `thumbnails/{assetId}` within the tenant-safe prefix.

**Checks**

```bash
npm run check-types -w @talelabs/storage
npm run build -w @talelabs/storage
```

### E-011 - Implement Upload Grant And Asset Registration API

**Status:** Blocked by E-010 and E-003

**Scope**

- Implement `POST /uploads` and base `POST /assets` exactly as documented.
- Bind organization, user, key, MIME, size, checksum algorithm/value, and expiry into the signed stateless grant.
- Verify object metadata with R2 before registration.
- Make registration idempotent by grant ID with the documented replay semantics.
- Insert uploads with `processingState = 'processing'`.
- Initially support ordinary registration; add the optional Element attachment atomically in E-022 when the Element registry/API exists.
- Regenerate the SDK.

**Acceptance criteria**

- Invalid, expired, cross-tenant, missing-object, wrong-size, wrong-MIME, and wrong-checksum grants fail safely.
- Replaying one grant returns the original Asset and creates no duplicate.
- Storage keys and signed grant contents never appear in public Asset responses.
- The returned Asset clearly reports its processing state.

### E-012 - Implement Durable Asset Ingestion Orchestration

**Status:** Blocked by E-011

**Scope**

- Add the Trigger.dev ingestion task with an explicitly global `idempotencyKey` derived from `assetId` for both initial dispatch and reconciliation, plus ID-only payloads.
- Implement guarded `processing -> ready|failed` transitions and safe processing errors.
- Add reconciliation for Assets stuck in processing.
- Guard task completion with `purgeRequestedAt IS NULL`.
- Use deterministic thumbnail keys and clean artifacts when ingestion loses the purge race.
- Ensure purge deletes the deterministic thumbnail key unconditionally, even when `thumbnailKey` was never persisted.
- Start with a fake media processor so orchestration, retries, and races can be tested without FFmpeg concerns.

**Acceptance criteria**

- A lost dispatch is redispatched without creating duplicate tasks.
- Duplicate task attempts do not produce duplicate metadata or thumbnails.
- Failed media becomes `failed` with a safe error.
- Purging during ingestion cannot resurrect the Asset or leave a thumbnail orphan.

### E-013 - Add Real Media Probing And Thumbnails

**Status:** Blocked by E-012

**Scope**

- Add real processors for the upload types approved by the MIME allow-list.
- Extract image dimensions and thumbnails.
- Extract video dimensions, duration, codec metadata, and poster frames.
- Extract audio duration and relevant technical metadata; do not build an editor or music-analysis product.
- Keep processor-specific code behind one ingestion interface.
- Update Trigger.dev build configuration only as required for native tools such as FFmpeg.

**Acceptance criteria**

- Valid image, video, and audio fixtures reach `ready` with correct metadata.
- Corrupt or mislabeled fixtures reach `failed`.
- Original media is never modified.
- Processor retries are deterministic.

### E-014 - Implement Asset Read And Download API

**Status:** Blocked by E-011 and E-003

**Scope**

- Implement `GET /assets`, `GET /assets/:id`, `GET /assets/:id/usage`, and `GET /assets/:id/download`.
- Implement stable cursor pagination, documented filters/sorts, tenant-safe signed URLs, and tombstone rendering.
- Implement per-user favorites, workspace tags, and their canonical Asset-list filters.
- Keep list responses lean and detail responses render-complete.
- Expose processing and lifecycle states without exposing storage keys.
- Regenerate the SDK.

### E-015 - Implement Asset Lifecycle And Purge API

**Status:** Blocked by E-012 and E-014

**Scope**

- Implement rename/move, archive, restore, and permanent purge endpoints.
- Implement the durable purge task and reconciliation sweep.
- Enforce the row-lock ordering and active-generation guard from the API design.
- Delete original and deterministic thumbnail objects before setting `purgedAt`.
- Preserve tombstone rows and immutable provenance.

**Acceptance criteria**

- Archive/restore is reversible until purge starts.
- Purge is idempotent and storage-confirmed.
- Purge cannot destroy an input used by a pending/running generation.
- Purged Assets disappear from lists but remain renderable as tombstones by detail/provenance queries.

### E-016 - Implement Folders API

**Status:** Blocked by E-014

**Scope**

- Implement folder list/create/rename/move/delete.
- Enforce cycle prevention, 32-level maximum depth, and the 500-folder MVP organization cap. Add paginated or folder-scoped metadata before raising it.
- Preserve Assets when folders are deleted by moving them to root through FK behavior.
- Verify tenant isolation and tree constraints through focused smoke checks.

### E-017A - Build Upload UI And Processing Feedback

**Status:** Blocked by E-011, E-013, and generated SDK updates

Implement file selection, checksum calculation, direct-to-R2 upload progress, registration, cancellation, and processing/failed/ready feedback. Do not build the full library in this task.

### E-017B - Build Asset Library And Detail UI

**Status:** Blocked by E-014 and E-017A

Implement grid/list foundations, search, type/source/tag/favorite filters, favorite actions, tag creation and assignment, stable pagination, preview/playback, technical metadata, processing states, download, and an Asset detail surface. Keep the experience media-aware and drive-like.

### E-017C - Build Folder And Lifecycle UI

**Status:** Blocked by E-015, E-016, and E-017B

Implement folder navigation and management, move-to-folder, rename, archive, restore, and explicit permanent-deletion confirmation. Reuse the same Asset components instead of creating per-screen media variants.

### E-018 - Assets User QA And UI Critique Gate

**Status:** Blocked by E-017C

**Owner:** User

The user validates the complete Asset workflow with mixed media, long names, nested folders, tags, personal favorites, processing and failed media, missing previews, slow uploads, archived/purged states, keyboard operation, and desktop/mobile layouts. Findings become separate implementation tasks.

**M2 gate**

A user can upload private image/video/audio media, see durable processing states, find it again, inspect it, organize it with folders and tags, favorite it personally, download it, archive/restore it, and permanently purge it.

---

## M3 - Elements

Elements are generic reusable AI context. Do not restore separate Brand, Product, or Character tables or navigation.

### E-020 - Create The Element Type Registry Foundation

**Status:** Complete

**Scope**

- Create the shared registry boundary used by API and dashboard.
- Keep only stable IDs, version-specific schemas, sequential migrations, preview roles, Asset roles, and accepted media types in the framework-neutral shared registry.
- Keep React form components in the dashboard and server-only `buildContext` implementations out of the browser bundle.
- Give every registered Element type a dedicated React Hook Form component and a dedicated server context builder. The shared registry is not a generic form renderer or field-definition language.
- Do not store user-facing English display copy in shared Element definitions. Resolve type, field, and Asset-role labels/descriptions from stable IDs or translation keys in the dashboard, add the keys to every supported locale, and keep UI localization separate from server-generated model context.
- Implement explicit version-specific schemas and gap-free sequential migrations (`v1 -> v2 -> v3`); validate the stored version before upcasting and the current result afterward.
- Reject unknown future versions and invalid or unsupported historical payloads safely; create/update writes only the current version while reads may upcast in memory.
- Keep the generic API and JSONB persistence independent of the number of registered types; adding a type requires its shared schema, dedicated dashboard form, dedicated API context builder, roles, and localized dashboard copy.
- Encode the approved role examples, including character appearance/expression/motion/voice and product packshot/detail/lifestyle/demonstration.
- Register the `Other` escape-hatch type with a versioned custom-role list capped at three roles; custom roles accept image, video, and audio while specialized types retain product-controlled roles.
- Add startup validation for registry configuration.

### E-021 - Implement Elements CRUD API

**Status:** Complete

Implement list/create/detail/update/delete with registry-based data validation, immutable type, schema-version stamping/upcasting, preview metadata, usage counts, tenant isolation, OpenAPI, and SDK generation. Creation transactionally provisions a collision-safe child under the workspace's stable Elements root and stores the folder ID on the Element; renaming or deleting the Element does not rename or delete that folder.

### E-022 - Implement Element Asset-Kit API

**Status:** Complete

**Scope**

- Implement the Element Asset subresource with role, order, and primary state.
- Enforce role/media compatibility and the one-primary-per-role invariant.
- Enforce capacity independently per Element Asset role: image roles accept up to eight Assets, while video and audio roles accept one by default. Check role capacity transactionally in both attach and upload-registration paths. These are reusable-context limits; model-specific selection remains a Flow concern.
- Keep Assets canonical; linking/unlinking never copies or deletes media.
- Complete the optional `elementId` + `role` path in `POST /assets` so upload registration and link insertion are one transaction.
- Place newly uploaded Element Assets in the Element's stored folder. If folder deletion cleared the relationship, recreate it lazily during registration. Never move or copy an existing Asset when it is linked to another Element.
- Permit processing Assets to be attached for upload UX, but generation resolution must never submit a non-ready Asset.

### E-023 - Implement Element Context And Usage Services

**Status:** Complete

- Implement server-only `buildElementContext` for the initial Element types, returning upcasted schema version, deterministic resolved text, and ordered candidate Asset IDs with role, order, primary state, media type, and MIME type.
- Exclude processing, failed, purging, and purged Assets from executable candidates.
- Return stable IDs and metadata only; never return storage keys or signed URLs, because M5 snapshots IDs and resolves provider-facing access only at execution time.
- Implement the bounded `GET /elements/:id/usage` response.
- Verify multiple Elements, multiple Assets per role, exclusions, primary selection, and deleted/failed references.

### E-024A - Build Element List And Data UI

**Status:** Complete

Implement Element list/create/detail/delete and dedicated type forms. Every creation form has exactly two sections (`Data` and `Assets`), keeps Data intentionally compact, and resolves all presentation copy in the dashboard.

`Other` asks only for name and instructions. Its Assets section lets the user add, name, and remove up to three custom roles before creation.

### E-024B - Build Element Assets UI

**Status:** Complete

Implement the Assets tab with role sections, primary selection, ordering, upload-and-attach, existing Asset picker, unlinking, processing feedback, and shared Asset previews.

Creation drop zones retain role-aware `File` objects locally without uploading. Only after successful Element and folder creation do they transfer to the organization-scoped, non-persisted Zustand upload queue. Queue intents retain the returned `assetFolderId`, Element ID, role, order, and primary metadata across route navigation. The bounded worker owns the local `queued`, `hashing`, `uploading`, `registering`, `linking`, `completed`, and `failed` states; after canonical Asset registration it checkpoints `assetId`, so a failed Element link retries only the link and never uploads the file again. Trigger.dev processing continues independently and is reflected through organization-scoped Asset queries rather than the local upload queue.

Creation and detail Asset controls expose and prevalidate each role's capacity: eight Assets for an image role and one for a video or audio role by default. The API remains authoritative when concurrent actions race.

### E-025 - Elements User QA And UI Critique Gate

**Status:** Ready for user QA

**Owner:** User

The user validates Character and Product Elements, typed forms, long instructions, mixed-media kits, primary Assets, processing/failed references, upload-and-attach, and responsive behavior.

**M3 gate**

A user can create reusable Character and Product context, attach canonical Assets by semantic role, and retrieve deterministic server-built context without introducing separate domain systems.

---

## M4 - Flows And Manual Graph Editing

Flows are the primary product surface. The first version is a manual visual creative process, not an automation engine.

### E-030 - Create The Flow Node Registry

**Status:** Blocked by M3

- Define framework-neutral node schemas, schema versions, typed handles, cardinality, connection compatibility, and payload requirements.
- Start the foundational registry with `text`, `asset`, `element`, and
  `imageGeneration`. E-035 extends this same registry with `videoGeneration` and
  `audioGeneration`; do not create a second media registry or validation path.
- Define Element nodes with one resolved-context output plus one typed collection output per registered Asset role. A role produces one stable `ImageSet`, `VideoSet`, or `AudioSet` handle, never one dynamic handle per related Asset.
- Define generation inputs as model-capability slots with aggregate cardinality limits and a per-input selection policy: deterministic `auto` or ordered manual Asset IDs.
- Keep React node components in the dashboard and server validation in shared/server-safe code.
- Add startup validation for incompatible handles, missing payload references, and schema upcasting.

### E-031 - Implement Flows CRUD API

**Status:** Blocked by E-030 and E-003

Implement Flow list/create/detail/update/delete, including viewport persistence, lean list responses, tenant isolation, and OpenAPI/SDK generation. Do not implement graph history, sharing, Recipes, or collaboration.

### E-032 - Implement Graph Read And Autosave Sync API

**Status:** Blocked by E-031

**Scope**

- Implement `GET /flows/:id/graph` and revision-CAS `POST /flows/:id/graph`.
- Apply batched node/edge upserts and deletes in one transaction.
- Validate final-state references, same-flow edges, handles, media compatibility, cardinality, and type payloads.
- Permit incomplete but non-contradictory graphs.
- Enforce request, node-data, node-count, edge-count, and aggregate graph limits.
- Return `409 revision_conflict` without partial writes.

### E-033A - Build Flow List And Creation UI

**Status:** Blocked by E-031

Implement the Flow list, create, rename, delete, empty/loading/error states, and direct navigation into a Flow. Do not build the canvas in this task.

### E-033B - Build The React Flow Canvas Foundation

**Status:** Blocked by E-032 and E-033A

Implement pan/zoom, viewport restoration, selection, add/move/duplicate/delete, connection creation/removal, revision-aware debounced autosave, conflict refetch/replay, and unsaved/error indicators. Keep results out of node `data`.

### E-034 - Build Text, Asset, And Element Nodes

**Status:** Blocked by E-033B

Implement functional node components and selectors for Text, canonical Assets, and Elements. Support multiple connected context sources and deterministic ordering without adding automation behavior.

The Element node stores only the Element reference. It exposes one resolved-context handle plus one typed collection handle per registered Asset role; it never embeds a copy of Element data, kit Assets, signed URLs, or `buildElementContext` output. The server resolves the current context and role candidates when a run is created.

### E-035 - Add Generation Configuration And Media Generation Draft Nodes

**Status:** Blocked by E-030 and E-034

**Scope**

- Implement the product-controlled model/capability registry and `GET /config/generation`.
- Use stable TaleLabs model IDs in Flow node data. Split the public capability
  registry from server-only provider routes, endpoint tags, credentials,
  fallbacks, internal costs, and emergency policy.
- Treat OpenRouter and direct-provider discovery APIs as reviewed research/drift
  inputs only. Do not populate production UI or validation from live discovery.
  Add a non-mutating manual/CI drift report for the initially approved models.
  The report must compare provider routes and lifecycle as well as reviewed
  operation-level public settings, input limits, required-input rules, and
  cross-field constraints against the current immutable contract version.
- Register a deliberately small catalog of real image, video, and audio model
  identities and their documented capabilities. This is configuration and
  validation work only; no provider is called in M4 or M5.
- Cover representative capability families rather than maximizing model count:
  one image model with multi-reference/output-count behavior, one constrained
  first/last/reference video family, one mixed-media-reference video family, one
  TTS operation, and one sound-effect operation. Additional entries require
  separate capability review.
- Render model choice and capability-aware settings inside Image Generation,
  Video Generation, and Audio Generation nodes.
- Expose only supported input slots/settings and validate node data through the registry.
- Represent model-specific slots explicitly, including combined reference limits,
  first frame, last frame, reference video, reference audio, duration, aspect
  ratio, resolution, output count, and mutually exclusive modes where supported.
- Model operation modes and cross-field constraints explicitly, including
  text/image/reference/video generation modes, settings that require another
  setting value, mutually exclusive slots, and operation-specific audio contracts.
- If a model may route across several provider endpoints, expose only the
  verified capability intersection. Pin a concrete endpoint when TaleLabs exposes
  endpoint-specific behavior.
- Show compact thumbnail stacks and concise selected-reference counts on connected media inputs. The input row itself opens a contextual inspector; do not add a persistent `Change selection` button or expose `Automatic / Manual` terminology.
- Make a compatible connection immediately runnable using deterministic Element defaults. The inspector shows selected order, total candidates, model maximum, candidates grouped by source, `Customize`, and `Reset to Element defaults`. Changing any candidate implicitly creates a custom selection.
- Keep incoming edges as the topology source of truth. Persist only per-input selection policies in generation-node `data`; validate manual IDs as compatible members of the current candidate set.
- Implement the four visible input states: unconnected, default, customized, and invalid. Singular slots use the same interaction constrained to one candidate.
- Apply each model input's maximum across every connected source combined. Default selections may recompute after model, graph, Element, or Asset changes; preserve and visibly invalidate overflowing or stale custom selections and never truncate or replace them silently.
- Do not execute the node yet.

### E-036 - Flows User QA And UI Critique Gate

**Status:** Blocked by E-035

**Owner:** User

The user validates canvas ergonomics, simple two-node creation, multi-context
graphs, all three generation-node forms, model-dependent slot changes, reference
limits, node controls, connection feedback, autosave/conflicts, refresh recovery,
direct URLs, keyboard behavior, and desktop/mobile constraints.

**M4 gate**

A user can create and autosave a valid Flow containing Text, Asset, Element, and
configured Image, Video, and Audio Generation nodes, including branches and
multiple context sources. The same capability registry drives UI visibility and
server validation. No run or provider request occurs.

---

## M5 - Provider-Independent Run Engine

M5 builds the real TaleLabs execution architecture without calling OpenRouter or
any image, video, audio, or text generation API. Real Assets and Elements enter
the graph. Deterministic mock adapters return fixture media through the same
normalized result contract expected from future providers. Those outputs pass
through the real ingestion path and become canonical Assets.

### E-040 - Harden The Model Capability Registry

**Status:** Blocked by M4

- Define provider-independent schemas for image, video, and audio generation
  requests and results.
- Record real model identities and researched capabilities without implementing
  their providers: modalities, generation modes, typed slots, total/per-slot
  reference limits, accepted media constraints, duration, resolution, aspect
  ratio, output count, and incompatible option combinations.
- Make the shared registry drive node rendering, connection validation, reference
  selection, cost estimates using mock price facts, and authoritative server
  validation.
- Add deterministic capability scenarios such as three image references, one
  first frame, one last frame, one reference video, and unsupported combinations.
- Do not add provider credentials, SDKs, HTTP calls, or paid smoke checks.
- Define normalized provider lifecycle contracts for immediate outputs, raw or
  streamed bytes, and asynchronous submit/poll/webhook jobs. Keep lifecycle
  behavior independent from graph planning and media type.

### E-041A - Prototype Runtime Values And Graph Planning

**Status:** Blocked by E-040

- Implement server-authoritative DAG validation, topological planning, and
  selected-node, downstream, and full-flow execution plans in an isolated,
  deterministic engine module before changing execution persistence.
- Resolve real Text, Asset, Element-role, and same-run prior-output sources in
  deterministic order.
- Preserve the distinction between outer runtime items and inner typed
  collections defined by `docs/flow-nodes-planning.md`.
- Apply model capability limits while preserving all source candidates separately
  from the exact selected provider inputs.
- Compose resolved prompts and immutable source/input provenance.
- Exercise representative plans for branches, multiple outputs, provider request
  sharding, Zip, Cartesian dimensions, iteration, collection, and partial
  failures using mock executor responses.
- Expose an explicit development-only plan inspection path so the user can
  understand item counts, request counts, selected inputs, and lineage before any
  provider or durable orchestration is introduced.
- Do not add provider SDKs or commit to a persistence migration until this runtime
  contract has been reviewed.

### E-041B - Finalize Execution Persistence And Immutable Snapshots

**Status:** Blocked by E-041A and user review of the runtime contract

- Update `docs/db-design-planning-v2.md` and `docs/api-design-planning-v2.md`
  first with the proven execution-item, provider-request, output-set, and run-mode
  contracts. Do not let implementation silently redefine either source document.
- Add the snapshot-guard migration and revision semantics defined by the database
  design, including `elements.revision`, `flowRuns.snapshotHash`, and
  `flowRuns.executorVersion`.
- Add the reviewed job-level model provenance fields for stable TaleLabs model
  identity, operation, curated registry version, native provider model, provider
  route version, and adapter version. Backfill development rows deterministically.
- Add the reviewed `flowRunNodeItems` and item-to-many-generation-jobs persistence
  seam required by output sharding and explicit iteration; migrate any existing
  development rows deterministically.
- Canonically serialize and persist bounded immutable snapshots. Never place
  signed URLs, provider payloads, or media bytes in snapshots.

### E-042 - Implement Run API, Admission, And Durable Dispatch

**Status:** Blocked by E-041B

- Implement create/list/detail/cancel APIs for `node`, `downstream`, and `all`
  modes.
- Implement idempotency, organization advisory locks, active-run limits,
  development allowlists, and emergency budget controls using mock costs.
- Create run, run-node, execution-item, generation-job, source, and exact-input
  facts atomically as authorized by the final planner shape.
- Dispatch ID-only Trigger.dev tasks; workers load immutable state from
  PostgreSQL.
- Implement reconciliation, cancellation, executor-version pinning, and guarded
  pending/running/terminal transitions.
- No external AI provider may be called.

### E-043 - Implement Deterministic Mock Provider Adapters

**Status:** Blocked by E-042

- Implement image, video, and audio adapters behind the production provider
  interface.
- Implement the production-shaped lifecycle surface: submit may return completed
  outputs or a pending external job; polling and cancellation are optional
  adapter capabilities. Trigger.dev owns durable polling/reconciliation rather
  than holding one request open.
- Accept the normalized real request and return deterministic fixture results,
  configurable delay, output count, request sharding, retryable failure,
  permanent failure, partial success, and cancellation behavior.
- Put the required `TODO(provider-integration)` comment at every mock adapter's
  replacement boundary.
- Do not create a second mock planner, run table, job shape, ingestion path, or UI.
- Keep mock media small and repository/development-bucket controlled; never call
  an external generation endpoint.

### E-044 - Persist Mock Outputs And Build Result UX

**Status:** Blocked by E-043 and M2

- Feed mock results through the same metadata probing, tenant-safe R2 key,
  ingestion, and guarded Asset-creation path required by real providers.
- Ensure every successful result becomes a canonical Asset with immutable
  provenance and deterministic output identity.
- Implement result history from jobs and Assets; never copy result IDs into node
  configuration.
- Build run controls and queued/running/succeeded/partial/failed/canceled states,
  refresh recovery, output previews, rerun, and cancellation for all three media
  generation nodes.
- Allow a generated output to become an Asset node and connect to a downstream
  generation input.

### E-045 - Implement Multiplicity And Explicit Iteration

**Status:** Blocked by E-044

- Support requested multiple outputs without treating every member of a typed
  media collection as a separate execution item.
- Implement deterministic provider-request sharding in the planner so mocks can
  model a provider that returns fewer outputs per call than requested.
- Add the bounded initial control nodes: Iterator/Map, Collect, Zip, and Prompt
  Iterator. Do not add arbitrary scripting, schedules, webhooks, or conditionals.
- Implement stable item keys, dimensions, lineage, per-item state, retries,
  failures, provenance, and cache/idempotency boundaries.
- Make multiplication visible in the UI with item/output counts and a pre-run
  mock cost estimate. Never hide Cartesian expansion behind an edge.
- Preserve successful items during partial failure and make rerun scope explicit.

### E-046 - Verify The Mock Engine Objectively

**Status:** Blocked by E-045

**Owner:** AI

Verify selected-node, downstream, and full-flow execution; real input resolution;
model-specific limits; multiple context sources; zipped and Cartesian inputs;
multiple outputs; iteration and collection; branches; deterministic planning;
idempotent replay; snapshot collisions; task retries; lost dispatch; cancellation;
partial failure; output-ingestion failure; canonical Asset reuse; and immutable
historical provenance. Confirm through network controls/log inspection that no AI
generation provider was contacted.

### E-047 - Mock Engine User QA And UI Critique Gate

**Status:** Blocked by E-046

**Owner:** User

The user validates model-driven node forms, reference selection and overflow,
image/video/audio runs, full-flow execution, visible iteration, output sets,
partial failures, refresh recovery, result reuse, and overall canvas ergonomics.

**M5 gate**

TaleLabs can execute representative image, video, and audio creative graphs using
real workspace inputs and production-shaped durable infrastructure. All generated
media is deterministic mock output, becomes a canonical Asset, and can continue
through the graph. No external AI generation request or generation spend occurs.

---

## M6 - Controlled Provider Integration

M6 replaces only the marked provider boundaries. Graph semantics, capability
validation, snapshots, runs, jobs, provenance, Trigger.dev orchestration, output
ingestion, and UI must not be redesigned to accommodate a provider.

### E-060 - Implement The First Real Image Adapter

**Status:** Blocked by M5

- Select one approved image model already represented in the capability registry.
- Resolve its stable TaleLabs ID through the server-only route registry. Pin a
  concrete endpoint or verify that every eligible endpoint supports the public
  capability intersection.
- Implement submission, result normalization, polling when required,
  cancellation where supported, safe errors, and raw diagnostic logging behind
  the existing adapter contract.
- Remove the corresponding `TODO(provider-integration)` marker only after the
  real adapter passes controlled opt-in smoke checks.
- Keep the mock adapter available only through an explicit development/test
  configuration, never an implicit production fallback.

### E-061 - Implement The First Real Video Adapter

**Status:** Blocked by E-060

Integrate one approved video model through the same contract. Verify first/last
frame, reference limits, duration, asynchronous polling, cancellation support,
large result ingestion, timeouts, and uncertain provider submission without
changing Flow runtime semantics.

Verify OpenRouter/provider discovery drift before enabling the route, snapshot
the resolved provider/adapter version, and reject capabilities that the selected
endpoint cannot guarantee.

### E-062 - Implement The First Real Audio Adapter

**Status:** Blocked by E-060

Integrate one approved audio model through the same contract. Verify text and
audio inputs, duration/format constraints, result metadata, ingestion, timeout,
and cancellation behavior without creating a separate audio execution engine.
Treat TTS, sound effects, music, speech-to-speech, isolation, and dubbing as
distinct registry operations even when they share the `AudioSet` output type.

### E-063 - Verify Provider Parity And Spend Controls

**Status:** Blocked by E-061 and E-062

**Owner:** AI

- Compare normalized mock and real adapter behavior for every supported model
  capability and terminal state.
- Verify provider-cost recording, bounded opt-in smoke budgets, emergency disable
  controls, retry policy, uncertain submissions, orphan cleanup, and safe errors.
- Inventory `TODO(provider-integration)` markers and document any model adapters
  intentionally still mocked.
- Confirm real integrations did not introduce provider-specific graph fields or
  alternate persistence paths.
- Confirm live discovery never mutated production capabilities automatically and
  that every enabled route still satisfies its curated registry contract.

### E-064 - Real Generation User QA Gate

**Status:** Blocked by E-063

**Owner:** User

The user compares mock and real behavior, output presentation, latency feedback,
model settings, reference handling, failure recovery, and practical creative
quality. Findings become narrowly scoped adapter or UX tasks.

**M6 gate**

At least one approved image, video, and audio model runs through the same engine
validated in M5. Replacing mocks required adapter work, not an execution-system
rewrite.

---

## M7 - Internal MVP Candidate

### E-070 - Run End-To-End Regression And Tenant Audit

**Status:** Blocked by M6

Exercise the highest-value loop across two organizations: upload, process,
organize, create Element kits, create multi-context and iterative Flows, generate
all three media types, persist/reuse outputs, inspect provenance, archive/restore,
and purge. Systematically attempt cross-organization identifiers and signed URL
access.

### E-071 - Add Operational Reliability And Cleanup

**Status:** Blocked by E-070

- Add structured request/run/job/provider correlation logs.
- Verify reconciliation for ingestion, dispatch, purge, abandoned upload, failed
  output, thumbnails, and provider orphans.
- Configure Trigger.dev concurrency/retry policies and provider-spend alerts.
- Add an operations runbook without building a general admin product.

### E-072 - Stage The MVP And Run Engineering Verification

**Status:** Blocked by E-070 and E-071

**Owner:** AI

- Block production release while `npm audit --omit=dev` reports the tracked
  Trigger.dev 4.5.3 / OpenTelemetry 2.7.1 baggage-allocation advisory. Recheck
  the latest Trigger.dev release before staging; do not use npm's forced
  downgrade to Trigger.dev 3.x. A narrowly scoped OpenTelemetry override must
  pass Trigger task build and runtime smoke checks before adoption.

Deploy dashboard, API, migrations, R2, Trigger.dev, and approved provider
configuration to staging. Run controlled engineering smoke checks and provide the
staging URL, known risks, test-data expectations, and user handoff checklist.

### E-073 - Final MVP User Acceptance Gate

**Status:** Blocked by E-072

**Owner:** User

The user evaluates Assets, Elements, Flows, generation, iteration, output reuse,
navigation, terminology, media states, destructive actions, responsive behavior,
and creative value as one product.

**M7 gate**

The integrated creative loop is stable enough for controlled internal or invited
user testing. It is not yet a paid launch.

---

## After MVP - Separately Planned Layers

Do not silently append these to an MVP task.

### Model And Modality Expansion

Add more models and any new modalities through the existing capability registry,
normalized adapter contract, runtime values, jobs, and output-ingestion path.
Every addition gets its own bounded adapter task, capability verification, spend
approval, and user QA gate. Do not redesign the engine per provider.

### Productization And Billing

Use `docs/credits-planning.md` to create a separate execution plan for:

```txt
cost estimates
credit wallets and ledger
atomic reservations
capture and release
credit packs
subscriptions
Stripe billing
usage history
margin reporting
welcome credits and abuse controls
```

### Later Creative Layers

Plan Recipes, Tools, Storyboard, collaboration, simple Generate, public API/MCP,
and editing only after the MVP loop has evidence behind it. Their database seams
are documented; their implementation is not authorized by this plan.

When Tools are authorized, preserve the documented lifecycle: mutable Tool
identity and metadata, one ordinary normalized Flow as the editable draft,
immutable monotonic ToolVersions produced by coherent publication, a mutable
current-published-version pointer used only as a default alias, concrete version
pinning on Tool nodes and runs, and one shared execution service for canvas, UI,
API, and MCP invocation. Do not create a second Tool graph persistence or
executor.

## Prompt For The First Implementation Session

Use this as the starting request for E-001:

```txt
Implement E-001 from docs/mvp-execution-plan.md and nothing else.

Read AGENTS.md, packages/db/AGENTS.md, docs/talelabs-product-vision.md,
docs/db-design-planning-v2.md, docs/api-design-planning-v2.md, and
docs/mvp-execution-plan.md first.

Create and run the complete v2 core database migration, synchronize the Kysely
schema types, verify the migration and constraints, and report the results.
Do not add API routes, repositories, fixtures, seed data, Trigger.dev tasks, or UI.
```
