# TaleLabs Product Vision

This document is the source of truth for what TaleLabs is trying to become and what the first MVP should prove. Read it before planning product work, writing UI, creating database models, or integrating AI providers.

## What TaleLabs Wants To Be

TaleLabs is an AI creative workspace for generating, organizing, and reusing branded media assets.

The product should not be positioned as a generic AI model hub. Models are execution engines. TaleLabs should become the system where a creator, marketer, founder, or small team can define reusable context, generate assets from that context, and keep the outputs organized for future work.

The core idea is:

```txt
Reusable context -> better AI generation -> organized assets -> repeatable creative output
```

TaleLabs should eventually support many creative formats:

```txt
images
videos
audio
characters
product ads
storyboards
short-form content
brand assets
campaign assets
```

The near-term focus is not to replace professional tools like Premiere, DaVinci, After Effects, Runway, Luma, or WaveSpeed. The near-term goal is to create a focused product where reusable brand, product, and character context makes generation more useful than raw prompting.

## MVP Vision

The MVP should prove a billable creative loop:

```txt
Brands + Products + Characters
-> Generate
-> Assets
-> Projects
```

The first version should let a user:

1. Define reusable brand context.
2. Define reusable product context.
3. Define reusable character context.
4. Generate image/video/audio assets using that context.
5. Store every output as an asset.
6. Organize assets into projects.
7. Charge credits for generation jobs.

Credits and billing are required infrastructure, but they should not be part of the main creative sidebar. Credits should live in the header/account/billing area.

## MVP Navigation

The minimal product navigation is:

```txt
Generate
Assets
Projects
Brands
Products
Characters
```

Do not add `Boards`, `Studio`, `Agent`, `Workflows`, `Apps`, API, MCP, or public gallery to the first billable loop unless explicitly requested. Those concepts are important, but they are expansion layers after the core loop works.

## Generate

`Generate` is the page formerly called `Create`.

This is the main production surface for custom generation. It should be the fastest path to produce a media asset.

Generate should support:

```txt
prompt
reference uploads
brand selection
product selection
character selection
generation type
credit estimate
async job status
saved output asset
```

Generate should be organized around three core media sections:

```txt
Image
Video
Audio
```

These are the primary tabs/surfaces. More specific features should be accessed from those sections through presets, modes, or Apps.

Examples:

```txt
Image
- text to image
- image edit
- product shot
- background replace
- character scene still

Video
- text to video
- image to video
- first-frame/last-frame video
- product video
- character scene video
- video extend/upscale later

Audio
- text to speech
- voiceover
- music/sound later
- character voice later
```

This means `product shot` and `character scene` are not top-level Generate sections. They are presets or guided modes within Image/Video, and can later also appear as Apps.

Model choice should be available in Generate. Power users should be able to choose a model/provider when using the custom Generate surface.

However, model choice should not dominate the default UX. The interface should guide users toward outcomes first, then let them adjust model, quality, resolution, duration, seed, and other advanced settings when needed.

Apps can auto-select the model, hide model choice, or expose only a simplified quality setting. An app is allowed to lock or recommend a model because it is designed around a specific outcome.

## Apps

Apps are not part of the first minimal navigation yet, for now it is hidden, but the concept matters.

Apps are generation presets that change the Generate form.

An app is a guided, opinionated preset around a common creative outcome. Selecting an app should adapt the generation form to the exact workflow that app is designed for.

An app can define:

```txt
media section: Image | Video | Audio
steps
form fields
required references
default model
default aspect ratio
default duration/resolution
prompt structure
credit estimate rules
output type
post-generation actions
```

Example:

```txt
Apps / Scene Builder

Step 1: Frame your scene
- describe what you imagine
- add references
- suggest cinematic effects
- generate frame

Step 2: Animate your scene
- use generated frame
- choose motion/duration/aspect ratio
- generate video
```

The app changes the form. It is not just a button that runs the same generic prompt box.

Examples:

```txt
Product Hero Shot
Character Expression Sheet
Background Replace
Image to Cinematic Video
Product Ad Concepts
Storyboard Draft
UGC Product Scene
```

