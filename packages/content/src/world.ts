export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldRect extends WorldPoint {
  width: number;
  height: number;
}

export interface MovementEnvironment {
  bounds?: WorldRect;
  colliders: readonly WorldRect[];
}

export type LootItemId = ItemId;

export type LootBundle = Readonly<Partial<Record<LootItemId, number>>>;

export interface SearchableContainerPrefabDefinition {
  key: string;
  name: string;
  position: WorldPoint;
  collider: WorldRect;
  interactionRadius: number;
  searchDurationMs: number;
  loot: LootBundle;
}

export interface SearchableContainerDefinition {
  id: string;
  buildingInstanceId: string;
  spaceId: string;
  prefabContainerKey: string;
  name: string;
  position: WorldPoint;
  collider: WorldRect;
  interactionRadius: number;
  searchDurationMs: number;
  loot: LootBundle;
}

export interface BuildingPrefabDefinition {
  id: string;
  exterior: {
    displayWidth: number;
    collider: WorldRect;
    entrance: WorldPoint;
    returnPosition: WorldPoint;
    interactionRadius: number;
  };
  interior: {
    bounds: WorldRect;
    entrancePosition: WorldPoint;
    exit: WorldPoint;
    interactionRadius: number;
    containers: readonly SearchableContainerPrefabDefinition[];
  };
}

export interface BuildingInstanceDefinition {
  id: string;
  name: string;
  prefabId: string;
  exteriorPosition: WorldPoint;
  interiorSpaceId: string;
}

export interface ResolvedBuildingDefinition {
  id: string;
  name: string;
  prefabId: string;
  exterior: {
    position: WorldPoint;
    displayWidth: number;
    collider: WorldRect;
    entrance: WorldPoint;
    returnPosition: WorldPoint;
    interactionRadius: number;
  };
  interior: {
    spaceId: string;
    bounds: WorldRect;
    entrancePosition: WorldPoint;
    exit: WorldPoint;
    interactionRadius: number;
    containers: readonly SearchableContainerDefinition[];
  };
}

export const OVERWORLD_SPACE_ID = "overworld";
export const PLAYER_COLLISION_RADIUS = 10;
export const SUMMER_HOUSE_PREFAB_ID = "building-prefab:summer-house";
export const HOUSE_48_INTERIOR_SPACE_ID = "interior:house:48";
export const HOUSE_73_INTERIOR_SPACE_ID = "interior:house:73";

const SUMMER_HOUSE_CONTAINER_PREFABS: readonly SearchableContainerPrefabDefinition[] = [
  {
    key: "desk:01",
    name: "Writing desk",
    position: { x: 0, y: -38 },
    collider: { x: -34, y: -55, width: 68, height: 34 },
    interactionRadius: 42,
    searchDurationMs: 2400,
    loot: { scrap: 7, parts: 1 },
  },
  {
    key: "cupboard:01",
    name: "Kitchen cupboard",
    position: { x: 111, y: -98 },
    collider: { x: 78, y: -112, width: 66, height: 28 },
    interactionRadius: 42,
    searchDurationMs: 3200,
    loot: { food: 2, medicine: 1 },
  },
  {
    key: "chest:01",
    name: "Supply chest",
    position: { x: -126, y: -72 },
    collider: { x: -151, y: -89, width: 50, height: 30 },
    interactionRadius: 42,
    searchDurationMs: 4500,
    loot: { scrap: 12, parts: 3, medicine: 1 },
  },
] as const;

export const SUMMER_HOUSE_PREFAB: BuildingPrefabDefinition = {
  id: SUMMER_HOUSE_PREFAB_ID,
  exterior: {
    displayWidth: 170,
    collider: { x: -62, y: -190, width: 124, height: 185 },
    entrance: { x: 0, y: 22 },
    returnPosition: { x: 0, y: 36 },
    interactionRadius: 42,
  },
  interior: {
    bounds: { x: -224, y: -144, width: 448, height: 288 },
    entrancePosition: { x: 0, y: 112 },
    exit: { x: 0, y: 132 },
    interactionRadius: 38,
    containers: SUMMER_HOUSE_CONTAINER_PREFABS,
  },
};

export const BUILDING_PREFABS: Readonly<Record<string, BuildingPrefabDefinition>> = {
  [SUMMER_HOUSE_PREFAB.id]: SUMMER_HOUSE_PREFAB,
};

