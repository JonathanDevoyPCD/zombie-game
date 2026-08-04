import {
  ALL_BUILDING_CONTAINERS,
  BIOMES,
  BUILDINGS,
  OVERWORLD_SPACE_ID,
  PLAYER_COLLISION_RADIUS,
  STARTING_SAFE_ZONE_RADIUS,
  buildingByInteriorSpace,
  buildingContainerById,
  movementEnvironmentForSpace,
  type ResolvedBuildingDefinition,
} from "@last-survivor/content";
import {
  INPUT_STEP_SECONDS,
  type CombatEvent,
  type ContainerSnapshot,
  type InventorySnapshot,
  type MovementInput,
  type PlayerSnapshot,
  type ZombieSnapshot,
} from "@last-survivor/shared";
import { integrateMovementWithCollisions } from "@last-survivor/simulation";
import {
  CHUNK_SIZE,
  CHUNK_TILES,
  TILE_SIZE,
  generateChunk,
  sampleTile,
  worldToChunk,
} from "@last-survivor/worldgen";
import Phaser from "phaser";
import { getOrCreateSurvivorId } from "../identity/survivorIdentity";
import { WorldConnection, type WorldSnapshot } from "../network/WorldConnection";
import {
  hideInteractionPrompt,
  showCombatNotification,
  showLootNotification,
  showInteractionPrompt,
  updateAreaReadout,
  updateConnectionStatus,
  updateFrameRate,
  updateHealth,
  updateInventory,
  updateWorldReadout,
} from "../ui/hud";

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  targetX: number;
  targetY: number;
  spaceId: string;
  activeSearchId: string;
  depthOffset: number;
  searchBarBackground: Phaser.GameObjects.Rectangle;
  searchBarFill: Phaser.GameObjects.Rectangle;
  searchLabel: Phaser.GameObjects.Text;
  facingMarker: Phaser.GameObjects.Triangle;
}

interface ZombieVisual {
  container: Phaser.GameObjects.Container;
  targetX: number;
  targetY: number;
  spaceId: string;
  alive: boolean;
  healthBarFill: Phaser.GameObjects.Rectangle;
}

interface ContainerVisual {
  object: Phaser.GameObjects.GameObject
    & Phaser.GameObjects.Components.Visible
    & { setAlpha(value: number): unknown };
  label: Phaser.GameObjects.Text;
}

type VisibleGameObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

const INPUT_STEP_MS = INPUT_STEP_SECONDS * 1000;
const MAX_PREDICTION_STEPS_PER_FRAME = 5;
const REMOTE_INTERPOLATION_RATE = 14;
const HOUSE_TEXTURE_KEY = "house-48-exterior";
const CHEST_TEXTURE_KEY = "house-48-chest";
const HOUSE_ASSET_URL = new URL(
  "../../../../sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - House.png",
  import.meta.url,
).href;
const CHEST_ASSET_URL = new URL(
  "../../../../sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Treasure Chest.png",
  import.meta.url,
).href;

function distanceBetween(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function stableDepthOffset(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash % 1000) / 10000;
}

export class GameScene extends Phaser.Scene {
  private readonly connection = new WorldConnection();
  private readonly playerVisuals = new Map<string, PlayerVisual>();
  private readonly zombieVisuals = new Map<string, ZombieVisual>();
  private readonly terrainChunks = new Map<string, Phaser.GameObjects.Image>();
  private readonly terrainTextureUsage = new Map<string, number>();
  private readonly containers = new Map<string, ContainerSnapshot>();
  private readonly containerVisuals = new Map<string, ContainerVisual>();
  private readonly exteriorBuildings: Phaser.GameObjects.Image[] = [];
  private readonly interiorObjectsBySpace = new Map<string, VisibleGameObject[]>();
  private cursors!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private safeZoneVisual!: Phaser.GameObjects.Graphics;
  private localSessionId = "";
  private currentSpaceId = OVERWORLD_SPACE_ID;
  private transitionTarget = "";
  private worldId = "dev-world";
  private worldSeed = "last-survivor:dev-world:v1";
  private renderedChunkX = Number.NaN;
  private renderedChunkY = Number.NaN;
  private sequence = 0;
  private fireSequence = 0;
  private inputAccumulator = 0;
  private pendingInputs: MovementInput[] = [];
  private lastAcknowledgedInput = 0;
  private cameraFollowingLocalPlayer = false;
  private terrainUsageCounter = 0;
  private performanceAccumulator = 0;
  private isTransitioning = false;
  private previousInventory: InventorySnapshot | null = null;
  private localHealth = 0;

  constructor() {
    super("world");
  }

