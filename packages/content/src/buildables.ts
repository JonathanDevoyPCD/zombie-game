import type { ItemId } from "./items";
import type { WorldRect } from "./world";

export const BUILD_ORIENTATIONS = ["horizontal", "vertical"] as const;
export type BuildOrientation = (typeof BUILD_ORIENTATIONS)[number];

export const BUILDABLE_IDS = ["wood-wall"] as const;
export type BuildableId = (typeof BUILDABLE_IDS)[number];

export const BUILD_JOINT_OVERLAP_ALLOWANCE = 8;

export interface BuildableDefinition {
  id: BuildableId;
  name: string;
  cost: Readonly<Partial<Record<ItemId, number>>>;
  gridSize: number;
  maximumPlacementRange: number;
  displayLength: number;
  colliderLength: number;
  colliderThickness: number;
}

export const BUILDABLES: Readonly<Record<BuildableId, BuildableDefinition>> = {
  "wood-wall": {
    id: "wood-wall",
    name: "Wooden Wall",
    cost: { wood: 2 },
    gridSize: 16,
    maximumPlacementRange: 180,
    displayLength: 72,
    colliderLength: 68,
    colliderThickness: 12,
  },
};

export function isBuildableId(value: string): value is BuildableId {
  return BUILDABLE_IDS.includes(value as BuildableId);
}

export function isBuildOrientation(value: string): value is BuildOrientation {
  return BUILD_ORIENTATIONS.includes(value as BuildOrientation);
}

export function snapBuildCoordinate(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function buildableCollider(
  definition: BuildableDefinition,
  x: number,
  y: number,
  orientation: BuildOrientation,
): WorldRect {
  const width = orientation === "horizontal"
    ? definition.colliderLength
    : definition.colliderThickness;
  const height = orientation === "horizontal"
    ? definition.colliderThickness
    : definition.colliderLength;
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
  };
}

export function buildableCollidersConflict(
  left: WorldRect,
  right: WorldRect,
  jointOverlapAllowance = BUILD_JOINT_OVERLAP_ALLOWANCE,
): boolean {
  return left.x < right.x + right.width - jointOverlapAllowance
    && left.x + left.width - jointOverlapAllowance > right.x
    && left.y < right.y + right.height - jointOverlapAllowance
    && left.y + left.height - jointOverlapAllowance > right.y;
}
