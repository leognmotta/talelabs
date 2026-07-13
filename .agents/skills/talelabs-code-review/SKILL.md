---
name: talelabs-code-review
description: Perform evidence-based TaleLabs code, architecture, milestone, security, performance, scalability, maintainability, frontend, backend, API, database, Flow, Asset, Element, and integration reviews. Use for requests to review, re-review, approve, audit, validate, assess readiness, inspect uncommitted changes, or decide whether TaleLabs can move to the next milestone.
---

# TaleLabs Code Review

Review implementation against the repository, its source-of-truth documents,
and relevant external evidence. Do not substitute general AI knowledge for code
tracing or research.

## 1. Establish The Contract

1. Read the applicable `AGENTS.md` files before judging code.
2. Always read `docs/talelabs-product-vision.md`.
3. Read only the source-of-truth documents relevant to the changed behavior:
   - `docs/flow-nodes-planning.md` for Flow nodes, execution, batching, Tools,
     Recipes, snapshots, or runtime values.
   - `docs/db-design-planning-v2.md` for persistence and invariants.
   - `docs/api-design-planning-v2.md` for API contracts and semantics.
   - `docs/mvp-execution-plan.md` for milestone scope and acceptance gates.
   - A matching file under `docs/feature-research/` when reviewing that feature.
4. Treat feature research as evidence, not automatically approved scope.
5. Ignore deprecated planning documents identified by the root `AGENTS.md`.
6. Inspect `git status`, the complete diff, generated artifacts, and nearby
   unchanged code needed to understand the behavior. Do not review isolated
   snippets when the call path crosses modules.

State the milestone or contract being reviewed. If the implementation and docs
disagree, determine whether this is a code defect, stale documentation, or an
explicit user decision.

## 2. Build A Behavior Map

Trace the changed behavior end to end before reporting findings:

```txt
UI/event -> client state/cache -> SDK/API -> service/domain -> data/transaction
         -> queue/provider/storage -> callback/reconciliation -> UI refresh
```

Map only the layers that apply. Identify:

- authoritative state and derived state;
- organization and user trust boundaries;
- validation and authorization boundaries;
- transaction, lock, retry, idempotency, and failure boundaries;
- cache ownership and invalidation paths;
- asynchronous state transitions and crash windows;
- limits, pagination, payload growth, query shape, and external costs;
- compatibility requirements for stored data, APIs, snapshots, and generated SDKs.

Use repository searches to find every reader and writer of a changed contract.
Do not assume a helper is universally used because one call site uses it.

## 3. Research Deliberately

Research when it can change the conclusion. Keep it targeted to concrete review
questions instead of performing a broad market survey for every change.

### Research when relevant

- **Technical behavior:** Verify non-obvious framework, database, browser,
  provider, model, security, concurrency, caching, or library behavior using
  official documentation, source code, standards, or primary research.
- **Code patterns:** Research established patterns when selecting or reviewing a
  concurrency strategy, transaction boundary, extensibility model, state
  architecture, React pattern, API design, or durable-job workflow.
- **Competitors:** Inspect current competitor products and first-party
  documentation when reviewing product behavior, terminology, interaction
  design, workflow expectations, or feature parity.
- **Users:** Research user expectations when UX or product usefulness is at
  issue. Prefer multiple credible signals such as product communities, support
  discussions, creator workflows, professional forums, and documented case
  studies. Treat individual comments as anecdotes, not requirements.
- **Current capabilities:** Verify unstable provider/model limits, pricing,
  supported inputs, SDK behavior, and platform constraints rather than relying
  on memory.

### Research discipline

- Form a specific question before browsing.
- Prefer primary and official technical sources.
- Triangulate product or user claims when one source is insufficient.
- Record the date or version when the fact is time-sensitive.
- Cite sources next to externally supported conclusions.
- Distinguish verified fact, code observation, and inference.
- Stop when the evidence answers the question; do not exaggerate research.
- Do not use competitor behavior to override TaleLabs product decisions without
  explaining the tradeoff and conflict.
