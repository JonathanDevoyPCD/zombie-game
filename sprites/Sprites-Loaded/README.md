# V2 Loaded Sprites

This directory is the stable asset boundary for the V2 game. Runtime code must load sprites from here rather than from the legacy source folders.

Replace a file while keeping its filename and transparent canvas alignment to change the artwork without changing gameplay code.

## Current mappings

- `Buildings/Houses/Grassland/house-grassland-*.png`: 32 grassland and forest dwellings
- `Buildings/Houses/Tundra/house-tundra-*.png`: 32 tundra dwellings
- `Buildings/Houses/Badlands/house-badlands-*.png`: 31 badlands, desert, and wasteland dwellings
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

## Temporary Hearthwick town sprites

The files below are stable replacement targets for the starting town. The SVGs are temporary
programmer art; the PNGs are copied from the existing medieval terrain pack. Replace the file
contents later without changing these paths.

- `Town/lamp-post.svg`: tall roadside lamp post
- `Town/lantern.svg`: small freestanding lantern
- `Town/well.png`: interactive stone well
- `Town/wagon.png`: merchant and farm wagon
- `Town/fence-horizontal.png` and `Town/fence-vertical.png`: wooden farm fences
- `Town/stone-wall-horizontal.svg` and `Town/stone-wall-vertical.svg`: town gate wall sections
- `Town/market-stall.svg`: open market stall
- `Town/signpost.svg`: road direction sign
- `Town/bench.svg`: town bench
- `Town/barrel.png`: supply and rain barrel
- `Town/firepit.png`: central town firepit
- `Town/hay-bale.svg`: farm hay bale
- `Town/trough.svg`: farm water trough
- `Items/water.svg`: inventory icon for fresh water

## Replacement rules

- Keep filenames stable.
- Character sheets use horizontal `128 x 128` frames; frame counts may vary by action.
- Upright world objects use bottom-center anchoring.
- Houses should remain tightly cropped, transparent PNGs with a maximum 512px dimension.
- Item icons should retain transparent backgrounds and readable silhouettes.
- Terrain props should remain centered on `160 x 160` transparent canvases.
- Gameplay collision is metadata-driven and does not come from visible alpha pixels.
