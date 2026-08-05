import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileWorldRepository } from "../src/persistence/FileWorldRepository";
import type { PersistedWorld } from "../src/persistence/types";

const temporaryDirectories: string[] = [];

async function repositoryFixture(): Promise<{
  directory: string;
  filePath: string;
  repository: FileWorldRepository;
}> {
  const directory = await mkdtemp(join(tmpdir(), "last-survivor-persistence-"));
  temporaryDirectories.push(directory);
  const filePath = join(directory, "worlds.json");
  return {
    directory,
    filePath,
    repository: new FileWorldRepository(filePath),
  };
}

function worldFixture(worldId: string, scrap: number): PersistedWorld {
  return {
    worldId,
    seed: `seed:${worldId}`,
    survivors: {
      "survivor-1": {
        survivorId: "survivor-1",
        name: "Test Survivor",
        x: 120,
        y: -45,
        facing: 0,
        spaceId: "overworld",
        health: 100,
        stamina: 100,
        flashlight: false,
        starterKitGranted: true,
        inventory: {
          slots: [
            { index: 0, itemId: "scrap", quantity: scrap },
            { index: 1, itemId: "parts", quantity: 2 },
            { index: 2, itemId: "food", quantity: 1 },
          ],
        },
        updatedAt: "2026-08-04T00:00:00.000Z",
      },
    },
    containers: {},
    zombies: {},
    pickups: {},
    structures: {},
    resources: {},
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("FileWorldRepository", () => {
  it("round-trips and overwrites a world atomically", async () => {
    const { repository } = await repositoryFixture();
    await repository.saveWorld(worldFixture("dev-world", 7));
    await repository.saveWorld(worldFixture("dev-world", 19));

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.survivors["survivor-1"]?.inventory.slots[0]?.quantity).toBe(19);
  });

  it("serializes concurrent writes without losing separate worlds", async () => {
    const { repository } = await repositoryFixture();
    await Promise.all([
      repository.saveWorld(worldFixture("world-a", 3)),
      repository.saveWorld(worldFixture("world-b", 8)),
    ]);

    expect((await repository.loadWorld("world-a"))?.seed).toBe("seed:world-a");
    expect((await repository.loadWorld("world-b"))?.seed).toBe("seed:world-b");
  });

  it("migrates version-one worlds without losing survivor data", async () => {
    const { filePath, repository } = await repositoryFixture();
    const legacy = worldFixture("dev-world", 14);
    const legacySurvivor = legacy.survivors["survivor-1"];
    if (!legacySurvivor) {
      throw new Error("Missing survivor fixture");
    }
    const {
      health: _health,
      stamina: _stamina,
      flashlight: _flashlight,
      starterKitGranted: _starterKitGranted,
      inventory: _inventory,
      ...versionOneSurvivor
    } = legacySurvivor;
    const { zombies: _zombies, ...versionOneWorld } = legacy;
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 1,
      worlds: {
        "dev-world": {
          ...versionOneWorld,
          survivors: {
            "survivor-1": {
              ...versionOneSurvivor,
              inventory: { scrap: 14, parts: 2, food: 1, medicine: 0 },
            },
          },
        },
      },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.survivors["survivor-1"]?.inventory.slots[0]).toMatchObject({
      itemId: "scrap",
      quantity: 14,
    });
    expect(restored?.survivors["survivor-1"]?.health).toBe(100);
    expect(restored?.zombies).toEqual({});
  });

  it("migrates version-two zombie records with empty contribution ledgers", async () => {
    const { filePath, repository } = await repositoryFixture();
    const versionTwoWorld = worldFixture("dev-world", 5);
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 2,
      worlds: {
        "dev-world": {
          ...versionTwoWorld,
          zombies: {
            "zombie:01": {
              id: "zombie:01",
              x: 10,
              y: 20,
              health: 50,
              alive: true,
              respawnAt: 0,
            },
          },
        },
      },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.zombies["zombie:01"]?.contributions).toEqual({});
  });

  it("migrates version-three resource counters into inventory slots", async () => {
    const { filePath, repository } = await repositoryFixture();
    const legacy = worldFixture("dev-world", 0);
    const survivor = legacy.survivors["survivor-1"];
    if (!survivor) {
      throw new Error("Missing survivor fixture");
    }
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 3,
      worlds: {
        "dev-world": {
          ...legacy,
          survivors: {
            "survivor-1": {
              ...survivor,
              inventory: { scrap: 23, parts: 4, food: 2, medicine: 1 },
            },
          },
        },
      },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.survivors["survivor-1"]?.inventory.slots).toEqual([
      { index: 0, itemId: "scrap", quantity: 23 },
      { index: 1, itemId: "parts", quantity: 4 },
      { index: 2, itemId: "food", quantity: 2 },
      { index: 3, itemId: "medicine", quantity: 1 },
    ]);
    expect(restored?.pickups).toEqual({});
  });

  it("migrates version-four worlds while preserving pickups", async () => {
    const { filePath, repository } = await repositoryFixture();
    const versionFourWorld = worldFixture("dev-world", 5);
    versionFourWorld.pickups["pickup:01"] = {
      id: "pickup:01",
      itemId: "wood",
      quantity: 3,
      x: 12,
      y: 24,
      spaceId: "overworld",
      droppedBy: "Test Survivor",
    };
    const { structures: _structures, ...legacyWorld } = versionFourWorld;
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 4,
      worlds: { "dev-world": legacyWorld },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.pickups["pickup:01"]?.quantity).toBe(3);
    expect(restored?.structures).toEqual({});
    expect(restored?.survivors["survivor-1"]?.starterKitGranted).toBe(false);
  });

  it("migrates version-five worlds while preserving structures and starter grants", async () => {
    const { filePath, repository } = await repositoryFixture();
    const versionFiveWorld = worldFixture("dev-world", 5);
    versionFiveWorld.structures["structure:01"] = {
      id: "structure:01",
      buildableId: "wood-wall",
      x: 128,
      y: 64,
      orientation: "horizontal",
      placedBy: "Test Survivor",
    };
    const survivor = versionFiveWorld.survivors["survivor-1"];
    if (!survivor) {
      throw new Error("Missing survivor fixture");
    }
    const { starterKitGranted: _starterKitGranted, ...legacySurvivor } = survivor;
    legacySurvivor.inventory.slots.push({ index: 3, itemId: "wood", quantity: 8 });
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 5,
      worlds: {
        "dev-world": {
          ...versionFiveWorld,
          survivors: { "survivor-1": legacySurvivor },
        },
      },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.structures["structure:01"]?.orientation).toBe("horizontal");
    expect(restored?.survivors["survivor-1"]?.starterKitGranted).toBe(true);
  });

  it("migrates version-seven survivor controls and initializes resource persistence", async () => {
    const { filePath, repository } = await repositoryFixture();
    const versionSevenWorld = worldFixture("dev-world", 5);
    const { resources: _resources, ...legacyWorld } = versionSevenWorld;
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 7,
      worlds: { "dev-world": legacyWorld },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.survivors["survivor-1"]).toMatchObject({
      stamina: 100,
      flashlight: false,
      starterKitGranted: true,
    });
    expect(restored?.resources).toEqual({});
  });

  it("refuses unknown schema versions instead of overwriting them", async () => {
    const { filePath, repository } = await repositoryFixture();
    await writeFile(filePath, JSON.stringify({ schemaVersion: 99, worlds: {} }), "utf8");

    await expect(repository.loadWorld("dev-world")).rejects.toThrow("Unsupported persistence schema");
  });
});
