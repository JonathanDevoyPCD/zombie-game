import { describe, expect, it } from "vitest";
import {
  calculateSearchProgress,
  integrateMovement,
  integrateMovementWithCollisions,
  integrateVectorWithCollisions,
  normalizeMovement,
  rayCircleHitDistance,
  rayRectHitDistance,
  sanitizeMovementInput,
} from "../src/index";

describe("search timing", () => {
  it("clamps authoritative search progress", () => {
    expect(calculateSearchProgress(900, 1000, 2000)).toBe(0);
    expect(calculateSearchProgress(2000, 1000, 2000)).toBe(0.5);
    expect(calculateSearchProgress(4000, 1000, 2000)).toBe(1);
  });
});

describe("movement simulation", () => {
  it("normalizes diagonal movement", () => {
    const movement = normalizeMovement({
      sequence: 1,
      up: true,
      down: false,
      left: false,
      right: true,
    });

    expect(Math.hypot(movement.x, movement.y)).toBeCloseTo(1);
  });

  it("integrates movement without diagonal speed gain", () => {
    const position = integrateMovement(
      { x: 0, y: 0 },
      { sequence: 1, up: false, down: true, left: false, right: true },
      1 / 30,
      180,
    );

    expect(Math.hypot(position.x, position.y)).toBeCloseTo(6);
  });

  it("rejects malformed input", () => {
    expect(sanitizeMovementInput({ sequence: -1, up: true })).toBeNull();
    expect(sanitizeMovementInput("up")).toBeNull();
  });

  it("blocks movement through solid rectangles", () => {
    const position = integrateMovementWithCollisions(
      { x: 0, y: 0 },
      { sequence: 1, up: false, down: false, left: false, right: true },
      1,
      10,
      { colliders: [{ x: 15, y: -20, width: 40, height: 40 }] },
    );

    expect(position).toEqual({ x: 0, y: 0 });
  });

  it("clamps movement to interior bounds", () => {
    const position = integrateMovementWithCollisions(
      { x: 85, y: 0 },
      { sequence: 1, up: false, down: false, left: false, right: true },
      1,
      10,
      { bounds: { x: -100, y: -100, width: 200, height: 200 }, colliders: [] },
    );

    expect(position.x).toBe(90);
  });

  it("moves AI vectors through the same collision resolver", () => {
    const position = integrateVectorWithCollisions(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      1,
      10,
      { colliders: [{ x: 15, y: -20, width: 40, height: 40 }] },
      70,
    );

    expect(position).toEqual({ x: 0, y: 0 });
  });
});

describe("combat ray tests", () => {
  it("returns the first distance along a ray that intersects a circle", () => {
    expect(rayCircleHitDistance({ x: 0, y: 0 }, 0, { x: 100, y: 0, radius: 10 }, 200))
      .toBeCloseTo(90);
    expect(rayCircleHitDistance({ x: 0, y: 0 }, 0, { x: 100, y: 30, radius: 10 }, 200))
      .toBeNull();
  });

  it("finds walls that block a ray before its target", () => {
    expect(rayRectHitDistance(
      { x: 0, y: 0 },
      0,
      { x: 50, y: -20, width: 20, height: 40 },
      200,
    )).toBeCloseTo(50);
    expect(rayRectHitDistance(
      { x: 0, y: 0 },
      Math.PI,
      { x: 50, y: -20, width: 20, height: 40 },
      200,
    )).toBeNull();
  });
});
