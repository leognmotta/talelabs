# TaleLabs Generation Runtime Simplification Plan

Status: Implemented (2026-07-16)
Research date: 2026-07-16
Scope: `packages/flows`, `packages/openrouter`, `packages/trigger`, and the model catalog consumed by the API/dashboard

## 1. Decision

Refactor the generation system around one deliberately plain mental model:

```txt
models.json          what TaleLabs offers and where it runs
flows                what the graph means and what must execute
openrouter           how OpenRouter protocols are called
trigger              when durable work executes
PostgreSQL snapshot  the exact immutable facts used by a run
```

The goal is not the most flexible or sophisticated architecture. The goal is a
system that a competent developer can trace, change, and debug without AI help.

A developer should be able to answer these questions quickly:

1. Which models does TaleLabs offer? Open `models.json`.
2. What inputs and settings does a model accept? Read that model record.
3. How is the graph planned? Follow the small provider-neutral Flow planner.
4. How is OpenRouter called? Open one of four protocol files.
5. What exactly did a historical run use? Read its immutable PostgreSQL snapshot.
6. Where are retries, cancellation, and wake-up behavior? Read the Trigger task
   and its narrowly owned orchestration modules.

This refactor must preserve the working product. It is an incremental
replacement, not a rewrite delivered in one merge.

## 2. Why This Refactor Is Needed

The current implementation is operational and contains important production
behavior. Its maintenance model is nevertheless too distributed.

Current measured surface:

| Area | TypeScript files | Physical lines |
| --- | ---: | ---: |
| `packages/flows/src/generation` | 72 | 9,422 |
| `packages/flows/src/runtime` | 37 | 2,786 |
| `packages/openrouter/src/routes` | 19 | 1,593 |
| `packages/openrouter/src/transport` | 10 | 516 |
| `packages/trigger/src/generation` | 43 | 2,589 |
| `packages/trigger/src/flow-runs` | 40 | 3,655 |
| **Total** | **221** | **20,561** |

Line count alone is not the problem. The problem is the number of places a
developer must inspect or edit for one product decision.

Examples from the current tree:

- `nano-banana-2` is represented across model definitions, selectable registry,
  presentation registry, scenarios, OpenRouter routes, and Trigger verification.
- `seedance-2.0` appears across current, major, and historical registries and
  routes in addition to scenarios and Trigger verification.
- Historical global registry versions copy complete catalogs even when a change
  concerns one model.
- Trigger resolves a provider route, validates the route again against the Flow
  registry, then chooses a shared protocol adapter.

The current implementation has already discovered the right low-level reuse:
models should share protocol adapters. The simplification should keep that
decision and remove the duplicate layers around it.

## 3. Design Principles

### 3.1 Optimize for reading

Readability is judged from the perspective of a competent developer who did not
author the code. Google Engineering Practices defines excessive complexity as
code that readers cannot understand quickly or are likely to modify
incorrectly, and specifically warns against making code more generic than the
current problem requires. The Google TypeScript Style Guide similarly favors
descriptive names and the simplest type construct that expresses the contract.

For this refactor, readable code has these observable properties:

1. **Facts are local.** A model capability is defined in one model record. A
   provider wire format is implemented in one protocol module. A run transition
   is owned by one clearly named orchestration operation. Readers do not search
   parallel registries to reconstruct one decision.
2. **The common path is linear.** The main function reads in execution order,
   uses early returns for invalid states, and delegates cohesive steps through
   domain-named functions. Avoid deep nesting, recursive callback chains, and
   control flow hidden inside generic factories or event indirection. Breaks in
   linear flow and additional nesting increase cognitive complexity.
3. **Names carry domain meaning.** Prefer `claimProviderCostCandidates` over
   `processItems`, `resolveVideoBinding` over `handleConfig`, and
   `provider-accounting.ts` over `utils.ts`. Avoid unfamiliar abbreviations,
   broad terms such as `manager`, `helper`, `common`, or `data`, and names that
   force the reader to inspect the implementation to discover the domain.
4. **Side effects are visible.** Network calls, transactions, object-storage
   writes, Trigger dispatch, and mutable state are explicit in function names,
   signatures, and module ownership. Do not hide them in constructors, getters,
   import-time initialization, schema parsing, or innocent-looking mapping
   functions.
5. **Types reduce work for the reader.** Use explicit domain interfaces and
   discriminated unions at boundaries. Prefer a small amount of obvious
   repetition over mapped, conditional, or highly inferred types that require
   mental evaluation across files. Do not encode business behavior in a type
   puzzle.