In the product model:

```txt
Generate = custom/free generation
Apps = guided generation presets that adapt the Generate form
Workflows = repeatable connected creative processes, later
Boards = visual creative context, later
Studio = simple cut/editor surface, later
```

Apps can open a prefilled Generate session with a custom form, a starter board, or a future workflow. For MVP planning, treat Apps as a guided layer over Generate.

## Assets

Assets are the permanent library of generated and uploaded media. Think of this section as the user's internal media drive for TaleLabs.

The Assets section should not be a flat gallery. It should support organization, search, filtering, and reuse. Users will generate many files over time, especially short videos and variants, so the asset library must stay usable as volume grows.

The intended asset-library mental model:

```txt
Assets = Drive-like media library
Folders = manual file organization inside the asset library
Tags = flexible labels across assets
Filters = fast ways to find media by type/status/context/project
```

Projects and folders are related but not the same.

A folder is a manual location in the asset library:

```txt
/Cuts
/Getting Started
/Product shots
/Exports
/Reference images
```

A project is a higher-level workspace/container:

```txt
Lamp Launch Campaign
Stride Runner Campaign
Client X Social Ads
```

An asset can be related to a project, brand, product, and/or character while also living in a folder. These relationships should work as filters inside Assets, so a user can browse:

```txt
All assets
Assets in a folder
Assets for a project
Assets for a brand
Assets for a product
Assets for a character
Assets by type
Assets by tag
Assets by source
```

The first Assets UI should feel closer to a lightweight media drive than a social gallery.

Core asset library concepts:

```txt
folders
assets
projects as filters
media type filters
tags
uploads
exports
favorites
search
grid/list view
sort order
asset detail panel
```

Initial filters should include:

```txt
All media
Image
Video
Audio
Text
Font
Uploads
Exports
Favorited
Tags
Project
```

Every generated output should become an asset with metadata:

```txt
type: image | video | audio | document
storage key
folder
prompt
model/provider
settings
references
brand context
product context
character context
credit cost
job status
project
brand
product
character
tags
source: upload | generation | export
favorite
creator
created date
```

Assets should support:

```txt
download
reuse as reference
assign to project
move to folder
tag
favorite
rename
duplicate/copy
delete/archive
inspect generation settings
copy prompt/settings
```

For MVP, Assets can start simple, but the data model should already allow:

```txt
asset folders
asset to project relation
asset to brand relation
asset to product relation
asset to character relation
asset tags
asset source
asset type
```

Do not model assets as only project children. Projects are important, but users should be able to use Assets as a global workspace library across all projects.

## Projects

Projects are the high-level workspace and organization layer.

Projects are not only for organizing assets. A project should be able to collect the major objects involved in a creative effort:

```txt
assets
boards
brands
workflows
products
characters
future cuts
future workflow runs
future exports
```

Think of a project as the campaign/client/production workspace that ties related creative context together.

A project can represent:

```txt
campaign
client
product launch
content series
storyboard
ad concept pack
```

Projects can contain:

```txt
assets
boards
brands
products
characters
future boards
future cuts/exports
```

For MVP, projects can be simple containers and filters. Do not overbuild project management.

Important product rule:

```txt
Assets should remain global.
Projects should organize and filter related work.
Folders should organize assets manually.
```

This means the product should support workflows like:

```txt
Generate an asset -> save to Assets -> attach to Project A -> move into /Product shots
Upload a reference -> save to Assets -> use in multiple projects
Export a cut -> save to Assets -> attach to campaign project
Create a board -> attach it to Project A
Create a brand -> use it globally or attach it to Project A
Create a product -> attach it to Project A
Create a character -> use it globally or attach it to Project A
Upload product images -> save to Assets -> relate them to Product A
Upload brand logos -> save to Assets -> relate them to Brand A
```

Brands, Products, and Characters should remain reusable global memory objects, but they can also be associated with projects. A product can belong to a brand, a character can be used with a product, and all of them can be connected inside a project.

