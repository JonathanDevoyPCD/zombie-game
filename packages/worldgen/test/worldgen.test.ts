import { BIOME_IDS } from "@last-survivor/content";
import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  CHUNK_TILES,
  generateChunk,
  generateChunkProps,
  generateChunkResources,
  sampleTile,
  worldToChunk,
} from "../src/index";

describe("BiomeGen", () => {
  it("generates identical chunks for the same seed and coordinates", () => {
    expect(generateChunk("alpha", 4, -3)).toEqual(generateChunk("alpha", 4, -3));
  });

  it("changes the world when the seed changes", () => {
    expect(generateChunk("alpha", 1, 1).tiles).not.toEqual(generateChunk("bravo", 1, 1).tiles);
  });

  it("samples neighboring chunks in continuous global coordinates", () => {
    const left = generateChunk("edge-test", 0, 0);
    const right = generateChunk("edge-test", 1, 0);
    const leftEdge = left.tiles[CHUNK_TILES - 1];
    const rightEdge = right.tiles[0];

    expect(leftEdge).toEqual(sampleTile("edge-test", CHUNK_TILES - 1, 0));
    expect(rightEdge).toEqual(sampleTile("edge-test", CHUNK_TILES, 0));
    expect(rightEdge?.worldX).toBe((leftEdge?.worldX ?? 0) + 1);
  });

  it("only emits registered biomes", () => {
    const biomes = generateChunk("biomes", -2, 7).tiles.map((tile) => tile.biome);
    expect(biomes.every((biome) => BIOME_IDS.includes(biome))).toBe(true);
  });

  it("uses floor division for negative world coordinates", () => {
    expect(worldToChunk(-1)).toBe(-1);
  });

  it("places deterministic ambient props inside their chunk", () => {
    const first = generateChunkProps("prop-seed", -2, 3);
    expect(generateChunkProps("prop-seed", -2, 3)).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    first.forEach((prop) => {
      expect(prop.x).toBeGreaterThanOrEqual(-2 * CHUNK_SIZE);
      expect(prop.x).toBeLessThan(-1 * CHUNK_SIZE);
      expect(prop.y).toBeGreaterThanOrEqual(3 * CHUNK_SIZE);
      expect(prop.y).toBeLessThan(4 * CHUNK_SIZE);
      expect(prop.variant).toBeGreaterThanOrEqual(0);
      expect(prop.variant).toBeLessThan(10);
    });
  });

  it("generates deterministic harvestable resources outside the starting camp", () => {
    const first = generateChunkResources("resource-seed", 1, 0);
    expect(generateChunkResources("resource-seed", 1, 0)).toEqual(first);
    expect(first.every((resource) => Math.hypot(resource.x, resource.y) >= 230)).toBe(true);
    expect(first.every((resource) => resource.variant >= 0 && resource.variant < 3)).toBe(true);
  });
});
