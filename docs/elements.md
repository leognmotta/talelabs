# Elements — Reusable Reference Collections

**Status:** active source of truth, approved 2026-07-18 (control/capture
iteration approved and implemented the same day). Supersedes every earlier
Element exploration, including the retired multi-role/consistency
architecture and its planning documents.

## Product definition

An Element is a **named, ordered collection of reference image Assets** — a
character, a prop, a location, a style — saved once and reused in any Flow.
On the canvas it is one node with **exactly one output**.

This matches the primitive every major competitor converged on: LTX Studio
Elements, Kling Elements, Runway Gen-4 References, Midjourney Omni-Reference,
Vidu Reference-to-Video, and Pika Scene Ingredients are all small named bundles
of reference images attached to a generation. None of them use asset roles,
approval states, readiness rules, or per-type schemas.

## The model

```txt
Element
├── name          "Maya", "Acme Bottle", "Neo-Tokyo Alley"
├── kind          character | prop | location | style | other  (label only)
├── description   optional prose; not sent to providers
└── references    0–8 ordered image Assets; the first is the cover
```

Rules that hold everywhere:

1. `kind` is presentation only: icon and library filter. All kinds share one
   behavior, one form, one validation path. Adding a kind is a change to
   `ELEMENT_KINDS` in `@talelabs/assets` plus localized labels — never a
   migration.
2. References are canonical image Assets. One Asset may belong to many
   Elements. Deleting an Element never touches Assets; purging an Asset
   detaches it from every Element inside the purge-request transaction
   (purged Assets are tombstoned, so no FK cascade would ever fire).
   An Element may be empty (created ahead of capture, or emptied by
   removals); an empty Element or empty node selection simply emits
   nothing.
3. The maximum is `MAX_ELEMENT_REFERENCES` (8). Provider/model input limits
   belong to the consuming generation slot, not the Element.
4. There are no versioned JSONB payloads, no per-kind forms, no asset roles,
   no source/master kinds, no readiness, no custom roles, no reference
   budgets, and no Element folders.

## Database

```sql
elements            id, organizationId, createdBy, kind, name,
                    description, createdAt, updatedAt
elementReferences   organizationId, elementId, assetId, sortOrder, createdAt
                    primary key (elementId, assetId)
```

Migration `027_reset_elements` dropped the failed experiment's tables (data
deleted by explicit product decision), cleared the orphaned `elements_root`
folder role, created the v2 tables, and re-pointed the
`generationJobSources.elementId` provenance FK at the new table.

## API

```txt
GET    /elements                 list (kind, search, assetId filters; cursor)
POST   /elements                 create with references, one transaction
GET    /elements/:id             detail with ordered references
PATCH  /elements/:id             update name/kind/description and, when
                                 assetIds is sent, the complete ordered
                                 list — one transaction (the editor's Save)
DELETE /elements/:id             delete; Assets untouched
PATCH  /elements/:id/references  atomic { add?, remove? } against the
                                 current server-side list (capture + Undo)
```

Two reference write shapes, both single transactions with the Element row
locked:

- **Full-list replacement** rides on create/update for the editor, where the
  user owns the complete ordered list (reorder, remove, cover choice).
- **Atomic add/remove** serves capture flows: additions already present are
  skipped, additions beyond capacity are dropped in request order, absent
  removals are no-ops, and the response's `addedAssetIds`/`removedAssetIds`
  state exactly what changed — so concurrent adds never overwrite each
  other, and Undo removes only what its own call added.

Validation everywhere: tenant-owned image Assets that are not being purged;
max 8; duplicates rejected. List covers resolve in one batched
`distinct on` query — no per-Element fan-out.

## The Element Flow node

- Node type `element` stores `{ elementId, locked, selectedAssetIds }` in
  node `data` — no dedicated column, no FK. A deleted Element leaves the node
  visibly unresolved without blocking draft persistence.
- One static output handle: `references → ImageSet`. It connects everywhere an
  image Asset output already connects; there are no other outputs.
- **Per-node selection:** the node stores an explicit `selectedAssetIds`
  subset — there is no implicit "all" mode. Picking an Element opens a
  two-step modal (choose the Element, then pick exactly which references the
  node outputs). A fresh pick starts with nothing selected and confirm
  disabled until at least one reference is chosen; re-opening a configured
  node shows its current selection. The node emits the chosen references in
  Element order, and the same Element can appear twice in one Flow with
  different subsets (the multi-outfit case).
- The node body behaves like the Asset node: the cover renders at its
  natural aspect ratio and is drag surface, not a button. Switching or
  re-configuring the Element happens through the node context menu's
  *Switch element* command (placement revised 2026-07-19 with the retirement
  of the floating node toolbar), which reopens the same two-step modal.
- A custom-selected reference later removed from the Element becomes a
  `stale_element_selection` run issue with a visible warning on the node fixed through the same modal
  — never a silent drop. Like `unresolved_element_reference`, it only
  invalidates runs whose executable nodes consume the node; drafts always
  save.
- Candidate resolution reuses the existing generation input-selection model:
  the node's emitted references are the candidates, and the consuming slot
  applies the selected model's item limit with the existing auto/manual
  selection UX.
- Run admission resolves the node's emitted references to exact ordered Asset
  IDs and locks them into the immutable snapshot as static Asset inputs.
  Later Element edits never rewrite an admitted run. Trigger and provider
  layers are untouched.

## Capture loops

- **From generation outputs:** image-output generation nodes and image Asset
  nodes expose an *Add to Element* preview hover action (the LTX "Save as
  Element" pattern) opening the shared Add to Element dialog: search existing Elements
  (with visible n/8 capacity), or create a new one inline. Adds go through
  the atomic `PATCH /elements/:id/references`; success confirms with the
  server-reported counts, and Undo removes only the Assets that call added.
- **From the Assets page:** *Add to Element* lives in the asset action menu
  (selection-aware, so multi-select adds all live image Assets at once), and
  the Asset viewer shows Element-membership badges via
  `GET /elements?assetId=`.

## Picker feedback contract

The Element reference picker follows the add-to-album pattern: a pending
selection that only reaches the Element on explicit commit, check badges on
selected cards, a sticky "n of 8 selected" footer with the commit button,
dimmed cards with a localized reason once the cap is reached, and files
uploaded from inside the dialog auto-join the pending selection when they
register — correlated by upload batch ID, so uploads started anywhere else
in the app never sneak in. Every Element mutation confirms with a toast that
states resulting counts.

## Dashboard

- `/elements` is the third navigation entry: card grid (cover, name, kind
  chip, reference count), kind filter tabs, search. Every list surface
  (library, node picker, Add to Element) is cursor-paged with a load-more
  affordance, so Elements beyond the first page stay reachable.
- Create and edit share one dialog: name, kind, optional description, and the
  ordered reference strip backed by the canonical Asset picker (images only).
  First image is the cover; order is payload order.
- The canvas node shows the cover stack, reference count, and kind chip, and
  opens a compact Element picker.

## Deferred on purpose

- `@mention` of Elements inside prompts (the LTX/Kling pattern); the
  `description` field is its seam.
- Audio/video reference bundles — only when a consuming model contract
  actually accepts them.
- LoRA-style training, consistency assistants, readiness scoring, and
  per-role reference kits — only with real usage evidence.
