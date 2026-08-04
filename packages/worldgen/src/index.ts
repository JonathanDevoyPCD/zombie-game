import type { BiomeId } from "@last-survivor/content";

export const WORLD_GENERATOR_VERSION = 1;
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

