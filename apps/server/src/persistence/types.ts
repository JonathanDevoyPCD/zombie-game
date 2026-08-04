export const PERSISTENCE_SCHEMA_VERSION = 3;

export interface PersistedInventory {
  scrap: number;
  parts: number;
  food: number;
  medicine: number;
}

export interface PersistedSurvivor {
  survivorId: string;
  name: string;
  x: number;
  y: number;
  facing: number;
  spaceId: string;
  health: number;
  inventory: PersistedInventory;
  updatedAt: string;
}

export interface PersistedContainer {
  id: string;
  opened: boolean;
  searchedBy: string;
}

export interface PersistedZombie {
  id: string;
  x: number;
  y: number;
  health: number;
  alive: boolean;
  respawnAt: number;
  contributions: Record<string, { damage: number; name: string }>;
}

export interface PersistedWorld {
  worldId: string;
  seed: string;
  survivors: Record<string, PersistedSurvivor>;
  containers: Record<string, PersistedContainer>;
  zombies: Record<string, PersistedZombie>;
  updatedAt: string;
}

export interface PersistenceDocument {
  schemaVersion: typeof PERSISTENCE_SCHEMA_VERSION;
  worlds: Record<string, PersistedWorld>;
}

export interface WorldRepository {
  loadWorld(worldId: string): Promise<PersistedWorld | null>;
  saveWorld(world: PersistedWorld): Promise<void>;
}
