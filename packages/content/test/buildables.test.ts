import { describe, expect, it } from "vitest";
import {
  BUILDABLES,
  buildableCollider,
  buildableCollidersConflict,
  snapBuildCoordinate,
} from "../src/buildables";

describe("buildable definitions", () => {
  it("rotates the wooden wall collider without changing its center", () => {
    const definition = BUILDABLES["wood-wall"];
    expect(buildableCollider(definition, 32, -16, "horizontal")).toEqual({
      x: -2,
      y: -22,
      width: 68,
      height: 12,
    });
    expect(buildableCollider(definition, 32, -16, "vertical")).toEqual({
      x: 26,
      y: -50,
      width: 12,
      height: 68,
    });
  });

  it("snaps placement coordinates to the shared build grid", () => {
    expect(snapBuildCoordinate(39, 16)).toBe(32);
    expect(snapBuildCoordinate(-39, 16)).toBe(-32);
  });

  it("allows wall joints while rejecting duplicate and deeply overlapping walls", () => {
    const definition = BUILDABLES["wood-wall"];
    const horizontal = buildableCollider(definition, 0, 0, "horizontal");

    expect(buildableCollidersConflict(
      horizontal,
      buildableCollider(definition, 64, 0, "horizontal"),
    )).toBe(false);
    expect(buildableCollidersConflict(
      horizontal,
      buildableCollider(definition, 32, 32, "vertical"),
    )).toBe(false);
    expect(buildableCollidersConflict(
      horizontal,
      buildableCollider(definition, 48, 0, "horizontal"),
    )).toBe(true);
    expect(buildableCollidersConflict(horizontal, horizontal)).toBe(true);
  });
});
