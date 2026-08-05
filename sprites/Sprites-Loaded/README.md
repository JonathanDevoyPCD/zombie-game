# V2 Loaded Sprites

This directory is the stable asset boundary for the V2 game. Runtime code must load sprites from here rather than from the legacy source folders.

Replace a file while keeping its filename and transparent canvas alignment to change the artwork without changing gameplay code.

## Current mappings

- `Structures/regular-house.png`: shared exterior for the summer-house prefab
- `Structures/wood-wall-horizontal.png`: horizontal wooden wall buildable
- `Structures/wood-wall-vertical.png`: vertical wooden wall buildable
- `Containers/chest.png`: searchable supply chest
- `Items/*.png`: inventory icons keyed by item ID
- `Terrain/Grass/*.png`: deterministic ambient grass variants
- `Terrain/Resources/tree-01.png` through `tree-03.png`: harvestable tree variants
- `Terrain/Resources/stone-01.png` through `stone-03.png`: harvestable stone variants
- `Terrain/Rocks/*.png`: deterministic ambient rock variants
- `Characters/Players/raider-1-*.png`: 128px-frame player animation strips
- `Characters/Zombies/zombie-*-*.png`: 128px-frame zombie animation strips

## Replacement rules

- Keep filenames stable.
- Character sheets use horizontal `128 x 128` frames; frame counts may vary by action.
- Upright world objects use bottom-center anchoring.
- Item icons should retain transparent backgrounds and readable silhouettes.
- Terrain props should remain centered on `160 x 160` transparent canvases.
- Gameplay collision is metadata-driven and does not come from visible alpha pixels.