6. **Abstractions remove demonstrated repetition.** Share stable protocol,
   validation, and persistence behavior. Do not introduce a framework, factory,
   strategy hierarchy, plugin contract, or generic rule engine for one
   implementation or a hypothetical future provider.
7. **Modules are cohesive.** A module has one domain responsibility and a narrow
   public API. Splitting code should reduce the number of concepts per file, not
   create pass-through wrappers or force readers to jump between numbered
   fragments.
8. **Change surface is predictable.** Adding a model that uses an existing
   protocol changes one catalog record. Adding a genuinely new protocol changes
   one provider protocol area and its verification. A small product change must
   not require synchronized edits across Flow, Trigger, API, dashboard, and
   several registries.
9. **Failure behavior is direct.** Stable domain errors and state transitions
   are visible near the operation that can fail. Do not swallow errors, return
   ambiguous booleans, or use flags whose combinations create hidden execution
   modes.
10. **Comments are not required to decode routine logic.** Top-level TSDoc
    explains contracts and intent. Function bodies remain understandable from
    names, types, and structure, following the documentation rules in section
    3.5.

Good and bad reading paths:

| Good | Bad |
| --- | --- |
| Open one model record to understand capabilities and routing | Search current, major, historical, presentation, route, and scenario registries |
| Follow `admitRun -> planFlow -> resolveBinding -> executeProtocol` | Follow factories, generic dispatchers, registries, and pass-through adapters before finding the HTTP call |
| Read explicit `image`, `video`, `speech`, and `chat` protocol modules | Read one universal adapter controlled by provider/model/mode boolean combinations |
| See transaction and storage effects in named operations | Discover writes hidden inside mapping, parsing, constructors, or import side effects |
| Read a concrete interface with documented fields | Evaluate nested mapped and conditional types across module boundaries |
| Change one cohesive owner and its verification | Make matching edits in multiple packages to preserve duplicated facts |

A review must reject a design as unreadable when a developer cannot answer the
following without broad repository search or AI assistance:

- Where is this product fact defined?
- Which function owns this state transition or side effect?
- What is the normal execution order?
- What can fail, retry, or partially succeed?
- Which files must change for the next expected extension?
- Why does each abstraction exist today?

Target trace for a new run:

```txt
models.json model record
  -> Flow planner
  -> immutable run binding
  -> provider registry
  -> OpenRouter protocol adapter
```

The common path should require at most four conceptual module transitions.

### 3.2 Isolate what changes

- Model inventory and capabilities change together: keep them in the catalog.
- Provider HTTP protocols change together: keep them in provider packages.
- Graph semantics change together: keep them in Flows.
- Durable orchestration changes together: keep it in Trigger.
- Historical execution facts never change: keep them in run snapshots.

Do not organize modules around broad labels such as `utils`, `common`, `major`,
`current`, or numbered fragments.

### 3.3 Do not build for imagined requirements

Do not add a plugin framework, dependency-injection container, arbitrary rules
language, model database, admin catalog editor, or live production discovery.
Add a new abstraction only after two real implementations demonstrate the same
stable behavior.

### 3.4 Preserve durable behavior

Simplification must not weaken:

- tenant isolation;
- immutable snapshots;
- all five approved run modes;
- retries, cancellation, idempotency, and reconciliation;
- Trigger waitpoints and webhook recovery;
- exact input and output lineage;
- provider cost accounting;
- canonical generated Assets and managed folders;
- persisted canvas outputs;
- public generated-output storage policy.

### 3.5 TSDoc is part of the design

