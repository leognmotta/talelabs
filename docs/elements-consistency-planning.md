# TaleLabs — Elements As A Consistency System

**Purpose:** redefine Elements from "categorized Asset collections" into the product's answer to the #1 pain of AI media production: **consistency** — the same character, product, location, or brand identity surviving across generations. This document settles the data model, lifecycle, and Flow behavior after adversarial review; it is the source of truth for the Elements redesign.

Companions: `db-design-planning-v2.md` (persistence, `elements.revision` guard), `flow-nodes-planning.md` (role handles, runtime values), `api-design-planning-v2.md`.

---

## The principle

> **An Element owns the source of truth. The consuming model receives a curated representation of that truth.**

Provider guidance converges on the same pattern (verified):

- [Runway Gen-4 References](https://help.runwayml.com/hc/en-us/articles/40042718905875-Creating-with-Gen-4-Image-References): up to 3 references per generation; clean, well-lit, neutral references work best.
- [Veo (Gemini API)](https://ai.google.dev/gemini-api/docs/veo): up to 3 asset references **of a single subject**.
- [Luma consistency guidance](https://lumalabs.ai/learning-center/articles/character-and-object-consistency): small master-reference pack, separate clean angles, explicit locked attributes; avoid dense combined sheets.
- [Adobe Firefly](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/structure-image-reference/): identity/content, structure, and style are **different controls**, exposed separately.
- [ElevenLabs voice cloning](https://elevenlabs.io/docs/eleven-api/concepts/voice-cloning): clean single-speaker recordings; quality/duration budgets, not image-style counts.

Consistency is therefore not a feature or a single asset — it is a controlled lifecycle:

```txt
source evidence -> locked identity -> curated master pack -> provider-aware selection -> immutable run provenance
```

---

## The model

```txt
Element
├── Identity contract   what must never drift (typed data, versioned schema)
├── Source Assets       many raw inputs; evidence, never sent to providers
└── Master Pack         small curated per-role collections; the ONLY thing Flows emit
```

### 1. Identity contract

Every Element type's `data` schema gains an identity block (arrays of plain strings — no taxonomy engine):

```ts
type ElementIdentity = {
  summary: string;
  mustKeep: string[]; // "facial structure", "logo geometry", "cap shape"
  mayVary: string[]; // "clothing", "camera angle", "lighting"
  avoid: string[]; // "cartoonish rendering", "competitor colors"
};
```

`buildContext` compiles it into the resolved prompt: locked attributes stated explicitly is what every provider guide recommends.

**Migration discipline (settled after review):** adding `identity` is a schema-version bump **with a sequential in-code migration function** — the registry's fail-closed upcasting (`packages/elements/src/upcasting.ts` throws on gaps) makes this non-optional. No eager SQL rewrite of stored JSONB rows; every read upcasts lazily:

```ts
function migrateCharacterV1ToV2(data: unknown) {
  return {
    ...CharacterElementDataSchemaV1.parse(data),
    identity: { summary: "", mustKeep: [], mayVary: [], avoid: [] },
  };
}
```

### 2. Sources vs. masters — one field, promotion is approval

```ts
type ElementAssetLink = {
  elementId: string;
  assetId: string;
  role: string;
  referenceKind: "source" | "master";
  sortOrder: number;
  isPrimary: boolean;
  referenceMetadata: unknown; // registry-validated per role; see below
};
```

- **`source`**: raw evidence — photos, existing renders, recordings, campaign material. Many allowed. Never emitted to Flows, never reaches a provider.
- **`master`**: approved, model-ready references. Small, curated. The only links role handles emit.
- **Promotion (`source → master`) IS the approval act.** No separate `approvalStatus` state machine: a 3-state approval field × usage would create six states, half meaningless. Generated candidates land as `source`; rejecting = leaving them there or detaching. A `pending` value can be **added to this same enum later**, with the AI pack-builder that produces candidates — additively.
- `master` over "reference" as the term: raw uploads are also references in ordinary product language; "master" says _canonical_.
- Existing `elementAssets` rows default to `'master'` (they were emitted to Flows before; behavior is preserved).
- **No audit-history claim**: the table has only `createdAt` today. If curation audit becomes a need, add `curatedAt`/`curatedBy` then — an `updatedAt` would only record the latest mutation, which is not history.

### 3. Capacities count masters, not sources

The per-role limits (`ElementRegistry[type].assetRoles[].maxAssets`, enforced with advisory locks) apply to **masters only** — otherwise eight raw uploads would leave no room to generate and approve better canonical views. Sources get one bounded, element-wide abuse cap:

```txt
sourceLimitPerElement: 50        (config, abuse protection — not a product concept)
masterRoles: appearance 8, expression 8, motion 1, voice 1, ...   (registry, per type)
```

Voice roles will eventually need duration budgets (total clean seconds) rather than item counts — that refinement ships with voice-model integration, as a role-constraint extension.

### 4. Metadata: intrinsic facts on the Asset, interpretation on the link

The same photo can contain two people and be linked to two different Character Elements — its sharpness is a fact about the file; _which person it depicts and how it should be used_ is a fact about the relationship.

```txt
assets.metadata (exists)          resolution, duration, blur score, detected
                                  subject count, technical quality
elementAssets.referenceMetadata   view: front|threeQuarter|profile|rear
(new, jsonb, registry-validated   framing: portrait|halfBody|fullBody|detail
 per element type + role)         background: clean|environment
                                  variant: string
```

Captured at curation time (retro-tagging a library later is the painful alternative). Keys are owned by the registry per role; unknown keys are rejected app-side, same contract as element `data`.

### 5. Readiness is derived, never stored

```ts
type ElementReadiness = {
  state: "empty" | "usable" | "strong";
  missing: string[]; // "profile view", "full-body reference"
  recommendations: string[];
};
```

The **type registry owns the rules** (e.g. Character `usable` = identity contract + ≥1 master appearance; `strong` = neutral portrait + profile/three-quarter + full body). The API computes the badge from current data — a stored status column is a cache that drifts, and its own "needs attention" state would exist to detect its own staleness. Store nothing until a query proves expensive.

### 6. `elements.revision` — the snapshot consistency guard (kept)

Settled in `db-design-planning-v2.md`: `elements.revision` increments **in the same transaction** as any mutation to element `name`/`instructions`/`data`/schema version or any `elementAssets` role/order/primary/kind/metadata change. Run (and future Tool-version) snapshot builders capture all participating Element revisions and re-read them immediately before commit; a mismatch rolls back and retries.

Why a counter and not just careful reads: a single-statement `element + links` join gives a clean point-in-time **read**, and remains the required way to read — but it cannot detect an edit landing **between resolution and job insert**, nor keep _multiple_ Elements mutually coherent across one admission. The revision closes the read-to-commit window, symmetric with the shipped `flows.revision` CAS. The two compose; neither replaces the other. Ships with the M5 run-admission migration.

---

## Flow behavior (unchanged shape, filtered content)

The settled node design stands exactly as-is — role handles emitting typed sets, context handle emitting `ElementContext`:

```txt
Element: Maya
├── context      -> ElementContext   (identity contract folded in via buildContext)
├── appearance   -> ImageSet         masters only, sortOrder, primary first
├── expressions  -> ImageSet
├── motion       -> VideoSet
└── voice        -> AudioSet
```

The only change is the filter: **role handles emit `referenceKind = 'master'` links only.** Consumer-side selection then applies, in order:

```txt
approved master pack -> model capability filtering -> target-aware ranking
-> user override -> exact references snapshotted for the run
```

Target-aware ranking (later, with provider integration) prefers matching `referenceMetadata` — a profile shot request prefers the approved profile master over an arbitrary primary portrait.

## Model reference profiles (consumer-side, richer than two numbers)

Provider limits stay out of Elements. The generation registry's input slots grow a benchmark layer, **field by field, with the first provider that needs each**:

```ts
{
  maxItems: 8,              // provider contract (declared)
  recommendedMaxItems: 3,   // TaleLabs benchmark (a provider may accept 8 while
                            //   identity degrades after 3 — never present ours as theirs)
  supportsMultipleSubjects: false,
  recommendedReferenceKinds: ['identity'],   // identity/style/structure/firstFrame/motion
                            //   are NOT interchangeable (Adobe splits them for this reason)
  contactSheetPolicy: 'avoid',               // Luma: separate angles beat dense sheets
}
```

Contact sheets, when a benchmarked model prefers them, are optional **derived** Assets — never a replacement for individual masters.

---

## Build order

```txt
1. Identity contracts: schema v+1 per type WITH sequential in-code migrations
2. referenceKind on elementAssets (existing rows default 'master') + source cap
3. referenceMetadata (registry-validated per role), captured in the curation UI
4. Role capacity + Flow role handles filter to masters only
5. Derived readiness from registry rules (empty | usable | strong + missing[])
6. elements.revision with the M5 run-admission migration (transactional bumps)
7. DEFERRED: AI pack builder (quality analysis, suggest-strongest, generate
   missing canonical views, consistency testing) — workflows on top of this
   model, no new schema; 'pending' joins the referenceKind enum with it;
   curatedAt/curatedBy when curation audit is asked for
```

The rule the deferred work must obey: **AI suggests, the user approves — nothing silently replaces identity.**

## UX contract — the machinery is ours, not the user's

Market reality (researched): the competing experience is one anchor image + a strength slider (Leonardo), drag-an-image + a weight (Midjourney), or `@`-mentioning a character in a prompt (LTX). **Element creation must never be harder than that.** TaleLabs wins after creation — the lifecycle, packs, and provenance are the differentiator — and all of it must be invisible until wanted.

**The user vocabulary is exactly three concepts:** References · Consistency notes · Improve consistency. Users are asked for creative information, never database classifications or AI-infrastructure decisions. The full mapping:

```txt
internal concept                    user-facing concept
referenceKind: 'master'         ->  References
referenceKind: 'source'         ->  "More source media" (collapsed; most never open it)
identity contract               ->  one optional "Consistency notes" text field
                                    (stored as identity.summary now; mustKeep/mayVary/avoid
                                     arrays extracted by AI later — users edit prose, not arrays)
derived readiness               ->  "Ready to use" / "Can be improved" (never error-red)
referenceMetadata               ->  inferred automatically; user corrects only mistakes
model capability filtering      ->  "3 of Maya's 5 references used" on the generation node
promotion source -> master      ->  "Use recommended set" / "Add to Maya's references"
```

**Creation:** name required, everything else optional. One image → usable Element, immediately. No wizard, no mandatory angle labeling, no mustKeep questionnaire.

**Staged UI (features appear only when their machinery exists):**

```txt
Now      uploads become active References directly (referenceKind 'master');
         ordering + primary = ranking; one upload-time hint line
         ("clean, well-lit, single subject works best" — the one piece of
         provider guidance worth teaching); no source/master words anywhere
With the assistant   "Improve consistency" button: analyze pack -> one visual
         review screen (recommended set + detected conflicts) -> accept/keep mine;
         new uploads land as sources; AI candidates land as sources; metadata inferred
Later    @-mention Elements in prompt fields (LTX-validated interaction);
         per-generation identity-strength control where a provider supports it
         (exposed in the inspector, never the default path)
```

**The improvement flywheel:** after a generation the user explicitly keeps (favorite/save — never a nag after every run), offer **"Add to Maya's references"**. That single action is a promotion, closes the loop the vision named ("save a useful generated result back to an Element"), and means consistency improves through use instead of through upfront configuration.

**Anti-goals (each one is a user we lose):** creation wizards, mandatory image labeling, visible quality scores, source/master terminology, required pack approval, status dropdowns, model selection inside Elements, silent automatic replacement of identity, a second media library.

## What this buys

Every competitor lets users attach reference images. Almost none manage the _lifecycle_ that makes references actually work: locked identity, curated small packs of clean separate angles, provider-aware selection with honest benchmarked limits, and immutable per-run provenance. That lifecycle is what Elements now is — the reason to build a character in TaleLabs instead of re-uploading the same three photos into a model UI forever.
