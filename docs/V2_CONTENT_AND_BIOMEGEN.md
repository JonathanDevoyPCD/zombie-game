# V2 Content Reuse And BiomeGen

## Reuse Boundary

V1 remains a useful content library, not a gameplay authority. Its artwork, UI composition, landmark concepts, mission text, tech-tree data, loot tables, and encounter ideas can be adapted into V2. Mutable state must be implemented through the V2 server so every connected player observes the same result.

Examples:

- Reuse a hospital image and its loot theme, but let the server own the hospital instance, doors, containers, enemies, and cleared state.
- Reuse the tech-tree interface, but store each survivor's unlocks on the server and send only that survivor's progression snapshot.
- Reuse mission definitions, while storing personal objectives per survivor and shared world events at room level.
- Reuse landmark names and layouts as prefab definitions, rather than placing them directly in client rendering code.

## Sprite Replacement Contract

All V2 runtime art is copied into `sprites/Sprites-Loaded`. Client code imports assets only through `apps/client/src/assets/spriteCatalog.ts`.

The directory is organized by role:

```text
sprites/Sprites-Loaded/
  Characters/Players/
  Characters/Zombies/
  Containers/
  Items/
  Structures/
  Terrain/Grass/
  Terrain/Rocks/
```

Temporary sprites can be replaced in place when final art is ready. A replacement must preserve its filename and intended frame dimensions. New variants should be added to the sprite catalog rather than referenced from their original pack directory.

Prefab definitions refer to stable content IDs such as `structure.regular-house` or `item.scrap`; they must not depend on source-pack filenames. This keeps rendering assets replaceable without changing server state or saved worlds.

## Building And Landmark Prefabs

Each authored prefab should declare:

- a stable prefab ID and allowed biomes
- exterior sprite, footprint, collision, entrance, and depth anchor
- interior scene ID and spawn/exit points
- searchable containers and loot-table IDs
- enemy, NPC, mission, and event sockets
- rarity, minimum spacing, danger tier, and safe-zone exclusions

BiomeGen creates an instance with its own stable ID and world position. The server persists only changes to that instance: opened containers, destroyed objects, doors, enemies, ownership, and mission state. The same bunker, hospital, abandoned farm, or radio-tower prefab can therefore appear many times without sharing state accidentally.

## BiomeGen Pipeline

BiomeGen should be deterministic for a world seed and generator version. It will generate continuous world-space fields, not isolated random chunk art.

1. Sample broad elevation, temperature, moisture, and danger fields.
2. Classify grassland, forest, desert, tundra, badlands, rocky lands, water, and transition areas.
3. Calculate transition masks so ground materials blend across chunk boundaries.
4. Generate rivers, lakes, cliffs, and traversable crossings from world-space networks.
5. Reserve landmark regions using biome rules, rarity, spacing, and route accessibility.
6. Stamp authored structure and encounter prefabs into those regions.
7. Scatter biome-specific vegetation, rocks, resources, and ambient details deterministically.
8. Apply server-persisted deltas such as harvested resources, built bases, opened containers, and destroyed props.

The current grass and rock scatter is the first deterministic ambient-prop layer. It proves stable cross-client placement while final biome art is still temporary.

## Multiplayer Ownership

The server owns shared world facts:

- generated chunks and prefab instances
- doors, containers, world pickups, resources, enemies, and NPCs
- placed base parts and structural damage
- shared encounters and world events

The server also owns private player facts:

- inventory and equipment
- personal missions and objective progress
- tech-tree unlocks, skills, and discovered map information
- settings that affect gameplay rather than presentation

The client owns presentation only: sprite choice, animation, camera, menus, audio volume, local input prediction, and visual effects. This separation lets V1 interfaces return without allowing one player to overwrite another player's progression.

## Next Content Milestone

Before expanding to all biomes, complete one grassland loop with centralized temporary art:

1. gather shared world pickups and container loot
2. place one persistent base object from inventory
3. discover one reused landmark prefab
4. enter its interior and clear a synchronized encounter
5. reconnect and confirm every mutation persists

Once this loop is stable for two players, additional sprites, structures, missions, and biomes become data expansion instead of new architecture.
