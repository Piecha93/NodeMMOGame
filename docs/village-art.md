# Village terrain and environment art

The ordinary cooperative game uses a deterministic 32 px tile map. `shared/gameplay/VillageMap.ts` owns the grass/path/water/bridge selection, four seeded visual variants, neighbour-aware shore masks, prop placement, and the collision rectangles. The server builds persistent ordinary Wall objects from those same rectangles. Water tiles merge into a small number of contiguous bodies. The bridge deliberately splits the stream collision and provides a broad crossing. There is no map transfer over the network.

`client/graphic/TileMap.ts` builds each visible ground chunk once from Pixi Graphics and caches it as a texture. Grass, dirt, shore foam, water ripples and wooden planks are code-native art. They require no per-frame redraw. Static scenery shares the actor depth layer, so the player passes behind roofs and tree crowns when standing north of them. The performance world keeps its original terrain and creates no village obstacles.

## Generated atlas

- Mode: built-in `image_gen.imagegen`, with `transparent_background: true`.
- Final project file: `public/resources/maps/village-props.png`.
- Final original: `C:/Users/piech/.codex/generated_images/01a149a8-5e52-7ac3-b136-013cf2daaac4/exec-3d8e9fe3-8ea2-4ef1-80ee-66210e58f4b2.png`.
- Source draft: `C:/Users/piech/.codex/generated_images/01a149a8-5e52-7ac3-b136-013cf2daaac4/exec-0c0e6f5f-16f3-4e08-b5fc-76f7783b9b23.png`.
- PNG dimensions: 1536 × 1024, RGBA, genuine alpha transparency. The original is copied unchanged. Colour behind transparent pixels is ignored by the renderer.
- Props: red, blue, and moss roof cottages; pine; oak; rock cluster; flowers; stump. Wooden fences are code-native.
- The generated layout deviated slightly from exact grid cells. `VILLAGE_PROP_FRAMES` in `client/graphic/VillageScenery.ts` records inspected source rectangles with transparent margins; this prevents clipping at the nominal row and column boundaries. Texture frames do not modify the PNG.

Generation prompt:

```text
Use case: stylized-concept. Asset type: production transparent sprite atlas for a small cooperative browser action game. Create exactly eight separate environment props in a strict four-column by two-row equal-cell grid on a 1536 by 1024 transparent canvas. Row one left to right: cozy cottage with terracotta red roof, cozy cottage with slate blue roof, cozy cottage with mossy green roof, tall pine tree. Row two left to right: rounded leafy oak tree, small cluster of gray rocks, tiny cluster of wildflowers, old tree stump. Style: detailed painted pixel art, crisp readable silhouettes, top-down three-quarter orthographic view with front-facing cottage doors, matching a teal-hooded fantasy adventurer. Warm wood and cream plaster houses, lush sage and forest green vegetation, restrained cozy palette. Each of the eight objects must fit wholly within its equal grid cell, centered horizontally and with baseline at 85 percent of its cell height, generous transparent margins, no overlap across cells. Genuine alpha transparency, no ground planes, no cast shadows, no scenery behind objects, no labels, no grid lines, no text, no watermark. The three houses should have visibly different roof colors and small architectural variations, readable as individual sprites, not a scene. Exactly four columns and two rows.
```

Layout correction prompt, using the draft as the edit target:

```text
Edit target: the attached environment sprite atlas. Preserve all eight props, their painted pixel art look, their colors, and genuine alpha transparency. Change ONLY layout and scale: put them into an exact FOUR COLUMNS by TWO ROWS equal-cell grid on a 1536 by 1024 canvas. Each cell is 384 pixels wide and 512 pixels tall. Every object must fit ENTIRELY inside the central 300 by 380 area of its own cell, leaving at least 42 pixels of transparent margin left and right and at least 60 pixels of transparent space above and below. First row: red-roof cottage, blue-roof cottage, moss-roof cottage, pine. Second row: oak, rock cluster, flower cluster, stump. ALL FIRST ROW OBJECTS must end above y=452, leaving the horizontal strip y=452 through y=571 completely transparent. Every object's baseline should be at local y=440 in its cell (absolute y=440 for first row, y=952 for second row). No scenery, no cast shadows, no visible background, no labels or lines. IMPORTANT: no object pixels may cross the exact cell borders x=384,768,1152 or y=512.
```
