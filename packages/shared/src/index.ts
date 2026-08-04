export const WORLD_ROOM = "world";
export const MAX_PLAYERS = 4;
export const SIMULATION_HZ = 60;
export const INPUT_STEP_SECONDS = 1 / SIMULATION_HZ;
export const NETWORK_PATCH_MS = 1000 / SIMULATION_HZ;

export const ClientMessage = {
  INPUT: "input",
  INTERACT: "interact",
  FIRE: "fire",
} as const;

export const ServerMessage = {
  COMBAT_EVENT: "combat-event",
} as const;

export interface MovementInput {
  sequence: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface FireWeaponInput {
  sequence: number;
  angle: number;
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