All authored TypeScript must follow the [TSDoc](https://tsdoc.org/) comment
standard. Documentation is part of the refactor's readability contract, not an
optional cleanup after implementation.

Requirements:

- Every package public entry point begins with a file-level TSDoc overview using
  `@packageDocumentation`, which documents the package as a whole. Every other
  authored source module begins with an ordinary `/** ... */` file overview and
  must not use the package tag. Explain the module's responsibility, ownership
  boundary, and place in the common execution path.
- Every exported function, class, type, interface, and constant has TSDoc that
  explains what it represents or does, the contract it exposes, and any
  important invariants or lifecycle behavior.
- Document internal functions when their purpose, ordering, side effects,
  concurrency behavior, failure behavior, or domain meaning is not immediately
  clear from the implementation.
- Function documentation describes meaningful parameters, return values,
  durable side effects, expected errors, idempotency, transaction boundaries,
  and retry behavior where applicable. Use standard tags such as `@param`,
  `@returns`, and `@throws` when they improve understanding.
- Every field of an exported type or interface has field-level TSDoc explaining
  what the field is used for. Include units, nullability meaning, identifier
  namespace, persistence semantics, and versioning meaning when relevant.
- Catalog schema types document every field represented in `models.json`, since
  JSON itself cannot carry TSDoc comments.
- Documentation belongs at module, declaration, and type-field boundaries. Do
  not scatter explanatory comments through function bodies or comment each
  logic step.
- Function bodies must be self-explanatory through precise names, cohesive
  responsibilities, explicit domain types, and small extracted operations. If
  the body needs routine narration to be understood, improve the code structure
  instead of adding comments.
- A function-body comment is allowed only as a rare exception for genuinely
  complex behavior that cannot be made clear through naming or extraction, such
  as a non-obvious protocol requirement, concurrency invariant, compatibility
  workaround, or specialized algorithm. Explain why the unusual code exists,
  not what each statement does.
- Comments explain intent and constraints. Never add narration that merely
  repeats a name, type annotation, or obvious statement from the code.
- Keep documentation synchronized in the same change as behavior. A stale or
  misleading TSDoc contract is an acceptance failure.
- Run the repository documentation check. It enforces module overviews,
  exported-declaration TSDoc, and reserves `@packageDocumentation` for package
  entry points; review remains responsible for the meaning and accuracy of
  contract and field documentation.

Example:

```ts
/**
 * Immutable provider route captured when a Flow run is admitted.
 *
 * Workers execute this captured binding instead of consulting the mutable
 * model catalog, so retries preserve the exact original provider contract.
 */
export interface ProviderBinding {
  /** Stable canonical `vendor/model` identity selected in the Flow. */
  modelId: string

  /** Provider implementation used for this admitted run. */
  provider: ProviderId

  /** Provider-native identifier sent over the selected wire protocol. */
  nativeModelId: string
}
```

## 4. Smallest Useful Domain Model

Only four concepts are required.

### 4.1 Product model definition

What the user selects and what the canvas is allowed to expose:

- stable canonical model ID using `vendor/model`, normally matching the model's
  established upstream identity;
- label and description translation keys;
- media/node family;
- supported operations;
- typed inputs;
- settings and defaults;
- cross-field constraints;
- output contract;
- active, deprecated, or retired status;
- per-model revision.

### 4.2 Private provider binding

How an operation is executed:

- provider;
- shared protocol;
- native provider model ID;
- endpoint;
- lifecycle;
- adapter version;
- priority/fallback order when applicable.

Provider bindings are server-only. They may live in the same checked-in JSON
record because native model IDs and endpoints are configuration, not secrets.
The API must remove them from its public projection.

### 4.3 Shared protocol adapter

Code that translates a normalized TaleLabs request to one provider protocol and
normalizes the response.

OpenRouter initially needs only:

```txt
image
video
speech
chat
```

There must not be one adapter per model. Add an adapter only for a truly new
wire protocol or lifecycle.

### 4.4 Immutable run binding

The exact provider/model/operation facts captured at admission and persisted in
the run snapshot. Workers execute this binding. They do not rediscover current
catalog state after admission.

## 5. Central Model Catalog

Create one intentionally small package:

```txt
packages/models-catalog/
  models.json
  package.json
  src/
    schema.ts
    catalog.ts
    public-catalog.ts
    provider-binding.ts
    index.ts
  scripts/
    check.ts
```

This is a library, not a service or framework. It owns the only manually
maintained model inventory.

### 5.1 Source-of-truth rule

`models.json` is the only file in which a developer manually adds, removes,
retires, or changes a current model.

Code may contain:

- the JSON schema;
- generic validation;
- catalog indexes and lookups;
- public/private projections;
- protocol implementations;
- exceptional named validators when a simple declarative constraint cannot
  express a real provider rule.

Code must not repeat model IDs, settings, capabilities, routes, or presentation
metadata in separate registries.

### 5.2 Proposed record

Keep the schema readable rather than maximally normalized:

```json
{
  "catalogVersion": 1,
  "models": [
    {
      "id": "bytedance/seedance-2.0",
      "revision": 1,
      "status": "active",
      "labelKey": "generation.models.seedance20.label",
      "descriptionKey": "generation.models.seedance20.description",
      "nodeType": "videoGeneration",
      "mediaType": "video",
      "defaultOperation": "textToVideo",
      "operations": {
        "textToVideo": {
          "inputs": {
            "prompt": { "type": "text", "required": true },
            "references": { "type": "image", "maxItems": 3 }
          },
          "settings": {
            "aspectRatio": {
              "type": "enum",
              "values": ["16:9", "9:16"],
              "default": "16:9"
            },
            "durationSeconds": {
              "type": "enum",
              "values": [4, 6, 8],
              "default": 6
            },
            "resolution": {
              "type": "enum",
              "values": ["480p", "720p", "1080p"],
              "default": "720p"
            }
          },
          "outputs": { "type": "video", "maxItems": 1 }
        }
      },
      "bindings": [
        {
          "provider": "openrouter",
          "protocol": "video",
          "model": "bytedance/seedance-2.0",
          "endpoint": "/api/v1/videos",
          "lifecycle": "async-webhook-poll",
          "adapterVersion": 1,
          "priority": 100
        }
      ]
    }
  ]
}
```

The exact migrated values must come mechanically from the current reviewed
registry. This example defines shape, not final provider facts.

### 5.3 Canonical model identity

Do not prefix model IDs with `talelabs/`. TaleLabs does not gain a useful
abstraction from renaming `bytedance/seedance-2.0` to
`talelabs/seedance-2.0`.

Use the canonical `vendor/model` identity in the catalog, mutable Flow drafts,
and new immutable snapshots:

```txt
bytedance/seedance-2.0
google/gemini-3.1-flash-image
openai/gpt-image-2
```

Model identity and execution routing remain separate concepts. A binding may
initially execute `bytedance/seedance-2.0` through OpenRouter and later execute
the same canonical model through a direct ByteDance integration with a
different provider-native identifier. Changing the provider binding must not
change the model selected by the user.

The current database and stored snapshots are development-only and will be
reset before production. Therefore this refactor must perform a hard rename:

- update current and copied development registries directly;
- update fixtures, scenarios, defaults, presentations, and routes directly;
- reset the development database after cutover;
- do not add a database migration for model IDs;
- do not add `talelabs/*` aliases, fallback resolution, or compatibility code;
- do not preserve pre-production snapshot contracts solely for these IDs.

After the production reset, canonical IDs and admitted immutable snapshots are
stable contracts. Future renames or model replacements must preserve production
data through an explicit compatibility decision.

### 5.4 Constraint vocabulary

Use a small fixed vocabulary:

- required input;
- media type;
- `maxItems`;
- enum and bounded-number settings;
- `oneOf`;
- mutually exclusive inputs;
- conditional visibility/availability;
- output count and type.

Do not invent a generic expression language. If a provider has a real rule that
cannot fit this vocabulary, the catalog may reference one named validator such
as `seedanceReferenceMode`. Named validators are exceptions and must remain
short, tested, and co-located by node family.

### 5.5 Validation

Parse the JSON with a runtime schema during:

- catalog package import/startup;
- `generation:check`;
- API startup;
- production build.

Fail when:

- model IDs are duplicated;
- revisions are invalid;
- an active operation has no provider binding;
- binding priorities conflict;
- a binding names an unsupported protocol/lifecycle;
- defaults violate their own settings;
- public operations cannot be resolved;
- a retired model is accidentally selectable;
- public projection contains private binding or provider policy.

TypeScript's JSON-module support supplies structural inference, but runtime
schema parsing remains necessary because JSON content is external data from the
compiler's perspective.

### 5.6 Provider discovery

OpenRouter discovery APIs are research tools, not production configuration.
They can be used manually or by a read-only verification command when reviewing
a model change. They must never rewrite `models.json` or silently alter runtime
behavior.

The reviewed decision is encoded in JSON and ships with the application.

## 6. Target Package Responsibilities

### 6.1 `packages/models-catalog`

Owns:

- current model inventory;
- capabilities and defaults;
- provider bindings;
- catalog validation;
- public sanitized projection;
- exact server-side binding lookup.

Does not own HTTP, PostgreSQL, Trigger tasks, graph planning, or UI components.

### 6.2 `packages/flows`

Owns only provider-neutral creative graph behavior:

- node and edge types;
- typed runtime values;
- graph validation;
- command selection;
- topological planning;
- input materialization;
- job expansion and multiplicity;
- execution-contract and snapshot assembly;
- plan/snapshot limits and serialization.

It reads model definitions through the catalog API. It must not contain
OpenRouter-specific model files, provider routes, native endpoints, or copied
catalog histories.

Recommended readable organization:

```txt
packages/flows/src/
  graph/
  nodes/
    image/
    video/
    llm/
    audio/
    inputs/
  runtime/
    planning/
      selected-graph-preparation.ts
      execution-materialization.ts
      job-expansion.ts
      plan-assembly.ts
      planner.ts
    snapshots/
    values/
```

Split by actual responsibility, not by arbitrary file size or numbered parts.

### 6.3 `packages/openrouter`

Owns only OpenRouter transport and protocol translation:

```txt
packages/openrouter/src/
  adapter.ts
  protocols/
    image.ts
    speech.ts
    chat.ts
    video/
      index.ts
      inputs.ts
      media.ts
      references.ts
      response.ts
      settings.ts
      types.ts
  transport/
  sdk/
  webhooks/
  errors.ts
  types.ts
  index.ts
```

Each protocol module accepts:

```txt
normalized request + immutable provider binding
```

and returns:

```txt
normalized immediate/async result + provider metadata
```

It must not own TaleLabs presentation metadata, historical product registries,
Flow semantics, database access, Trigger tasks, or one adapter per model.

The four existing shared protocol adapters are the right abstraction. Preserve
their behavior while moving request shaping and response normalization into this
package.

### 6.4 `packages/trigger`

Owns durable execution:

- thin task entrypoints under `src/tasks`;
- run/job state transitions;
- bounded orchestration and queues;
- waitpoint creation and completion;
- webhook wake-up coordination;
- retries, cancellation, and reconciliation;
- provider cost reconciliation;
- output finalization and canonical Asset ingestion.

Trigger receives IDs, loads the immutable snapshot, and invokes a provider from
one small provider registry:

```txt
provider name -> provider adapter
```

It must not know OpenRouter request fields, per-model settings, endpoint
histories, or presentation metadata.

Suggested trace:

```txt
orchestrator task
  -> generation job service
  -> provider registry
  -> OpenRouter protocol adapter
  -> output finalizer
```

Keep Trigger.dev because it still supplies durable retries, waitpoints,
concurrency, cancellation, and recovery around provider-owned asynchronous jobs.
OpenRouter's job system does not replace the TaleLabs run, lineage, ingestion,
and recovery state machine.

### 6.5 API and dashboard

- API returns the catalog's sanitized public projection.
- Dashboard renders from that public definition.
- Dashboard never receives provider bindings, credentials, fallback policy, or
  internal cost policy.
- Adding a model using an existing node family must not require a new React
  component.

## 7. Dependency Direction

```mermaid
flowchart LR
  Dashboard["Dashboard"] --> API["API public catalog"]
  API --> Catalog["models-catalog"]
  API --> Flows["flows"]
  Flows --> Catalog
  Trigger["trigger"] --> Flows
  Trigger --> Catalog
  Trigger --> OpenRouter["openrouter"]
  OpenRouter --> Flows
  Trigger --> DB["PostgreSQL / R2"]
```

The OpenRouter package may depend on provider-neutral normalized execution
contracts in Flows. Do not create another package merely to make the diagram
more theoretically pure.

Forbidden directions:

- Flows importing OpenRouter;
- OpenRouter importing Trigger or database code;
- catalog importing Flow planning or provider clients;
- dashboard importing private catalog bindings;
- Trigger reconstructing model capabilities already captured in the snapshot.

## 8. Historical Compatibility Without Permanent Duplication

### 8.1 New runs

New run snapshots must contain the complete resolved execution binding:

- canonical `vendor/model` ID and model revision;
- operation and normalized settings;
- provider and protocol;
- native model and endpoint;
- lifecycle and adapter version;
- route/binding revision if needed;
- exact selected inputs and payload order;
- registry/catalog version for diagnostics.

The worker validates and executes this snapshot. It does not query a historical
catalog to rediscover the route.

### 8.2 Pre-production reset

There are no production Flows or runs to preserve during this refactor. Delete
the development-only `talelabs/*` identity and historical route duplication
instead of carrying a legacy resolver into production. Reset the development
database once the canonical catalog and execution path are ready.

This exception applies only before the first production database. After launch,
retries must always preserve the original immutable binding and supported
snapshot formats must not be deleted without an explicit migration or
compatibility plan.

### 8.3 Versioning model

Stop copying the complete global catalog for every change.

Use:

- stable model ID;
- integer per-model `revision`;
- catalog format version only when JSON structure changes;
- snapshot format version only when execution shape changes;
- full resolved binding in every new snapshot.

Adding one model must not create a new historical copy of every other model.

## 9. Retain, Move, and Delete Map

### Retain

- typed Flow graph and runtime-value contracts;
- approved adaptive node UX and settings behavior;
- graph command selection and all five run modes;
- immutable run snapshots;
- PostgreSQL run/job/source/input/output persistence;
- Trigger waitpoints, webhook wake-up, fallback polling, retries, cancellation,
  reconciliation, and queue limits;
- four shared OpenRouter protocol adapters;
- output validation, finalization, lineage, managed folders, and canonical Assets;
- provider accounting and later cost reconciliation.

### Move and simplify

- current model capabilities and presentation data -> `models.json`;
- current private routes -> each model's `bindings`;
- OpenRouter request/response logic currently under Trigger -> OpenRouter
  protocol modules;
- catalog public projection -> models-catalog;
- oversized Flow planning logic -> named pipeline responsibilities.

### Delete after cutover

- copied global dated model registries for new runs;
- separate active selectable, presentation, and route registries;
- `current`, `major`, and duplicated historical route builders for new runs;
- model-specific adapters;
- provider-specific request shaping in Trigger;
- temporary old-vs-new parity scripts;
- pre-production compatibility code and `talelabs/*` aliases;
- stale docs describing TypeScript registries as the maintained model source.

## 10. Incremental Execution Plan

### Phase 0 - Freeze and measure behavior

Goal: establish a trustworthy baseline before structural changes.

1. Inventory every currently selectable model, operation, setting, provider
   route, lifecycle, and adapter.
2. Confirm that all persisted runs are development-only and record the database
   reset requirement.
3. Capture representative normalized requests/results with fake HTTP for:
   image, video, speech, chat, webhook completion, and polling recovery.
4. Preserve scenarios for all five run modes.
5. Record current module and line counts as a comparison baseline.
6. Do not make paid provider calls.

Exit gate: current behavior is mechanically observable without relying on the
old implementation's internal shape.

### Phase 1 - Add the catalog in parallel

Goal: create one validated model source without switching runtime behavior.

1. Add `packages/models-catalog`.
2. Translate current active models and bindings mechanically into `models.json`.
3. Add runtime schema parsing and uniqueness/coverage checks.
4. Add public/private projection checks.
5. Add a temporary parity script comparing old and new active catalog outputs.
6. Do not hand-edit both systems after the initial translation; catalog changes
   pause until cutover or are applied mechanically to both.

Exit gate: new catalog represents current behavior exactly and passes offline
checks.

### Phase 2 - Switch catalog readers

Goal: make one source drive product behavior.

1. API config endpoints read the public catalog projection.
2. Dashboard consumes the unchanged public API shape or a deliberately versioned
   replacement.
3. Flow resolution receives model definitions from the catalog.
4. Remove duplicated active selectable and presentation registries.
5. Keep old snapshot execution untouched.

Exit gate: canvas model selection, handles, settings, and validation match the
approved UI behavior using only the JSON catalog.

### Phase 3 - Write self-contained snapshots

Goal: prevent new work from depending on historical route catalogs.

1. At admission, resolve one exact provider binding from the catalog.
2. Store the full binding in the immutable snapshot/job contract.
3. Validate snapshots at admission and worker start.
4. New workers execute the captured binding directly.
5. Development-only old snapshots are discarded in the planned database reset.

Exit gate: changing or retiring the current catalog cannot alter an admitted
run, and new retries do not query historical route copies.

### Phase 4 - Simplify OpenRouter

Goal: make provider code readable by protocol.

1. Consolidate image request/response handling in `protocols/image.ts`.
2. Keep video submit/status handling behind the clear
   `protocols/video/index.ts` facade, with input, media, reference, response,
   setting, and wire-type concerns in that cohesive directory.
3. Consolidate speech byte handling in `protocols/speech.ts`.
4. Consolidate chat handling in `protocols/chat.ts`.
5. Keep one client, error mapper, webhook verifier, and narrow shared types.
6. Delete route builders and route catalogs no longer used by new snapshots.

Exit gate: tracing an OpenRouter call requires opening one protocol facade and
its narrowly owned helpers plus the client, not a model route family and a
Trigger adapter family.

### Phase 5 - Simplify Trigger ownership

Goal: leave Trigger responsible for durability, not provider translation.

1. Keep task entrypoints thin.
2. Replace OpenRouter-specific adapter trees with one provider registry call.
3. Pass normalized request and immutable binding to `packages/openrouter`.
4. Preserve waitpoints, wake-up, fallback polling, cancellation, and recovery.
5. Preserve output validation, cost capture/reconciliation, and Asset ingestion.
6. Keep task payloads ID-only.

Exit gate: Trigger code can orchestrate another provider without knowing its
HTTP request shape.

### Phase 6 - Simplify Flow internals

Goal: reduce the reading path without changing graph semantics.

1. Keep the planner as a visible pipeline:
   command selection -> materialization -> job expansion -> snapshot assembly.
2. Organize generation resolution by node family, not provider or catalog era.
3. Extract only cohesive responsibilities.
4. Respect the 600-line and three-function authored-source limits.
5. Reject thin wrappers, generic helper dumping grounds, and numbered fragments.

Exit gate: a developer can explain planner stages from filenames and trace one
job without searching provider-specific registries.

### Phase 7 - Remove migration scaffolding

Goal: finish the refactor rather than leave two architectures.

1. Remove temporary parity code.
2. Remove unused current/major/history registries and routes.
3. Remove development-only legacy route and model-ID compatibility code.
4. Update package READMEs and dependency diagrams.
5. Update root/package `AGENTS.md` rules.
6. Update active product/runtime/API/database/execution docs.
7. Reset the development database and verify new Flows persist canonical model
   IDs and self-contained snapshots.

Exit gate: one maintained catalog and one execution path exist for all new work.

## 11. Maintenance Workflows After Refactor

### Add a model using an existing protocol

1. Research official provider/OpenRouter capability evidence.
2. Add one model record to `models.json`.
3. Run catalog and fake-provider checks.
4. Add translations only when new label/description keys are required.

No adapter, route-builder, Trigger, or Flow file should change.

### Change a model capability

1. Edit its JSON record.
2. Increment that model's revision.
3. Run checks.

Production snapshots created after the reset keep their captured contract.

### Retire a model

After production launch, set `status` to `retired`. Do not delete the record
while drafts or supported historical behavior still reference it. New nodes
cannot select it; admitted runs remain executable from snapshots.

### Add a direct provider later

Add an ordered binding. If it uses an existing protocol and transport contract,
reuse the adapter. If its wire protocol genuinely differs, add one cohesive
provider protocol module. Do not add model-specific adapters.

### Add a truly new operation or protocol

Only then update the schema vocabulary and implement one new protocol adapter.
Keep the change focused on the new product behavior.

## 12. Verification Matrix

Every migration phase must run relevant checks, and the final cutover must run
all of them.

### Catalog

- schema parsing;
- stable ID and revision uniqueness;
- active operation/binding coverage;
- adapter/lifecycle compatibility;
- defaults and constraints;
- retired-model exclusion;
- public projection privacy;
- no duplicate manually maintained catalog.

### Runtime

- all five run modes;
- immutable snapshot validation;
- image immediate output;
- speech immediate/byte output;
- chat output;
- video async submit, webhook wake-up, and fallback polling;
- multi-output ordering;
- retry, cancellation, idempotency, and reconciliation;
- same-run and prior-run lineage;
- generated output persisted as a canonical Asset;
- managed folder placement and public storage policy;
- provider cost capture and successful-null-cost reconciliation.

### Repository

- catalog check;
- planner/snapshot scenarios;
- provider adapter scenarios using fake HTTP only;
- SDK generation;
- all workspace type checks;
- i18n validation for all supported locales;
- repository TSDoc/module-overview validation;
- repository lint;
- forced production build;
- Trigger.dev deployment dry run;
- `git diff --check`;
- no temporary generated directories;
- no new non-sensitive environment variables.

## 13. Readability and Maintainability Acceptance Gates

The refactor is not complete merely because behavior passes.

It must also satisfy:

1. A current existing-protocol model is added by editing one model record.
2. No model-specific adapter is needed for that change.
3. A developer can trace a run through no more than four conceptual modules.
4. No authored source file exceeds 600 physical lines.
5. No authored source file defines more than three functions.
6. Flows contains no provider-specific routes or native model IDs.
7. Trigger contains no OpenRouter request-shaping knowledge.
8. OpenRouter contains no TaleLabs product presentation registry.
9. The active model catalog is not duplicated in TypeScript, JSON snapshots, or
   generated code that developers must maintain manually.
10. Existing run state transitions and output lineage remain unchanged in
    deterministic fake-provider scenarios.
11. Package/module count and line count are measured before and after; reductions
    must come from deleted concepts, not compressed or hidden code.
12. Package READMEs explain ownership, one common trace, and one extension trace
    in language a new developer can follow.
13. Authored TypeScript follows the TSDoc contract: package entry points alone
    use `@packageDocumentation`; ordinary modules use file overviews; exported
    symbols and exported type fields explain ownership, purpose, and invariants.
14. The automated documentation check validates overview coverage,
    exported-declaration TSDoc, and package-tag placement. Focused review
    confirms comments remain synchronized with behavior, stay at the
    appropriate top-level or field boundary, and do not merely restate
    implementation syntax. Function-body comments require a concrete
    exceptional reason.

## 14. Non-Goals

This refactor does not include:

- a microservice split;
- a plugin framework;
- dependency injection;
- a model database or admin UI;
- live model discovery controlling production;
- billing or credits;
- Elements;
- canvas UX redesign;
- new provider integrations;
- new run modes or iteration nodes;
- changes to user-approved run semantics;
- new environment variables;
- paid provider verification.

## 15. Main Risks and Controls

| Risk | Control |
| --- | --- |
| Big-bang rewrite breaks working runs | Incremental parallel catalog and strangler cutover |
| Pre-production data shapes leak into production | Hard canonical-ID cutover followed by a deliberate development database reset |
| JSON becomes an untyped dumping ground | Small schema, runtime validation, fixed constraint vocabulary |
| Public API leaks provider policy | Explicit sanitized projection with fail-closed check |
| New abstraction recreates complexity | No framework/DSL/DI; require demonstrated repetition |
| Trigger behavior regresses while moving adapters | Preserve lifecycle scenarios and fake HTTP boundaries |
| Provider costs disappear after successful output | Preserve durable accounting reconciliation as a release gate |
| Two sources remain after migration | Final phase deletes temporary parity and old active registries |

## 16. Research Basis

This design intentionally follows a small number of practical sources:

- [OpenRouter Models API](https://openrouter.ai/docs/guides/overview/models):
  model discovery exposes modalities and supported parameters. TaleLabs uses it
  for research, then checks reviewed decisions into its catalog.
- [OpenRouter image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation):
  the provider exposes a normalized image protocol and endpoint-level capability
  descriptors, supporting one shared image adapter.
- [OpenRouter video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation):
  video is an asynchronous normalized protocol, supporting one shared video
  adapter with webhook/poll behavior.
- [Trigger.dev waitpoints](https://trigger.dev/docs/wait-for-token): durable
  tasks can pause for external callbacks instead of occupying a worker.
- [Trigger.dev queues and concurrency](https://trigger.dev/docs/queue-concurrency):
  Trigger remains useful for TaleLabs-owned orchestration even when providers
  own their internal media-generation jobs.
- [Google engineering review guidance](https://google.github.io/eng-practices/review/reviewer/looking-for.html):
  complexity is code readers cannot understand quickly or are likely to modify
  incorrectly; avoid speculative generic behavior and complexity hidden behind
  comments.
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html):
  use descriptive names, named exports, clear imports, and the simplest type
  construct that expresses the contract; mapped and conditional types impose a
  real readability cost when readers must evaluate them across files.
- [Sonar cognitive-complexity research](https://www.sonarsource.com/the-state-of-code-languages.pdf):
  breaks in linear control flow and deeper nesting increase the effort required
  to understand code, supporting the plan's preference for visible pipelines
  and shallow control flow.
- [Google README guidance](https://google.github.io/styleguide/docguide/READMEs.html):
  package-level READMEs give first-time readers ownership, purpose, usage, and
  navigation context without requiring repository-wide discovery.
- [AWS Strangler Fig guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html):
  incrementally replace a working system instead of accepting big-bang rewrite
  risk.
- [TypeScript JSON modules](https://www.typescriptlang.org/tsconfig/resolveJsonModule.html):
  JSON imports can participate in TypeScript builds, while TaleLabs still adds
  explicit runtime schema validation.

## 17. Final Recommendation

Proceed with this refactor before adding more providers or expanding the model
inventory substantially.

Do not begin by moving files. Begin with Phase 0 behavior baselines and Phase 1
parallel catalog validation. The first runtime switch should happen only after
the new catalog proves parity with the current active behavior.

The desired result is not an impressive architecture. It is a boring one:

```txt
one catalog
one planner
one immutable binding
one adapter per protocol
one durable orchestrator
```

That is sufficient for the current product and leaves a clear extension path
when real product usage requires more.
