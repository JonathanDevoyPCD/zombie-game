import {
  SUMMER_HOUSE_PREFAB_ID,
  STARTING_TOWN_RADIUS,
  resolveBuildingInstance,
  type BiomeId,
  type ResolvedBuildingDefinition,
} from "@last-survivor/content";

export const WORLD_GENERATOR_VERSION = 4;
export const CHUNK_TILES = 32;
export const TILE_SIZE = 32;
export const CHUNK_SIZE = CHUNK_TILES * TILE_SIZE;

export interface ClimateSample {
  elevation: number;
  moisture: number;
  temperature: number;
  hazard: number;
}

export interface GeneratedTile extends ClimateSample {
  worldX: number;
  worldY: number;
  biome: BiomeId;
  variant: number;
}

export interface GeneratedChunk {
  id: string;
  version: number;
  seed: string;
  chunkX: number;
  chunkY: number;
  tiles: GeneratedTile[];
}

export type AmbientPropKind = "grass" | "rock";

export interface GeneratedAmbientProp {
  id: string;
  kind: AmbientPropKind;
  variant: number;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
}

export type GeneratedResourceKind = "tree" | "stone";

export interface GeneratedResourceNode {
  id: string;
  kind: GeneratedResourceKind;
  variant: number;
  x: number;
  y: number;
}

export type SettlementKind = "town" | "village" | "hamlet" | "farmstead" | "isolated";
export type HouseSpriteBiome = "grassland" | "tundra" | "badlands";

export interface GeneratedBuildingPlacement {
  id: string;
  name: string;
  settlementId: string;
  settlementName: string;
  settlementKind: SettlementKind;
  spriteBiome: HouseSpriteBiome;
  spriteVariant: number;
  x: number;
  y: number;
  displayWidth: number;
  interiorSpaceId: string;
}

export const HOUSE_VARIANT_COUNTS: Readonly<Record<HouseSpriteBiome, number>> = {
  grassland: 32,
  tundra: 32,
  badlands: 31,
};
export const SETTLEMENT_REGION_SIZE = CHUNK_SIZE * 4;

export const RESOURCE_INTERACTION_RADIUS = 54;
export const RESOURCE_RESPAWN_MS = 3 * 60 * 1000;
export const RESOURCE_DISPLAY_WIDTHS: Readonly<Record<GeneratedResourceKind, readonly number[]>> = {
  tree: [165, 145, 125],
  stone: [34, 34, 42],
};

