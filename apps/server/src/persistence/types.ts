export const PERSISTENCE_SCHEMA_VERSION = 4;

export interface PersistedInventorySlot {
  index: number;
  itemId: string;
  quantity: number;
}

export interface PersistedInventory {
  slots: PersistedInventorySlot[];
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

export interface PersistedWorldPickup {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  spaceId: string;
  droppedBy: string;
}

export interface PersistedWorld {
  worldId: string;
  seed: string;
  survivors: Record<string, PersistedSurvivor>;
  containers: Record<string, PersistedContainer>;
  zombies: Record<string, PersistedZombie>;
  pickups: Record<string, PersistedWorldPickup>;
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
