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
    expect(BUILDINGS).toHaveLength(24);
    expect(buildingByInteriorSpace(HOUSE_73_INTERIOR_SPACE_ID)?.name).toBe("Miller's Cottage");
    expect(ALL_BUILDING_CONTAINERS).toHaveLength(72);
    expect(new Set(ALL_BUILDING_CONTAINERS.map((container) => container.id)).size).toBe(72);
    expect(buildingContainerById("house:73:desk:01")).toMatchObject({
      buildingInstanceId: "house:73",
      spaceId: HOUSE_73_INTERIOR_SPACE_ID,
      prefabContainerKey: "desk:01",
    });
  });

  it("translates exterior geometry while retaining prefab-local interiors", () => {
    const house73 = buildingByInteriorSpace(HOUSE_73_INTERIOR_SPACE_ID);
    expect(house73?.exterior.position).toEqual({ x: 330, y: -180 });
    expect(house73?.exterior.displayWidth).toBe(210);
    expect(house73?.exterior.entrance.x).toBe(330);
    expect(house73?.exterior.entrance.y).toBeCloseTo(-152.82, 2);
    expect(house73?.exterior.collider).toMatchObject({
      x: expect.closeTo(253.41, 2),
      y: expect.closeTo(-414.71, 2),
      width: expect.closeTo(153.18, 2),
      height: expect.closeTo(228.53, 2),
    });
    expect(house73?.interior.entrancePosition).toEqual(HOUSE_48.interior.entrancePosition);
  });

  it("builds collision environments for every exterior and interior instance", () => {
    expect(movementEnvironmentForSpace(OVERWORLD_SPACE_ID).colliders).toHaveLength(24);
    expect(movementEnvironmentForSpace(HOUSE_48_INTERIOR_SPACE_ID).colliders).toHaveLength(3);
    expect(movementEnvironmentForSpace(HOUSE_73_INTERIOR_SPACE_ID).colliders).toHaveLength(3);
  });
});