Do not model projects as a rigid parent that owns everything exclusively. Model projects as a workspace relationship layer that can group reusable objects without preventing reuse elsewhere.

### Project View

A project detail view should be a contextual workspace.

Inside a project, users should be able to create any type of generation/output with the current project already selected as context.

Project view should support tabs such as:

```txt
Creation Spaces
Assets
```

Later, Creation Spaces can include:

```txt
Sessions
Boards
Workflows
Cuts
```

The `Assets` tab inside a project is not a separate asset system. It is the global Assets library filtered to that project.

That means:

```txt
/assets = all workspace assets
/projects/:projectId/assets = assets related to this project
```

From a project asset tab, users should be able to:

```txt
upload project assets
generate image for this project
generate video for this project
create audio/voiceover for this project
attach existing assets
filter project assets by type/tag/folder
open asset details
```

Any asset uploaded or generated inside a project should still be saved in the global Assets library, but it should automatically be related to that project.

Project empty states should be action-oriented. If a project has no creation spaces or assets yet, offer actions such as:

```txt
Generate image
Generate video
Upload asset
Create board/session
Create workflow later
```

## Brands

Brands are reusable AI context.

A brand is persistent identity/context, not a project replacement.

The boundary:

```txt
Brand = reusable identity, style, memory, and approved context
Project = temporary workspace/campaign/client job/production effort
```

For agencies, a common model can be:

```txt
Brand = client
Project = campaign or job for that client
```

A brand can collect related reusable objects:

```txt
products
characters
voices
assets
logo variants
reference images
approved videos
approved audio
projects
```

Products usually belong to a brand. Characters can belong to brands and projects, but can also be global/reused elsewhere. Assets can be related to a brand, product, character, project, folder, or all of them.

A brand profile should eventually include:

```txt
name
description
logo/images
colors
tone of voice
audience
visual style
do/don't rules
approved references
competitors
CTA examples
```

Brand Kit should support multiple logo assets. Real brands often have more than one logo format:

```txt
primary logo
horizontal logo
icon mark
wordmark
light version
dark version
monochrome version
transparent PNG
SVG source
social avatar
```

Do not model a brand as having only one logo. Store brand logos as assets with labels/types.

For MVP, keep it simple:

```txt
name
description
tone
visual style
logo assets
reference assets
do/don't rules
```

Brands exist so users do not have to repeat the same brand instructions in every prompt.

## Products

Products are reusable product context.

Products can have their own assets. Product images, reference videos, packaging shots, lifestyle shots, and generated outputs should still live in the global Assets library, but can be related to a product.

A product profile should eventually include:

```txt
name
description
landing page URL
features
benefits
audience
positioning
source images
product assets
approved references
```

Products are especially important for product ads because they let TaleLabs generate more consistent outputs around a real offer.

For MVP, products should be simple and useful:

```txt
title
description
images
benefits
features
brand
assets
```

## Characters

Characters are reusable character identity.

Use `Characters`, not `Avatars`. The word `avatar` is too narrow and implies talking-head UGC only. `Character` scales to:

```txt
spokesperson
AI influencer
brand mascot
fictional character
customer persona
product presenter
animated creature
story character
```

For MVP, a character should include:

```txt
name
role
description
personality/tone
visual notes
reference images
sample videos
sample audio/voice references
approved assets
```

Characters should be usable inside Generate so users can create product scenes, ads, expression sheets, and recurring visual identities.

Characters can be related to:

```txt
brands
projects
products
assets
voices later
```

Characters can have their own related assets, such as:

```txt
reference images
expression sheets
pose sheets
sample videos
sample audio
voice references
approved generated outputs
```

These files should still live in the global Assets library, but be related to the character for reuse in generation.

Do not model a character as owned exclusively by only one project. A character can be global, brand-specific, project-specific, or used across multiple projects.

Do not build full talking-avatar infrastructure in the MVP unless explicitly requested. Start with reusable context and references.

## Later Product Layers

These are important but not first-loop priorities:

