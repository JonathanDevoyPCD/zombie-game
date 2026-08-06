import {
  ClientMessage,
  MAX_PLAYERS,
  NETWORK_PATCH_MS,
  ServerMessage,
  SIMULATION_HZ,
  type BuildEvent,
  type BuildPlaceInput,
  type CombatEvent,
  type FireWeaponInput,
  type InventoryDropInput,
  type InventoryEvent,
  type InventoryMoveInput,
  type JoinWorldOptions,
  type MovementInput,
} from "@last-survivor/shared";
import {
  ALL_BUILDING_CONTAINERS,
  BUILDABLES,
  BUILDINGS,
  INVENTORY_SLOT_COUNT,
  ITEMS,
  OVERWORLD_SPACE_ID,
  PLAYER_COLLISION_RADIUS,
  buildableCollider,
  buildableCollidersConflict,
  isBuildableId,
  isBuildOrientation,
  isItemId,
  movementEnvironmentForBuilding,
  movementEnvironmentForSpace,
  snapBuildCoordinate,
  type ItemId,
  type LootItemId,
  type ResolvedBuildingDefinition,
  type SearchableContainerDefinition,
  PISTOL_DAMAGE,
  PISTOL_FIRE_COOLDOWN_MS,
  PISTOL_RANGE,
  PLAYER_MAX_HEALTH,
  PLAYER_RESPAWN_INVULNERABILITY_MS,
  STARTING_TOWN_PROP_COLLIDERS,
  STARTING_TOWN_PROPS,
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
  DEFAULT_MOVE_SPEED,
  integrateMovementWithCollisions,
  integrateVectorWithCollisions,
  rayCircleHitDistance,
  rayRectHitDistance,
  sanitizeMovementInput,
  SPRINT_MOVE_SPEED,
} from "@last-survivor/simulation";
import {
  RESOURCE_INTERACTION_RADIUS,
  RESOURCE_RESPAWN_MS,
  generateChunkBuildings,
  generateChunkResources,
  generatedBuildingFromInteriorSpace,
  resolveGeneratedBuilding,
  resourceCollisionRect,
  worldToChunk,
} from "@last-survivor/worldgen";
import { type Client, Room, ServerError } from "@colyseus/core";
import { worldRepository } from "../persistence/defaultRepository.js";
import type {
  PersistedInventory,
  PersistedInventorySlot,
  PersistedSurvivor,
  PersistedWorld,
} from "../persistence/types.js";
import {
  addInventoryBundle,
  addInventoryItem,
  cloneInventorySlots,
  emptyInventorySlots,
  inventoryTotals,
  moveInventoryStack,
  removeInventoryBundle,
  removeInventoryItemAt,
  type InventoryBundle,
  type InventorySlotLike,
} from "../inventory/inventory.js";
import { ContainerState } from "./schema/ContainerState.js";
import { InventorySlotState } from "./schema/InventorySlotState.js";
import { PlayerState } from "./schema/PlayerState.js";
import { WorldState } from "./schema/WorldState.js";
import { ZombieState } from "./schema/ZombieState.js";
import { WorldPickupState } from "./schema/WorldPickupState.js";
import { PlacedStructureState } from "./schema/PlacedStructureState.js";
import { ResourceNodeState } from "./schema/ResourceNodeState.js";

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

function cleanOperationId(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

function sanitizeInventoryMoveInput(value: unknown): InventoryMoveInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<InventoryMoveInput>;
  const operationId = cleanOperationId(candidate.operationId);
  if (
    !operationId
    || !Number.isInteger(candidate.fromIndex)
    || !Number.isInteger(candidate.toIndex)
  ) {
    return null;
  }
  const input: InventoryMoveInput = {
    operationId,
    fromIndex: Number(candidate.fromIndex),
    toIndex: Number(candidate.toIndex),
  };
  if (candidate.quantity !== undefined && Number.isInteger(candidate.quantity)) {
    input.quantity = Number(candidate.quantity);
  }
  return input;
}

function sanitizeInventoryDropInput(value: unknown): InventoryDropInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<InventoryDropInput>;
  const operationId = cleanOperationId(candidate.operationId);
  if (!operationId || !Number.isInteger(candidate.slotIndex)) {
    return null;
  }
  const input: InventoryDropInput = {
    operationId,
    slotIndex: Number(candidate.slotIndex),
  };
  if (candidate.quantity !== undefined && Number.isInteger(candidate.quantity)) {
    input.quantity = Number(candidate.quantity);
  }
  return input;
}

