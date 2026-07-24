# Projects and Asset Organization

**Research date:** 2026-07-23
**Status:** Research proposal only. This document does not approve scope or
change the binding MVP contract.

## Executive Recommendation

TaleLabs should add **Project** as an optional, organization-scoped home for
creative work:

```txt
Workspace
|-- Private
`-- Projects
    `-- Project
        |-- Brief
        |-- Assets
        |   `-- Folders
        |-- Create sessions
        |-- Flows
        `-- Elements
```

The product distinction should remain simple:

- **Project** answers: "Which production, campaign, client, or creative effort
  does this belong to?"
- **Folder** answers: "Where is this file located inside that Project?"
- **Create session** answers: "Which direct-generation exploration produced
  these related attempts?"
- **Flow** answers: "Which reusable spatial process produced or transformed
  this work?"
- **Element** answers: "Which reusable references should remain easy to find?"
- **Asset** is the canonical image, video, audio, or document.

A Project should be able to contain every durable user-facing creative entity,
including future entities such as Storyboards, Tools, or published Recipes.
That does **not** require a generic polymorphic `projectItems` table. Each
supported entity should carry one nullable, tenant-scoped `projectId`. This is
more explicit, preserves foreign keys, keeps queries readable, and makes future
entities opt into Project ownership deliberately.

The first release should use one optional Project home per entity:

```txt
projectId = null      -> Private
projectId = <id>      -> one Project
```

Projects should initially organize content, not introduce a second permissions
system. Project-level access and collaboration can be added later without
making the first organization layer depend on it.

## Why This Matters

Generative workflows produce far more candidates than traditional creation
tools. The user problem is not only storing the successful file. Users also
need to recover:

- the campaign or production it belongs to;
- the shot, scene, task, or folder it belongs to;
- the session or Flow that produced it;
- the prompt, inputs, model, and run provenance;
- the variants they preferred;
- the reusable references created from approved work.

Without those dimensions, one global Asset gallery becomes a chronological
pile. Physical folders alone are also insufficient because a file has one
location but can have many useful attributes, sources, and usages.

Community reports around ComfyUI describe output folders becoming
"disorganized messes," users losing the relationship among prompts, inputs,
workflows, and outputs, and requests for an explicit Project concept. These are
qualitative signals rather than market-size evidence, but they match the
organization problem TaleLabs will create as generation volume grows:

