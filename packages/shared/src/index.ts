export const WORLD_ROOM = "world";
export const MAX_PLAYERS = 4;
export const SIMULATION_HZ = 60;
export const INPUT_STEP_SECONDS = 1 / SIMULATION_HZ;
export const NETWORK_PATCH_MS = 1000 / SIMULATION_HZ;

export const ClientMessage = {
  INPUT: "input",
  INTERACT: "interact",
  FIRE: "fire",
  INVENTORY_MOVE: "inventory-move",
  INVENTORY_DROP: "inventory-drop",
  BUILD_PLACE: "build-place",
  FLASHLIGHT_TOGGLE: "flashlight-toggle",
} as const;

export const ServerMessage = {
  COMBAT_EVENT: "combat-event",
  INVENTORY_EVENT: "inventory-event",
  BUILD_EVENT: "build-event",
} as const;

export interface MovementInput {
  sequence: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface FireWeaponInput {
  sequence: number;
  angle: number;
}

export interface InventoryMoveInput {
  operationId: string;
  fromIndex: number;
  toIndex: number;
  quantity?: number;
}

export interface InventoryDropInput {
  operationId: string;
  slotIndex: number;
  quantity?: number;
}

export interface BuildPlaceInput {
  operationId: string;
  buildableId: string;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
}

export interface JoinWorldOptions {
  worldId: string;
  survivorId: string;
  playerName?: string;
}

export interface PlayerSnapshot {
  id: string;
  survivorId: string;
  name: string;
  x: number;
  y: number;
  facing: number;
  spaceId: string;
  activeSearchId: string;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  sprinting: boolean;
  flashlight: boolean;
  inventory: InventorySnapshot;
  lastProcessedInput: number;
}

export interface ZombieSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  spaceId: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  aggroTarget: string;
  respawnAt: number;
}

export type CombatEventKind = "shot" | "zombie-killed" | "player-hit" | "player-respawned";

export interface CombatEvent {
  kind: CombatEventKind;
  actorId: string;
  targetId: string;
  originX: number;
  originY: number;
  targetX: number;
  targetY: number;
  amount: number;
  message: string;
}

export interface InventorySnapshot {
  scrap: number;
  parts: number;
  food: number;
  medicine: number;
  water: number;
  wood: number;
  stone: number;
  capacity: number;
  slots: InventorySlotSnapshot[];
}

export interface InventorySlotSnapshot {
  index: number;
  itemId: string;
  quantity: number;
}

export interface InventoryEvent {
  kind: "success" | "error";
  message: string;
}

export interface BuildEvent {
  kind: "success" | "error";
  message: string;
  structureId: string;
}

export interface PlacedStructureSnapshot {
  id: string;
  buildableId: string;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  placedBy: string;
}

export interface WorldPickupSnapshot {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  spaceId: string;
  droppedBy: string;
}

export interface ResourceNodeSnapshot {
  id: string;
  kind: "tree" | "stone";
  variant: number;
  x: number;
  y: number;
  available: boolean;
  respawnAt: number;
  harvestingBy: string;
  harvestingByName: string;
  harvestProgress: number;
}

export interface ContainerSnapshot {
  id: string;
  spaceId: string;
  opened: boolean;
  searchedBy: string;
  searchingBy: string;
  searchingByName: string;
  searchStartedAt: number;
  searchDurationMs: number;
  searchProgress: number;
}