function sanitizeBuildPlaceInput(value: unknown): BuildPlaceInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<BuildPlaceInput>;
  const operationId = cleanOperationId(candidate.operationId);
  if (
    !operationId
    || typeof candidate.buildableId !== "string"
    || !isBuildableId(candidate.buildableId)
    || typeof candidate.orientation !== "string"
    || !isBuildOrientation(candidate.orientation)
    || typeof candidate.x !== "number"
    || !Number.isFinite(candidate.x)
    || typeof candidate.y !== "number"
    || !Number.isFinite(candidate.y)
    || Math.abs(candidate.x) > 1_000_000
    || Math.abs(candidate.y) > 1_000_000
  ) {
    return null;
  }
  return {
    operationId,
    buildableId: candidate.buildableId,
    x: candidate.x,
    y: candidate.y,
    orientation: candidate.orientation,
  };
}

function rectanglesOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
  padding = 0,
): boolean {
  return left.x < right.x + right.width + padding
    && left.x + left.width + padding > right.x
    && left.y < right.y + right.height + padding
    && left.y + left.height + padding > right.y;
}

function circleOverlapsRect(
  circle: { x: number; y: number },
  radius: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  return (circle.x - closestX) ** 2 + (circle.y - closestY) ** 2 < radius ** 2;
}

