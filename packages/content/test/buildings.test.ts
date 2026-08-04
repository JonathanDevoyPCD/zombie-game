import { describe, expect, it } from "vitest";
import {
  ALL_BUILDING_CONTAINERS,
  BUILDINGS,
  HOUSE_48,
  HOUSE_48_CHEST_ID,
  HOUSE_48_CUPBOARD_ID,
  HOUSE_48_DESK_ID,
  HOUSE_48_INTERIOR_SPACE_ID,
  HOUSE_73_INTERIOR_SPACE_ID,
  OVERWORLD_SPACE_ID,
  buildingByInteriorSpace,
  buildingContainerById,
  movementEnvironmentForSpace,
} from "../src/world";

describe("building prefab instances", () => {
  it("preserves the established House 48 save identifiers", () => {
    expect(HOUSE_48.interior.spaceId).toBe(HOUSE_48_INTERIOR_SPACE_ID);
    expect(HOUSE_48.interior.containers.map((container) => container.id)).toEqual([
      HOUSE_48_DESK_ID,
      HOUSE_48_CUPBOARD_ID,
      HOUSE_48_CHEST_ID,
    ]);
  });

  it("creates isolated spaces and containers for each prefab instance", () => {
    expect(BUILDINGS).toHaveLength(2);
    expect(buildingByInteriorSpace(HOUSE_73_INTERIOR_SPACE_ID)?.name).toBe("House 73");
    expect(ALL_BUILDING_CONTAINERS).toHaveLength(6);
    expect(new Set(ALL_BUILDING_CONTAINERS.map((container) => container.id)).size).toBe(6);
    expect(buildingContainerById("house:73:desk:01")).toMatchObject({
      buildingInstanceId: "house:73",
      spaceId: HOUSE_73_INTERIOR_SPACE_ID,
      prefabContainerKey: "desk:01",
    });
  });

  it("translates exterior geometry while retaining prefab-local interiors", () => {
    const house73 = buildingByInteriorSpace(HOUSE_73_INTERIOR_SPACE_ID);
    expect(house73?.exterior.position).toEqual({ x: -360, y: 180 });
    expect(house73?.exterior.entrance).toEqual({ x: -360, y: 202 });
    expect(house73?.exterior.collider).toEqual({ x: -422, y: -10, width: 124, height: 185 });
    expect(house73?.interior.entrancePosition).toEqual(HOUSE_48.interior.entrancePosition);
  });

  it("builds collision environments for every exterior and interior instance", () => {
    expect(movementEnvironmentForSpace(OVERWORLD_SPACE_ID).colliders).toHaveLength(2);
    expect(movementEnvironmentForSpace(HOUSE_48_INTERIOR_SPACE_ID).colliders).toHaveLength(3);
    expect(movementEnvironmentForSpace(HOUSE_73_INTERIOR_SPACE_ID).colliders).toHaveLength(3);
  });
});
