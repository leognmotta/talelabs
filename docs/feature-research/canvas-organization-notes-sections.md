# Canvas Organization: Notes, Sections, and Groups

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-15

## Product Conclusion

Large creative Flows need documentation and visual structure, but TaleLabs must
not confuse canvas organization with execution semantics.

The recommended product model has three separate concepts:

```txt
Note     = documentation placed on the canvas
Section  = visual organization and explicit node membership
Subflow  = executable encapsulation with typed inputs and outputs
```

This research proposes only `Note` and `Section`. A future Subflow, Tool, or
Recipe remains a separate runtime feature and must be designed through the Flow
execution contract.

The colored areas in the referenced n8n workflow are primarily large Sticky
Notes placed behind nodes. They help readers understand stages, but they do not
create a parent-child execution boundary or turn the enclosed nodes into one
unit. Node-RED provides the stronger grouping behavior that TaleLabs should use
as the reference for Sections: explicit membership, move/copy together, labels,
colors, and ungrouping.

This feature should be considered after the core Asset-to-Flow generation loop
is stable. Adding this document does not add it to the MVP.

## User Problems

As Flows grow, users need to:

- explain what a region of the canvas is intended to do;
- record assumptions, setup instructions, decisions, and warnings;
- identify stages such as ideation, references, image generation, animation,
  audio, and delivery;
- move a related set of nodes without rebuilding the layout;
- understand a Flow created by another person;
- return to an old Flow without reverse-engineering it;
- prepare reusable or shared Flows that are understandable without external
  documentation;
- distinguish visual organization from what actually executes.

n8n's own template-publishing guidance treats Sticky Notes and descriptive node
names as part of a well-documented template. Community discussions also show a
recurring need for in-canvas explanations and a recurring frustration with
large background notes being selected or moved accidentally.

## Competitor and Framework Findings

### n8n: Sticky Notes as Documentation Regions

n8n's Sticky Note is a no-input, no-output canvas object with content, width,
height, and color. Its canvas renderer supports resizing and double-click
editing. The note is commonly enlarged and placed behind a set of nodes, which
creates the visual regions shown in the reference screenshot.

Important behavior:

- Markdown content;
- resizable width and height;
- selectable color;
- direct editing on the canvas;
- no ports and no execution behavior;
- visual overlap does not create group membership;
- nodes inside the rectangle are not automatically moved with the note.

The last point matters. An n8n-style background alone is useful for
documentation but does not fully solve node organization. Community requests
for locking Sticky Notes show that large selectable backgrounds can interfere
with node selection unless the interaction model is careful.

### Node-RED: True Visual Groups

Node-RED distinguishes Groups from Subflows. A Group can be created from a node
selection and then moved or copied as one object. It supports a label, border,
fill color, Markdown description, adding nodes by dragging them into the group,
removing nodes, merging groups, and ungrouping.

This is the best product reference for TaleLabs Sections because it improves
canvas management without pretending the group is a new executable node.

### React Flow: Parent-Child Presentation Primitives

React Flow supports parent-child relationships using `parentId`. Child
positions become relative to the parent, moving the parent moves its children,
and `extent: 'parent'` can constrain children to the parent bounds. Its built-in
`group` type is a convenience node without handles.

React Flow also documents important implementation constraints:

- parents must appear before children in the node array;
- child coordinates are relative to the parent;
- grouped-node edges have different default z-index behavior;
- attaching or detaching a node requires coordinate conversion;
- grouping is presentation behavior supplied by React Flow, not TaleLabs run
  semantics.

TaleLabs can use these primitives, but it must persist explicit membership and
must not infer membership from rectangle overlap during hydration.

### ComfyUI and Node-RED Subflows: Executable Encapsulation

ComfyUI Subgraphs and Node-RED Subflows package multiple nodes into one reusable
executable node with exposed inputs and outputs. This is fundamentally
different from a Note or Section.

TaleLabs must not make a Section executable, collapsible into a runtime node, or
publishable as a Tool without a separate design for versioning, typed ports,
snapshots, lineage, retries, and nested execution.

## Domain Boundaries and Terminology

Use these terms consistently:

### Note

A resizable text surface on the canvas.