  preload(): void {
    this.load.image(HOUSE_TEXTURE_KEY, HOUSE_ASSET_URL);
    this.load.image(CHEST_TEXTURE_KEY, CHEST_ASSET_URL);
  }

  create(): void {
    const requestedWorldId = new URLSearchParams(window.location.search).get("world");
    this.worldId = requestedWorldId?.trim() || "dev-world";
    this.cursors = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0) {
        this.fireAtPointer(pointer);
      }
    });

    this.cameras.main.setBackgroundColor(0x101713);
    this.cameras.main.setZoom(1.35);
    this.createExteriorObjects();
    this.createInteriorObjects();
    this.renderTerrain(0, 0);
    this.applySpacePresentation();

    void this.connection
      .connect(
        {
          worldId: this.worldId,
          survivorId: getOrCreateSurvivorId(),
          playerName: `Survivor ${Math.floor(Math.random() * 900 + 100)}`,
        },
        (snapshot) => this.applySnapshot(snapshot),
        (event) => this.handleCombatEvent(event),
      )
      .catch((error: unknown) => {
        console.error("Unable to connect to world server", error);
        updateConnectionStatus(false);
      });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => void this.connection.disconnect());
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && !this.isTransitioning) {
      this.connection.interact();
    }

    this.processLocalInput(delta);
    this.updatePerformanceReadout(delta);
    this.updateRemotePlayers(delta);
    this.updateZombies(delta);
    this.updatePlayerDepths();
    this.updateZombieDepths();
    this.updateSearchProgressBars();

    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (localPlayer) {
      this.updateLocalAim(localPlayer);
      this.updateLocalPresentation(localPlayer);
    }
  }

  private createExteriorObjects(): void {
    this.safeZoneVisual = this.add.graphics().setDepth(-9000);
    this.safeZoneVisual.fillStyle(0xc6d67a, 0.1);
    this.safeZoneVisual.fillCircle(0, 0, STARTING_SAFE_ZONE_RADIUS);
    this.safeZoneVisual.lineStyle(2, 0xdce69a, 0.36);
    this.safeZoneVisual.strokeCircle(0, 0, STARTING_SAFE_ZONE_RADIUS);
    BUILDINGS.forEach((building) => {
      const image = this.add
        .image(building.exterior.position.x, building.exterior.position.y, HOUSE_TEXTURE_KEY)
        .setOrigin(0.5, 1)
        .setDepth(building.exterior.position.y);
      image.setScale(building.exterior.displayWidth / image.width);
      this.exteriorBuildings.push(image);
    });
  }

  private fireAtPointer(pointer: Phaser.Input.Pointer): void {
    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (
      !localPlayer
      || this.currentSpaceId !== OVERWORLD_SPACE_ID
      || this.isTransitioning
      || localPlayer.activeSearchId
    ) {
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const angle = Math.atan2(
      worldPoint.y - localPlayer.container.y,
      worldPoint.x - localPlayer.container.x,
    );
    localPlayer.facingMarker.setRotation(angle);
    this.fireSequence += 1;
    this.connection.fire({ sequence: this.fireSequence, angle });
  }

  private updateLocalAim(localPlayer: PlayerVisual): void {
    if (this.currentSpaceId !== OVERWORLD_SPACE_ID) {
      return;
    }
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    localPlayer.facingMarker.setRotation(Math.atan2(
      worldPoint.y - localPlayer.container.y,
      worldPoint.x - localPlayer.container.x,
    ));
  }

  private handleCombatEvent(event: CombatEvent): void {
    if (event.kind === "shot" && this.currentSpaceId === OVERWORLD_SPACE_ID) {
      const tracer = this.add.graphics().setDepth(20000);
      tracer.lineStyle(2, event.amount > 0 ? 0xf3cf6a : 0xd8d2ad, 0.9);
      tracer.lineBetween(event.originX, event.originY - 4, event.targetX, event.targetY);
      const impact = this.add
        .circle(event.targetX, event.targetY, event.amount > 0 ? 4 : 2, 0xf3cf6a, 0.9)
        .setDepth(20001);
      this.tweens.add({
        targets: [tracer, impact],
        alpha: 0,
        duration: 110,
        onComplete: () => {
          tracer.destroy();
          impact.destroy();
        },
      });
      return;
    }

    if (event.kind === "player-hit" && event.targetId === this.localSessionId) {
      this.cameras.main.flash(70, 130, 25, 20, false);
      return;
    }

    if (event.kind === "zombie-killed" || event.kind === "player-respawned") {
      showCombatNotification(event.message);
    }
  }

  private createInteriorObjects(): void {
    BUILDINGS.forEach((building) => this.createBuildingInterior(building));
  }

  private createBuildingInterior(building: ResolvedBuildingDefinition): void {
    const bounds = building.interior.bounds;
    const interiorObjects: VisibleGameObject[] = [];
    const floor = this.add.graphics().setDepth(-10000);
    floor.fillStyle(0x795f43, 1);
    floor.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    floor.lineStyle(1, 0x957858, 0.45);
    for (let y = bounds.y + 16; y < bounds.y + bounds.height; y += 24) {
      floor.lineBetween(bounds.x, y, bounds.x + bounds.width, y);
    }

    const backWalls = this.add.graphics().setDepth(-9000);
    backWalls.fillStyle(0x343d36, 1);
    backWalls.fillRect(bounds.x - 12, bounds.y - 12, bounds.width + 24, 30);
    backWalls.fillRect(bounds.x - 12, bounds.y, 24, bounds.height);
    backWalls.fillRect(bounds.x + bounds.width - 12, bounds.y, 24, bounds.height);

    const rug = this.add.rectangle(0, 22, 126, 76, 0x6e3f34, 0.72).setDepth(22);
    rug.setStrokeStyle(3, 0xa88058, 0.8);

    const deskDefinition = building.interior.containers.find(
      (container) => container.prefabContainerKey === "desk:01",
    );
    const cupboardDefinition = building.interior.containers.find(
      (container) => container.prefabContainerKey === "cupboard:01",
    );
    const chestDefinition = building.interior.containers.find(
      (container) => container.prefabContainerKey === "chest:01",
    );
    if (!deskDefinition || !cupboardDefinition || !chestDefinition) {
      throw new Error(`Building prefab ${building.prefabId} is missing required container visuals`);
    }

    const tableCollider = deskDefinition.collider;
    const table = this.add.graphics().setDepth(tableCollider.y + tableCollider.height);
    table.fillStyle(0x4e3328, 1);
    table.fillRoundedRect(
      tableCollider.x,
      tableCollider.y,
      tableCollider.width,
      tableCollider.height,
      4,
    );
    table.lineStyle(3, 0x2d211c, 1);
    table.strokeRoundedRect(
      tableCollider.x,
      tableCollider.y,
      tableCollider.width,
      tableCollider.height,
      4,
    );

    const deskLabel = this.add
      .text(deskDefinition.position.x, deskDefinition.position.y - 29, "WRITING DESK", {
        color: "#d8c98e",
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        stroke: "#161b18",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(deskDefinition.position.y + 0.01);

    const cabinetCollider = cupboardDefinition.collider;
    const cabinet = this.add.graphics().setDepth(cabinetCollider.y + cabinetCollider.height);
    cabinet.fillStyle(0x674937, 1);
    cabinet.fillRect(
      cabinetCollider.x,
      cabinetCollider.y,
      cabinetCollider.width,
      cabinetCollider.height,
    );
    cabinet.lineStyle(2, 0x2d211c, 1);
    cabinet.strokeRect(
      cabinetCollider.x,
      cabinetCollider.y,
      cabinetCollider.width,
      cabinetCollider.height,
    );

    const cupboardLabel = this.add
      .text(cupboardDefinition.position.x, cupboardDefinition.position.y - 25, "CUPBOARD", {
        color: "#d8c98e",
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        stroke: "#161b18",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(cupboardDefinition.position.y + 0.01);

    const interiorChest = this.add
      .image(
        chestDefinition.position.x,
        chestDefinition.position.y,
        CHEST_TEXTURE_KEY,
      )
      .setOrigin(0.5, 1)
      .setDepth(chestDefinition.position.y);
    interiorChest.setScale(52 / interiorChest.width);

    const interiorChestLabel = this.add
      .text(
        chestDefinition.position.x,
        chestDefinition.position.y - 48,
        "SUPPLY CHEST",
        {
          color: "#d8c98e",
          fontFamily: "Arial, sans-serif",
          fontSize: "9px",
          stroke: "#161b18",
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(chestDefinition.position.y + 0.01);

    this.containerVisuals.set(deskDefinition.id, { object: table, label: deskLabel });
    this.containerVisuals.set(cupboardDefinition.id, { object: cabinet, label: cupboardLabel });
    this.containerVisuals.set(chestDefinition.id, {
      object: interiorChest,
      label: interiorChestLabel,
    });

    const frontWall = this.add.graphics().setDepth(10000);
    frontWall.fillStyle(0x2b342e, 1);
    frontWall.fillRect(bounds.x - 12, bounds.y + bounds.height - 14, 174, 26);
    frontWall.fillRect(62, bounds.y + bounds.height - 14, 174, 26);

    const locationTitle = this.add
      .text(0, bounds.y + 42, building.name.toUpperCase(), {
        color: "#d7cda8",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
      })
      .setOrigin(0.5)
      .setDepth(-8000);

    interiorObjects.push(
      floor,
      backWalls,
      rug,
      table,
      deskLabel,
      cabinet,
      cupboardLabel,
      interiorChest,
      interiorChestLabel,
      frontWall,
      locationTitle,
    );
    this.interiorObjectsBySpace.set(building.interior.spaceId, interiorObjects);
  }

  private processLocalInput(delta: number): void {
    const maximumAccumulatedTime = INPUT_STEP_MS * MAX_PREDICTION_STEPS_PER_FRAME;
    this.inputAccumulator = Math.min(
      this.inputAccumulator + Math.min(delta, maximumAccumulatedTime),
      maximumAccumulatedTime,
    );
    let predictionSteps = 0;

    while (
      this.inputAccumulator >= INPUT_STEP_MS
      && predictionSteps < MAX_PREDICTION_STEPS_PER_FRAME
    ) {
      const input = this.readInput();
      if (this.connection.sendInput(input)) {
        this.pendingInputs.push(input);
        this.predictLocalInput(input);
      }

      this.inputAccumulator -= INPUT_STEP_MS;
      predictionSteps += 1;
    }
  }

  private readInput(): MovementInput {
    this.sequence += 1;
    const localPlayer = this.playerVisuals.get(this.localSessionId);
    const acceptMovement = !this.isTransitioning && !localPlayer?.activeSearchId;
    return {
      sequence: this.sequence,
      up: acceptMovement && this.cursors.up.isDown,
      down: acceptMovement && this.cursors.down.isDown,
      left: acceptMovement && this.cursors.left.isDown,
      right: acceptMovement && this.cursors.right.isDown,
    };
  }

  private updatePerformanceReadout(delta: number): void {
    this.performanceAccumulator += delta;
    if (this.performanceAccumulator >= 500) {
      this.performanceAccumulator = 0;
      updateFrameRate(this.game.loop.actualFps);
    }
  }

  private updateRemotePlayers(delta: number): void {
    const remoteBlend = 1 - Math.exp(-REMOTE_INTERPOLATION_RATE * (delta / 1000));
    this.playerVisuals.forEach((visual, id) => {
      if (id === this.localSessionId) {
        return;
      }

      visual.container.x = Phaser.Math.Linear(visual.container.x, visual.targetX, remoteBlend);
      visual.container.y = Phaser.Math.Linear(visual.container.y, visual.targetY, remoteBlend);
    });
  }

  private updateZombies(delta: number): void {
    const blend = 1 - Math.exp(-REMOTE_INTERPOLATION_RATE * (delta / 1000));
    this.zombieVisuals.forEach((visual) => {
      visual.container.x = Phaser.Math.Linear(visual.container.x, visual.targetX, blend);
      visual.container.y = Phaser.Math.Linear(visual.container.y, visual.targetY, blend);
    });
  }

  private updatePlayerDepths(): void {
    this.playerVisuals.forEach((visual) => {
      visual.container.setDepth(visual.container.y + visual.depthOffset);
    });
  }

  private updateZombieDepths(): void {
    this.zombieVisuals.forEach((visual) => visual.container.setDepth(visual.container.y + 0.02));
  }

  private updateSearchProgressBars(): void {
    this.playerVisuals.forEach((visual, playerId) => {
      const activeContainer = [...this.containers.values()].find(
        (container) => container.searchingBy === playerId,
      );
      const isSearching = Boolean(activeContainer && !activeContainer.opened);
      visual.searchBarBackground.setVisible(isSearching);
      visual.searchBarFill.setVisible(isSearching);
      visual.searchLabel.setVisible(isSearching);

      if (!activeContainer) {
        return;
      }

      const progress = activeContainer.searchProgress;
      visual.searchBarFill.setScale(progress, 1);
      visual.searchLabel.setText(`SEARCHING ${Math.round(progress * 100)}%`);
    });
  }

  private updateLocalPresentation(localPlayer: PlayerVisual): void {
    const localX = localPlayer.container.x;
    const localY = localPlayer.container.y;

    if (this.currentSpaceId === OVERWORLD_SPACE_ID) {
      const chunkX = worldToChunk(localX);
      const chunkY = worldToChunk(localY);
      if (chunkX !== this.renderedChunkX || chunkY !== this.renderedChunkY) {
        this.renderTerrain(chunkX, chunkY);
      }

      const tile = sampleTile(
        this.worldSeed,
        Math.floor(localX / TILE_SIZE),
        Math.floor(localY / TILE_SIZE),
      );
      updateWorldReadout(this.worldId, tile.biome, this.playersInCurrentSpace());
    } else {
      const building = buildingByInteriorSpace(this.currentSpaceId);
      updateAreaReadout(
        this.worldId,
        building?.name ?? "Unknown interior",
        this.playersInCurrentSpace(),
      );
    }

    this.updateInteractionPrompt(localX, localY);
    const gameElement = document.getElementById("game");
    if (gameElement) {
      gameElement.dataset.playerX = localX.toFixed(2);
      gameElement.dataset.playerY = localY.toFixed(2);
      gameElement.dataset.playerSpace = localPlayer.spaceId;
      gameElement.dataset.activeSearch = localPlayer.activeSearchId;
      gameElement.dataset.inputSequence = String(this.sequence);
      gameElement.dataset.acknowledgedInput = String(this.lastAcknowledgedInput);
      gameElement.dataset.pendingInputs = String(this.pendingInputs.length);
      gameElement.dataset.health = String(this.localHealth);
      gameElement.dataset.visibleZombies = String(
        [...this.zombieVisuals.values()].filter((zombie) => zombie.container.visible).length,
      );
    }
  }

  private updateInteractionPrompt(x: number, y: number): void {
    if (this.isTransitioning) {
      hideInteractionPrompt();
      return;
    }

    const playerPosition = { x, y };
    if (this.currentSpaceId === OVERWORLD_SPACE_ID) {
      const nearbyBuilding = BUILDINGS
        .filter(
          (building) => distanceBetween(playerPosition, building.exterior.entrance)
            <= building.exterior.interactionRadius,
        )
        .sort(
          (left, right) => distanceBetween(playerPosition, left.exterior.entrance)
            - distanceBetween(playerPosition, right.exterior.entrance),
        )[0];
      if (nearbyBuilding) {
        showInteractionPrompt(`Enter ${nearbyBuilding.name}`);
      } else {
        hideInteractionPrompt();
      }
      return;
    }

    const building = buildingByInteriorSpace(this.currentSpaceId);
    if (!building) {
      hideInteractionPrompt();
      return;
    }

    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (localPlayer?.activeSearchId) {
      const definition = buildingContainerById(localPlayer.activeSearchId);
      showInteractionPrompt(`Cancel searching ${definition?.name.toLowerCase() ?? "container"}`);
      return;
    }

    if (
      distanceBetween(playerPosition, building.interior.exit)
      <= building.interior.interactionRadius
    ) {
      showInteractionPrompt(`Leave ${building.name}`);
      return;
    }

    const nearbyContainer = building.interior.containers
      .filter(
        (definition) => distanceBetween(playerPosition, definition.position)
          <= definition.interactionRadius,
      )
      .sort(
        (left, right) => distanceBetween(playerPosition, left.position)
          - distanceBetween(playerPosition, right.position),
      )[0];
    if (nearbyContainer) {
      const state = this.containers.get(nearbyContainer.id);
      if (state?.opened) {
        showInteractionPrompt(`Searched by ${state.searchedBy || "another survivor"}`, false);
      } else if (state?.searchingBy) {
        showInteractionPrompt(`Being searched by ${state.searchingByName}`, false);
      } else {
        const seconds = Math.ceil(nearbyContainer.searchDurationMs / 1000);
        showInteractionPrompt(`Search ${nearbyContainer.name.toLowerCase()} (${seconds}s)`);
      }
      return;
    }

    hideInteractionPrompt();
  }

  private applySnapshot(snapshot: WorldSnapshot): void {
    updateConnectionStatus(snapshot.connected);
    if (!snapshot.connected) {
      this.pendingInputs = [];
      this.previousInventory = null;
      this.cameraFollowingLocalPlayer = false;
      this.cameras.main.stopFollow();
      hideInteractionPrompt();
      return;
    }

    this.localSessionId = snapshot.sessionId;
    this.worldId = snapshot.worldId;
    if (this.worldSeed !== snapshot.seed) {
      this.worldSeed = snapshot.seed;
      this.clearTerrainImages();
      this.renderedChunkX = Number.NaN;
      this.renderedChunkY = Number.NaN;
    }

    this.containers.clear();
    snapshot.containers.forEach((container) => this.containers.set(container.id, container));
    this.updateContainerPresentation();

    const activeZombieIds = new Set(snapshot.zombies.map((zombie) => zombie.id));
    snapshot.zombies.forEach((zombie) => this.upsertZombie(zombie));
    this.zombieVisuals.forEach((visual, id) => {
      if (!activeZombieIds.has(id)) {
        visual.container.destroy();
        this.zombieVisuals.delete(id);
      }
    });
    const gameElement = document.getElementById("game");
    if (gameElement) {
      gameElement.dataset.zombies = JSON.stringify(snapshot.zombies.map((zombie) => ({
        id: zombie.id,
        x: zombie.x,
        y: zombie.y,
        health: zombie.health,
        alive: zombie.alive,
        aggroTarget: zombie.aggroTarget,
      })));
    }

    const current = snapshot.players.find((player) => player.id === snapshot.sessionId);
    const localSpaceChanged = Boolean(current && current.spaceId !== this.currentSpaceId);
    if (localSpaceChanged) {
      this.pendingInputs = [];
    }

    const activeIds = new Set(snapshot.players.map((player) => player.id));
    snapshot.players.forEach((player) => this.upsertPlayer(player));
    this.playerVisuals.forEach((visual, id) => {
      if (!activeIds.has(id)) {
        visual.container.destroy();
        this.playerVisuals.delete(id);
      }
    });

    if (current) {
      this.localHealth = current.health;
      this.updateInventoryPresentation(current.inventory);
      updateHealth(current.health, current.maxHealth);
      this.reconcileLocalPlayer(current);
      if (localSpaceChanged) {
        this.transitionToSpace(current.spaceId);
      }
    }

    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (localPlayer && !this.cameraFollowingLocalPlayer) {
      this.cameras.main.startFollow(localPlayer.container, true, 1, 1);
      this.cameraFollowingLocalPlayer = true;
    }

    this.updatePlayerVisibility();
  }

  private upsertPlayer(player: PlayerSnapshot): void {
    const existing = this.playerVisuals.get(player.id);
    if (existing) {
      existing.spaceId = player.spaceId;
      existing.activeSearchId = player.activeSearchId;
      existing.facingMarker.setRotation(player.facing);
      if (player.id !== this.localSessionId || existing.spaceId !== this.currentSpaceId) {
        existing.targetX = player.x;
        existing.targetY = player.y;
      }
      return;
    }

    const isLocal = player.id === this.localSessionId;
    const shadow = this.add.ellipse(0, 13, 25, 9, 0x08100c, 0.35);
    const body = this.add.rectangle(0, 0, 18, 24, isLocal ? 0xd6b657 : 0x7ba9bb).setStrokeStyle(2, 0x101713);
    const head = this.add.circle(0, -17, 7, 0xd7a47e).setStrokeStyle(2, 0x101713);
    const facing = this.add.triangle(0, 0, 0, -4, 12, 0, 0, 4, 0xece9d8)
      .setPosition(15, 0)
      .setRotation(player.facing);
    const label = this.add
      .text(0, -34, player.name, {
        color: "#f2f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        stroke: "#101713",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const searchBarBackground = this.add
      .rectangle(0, -50, 44, 7, 0x101713, 0.92)
      .setStrokeStyle(1, 0x718078)
      .setVisible(false);
    const searchBarFill = this.add
      .rectangle(-20, -50, 40, 3, 0xe3cb70)
      .setOrigin(0, 0.5)
      .setVisible(false);
    const searchLabel = this.add
      .text(0, -58, "SEARCHING 0%", {
        color: "#f2f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "7px",
        stroke: "#101713",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setVisible(false);
    const container = this.add.container(player.x, player.y, [
      shadow,
      body,
      head,
      facing,
      label,
      searchBarBackground,
      searchBarFill,
      searchLabel,
    ]);

    this.playerVisuals.set(player.id, {
      container,
      targetX: player.x,
      targetY: player.y,
      spaceId: player.spaceId,
      activeSearchId: player.activeSearchId,
      depthOffset: stableDepthOffset(player.id),
      searchBarBackground,
      searchBarFill,
      searchLabel,
      facingMarker: facing,
    });
  }

  private upsertZombie(zombie: ZombieSnapshot): void {
    const existing = this.zombieVisuals.get(zombie.id);
    if (existing) {
      existing.targetX = zombie.x;
      existing.targetY = zombie.y;
      existing.spaceId = zombie.spaceId;
      existing.alive = zombie.alive;
      existing.container.setVisible(zombie.alive && zombie.spaceId === this.currentSpaceId);
      existing.healthBarFill.setScale(Math.max(0, zombie.health / zombie.maxHealth), 1);
      return;
    }

    const shadow = this.add.ellipse(0, 13, 27, 9, 0x08100c, 0.38);
    const body = this.add.ellipse(0, 0, 18, 28, 0x596547).setStrokeStyle(2, 0x172019);
    const head = this.add.circle(-1, -17, 7, 0x809263).setStrokeStyle(2, 0x172019);
    const arms = this.add.graphics();
    arms.lineStyle(4, 0x667653, 1);
    arms.lineBetween(-7, -3, -14, 8);
    arms.lineBetween(7, -3, 15, 5);
    const label = this.add
      .text(0, -42, zombie.name.toUpperCase(), {
        color: "#d3d9bc",
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        stroke: "#101713",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const healthBackground = this.add.rectangle(0, -32, 34, 5, 0x1b211d, 0.95);
    const healthBarFill = this.add
      .rectangle(-16, -32, 32, 3, 0xb9574f)
      .setOrigin(0, 0.5)
      .setScale(Math.max(0, zombie.health / zombie.maxHealth), 1);
    const container = this.add.container(zombie.x, zombie.y, [
      shadow,
      body,
      head,
      arms,
      label,
      healthBackground,
      healthBarFill,
    ]);
    container.setVisible(zombie.alive && zombie.spaceId === this.currentSpaceId);
    this.zombieVisuals.set(zombie.id, {
      container,
      targetX: zombie.x,
      targetY: zombie.y,
      spaceId: zombie.spaceId,
      alive: zombie.alive,
      healthBarFill,
    });
  }

  private predictLocalInput(input: MovementInput): void {
    const visual = this.playerVisuals.get(this.localSessionId);
    if (!visual) {
      return;
    }

    const predicted = integrateMovementWithCollisions(
      visual.container,
      input,
      INPUT_STEP_SECONDS,
      PLAYER_COLLISION_RADIUS,
      movementEnvironmentForSpace(visual.spaceId),
    );
    visual.container.setPosition(predicted.x, predicted.y);
    visual.targetX = predicted.x;
    visual.targetY = predicted.y;
  }

  private reconcileLocalPlayer(authoritative: PlayerSnapshot): void {
    const visual = this.playerVisuals.get(this.localSessionId);
    if (!visual) {
      return;
    }

    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.sequence > authoritative.lastProcessedInput,
    );
    this.lastAcknowledgedInput = authoritative.lastProcessedInput;

    let reconciled = { x: authoritative.x, y: authoritative.y };
    this.pendingInputs.forEach((input) => {
      reconciled = integrateMovementWithCollisions(
        reconciled,
        input,
        INPUT_STEP_SECONDS,
        PLAYER_COLLISION_RADIUS,
        movementEnvironmentForSpace(authoritative.spaceId),
      );
    });

    visual.container.setPosition(reconciled.x, reconciled.y);
    visual.targetX = reconciled.x;
    visual.targetY = reconciled.y;
    visual.spaceId = authoritative.spaceId;
    visual.activeSearchId = authoritative.activeSearchId;
  }

  private transitionToSpace(spaceId: string): void {
    if (spaceId === this.currentSpaceId || spaceId === this.transitionTarget) {
      return;
    }

    this.transitionTarget = spaceId;
    this.isTransitioning = true;
    hideInteractionPrompt();
    this.cameras.main.fadeOut(140, 8, 12, 10);
    this.time.delayedCall(150, () => {
      this.currentSpaceId = spaceId;
      this.applySpacePresentation();
      this.transitionTarget = "";
      this.cameras.main.fadeIn(160, 8, 12, 10);
      this.time.delayedCall(170, () => {
        this.isTransitioning = false;
      });
    });
  }

  private applySpacePresentation(): void {
    const showExterior = this.currentSpaceId === OVERWORLD_SPACE_ID;
    this.exteriorBuildings.forEach((building) => building.setVisible(showExterior));
    this.safeZoneVisual.setVisible(showExterior);
    this.terrainChunks.forEach((image) => image.setVisible(showExterior));
    this.interiorObjectsBySpace.forEach((objects, spaceId) => {
      objects.forEach((object) => object.setVisible(spaceId === this.currentSpaceId));
    });
    this.cameras.main.setBackgroundColor(showExterior ? 0x101713 : 0x1b211d);
    this.updatePlayerVisibility();
  }

  private updatePlayerVisibility(): void {
    this.playerVisuals.forEach((visual) => {
      visual.container.setVisible(visual.spaceId === this.currentSpaceId);
    });
    this.zombieVisuals.forEach((visual) => {
      visual.container.setVisible(visual.alive && visual.spaceId === this.currentSpaceId);
    });
  }

  private updateContainerPresentation(): void {
    ALL_BUILDING_CONTAINERS.forEach((definition) => {
      const state = this.containers.get(definition.id);
      const visual = this.containerVisuals.get(definition.id);
      if (!visual) {
        return;
      }

      const opened = state?.opened === true;
      visual.object.setAlpha(opened ? 0.45 : 1);
      visual.label.setText(
        opened ? "SEARCHED" : state?.searchingBy ? "SEARCHING" : definition.name.toUpperCase(),
      );
    });
  }

  private updateInventoryPresentation(inventory: InventorySnapshot): void {
    updateInventory(inventory);
    if (this.previousInventory) {
      const labels: Record<keyof InventorySnapshot, string> = {
        scrap: "scrap",
        parts: "parts",
        food: "food",
        medicine: "medicine",
      };
      const gains = (Object.keys(labels) as Array<keyof InventorySnapshot>)
        .map((item) => ({ item, amount: inventory[item] - this.previousInventory![item] }))
        .filter((gain) => gain.amount > 0)
        .map((gain) => `+${gain.amount} ${labels[gain.item]}`);

      if (gains.length > 0) {
        showLootNotification(gains.join("  |  "));
      }
    }

    this.previousInventory = { ...inventory };
  }

  private playersInCurrentSpace(): number {
    let count = 0;
    this.playerVisuals.forEach((visual) => {
      if (visual.spaceId === this.currentSpaceId) {
        count += 1;
      }
    });
    return count;
  }

  private renderTerrain(centerChunkX: number, centerChunkY: number): void {
    this.renderedChunkX = centerChunkX;
    this.renderedChunkY = centerChunkY;
    const activeTextureKeys = new Set<string>();

    for (let chunkY = centerChunkY - 1; chunkY <= centerChunkY + 1; chunkY += 1) {
      for (let chunkX = centerChunkX - 1; chunkX <= centerChunkX + 1; chunkX += 1) {
        const textureKey = this.terrainTextureKey(chunkX, chunkY);
        activeTextureKeys.add(textureKey);
        this.terrainUsageCounter += 1;
        this.terrainTextureUsage.set(textureKey, this.terrainUsageCounter);

        if (!this.textures.exists(textureKey)) {
          this.createTerrainTexture(textureKey, chunkX, chunkY);
        }

        if (!this.terrainChunks.has(textureKey)) {
          const image = this.add
            .image(chunkX * CHUNK_SIZE, chunkY * CHUNK_SIZE, textureKey)
            .setOrigin(0)
            .setDepth(-10000)
            .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
          this.terrainChunks.set(textureKey, image);
        }
      }
    }

    this.terrainChunks.forEach((image, textureKey) => {
      if (!activeTextureKeys.has(textureKey)) {
        image.destroy();
        this.terrainChunks.delete(textureKey);
      }
    });

    this.evictUnusedTerrainTextures(activeTextureKeys);
  }

  private createTerrainTexture(textureKey: string, chunkX: number, chunkY: number): void {
    const texture = this.textures.createCanvas(textureKey, CHUNK_SIZE, CHUNK_SIZE);
    if (!texture) {
      throw new Error(`Unable to create terrain texture ${textureKey}`);
    }

    const context = texture.context;
    context.imageSmoothingEnabled = false;
    const chunk = generateChunk(this.worldSeed, chunkX, chunkY);

    chunk.tiles.forEach((tile, index) => {
      const localX = (index % CHUNK_TILES) * TILE_SIZE;
      const localY = Math.floor(index / CHUNK_TILES) * TILE_SIZE;
      const definition = BIOMES[tile.biome];
      context.globalAlpha = 1;
      context.fillStyle = this.colorToCss(definition.color);
      context.fillRect(localX, localY, TILE_SIZE + 1, TILE_SIZE + 1);

      if (tile.variant === 0) {
        context.globalAlpha = 0.72;
        context.fillStyle = this.colorToCss(definition.accent);
        context.beginPath();
        context.moveTo(localX + 12, localY + 12);
        context.arc(localX + 10, localY + 12, 2, 0, Math.PI * 2);
        context.moveTo(localX + 17.5, localY + 9);
        context.arc(localX + 16, localY + 9, 1.5, 0, Math.PI * 2);
        context.fill();
      }
    });

    context.globalAlpha = 1;
    texture.refresh();
  }

  private evictUnusedTerrainTextures(activeTextureKeys: Set<string>): void {
    const maximumCachedTextures = 16;
    if (this.terrainTextureUsage.size <= maximumCachedTextures) {
      return;
    }

    const evictionCandidates = [...this.terrainTextureUsage.entries()]
      .filter(([textureKey]) => !activeTextureKeys.has(textureKey))
      .sort((left, right) => left[1] - right[1]);

    while (
      this.terrainTextureUsage.size > maximumCachedTextures
      && evictionCandidates.length > 0
    ) {
      const candidate = evictionCandidates.shift();
      if (!candidate) {
        break;
      }

      this.textures.remove(candidate[0]);
      this.terrainTextureUsage.delete(candidate[0]);
    }
  }

  private clearTerrainImages(): void {
    this.terrainChunks.forEach((image) => image.destroy());
    this.terrainChunks.clear();
  }

  private terrainTextureKey(chunkX: number, chunkY: number): string {
    return `terrain:${this.worldSeed}:${chunkX}:${chunkY}`;
  }

  private colorToCss(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }
}
