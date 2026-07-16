# TaleLabs Feature Research

This directory records evidence and implementation guidance for possible
TaleLabs capabilities. It is deliberately separate from the product vision and
execution plan.

Research here does **not** approve a feature, schedule it, or expand the MVP.
When a feature is approved, its stable contract must be incorporated into the
appropriate source-of-truth documents before implementation:

- `docs/talelabs-product-vision.md`
- `docs/flow-nodes-planning.md`
- `docs/db-design-planning-v2.md`
- `docs/api-design-planning-v2.md`
- `docs/mvp-execution-plan.md`

## One File Per Feature

Each capability has one self-contained Markdown file. A feature file should not
depend on an undocumented conversation to be understood by a future AI session.

Every file should include, where applicable:

1. research date and status;
2. product conclusion and explicit non-goals;
3. user problems, workflows, and qualitative community evidence;
4. competitor behavior and user experience;
5. domain boundaries and terminology;
6. proposed TaleLabs nodes and typed port contracts;
7. hosted models, direct APIs, aggregators, and open-source candidates;
8. current model limits, prices, licensing, and availability caveats;
9. illustrative registry and provider-adapter code;
10. execution, Asset ingestion, provenance, and failure behavior;
11. privacy, consent, abuse, and security considerations;
12. phased delivery and evaluation criteria;
13. open questions and linked sources.

## Research Standard

Prefer primary sources for technical and product claims:

- provider API documentation and changelogs;
- official model repositories, model cards, and papers;
- official competitor help centers and product guides;
- first-party production breakdowns.

Use community discussions to understand workflows, unmet needs, failure modes,
and user language. Treat them as qualitative signals, not market-size evidence
or verified model benchmarks. Clearly distinguish provider claims, observed
community reports, and TaleLabs recommendations.

Provider capabilities change quickly. Every feature file must show its last
research date. Runtime behavior must come from TaleLabs' reviewed, code-versioned
TypeScript registries, never directly from a research document, checked-in
provider snapshot, inventory JSON, or live provider response.

## Current Research

- [Lip sync](./lip-sync.md)
- [AI-assisted VFX and generative video editing](./ai-assisted-vfx-video-editing.md)
- [Video upscaling and restoration](./video-upscaling-restoration.md)
- [Background removal and video matting](./background-removal-matting.md)
- [Video expansion: extend, reframe, and outpaint](./video-expansion.md)
- [Image editing, product placement, and campaign variants](./image-editing-product-placement.md)
- [Dubbing and video translation](./dubbing-translation.md)
- [Voice cloning and speech generation](./voice-cloning-speech-generation.md)
- [Music, sound effects, and audio generation](./music-sound-effects.md)
- [Audio provider strategy: OpenRouter and ElevenLabs](./audio-provider-strategy-openrouter-elevenlabs.md)
- [Captions, transcription, and transcript-aware media](./captions-transcription.md)
- [Character consistency and reference systems](./character-consistency-references.md)
- [Storyboard and previsualization](./storyboard-previsualization.md)
- [Lightweight video editing and export](./lightweight-video-editor.md)
- [3D asset generation](./3d-asset-generation.md)
- [Canvas organization: notes, sections, and groups](./canvas-organization-notes-sections.md)