```txt
has text and appearance
may visually overlap nodes or a Section
has no handles
has no runtime values
never executes
does not own nodes
```

### Section

A labeled visual container with explicit membership.

```txt
has a title, color, bounds, and member node IDs
moves its members as one visual operation
has no handles
never executes
does not alter graph reachability or run modes
```

Prefer the user-facing word `Section` over `Group`. `Group` is ambiguous across
creative tools and often implies either selection grouping or an executable
subgraph.

### Subflow, Tool, or Recipe

A separately designed executable abstraction with typed input/output contracts
and immutable versions. It is outside this feature.

## Recommended TaleLabs UX

### Notes

Users should be able to add a Note from the canvas toolbar or pane context menu.

Recommended interaction:

1. Add a Note at the current viewport or pointer position.
2. Enter edit mode immediately.
3. Double-click later to edit.
4. Press `Escape` or click outside to finish editing.
5. Resize from visible handles only while selected.
6. Choose from a small restrained palette.
7. Lock the Note to prevent accidental movement and selection.

Use a safe Markdown subset for headings, emphasis, lists, links, and inline
code. Do not allow raw HTML, scripts, iframes, embedded forms, or arbitrary
remote content. Render links safely and open external links with appropriate
`rel` attributes.

Do not mount a full rich-text editor for every visible Note. Render sanitized
content normally and mount one editor only for the active Note.

### Sections

Primary entry point:

```txt
select nodes -> context menu -> Create section
```

The Section should be created around the selected nodes with appropriate
padding. The user can rename, recolor, resize, lock, or ungroup it.

Recommended behavior:

- moving the Section moves every member node;
- moving a node into a Section shows a clear drop highlight;
- dropping commits explicit membership;
- moving a node out does not silently detach it during ordinary layout work;
- `Remove from section` is available from the node context menu;
- deleting a Section keeps its nodes and removes only the visual container;
- one node belongs to at most one Section in the first version;
- nested Sections are not supported initially;
- a Section can expand to include a newly added member but should not resize
  unpredictably during normal node movement;
- color is never the only indication of membership;
- locked Sections stay behind nodes and do not intercept ordinary lasso or node
  selection.

Visual overlap alone must never be the durable membership rule. Geometry can
suggest a drop target, but the saved relationship is explicit.

### Documentation Hierarchy

Use documentation at different levels for different jobs:

```txt
Flow description = purpose, expected inputs, and overall outcome
Section title     = stage or responsibility
Note              = local setup, reasoning, warning, or handoff details
Node name         = concise description of that operation
```

This avoids turning every node into a paragraph and avoids one giant canvas
Note that becomes difficult to maintain.

## Execution Contract

Notes and Sections are canvas presentation entities, not Flow nodes.

They must not:

- appear in the Flow node registry;
- count toward executable graph topology;
- have handles or runtime values;
- enter topological sorting;
- create run items or generation jobs;
- change `Run node`, `Run from here`, `Run till here`, `Run selection`, or
  `Run all` semantics;
- affect a generation job hash;
- become provider inputs;
- appear in immutable execution snapshots as executable nodes.

`Run selection` should ignore selected Notes and Sections. If a selection
contains a Section and executable nodes, only the explicitly selected
executable nodes participate. Selecting a Section must not implicitly change
the run command into "run every member."

Recipes, Flow exports, and visual previews should preserve Notes and Sections.
Run snapshots do not need them for execution. A future support-facing visual
snapshot may record presentation separately without changing the executable
artifact hash.

## Proposed Persistence Model

Do not store Notes or Sections as `flowNodes`. That would force every planner,
validator, snapshot reader, node picker, registry check, and run projection to
filter presentation objects forever.

A dedicated presentation model is safer:

```ts
type FlowCanvasItemType = 'note' | 'section'

type FlowCanvasItem = {
  id: string
  organizationId: string
  flowId: string
  type: FlowCanvasItemType
  positionX: number
  positionY: number
  width: number
  height: number
  locked: boolean
  data: NoteData | SectionData
  schemaVersion: number
  createdAt: string
  updatedAt: string
}

type NoteData = {
  content: string
  color: CanvasOrganizationColor
}

type SectionData = {
  title: string
  color: CanvasOrganizationColor
}

type FlowSectionMember = {
  organizationId: string
  flowId: string
  sectionId: string
  nodeId: string
  createdAt: string
}
```

