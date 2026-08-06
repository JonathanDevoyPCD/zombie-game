import { BIOME_IDS, STARTING_TOWN_RADIUS } from "@last-survivor/content";
import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  CHUNK_TILES,
  HOUSE_VARIANT_COUNTS,
  generateChunk,
  generateChunkBuildings,
  generateChunkProps,
  generateChunkResources,
  generateSettlementRegionBuildings,
  generatedBuildingFromInteriorSpace,
  resolveGeneratedBuilding,
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

  it("keeps ambient props out of Hearthwick", () => {
    const props = [-1, 0, 1].flatMap((chunkX) => (
      [-1, 0, 1].flatMap((chunkY) => generateChunkProps("town-clearance", chunkX, chunkY))
    ));
    expect(props.every((prop) => Math.hypot(prop.x, prop.y) >= STARTING_TOWN_RADIUS + 80))
      .toBe(true);
  });

  it("generates deterministic harvestable resources outside the starting camp", () => {
    const first = generateChunkResources("resource-seed", 1, 0);
    expect(generateChunkResources("resource-seed", 1, 0)).toEqual(first);
    expect(first.every((resource) => (
      Math.hypot(resource.x, resource.y) >= STARTING_TOWN_RADIUS + 80
    ))).toBe(true);
    expect(first.every((resource) => resource.variant >= 0 && resource.variant < 3)).toBe(true);
  });

  it("generates stable medieval settlements with biome-safe house variants", () => {
    const first = generateSettlementRegionBuildings("settlement-seed", 2, -1);
    expect(generateSettlementRegionBuildings("settlement-seed", 2, -1)).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
    expect(new Set(first.map((building) => building.id)).size).toBe(first.length);
    first.forEach((building) => {
      expect(building.spriteVariant).toBeGreaterThanOrEqual(0);
      expect(building.spriteVariant).toBeLessThan(HOUSE_VARIANT_COUNTS[building.spriteBiome]);
      expect(building.name).not.toMatch(/radio|hospital|bunker/i);
    });
  });

  it("keeps generated settlements outside the starting town", () => {
    const buildings = [-1, 0, 1].flatMap((regionX) => (
      [-1, 0, 1].flatMap((regionY) => (
        generateSettlementRegionBuildings("town-clearance", regionX, regionY)
      ))
    ));
    expect(buildings.every((building) => (
      Math.hypot(building.x, building.y) >= STARTING_TOWN_RADIUS + 350
    ))).toBe(true);
  });

  it("returns each generated dwelling only from its owning chunk", () => {
    const buildings = generateChunkBuildings("settlement-seed", 5, -2);
    buildings.forEach((building) => {
      expect(building.x).toBeGreaterThanOrEqual(5 * CHUNK_SIZE);
      expect(building.x).toBeLessThan(6 * CHUNK_SIZE);
      expect(building.y).toBeGreaterThanOrEqual(-2 * CHUNK_SIZE);
      expect(building.y).toBeLessThan(-1 * CHUNK_SIZE);
    });
  });

  it("reconstructs generated interiors from their stable multiplayer space ID", () => {
    const placement = generateSettlementRegionBuildings("interior-seed", -1, 2)[0];
    expect(placement).toBeDefined();
    const resolved = resolveGeneratedBuilding(placement!);
    expect(generatedBuildingFromInteriorSpace("interior-seed", resolved.interior.spaceId))
      .toEqual(resolved);
  });
});
