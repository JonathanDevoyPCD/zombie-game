import { describe, expect, it } from "vitest";
import { BUILDINGS } from "../src/world";
import {
  STARTING_TOWN_PROPS,
  STARTING_TOWN_PROP_COLLIDERS,
  STARTING_TOWN_ROADS,
} from "../src/town";

describe("Hearthwick starting town", () => {
  it("defines a four-direction main crossroads", () => {
    const horizontal = STARTING_TOWN_ROADS.find((road) => road.id === "king-road-east-west");
    const vertical = STARTING_TOWN_ROADS.find((road) => road.id === "king-road-north-south");

    expect(horizontal?.points[0]?.x).toBeLessThan(0);
    expect(horizontal?.points.at(-1)?.x).toBeGreaterThan(0);
    expect(vertical?.points[0]?.y).toBeLessThan(0);
    expect(vertical?.points.at(-1)?.y).toBeGreaterThan(0);
  });

  it("keeps prop IDs unique and provides three water wells", () => {
    expect(new Set(STARTING_TOWN_PROPS.map((prop) => prop.id)).size)
      .toBe(STARTING_TOWN_PROPS.length);
    expect(STARTING_TOWN_PROPS.filter((prop) => prop.interaction?.kind === "draw-water"))
      .toHaveLength(3);
  });

  it("uses narrow ground footprints for physical clipping", () => {
    expect(STARTING_TOWN_PROP_COLLIDERS).toHaveLength(STARTING_TOWN_PROPS.length);
    STARTING_TOWN_PROPS.forEach((prop) => {
      expect(Math.min(prop.collider?.width ?? 0, prop.collider?.height ?? 0))
        .toBeLessThanOrEqual(44);
    });
  });

  it("does not overlap blocking town props with building footprints", () => {
    const overlaps = (
      left: { x: number; y: number; width: number; height: number },
      right: { x: number; y: number; width: number; height: number },
    ): boolean => left.x < right.x + right.width
      && left.x + left.width > right.x
      && left.y < right.y + right.height
      && left.y + left.height > right.y;

    const collisions = BUILDINGS.flatMap((building) => (
      STARTING_TOWN_PROPS.filter((prop) => (
        prop.collider && overlaps(building.exterior.collider, prop.collider)
      )).map((prop) => `${building.id}:${prop.id}`)
    ));
    expect(collisions).toEqual([]);
  });
});