```txt
Boards
Apps
Studio
Agent
Workflows
Voices
Public gallery
API
MCP
Team collaboration
Advanced editor
```

### Boards

Boards are future visual creative context. They are useful for storytelling, references, character sheets, shot planning, and creative exploration. They should not be required for simple generation.

### Studio

Studio is a future simple cut editor. It should help users sequence short AI clips, trim/split, add basic audio, and export simple social/commercial cuts. It should not try to replace Premiere or DaVinci.

### Agent

Agent is future LLM/research/chat support. Be careful: it can become a second product. For early versions, it should assist with prompts, scripts, hooks, and research around selected brand/product/character context.

### Workflows

Workflows are future manual creative execution graphs, closer to Runway's workflow canvas than Zapier/n8n automation.

The intended model:

```txt
inputs -> prompt/text/image nodes -> model/tool nodes -> output nodes -> run manually
```

Trigger-based automation, webhooks, schedules, API-triggered workflows, and MCP should come later.

## Product Principles

1. Make the first billable loop work before expanding surfaces.
2. Keep models behind outcome-driven UX by default.
3. Store prompt, context, model, settings, and cost for every generated asset.
4. Prefer reusable memory objects over one-off prompts.
5. Keep the main sidebar focused on creative/product objects.
6. Keep billing/credits in account/header UI.
7. Avoid building a generic AI tools marketplace too early.
8. Avoid building a full editor too early.
9. Use providers like OpenRouter for speed, but keep adapters flexible for direct integrations later.
10. Treat storage, jobs, and credits as core infrastructure from day one.

## Configuration Strategy

Do not put every product/model/app configuration in the database early.

TaleLabs should start with a simple split:

```txt
Static product config -> YAML or TypeScript config
Provider/model catalog -> provider APIs plus local overrides
User-created data -> database
```

### Static Config

Use YAML or code-level config for data that is controlled by the product team and does not need an admin UI yet:

```txt
apps
app steps
app form fields
default models
recommended models
model display names
model grouping
quality presets
aspect ratio presets
duration presets
pricing multipliers
credit formula inputs
feature flags
UI presets
```

Example app config:

```yaml
id: scene-builder
name: Scene Builder
section: video
steps:
  - id: frame
    title: Frame your scene
    fields:
      - type: textarea
        name: prompt
      - type: references
        max: 4
    defaultModel: google/gemini-3.1-flash-image
  - id: animate
    title: Animate your scene
    fields:
      - type: generated_frame
      - type: duration
      - type: aspect_ratio
    defaultModel: bytedance/seedance-2.0
```

Validate config with Zod or an equivalent schema at startup/build time. Bad config should fail loudly before users hit it.

### Provider Catalogs

Provider APIs should be used to fetch live model capabilities and pricing when available.

For OpenRouter, image/video model catalog data can include useful UI/runtime capabilities such as:

```txt
supported resolutions
supported aspect ratios
supported sizes
supported durations
supported frame images
whether audio generation is supported
whether seed is supported
allowed passthrough parameters
pricing SKUs
input reference min/max
quality/background/output compression options
```

This kind of provider metadata should affect what the UI allows. For example:

```txt
how many reference images can be uploaded
which durations are selectable
which aspect ratios are selectable
whether first-frame/last-frame controls are available
whether audio generation can be toggled
which advanced controls can be shown
```

However, provider metadata is not enough on its own. TaleLabs still needs local overrides for product decisions:

```txt
enabled/disabled models
recommended models
hidden models
fallback models
internal labels
UI grouping
which models power each app
margin tier
credit pricing behavior
quality presets
```

The intended model:

```txt
provider catalog
+ local model overrides
+ app preset config
= final UI/runtime generation config
```

### Database Data

Use the database for user-created or user-mutated data:

```txt
users
workspaces
brands
products
characters
projects
assets
folders
tags
jobs
credit ledger
credit reservations
app runs
generation history
saved user settings
```

Do not build an admin screen for model/app configuration until YAML/code config becomes painful. When config becomes too large, frequently edited, or needs non-developer editing, then move selected parts into a managed admin interface.
