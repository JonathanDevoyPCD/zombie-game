const loadedSprites = import.meta.glob<string>(
  "../../../../sprites/Sprites-Loaded/**/*.png",
  { eager: true, query: "?url", import: "default" },
);

function loadedSpriteUrl(relativePath: string): string {
  const sourcePath = `../../../../sprites/Sprites-Loaded/${relativePath}`;
  const assetUrl = loadedSprites[sourcePath];
  if (!assetUrl) {
    throw new Error(`Missing loaded sprite: ${relativePath}`);
  }
  return assetUrl;
}

export const SPRITE_ASSETS = {
  structures: {
    regularHouse: loadedSpriteUrl("Structures/regular-house.png"),
    woodWallHorizontal: loadedSpriteUrl("Structures/wood-wall-horizontal.png"),
    woodWallVertical: loadedSpriteUrl("Structures/wood-wall-vertical.png"),
  },
  containers: {
    chest: loadedSpriteUrl("Containers/chest.png"),
  },
  items: {
    scrap: loadedSpriteUrl("Items/scrap.png"),
    parts: loadedSpriteUrl("Items/parts.png"),
    food: loadedSpriteUrl("Items/food.png"),
    medicine: loadedSpriteUrl("Items/medicine.png"),
    wood: loadedSpriteUrl("Items/wood.png"),
    stone: loadedSpriteUrl("Items/stone.png"),
  },
  terrain: {
    grass: Array.from(
      { length: 10 },
      (_, index) => loadedSpriteUrl(`Terrain/Grass/grass-${String(index + 1).padStart(2, "0")}.png`),
    ),
    rocks: Array.from(
      { length: 10 },
      (_, index) => loadedSpriteUrl(`Terrain/Rocks/rock-${String(index + 1).padStart(2, "0")}.png`),
    ),
    resources: {
      trees: Array.from(
        { length: 3 },
        (_, index) => loadedSpriteUrl(`Terrain/Resources/tree-${String(index + 1).padStart(2, "0")}.png`),
      ),
      stones: Array.from(
        { length: 3 },
        (_, index) => loadedSpriteUrl(`Terrain/Resources/stone-${String(index + 1).padStart(2, "0")}.png`),
      ),
    },
  },
  players: {
    raider1: {
      idle: loadedSpriteUrl("Characters/Players/raider-1-idle.png"),
      walk: loadedSpriteUrl("Characters/Players/raider-1-walk.png"),
      shot: loadedSpriteUrl("Characters/Players/raider-1-shot.png"),
    },
  },
  zombies: Array.from({ length: 4 }, (_, index) => {
    const type = index + 1;
    return {
      idle: loadedSpriteUrl(`Characters/Zombies/zombie-${type}-idle.png`),
      walk: loadedSpriteUrl(`Characters/Zombies/zombie-${type}-walk.png`),
      attack: loadedSpriteUrl(`Characters/Zombies/zombie-${type}-attack.png`),
      hurt: loadedSpriteUrl(`Characters/Zombies/zombie-${type}-hurt.png`),
      dead: loadedSpriteUrl(`Characters/Zombies/zombie-${type}-dead.png`),
    };
  }),
} as const;

export type LoadedItemSpriteId = keyof typeof SPRITE_ASSETS.items;
