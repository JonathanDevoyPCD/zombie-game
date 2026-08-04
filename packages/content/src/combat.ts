import { OVERWORLD_SPACE_ID, type WorldPoint } from "./world";

export interface ZombieSpawnDefinition {
  id: string;
  name: string;
  position: WorldPoint;
  spaceId: typeof OVERWORLD_SPACE_ID;
  maxHealth: number;
}

export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RESPAWN_INVULNERABILITY_MS = 3000;
export const STARTING_SAFE_ZONE_RADIUS = 115;
export const PISTOL_DAMAGE = 25;
export const PISTOL_RANGE = 420;
export const PISTOL_FIRE_COOLDOWN_MS = 260;
export const ZOMBIE_COLLISION_RADIUS = 12;
export const ZOMBIE_MOVE_SPEED = 72;
export const ZOMBIE_RETURN_SPEED = 58;
export const ZOMBIE_AGGRO_RADIUS = 250;
export const ZOMBIE_DISENGAGE_RADIUS = 340;
export const ZOMBIE_ATTACK_RANGE = 27;
export const ZOMBIE_ATTACK_DAMAGE = 10;
export const ZOMBIE_ATTACK_COOLDOWN_MS = 900;
export const ZOMBIE_RESPAWN_MS = 60_000;
export const ZOMBIE_LOOT_SCRAP = 6;

export const ZOMBIE_SPAWNS: readonly ZombieSpawnDefinition[] = [
  {
    id: "zombie:outskirts:01",
    name: "Drifter",
    position: { x: 490, y: 90 },
    spaceId: OVERWORLD_SPACE_ID,
    maxHealth: 100,
  },
  {
    id: "zombie:outskirts:02",
    name: "Shambler",
    position: { x: 545, y: -95 },
    spaceId: OVERWORLD_SPACE_ID,
    maxHealth: 100,
  },
  {
    id: "zombie:outskirts:03",
    name: "Wanderer",
    position: { x: 585, y: 235 },
    spaceId: OVERWORLD_SPACE_ID,
    maxHealth: 100,
  },
] as const;

export function zombieSpawnById(zombieId: string): ZombieSpawnDefinition | undefined {
  return ZOMBIE_SPAWNS.find((spawn) => spawn.id === zombieId);
}