- Do not browse for a local defect already proven directly by the code.

## 4. Review Dimensions

### Correctness and contract alignment

- Verify happy paths, failures, retries, replays, cancellation, partial
  completion, stale clients, and concurrent requests.
- Check that docs, database constraints, API schemas, generated SDKs, runtime
  registries, and UI assumptions describe the same contract.
- Look for success responses that hide incomplete work or invalid states.
- Check migrations, backward compatibility, and immutable historical data.

### Security and tenant isolation

- Trace organization and user scope through every query and mutation.
- Check authorization, input validation, signed URLs/grants, secrets, provider
  callbacks, upload integrity, and cross-tenant identifier handling.
- Prefer fail-closed behavior and generic cross-tenant not-found responses.
- Flag process-local security or coordination mechanisms when deployment uses
  multiple instances.

### Performance and scalability

- Inspect query plans conceptually: indexes, N+1 reads, unbounded scans, sorting,
  lock granularity, transaction duration, and pagination.
- Inspect browser work: rendering volume, media loading, bundle growth, polling,
  duplicate requests, cache fan-out, and expensive rerenders.
- Inspect async work: queue concurrency, retries, idempotency, payload size,
  storage duplication, provider limits, and reconciliation.
- State the scale condition that makes a concern material. Do not demand
  speculative optimization without a credible path to impact.

### Code quality and maintainability

- Apply DRY to duplicated policy and behavior, not merely similar syntax.
- Prefer one authoritative implementation for invariants, validation, query
  keys, cache policy, registries, and provider capabilities.
- Check cohesion, naming, control flow, type safety, error semantics, comments,
  and ease of tracing.
- Check whether adding a new node, Element type, provider route, model,
  relationship, or UI state requires editing an unreasonable number of
  unrelated files.
- Prefer reusable systems where they remove meaningful duplication or make an
  extension safer. Reject premature abstractions that obscure simple behavior.

### Structure and responsibility

- Keep code in the repository's established package, feature, domain, service,
  data, and shared-component boundaries.
- Flag files that coordinate unrelated responsibilities, mix policy with
  presentation or persistence, or become a central dependency for unrelated
  features.
- Recommend splitting by responsibility and ownership, not by an arbitrary line
  count. A long cohesive file can be valid; a shorter multi-purpose file can be
  a design problem.
- Avoid both monolithic “solve everything here” modules and fragmented wrappers
  that add indirection without ownership.

### Product and UX

- Compare implementation with researched user expectations and competitor
  workflows when the review affects visible product behavior.
- Preserve TaleLabs simplicity, progressive disclosure, accessibility,
  internationalization, responsive behavior, and clear asynchronous feedback.
- Check that UI terminology reflects the user model rather than internal
  database or provider terminology.
- User-owned visual and end-to-end QA remains distinct from code review; report
  what still requires that QA.

## 5. Verify Proportionally

Run the repository checks relevant to the change. Typical checks include:

```txt
SDK or contract generation
type-checking
i18n validation
lint
focused invariant/smoke scripts
production build
git diff --check
```

Follow the root acceptance rules for automated tests. Do not use missing tests
as a generic blocker, but do report an unverified high-risk invariant or a
required smoke script that could not run. Never use production data for a
destructive verification.

Do not edit code during a review unless the user explicitly asks for fixes.

## 6. Report Findings First

Order findings by severity and include for each:

1. severity (`P0` through `P3`);
2. concise defect or risk statement;
3. concrete failure or user-impact scenario;
4. absolute file and line references;
5. supporting research citation when the conclusion relies on external facts;
6. a focused correction that fits existing architecture.

Do not inflate a preference into a finding. A finding must identify a credible
bug, regression, security problem, contract mismatch, scalability boundary, or
maintainability cost.

After findings, provide:

- assumptions or open questions;
- verification performed and anything that could not run;
- a brief architecture/quality assessment;
- an explicit milestone verdict: approved, approved with follow-up, or blocked
  by named findings.

If no findings remain, say so clearly and identify only genuine residual risks
or user-owned QA gaps.
