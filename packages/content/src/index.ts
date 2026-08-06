export const BIOME_IDS = [
  "grassland",
  "forest",
  "desert",
  "tundra",
  "badlands",
  "wasteland",
] as const;

export type BiomeId = (typeof BIOME_IDS)[number];

export interface BiomeDefinition {
  id: BiomeId;
  name: string;
  color: number;
  accent: number;
}

export const BIOMES: Record<BiomeId, BiomeDefinition> = {
  grassland: { id: "grassland", name: "Grasslands", color: 0x7fa34a, accent: 0xa8c663 },
  forest: { id: "forest", name: "Forest", color: 0x315f3b, accent: 0x4d8150 },
  desert: { id: "desert", name: "Desert", color: 0xc99b58, accent: 0xe1bd78 },
  tundra: { id: "tundra", name: "Tundra", color: 0xbac9c4, accent: 0xd7e3df },
  badlands: { id: "badlands", name: "Badlands", color: 0x9e5d3d, accent: 0xbf7952 },
  wasteland: { id: "wasteland", name: "Wasteland", color: 0x6d6a4e, accent: 0x8c8966 },
};

export * from "./world";
export * from "./combat";
export * from "./items";
export * from "./buildables";
export * from "./town";
