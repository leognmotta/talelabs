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

Generation types can start narrow:

```txt
image generation
image-to-video
video generation
product shot
character scene
```

Model choice should not be the main UX. The app can expose advanced settings later, but the default experience should guide users toward outcomes instead of forcing them to understand every provider/model.

## Apps

Apps are not part of the first minimal navigation, but the concept matters.

Apps are generation presets.

An app is a guided, opinionated preset around a common creative outcome. It should feel like a productized template, not like a separate product or marketplace.

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
Apps = guided generation presets
Workflows = repeatable connected creative processes, later
Boards = visual creative context, later
Studio = simple cut/editor surface, later
```

Apps can eventually open a prefilled Generate session, a starter board, or a workflow. For MVP planning, treat Apps as a future layer over Generate.

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

An asset can belong to a project and also live in a folder. Projects should also work as filters inside Assets, so a user can browse:

```txt
All assets
Assets in a folder
Assets for a project
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
```

Brands, Products, and Characters should remain reusable global memory objects, but they can also be associated with projects. A product can belong to a brand, a character can be used with a product, and all of them can be connected inside a project.

Do not model projects as a rigid parent that owns everything exclusively. Model projects as a workspace relationship layer that can group reusable objects without preventing reuse elsewhere.

## Brands

Brands are reusable AI context.

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

For MVP, keep it simple:

```txt
name
description
tone
visual style
logo/reference images
do/don't rules
```

Brands exist so users do not have to repeat the same brand instructions in every prompt.

## Products

Products are reusable product context.

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
approved assets
```

Characters should be usable inside Generate so users can create product scenes, ads, expression sheets, and recurring visual identities.

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