export const BUILDING_INSTANCES: readonly BuildingInstanceDefinition[] = [
  {
    id: "house:48",
    name: "House 48",
    prefabId: SUMMER_HOUSE_PREFAB_ID,
    exteriorPosition: { x: 300, y: 80 },
    interiorSpaceId: HOUSE_48_INTERIOR_SPACE_ID,
  },
  {
    id: "house:73",
    name: "House 73",
    prefabId: SUMMER_HOUSE_PREFAB_ID,
    exteriorPosition: { x: -360, y: 180 },
    interiorSpaceId: HOUSE_73_INTERIOR_SPACE_ID,
  },
] as const;

function translatePoint(point: WorldPoint, offset: WorldPoint): WorldPoint {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function translateRect(rect: WorldRect, offset: WorldPoint): WorldRect {
  return { ...translatePoint(rect, offset), width: rect.width, height: rect.height };
}

export function resolveBuildingInstance(
  instance: BuildingInstanceDefinition,
): ResolvedBuildingDefinition {
  const prefab = BUILDING_PREFABS[instance.prefabId];
  if (!prefab) {
    throw new Error(`Unknown building prefab: ${instance.prefabId}`);
  }

  const containers = prefab.interior.containers.map((container) => ({
    id: `${instance.id}:${container.key}`,
    buildingInstanceId: instance.id,
    spaceId: instance.interiorSpaceId,
    prefabContainerKey: container.key,
    name: container.name,
    position: { ...container.position },
    collider: { ...container.collider },
    interactionRadius: container.interactionRadius,
    searchDurationMs: container.searchDurationMs,
    loot: container.loot,
  }));

  return {
    id: instance.id,
    name: instance.name,
    prefabId: instance.prefabId,
    exterior: {
      position: { ...instance.exteriorPosition },
      displayWidth: prefab.exterior.displayWidth,
      collider: translateRect(prefab.exterior.collider, instance.exteriorPosition),
      entrance: translatePoint(prefab.exterior.entrance, instance.exteriorPosition),
      returnPosition: translatePoint(prefab.exterior.returnPosition, instance.exteriorPosition),
      interactionRadius: prefab.exterior.interactionRadius,
    },
    interior: {
      spaceId: instance.interiorSpaceId,
      bounds: { ...prefab.interior.bounds },
      entrancePosition: { ...prefab.interior.entrancePosition },
      exit: { ...prefab.interior.exit },
      interactionRadius: prefab.interior.interactionRadius,
      containers,
    },
  };
}

export const BUILDINGS: readonly ResolvedBuildingDefinition[] = BUILDING_INSTANCES.map(
  resolveBuildingInstance,
);

export const ALL_BUILDING_CONTAINERS: readonly SearchableContainerDefinition[] = BUILDINGS.flatMap(
  (building) => building.interior.containers,
);

export function buildingById(buildingId: string): ResolvedBuildingDefinition | undefined {
  return BUILDINGS.find((building) => building.id === buildingId);
}

export function buildingByInteriorSpace(spaceId: string): ResolvedBuildingDefinition | undefined {
  return BUILDINGS.find((building) => building.interior.spaceId === spaceId);
}

export function buildingContainerById(
  containerId: string,
): SearchableContainerDefinition | undefined {
  return ALL_BUILDING_CONTAINERS.find((container) => container.id === containerId);
}

export function movementEnvironmentForSpace(spaceId: string): MovementEnvironment {
  const building = buildingByInteriorSpace(spaceId);
  if (building) {
    return {
      bounds: building.interior.bounds,
      colliders: building.interior.containers.map((container) => container.collider),
    };
  }

  return {
    colliders: BUILDINGS.map((candidate) => candidate.exterior.collider),
  };
}

// Stable aliases keep existing save IDs and downstream integrations compatible.
export const HOUSE_48 = buildingById("house:48")!;
export const HOUSE_48_CHEST_ID = "house:48:chest:01";
export const HOUSE_48_DESK_ID = "house:48:desk:01";
export const HOUSE_48_CUPBOARD_ID = "house:48:cupboard:01";
export const HOUSE_48_INTERIOR_CONTAINERS = HOUSE_48.interior.containers;

export function house48ContainerById(
  containerId: string,
): SearchableContainerDefinition | undefined {
  const container = buildingContainerById(containerId);
  return container?.buildingInstanceId === HOUSE_48.id ? container : undefined;
}
import type { ItemId } from "./items";
