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
-> connect Text, Asset, Element, and Image Generation nodes
-> run one selected generation node
-> persist the output as an Asset
-> reuse that output in the same or another Flow
```

The MVP proves this loop with image generation first. Video and audio generation reuse the same foundation after the image loop is reliable.

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
5. Flows and graph editing
6. Run one image-generation node
7. Complete iteration and reliability
8. Billing and credits in a separate productization phase
```

Explicitly deferred from the MVP:

```txt
video and audio generation nodes
run downstream and run all
automatic DAG execution
Tools
Recipes
Storyboard
simple Generate page
collaboration and comments
Flow version history
triggers, schedules, and webhooks
batch and iterator nodes
editor or cuts
public API and MCP
public galleries and links
tags and favorites
projects
credits, subscriptions, and Stripe billing
```

The initial database includes `flowRuns` and `flowRunNodes` because every execution belongs to a run from day one. That does not authorize implementing multi-node orchestration during the MVP.

## How To Execute A Task

Use one task per AI session unless the task explicitly states otherwise.

For every implementation task:

1. Read the source-of-truth documents and the relevant package `AGENTS.md` files.
2. Inspect the current implementation and dirty worktree before editing.
3. Implement only the task's stated scope.
4. Add automated validation proportional to the change.
5. Run the listed checks and any focused tests introduced by the task.
6. Review the diff for accidental scope expansion or generated-file mistakes.
7. Update the database/API design documents only when implementation proves that an approved contract is impossible or incorrect.
8. Report exactly what was verified and what remains for user QA.
9. Stop when the acceptance criteria are met.

Do not combine a backend contract, a large UI implementation, and a visual-polish pass into one session.

## QA And Design Ownership

The AI owns implementation and objective engineering verification. The user owns product QA, browser acceptance, and subjective UI/design critique.

The AI must:

- Run relevant tests, type checks, builds, API contract checks, and focused smoke checks.
- Start the application when browser testing by the user is required.
- Provide the local URL and a concise handoff checklist.
- Report untested failure modes and external-provider limitations.
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
- Relevant builds, type checks, and tests pass.
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

## Milestones

| Milestone               | Outcome                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| M0: Database foundation | The complete v2 schema migrates and its structural tenant/data guarantees are verified.                                  |
| M1: API foundation      | Product routes have one tenant-safe Hono/OpenAPI/SDK foundation.                                                         |
| M2: Assets              | Private uploads become durable, processed, searchable, organized, and reusable Assets.                                   |
| M3: Elements            | Generic reusable context with typed data and role-based Asset kits works end to end.                                     |
| M4: Flows               | Users can build and autosave a valid manual creative graph with the initial node set.                                    |
| M5: Image generation    | One selected image-generation node executes durably and produces canonical Assets with immutable provenance.             |
| M6: MVP candidate       | Outputs can be reused for continued iteration and the complete loop passes engineering verification and user acceptance. |

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

Also inspect PostgreSQL metadata for tables, indexes, FKs, and checks. Never test `down` against shared or production data.

### E-002 - Add Database Contract And Tenant-Isolation Tests

**Status:** Blocked by E-001

**Scope**

- Add a database integration-test harness using a disposable test database.
- Create fixtures for two organizations and users.
- Verify the source invariants, processing lifecycle, deletion lifecycle, graph same-flow constraints, tenant composite FKs, job/run relationships, and idempotency indexes.
- Verify representative cross-organization inserts fail at the database boundary.
- Keep tests focused on schema contracts; do not implement resource repositories yet.

**Acceptance criteria**

- Tests prove that tenant-owned relationships cannot cross organizations.
- Invalid lifecycle/status/source combinations fail.
- Same-flow and same-run composite FKs reject mismatches.
- Tests clean up their data and cannot run accidentally against production.

**M0 gate**

The complete v2 schema exists, its structural guarantees are tested, and the database foundation is accepted before product API work begins.

---

## M1 - API Foundation

### E-003 - Harden The Product API Foundation

**Status:** Blocked by M0

**Scope**

