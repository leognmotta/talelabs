---
name: tiptap-composer
description: Build or modify Tiptap-based AI prompt composers in React/TypeScript apps. Use when working with Tiptap as a structured composer for prompts, inline reference chips, asset/brand/product/character mentions, slash commands, suggestion popovers, custom nodes, React NodeViews, serialization to app-specific AI job payloads, or when evaluating whether to use Tiptap versus textarea for AI composer UX.
---

# Tiptap Composer

## Core Rule

Use Tiptap as a structured prompt composer, not as the AI workflow owner. Keep AI modes, skills, generation jobs, provider routing, credits, and billing in the application backend and product layer.

For TaleLabs-style work, prefer a narrow editor schema:

- `doc`
- `paragraph`
- `text`
- `hardBreak`
- custom inline atom `reference`

Do not add rich text marks, headings, lists, tables, collaboration, Content AI, or AI Toolkit unless the user explicitly asks for those features.

## Official Docs

Before implementing unfamiliar Tiptap APIs, read the relevant links in `references/official-docs.md`. Tiptap publishes `https://tiptap.dev/llms.txt`, a docs index, and Markdown versions of docs pages by appending `.md` to URLs.

## Implementation Pattern

Install only the composer packages needed for the current app:

```txt
@tiptap/react
@tiptap/starter-kit
@tiptap/suggestion
@tiptap/core
```

Add extension packages only when the implementation needs them. Avoid `@tiptap-pro/*` for a composer-only feature.

Model the composer value as application data:

```ts
type PromptComposerValue = {
  plainText: string
  editorJson: JSONContent
  references: PromptReference[]
  command?: PromptCommand
}

type PromptReference = {
  id: string
  type: 'asset' | 'character' | 'brand' | 'product'
  label: string
  thumbnailUrl?: string
}
```

The editor JSON is for restoring the composer. The backend generation request should use explicit structured fields, not scraped rendered text.

## Reference Node

Create a custom inline atom node for references. Use a React NodeView when the chip needs thumbnails, menus, status, or richer layout.

Recommended node properties:

```ts
{
  name: 'reference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
}
```

Recommended attributes:

```ts
{
  id: { default: null },
  type: { default: null },
  label: { default: null },
  thumbnailUrl: { default: null },
}
```

Render reference chips as compact inline UI. Preserve stable IDs in attrs. Keep display labels user-friendly but never depend on labels as identity.

## Suggestions

Use Tiptap Suggestion for:

- `@` reference search across Assets, Characters, Brands, and Products
- `/` command search for app-level AI modes or actions

Group results by entity type. Resolve selected references to full app entities before insertion. Insert `reference` nodes for entities and store commands separately unless the command itself must remain visible in the document.

Use the repo's UI primitives for popup rendering when possible. In shadcn-style repos, compose `Command`, `CommandGroup`, `CommandItem`, `Popover`, and existing button/input primitives rather than importing an unrelated UI kit.

## Serialization

When submitting:

1. Read `editor.getJSON()` for persistence.
2. Extract plain text with a deterministic serializer.
3. Walk the JSON tree to collect `reference` nodes.
4. Build the app's generation payload with IDs grouped by type.

Example payload shape:

```ts
{
  prompt: value.plainText,
  assetIds: references.filter(r => r.type === 'asset').map(r => r.id),
  characterIds: references.filter(r => r.type === 'character').map(r => r.id),
  brandId,
  productId,
  references,
  editorJson: value.editorJson,
}
```

For AI generation context, dereference IDs server-side to signed asset URLs, character descriptions, brand guidelines, product metadata, and other trusted records.

## UX Notes

Support these behaviors unless the existing product design says otherwise:

- Backspace deletes a selected reference chip as one unit.
- Arrow keys navigate through text and chips predictably.
- Paste plain text safely.
- Enter submits only when the composer is single-line or chat-style; otherwise use explicit submit behavior.
- References are removable and recoverable through undo.
- Empty state placeholder behaves like a textarea placeholder.
- The toolbar remains outside the Tiptap document.

## Avoid

- Do not store app references only as visible text such as `@asset_name`.
- Do not put API keys, provider calls, or AI generation logic in the editor extension.
- Do not use Tiptap Content AI or AI Toolkit for TaleLabs prompt composition unless explicitly requested.
- Do not let rich text formatting leak into generation prompts unless the product contract includes formatting semantics.
