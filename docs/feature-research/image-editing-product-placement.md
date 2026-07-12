# Image Editing, Product Placement, and Campaign Variants

**Status:** exploratory research, not approved scope  
**Last researched:** 2026-07-12

## Product Conclusion

The commercially useful feature is not a generic “edit image” button. It is a
reference-aware pipeline that preserves product identity while generating
listing shots, lifestyle scenes, ad variants, and product swaps.

TaleLabs already has the right primitives: Assets, Elements, typed collections,
and Flows. A Product Element can expose approved packshots and details; an image
editing node can consume a selected subset plus a scene/style reference.

## User Demand and Failure Modes

E-commerce and agency users want to:

- turn clean packshots into multiple campaign scenes;
- preserve label text, geometry, materials, color, and proportions;
- reuse a proven ad composition with another catalog product;
- make consistent catalog angles and backgrounds in batches;
- adapt one visual to multiple placements and aspect ratios;
- retain a reviewable original rather than regenerate the product itself.

Community workflows repeatedly report that product accuracy, not background
beauty, is the bottleneck. Common failures are changed labels, widened caps,
wrong colors, plastic-looking materials, and inconsistent scale. Users often
finish the last 10–20% in Photoshop, Canva, or a conventional editor.

## Competitor Patterns

Adobe separates composition and style references and exposes adherence
strength. Photoshop supports reference-guided generative fill. Runway's Product
Swap recipe accepts a reference video, the original product image, and multiple
images of the replacement. Luma documents image references for campaigns,
storyboards, and product ads.

The lesson is to keep reference roles explicit:

- **product truth:** what must remain accurate;
- **composition:** placement, camera, and depth;
- **style:** lighting, color, and visual language;
- **background/scene:** environment to create or modify;
- **mask:** region the model may change.

## Candidate Models and Providers

| Model/provider family                     | Strength                                          | TaleLabs concern                                      |
| ----------------------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Gemini image editing / Nano Banana family | instruction-based multi-reference editing         | verify current input count and resolution in registry |
| Runway product-swap/edit APIs             | product-specific managed workflow                 | hosted dependency and endpoint-specific contract      |
| Adobe Firefly/Photoshop                   | reference, composition, fill, commercial workflow | API availability differs from app capability          |
| FLUX Kontext family                       | strong image editing                              | provider/checkpoint and license vary                  |
| Qwen Image Edit family                    | open/hosted editing candidates                    | evaluate text/product fidelity and deployment cost    |

## Proposed Nodes

```txt
Edit Image
  source: ImageSet (1)
  instruction: Text (1)
  mask?: ImageSet (1)
  references?: ImageSet (model limit)
  output: ImageSet

Product Scene
  product: ImageSet (1..model limit)
  scene: Text (1)
  composition?: ImageSet (1)
  style?: ImageSet (1)
  output: ImageSet

Product Swap
  source: ImageSet (1) | VideoSet (1)
  originalProduct?: ImageSet (1)
  replacementProduct: ImageSet (1..model limit)
  output: same media family as source
```

The consumer node selects Assets from Product Element roles. The Element node
continues to output collections; it must not decide provider-specific reference
limits.

```ts
type ProductSceneInputs = {
  productAssetIds: string[];
  compositionAssetId?: string;
  styleAssetId?: string;
  scenePrompt: string;
  preserve: Array<"geometry" | "label" | "color" | "material">;
};
```

## Implementation Guidance

- Keep all model limits in the reviewed generation registry.
- Snapshot selected reference Assets and their semantic roles.
- Do not flatten every image into an unordered `references` array before the
  TaleLabs adapter records intent.
- Add automated post-generation checks later: OCR/logo comparison, perceptual
  product similarity, dominant-color drift, and human approval.
- Preserve source and derivative as separate Assets with immutable provenance.
- Use output families for batch variants; one failed variant should not erase
  successful siblings.
- Do not claim exact product fidelity. The UI must encourage review before use.

## UX

Start from an outcome (`Lifestyle scene`, `Catalog shot`, `Product swap`) and
show the selected product references. Advanced users may adjust composition and
style strength. Provide compare and reject controls and make the original
packshot one click away.

## Evaluation

Build a fixed benchmark across packaging, cosmetics, jewelry, apparel, glass,
and reflective objects. Score label OCR, shape, color, material, scene realism,
and batch consistency. Human reviewers should mark whether the result is safe
for a product listing, an ad concept, or neither.

## Sources

### Primary

- [Adobe Firefly composition references](https://helpx.adobe.com/firefly/web/work-with-images/generate-images/match-image-composition-to-reference-image.html)
- [Adobe Firefly style references](https://helpx.adobe.com/ca/firefly/how-to/generate-image-using-reference-image.html)
- [Photoshop reference-guided generative fill](https://helpx.adobe.com/photoshop/desktop/create-open-import-images/create-images/use-reference-images-for-consistent-results.html)
- [Runway Product Swap recipe](https://docs.dev.runwayml.com/recipes/product-swap/)
- [Luma image capabilities](https://lumalabs.ai/learning-center/articles/luma-image-capabilities)
- [ProductConsistency research](https://arxiv.org/abs/2606.19103)

### Community Signals

- [Product accuracy as the hard problem](https://www.reddit.com/r/ArtificialInteligence/comments/1rtvex5/the_hardest_problem_in_ai_product_photography/)
- [Reference-first product photography workflow](https://www.reddit.com/r/ecommercemarketing/comments/1qvkxng/how_to_create_ai_product_photography_that/)
- [Keeping product labels accurate](https://www.reddit.com/r/generativeAI/comments/1sbnsoi/how_can_i_keep_a_product_label_accurate_in/)
- [Demand for exact product consistency](https://www.reddit.com/r/AIDiscussion/comments/1tihwv4/best_ai_toolworkflow_for_product_ads_with_perfect/)