- [How do I keep my outputs organized?](https://www.reddit.com/r/comfyui/comments/1n0l4ad/)
- [Organize your generations like a real film production](https://www.reddit.com/r/comfyui/comments/1sdhj83/organize_your_generations_like_a_real_film/)
- [For those sitting on thousands of ComfyUI outputs](https://www.reddit.com/r/comfyui/comments/1uis4lz/for_those_sitting_on_thousands_of_comfyui_outputs/)

## Research Findings

### Runway: Project as the cross-entity container

Runway's current Project model is the closest match to the requested TaleLabs
direction.

Runway describes a Project as a shared space containing **sessions, workflows,
and assets**. Content created outside a Project remains Private, while existing
content can be moved into a Project or made Private again. The Project name is
also exposed as a breadcrumb inside a session or workflow, including an inline
Create Project action.

Sources:

- [Introduction to Projects](https://help.runwayml.com/hc/en-us/articles/52474899121555-Introduction-to-Projects)
- [Adding and Removing Project Content](https://help.runwayml.com/hc/en-us/articles/52913007036819-Adding-and-Removing-Project-Content)
- [Generating with Sessions](https://help.runwayml.com/hc/en-us/articles/33545310653203-Generating-with-Sessions)

Important lessons for TaleLabs:

1. Project is an additional organization layer, not a replacement for sessions,
   workflows, or assets.
2. Private is a valid home, so Project assignment should be optional.
3. Project assignment should be visible and editable from the creative surface,
   not only from a settings page.
4. A session remains useful even when a Project exists because it groups
   iterations of one shot, style, or scene.
5. Deleting a session should not delete its generated Assets.

Runway also supports Asset folders, drag-and-drop organization, multi-selection,
and tags. Its tag guidance explicitly recommends quality and workflow labels
such as `Best`, `Needs work`, `Needs review`, and `Approved`.

Sources:

- [How to organize assets](https://help.runwayml.com/hc/en-us/articles/23998498329107-How-to-organize-assets)
- [Filtering assets with Tags](https://help.runwayml.com/hc/en-us/articles/37508953406355-Filtering-assets-with-Tags)
- [Batch downloading exports and assets](https://help.runwayml.com/hc/en-us/articles/18406706187283-Batch-downloading-exports-assets)

### Higgsfield: Project as the production home

Higgsfield Cinema Studio presents a Project root with distinct tools for:

- all Project Assets;
- the Project brief;
- reusable Elements;
- generation tools;
- folders for production units such as shots.

Its training material explicitly recommends creating a Project, then a folder
such as `shot-01-night-street`, then generating into that context. It describes
setup as producing "a project, useful folders, and one naming contract" so every
candidate has an address. Approved work can then become a reusable Element.

Sources:

- [Project tools and sidebar](https://higgsfield.ai/academy/courses/cinema-studio-complete-tour/project-tools-and-sidebar)
- [Your first folder and generation](https://higgsfield.ai/academy/courses/cinema-studio-complete-tour/try-it-yourself)
- [The pipeline, end to end](https://higgsfield.ai/academy/courses/cinema-studio-pro/the-pipeline)
- [Making and using an Element](https://higgsfield.ai/academy/courses/cinema-studio-complete-tour/elements)

Important lessons for TaleLabs:

1. A Project can provide a strong local home without removing the global
   library.
2. Folders remain valuable inside a Project, especially for scene, shot, take,
   campaign, or deliverable organization.
3. Elements belong naturally in Project navigation while still being reusable
   records rather than files duplicated into folders.
4. A Project brief is useful context, but silently injecting it into every
   generation would be a separate product decision.
5. Production naming and folders help, but TaleLabs should not force users
   through setup before their first generation.

### FLORA: Destination must work outside the UI

FLORA exposes Projects, Assets, and workflows through its canvas, API, CLI, and
MCP. Its examples include generated Assets landing in a Project or a named
folder. This matters for TaleLabs because future Tool, API, or MCP execution
will need the same output-destination contract as the dashboard.

Source:

- [FLORA MCP, API, and CLI](https://flora.ai/blog/introducing-the-flora-mcp-api-cli)

The destination must therefore be part of the admitted execution contract, not
only browser state.

### Frame.io: physical location and saved views are different

Frame.io uses folders for physical organization and Collections for dynamic,
metadata-backed views. A Collection can show five-star or approved media from
several folders without moving or duplicating those Assets.

Frame.io also supports version stacks so revisions do not occupy the Project as
unrelated files.

Sources:

- [Collections overview](https://help.frame.io/en/articles/9101042-collections-overview)
- [Version stacking](https://help.frame.io/en/articles/9101068-version-stacking)

Important lesson for TaleLabs:

```txt
Folders are location.
Filters and future Collections are views.
Versions and lineage are relationships.
```

Trying to make folders solve all three problems creates duplicate files and
confusing moves.

### DaVinci Resolve: folders plus metadata scales better

DaVinci Resolve uses Bins as physical folders, Smart Bins as continuously
updated metadata queries, and Power Bins for reusable resources visible across
Projects. Its metadata includes production concepts such as scene, shot, take,
people, and keywords.

Source:

- [DaVinci Resolve Media](https://www.blackmagicdesign.com/products/davinciresolve/media)

This supports a phased TaleLabs design:

1. Project-scoped folders now.
2. Strong search, tags, provenance, and filters now.
3. Saved views or Smart Collections only after users demonstrate repeated
   filter workflows.

### Adobe Creative Cloud: Projects do not replace libraries

Adobe separates Projects, folders, Libraries, and Brands. Projects group work
for an effort or team, folders provide hierarchy, and Libraries hold reusable
creative resources.

Sources:

- [Creative Cloud Projects overview](https://helpx.adobe.com/creative-cloud/apps/manage-projects/projects-overview.html)
- [Organize and manage Creative Cloud Assets](https://helpx.adobe.com/au/creative-cloud/apps/create-and-manage-libraries/organize-manage-creative-cloud-assets.html)

The TaleLabs equivalent is:

```txt
Project  -> production or campaign scope
Folder   -> Asset location
Element  -> reusable reference collection
```

## Product Principles

### Project is universal but optional

Any durable user-facing creative entity should be assignable to one Project:

```txt
Asset
Folder
Create session
Flow
Element
future Storyboard
future Tool
future Recipe or other durable creative document
```

An entity without a Project remains in Private. A user must be able to:

- create directly inside a Project;
- move existing content into a Project;
- switch Projects;
- return content to Private;
- create a Project inline while moving content.

### Project does not replace entity identity

Moving a Flow into a Project does not turn it into a Project document. Moving a
Create session does not turn it into a Flow. Moving an Element does not copy its
reference Assets.

Each entity keeps its own:

- ID and route;
- lifecycle;
- list and detail experience;
- provenance;
- permissions enforced by the organization;
- Project assignment.

### Project assignment is location, not provenance

TaleLabs must preserve three separate dimensions:

| Dimension  | Question                   | Example                    |
| ---------- | -------------------------- | -------------------------- |
| Location   | Where is it organized now? | Project A / SH03           |
| Provenance | What produced it?          | Create session 17 / Run 42 |
| Usage      | Where is it referenced?    | Flow X and Element Maya    |

Moving an Asset changes its location. It must not rewrite its generation job,
prompt, model, inputs, or usage relationships.

### One Project home in the first release

An entity should belong to zero or one Project. A many-to-many Project
membership model would introduce unclear ownership:

- Which Project controls the output destination?
- Which Project's archive hides it?
- Which Project's permissions apply later?
- Which Project receives usage and spend attribution?

Cross-Project reuse does not require many-to-many membership. A Flow can
reference an organization-visible Asset whose home is Private or another
Project. The reference does not move or duplicate the Asset.

If Project permissions ship later, cross-Project references must be revalidated
against access. That future requirement should not force a generic membership
table now.

### Do not use a polymorphic `projectItems` table

A generic table such as:

```txt
projectItems(projectId, itemType, itemId)
```

looks extensible but loses ordinary foreign keys to each entity, spreads
type-dispatch through queries and services, and makes tenant integrity harder to
prove.

Prefer direct nullable ownership:

```txt
flows.projectId
createSessions.projectId
elements.projectId
assets.projectId
folders.projectId
```

A future durable entity becomes Project-aware by adding the same explicit
field, API filter, and assignment behavior.

## Proposed Domain Model

### Project

Recommended first schema:

```ts
interface Project {
  id: string;
  organizationId: string;
  createdBy: string | null;
  name: string;
  description: string;
  coverAssetId: string | null;
  defaultAssetFolderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}
```

Field intent:

- `name` is the primary user-facing identity.
- `description` starts as an optional short brief, not hidden AI context.
- `coverAssetId` makes Project browsing visual without creating a second file.
- `defaultAssetFolderId` optionally selects the normal generation destination.
- `archivedAt` removes completed work from active lists without deleting its
  contents.

The full collaborative Project brief shown by Higgsfield can become a dedicated
document later. The first schema should not invent rich-text collaboration,
automatic prompt injection, or brief versioning.

### Project-owned entities

Add nullable `projectId` to:

```txt
flows
createSessions
elements
assets
folders
```

Add immutable `projectId` to `flowRuns` as the Project attribution captured at
admission. This allows historical run and cost reporting to remain stable if a
Flow or session moves later.

Generation jobs inherit Project attribution through their run. They do not
need another independently mutable Project field.

### Folder scope

Folders remain Asset-only hierarchy. Each folder belongs to Private or one
Project through `projectId`.

Required invariants:

1. Folder and Project share `organizationId`.
2. A child folder has the same `projectId` as its parent.
3. An Asset and its folder have the same `projectId`.
4. A Project default folder belongs to that Project.
5. A Project cover Asset belongs to the same organization and Project.
6. A Flow or session output folder belongs to the same Project as its source.
7. Cross-Project folder moves update the complete subtree and contained Assets
   in one transaction.
8. Existing depth, cycle, and tenant checks remain mandatory.

The current TaleLabs folder contract allows at most 500 folders per
organization and 32 levels of depth. Introducing Projects may make the
organization-wide 500-folder cap too small sooner. Do not raise it blindly:
first change folder reads to Project-scoped or paginated metadata, then raise
the bound from observed usage.

### Private is a pseudo-space

Do not create a fake Project row named Private. `projectId = null` should remain
the explicit meaning.

This avoids:

- consuming a Project identity for a system concept;
- confusing Project lists and permissions;
- requiring users to manage or rename Private;
- migrating every existing entity to an artificial Project.

Private may remain user-specific where an existing entity already has
creator-private semantics. Project assignment should not silently change
authorization until Project collaboration is explicitly implemented.

## Generated Asset Destination

### Required rule

Every admitted generation must have a deterministic destination:

```txt
source Project + output folder
```

The immutable request or run snapshot should capture:

```ts
interface AssetDestination {
  projectId: string | null;
  folderId: string | null;
}
```

The finalizer must use the captured destination. It must not read the current
Flow, session, or Project after provider work completes.

### Recommended resolution order

```txt
1. Explicit destination selected for the request
2. Flow or Create session output folder
3. Project default Asset folder
4. Project root when the source belongs to a Project
5. Existing managed Private output folder
```

This order supports dashboard, API, MCP, and future Tool execution through one
contract.

### Create session parity

Flows already own an `assetFolderId` and generated outputs are organized under
a managed Flow folder. Create sessions should receive equivalent output
organization without becoming graphs:

```txt
Create session
|-- projectId
`-- assetFolderId
```

The session remains a history grouping. Its output folder is only the default
location for generated media.

### Moving work between Projects

Recommended behavior:

- Moving a Flow or session changes its Project and default destination for
  future runs.
- Its managed output folder may move with it when that folder is exclusively
  owned by the source.
- Assets the user previously moved elsewhere stay where the user placed them.
- Referenced input Assets never move automatically.
- Historical run attribution never changes.
- The UI must summarize what will move before a cross-Project managed-folder
  move, because this may affect many Assets.

This avoids both bad extremes:

- silently moving every historical and referenced file;
- moving only the Flow while leaving its managed output location inconsistent.

### Deletion and archive

- Deleting a Create session must not delete Assets.
- Deleting a Flow must not delete Assets.
- Deleting an Element must not delete Assets.
- Archiving a Project hides the Project from active lists but preserves all
  content.
- Hard Project deletion should be deferred. If later supported, it should move
  content to Private or require an explicit destructive content policy. It
  must never cascade-delete canonical Assets by default.

## Proposed Project Experience

### Global navigation

Research supports adding Projects as a first-class navigation destination once
approved. It should not replace Create, Flows, Assets, or Elements.

```txt
Create
Projects
Flows
Assets
Elements
```

The exact order remains a user-owned product decision.

### Projects screen

The Projects screen should prioritize repeated work, not a marketing hero:

- New Project action;
- search;
- Recent and All views;
- compact grid or list;
- optional cover;
- name;
- updated time;
- lightweight counts;
- archived filter.

Do not load complete Asset previews or separate entity lists per Project. Use
bounded grouped counts and one representative cover.

### Project detail

Opening a Project changes the sidebar context. TaleLabs should replace the
normal global sidebar with one Project sidebar rather than render a second
sidebar beside it. This keeps the Project identity, its creative surfaces, and
its Asset folders visible throughout local navigation.

The back action at the top of the Project sidebar is a deterministic route
transition one level up:

```txt
/projects/:projectId/* -> /projects
```

It must not depend on browser history. Leaving the Project route restores the
normal global sidebar immediately. Opening a Project again restores the
Project-scoped sidebar.

Recommended desktop structure:

```txt
< Back

[cover] Project name                 ...

All assets                           2,781
Create sessions                        12
Flows                                   8
Elements                                5
Project brief

Folders                         +  Search  Sort
  Project Brief                        1
  SH01                                40
  SH02                                64
  Audio                               18
  Finals                               6
```

The project header owns Project-level actions such as rename, archive, cover,
and settings. Creative destinations below it navigate within the current
Project:

```txt
/projects/:projectId/assets
/projects/:projectId/sessions
/projects/:projectId/flows
/projects/:projectId/elements
/projects/:projectId/brief
```

Do not use a singular `Canvas` destination in TaleLabs because one Project can
contain multiple Flows. The sidebar should expose `Flows`, and selecting a Flow
opens its existing canvas.

The `All assets` destination and every folder destination reuse the existing
Asset Library with a fixed `projectId` scope. A folder selection adds the
existing folder filter; it must not create a second Project-specific Asset
manager.

The folder area should support:

- a Project-only nested folder tree;
- clear selected and expanded states;
- create-folder, search, and sort actions;
- drag targets for moving Assets and folders;
- per-folder Asset counts loaded without one request per folder;
- independent scrolling when the tree is taller than the viewport.

The sidebar should remain mounted while navigating among Project sections so
folder expansion, scroll position, and Project context do not reset on every
route change. It must not load every session, Flow, Element, or Asset into the
sidebar. Section counts use grouped queries, while each destination owns its
normal paginated list.

Project routes compose the existing feature surfaces:

```txt
All assets      -> existing Asset Library with Project filter
Create sessions -> existing Create session list with Project filter
Flows           -> existing Flow list with Project filter
Elements        -> existing Element list with Project filter
```

On smaller screens, the Project sidebar becomes a drawer opened from the
Project header. The same back action, destinations, folder tree, routes, and
data ownership remain unchanged.

### Context inside Create and Flows

Create sessions and Flows should show a compact location control:

```txt
Private / Session name
Project name / Flow name
Project name / SH03
```

The control should support:

- Move to Project;
- Switch Project;
- Make Private;
- Create Project inline;
- choose an output folder.

Project selection should not dominate the generation form. The current
destination remains visible, while the default path lets users generate without
mandatory setup.

### Project creation

First release:

```txt
Name
Optional description
Optional cover later
```

Do not require:

- folder templates;
- Project type;
- Project brief;
- team selection;
- model defaults;
- naming conventions;
- generation settings.

Higgsfield demonstrates the value of production setup, but TaleLabs should
offer templates later rather than block first use.

## Asset Management Enhancements

### Preserve one canonical Asset

Never duplicate a file merely because it is:

- referenced by another Project;
- used by a Flow;
- attached to an Element;
- shown in a saved filter;
- part of a Create session;
- selected as a Project cover.

Those are relationships or views over one canonical Asset.

### Project-scoped Asset Library

The existing TaleLabs Asset Library should support a `projectId` scope in
addition to its existing folder, media, source, search, tag, favorite, archive,
sort, grid, and list controls.

Global Assets remains the aggregate library. Add:

- Project filter;
- Private filter;
- source entity filter;
- generated-by Flow/session filter;
- date range when volume requires it.

The Project Assets route fixes `projectId` but reuses the same data and UI
primitives.

### Recommended physical folders

Folders should remain user-controlled and support:

- nested hierarchy;
- drag Asset onto folder;
- drag folder into folder;
- multi-select move;
- range selection;
- bulk tagging;
- bulk archive;
- bulk download;
- Project root drop target;
- folder counts and previews.

Useful production examples:

```txt
SH01
SH02
Locations
Characters
Audio
Music
Review
Finals
Exports
```

TaleLabs should not auto-create all of these. Templates can offer them later.

### Smart views instead of more folders

The following should be filters or future saved views:

```txt
Favorites
Created today
Generated by this Flow
Generated in this session
Needs review
Approved
Images only
Videos over 15 seconds
Unused Assets
```

Frame.io Collections and DaVinci Smart Bins show why these should not require
moving files.

Do not build saved Collections in the first Project milestone. First make the
filter vocabulary stable and observe which combinations users repeat.

### Provenance and "where used"

Asset detail should eventually show:

- generated by Create session or Flow;
- run and node;
- prompt and model provenance;
- Project and folder location;
- Elements containing the Asset;
- Flows referencing the Asset;
- derived outputs and source inputs.

The first Project phase only needs Project/folder location plus existing
generation provenance. "Where used" can follow after query cost and UX are
validated.

### Favorites and approval

TaleLabs already has user favorites and tags. Use those before adding a new
review-status system:

- favorite for personal selection;
- tags for shared vocabulary such as `approved` or `needs-review`;
- Project filters for finding them.

If teams later require one authoritative approval state with audit history,
add it as a dedicated review feature rather than overloading favorites.

### Versions

Frame.io demonstrates that versions are distinct from folders. TaleLabs should
not implement version stacks as part of Projects.

Keep lineage and generated variants now. Research version stacks only when
users repeatedly treat several Assets as revisions of one deliverable.

## Search and Retrieval

### Global search

Command search should eventually include:

- Projects;
- Create sessions;
- Flows;
- Elements;
- folders;
- Assets.

Every result should show its Project or Private location. Opening an Asset from
search should preserve the existing URL-controlled detail viewer behavior.

### Project search

Project-local search should search all Project entities but group results by
type:

```txt
Assets
Folders
Sessions
Flows
Elements
```

Do not issue one browser request per group. Use one bounded search endpoint or
parallel server queries behind one API contract.

### Scaling path

Initial PostgreSQL search is acceptable while tenant data is bounded. Before
raising Asset or folder limits substantially:

1. add indexed Project filters to every list query;
2. use cursor pagination for Projects, Assets, sessions, Flows, and Elements;
3. avoid per-Project N+1 counts and previews;
4. add trigram or full-text indexes for names and searchable metadata;
5. measure search latency and result volume;
6. adopt a dedicated search service only when PostgreSQL evidence justifies it.

Project assignment should improve query selectivity rather than requiring the
API to load all organization content and filter in memory.

## API Shape

Illustrative routes:

```txt
GET    /projects
POST   /projects
GET    /projects/:projectId
PATCH  /projects/:projectId
POST   /projects/:projectId/archive
POST   /projects/:projectId/restore

GET    /assets?projectId=...
GET    /folders?projectId=...
GET    /create-sessions?projectId=...
GET    /flows?projectId=...
GET    /elements?projectId=...
```

Project assignment should remain on typed entity routes:

```txt
PATCH /assets/:id          { projectId, folderId }
PATCH /folders/:id         { projectId, parentId }
PATCH /create-sessions/:id { projectId, assetFolderId }
PATCH /flows/:id           { projectId, assetFolderId }
PATCH /elements/:id        { projectId }
```

Bulk operations may use typed discriminated inputs, but the server should
dispatch to entity-owned services rather than maintain a polymorphic table.

### Shared domain behavior

Reuse narrow shared helpers for:

- loading a tenant-owned Project;
- validating an optional Project assignment;
- validating a Project-scoped folder destination;
- capturing `AssetDestination`;
- invalidating Project counts and search results.

Do not create one generic "move anything" service that knows every table and
lifecycle. Each entity service remains responsible for its own move semantics.

## Database and Concurrency Requirements

Every Project relationship must include `organizationId` in its foreign key or
tenant validation.

Required behavior:

1. Project assignment and output-folder assignment change atomically.
2. Generation admission locks and captures the exact destination.
3. Asset finalization uses only the captured destination.
4. Folder subtree moves serialize with existing folder structural changes.
5. Cross-Project folder moves update descendants and contained Assets in
   bounded SQL operations.
6. Project archive cannot race with new assignment or run admission.
7. Counts derive from indexed grouped queries, not mutable counters in
   application memory.
8. No in-memory cache is authoritative in a multi-instance deployment.

Suggested indexes:

```txt
projects(organizationId, archivedAt, updatedAt, id)
assets(organizationId, projectId, folderId, createdAt, id)
folders(organizationId, projectId, parentId, name)
flows(organizationId, projectId, updatedAt, id)
createSessions(organizationId, createdBy, projectId, updatedAt, id)
elements(organizationId, projectId, updatedAt, id)
flowRuns(organizationId, projectId, createdAt, id)
```

Exact index order should follow the final list filters and cursor sort.

## Security and Visibility

Project assignment and Asset visibility are separate:

- Project controls organization and future collaboration scope.
- Asset `visibility` controls delivery/storage policy.

A public generated Asset inside a Project is not automatically featured or
discoverable in a public gallery. A private Asset in a Project is not public
merely because Project members can see it.

First Project phase:

- tenant boundary remains `organizationId`;
- current entity ownership and access rules remain in force;
- Project is not an authorization shortcut;
- Project IDs from the client are always loaded under the active organization;
- folder and source IDs are validated under the same organization and Project.

Future collaboration phase:

- `projectMembers`;
- Project roles;
- invite/remove;
- access-aware search;
- cross-Project reference validation;
- Project-level spend and activity.

Do not partially ship Project permissions. A Project must either be purely
organizational or consistently enforced as an access boundary.

## Migration Strategy

The current TaleLabs schema has no Project entity. Folders and Assets are
organization-scoped; Flows own managed Asset folders; Create sessions have no
output folder; Elements are organization-scoped.

Recommended forward migration:

1. Create `projects`.
2. Add nullable `projectId` to folders, Assets, Flows, Create sessions, and
   Elements.
3. Add nullable immutable Project attribution to runs.
4. Add `assetFolderId` to Create sessions.
5. Backfill all existing rows with `projectId = null`.
6. Preserve existing Flow managed folders and Asset locations.
7. Add Project-aware uniqueness, indexes, and tenant foreign keys.
8. Add invariants and verification scripts before exposing cross-Project moves.

Do not infer Projects from existing top-level folder names. That would convert
user organization into a new product boundary without consent.

## Delivery Phases

### Phase 1: Project home

Goal: establish the organization layer without redesigning creative entities.

- Project CRUD, archive, restore, list, search.
- Optional `projectId` on Assets, folders, Create sessions, Flows, and Elements.
- Private as the null Project.
- Move to Project, Switch Project, Make Private.
- Project detail with Assets, sessions, Flows, and Elements.
- Contextual Project sidebar that replaces global navigation until Back returns
  to `/projects`.
- Reuse existing list and Asset Library components.
- Capture Project attribution on new runs and generated Assets.
- Create session output-folder parity with Flows.

### Phase 2: destination and retrieval polish

- Output-folder selector in Create and Flow surfaces.
- Project default Asset folder.
- Project-aware global search.
- Project/source filters in global Assets.
- Bulk Project and folder moves.
- Generated-by session/Flow filters.
- Project cover and grouped counts.

### Phase 3: production organization

Only after usage evidence:

- richer Project brief;
- folder templates for film, advertising, or social campaigns;
- saved views or Smart Collections;
- approval workflow;
- version stacks;
- Project activity and spend;
- Project members and access control;
- Project destination support in public API, MCP, Tools, and Recipes.

## Non-Goals for the First Project Milestone

- Project-level billing or credit wallets.
- Project-level permissions.
- Generic polymorphic Project item storage.
- Many-to-many Project membership.
- Nested Projects.
- Automatic Project creation for every session or Flow.
- Mandatory folder selection before generation.
- Automatic brief injection into prompts.
- Smart Collections.
- Approval workflows.
- Version stacks.
- Automatic deletion of Assets with their source entity or Project.
- Copying Assets merely to reuse them in another Project.

## Acceptance Criteria for an Approved Implementation

### Product behavior

- A user can create a Project and open its Assets, sessions, Flows, and
  Elements.
- Opening a Project replaces the global sidebar with the contextual Project
  sidebar; Back returns one route level to `/projects` and restores global
  navigation.
- Project section and folder navigation preserve Project context without
  loading complete entity collections into the sidebar.
- A user can create each entity inside a Project.
- A user can move existing content to another Project or Private.
- A Project-scoped generation produces an Asset in the captured Project and
  folder.
- A refresh preserves Project location and generated outputs.
- Deleting a session, Flow, or Element does not delete canonical Assets.
- Global Assets can filter by Project and still show Private.
- Existing content remains Private after migration.

### Data integrity

- Cross-tenant Project assignment is impossible.
- Cross-Project parent folders are impossible.
- Asset/folder Project mismatch is impossible.
- Flow/session output-folder Project mismatch is impossible.
- Run attribution remains unchanged after moving the source.
- Provider completion cannot redirect an output by reading mutable current
  state.
- Folder subtree moves are cycle-safe, depth-safe, bounded, and atomic.

### Performance

- Project lists use cursor pagination.
- Project detail does not issue one request per entity or folder.
- Counts and covers avoid N+1 queries.
- Project Asset views reuse indexed server filters.
- Large Asset libraries remain paginated and media previews remain lazy.
- Search does not load complete Project contents into the browser.

### Maintainability

- One Project domain owns Project CRUD and assignment validation.
- Entity-owned services keep their move semantics.
- The existing Asset Library is composed with a Project filter rather than
  copied.
- Project assignment is not duplicated in separate browser-only and
  managed-execution paths.
- TSDoc explains Project ownership, destination capture, and move invariants.

## Open Product Decisions

The research recommendation is strong on the following defaults:

1. **One optional Project per entity:** yes.
2. **Private remains available:** yes.
3. **Folders are Asset-only:** yes.
4. **Project contains Assets, sessions, Flows, Elements, and future durable
   creative entities:** yes.
5. **Project is not an access boundary initially:** yes.
6. **Cross-Project Asset reference without copying:** yes while the organization
   can access both.
7. **Generated Asset destination captured at admission:** yes.

Decisions still requiring explicit approval:

1. Should moving a Flow/session move its managed output folder and historical
   generated Assets automatically, or ask the user?
2. Should new Project generations default to Project root or a system-created
   `Generations` folder?
3. Should a Create session always have a visible managed folder, or should
   session provenance act as the default virtual grouping?
4. Should Project description remain plain text initially, or ship as a richer
   brief?
5. Where should Projects sit in global navigation?
6. Should Elements be organization-reusable across Projects by default, while
   retaining one Project home?

## Final Assessment

Project is not a replacement for TaleLabs' current entities. It is the missing
organization layer across them.

The strongest initial design is:

```txt
one optional Project home
+ Project-scoped Asset folders
+ immutable source provenance
+ global reusable Assets
+ shared filters and search
+ deterministic output destination
```

This design directly addresses the output-overload problem without forcing a
new workflow, duplicating files, or turning Project into an abstract generic
container that is hard to enforce.