Database invariants should include:

- composite tenant-scoped foreign keys;
- `flowCanvasItems.type` constrained to known values;
- positive bounded width and height;
- a unique `(flowId, nodeId)` Section membership for the non-nested first
  version;
- membership references a Section, never a Note;
- deleting a Section deletes memberships but not member nodes;
- bounded content and item counts enforced by API validation;
- no environment-variable configuration for limits, colors, or versions.

Keep node coordinates absolute in durable storage if possible. The dashboard
may project a Section into React Flow `parentId` and relative positions, but it
must convert coordinates deterministically on hydration, attachment,
detachment, and save. If that projection proves fragile, move members by an
explicit position delta instead of changing the current coordinate convention.

## API and Autosave Integration

The graph response can evolve to include a presentation layer:

```ts
type FlowCanvasDocument = {
  nodes: FlowNode[]
  edges: FlowEdge[]
  canvasItems: FlowCanvasItem[]
  sectionMembers: FlowSectionMember[]
  revision: number
}
```

The initial implementation should extend the existing revision-based batched
autosave instead of creating independent client-only persistence. Moving a
Section and its members must commit atomically so a refresh cannot leave the
container in one place and the nodes in another.

The save contract should support bounded upserts and deletes for:

```txt
canvas items
section memberships
member node positions
```

For the first version, sharing the Flow revision is simpler and preserves
atomic movement. The planner must continue deriving execution exclusively from
`flowNodes` and `flowEdges`. If collaborative editing later makes Note changes
conflict too often with graph edits, TaleLabs can introduce a separate
presentation revision then; it should not pay that complexity upfront.

## React Flow Implementation Guidance

Two approaches are viable:

### Option A: React Flow Parent-Child Projection

- render Sections before their member nodes;
- set member `parentId` to the Section ID;
- convert absolute stored positions to relative canvas positions;
- convert back to absolute positions before persistence;
- use `extent` only if TaleLabs wants to prohibit nodes from leaving bounds;
- explicitly control edge z-index.

This provides built-in move-together behavior but increases coordinate and
hydration complexity.

### Option B: Absolute Coordinates With Delta Movement

- render the Section as a background canvas item;
- keep every node position absolute;
- when a Section moves, apply the same delta to explicit members;
- save the Section and affected node positions in one batch.

This preserves TaleLabs' existing coordinate model and is the safer first
implementation. It requires custom movement logic but avoids parent ordering,
relative-coordinate conversion, and grouped-edge z-index surprises.

Recommendation: prototype Option B first. Use React Flow's parent-child model
only if product testing demonstrates that containment, nested positioning, or
automatic clipping is worth the additional state complexity.

## Performance and Scale

- Render static Markdown, not an editor, for inactive Notes.
- Memoize Notes and Sections like other canvas renderers.
- Keep palette values and limits in typed code configuration.
- Bound Note content, item count, and Section membership count.
- Persist movement as one bounded batch rather than one request per node.
- Avoid recomputing Section bounds on every pointer movement; update local
  transforms during drag and calculate final persisted positions on drag end.
- Do not infer every Section's membership from all-node geometry on every
  render.
- Include Notes and Sections in viewport culling and minimap policy.
- Search Note content only through a server-side, tenant-scoped query when that
  becomes a proven user need.

Suggested initial limits, to be reviewed before implementation:

```txt
Notes per Flow:              200
Sections per Flow:            50
Note content:             16,000 characters
Nodes per Section:           250
Section nesting depth:         0
```

## Security and Multi-Tenancy

- Every mutation must prove organization ownership through the Flow.
- Never trust client-supplied member IDs without tenant-scoped validation.
- Sanitize Markdown and disallow raw HTML.
- Restrict URL protocols to safe values such as `https`, `http`, and optionally
  `mailto`.
- Do not fetch remote images or embeds while rendering Notes.
- Apply the same permissions as editing the owning Flow.
- Do not include private Asset URLs, signed URLs, secrets, provider payloads, or
  credentials in Notes.
