# Character Consistency and Reference Systems

**Status:** exploratory research, partially aligned with existing Elements design  
**Last researched:** 2026-07-12

## Product Conclusion

Character consistency is not a single model feature. It is a production system
that separates identity, appearance, expression, wardrobe, motion, voice, and
shot-specific references, then selects only what a consumer model can accept.

TaleLabs Elements already provide the correct durable abstraction. The feature
work is to improve reference preparation, selection, validation, and
continuity—not to create another competing character database.

## Evidence From Real Workflows

Filmmakers repeatedly describe character and scene continuity as one of the
largest time sinks in AI video. Reported workflows commonly:

1. create a source-of-truth character sheet;
2. capture front, profile, full-body, expression, and wardrobe views;
3. plan storyboards before generating motion;
4. pass selected identity references into each shot;
5. keep identity references separate from pose/motion/style references;
6. update reference sheets when the character changes in the story;
7. edit, grade, and correct the outputs in conventional tools.

Multiple characters, extreme angles, wardrobe changes, and long sequences
remain difficult. More references are not always better because providers have
small limits and can confuse incompatible signals.

## Competitor Patterns

Luma recommends master reference Assets and structured character/object
descriptions. LTX exposes reusable Elements for characters, props, products, and
places. Flora provides reusable nodes and compressed workflows. Adobe's emerging
Elements concept similarly separates reusable subjects from projects and
generations.

## TaleLabs Contract

An Element role outputs a collection, such as `ImageSet`. It does not choose a
provider-specific subset. The consumer generation node selects references based
on its model capabilities.

```txt
Character Element: Maya
  context: Text
  appearance: ImageSet (up to 8 stored references)
  expressions: ImageSet (up to 8 stored references)
  motion: VideoSet (up to 1 per role under current policy)
  voice: AudioSet (up to 1 per role under current policy)

Image/Video Generation Node
  subjectReferences: accepts at most N images for selected model
  selectionMode: automatic | manual
```

```ts
type ReferenceSelection = {
  sourceNodeId: string;
  sourcePortId: string;
  mode: "automatic" | "manual";
  selectedAssetIds: string[];
  modelLimit: number;
};
```

Automatic selection should prefer primary/ordered Assets, diversity of view,
media quality, and role relevance. The resolved selection belongs in the run
snapshot so later Element edits cannot alter execution.

## Supporting Nodes

Possible future nodes:

```txt
Build Character Sheet
  references: ImageSet
  description?: Text
  output: ImageSet

Extract Character Description
  references: ImageSet
  output: Text

Select References
  collection: ImageSet | VideoSet | AudioSet
  policy or manual selection
  output: same typed collection

Compare Identity
  subject: ImageSet | VideoSet
  reference: ImageSet
  output: structured score/report
```

These should not duplicate the existing Element form. They produce or refine
Assets that users may attach to an Element.

## Runtime and UX Rules

- Store reusable context on Elements; store shot-specific context on Flow nodes.
- Keep semantic roles through edge resolution and adapter mapping.
- Show `3 of 8 selected` at the consumer input, not inside the Element node.
- Open a selection panel with Automatic/Manual modes when model capacity is
  lower than the available collection.
- Warn when connected references exceed the selected model's capability.
- Never drop excess inputs silently.
- Snapshot Element revision, role, Asset IDs, and selection policy at admission.
- Evaluate identity, wardrobe, product/prop, and environment continuity
  separately; one similarity score is insufficient.

## Evaluation Set

Use fixed sequences with:

- front/profile/back and extreme camera angles;
- close-up to full-body transitions;
- two and three characters;
- expressions and dialogue;
- wardrobe changes that should and should not persist;
- occlusion and fast motion;
- consistent props and locations.

The evaluation question is not only “does the face match?” but “does the shot
preserve the approved continuity state while obeying the new direction?”

## Sources

### Primary

- [Luma character and object consistency](https://lumalabs.ai/learning-center/articles/character-and-object-consistency)
- [Luma master references](https://lumalabs.ai/learning-center/articles/using-master-references)
- [Luma Uni-1 field guide](https://lumalabs.ai/learning-center/articles/luma-uni-1-field-guide)
- [Luma Seedance basics and reference limits](https://lumalabs.ai/learning-center/articles/seedance-2.0-basics)
- [Luma advanced Seedance workflows](https://lumalabs.ai/learning-center/articles/advanced-seedance-2.0-workflows)

### Community and Production Signals

- [Character/scene consistency workflow discussion](https://www.reddit.com/r/aifilmmaking/comments/1sduivr/any_workflow_suggestions_for_characterscene/)
- [Creator pain points for image/video generation](https://www.reddit.com/r/aiArt/comments/1t9ayei/what_are_your_biggest_pain_points_when_making_ai/)
- [Professional AI-film reference-sheet workflow](https://www.creativebloq.com/ai/how-a-filmmaker-turned-a-10-year-old-unmakeable-movie-idea-into-reality-with-ai)
- [Traditional filmmaking discipline in AI productions](https://www.creativebloq.com/ai/ai-filmmaking-is-a-gimmick-if-you-dont-know-the-rules-of-cinema)
