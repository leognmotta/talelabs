# Storyboard and Previsualization

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

A storyboard is a shot-planning and continuity surface, not merely a grid of
generated images. It should organize beats, shots, characters, locations,
camera language, timing, approved frames, and the transition into image/video
generation.

TaleLabs should not build it before the core Flow generation loop is sellable.
When approved, it should reuse Assets, Elements, and Flows rather than become a
parallel generation architecture.

## User Problems

- turn a script or concept into a sequence of planned shots;
- maintain character, wardrobe, prop, and location continuity;
- establish framing and camera movement before expensive video generations;
- compare alternate shots and choose approved frames;
- create an animatic or timing plan;
- pass each shot into a Flow for image and video generation;
- export a board for clients or production collaborators.

Research and community workflows show that creators often generate stills first
because image generation offers stronger composition control, then animate
approved frames. Storyboards also expose continuity problems before expensive
video runs.

## Competitor Patterns

LTX provides Gen Space, Canvas, Storyboard, Video Editor, and reusable Elements
inside a project. Luma supports storyboard generation within its creative Agent
and boards. Specialist storyboard products emphasize script breakdown,
character locks, shot order, and exports.

The strongest product boundary for TaleLabs is:

```txt
Storyboard = ordered creative intent and approved references
Flow       = reusable graph that transforms inputs into outputs
Editor     = temporal assembly of accepted media
```

## Suggested Domain Model

```ts
type Storyboard = {
  id: string;
  title: string;
  aspectRatio: string;
  shots: StoryboardShot[];
};

type StoryboardShot = {
  id: string;
  order: number;
  beat?: string;
  durationMs?: number;
  shotSize?: string;
  camera?: string;
  action?: string;
  dialogue?: string;
  elementIds: string[];
  approvedFrameAssetId?: string;
  generationFlowId?: string;
};
```

The database shape should be decided only when approved. Ordered shot records
are likely preferable to one opaque JSON document if collaboration, comments,
or partial updates become core. Immutable exports/runs may still snapshot the
entire storyboard as JSON.

## Flow Integration

Possible nodes or actions:

```txt
Script/Outline -> Break Into Shots -> Storyboard Shot Collection
Storyboard Shot -> Generate Frame Flow -> approved Image Asset
Approved Frame -> Animate Shot Flow -> Video Asset
Storyboard -> Build Animatic -> Video Asset
```

A storyboard can invoke a Flow per shot through explicit outer iteration. It
must not turn a Flow node into an unbounded hidden batch.

```ts
type StoryboardShotInput = {
  shotId: string;
  prompt: string;
  referenceAssetIds: string[];
  elementRevisions: Array<{ elementId: string; revision: number }>;
  durationMs?: number;
};
```

## UX Recommendation

Use a reorderable shot strip/list with a larger selected-shot inspector. Each
shot displays:

- beat and shot number;
- approved frame and alternates;
- character/location/prop Elements;
- camera and action direction;
- dialogue/audio;
- duration and generation status.

Do not force users to build a React Flow graph just to arrange a linear story.
Provide `Open in Flow` for the generation logic and `Use in Storyboard` for a
Flow output.

## Evaluation

- continuity across 10–40 shots;
- ability to replace one shot without invalidating the board;
- prompt/reference handoff into generation;
- reorder and collaboration behavior;
- animatic timing and audio alignment;
- export usefulness for external editors and clients;
- cost avoided by planning before video generation.

## Sources

### Primary and Research

- [Luma image capabilities and storyboards](https://lumalabs.ai/learning-center/articles/luma-image-capabilities)
- [Luma Agent orchestration](https://lumalabs.ai/learning-center/articles/about-the-luma-agent)
- [Luma Uni-1 storyboard field guide](https://lumalabs.ai/learning-center/articles/luma-uni-1-field-guide)
- [CANVAS continuity-aware storyboarding](https://arxiv.org/abs/2604.13452)
- [Lights, Camera, Consistency pipeline](https://arxiv.org/abs/2512.16954)

### Community and Production Signals

- [Character and scene consistency workflows](https://www.reddit.com/r/aifilmmaking/comments/1sduivr/any_workflow_suggestions_for_charactersscene/)
- [Rough-storyboard to concept-frame workflows](https://www.reddit.com/r/StableDiffusion/comments/1tt38p2/how_are_people_generating_realistic_concept/)
- [Why coherent AI short films remain difficult](https://www.reddit.com/r/AppBusiness/comments/1uqv3jd/why_is_making_ai_short_films_still_so_messy/)
- [Professional script/storyboard/editing workflow](https://www.creativebloq.com/ai/how-a-filmmaker-turned-a-10-year-old-unmakeable-movie-idea-into-reality-with-ai)
