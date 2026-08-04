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
        inventory: { scrap, parts: 2, food: 1, medicine: 0 },
        updatedAt: "2026-08-04T00:00:00.000Z",
      },
    },
    containers: {},
    zombies: {},
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
    expect(restored?.survivors["survivor-1"]?.inventory.scrap).toBe(19);
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
    const { health: _health, ...versionOneSurvivor } = legacySurvivor;
    const { zombies: _zombies, ...versionOneWorld } = legacy;
    await writeFile(filePath, JSON.stringify({
      schemaVersion: 1,
      worlds: {
        "dev-world": {
          ...versionOneWorld,
          survivors: { "survivor-1": versionOneSurvivor },
        },
      },
    }), "utf8");

    const restored = await repository.loadWorld("dev-world");
    expect(restored?.survivors["survivor-1"]?.inventory.scrap).toBe(14);
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

  it("refuses unknown schema versions instead of overwriting them", async () => {
    const { filePath, repository } = await repositoryFixture();
    await writeFile(filePath, JSON.stringify({ schemaVersion: 99, worlds: {} }), "utf8");

    await expect(repository.loadWorld("dev-world")).rejects.toThrow("Unsupported persistence schema");
  });
});