const CHECKPOINT_INTERVAL_MS = 5000;
const PLAYER_MAX_STAMINA = 100;
const SPRINT_STAMINA_DRAIN_PER_SECOND = 24;
const STAMINA_RECOVERY_PER_SECOND = 18;
const RESOURCE_CHUNK_RADIUS = 1;
const TREE_HARVEST_DURATION_MS = 2400;
const STONE_HARVEST_DURATION_MS = 3000;

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
  private readonly processedOperations = new Map<string, Set<string>>();
  private readonly persistedSurvivors = new Map<string, PersistedSurvivor>();
  private readonly persistedContainers = new Map<
    string,
    PersistedWorld["containers"][string]
  >();
  private readonly persistedResources = new Map<string, PersistedWorld["resources"][string]>();
  private readonly worldBuildings = new Map(
    BUILDINGS.map((building) => [building.id, building] as const),
  );
  private readonly loadedBuildingChunks = new Set<string>();
  private readonly loadedResourceChunks = new Set<string>();
  private readonly starterKitsGranted = new Set<string>();
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
        if (survivor.starterKitGranted) {
          this.starterKitsGranted.add(survivor.survivorId);
        }
      });
      Object.values(persistedWorld.resources ?? {}).forEach((resource) => {
        this.persistedResources.set(resource.id, resource);
      });
      Object.values(persistedWorld.containers ?? {}).forEach((container) => {
        this.persistedContainers.set(container.id, container);
      });
    }

    ALL_BUILDING_CONTAINERS.forEach((definition) => this.ensureContainerState(definition));

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
        const persistedX = finiteNumber(persistedZombie.x, zombie.x);
        const persistedY = finiteNumber(persistedZombie.y, zombie.y);
        if (Math.hypot(persistedX, persistedY) > STARTING_SAFE_ZONE_RADIUS) {
          zombie.x = persistedX;
          zombie.y = persistedY;
        }
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

    Object.values(persistedWorld?.pickups ?? {}).forEach((persistedPickup) => {
      if (!isItemId(persistedPickup.itemId) || persistedPickup.quantity <= 0) {
        return;
      }
      const pickup = new WorldPickupState();
      pickup.id = persistedPickup.id;
      pickup.itemId = persistedPickup.itemId;
      pickup.quantity = inventoryCount(persistedPickup.quantity);
      pickup.x = finiteNumber(persistedPickup.x, 0);
      pickup.y = finiteNumber(persistedPickup.y, 0);
      pickup.spaceId = persistedPickup.spaceId;
      pickup.droppedBy = persistedPickup.droppedBy;
      this.state.pickups.set(pickup.id, pickup);
    });

    Object.values(persistedWorld?.structures ?? {}).forEach((persistedStructure) => {
      if (
        !isBuildableId(persistedStructure.buildableId)
        || !isBuildOrientation(persistedStructure.orientation)
      ) {
        return;
      }
      const structure = new PlacedStructureState();
      structure.id = persistedStructure.id;
      structure.buildableId = persistedStructure.buildableId;
      structure.x = finiteNumber(persistedStructure.x, 0);
      structure.y = finiteNumber(persistedStructure.y, 0);
      structure.orientation = persistedStructure.orientation;
      structure.placedBy = persistedStructure.placedBy;
      this.state.structures.set(structure.id, structure);
    });

    this.ensureBuildingsAround(0, 0);
    this.ensureResourcesAround(0, 0);

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
    this.onMessage(ClientMessage.INVENTORY_MOVE, (client, payload: unknown) => {
      this.handleInventoryMove(client, payload);
    });
    this.onMessage(ClientMessage.INVENTORY_DROP, (client, payload: unknown) => {
      this.handleInventoryDrop(client, payload);
    });
    this.onMessage(ClientMessage.BUILD_PLACE, (client, payload: unknown) => {
      this.handleBuildPlace(client, payload);
    });
    this.onMessage(ClientMessage.FLASHLIGHT_TOGGLE, (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.health <= 0) {
        return;
      }
      player.flashlight = !player.flashlight;
      this.markPersistenceDirty();
    });

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
      if (!persisted.starterKitGranted) {
        const slots = this.playerInventory(player);
        addInventoryItem(slots, "wood", 12);
        this.commitPlayerInventory(player, slots);
        this.starterKitsGranted.add(survivorId);
      }
    } else {
      player.name = cleanIdentifier(options.playerName, `Survivor ${joinIndex + 1}`);
      player.x = Math.cos(angle) * 48;
      player.y = Math.sin(angle) * 48;
      player.spaceId = OVERWORLD_SPACE_ID;
      this.initializePlayerInventory(player);
      const startingSlots = this.playerInventory(player);
      addInventoryItem(startingSlots, "wood", 12);
      this.commitPlayerInventory(player, startingSlots);
      this.starterKitsGranted.add(survivorId);
    }

    this.state.players.set(client.sessionId, player);
    this.ensureBuildingsAround(player.x, player.y);
    this.ensureResourcesAround(player.x, player.y);
    this.inputQueues.set(client.sessionId, []);
    this.simulationBudgets.set(client.sessionId, 0);
    this.playerInvulnerableUntil.set(client.sessionId, Date.now() + 1000);
    this.processedOperations.set(client.sessionId, new Set());
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
    this.processedOperations.delete(client.sessionId);
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
      if (player.spaceId === OVERWORLD_SPACE_ID) {
        this.ensureBuildingsAround(player.x, player.y);
        this.ensureResourcesAround(player.x, player.y);
      }
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

        const moving = input.up || input.down || input.left || input.right;
        const canSprint = moving && input.sprint && player.stamina > 0;
        player.sprinting = canSprint;
        if (canSprint) {
          player.stamina = Math.max(
            0,
            player.stamina - SPRINT_STAMINA_DRAIN_PER_SECOND / SIMULATION_HZ,
          );
        } else {
          player.stamina = Math.min(
            player.maxStamina,
            player.stamina + STAMINA_RECOVERY_PER_SECOND / SIMULATION_HZ,
          );
        }

        const nextPosition = player.activeSearchId
          ? { x: player.x, y: player.y }
          : integrateMovementWithCollisions(
              player,
              input,
              1 / SIMULATION_HZ,
              PLAYER_COLLISION_RADIUS,
              this.movementEnvironment(player.spaceId),
              canSprint ? SPRINT_MOVE_SPEED : DEFAULT_MOVE_SPEED,
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
    this.updateResources(Date.now());
    this.updateZombies(elapsedMs / 1000, Date.now());

    this.state.tick += 1;
  }

  private initializePlayerInventory(
    player: PlayerState,
    persistedSlots: readonly PersistedInventorySlot[] = [],
  ): void {
    player.inventorySlots.splice(0, player.inventorySlots.length);
    const restored = emptyInventorySlots();
    persistedSlots.forEach((persistedSlot) => {
      if (
        Number.isInteger(persistedSlot.index)
        && persistedSlot.index >= 0
        && persistedSlot.index < INVENTORY_SLOT_COUNT
        && isItemId(persistedSlot.itemId)
      ) {
        const slot = restored[persistedSlot.index];
        if (slot) {
          slot.itemId = persistedSlot.itemId;
          slot.quantity = Math.min(
            ITEMS[persistedSlot.itemId].maxStack,
            inventoryCount(persistedSlot.quantity),
          );
        }
      }
    });
    restored.forEach((source, index) => {
      const slot = new InventorySlotState();
      slot.index = index;
      slot.itemId = source.itemId;
      slot.quantity = source.quantity;
      player.inventorySlots.push(slot);
    });
    this.syncInventoryTotals(player);
  }

  private playerInventory(player: PlayerState): InventorySlotLike[] {
    return cloneInventorySlots([...player.inventorySlots]);
  }

  private commitPlayerInventory(player: PlayerState, slots: readonly InventorySlotLike[]): void {
    player.inventorySlots.forEach((slot, index) => {
      const source = slots[index];
      slot.itemId = source?.itemId ?? "";
      slot.quantity = source?.quantity ?? 0;
    });
    this.syncInventoryTotals(player);
  }

  private syncInventoryTotals(player: PlayerState): void {
    const totals = inventoryTotals([...player.inventorySlots]);
    player.scrap = totals.scrap;
    player.parts = totals.parts;
    player.food = totals.food;
    player.medicine = totals.medicine;
    player.water = totals.water;
    player.wood = totals.wood;
    player.stone = totals.stone;
  }

  private allBuildings(): ResolvedBuildingDefinition[] {
    return [...this.worldBuildings.values()];
  }

  private buildingForSpace(spaceId: string): ResolvedBuildingDefinition | undefined {
    return this.allBuildings().find((building) => building.interior.spaceId === spaceId);
  }

  private containerDefinition(containerId: string): SearchableContainerDefinition | undefined {
    return this.allBuildings()
      .flatMap((building) => building.interior.containers)
      .find((container) => container.id === containerId);
  }

  private ensureContainerState(definition: SearchableContainerDefinition): void {
    if (this.state.containers.has(definition.id)) {
      return;
    }
    const container = new ContainerState();
    container.id = definition.id;
    container.spaceId = definition.spaceId;
    container.searchDurationMs = definition.searchDurationMs;
    const persisted = this.persistedContainers.get(definition.id);
    if (persisted) {
      container.opened = persisted.opened;
      container.searchedBy = persisted.searchedBy;
    }
    this.state.containers.set(container.id, container);
  }

  private ensureBuildingContainers(building: ResolvedBuildingDefinition): void {
    building.interior.containers.forEach((container) => this.ensureContainerState(container));
  }

  private registerGeneratedBuilding(building: ResolvedBuildingDefinition): void {
    this.worldBuildings.set(building.id, building);
  }

  private ensureBuildingsAround(x: number, y: number): void {
    const centerChunkX = worldToChunk(x);
    const centerChunkY = worldToChunk(y);
    for (let chunkY = centerChunkY - 1; chunkY <= centerChunkY + 1; chunkY += 1) {
      for (let chunkX = centerChunkX - 1; chunkX <= centerChunkX + 1; chunkX += 1) {
        const chunkKey = `${chunkX}:${chunkY}`;
        if (this.loadedBuildingChunks.has(chunkKey)) {
          continue;
        }
        this.loadedBuildingChunks.add(chunkKey);
        generateChunkBuildings(this.state.seed, chunkX, chunkY).forEach((placement) => {
          this.registerGeneratedBuilding(resolveGeneratedBuilding(placement));
        });
      }
    }
  }

  private ensureBuildingForSpace(spaceId: string): ResolvedBuildingDefinition | undefined {
    const known = this.buildingForSpace(spaceId);
    if (known) {
      return known;
    }
    const generated = generatedBuildingFromInteriorSpace(this.state.seed, spaceId);
    if (generated) {
      this.registerGeneratedBuilding(generated);
    }
    return generated;
  }

  private movementEnvironment(spaceId: string) {
    if (spaceId !== OVERWORLD_SPACE_ID) {
      const building = this.ensureBuildingForSpace(spaceId);
      return building
        ? movementEnvironmentForBuilding(building)
        : movementEnvironmentForSpace(spaceId);
    }
    const colliders = [
      ...this.allBuildings().map((building) => building.exterior.collider),
      ...STARTING_TOWN_PROP_COLLIDERS,
    ];
    this.state.structures.forEach((structure) => {
      if (!isBuildableId(structure.buildableId) || !isBuildOrientation(structure.orientation)) {
        return;
      }
      colliders.push(buildableCollider(
        BUILDABLES[structure.buildableId],
        structure.x,
        structure.y,
        structure.orientation,
      ));
    });
    this.state.resources.forEach((resource) => {
      if (resource.available && (resource.kind === "tree" || resource.kind === "stone")) {
        colliders.push(resourceCollisionRect(resource.kind, resource.x, resource.y));
      }
    });
    return { colliders };
  }

  private acceptOperation(sessionId: string, operationId: string): boolean {
    const operations = this.processedOperations.get(sessionId);
    if (!operations || operations.has(operationId)) {
      return false;
    }
    operations.add(operationId);
    if (operations.size > 256) {
      const oldest = operations.values().next().value as string | undefined;
      if (oldest) {
        operations.delete(oldest);
      }
    }
    return true;
  }

  private sendInventoryEvent(client: Client, event: InventoryEvent): void {
    client.send(ServerMessage.INVENTORY_EVENT, event);
  }

  private sendBuildEvent(client: Client, event: BuildEvent): void {
    client.send(ServerMessage.BUILD_EVENT, event);
  }

  private handleInventoryMove(client: Client, payload: unknown): void {
    const input = sanitizeInventoryMoveInput(payload);
    const player = this.state.players.get(client.sessionId);
    if (!input || !player || !this.acceptOperation(client.sessionId, input.operationId)) {
      return;
    }
    const slots = this.playerInventory(player);
    if (!moveInventoryStack(slots, input.fromIndex, input.toIndex, input.quantity)) {
      this.sendInventoryEvent(client, { kind: "error", message: "That inventory move is not valid." });
      return;
    }
    this.commitPlayerInventory(player, slots);
    this.markPersistenceDirty();
  }

  private handleInventoryDrop(client: Client, payload: unknown): void {
    const input = sanitizeInventoryDropInput(payload);
    const player = this.state.players.get(client.sessionId);
    if (!input || !player || !this.acceptOperation(client.sessionId, input.operationId)) {
      return;
    }
    const slots = this.playerInventory(player);
    const removed = removeInventoryItemAt(slots, input.slotIndex, input.quantity);
    if (!removed) {
      this.sendInventoryEvent(client, { kind: "error", message: "There is nothing to drop." });
      return;
    }

    const pickup = new WorldPickupState();
    pickup.id = `pickup:${player.survivorId}:${input.operationId}`;
    pickup.itemId = removed.itemId;
    pickup.quantity = removed.quantity;
    pickup.x = player.x + Math.cos(player.facing) * 24;
    pickup.y = player.y + Math.sin(player.facing) * 24;
    pickup.spaceId = player.spaceId;
    pickup.droppedBy = player.name;
    this.state.pickups.set(pickup.id, pickup);
    this.commitPlayerInventory(player, slots);
    this.sendInventoryEvent(client, {
      kind: "success",
      message: `Dropped ${removed.quantity} ${ITEMS[removed.itemId].name.toLowerCase()}.`,
    });
    this.markPersistenceDirty();
  }

  private handleBuildPlace(client: Client, payload: unknown): void {
    const input = sanitizeBuildPlaceInput(payload);
    const player = this.state.players.get(client.sessionId);
    if (
      !input
      || !isBuildableId(input.buildableId)
      || !player
      || !this.acceptOperation(client.sessionId, input.operationId)
    ) {
      return;
    }
    if (player.spaceId !== OVERWORLD_SPACE_ID || player.activeSearchId || player.health <= 0) {
      this.sendBuildEvent(client, {
        kind: "error",
        message: "Structures can only be placed while standing in the overworld.",
        structureId: "",
      });
      return;
    }

    const definition = BUILDABLES[input.buildableId];
    const x = snapBuildCoordinate(input.x, definition.gridSize);
    const y = snapBuildCoordinate(input.y, definition.gridSize);
    if (distanceBetween(player, { x, y }) > definition.maximumPlacementRange) {
      this.sendBuildEvent(client, {
        kind: "error",
        message: "That position is out of building range.",
        structureId: "",
      });
      return;
    }

    const collider = buildableCollider(definition, x, y, input.orientation);
    const overlapsStaticWorld = this.allBuildings().some((building) => (
      rectanglesOverlap(collider, building.exterior.collider, 8)
    )) || STARTING_TOWN_PROP_COLLIDERS.some((propCollider) => (
      rectanglesOverlap(collider, propCollider, 4)
    ));
    let overlapsStructure = false;
    this.state.structures.forEach((structure) => {
      if (
        overlapsStructure
        || !isBuildableId(structure.buildableId)
        || !isBuildOrientation(structure.orientation)
      ) {
        return;
      }
      overlapsStructure = buildableCollidersConflict(
        collider,
        buildableCollider(
          BUILDABLES[structure.buildableId],
          structure.x,
          structure.y,
          structure.orientation,
        ),
      );
    });
    let overlapsActor = false;
    this.state.players.forEach((candidate) => {
      if (
        !overlapsActor
        && candidate.spaceId === OVERWORLD_SPACE_ID
        && circleOverlapsRect(candidate, PLAYER_COLLISION_RADIUS + 3, collider)
      ) {
        overlapsActor = true;
      }
    });
    this.state.zombies.forEach((zombie) => {
      if (
        !overlapsActor
        && zombie.alive
        && zombie.spaceId === OVERWORLD_SPACE_ID
        && circleOverlapsRect(zombie, ZOMBIE_COLLISION_RADIUS + 3, collider)
      ) {
        overlapsActor = true;
      }
    });
    this.state.resources.forEach((resource) => {
      if (
        !overlapsActor
        && resource.available
        && (resource.kind === "tree" || resource.kind === "stone")
        && rectanglesOverlap(collider, resourceCollisionRect(resource.kind, resource.x, resource.y), 2)
      ) {
        overlapsActor = true;
      }
    });
    if (overlapsStaticWorld || overlapsStructure || overlapsActor) {
      this.sendBuildEvent(client, {
        kind: "error",
        message: "That position is blocked.",
        structureId: "",
      });
      return;
    }

    const slots = this.playerInventory(player);
    if (!removeInventoryBundle(slots, definition.cost)) {
      this.sendBuildEvent(client, {
        kind: "error",
        message: "You do not have enough wood.",
        structureId: "",
      });
      return;
    }

    const structure = new PlacedStructureState();
    structure.id = `structure:${player.survivorId}:${input.operationId}`;
    structure.buildableId = input.buildableId;
    structure.x = x;
    structure.y = y;
    structure.orientation = input.orientation;
    structure.placedBy = player.name;
    this.state.structures.set(structure.id, structure);
    this.commitPlayerInventory(player, slots);
    this.sendBuildEvent(client, {
      kind: "success",
      message: `${definition.name} placed.`,
      structureId: structure.id,
    });
    this.markPersistenceDirty();
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

    const environment = this.movementEnvironment(player.spaceId);
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
      const slots = this.playerInventory(connectedPlayer);
      addInventoryItem(slots, "scrap", amount);
      this.commitPlayerInventory(connectedPlayer, slots);
      return;
    }

    const persisted = this.persistedSurvivors.get(survivorId);
    if (persisted) {
      const slots = cloneInventorySlots(persisted.inventory.slots);
      addInventoryItem(slots, "scrap", amount);
      persisted.inventory.slots = slots
        .map((slot, index) => ({ index, itemId: slot.itemId, quantity: slot.quantity }))
        .filter((slot) => slot.itemId && slot.quantity > 0);
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
        this.movementEnvironment(zombie.spaceId),
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
      this.movementEnvironment(zombie.spaceId),
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

    const nearbyPickup = [...this.state.pickups.values()]
      .filter(
        (pickup) => pickup.spaceId === player.spaceId
          && distanceBetween(player, pickup) <= 38,
      )
      .sort((left, right) => distanceBetween(player, left) - distanceBetween(player, right))[0];
    if (nearbyPickup) {
      this.collectPickup(client, player, nearbyPickup);
      return;
    }

    if (player.spaceId === OVERWORLD_SPACE_ID) {
      const resource = this.nearestHarvestableResource(player);
      if (resource) {
        this.startHarvest(client.sessionId, resource);
        return;
      }
      const townProp = STARTING_TOWN_PROPS
        .filter((candidate) => candidate.interaction
          && distanceBetween(player, candidate.position) <= candidate.interaction.radius)
        .sort(
          (left, right) => distanceBetween(player, left.position)
            - distanceBetween(player, right.position),
        )[0];
      if (townProp?.interaction?.kind === "draw-water") {
        const slots = this.playerInventory(player);
        const amount = addInventoryItem(slots, "water", townProp.interaction.amount);
        if (amount <= 0) {
          this.sendInventoryEvent(client, {
            kind: "error",
            message: "Your field pack is full.",
          });
          return;
        }
        this.commitPlayerInventory(player, slots);
        this.sendInventoryEvent(client, {
          kind: "success",
          message: `Drew ${amount} fresh water from ${townProp.name.toLowerCase()}.`,
        });
        this.markPersistenceDirty();
        return;
      }
      const building = this.allBuildings()
        .filter(
          (candidate) => distanceBetween(player, candidate.exterior.entrance)
            <= candidate.exterior.interactionRadius,
        )
        .sort(
          (left, right) => distanceBetween(player, left.exterior.entrance)
            - distanceBetween(player, right.exterior.entrance),
        )[0];
      if (building) {
        this.ensureBuildingContainers(building);
        this.movePlayerToSpace(
          client.sessionId,
          building.interior.spaceId,
          building.interior.entrancePosition,
        );
      }
      return;
    }

    const building = this.ensureBuildingForSpace(player.spaceId);
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

  private ensureResourcesAround(x: number, y: number): void {
    const centerChunkX = worldToChunk(x);
    const centerChunkY = worldToChunk(y);
    for (
      let chunkY = centerChunkY - RESOURCE_CHUNK_RADIUS;
      chunkY <= centerChunkY + RESOURCE_CHUNK_RADIUS;
      chunkY += 1
    ) {
      for (
        let chunkX = centerChunkX - RESOURCE_CHUNK_RADIUS;
        chunkX <= centerChunkX + RESOURCE_CHUNK_RADIUS;
        chunkX += 1
      ) {
        const chunkKey = `${chunkX}:${chunkY}`;
        if (this.loadedResourceChunks.has(chunkKey)) {
          continue;
        }
        this.loadedResourceChunks.add(chunkKey);
        generateChunkResources(this.state.seed, chunkX, chunkY).forEach((definition) => {
          const overlapsBuilding = this.allBuildings().some((building) => {
            const collider = building.exterior.collider;
            return definition.x >= collider.x - 48
              && definition.x <= collider.x + collider.width + 48
              && definition.y >= collider.y - 48
              && definition.y <= collider.y + collider.height + 48;
          });
          const resourceCollider = resourceCollisionRect(
            definition.kind,
            definition.x,
            definition.y,
          );
          const overlapsStructure = [...this.state.structures.values()].some((structure) => (
            isBuildableId(structure.buildableId)
            && isBuildOrientation(structure.orientation)
            && rectanglesOverlap(
              resourceCollider,
              buildableCollider(
                BUILDABLES[structure.buildableId],
                structure.x,
                structure.y,
                structure.orientation,
              ),
              6,
            )
          ));
          const overlapsZombieSpawn = ZOMBIE_SPAWNS.some(
            (spawn) => distanceBetween(definition, spawn.position) < 70,
          );
          if (
            overlapsBuilding
            || overlapsStructure
            || overlapsZombieSpawn
            || this.state.resources.has(definition.id)
          ) {
            return;
          }
          const resource = new ResourceNodeState();
          resource.id = definition.id;
          resource.kind = definition.kind;
          resource.variant = definition.variant;
          resource.x = definition.x;
          resource.y = definition.y;
          const persisted = this.persistedResources.get(resource.id);
          if (persisted && !persisted.available && persisted.respawnAt > Date.now()) {
            resource.available = false;
            resource.respawnAt = persisted.respawnAt;
          }
          this.state.resources.set(resource.id, resource);
        });
      }
    }
  }

  private nearestHarvestableResource(player: PlayerState): ResourceNodeState | undefined {
    return [...this.state.resources.values()]
      .filter((resource) => resource.available
        && !resource.harvestingBy
        && distanceBetween(player, resource) <= RESOURCE_INTERACTION_RADIUS)
      .sort((left, right) => distanceBetween(player, left) - distanceBetween(player, right))[0];
  }

  private startHarvest(sessionId: string, resource: ResourceNodeState): void {
    const player = this.state.players.get(sessionId);
    if (!player || !resource.available || resource.harvestingBy) {
      return;
    }
    player.activeSearchId = resource.id;
    player.sprinting = false;
    resource.harvestingBy = sessionId;
    resource.harvestingByName = player.name;
    resource.harvestStartedAt = Date.now();
    resource.harvestDurationMs = resource.kind === "tree"
      ? TREE_HARVEST_DURATION_MS
      : STONE_HARVEST_DURATION_MS;
    resource.harvestProgress = 0;
  }

  private updateResources(now: number): void {
    this.state.resources.forEach((resource) => {
      if (!resource.available && resource.respawnAt > 0 && now >= resource.respawnAt) {
        resource.available = true;
        resource.respawnAt = 0;
        this.persistedResources.delete(resource.id);
        this.markPersistenceDirty();
      }
      if (!resource.harvestingBy) {
        return;
      }
      const player = this.state.players.get(resource.harvestingBy);
      if (
        !player
        || player.activeSearchId !== resource.id
        || player.spaceId !== OVERWORLD_SPACE_ID
        || !resource.available
        || distanceBetween(player, resource) > RESOURCE_INTERACTION_RADIUS
      ) {
        this.clearResourceHarvest(resource);
        return;
      }
      resource.harvestProgress = calculateSearchProgress(
        now,
        resource.harvestStartedAt,
        resource.harvestDurationMs,
      );
      if (resource.harvestProgress >= 1) {
        this.completeHarvest(player, resource, now);
      }
    });
  }

  private completeHarvest(player: PlayerState, resource: ResourceNodeState, now: number): void {
    const itemId = resource.kind === "tree" ? "wood" : "stone";
    const amount = (resource.kind === "tree" ? 4 : 3) + resource.variant;
    const slots = this.playerInventory(player);
    if (addInventoryItem(slots, itemId, amount) !== amount) {
      this.clearResourceHarvest(resource);
      const client = this.clients.find((candidate) => candidate.sessionId === player.id);
      if (client) {
        this.sendInventoryEvent(client, { kind: "error", message: "Your field pack is full." });
      }
      return;
    }
    this.commitPlayerInventory(player, slots);
    player.activeSearchId = "";
    resource.available = false;
    resource.respawnAt = now + RESOURCE_RESPAWN_MS;
    const client = this.clients.find((candidate) => candidate.sessionId === player.id);
    if (client) {
      this.sendInventoryEvent(client, {
        kind: "success",
        message: `Harvested ${amount} ${itemId}.`,
      });
    }
    this.clearResourceHarvest(resource);
    this.persistedResources.set(resource.id, {
      id: resource.id,
      available: false,
      respawnAt: resource.respawnAt,
    });
    this.markPersistenceDirty();
  }

  private clearResourceHarvest(resource: ResourceNodeState): void {
    const player = this.state.players.get(resource.harvestingBy);
    if (player?.activeSearchId === resource.id) {
      player.activeSearchId = "";
    }
    resource.harvestingBy = "";
    resource.harvestingByName = "";
    resource.harvestStartedAt = 0;
    resource.harvestDurationMs = 0;
    resource.harvestProgress = 0;
  }

  private nearestSearchableContainer(player: PlayerState): SearchableContainerDefinition | undefined {
    const building = this.ensureBuildingForSpace(player.spaceId);
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
      const definition = this.containerDefinition(container.id);
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
    if (!this.applyLoot(player, definition.loot)) {
      this.clearContainerSearch(container);
      const client = this.clients.find((candidate) => candidate.sessionId === player.id);
      if (client) {
        this.sendInventoryEvent(client, { kind: "error", message: "Your field pack is full." });
      }
      return;
    }
    container.opened = true;
    container.searchedBy = player.name;
    player.activeSearchId = "";
    this.clearContainerSearch(container);
    this.markPersistenceDirty();
  }

  private applyLoot(
    player: PlayerState,
    loot: Readonly<Partial<Record<LootItemId, number>>>,
  ): boolean {
    const slots = this.playerInventory(player);
    if (!addInventoryBundle(slots, loot as InventoryBundle)) {
      return false;
    }
    this.commitPlayerInventory(player, slots);
    return true;
  }

  private collectPickup(client: Client, player: PlayerState, pickup: WorldPickupState): void {
    if (!isItemId(pickup.itemId)) {
      return;
    }
    const slots = this.playerInventory(player);
    if (addInventoryItem(slots, pickup.itemId, pickup.quantity) !== pickup.quantity) {
      this.sendInventoryEvent(client, { kind: "error", message: "Your field pack is full." });
      return;
    }
    this.commitPlayerInventory(player, slots);
    this.state.pickups.delete(pickup.id);
    this.sendInventoryEvent(client, {
      kind: "success",
      message: `Picked up ${pickup.quantity} ${ITEMS[pickup.itemId].name.toLowerCase()}.`,
    });
    this.markPersistenceDirty();
  }

  private cancelSearch(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (!player?.activeSearchId) {
      return;
    }

    const container = this.state.containers.get(player.activeSearchId);
    const resource = this.state.resources.get(player.activeSearchId);
    player.activeSearchId = "";
    if (container?.searchingBy === sessionId) {
      this.clearContainerSearch(container);
    }
    if (resource?.harvestingBy === sessionId) {
      this.clearResourceHarvest(resource);
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
    const restoredBuilding = this.ensureBuildingForSpace(persisted.spaceId);
    player.spaceId = restoredBuilding ? persisted.spaceId : OVERWORLD_SPACE_ID;
    if (restoredBuilding) {
      this.ensureBuildingContainers(restoredBuilding);
    }
    player.maxHealth = PLAYER_MAX_HEALTH;
    player.health = Math.max(1, Math.min(player.maxHealth, inventoryCount(persisted.health)));
    player.maxStamina = PLAYER_MAX_STAMINA;
    player.stamina = Math.max(0, Math.min(
      player.maxStamina,
      finiteNumber(persisted.stamina, player.maxStamina),
    ));
    player.flashlight = persisted.flashlight === true;
    this.initializePlayerInventory(player, persisted.inventory.slots);
  }

  private captureSurvivor(player: PlayerState): void {
    const inventory: PersistedInventory = {
      slots: [...player.inventorySlots]
        .filter((slot) => isItemId(slot.itemId) && slot.quantity > 0)
        .map((slot) => ({
          index: slot.index,
          itemId: slot.itemId,
          quantity: slot.quantity,
        })),
    };
    this.persistedSurvivors.set(player.survivorId, {
      survivorId: player.survivorId,
      name: player.name,
      x: player.x,
      y: player.y,
      facing: player.facing,
      spaceId: player.spaceId,
      health: player.health,
      stamina: player.stamina,
      flashlight: player.flashlight,
      starterKitGranted: this.starterKitsGranted.has(player.survivorId),
      inventory,
      updatedAt: new Date().toISOString(),
    });
  }

  private buildPersistentWorld(): PersistedWorld {
    this.state.players.forEach((player) => this.captureSurvivor(player));
    const survivors = Object.fromEntries(this.persistedSurvivors.entries());
    const containers: PersistedWorld["containers"] = Object.fromEntries(
      this.persistedContainers.entries(),
    );
    this.state.containers.forEach((container) => {
      const persisted = {
        id: container.id,
        opened: container.opened,
        searchedBy: container.searchedBy,
      };
      containers[container.id] = persisted;
      this.persistedContainers.set(container.id, persisted);
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
    const pickups: PersistedWorld["pickups"] = {};
    this.state.pickups.forEach((pickup) => {
      pickups[pickup.id] = {
        id: pickup.id,
        itemId: pickup.itemId,
        quantity: pickup.quantity,
        x: pickup.x,
        y: pickup.y,
        spaceId: pickup.spaceId,
        droppedBy: pickup.droppedBy,
      };
    });
    const structures: PersistedWorld["structures"] = {};
    this.state.structures.forEach((structure) => {
      if (!isBuildableId(structure.buildableId) || !isBuildOrientation(structure.orientation)) {
        return;
      }
      structures[structure.id] = {
        id: structure.id,
        buildableId: structure.buildableId,
        x: structure.x,
        y: structure.y,
        orientation: structure.orientation,
        placedBy: structure.placedBy,
      };
    });
    const resources: PersistedWorld["resources"] = {};
    this.state.resources.forEach((resource) => {
      if (!resource.available && resource.respawnAt > 0) {
        resources[resource.id] = {
          id: resource.id,
          available: false,
          respawnAt: resource.respawnAt,
        };
      }
    });

    return {
      worldId: this.state.worldId,
      seed: this.state.seed,
      survivors,
      containers,
      zombies,
      pickups,
      structures,
      resources,
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
