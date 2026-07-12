# 3D Asset Generation

**Status:** exploratory research, low priority for current TaleLabs direction  
**Last researched:** 2026-07-12

## Product Conclusion

AI 3D generation is useful for concepting, prototypes, props, set dressing, and
visualization, but current outputs frequently require topology, UV, material,
scale, rigging, collision, and LOD cleanup before production use.

TaleLabs should not market raw prompt-to-mesh output as game-ready. If approved,
the first feature should generate a downloadable preview/GLB Asset and expose
technical metadata, with clear expectations that professional cleanup may be
required.

## User Workflows

- turn one or several concept images into a rough 3D prop;
- generate variants for rapid prototyping and previsualization;
- create background/set-dressing Assets;
- texture or retexture an existing mesh;
- export GLB/FBX/OBJ into Blender, Maya, Unity, or Unreal;
- optionally retopologize, rig, and produce PBR maps.

Community reports are consistent: image-to-3D often gives a better specific
shape than text-to-3D, while topology, UVs, part separation, and textures remain
the main production blockers.

## Competitor and Provider Behavior

Meshy and Tripo expose text-to-3D, image-to-3D, texture, and downstream asset
operations. Tripo's API is asynchronous and returns model files such as GLB.
Tencent Hunyuan3D provides open model/code candidates under its own community
license. These tools are strongest as starting points, not replacements for
Blender/Maya/ZBrush workflows.

## Proposed Nodes and Types

Approval requires a new typed media family:

```txt
Model3DSet
  items: canonical 3D Assets

Generate 3D Model
  prompt?: Text (1)
  references?: ImageSet (provider limit)
  quality: preview | final
  texture: none | basic | pbr
  output: Model3DSet

Retexture 3D Model
  model: Model3DSet (1)
  prompt: Text (1)
  styleReferences?: ImageSet
  output: Model3DSet
```

Do not store a GLB as an untyped generic file. Asset metadata should expose the
format, triangle count, material count, texture maps, bounds, units, rig status,
and preview renders.

```ts
type Model3DMetadata = {
  format: "glb" | "gltf" | "fbx" | "obj" | "usdz";
  triangleCount?: number;
  materialCount?: number;
  textureMaps?: Array<"baseColor" | "normal" | "roughness" | "metallic" | "ao">;
  bounds?: { x: number; y: number; z: number; unit?: string };
  rigged: boolean;
};
```

## Candidate Engines

| Engine                | Deployment                    | Inputs                               | Caveat                                       |
| --------------------- | ----------------------------- | ------------------------------------ | -------------------------------------------- |
| Tripo v3 API          | hosted                        | text, image, multi-view              | managed cost and provider contract           |
| Meshy                 | hosted                        | text/image, texture, animation tools | verify API plan and output rights            |
| Hunyuan3D 2.x         | self-hosted/community weights | primarily image-to-3D pipelines      | GPU load and custom license review           |
| TRELLIS-family models | self-hosted/research          | image-to-3D                          | checkpoint/license/production readiness vary |

## Runtime and Asset Processing

- Run provider work asynchronously through Trigger.dev.
- Ingest the original model file plus generated preview image/turntable.
- Parse metadata server-side and reject malformed or unsafe archives.
- Sanitize filenames and never execute embedded scripts.
- Limit decompressed size, texture count/resolution, polygons, and materials.
- Persist provider/model version, source references, settings, and license data.
- Offer format conversion as a separate deterministic task.
- Keep generated source and optimized derivatives separately.

## Security

3D formats can reference external resources or contain complex binary data.
Process them in an isolated worker, disallow arbitrary external fetches, cap
resource usage, and use maintained parsers. Preview rendering should also be
sandboxed and protected against GPU/CPU denial of service.

## Evaluation

- silhouette and multi-view fidelity;
- watertightness and non-manifold geometry;
- topology and deformation suitability;
- UV overlap and texture quality;
- scale, pivot, parts, and material separation;
- render-engine interoperability;
- triangle/material budgets and LOD readiness;
- provider license and commercial rights.

## Sources

### Primary

- [Tripo developer quick start](https://developers.tripo3d.ai/en/docs/quick-start)
- [Tripo generation documentation](https://docs.tripo3d.ai/)
- [Hunyuan3D 2.1 repository](https://github.com/tencent-hunyuan/hunyuan3d-2.1)
- [Hunyuan3D 2.0 license](https://github.com/Tencent-Hunyuan/Hunyuan3D-2/blob/main/LICENSE)
- [Hunyuan3D 2.0 paper](https://arxiv.org/abs/2501.12202)
- [Production-ready 3D asset generation survey](https://arxiv.org/abs/2604.23629)

### Community Signals

- [Usefulness after prototyping](https://www.reddit.com/r/aigamedev/comments/1ulumb2/how_useful_are_aigenerated_3d_assets_after_the/)
- [Topology, UV, and cleanup concerns](https://www.reddit.com/r/aigamedev/comments/1uk8vp6/some_real_feelings_after_using_ai_for_game/)
- [Production-ready Unreal requirements](https://www.reddit.com/r/comfyui/comments/1t5q2pj/i_would_like_a_3d_asset_generation_workflow_for/)
- [Retexturing and material separation pain](https://www.reddit.com/r/TopologyAI/comments/1u8vb37/retexturing_ai_assets/)