- Keep Note content out of logs and analytics payloads.

## Accessibility and Internationalization

- All controls, tooltips, dialogs, empty states, and validation errors use the
  shared i18n catalogs.
- Notes retain user-authored text as written; TaleLabs does not automatically
  translate user content.
- Section labels remain visible independent of color.
- Color choices meet contrast requirements in light and dark themes.
- Keyboard users can select, edit, resize through an inspector, lock, and
  delete canvas items.
- Screen-reader labels identify the item type, title, lock state, and available
  actions.

## Delivery Phases

### Phase 1: Notes

- add, edit, resize, recolor, lock, duplicate, and delete;
- safe Markdown rendering;
- autosave and refresh-safe hydration;
- no membership or execution behavior.

### Phase 2: Sections

- create from selection;
- explicit one-Section-per-node membership;
- move together;
- drag-to-add and explicit remove;
- rename, recolor, resize, lock, ungroup, and delete while keeping nodes;
- atomic autosave with member positions.

### Phase 3: Sharing and Reuse

- preserve presentation in Flow duplication and import/export;
- preserve presentation in future Recipes or Blueprints;
- optionally search Note text;
- collaboration-aware granular updates if real usage requires them.

### Separate Future Feature: Executable Subflows

Executable collapse, typed external ports, nested runs, reusable versions, and
Tool publication require their own research and source-of-truth contract. They
must not emerge accidentally from Sections.

## Evaluation Criteria

- A user can understand an unfamiliar Flow's stages within one minute.
- A user can document a local decision without leaving the canvas.
- Moving a Section never loses or changes node connections.
- Refresh restores Notes, Section bounds, membership, and member positions.
- Deleting or ungrouping a Section never deletes its nodes.
- Notes and Sections never alter planner output, job hashes, run snapshots, or
  run-mode selection.
- Large locked Sections do not interfere with node selection or lasso gestures.
- A 100-node Flow with Notes and Sections remains responsive while dragging and
  autosaving.

## Explicit Non-Goals

- No executable group or subflow in this feature.
- No hidden batch or iteration semantics.
- No automatic AI documentation in the first version.
- No freehand drawing, arrows, shapes, or full whiteboard product.
- No arbitrary HTML or media embeds inside Notes.
- No nested Sections initially.
- No inference of durable membership from visual overlap.
- No change to the current M6 provider integration scope.

## Sources

### Primary Product and Technical Sources

- [n8n Sticky Note node source](https://github.com/n8n-io/n8n/blob/master/packages/nodes-base/nodes/StickyNote/StickyNote.node.ts)
- [n8n Sticky Note canvas renderer](https://github.com/n8n-io/n8n/blob/master/packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/nodes/render-types/CanvasNodeStickyNote.vue)
- [n8n official workflow for Sticky Note and naming guidelines](https://n8n.io/workflows/13868-auto-generate-sticky-notes-and-rename-nodes/)
- [Node-RED Groups](https://nodered.org/docs/user-guide/editor/workspace/groups)
- [Node-RED documenting flows](https://nodered.org/docs/developing-flows/documenting-flows)
- [Node-RED Subflows](https://nodered.org/docs/user-guide/editor/workspace/subflows)
- [React Flow Sub Flows](https://reactflow.dev/learn/layouting/sub-flows)
- [React Flow Selection Grouping](https://reactflow.dev/examples/grouping/selection-grouping)
- [React Flow Labeled Group Node](https://reactflow.dev/ui/components/labeled-group-node)
- [ComfyUI Subgraphs](https://docs.comfy.org/interface/features/subgraph)

### Qualitative Community Signals

- [n8n users using Sticky Notes to explain groups of nodes](https://community.n8n.io/t/managing-many-workflows/70935/3)
- [n8n request to lock large Sticky Notes](https://community.n8n.io/t/feature-request-lock-unlock-sticky-notes-to-prevent-accidental-selection-and-movement/243559)
- [n8n request for links from documentation to canvas nodes](https://community.n8n.io/t/editor-ui-ability-to-highlight-focus-workflow-nodes-via-anchor-tags-in-sticky-notes/47972)