- Use the existing `organizationMiddleware` for every new product route.
- Add shared cuid2, pagination, cursor, lifecycle, and error schemas required by the v2 API.
- Implement the opaque cursor codec and sort/order mismatch validation.
- Preserve the existing Hono route/schema/service/data boundaries.
- Extend the composed-app test harness for authenticated organization-scoped routes.
- Do not add a product CRUD endpoint yet.

**Acceptance criteria**

- Product routes cannot run without an active organization.
- Cross-tenant resources remain indistinguishable from missing resources.
- Common errors match `docs/api-design-planning-v2.md`.
- `/openapi.json` remains valid.

**Checks**

```bash
npm run test -w api
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

- Add the Trigger.dev ingestion task with `idempotencyKey = assetId` and ID-only payloads.
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
- Keep list responses lean and detail responses render-complete.
- Expose processing and lifecycle states without exposing storage keys.
- Regenerate the SDK and add integration tests.

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
- Enforce cycle prevention, 32-level maximum depth, and 10,000-folder organization cap.
- Preserve Assets when folders are deleted by moving them to root through FK behavior.
- Add focused tenant and tree tests.

### E-017A - Build Upload UI And Processing Feedback

**Status:** Blocked by E-011, E-013, and generated SDK updates

Implement file selection, checksum calculation, direct-to-R2 upload progress, registration, cancellation, and processing/failed/ready feedback. Do not build the full library in this task.

### E-017B - Build Asset Library And Detail UI

**Status:** Blocked by E-014 and E-017A

Implement grid/list foundations, search, type/source filters, stable pagination, preview/playback, technical metadata, processing states, download, and an Asset detail surface. Keep the experience media-aware and drive-like.

### E-017C - Build Folder And Lifecycle UI

**Status:** Blocked by E-015, E-016, and E-017B

Implement folder navigation and management, move-to-folder, rename, archive, restore, and explicit permanent-deletion confirmation. Reuse the same Asset components instead of creating per-screen media variants.

### E-018 - Assets User QA And UI Critique Gate

**Status:** Blocked by E-017C

**Owner:** User

The user validates the complete Asset workflow with mixed media, long names, nested folders, processing and failed media, missing previews, slow uploads, archived/purged states, keyboard operation, and desktop/mobile layouts. Findings become separate implementation tasks.

**M2 gate**

A user can upload private image/video/audio media, see durable processing states, find it again, inspect it, organize it, download it, archive/restore it, and permanently purge it.

---

## M3 - Elements

Elements are generic reusable AI context. Do not restore separate Brand, Product, or Character tables or navigation.

### E-020 - Create The Element Type Registry Foundation

**Status:** Blocked by M2

**Scope**

- Create the shared registry boundary used by API and dashboard.
- Keep schemas, labels, field metadata, preview roles, Asset roles, accepted media types, and schema versions framework-neutral.
- Keep React form components in the dashboard and server-only `buildContext` implementations out of the browser bundle.
- Start with `character` and `product` types only.
- Encode the approved role examples, including character appearance/expression/motion/voice and product packshot/detail/lifestyle/demonstration.
- Add startup validation and registry unit tests.

### E-021 - Implement Elements CRUD API

**Status:** Blocked by E-020 and E-003

Implement list/create/detail/update/delete with registry-based data validation, immutable type, schema-version stamping/upcasting, preview metadata, usage counts, tenant isolation, OpenAPI, SDK generation, and integration tests.

### E-022 - Implement Element Asset-Kit API

**Status:** Blocked by E-021 and M2

**Scope**

- Implement the Element Asset subresource with role, order, and primary state.
- Enforce role/media compatibility and the one-primary-per-role invariant.
- Keep Assets canonical; linking/unlinking never copies or deletes media.
- Complete the optional `elementId` + `role` path in `POST /assets` so upload registration and link insertion are one transaction.
- Permit processing Assets to be attached for upload UX, but generation resolution must never submit a non-ready Asset.

### E-023 - Implement Element Context And Usage Services

**Status:** Blocked by E-022

- Implement server-only `buildContext` for the initial Element types.
- Return deterministic ordered candidate Assets and resolved text suitable for future job snapshots.
- Implement the bounded `GET /elements/:id/usage` response.
- Test multiple Elements, multiple Assets per role, exclusions, primary selection, and deleted/failed references.

### E-024A - Build Element List And Data UI

**Status:** Blocked by E-021

Implement Element list/create/detail/delete and the registry-driven Data tab. Start with Character and Product forms while keeping the screen generic enough for later Element types.

### E-024B - Build Element Assets UI

**Status:** Blocked by E-022 and E-024A

Implement the Assets tab with role sections, primary selection, ordering, upload-and-attach, existing Asset picker, unlinking, processing feedback, and shared Asset previews.

### E-025 - Elements User QA And UI Critique Gate

**Status:** Blocked by E-023 and E-024B

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
- Start with exactly `text`, `asset`, `element`, and `imageGeneration` nodes.
- Keep React node components in the dashboard and server validation in shared/server-safe code.
- Add registry tests for incompatible handles, missing payload references, and schema upcasting.

### E-031 - Implement Flows CRUD API

**Status:** Blocked by E-030 and E-003

Implement Flow list/create/detail/update/delete, including viewport persistence, lean list responses, tenant isolation, OpenAPI/SDK generation, and integration tests. Do not implement graph history, sharing, Recipes, or collaboration.

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

### E-035 - Add Generation Configuration And Image Node Draft UI

**Status:** Blocked by E-030 and E-034

**Scope**

- Implement the product-controlled model/capability registry and `GET /config/generation`.
- Enable a deliberately small image-model catalog.
- Render model choice and capability-aware settings inside the Image Generation node.
- Expose only supported input slots/settings and validate node data through the registry.
- Do not execute the node yet.

### E-036 - Flows User QA And UI Critique Gate

**Status:** Blocked by E-035

**Owner:** User

The user validates canvas ergonomics, simple two-node creation, multi-context graphs, node controls, connection feedback, autosave/conflicts, refresh recovery, direct URLs, keyboard behavior, and desktop/mobile constraints.

**M4 gate**

A user can create and autosave a valid Flow containing Text, Asset, Element, and configured Image Generation nodes, including branches and multiple context sources.

---

## M5 - Run One Image Generation Node

The first execution experience runs one selected node manually. It does not run downstream nodes or the whole graph.

### E-040 - Implement Run Planning And Snapshot Creation

**Status:** Blocked by M4

**Scope**

- Implement server-authoritative upstream traversal for one target Image Generation node.
- Resolve multiple Text, Asset, Element, and prior-node-output sources in deterministic order.
- Apply model capability limits and preserve all sources separately from the exact provider input subset.
- Compose `resolvedPrompt` and create immutable source/input provenance.
- Implement `READ COMMITTED` graph-revision revalidation and ordered Asset row locks.
- Require every submitted Asset input to be `processingState = 'ready'` and not purging/purged.
- Use a fake executor; do not call OpenRouter yet.

### E-041 - Implement Run API And Admission Control

**Status:** Blocked by E-040

**Scope**

- Implement `POST /runs`, `GET /runs`, `GET /runs/:id`, and cancel.
- Accept only `mode = 'node'`; reject future modes as documented.
- Implement fast idempotency lookup plus authoritative recheck under the organization advisory lock.
- Make the advisory lock the transaction's first database statement.
- Enforce active-run cap, per-user rate limit, private-development allowlist, and exposure-aware emergency budget.
- Create run, run-node, job, sources, and inputs atomically.
- Record provider-cost and credit-cost facts without adding wallets or balance enforcement.

### E-042 - Implement Durable Trigger.dev Generation Execution

**Status:** Blocked by E-041

**Scope**

- Add the ID-only generation task and dispatch reconciliation sweep.
- Implement guarded pending/running/terminal state propagation across job, run-node, and mode-node run.
- Implement the `providerSubmittedAt` / `providerJobId` uncertainty contract.
- Implement cancellation and orphan-output cleanup.
- Use a fake provider adapter first to exercise retries and failures without spend.

### E-043 - Implement The First OpenRouter Image Adapter

**Status:** Blocked by E-042

- Add one approved image-generation model behind a provider-independent adapter.
- Normalize settings, context inputs, provider submission, polling/result handling, and safe errors.
- Keep raw provider payloads in logs, never user-facing errors.
- Add opt-in integration tests that require explicit credentials and spend approval.
- Do not add fallback providers or direct-provider contracts yet.

### E-044 - Persist Outputs And Expose Node Results

**Status:** Blocked by E-043 and M2

**Scope**

- Ingest provider outputs into tenant-safe R2 keys.
- Probe output metadata before inserting generated Assets directly as `ready`.
- Complete job/run state and output Asset insertion in the guarded transaction order from the database design.
- Implement node result history from jobs/Assets; never copy result IDs into node `data`.
- Ensure retries reuse deterministic output keys and cannot duplicate Assets.

### E-045 - Build Run-Node And Result UI

**Status:** Blocked by E-041 and E-044

Implement Run on the selected Image Generation node, submit locking, queued/running/succeeded/failed/canceled states, polling, refresh recovery, result history, output previews, and clear cost/error display where available. Realtime is deferred; polling remains the contract.

### E-046 - Verify Generation Reliability And Provenance

**Status:** Blocked by E-045

**Owner:** AI

Automate and objectively verify duplicate submit, idempotent replay, revision collision, multi-context resolution, reference limits, non-ready input rejection, purge race, lost dispatch, task retry, uncertain provider submission, success, failure, cancellation, output-ingestion failure, and immutable provenance after editing source Elements/Flows.

### E-047 - Image Generation User QA And UI Critique Gate

**Status:** Blocked by E-046

**Owner:** User

The user tests simple and multi-context image generation, model/settings ergonomics, async feedback, refresh behavior, result presentation, failure recovery, and overall canvas experience. Findings become separate implementation tasks.

**M5 gate**

A user can run one selected image-generation node, receive a durable generated Asset, inspect immutable provenance, and find the output in the global Asset library.

---

## M6 - Continued Iteration And Internal MVP Candidate

### E-050 - Complete Output Reuse And Branching

**Status:** Blocked by M5

- Allow a generated output to be materialized as an Asset node with a fresh client-generated node ID.
- Allow outputs to connect into another generation node as context.
- Support pinning a specific prior node output and default latest-succeeded resolution.
- Verify later upstream runs never rewrite the concrete input of historical jobs.

### E-051 - Run End-To-End Regression And Tenant Audit

**Status:** Blocked by E-050

Automate the highest-value loop across two organizations: upload, process, organize, create Element, attach kit Assets, create Flow, connect multi-context nodes, run image generation, persist output, reuse output, inspect provenance, archive/restore, and purge. Systematically attempt cross-organization IDs and verify signed URL isolation.

### E-052 - Add Operational Reliability And Cleanup

**Status:** Blocked by E-051

- Add structured request/run/job correlation logs and safe provider diagnostics.
- Verify ingestion, generation dispatch, purge, abandoned-upload, failed-output, and thumbnail orphan reconciliation.
- Configure Trigger.dev concurrency and retry policy.
- Document emergency admission controls and provider-spend alerts.
- Add a concise operations runbook without building a general admin product.

### E-053 - Stage The MVP And Run Engineering Verification

**Status:** Blocked by E-051 and E-052

**Owner:** AI

Deploy dashboard, API, migrations, R2, Trigger.dev, and OpenRouter configuration to staging. Run health, auth, tenant, upload, processing, canvas, and controlled real-model smoke checks. Provide the staging URL, test-data expectations, known risks, and user handoff checklist.

### E-054 - Final MVP User Acceptance Gate

**Status:** Blocked by E-053

**Owner:** User

The user evaluates the complete product as one system: Assets, Elements, Flows, generation, reuse, navigation, terminology, density, media states, destructive actions, responsive behavior, and creative value. Only the user can mark the MVP accepted.

**M6 gate**

The image-based creative loop is stable enough for controlled internal or invited-user testing. It is not yet a paid launch.

---

## After MVP - Separately Planned Layers

Do not silently append these to an MVP task.

### Media Expansion

Add Video Generation and then Audio Generation nodes using the existing Asset, context, run, job, provider, and output-ingestion foundations. Each modality gets its own small provider task, node UI task, reliability verification, and user QA gate.

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

Plan Recipes, Tools, Storyboard, collaboration, simple Generate, public API/MCP, editing, and multi-node execution only after the MVP loop has evidence behind it. Their database seams are documented; their implementation is not authorized by this plan.

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
