import {
  ClientMessage,
  MAX_PLAYERS,
  NETWORK_PATCH_MS,
  ServerMessage,
  SIMULATION_HZ,
  type CombatEvent,
  type FireWeaponInput,
  type JoinWorldOptions,
  type MovementInput,
} from "@last-survivor/shared";
import {
  ALL_BUILDING_CONTAINERS,
  BUILDINGS,
  OVERWORLD_SPACE_ID,
  PLAYER_COLLISION_RADIUS,
  buildingByInteriorSpace,
  buildingContainerById,
  movementEnvironmentForSpace,
  type LootItemId,
  type SearchableContainerDefinition,
  PISTOL_DAMAGE,
  PISTOL_FIRE_COOLDOWN_MS,
  PISTOL_RANGE,
  PLAYER_MAX_HEALTH,
  PLAYER_RESPAWN_INVULNERABILITY_MS,
  STARTING_SAFE_ZONE_RADIUS,
  ZOMBIE_AGGRO_RADIUS,
  ZOMBIE_ATTACK_COOLDOWN_MS,
  ZOMBIE_ATTACK_DAMAGE,
  ZOMBIE_ATTACK_RANGE,
  ZOMBIE_COLLISION_RADIUS,
  ZOMBIE_DISENGAGE_RADIUS,
  ZOMBIE_LOOT_SCRAP,
  ZOMBIE_MOVE_SPEED,
  ZOMBIE_RESPAWN_MS,
  ZOMBIE_RETURN_SPEED,
  ZOMBIE_SPAWNS,
  zombieSpawnById,
} from "@last-survivor/content";
import {
  calculateSearchProgress,
  integrateMovementWithCollisions,
  integrateVectorWithCollisions,
  rayCircleHitDistance,
  rayRectHitDistance,
  sanitizeMovementInput,
} from "@last-survivor/simulation";
import { type Client, Room, ServerError } from "@colyseus/core";
import { worldRepository } from "../persistence/defaultRepository.js";
import type {
  PersistedInventory,
  PersistedSurvivor,
  PersistedWorld,
} from "../persistence/types.js";
import { ContainerState } from "./schema/ContainerState.js";
import { PlayerState } from "./schema/PlayerState.js";
import { WorldState } from "./schema/WorldState.js";
import { ZombieState } from "./schema/ZombieState.js";

function cleanIdentifier(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return cleaned || fallback;
}

