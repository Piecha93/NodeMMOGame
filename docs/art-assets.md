# Adventure art assets

Generated on 2026-10-17 with the built-in `image_gen.imagegen` tool in transparent-background mode. No external stock images were used for these two character sheets. The original generated RGBA PNGs are copied unchanged into the repository; atlas JSON only maps their cells. The existing terrain and performance-test character remain unchanged.

Both outputs are 1254 × 1254 pixels and contain four columns and four directional rows (down, left, right, up). The loader exposes eight directions by reusing side views for diagonal movement. `run.json` repeats each four-pose cycle; `idle.json` alternates the two passing poses slowly. Per-character breathing, gait, shadows, hit feedback, held weapons and item effects are drawn at runtime with PixiJS. These effects do not change collision geometry or authoritative game state.

## Wanderer

Saved path: `public/resources/animations/wanderer/atlas.png`.

Original built-in tool output: `C:/Users/piech/.codex/generated_images/01a1482b-2fb6-7312-8805-c76b63fbb6dc/exec-7de673db-0ada-4750-871f-b188c871e85e.png`.

Final generation prompt:

```text
Use case: stylized-concept
Asset type: production transparent PNG sprite atlas for a tiny top-down browser action RPG.
Primary request: ONE precisely aligned 4 columns by 4 rows walk-cycle sprite sheet, 1024 by 1024 pixels. Every cell is exactly 256 by 256 pixels. Sixteen views of the SAME small hooded wandering mage: dark teal cloth hood and short coat, ochre scarf, brown boots, small bronze shoulder clasp. Bright face eyes under deep hood, appealing hand-painted pixel-art style with crisp chunky shapes, visible at 40px on screen. No staff, weapon, orb or accessories outside the silhouette; weapon will be rendered by the game.
Composition: each character centered horizontally in its own cell at x=128 and feet baseline y=220 within each 256px cell, full body height about 195px. Identical scale and alignment in every cell, clear transparent padding. First row faces DOWN towards viewer; second row faces LEFT; third row faces RIGHT; fourth row faces UP away from viewer. Within each row, columns show four successive walking poses: left foot forward, passing upright, right foot forward, passing upright. Subtle alternating arms and coat hem, consistent body and identity. Orthographic top-down 3/4 RPG sprite perspective, no perspective of atlas itself.
Constraints: exact regular grid layout, transparent background including between cells, NO labels, text, numbers, grid lines, borders, ground, cast shadows, scenes, UI, watermark. Keep all pixels of each sprite inside its 256px cell. Aim for a polished indie dungeon crawler, warm highlights and readable dark outline.
```

## Wraith

Saved path: `public/resources/animations/wraith/atlas.png`.

Original built-in tool output: `C:/Users/piech/.codex/generated_images/01a1482b-2fb6-7312-8805-c76b63fbb6dc/exec-9e3008b5-389d-4ab2-9fd7-8de418eedcba.png`.

Final generation prompt:

```text
Use case: stylized-concept
Asset type: production transparent PNG sprite atlas for a tiny top-down browser action RPG.
Primary request: ONE precisely aligned 4 columns by 4 rows animated walk/hover-cycle sprite sheet, 1024 by 1024 pixels. Every cell is exactly 256 by 256 pixels. Sixteen views of the SAME small hostile ash wraith: torn charcoal-black hooded mantle, empty dark face with two hot coral-orange eyes, little rusty copper armor clasp, wisps of pale gray smoke instead of feet. Menacing but readable, painted pixel-art indie dungeon crawler sprite with crisp chunky shapes and warm rim highlights, readable at 32px on screen. No weapons, no floating separate particles, no scenery.
Composition: center each wraith horizontally in its own cell at x=128, bottom of cloak/smoke baseline y=220, full height about 185px. Identical scale and alignment in every cell, clear transparent padding. First row faces DOWN towards viewer; second row faces LEFT; third row faces RIGHT; fourth row faces UP away from viewer. Within each row, four successive gentle flowing cloak/hover poses. The upward view must show the back of the hood without visible eyes. Orthographic top-down 3/4 RPG sprite perspective. Four by four grid.
Constraints: exact regular grid layout, genuinely transparent background including all between cells, NO labels, text, numbers, visible grid lines, borders, ground, shadows, scene, UI, watermark. Keep every sprite inside its own 256px cell. Do not draw white smoke filling the cell, use a compact charcoal silhouette, orange glow only inside face. Cohesive polished sprite sheet.
```