export function resourceCollisionRect(
  kind: GeneratedResourceKind,
  x: number,
  y: number,
): { x: number; y: number; width: number; height: number } {
  const width = kind === "tree" ? 48 : 28;
  const height = kind === "tree" ? 34 : 22;
  return { x: x - width / 2, y: y - height / 2, width, height };
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function hash2D(seed: number, x: number, y: number, salt: number): number {
  let hash = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ salt;
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  hash = Math.imul(hash ^ (hash >>> 12), 0x297a2d39);
  return (hash ^ (hash >>> 15)) >>> 0;
}

function randomAt(seed: number, x: number, y: number, salt: number): number {
  return hash2D(seed, x, y, salt) / 0xffffffff;
}

function houseSpriteBiome(biome: BiomeId): HouseSpriteBiome {
  if (biome === "tundra") {
    return "tundra";
  }
  if (biome === "desert" || biome === "badlands" || biome === "wasteland") {
    return "badlands";
  }
  return "grassland";
}

function settlementKind(roll: number): SettlementKind {
  if (roll < 0.1) {
    return "town";
  }
  if (roll < 0.36) {
    return "village";
  }
  if (roll < 0.64) {
    return "hamlet";
  }
  if (roll < 0.86) {
    return "farmstead";
  }
  return "isolated";
}

function settlementLayout(kind: SettlementKind): readonly WorldOffset[] {
  if (kind === "town") {
    return Array.from({ length: 16 }, (_, index) => ({
      x: (index % 4 - 1.5) * 270,
      y: (Math.floor(index / 4) - 1.5) * 280,
    }));
  }
  if (kind === "village") {
    return Array.from({ length: 9 }, (_, index) => ({
      x: (index % 3 - 1) * 290,
      y: (Math.floor(index / 3) - 1) * 300,
    }));
  }
  if (kind === "hamlet") {
    return [
      { x: 0, y: 0 },
      { x: -270, y: -45 },
      { x: 275, y: 35 },
      { x: -55, y: -280 },
      { x: 45, y: 285 },
    ];
  }
  if (kind === "farmstead") {
    return [
      { x: 0, y: 0 },
      { x: 285, y: 110 },
      { x: -270, y: 125 },
    ];
  }
  return [{ x: 0, y: 0 }];
}

interface WorldOffset {
  x: number;
  y: number;
}

const SETTLEMENT_PREFIXES = [
  "Ash",
  "Briar",
  "Crow",
  "Dun",
  "Elder",
  "Fallow",
  "Grey",
  "High",
  "Iron",
  "Oak",
  "Raven",
  "Stone",
] as const;

const SETTLEMENT_SUFFIXES = [
  "bridge",
  "brook",
  "field",
  "ford",
  "haven",
  "hollow",
  "mere",
  "stead",
  "vale",
  "wick",
  "wood",
  "worth",
] as const;

function settlementName(numericSeed: number, regionX: number, regionY: number): string {
  const prefix = SETTLEMENT_PREFIXES[
    hash2D(numericSeed, regionX, regionY, 901) % SETTLEMENT_PREFIXES.length
  ];
  const suffix = SETTLEMENT_SUFFIXES[
    hash2D(numericSeed, regionX, regionY, 907) % SETTLEMENT_SUFFIXES.length
  ];
  return `${prefix}${suffix}`;
}

function dwellingName(
  settlement: string,
  kind: SettlementKind,
  index: number,
): string {
  if (kind === "farmstead") {
    return index === 0
      ? `${settlement} Farmhouse`
      : `${settlement} Farm Cottage ${index}`;
  }
  if (kind === "isolated") {
    return `${settlement} Cottage`;
  }
  return `${settlement} ${kind === "town" ? "Dwelling" : "Cottage"} ${index + 1}`;
}

export function generateSettlementRegionBuildings(
  seed: string,
  regionX: number,
  regionY: number,
): GeneratedBuildingPlacement[] {
  const numericSeed = hashString(seed);
  const kind = settlementKind(randomAt(numericSeed, regionX, regionY, 919));
  const name = settlementName(numericSeed, regionX, regionY);
  const settlementId = `settlement:${regionX}:${regionY}`;
  const centerX = regionX * SETTLEMENT_REGION_SIZE
    + 800
    + randomAt(numericSeed, regionX, regionY, 929) * (SETTLEMENT_REGION_SIZE - 1600);
  const centerY = regionY * SETTLEMENT_REGION_SIZE
    + 800
    + randomAt(numericSeed, regionX, regionY, 937) * (SETTLEMENT_REGION_SIZE - 1600);

  return settlementLayout(kind).flatMap((offset, index) => {
    const x = centerX + offset.x + (randomAt(numericSeed, regionX, regionY, 947 + index) - 0.5) * 34;
    const y = centerY + offset.y + (randomAt(numericSeed, regionX, regionY, 997 + index) - 0.5) * 28;
    if (Math.hypot(x, y) < STARTING_TOWN_RADIUS + 350) {
      return [];
    }
    const tile = sampleTile(seed, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
    const spriteBiome = houseSpriteBiome(tile.biome);
    const id = `dwelling:${regionX}:${regionY}:${index}`;
    return [{
      id,
      name: dwellingName(name, kind, index),
      settlementId,
      settlementName: name,
      settlementKind: kind,
      spriteBiome,
      spriteVariant: hash2D(numericSeed, regionX, regionY, 1103 + index)
        % HOUSE_VARIANT_COUNTS[spriteBiome],
      x,
      y,
      displayWidth: 195 + hash2D(numericSeed, regionX, regionY, 1201 + index) % 41,
      interiorSpaceId: `interior:${id}`,
    }];
  });
}

export function generateChunkBuildings(
  seed: string,
  chunkX: number,
  chunkY: number,
): GeneratedBuildingPlacement[] {
  const startX = chunkX * CHUNK_SIZE;
  const startY = chunkY * CHUNK_SIZE;
  const endX = startX + CHUNK_SIZE;
  const endY = startY + CHUNK_SIZE;
  const minimumRegionX = Math.floor((startX - 600) / SETTLEMENT_REGION_SIZE);
  const maximumRegionX = Math.floor((endX + 600) / SETTLEMENT_REGION_SIZE);
  const minimumRegionY = Math.floor((startY - 600) / SETTLEMENT_REGION_SIZE);
  const maximumRegionY = Math.floor((endY + 600) / SETTLEMENT_REGION_SIZE);
  const buildings: GeneratedBuildingPlacement[] = [];

  for (let regionY = minimumRegionY; regionY <= maximumRegionY; regionY += 1) {
    for (let regionX = minimumRegionX; regionX <= maximumRegionX; regionX += 1) {
      generateSettlementRegionBuildings(seed, regionX, regionY).forEach((building) => {
        if (
          building.x >= startX
          && building.x < endX
          && building.y >= startY
          && building.y < endY
        ) {
          buildings.push(building);
        }
      });
    }
  }

  return buildings;
}

export function resolveGeneratedBuilding(
  building: GeneratedBuildingPlacement,
): ResolvedBuildingDefinition {
  return resolveBuildingInstance({
    id: building.id,
    name: building.name,
    prefabId: SUMMER_HOUSE_PREFAB_ID,
    exteriorPosition: { x: building.x, y: building.y },
    interiorSpaceId: building.interiorSpaceId,
    spriteId: `${building.spriteBiome}:${building.spriteVariant}`,
    displayWidth: building.displayWidth,
  });
}

export function generatedBuildingFromInteriorSpace(
  seed: string,
  spaceId: string,
): ResolvedBuildingDefinition | undefined {
  const match = /^interior:dwelling:(-?\d+):(-?\d+):(\d+)$/.exec(spaceId);
  if (!match) {
    return undefined;
  }
  const regionX = Number(match[1]);
  const regionY = Number(match[2]);
  return generateSettlementRegionBuildings(seed, regionX, regionY)
    .filter((building) => building.interiorSpaceId === spaceId)
    .map(resolveGeneratedBuilding)[0];
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function valueNoise(seed: number, x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xBlend = smoothstep(x - x0);
  const yBlend = smoothstep(y - y0);
  const top = lerp(
    randomAt(seed, x0, y0, salt),
    randomAt(seed, x0 + 1, y0, salt),
    xBlend,
  );
  const bottom = lerp(
    randomAt(seed, x0, y0 + 1, salt),
    randomAt(seed, x0 + 1, y0 + 1, salt),
    xBlend,
  );

  return lerp(top, bottom, yBlend);
}

function fractalNoise(
  seed: number,
  x: number,
  y: number,
  scale: number,
  salt: number,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(seed, (x / scale) * frequency, (y / scale) * frequency, salt + octave) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / amplitudeTotal;
}

export function sampleClimate(seed: string, worldX: number, worldY: number): ClimateSample {
  const numericSeed = hashString(seed);
  const latitude = Math.min(1, Math.abs(worldY) / 9000);
  const elevation = fractalNoise(numericSeed, worldX, worldY, 170, 101);
  const moisture = fractalNoise(numericSeed, worldX + 1700, worldY - 900, 210, 211);
  const temperatureNoise = fractalNoise(numericSeed, worldX - 2300, worldY + 1200, 280, 307);
  const hazard = fractalNoise(numericSeed, worldX + 4200, worldY + 3100, 145, 401);

  return {
    elevation,
    moisture,
    temperature: Math.max(0, Math.min(1, temperatureNoise * 0.8 + 0.2 - latitude * 0.38)),
    hazard,
  };
}

export function classifyBiome(climate: ClimateSample): BiomeId {
  if (climate.hazard > 0.71 && climate.moisture < 0.56) {
    return "wasteland";
  }

  if (climate.temperature < 0.31) {
    return "tundra";
  }

  if (climate.temperature > 0.62 && climate.moisture < 0.35) {
    return climate.elevation > 0.56 ? "badlands" : "desert";
  }

  if (climate.moisture > 0.58) {
    return "forest";
  }

  if (climate.elevation > 0.7 && climate.moisture < 0.48) {
    return "badlands";
  }

  return "grassland";
}

export function sampleTile(seed: string, worldX: number, worldY: number): GeneratedTile {
  const climate = sampleClimate(seed, worldX, worldY);
  const numericSeed = hashString(seed);

  return {
    worldX,
    worldY,
    ...climate,
    biome: classifyBiome(climate),
    variant: hash2D(numericSeed, worldX, worldY, 509) % 4,
  };
}

export function chunkId(chunkX: number, chunkY: number): string {
  return `${chunkX}:${chunkY}`;
}

export function worldToChunk(worldPixel: number): number {
  return Math.floor(worldPixel / CHUNK_SIZE);
}

export function generateChunk(seed: string, chunkX: number, chunkY: number): GeneratedChunk {
  const tiles: GeneratedTile[] = [];
  const startX = chunkX * CHUNK_TILES;
  const startY = chunkY * CHUNK_TILES;

  for (let localY = 0; localY < CHUNK_TILES; localY += 1) {
    for (let localX = 0; localX < CHUNK_TILES; localX += 1) {
      tiles.push(sampleTile(seed, startX + localX, startY + localY));
    }
  }

  return {
    id: chunkId(chunkX, chunkY),
    version: WORLD_GENERATOR_VERSION,
    seed,
    chunkX,
    chunkY,
    tiles,
  };
}

export function generateChunkProps(
  seed: string,
  chunkX: number,
  chunkY: number,
): GeneratedAmbientProp[] {
  const numericSeed = hashString(seed);
  const cellSize = 128;
  const cellsPerChunk = CHUNK_SIZE / cellSize;
  const props: GeneratedAmbientProp[] = [];

  for (let localCellY = 0; localCellY < cellsPerChunk; localCellY += 1) {
    for (let localCellX = 0; localCellX < cellsPerChunk; localCellX += 1) {
      const globalCellX = chunkX * cellsPerChunk + localCellX;
      const globalCellY = chunkY * cellsPerChunk + localCellY;
      const centerX = chunkX * CHUNK_SIZE + localCellX * cellSize + cellSize / 2;
      const centerY = chunkY * CHUNK_SIZE + localCellY * cellSize + cellSize / 2;
      const x = centerX + (randomAt(numericSeed, globalCellX, globalCellY, 701) - 0.5) * 76;
      const y = centerY + (randomAt(numericSeed, globalCellX, globalCellY, 709) - 0.5) * 76;
      if (Math.hypot(x, y) < STARTING_TOWN_RADIUS + 80) {
        continue;
      }
      const tile = sampleTile(seed, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
      const grassChance = {
        grassland: 0.48,
        forest: 0.58,
        desert: 0.12,
        tundra: 0.18,
        badlands: 0.09,
        wasteland: 0.14,
      }[tile.biome];
      const rockChance = {
        grassland: 0.1,
        forest: 0.08,
        desert: 0.16,
        tundra: 0.17,
        badlands: 0.24,
        wasteland: 0.2,
      }[tile.biome];
      const roll = randomAt(numericSeed, globalCellX, globalCellY, 719);
      const kind: AmbientPropKind | null = roll < rockChance
        ? "rock"
        : roll < rockChance + grassChance ? "grass" : null;
      if (!kind) {
        continue;
      }
      props.push({
        id: `${chunkId(chunkX, chunkY)}:prop:${localCellX}:${localCellY}`,
        kind,
        variant: hash2D(numericSeed, globalCellX, globalCellY, 727) % 10,
        x,
        y,
        scale: 0.72 + randomAt(numericSeed, globalCellX, globalCellY, 733) * 0.38,
        flipX: randomAt(numericSeed, globalCellX, globalCellY, 739) > 0.5,
      });
    }
  }

  return props;
}

export function generateChunkResources(
  seed: string,
  chunkX: number,
  chunkY: number,
): GeneratedResourceNode[] {
  const numericSeed = hashString(seed);
  const cellSize = 256;
  const cellsPerChunk = CHUNK_SIZE / cellSize;
  const resources: GeneratedResourceNode[] = [];

  for (let localCellY = 0; localCellY < cellsPerChunk; localCellY += 1) {
    for (let localCellX = 0; localCellX < cellsPerChunk; localCellX += 1) {
      const globalCellX = chunkX * cellsPerChunk + localCellX;
      const globalCellY = chunkY * cellsPerChunk + localCellY;
      const centerX = chunkX * CHUNK_SIZE + localCellX * cellSize + cellSize / 2;
      const centerY = chunkY * CHUNK_SIZE + localCellY * cellSize + cellSize / 2;
      const x = centerX + (randomAt(numericSeed, globalCellX, globalCellY, 811) - 0.5) * 132;
      const y = centerY + (randomAt(numericSeed, globalCellX, globalCellY, 821) - 0.5) * 132;
      if (Math.hypot(x, y) < STARTING_TOWN_RADIUS + 80) {
        continue;
      }
      const tile = sampleTile(seed, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
      const treeChance = {
        grassland: 0.38,
        forest: 0.72,
        desert: 0.04,
        tundra: 0.1,
        badlands: 0.03,
        wasteland: 0.07,
      }[tile.biome];
      const stoneChance = {
        grassland: 0.18,
        forest: 0.12,
        desert: 0.32,
        tundra: 0.28,
        badlands: 0.4,
        wasteland: 0.34,
      }[tile.biome];
      const roll = randomAt(numericSeed, globalCellX, globalCellY, 827);
      const kind: GeneratedResourceKind | null = roll < treeChance
        ? "tree"
        : roll < treeChance + stoneChance ? "stone" : null;
      if (!kind) {
        continue;
      }
      resources.push({
        id: `${chunkId(chunkX, chunkY)}:resource:${localCellX}:${localCellY}`,
        kind,
        variant: hash2D(numericSeed, globalCellX, globalCellY, 839) % 3,
        x,
        y,
      });
    }
  }

  return resources;
}