function distanceBetween(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function cleanSurvivorId(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned || fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function inventoryCount(value: unknown): number {
  return Math.max(0, Math.floor(finiteNumber(value, 0)));
}

function sanitizeFireInput(value: unknown): FireWeaponInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<FireWeaponInput>;
  if (!Number.isSafeInteger(candidate.sequence) || Number(candidate.sequence) < 0) {
    return null;
  }
  if (typeof candidate.angle !== "number" || !Number.isFinite(candidate.angle)) {
    return null;
  }

  return { sequence: Number(candidate.sequence), angle: candidate.angle };
}

const CHECKPOINT_INTERVAL_MS = 5000;

export class WorldRoom extends Room<{ state: WorldState }> {
  state = new WorldState();
  private readonly inputQueues = new Map<string, MovementInput[]>();
  private readonly simulationBudgets = new Map<string, number>();
  private readonly lastInteractionAt = new Map<string, number>();
  private readonly lastFireAt = new Map<string, number>();
  private readonly lastFireSequence = new Map<string, number>();
  private readonly lastZombieAttackAt = new Map<string, number>();
  private readonly playerInvulnerableUntil = new Map<string, number>();
  private readonly damageLedgers = new Map<string, Map<string, { damage: number; name: string }>>();
  private readonly persistedSurvivors = new Map<string, PersistedSurvivor>();
  private persistenceDirty = false;
  private persistenceQueue: Promise<void> = Promise.resolve();

  async onCreate(options: Partial<JoinWorldOptions>): Promise<void> {
    this.maxClients = MAX_PLAYERS;
    this.patchRate = NETWORK_PATCH_MS;
    this.state.worldId = cleanIdentifier(options.worldId, "dev-world");
    this.state.seed = `last-survivor:${this.state.worldId}:v1`;

    const persistedWorld = await worldRepository.loadWorld(this.state.worldId);
    if (persistedWorld) {
      this.state.seed = persistedWorld.seed;
      Object.values(persistedWorld.survivors).forEach((survivor) => {
        this.persistedSurvivors.set(survivor.survivorId, survivor);
      });
    }

    ALL_BUILDING_CONTAINERS.forEach((definition) => {
      const container = new ContainerState();
      container.id = definition.id;
      container.spaceId = definition.spaceId;
      container.searchDurationMs = definition.searchDurationMs;
      const persistedContainer = persistedWorld?.containers[definition.id];
      if (persistedContainer) {
        container.opened = persistedContainer.opened;
        container.searchedBy = persistedContainer.searchedBy;
      }
      this.state.containers.set(container.id, container);
    });

    ZOMBIE_SPAWNS.forEach((spawn) => {
      const zombie = new ZombieState();
      zombie.id = spawn.id;
      zombie.name = spawn.name;
      zombie.x = spawn.position.x;
      zombie.y = spawn.position.y;
      zombie.spaceId = spawn.spaceId;
      zombie.health = spawn.maxHealth;
      zombie.maxHealth = spawn.maxHealth;
      const persistedZombie = persistedWorld?.zombies[spawn.id];
      if (persistedZombie) {
        zombie.x = finiteNumber(persistedZombie.x, zombie.x);
        zombie.y = finiteNumber(persistedZombie.y, zombie.y);
        zombie.health = Math.max(0, Math.min(zombie.maxHealth, inventoryCount(persistedZombie.health)));
        zombie.alive = persistedZombie.alive && zombie.health > 0;
        zombie.respawnAt = finiteNumber(persistedZombie.respawnAt, 0);
        this.damageLedgers.set(
          zombie.id,
          new Map(Object.entries(persistedZombie.contributions)),
        );
      }
      this.state.zombies.set(zombie.id, zombie);
    });

    this.onMessage(ClientMessage.INPUT, (client, payload: unknown) => {
      const nextInput = sanitizeMovementInput(payload);
      const player = this.state.players.get(client.sessionId);
      const queue = this.inputQueues.get(client.sessionId);

      if (!nextInput || !player || !queue || queue.length >= 120) {
        return;
      }

      const lastSequence = queue.at(-1)?.sequence ?? player.lastProcessedInput;
      if (nextInput.sequence > lastSequence) {
        queue.push(nextInput);
      }
    });

    this.onMessage(ClientMessage.INTERACT, (client) => this.handleInteraction(client));
    this.onMessage(ClientMessage.FIRE, (client, payload: unknown) => this.handleFire(client, payload));

    this.setSimulationInterval((deltaTime) => this.simulate(deltaTime), 1000 / SIMULATION_HZ);
    this.clock.setInterval(() => void this.flushPersistence(), CHECKPOINT_INTERVAL_MS);
  }

  onJoin(client: Client, options: Partial<JoinWorldOptions>): void {
    const survivorId = cleanSurvivorId(options.survivorId, `guest-${client.sessionId}`);
    let duplicateConnection = false;
    this.state.players.forEach((connectedPlayer) => {
      if (connectedPlayer.survivorId === survivorId) {
        duplicateConnection = true;
      }
    });
    if (duplicateConnection) {
      throw new ServerError(409, "This survivor is already connected.");
    }

    const player = new PlayerState();
    const joinIndex = this.state.players.size;
    const angle = (joinIndex / MAX_PLAYERS) * Math.PI * 2;
    const persisted = this.persistedSurvivors.get(survivorId);

    player.id = client.sessionId;
    player.survivorId = survivorId;
    if (persisted) {
      this.restoreSurvivor(player, persisted);
    } else {
      player.name = cleanIdentifier(options.playerName, `Survivor ${joinIndex + 1}`);
      player.x = Math.cos(angle) * 48;
      player.y = Math.sin(angle) * 48;
      player.spaceId = OVERWORLD_SPACE_ID;
    }

    this.state.players.set(client.sessionId, player);
    this.inputQueues.set(client.sessionId, []);
    this.simulationBudgets.set(client.sessionId, 0);
    this.playerInvulnerableUntil.set(client.sessionId, Date.now() + 1000);
    this.captureSurvivor(player);
    this.markPersistenceDirty();
  }

  async onLeave(client: Client): Promise<void> {
    this.cancelSearch(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.captureSurvivor(player);
      this.markPersistenceDirty();
    }
    this.inputQueues.delete(client.sessionId);
    this.simulationBudgets.delete(client.sessionId);
    this.lastInteractionAt.delete(client.sessionId);
    this.lastFireAt.delete(client.sessionId);
    this.lastFireSequence.delete(client.sessionId);
    this.playerInvulnerableUntil.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    await this.flushPersistence(true);
  }

  async onDispose(): Promise<void> {
    await this.flushPersistence(true);
  }

  private simulate(deltaTimeMs: number): void {
    const inputStepMs = 1000 / SIMULATION_HZ;
    const maximumBudgetMs = inputStepMs * 5;
    const elapsedMs = Math.min(Math.max(deltaTimeMs, 0), maximumBudgetMs);

    this.state.players.forEach((player, sessionId) => {
      const queue = this.inputQueues.get(sessionId);
      let budgetMs = Math.min(
        (this.simulationBudgets.get(sessionId) ?? 0) + elapsedMs,
        maximumBudgetMs,
      );

      while (queue && queue.length > 0 && budgetMs >= inputStepMs) {
        const input = queue.shift();
        if (!input) {
          break;
        }

        const nextPosition = player.activeSearchId
          ? { x: player.x, y: player.y }
          : integrateMovementWithCollisions(
              player,
              input,
              1 / SIMULATION_HZ,
              PLAYER_COLLISION_RADIUS,
              movementEnvironmentForSpace(player.spaceId),
            );
        const movementX = nextPosition.x - player.x;
        const movementY = nextPosition.y - player.y;

        player.x = nextPosition.x;
        player.y = nextPosition.y;
        player.lastProcessedInput = input.sequence;
        budgetMs -= inputStepMs;

        if (movementX !== 0 || movementY !== 0) {
          player.facing = Math.atan2(movementY, movementX);
          this.markPersistenceDirty();
        }
      }

      this.simulationBudgets.set(sessionId, budgetMs);
    });

    this.updateSearches(Date.now());
    this.updateZombies(elapsedMs / 1000, Date.now());

    this.state.tick += 1;
  }

  private handleFire(client: Client, payload: unknown): void {
    const input = sanitizeFireInput(payload);
    const player = this.state.players.get(client.sessionId);
    if (
      !input
      || !player
      || player.spaceId !== OVERWORLD_SPACE_ID
      || player.activeSearchId
      || player.health <= 0
    ) {
      return;
    }

    const previousSequence = this.lastFireSequence.get(client.sessionId) ?? -1;
    const now = Date.now();
    const previousFireAt = this.lastFireAt.get(client.sessionId) ?? 0;
    if (input.sequence <= previousSequence || now - previousFireAt < PISTOL_FIRE_COOLDOWN_MS) {
      return;
    }

    this.lastFireSequence.set(client.sessionId, input.sequence);
    this.lastFireAt.set(client.sessionId, now);
    player.facing = input.angle;

    const environment = movementEnvironmentForSpace(player.spaceId);
    const blockingDistance = environment.colliders
      .map((collider) => rayRectHitDistance(player, input.angle, collider, PISTOL_RANGE))
      .filter((distance): distance is number => distance !== null)
      .sort((left, right) => left - right)[0] ?? PISTOL_RANGE;

    const hit = [...this.state.zombies.values()]
      .filter((zombie) => zombie.alive && zombie.spaceId === player.spaceId)
      .map((zombie) => ({
        zombie,
        distance: rayCircleHitDistance(
          player,
          input.angle,
          { x: zombie.x, y: zombie.y, radius: ZOMBIE_COLLISION_RADIUS },
          PISTOL_RANGE,
        ),
      }))
      .filter(
        (candidate): candidate is { zombie: ZombieState; distance: number } =>
          candidate.distance !== null && candidate.distance < blockingDistance,
      )
      .sort((left, right) => left.distance - right.distance)[0];

    const shotDistance = hit?.distance ?? blockingDistance;
    const targetX = hit?.zombie.x ?? player.x + Math.cos(input.angle) * shotDistance;
    const targetY = hit?.zombie.y ?? player.y + Math.sin(input.angle) * shotDistance;
    this.broadcastCombatEvent({
      kind: "shot",
      actorId: player.id,
      targetId: hit?.zombie.id ?? "",
      originX: player.x,
      originY: player.y,
      targetX,
      targetY,
      amount: hit ? PISTOL_DAMAGE : 0,
      message: hit ? `Hit ${hit.zombie.name}` : "Shot missed",
    });

    if (hit) {
      this.damageZombie(player, hit.zombie, PISTOL_DAMAGE, now);
    }
    this.markPersistenceDirty();
  }

  private damageZombie(player: PlayerState, zombie: ZombieState, damage: number, now: number): void {
    zombie.health = Math.max(0, zombie.health - damage);
    let ledger = this.damageLedgers.get(zombie.id);
    if (!ledger) {
      ledger = new Map();
      this.damageLedgers.set(zombie.id, ledger);
    }
    const contribution = ledger.get(player.survivorId);
    ledger.set(player.survivorId, {
      damage: (contribution?.damage ?? 0) + damage,
      name: player.name,
    });

    if (zombie.health <= 0) {
      this.killZombie(zombie, now);
    }
  }

  private killZombie(zombie: ZombieState, now: number): void {
    zombie.alive = false;
    zombie.aggroTarget = "";
    zombie.respawnAt = now + ZOMBIE_RESPAWN_MS;
    const ledger = this.damageLedgers.get(zombie.id);
    const winner = ledger
      ? [...ledger.entries()].sort((left, right) => right[1].damage - left[1].damage)[0]
      : undefined;

    let ownerName = "No survivor";
    if (winner) {
      const [survivorId, contribution] = winner;
      ownerName = contribution.name;
      this.creditZombieLoot(survivorId, ZOMBIE_LOOT_SCRAP);
    }

    this.broadcastCombatEvent({
      kind: "zombie-killed",
      actorId: winner?.[0] ?? "",
      targetId: zombie.id,
      originX: zombie.x,
      originY: zombie.y,
      targetX: zombie.x,
      targetY: zombie.y,
      amount: ZOMBIE_LOOT_SCRAP,
      message: `${zombie.name} eliminated - ${ownerName} secured ${ZOMBIE_LOOT_SCRAP} scrap`,
    });
    this.markPersistenceDirty();
  }

  private creditZombieLoot(survivorId: string, amount: number): void {
    let connectedPlayer: PlayerState | undefined;
    this.state.players.forEach((player) => {
      if (player.survivorId === survivorId) {
        connectedPlayer = player;
      }
    });
    if (connectedPlayer) {
      connectedPlayer.scrap += amount;
      return;
    }

    const persisted = this.persistedSurvivors.get(survivorId);
    if (persisted) {
      persisted.inventory.scrap += amount;
      persisted.updatedAt = new Date().toISOString();
    }
  }

  private updateZombies(deltaSeconds: number, now: number): void {
    this.state.zombies.forEach((zombie) => {
      if (!zombie.alive) {
        if (zombie.respawnAt > 0 && now >= zombie.respawnAt) {
          this.respawnZombie(zombie);
        }
        return;
      }

      const target = this.findZombieTarget(zombie, now);
      if (!target) {
        zombie.aggroTarget = "";
        this.returnZombieToSpawn(zombie, deltaSeconds);
        return;
      }

      zombie.aggroTarget = target.id;
      const distance = distanceBetween(zombie, target);
      if (distance <= ZOMBIE_ATTACK_RANGE) {
        const previousAttackAt = this.lastZombieAttackAt.get(zombie.id) ?? 0;
        if (now - previousAttackAt >= ZOMBIE_ATTACK_COOLDOWN_MS) {
          this.lastZombieAttackAt.set(zombie.id, now);
          this.damagePlayer(zombie, target, ZOMBIE_ATTACK_DAMAGE, now);
        }
        return;
      }

      const next = integrateVectorWithCollisions(
        zombie,
        { x: target.x - zombie.x, y: target.y - zombie.y },
        deltaSeconds,
        ZOMBIE_COLLISION_RADIUS,
        movementEnvironmentForSpace(zombie.spaceId),
        ZOMBIE_MOVE_SPEED,
      );
      if (next.x !== zombie.x || next.y !== zombie.y) {
        zombie.x = next.x;
        zombie.y = next.y;
        this.markPersistenceDirty();
      }
    });
  }

  private findZombieTarget(zombie: ZombieState, now: number): PlayerState | undefined {
    const currentTarget = zombie.aggroTarget
      ? this.state.players.get(zombie.aggroTarget)
      : undefined;
    if (
      currentTarget
      && currentTarget.spaceId === zombie.spaceId
      && this.isPlayerTargetable(currentTarget, now)
      && distanceBetween(zombie, currentTarget) <= ZOMBIE_DISENGAGE_RADIUS
    ) {
      return currentTarget;
    }

    return [...this.state.players.values()]
      .filter(
        (player) => player.spaceId === zombie.spaceId
          && this.isPlayerTargetable(player, now)
          && distanceBetween(zombie, player) <= ZOMBIE_AGGRO_RADIUS,
      )
      .sort((left, right) => distanceBetween(zombie, left) - distanceBetween(zombie, right))[0];
  }

  private isPlayerTargetable(player: PlayerState, now: number): boolean {
    return player.health > 0
      && now >= (this.playerInvulnerableUntil.get(player.id) ?? 0)
      && Math.hypot(player.x, player.y) > STARTING_SAFE_ZONE_RADIUS;
  }

  private returnZombieToSpawn(zombie: ZombieState, deltaSeconds: number): void {
    const spawn = zombieSpawnById(zombie.id);
    if (!spawn || distanceBetween(zombie, spawn.position) < 1) {
      return;
    }

    const next = integrateVectorWithCollisions(
      zombie,
      { x: spawn.position.x - zombie.x, y: spawn.position.y - zombie.y },
      deltaSeconds,
      ZOMBIE_COLLISION_RADIUS,
      movementEnvironmentForSpace(zombie.spaceId),
      ZOMBIE_RETURN_SPEED,
    );
    zombie.x = next.x;
    zombie.y = next.y;
    this.markPersistenceDirty();
  }

  private damagePlayer(zombie: ZombieState, player: PlayerState, damage: number, now: number): void {
    if (!this.isPlayerTargetable(player, now)) {
      return;
    }
    player.health = Math.max(0, player.health - damage);
    this.broadcastCombatEvent({
      kind: "player-hit",
      actorId: zombie.id,
      targetId: player.id,
      originX: zombie.x,
      originY: zombie.y,
      targetX: player.x,
      targetY: player.y,
      amount: damage,
      message: `${player.name} took ${damage} damage`,
    });
    if (player.health <= 0) {
      player.health = player.maxHealth;
      this.movePlayerToSpace(player.id, OVERWORLD_SPACE_ID, { x: 0, y: 0 });
      this.playerInvulnerableUntil.set(
        player.id,
        now + PLAYER_RESPAWN_INVULNERABILITY_MS,
      );
      this.broadcastCombatEvent({
        kind: "player-respawned",
        actorId: zombie.id,
        targetId: player.id,
        originX: zombie.x,
        originY: zombie.y,
        targetX: 0,
        targetY: 0,
        amount: 0,
        message: `${player.name} was overrun and returned to camp`,
      });
    }
    this.markPersistenceDirty();
  }

  private respawnZombie(zombie: ZombieState): void {
    const spawn = zombieSpawnById(zombie.id);
    if (!spawn) {
      return;
    }
    zombie.x = spawn.position.x;
    zombie.y = spawn.position.y;
    zombie.health = zombie.maxHealth;
    zombie.alive = true;
    zombie.aggroTarget = "";
    zombie.respawnAt = 0;
    this.damageLedgers.delete(zombie.id);
    this.lastZombieAttackAt.delete(zombie.id);
    this.markPersistenceDirty();
  }

  private broadcastCombatEvent(event: CombatEvent): void {
    this.broadcast(ServerMessage.COMBAT_EVENT, event);
  }

  private handleInteraction(client: Client): void {
    const now = Date.now();
    const previousInteractionAt = this.lastInteractionAt.get(client.sessionId) ?? 0;
    if (now - previousInteractionAt < 250) {
      return;
    }
    this.lastInteractionAt.set(client.sessionId, now);

    const player = this.state.players.get(client.sessionId);
    if (!player) {
      return;
    }

    if (player.activeSearchId) {
      this.cancelSearch(client.sessionId);
      return;
    }

    if (player.spaceId === OVERWORLD_SPACE_ID) {
      const building = BUILDINGS
        .filter(
          (candidate) => distanceBetween(player, candidate.exterior.entrance)
            <= candidate.exterior.interactionRadius,
        )
        .sort(
          (left, right) => distanceBetween(player, left.exterior.entrance)
            - distanceBetween(player, right.exterior.entrance),
        )[0];
      if (building) {
        this.movePlayerToSpace(
          client.sessionId,
          building.interior.spaceId,
          building.interior.entrancePosition,
        );
      }
      return;
    }

    const building = buildingByInteriorSpace(player.spaceId);
    if (!building) {
      return;
    }

    if (distanceBetween(player, building.interior.exit) <= building.interior.interactionRadius) {
      this.movePlayerToSpace(client.sessionId, OVERWORLD_SPACE_ID, building.exterior.returnPosition);
      return;
    }

    const target = this.nearestSearchableContainer(player);
    if (target) {
      this.startSearch(client.sessionId, target);
    }
  }

  private nearestSearchableContainer(player: PlayerState): SearchableContainerDefinition | undefined {
    const building = buildingByInteriorSpace(player.spaceId);
    return building?.interior.containers
      .filter((definition) => {
        const state = this.state.containers.get(definition.id);
        return Boolean(
          state
          && !state.opened
          && !state.searchingBy
          && distanceBetween(player, definition.position) <= definition.interactionRadius,
        );
      })
      .sort(
        (left, right) => distanceBetween(player, left.position) - distanceBetween(player, right.position),
      )[0];
  }

  private startSearch(sessionId: string, definition: SearchableContainerDefinition): void {
    const player = this.state.players.get(sessionId);
    const container = this.state.containers.get(definition.id);
    if (!player || !container || container.opened || container.searchingBy) {
      return;
    }

    player.activeSearchId = definition.id;
    container.searchingBy = sessionId;
    container.searchingByName = player.name;
    container.searchStartedAt = Date.now();
    container.searchDurationMs = definition.searchDurationMs;
    container.searchProgress = 0;
  }

  private updateSearches(now: number): void {
    this.state.containers.forEach((container) => {
      if (!container.searchingBy) {
        return;
      }

      const player = this.state.players.get(container.searchingBy);
      const definition = buildingContainerById(container.id);
      if (
        !player
        || !definition
        || player.activeSearchId !== container.id
        || player.spaceId !== container.spaceId
        || distanceBetween(player, definition.position) > definition.interactionRadius
      ) {
        this.clearContainerSearch(container);
        return;
      }

      container.searchProgress = calculateSearchProgress(
        now,
        container.searchStartedAt,
        container.searchDurationMs,
      );
      if (container.searchProgress >= 1) {
        this.completeSearch(player, container, definition);
      }
    });
  }

  private completeSearch(
    player: PlayerState,
    container: ContainerState,
    definition: SearchableContainerDefinition,
  ): void {
    container.opened = true;
    container.searchedBy = player.name;
    player.activeSearchId = "";
    this.applyLoot(player, definition.loot);
    this.clearContainerSearch(container);
    this.markPersistenceDirty();
  }

  private applyLoot(player: PlayerState, loot: Readonly<Partial<Record<LootItemId, number>>>): void {
    player.scrap += loot.scrap ?? 0;
    player.parts += loot.parts ?? 0;
    player.food += loot.food ?? 0;
    player.medicine += loot.medicine ?? 0;
  }

  private cancelSearch(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (!player?.activeSearchId) {
      return;
    }

    const container = this.state.containers.get(player.activeSearchId);
    player.activeSearchId = "";
    if (container?.searchingBy === sessionId) {
      this.clearContainerSearch(container);
    }
  }

  private clearContainerSearch(container: ContainerState): void {
    const player = this.state.players.get(container.searchingBy);
    if (player?.activeSearchId === container.id) {
      player.activeSearchId = "";
    }
    container.searchingBy = "";
    container.searchingByName = "";
    container.searchStartedAt = 0;
    container.searchProgress = 0;
  }

  private movePlayerToSpace(sessionId: string, spaceId: string, position: { x: number; y: number }): void {
    const player = this.state.players.get(sessionId);
    const queue = this.inputQueues.get(sessionId);
    if (!player || !queue) {
      return;
    }

    this.cancelSearch(sessionId);

    player.lastProcessedInput = Math.max(
      player.lastProcessedInput,
      queue.at(-1)?.sequence ?? player.lastProcessedInput,
    );
    queue.length = 0;
    this.simulationBudgets.set(sessionId, 0);
    player.spaceId = spaceId;
    player.x = position.x;
    player.y = position.y;
    this.markPersistenceDirty();
  }

  private restoreSurvivor(player: PlayerState, persisted: PersistedSurvivor): void {
    player.name = cleanIdentifier(persisted.name, "Survivor");
    player.x = finiteNumber(persisted.x, 0);
    player.y = finiteNumber(persisted.y, 0);
    player.facing = finiteNumber(persisted.facing, 0);
    player.spaceId = buildingByInteriorSpace(persisted.spaceId)
      ? persisted.spaceId
      : OVERWORLD_SPACE_ID;
    player.maxHealth = PLAYER_MAX_HEALTH;
    player.health = Math.max(1, Math.min(player.maxHealth, inventoryCount(persisted.health)));
    player.scrap = inventoryCount(persisted.inventory.scrap);
    player.parts = inventoryCount(persisted.inventory.parts);
    player.food = inventoryCount(persisted.inventory.food);
    player.medicine = inventoryCount(persisted.inventory.medicine);
  }

  private captureSurvivor(player: PlayerState): void {
    const inventory: PersistedInventory = {
      scrap: player.scrap,
      parts: player.parts,
      food: player.food,
      medicine: player.medicine,
    };
    this.persistedSurvivors.set(player.survivorId, {
      survivorId: player.survivorId,
      name: player.name,
      x: player.x,
      y: player.y,
      facing: player.facing,
      spaceId: player.spaceId,
      health: player.health,
      inventory,
      updatedAt: new Date().toISOString(),
    });
  }

  private buildPersistentWorld(): PersistedWorld {
    this.state.players.forEach((player) => this.captureSurvivor(player));
    const survivors = Object.fromEntries(this.persistedSurvivors.entries());
    const containers: PersistedWorld["containers"] = {};
    this.state.containers.forEach((container) => {
      containers[container.id] = {
        id: container.id,
        opened: container.opened,
        searchedBy: container.searchedBy,
      };
    });
    const zombies: PersistedWorld["zombies"] = {};
    this.state.zombies.forEach((zombie) => {
      const ledger = this.damageLedgers.get(zombie.id);
      zombies[zombie.id] = {
        id: zombie.id,
        x: zombie.x,
        y: zombie.y,
        health: zombie.health,
        alive: zombie.alive,
        respawnAt: zombie.respawnAt,
        contributions: ledger ? Object.fromEntries(ledger.entries()) : {},
      };
    });

    return {
      worldId: this.state.worldId,
      seed: this.state.seed,
      survivors,
      containers,
      zombies,
      updatedAt: new Date().toISOString(),
    };
  }

  private markPersistenceDirty(): void {
    this.persistenceDirty = true;
  }

  private flushPersistence(force = false): Promise<void> {
    if (!this.persistenceDirty && !force) {
      return this.persistenceQueue;
    }

    const snapshot = this.buildPersistentWorld();
    this.persistenceDirty = false;
    this.persistenceQueue = this.persistenceQueue
      .then(() => worldRepository.saveWorld(snapshot))
      .catch((error: unknown) => {
        this.persistenceDirty = true;
        console.error(`Unable to persist world ${this.state.worldId}`, error);
      });
    return this.persistenceQueue;
  }
}
