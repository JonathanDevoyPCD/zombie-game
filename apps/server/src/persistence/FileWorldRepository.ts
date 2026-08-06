import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  PERSISTENCE_SCHEMA_VERSION,
  type PersistenceDocument,
  type PersistedWorld,
  type WorldRepository,
} from "./types.js";

function emptyDocument(): PersistenceDocument {
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    worlds: {},
  };
}

function cloneWorld(world: PersistedWorld): PersistedWorld {
  return structuredClone(world);
}

function legacyInventorySlots(value: unknown): Array<{ index: number; itemId: string; quantity: number }> {
  const inventory = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (Array.isArray(inventory.slots)) {
    return inventory.slots as Array<{ index: number; itemId: string; quantity: number }>;
  }

  return ["scrap", "parts", "food", "medicine", "water", "wood", "stone"]
    .map((itemId, index) => ({
      index,
      itemId,
      quantity: Math.max(0, Math.floor(Number(inventory[itemId]) || 0)),
    }))
    .filter((slot) => slot.quantity > 0);
}

function migrateLegacyDocument(
  source: Record<string, unknown>,
  sourceVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7,
): PersistenceDocument {
  const legacyWorlds = source.worlds as Record<string, Record<string, unknown>>;
  const worlds = Object.fromEntries(
    Object.entries(legacyWorlds).map(([worldId, legacyWorld]) => {
      const legacySurvivors = legacyWorld.survivors as Record<string, Record<string, unknown>>;
      const survivors = Object.fromEntries(
        Object.entries(legacySurvivors).map(([survivorId, survivor]) => {
          const inventorySlots = legacyInventorySlots(survivor.inventory);
          return [survivorId, {
            ...survivor,
            health: sourceVersion === 1 ? 100 : survivor.health,
            stamina: sourceVersion >= 7 ? survivor.stamina : 100,
            flashlight: sourceVersion >= 7 ? survivor.flashlight === true : false,
            starterKitGranted: sourceVersion >= 6
              ? survivor.starterKitGranted === true
              : sourceVersion === 5
                && inventorySlots.some((slot) => slot.itemId === "wood" && slot.quantity > 0),
            inventory: { slots: inventorySlots },
          }];
        }),
      );
      const legacyZombies = sourceVersion === 1
        ? {}
        : legacyWorld.zombies as Record<string, Record<string, unknown>>;
      const zombies = Object.fromEntries(
        Object.entries(legacyZombies).map(([zombieId, zombie]) => [
          zombieId,
          {
            ...zombie,
            contributions: sourceVersion === 2 ? {} : zombie.contributions,
          },
        ]),
      );
      return [worldId, {
        ...legacyWorld,
        survivors,
        zombies,
        pickups: sourceVersion >= 4 ? legacyWorld.pickups ?? {} : {},
        structures: sourceVersion >= 5 ? legacyWorld.structures ?? {} : {},
        resources: {},
      }];
    }),
  );

  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    worlds,
  } as PersistenceDocument;
}

export class FileWorldRepository implements WorldRepository {
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async loadWorld(worldId: string): Promise<PersistedWorld | null> {
    await this.operationQueue;
    const document = await this.readDocument();
    const world = document.worlds[worldId];
    return world ? cloneWorld(world) : null;
  }

  async saveWorld(world: PersistedWorld): Promise<void> {
    const snapshot = cloneWorld(world);
    const operation = this.operationQueue.then(async () => {
      const document = await this.readDocument();
      document.worlds[snapshot.worldId] = snapshot;
      await this.writeDocument(document);
    });

    this.operationQueue = operation.catch(() => undefined);
    return operation;
  }

  private async readDocument(): Promise<PersistenceDocument> {
    let source: string;
    try {
      source = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return emptyDocument();
      }
      throw error;
    }

    const parsed = JSON.parse(source) as Record<string, unknown>;
    if (
      (
        parsed.schemaVersion === 1
        || parsed.schemaVersion === 2
        || parsed.schemaVersion === 3
        || parsed.schemaVersion === 4
        || parsed.schemaVersion === 5
        || parsed.schemaVersion === 6
        || parsed.schemaVersion === 7
      )
      && parsed.worlds
    ) {
      return migrateLegacyDocument(parsed, parsed.schemaVersion);
    }

    if (parsed.schemaVersion !== PERSISTENCE_SCHEMA_VERSION || !parsed.worlds) {
      throw new Error(
        `Unsupported persistence schema in ${this.filePath}. Expected version ${PERSISTENCE_SCHEMA_VERSION}.`,
      );
    }

    return parsed as unknown as PersistenceDocument;
  }

  private async writeDocument(document: PersistenceDocument): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.filePath);
  }
}
