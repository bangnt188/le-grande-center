# Scene assets and provenance

All production assets are self-hosted. `asset-manifest.json` records the exact output SHA-256, bytes, source and license. `scripts/scene-asset-sources.json` records **every exact upstream download URL and checksum**, including the glTF buffers and textures. No upstream service is contacted by the viewer.

## Existing project building — unchanged

`assets/building-578abef2f86d.glb` remains exactly the existing building, authored by `src/app/model-3d/model.ts`, not the reference building.

SHA-256: `578abef2f86d3bac7093bf03e48fd7c4a590d1d6c6ee958d5ebc6bfc33ea6650`.

The exporter and checker enforce this checksum; export never regenerates or replaces the building. Project-authored building, lamp, bench and illustrative monument are distributed as part of Le Grande Centre only. The monument is an illustrative original, not a surveyed reconstruction.

The surrounding apartments, courtyards, trunks, low-poly canopies and 128px window/emission textures are original procedural work in `src/app/model-3d/site.ts`, not copies of the project building or downloaded branded models. Five opaque instanced batches share geometry/materials, do not cast/receive shadows, and vary density by quality tier. These neighborhoods are illustrative, not a reconstruction of actual adjacent properties. No added third-party asset license or runtime model download is involved.

## Downloaded vegetation — CC0

- [Island Tree 02](https://polyhaven.com/a/island_tree_02), Rob Tuytel (scanning/processing) and Rico Cilliers (cleanup/processing).
- [Shrub 02](https://polyhaven.com/a/shrub_02), Rico Cilliers; the `shrub_02_a` variant is used.
- Primary license: [Poly Haven asset license](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Tree download: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/island_tree_02/island_tree_02_1k.gltf
- Shrub download: https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/shrub_02/shrub_02_1k.gltf
- All dependent `.bin` and JPEG URLs and source MD5s are pinned in `scripts/scene-asset-sources.json`, as published by the [Poly Haven files API](https://api.polyhaven.com/files/island_tree_02).

Derived changes: normalized to approximately 10.8-unit tree / 1.5-unit shrub height, indexed geometry reduction, 1024px embedded PBR textures, double-sided vegetation. Tree leaves are disconnected components: the authoring script preserves complete sampled leaves and compensates their area before per-leaf reduction, instead of globally deleting the canopy. This is a real-time landscape interpretation of the downloaded model, not a species-accurate botanical reconstruction. CC0 allows commercial use, modification and redistribution without attribution; credits are retained here voluntarily.

## Downloaded vehicle — CC BY 4.0

**Car Concept**, © 2024 Darmstadt Graphics Group GmbH; model and textures by **Eric Chadwick**, based on a [CC0 concept by Unity Fan](https://sketchfab.com/3d-models/free-concept-car-004-public-domain-cc0-4cba124633eb494eadc3bb0c4660ad7e).

- Primary provenance/license: https://github.com/KhronosGroup/glTF-Sample-Assets/blob/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/CarConcept/README.md
- Exact download: https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/CarConcept/glTF-Binary/CarConcept.glb
- Source SHA-256: `c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b`.
- License: https://creativecommons.org/licenses/by/4.0/

Derived changes: 4.65-unit length, simplified and merged by material, neutral graphite paint, reflective opaque glazing in place of expensive transmission; geometry named license plate, logo, emblem and badge removed, including the branded steering-wheel emblem; license-marked surfaces/textures are stripped. This concept vehicle comes from a source README explicitly identifying Khronos logos; no brand mark is intentionally redistributed in the derivative. CC BY requires attribution, a license link and indication of changes; preserve this notice. Trademark rights are not granted by that license.

## Downloaded articulated pedestrian — CC BY 4.0

**Cesium Man**, © 2017 **Cesium**, model, texture, skin and animation.

- Primary provenance/license: https://github.com/KhronosGroup/glTF-Sample-Assets/blob/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/CesiumMan/README.md
- Exact download: https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/edc7c9e67c639d230715049ee31f9a96a6babbbe/Models/CesiumMan/glTF-Binary/CesiumMan.glb
- Source SHA-256: `b7001eaeea8254bd44773bcd247e78696d94169388fbb2a1800fc69434e777d9`.
- License: https://creativecommons.org/licenses/by/4.0/
- Source trademark notice: https://github.com/KhronosGroup/glTF-Sample-Assets/blob/edc7c9e67c639d230715049ee31f9a96a6babbbe/LICENSES/LicenseRef-LegalMark-Cesium.txt

Derived changes: normalized to approximately 1.76-unit height; source diffuse image (bearing the Cesium globe mark) is omitted entirely, replaced by authored neutral slate material; original skeleton and walking clip retained, cloned at varied sizes and phase offsets. No Cesium image/texture is included in the derivative. Preserve CC-BY attribution/license/change notices; credit identifies source, not endorsement.

## Daylight environment — CC0

- File: `daylight-995d68b1.hdr` (1024 × 512 RGBE HDR; 1,173,154 bytes).
- [Kloppenheim 06 (Pure Sky)](https://polyhaven.com/a/kloppenheim_06_puresky), Greg Zaal (original), Jarod Guest (sky edits).
- License: https://polyhaven.com/license
- Exact download: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_06_puresky_1k.hdr
- Source MD5: `995d68b1656f26452572645c0ffe898b`.
- SHA-256: `206c67e3a1b992282821cf06662bdd69bbb4915c1c4444a66338a40d6a7d4e34`.

Used for lighting/reflection, never as a photograph of the project surroundings. The golden-hour sky is authored atmosphere, not a downloaded reference image.

## Supplied reference image

`explore-cover.webp` is a re-encoded derivative of the image supplied by the user for this task (321,578 bytes). It is used as the exploration entry reference image and for atmosphere/landscape direction only. No third-party ownership, CC license, building-geometry provenance or geographic accuracy is asserted. The building depicted in this cover is **not** used to replace the existing project model. Distribution is limited to this supplied project use unless the rights holder provides broader permission.

## Brand and rights review (best effort)

The pinned CesiumMan upstream license explicitly excludes its logo/trademark; its branded diffuse texture is excluded from the delivered pedestrian GLB. The pinned CarConcept README says the source includes Khronos logos; the authored export removes mesh pieces named license/plate/logo/emblem/badge and strips branding-marked surfaces. The shipped scene contains only the named, checksum-pinned sources and original project-authored assets; these checks reduce visible brand use, but are not legal clearance or an exhaustive trademark, publicity, design-right or image-right search. Re-audit source and rendered models after replacing assets; obtain rights-holder permission for the supplied cover before broader commercial redistribution if ownership is uncertain.

## Reproduction and bounds

Run `npm run models:export` and open the printed local Chromium authoring URL. The exporter downloads checksum-pinned sources into the OS temporary directory, reuses valid downloads, normalizes and optimizes with Three's bundled meshoptimizer authoring module, embeds textures, and produces content-addressed GLBs. It never downloads dependencies at viewer runtime and requires no new decoder or package dependency. Keep the existing building GLB available for its checksum gate.

Run `npm run check:scene-assets` to validate manifest digest, output checksums, embedded-only resources, texture/geometry/transfer bounds, required rig/clip, license provenance, zero pedestrian textures, removal of identified vehicle logo pieces and the unchanged building.

Site dimensions and scenery remain illustrative. Quality tiers retain proportionate vegetation/traffic density. Cars follow separate equal-speed lanes with an island detour; articulated walkers use a separate forecourt loop, with no road crossing. Motion uses absolute runtime scene time and reusable car matrices. Runtime controls pause, visibility, context-loss and reduced-motion behavior. This is scheduled architectural context, not a traffic simulator.
