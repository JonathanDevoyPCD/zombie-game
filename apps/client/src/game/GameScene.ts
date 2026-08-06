import {
  BIOMES,
  BUILDABLES,
  BUILDINGS,
  ITEMS,
  OVERWORLD_SPACE_ID,
  PLAYER_COLLISION_RADIUS,
  STARTING_SAFE_ZONE_RADIUS,
  STARTING_TOWN_NAME,
  STARTING_TOWN_PLAZAS,
  STARTING_TOWN_PROP_COLLIDERS,
  STARTING_TOWN_PROPS,
  STARTING_TOWN_ROADS,
  ZOMBIE_COLLISION_RADIUS,
  buildableCollider,
  buildableCollidersConflict,
  isItemId,
  isBuildableId,
  isBuildOrientation,
  movementEnvironmentForBuilding,
  movementEnvironmentForSpace,
  snapBuildCoordinate,
  type BuildOrientation,
  type ResolvedBuildingDefinition,
  type TownPropDefinition,
} from "@last-survivor/content";
import {
  INPUT_STEP_SECONDS,
  type BuildEvent,
  type CombatEvent,
  type ContainerSnapshot,
  type InventorySnapshot,
  type InventoryEvent,
  type MovementInput,
  type PlayerSnapshot,
  type PlacedStructureSnapshot,
  type ResourceNodeSnapshot,
  type ZombieSnapshot,
  type WorldPickupSnapshot,
} from "@last-survivor/shared";
import {
  DEFAULT_MOVE_SPEED,
  SPRINT_MOVE_SPEED,
  integrateMovementWithCollisions,
} from "@last-survivor/simulation";
import {
  CHUNK_SIZE,
  CHUNK_TILES,
  TILE_SIZE,
  generateChunk,
  generateChunkBuildings,
  generateChunkProps,
  generatedBuildingFromInteriorSpace,
  RESOURCE_INTERACTION_RADIUS,
  RESOURCE_DISPLAY_WIDTHS,
  resolveGeneratedBuilding,
  resourceCollisionRect,
  sampleTile,
  worldToChunk,
} from "@last-survivor/worldgen";
import Phaser from "phaser";
import { SPRITE_ASSETS } from "../assets/spriteCatalog";
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
  updateFlashlight,
  updateHealth,
  updateInventory,
  updateMinimap,
  updateSignalReadout,
  updateStamina,
  updateWorldReadout,
} from "../ui/hud";
import {
  closeInventory,
  initializeInventoryUi,
  isInventoryOpen,
  showInventoryEvent,
  toggleInventory,
  updateInventoryMenu,
} from "../ui/inventory";
import { clearBuildEvent, showBuildEvent, updateBuildToolbar } from "../ui/build";

interface PlayerVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  targetX: number;
  targetY: number;
  spaceId: string;
  activeSearchId: string;
  depthOffset: number;
  searchBarBackground: Phaser.GameObjects.Rectangle;
  searchBarFill: Phaser.GameObjects.Rectangle;
  searchLabel: Phaser.GameObjects.Text;
  facing: number;
  sprinting: boolean;
  flashlight: boolean;
  flashlightGlow: Phaser.GameObjects.Graphics;
  lastVisualX: number;
  lastVisualY: number;
  animationLockedUntil: number;
}

interface ZombieVisual {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  targetX: number;
  targetY: number;
  spaceId: string;
  alive: boolean;
  healthBarFill: Phaser.GameObjects.Rectangle;
  type: number;
  aggroTarget: string;
  lastVisualX: number;
  lastVisualY: number;
  animationLockedUntil: number;
}

interface ContainerVisual {
  object: Phaser.GameObjects.GameObject
    & Phaser.GameObjects.Components.Visible
    & { setAlpha(value: number): unknown };
  label: Phaser.GameObjects.Text;
}

interface PickupVisual {
  container: Phaser.GameObjects.Container;
  spaceId: string;
}

interface StructureVisual {
  image: Phaser.GameObjects.Image;
}

interface ResourceVisual {
  image: Phaser.GameObjects.Image;
}

type VisibleGameObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

const INPUT_STEP_MS = INPUT_STEP_SECONDS * 1000;
const MAX_PREDICTION_STEPS_PER_FRAME = 5;
const REMOTE_INTERPOLATION_RATE = 14;
const CHEST_TEXTURE_KEY = "house-48-chest";
const WOOD_WALL_HORIZONTAL_TEXTURE_KEY = "structure:wood-wall:horizontal";
const WOOD_WALL_VERTICAL_TEXTURE_KEY = "structure:wood-wall:vertical";
const itemTextureKey = (itemId: string): string => `item:${itemId}`;
const houseTextureKey = (spriteId: string): string => `house:${spriteId}`;
const townTextureKey = (spriteId: string): string => `town:${spriteId}`;
const PLAYER_TEXTURE_KEYS = {
  idle: "player:raider-1:idle",
  walk: "player:raider-1:walk",
  shot: "player:raider-1:shot",
} as const;
const zombieTextureKey = (type: number, action: string): string => `zombie:${type}:${action}`;

function distanceBetween(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
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

function stableDepthOffset(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash % 1000) / 10000;
}

function zombieType(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? ((Number(match[1]) - 1) % 4) + 1 : 1;
}

export class GameScene extends Phaser.Scene {
  private readonly connection = new WorldConnection();
  private readonly playerVisuals = new Map<string, PlayerVisual>();
  private readonly zombieVisuals = new Map<string, ZombieVisual>();
  private readonly terrainChunks = new Map<string, Phaser.GameObjects.Image>();
  private readonly ambientProps = new Map<string, Phaser.GameObjects.Image>();
  private readonly terrainTextureUsage = new Map<string, number>();
  private readonly containers = new Map<string, ContainerSnapshot>();
  private readonly containerVisuals = new Map<string, ContainerVisual>();
  private readonly pickups = new Map<string, WorldPickupSnapshot>();
  private readonly pickupVisuals = new Map<string, PickupVisual>();
  private readonly structures = new Map<string, PlacedStructureSnapshot>();
  private readonly structureVisuals = new Map<string, StructureVisual>();
  private readonly resources = new Map<string, ResourceNodeSnapshot>();
  private readonly resourceVisuals = new Map<string, ResourceVisual>();
  private readonly worldBuildings = new Map(
    BUILDINGS.map((building) => [building.id, building] as const),
  );
  private readonly staticBuildingIds = new Set(BUILDINGS.map((building) => building.id));
  private readonly exteriorBuildings = new Map<string, Phaser.GameObjects.Image>();
  private readonly townPropVisuals = new Map<string, Phaser.GameObjects.Image>();
  private readonly interiorObjectsBySpace = new Map<string, VisibleGameObject[]>();
  private cursors!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private inventoryKey!: Phaser.Input.Keyboard.Key;
  private buildKey!: Phaser.Input.Keyboard.Key;
  private rotateBuildKey!: Phaser.Input.Keyboard.Key;
  private sprintKey!: Phaser.Input.Keyboard.Key;
  private flashlightKey!: Phaser.Input.Keyboard.Key;
  private safeZoneVisual!: Phaser.GameObjects.Graphics;
  private townRoadVisual!: Phaser.GameObjects.Graphics;
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
  private localStamina = 100;
  private buildModeActive = false;
  private buildOrientation: BuildOrientation = "horizontal";
  private buildPreview!: Phaser.GameObjects.Image;
  private buildPreviewValid = false;
  private buildInvalidReason = "";
  private readonly clearHeldKeys = (): void => {
    this.input.keyboard?.resetKeys();
    this.inputAccumulator = 0;
  };
  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearHeldKeys();
    }
  };

  constructor() {
    super("world");
  }

  preload(): void {
    this.load.image(CHEST_TEXTURE_KEY, SPRITE_ASSETS.containers.chest);
    this.load.image(WOOD_WALL_HORIZONTAL_TEXTURE_KEY, SPRITE_ASSETS.structures.woodWallHorizontal);
    this.load.image(WOOD_WALL_VERTICAL_TEXTURE_KEY, SPRITE_ASSETS.structures.woodWallVertical);
    Object.entries(SPRITE_ASSETS.items).forEach(([itemId, assetUrl]) => {
      this.load.image(itemTextureKey(itemId), assetUrl);
    });
    SPRITE_ASSETS.terrain.grass.forEach((assetUrl, index) => {
      this.load.image(`ambient:grass:${index}`, assetUrl);
    });
    SPRITE_ASSETS.terrain.rocks.forEach((assetUrl, index) => {
      this.load.image(`ambient:rock:${index}`, assetUrl);
    });
    SPRITE_ASSETS.terrain.resources.trees.forEach((assetUrl, index) => {
      this.load.image(`resource:tree:${index}`, assetUrl);
    });
    SPRITE_ASSETS.terrain.resources.stones.forEach((assetUrl, index) => {
      this.load.image(`resource:stone:${index}`, assetUrl);
    });
    Object.entries(SPRITE_ASSETS.buildings.houses).forEach(([biome, houses]) => {
      houses.forEach((assetUrl, index) => {
        this.load.image(houseTextureKey(`${biome}:${index}`), assetUrl);
      });
    });
    Object.entries(SPRITE_ASSETS.town).forEach(([spriteId, assetUrl]) => {
      this.load.image(townTextureKey(spriteId), assetUrl);
    });
    Object.entries(SPRITE_ASSETS.players.raider1).forEach(([action, assetUrl]) => {
      this.load.spritesheet(PLAYER_TEXTURE_KEYS[action as keyof typeof PLAYER_TEXTURE_KEYS], assetUrl, {
        frameWidth: 128,
        frameHeight: 128,
      });
    });
    SPRITE_ASSETS.zombies.forEach((assets, index) => {
      Object.entries(assets).forEach(([action, assetUrl]) => {
        this.load.spritesheet(zombieTextureKey(index + 1, action), assetUrl, {
          frameWidth: 128,
          frameHeight: 128,
        });
      });
    });
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
    this.inventoryKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.buildKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.rotateBuildKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.sprintKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.flashlightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    window.addEventListener("blur", this.clearHeldKeys);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    initializeInventoryUi({
      move: (fromIndex, toIndex, quantity) => {
        this.connection.moveInventory({
          operationId: crypto.randomUUID(),
          fromIndex,
          toIndex,
          ...(quantity === undefined ? {} : { quantity }),
        });
      },
      drop: (slotIndex, quantity) => {
        this.connection.dropInventory({
          operationId: crypto.randomUUID(),
          slotIndex,
          ...(quantity === undefined ? {} : { quantity }),
        });
      },
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 2 && this.buildModeActive) {
        this.setBuildMode(false);
        return;
      }
      if (pointer.button === 0) {
        if (this.buildModeActive) {
          this.placeBuildPreview();
        } else {
          this.fireAtPointer(pointer);
        }
      }
    });
    this.input.mouse?.disableContextMenu();

    this.cameras.main.setBackgroundColor(0x101713);
    this.cameras.main.setZoom(1.35);
    this.createCharacterAnimations();
    this.createExteriorObjects();
    this.createBuildPreview();
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
        (event) => this.handleInventoryEvent(event),
        (event) => this.handleBuildEvent(event),
      )
      .catch((error: unknown) => {
        console.error("Unable to connect to world server", error);
        updateConnectionStatus(false);
      });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("blur", this.clearHeldKeys);
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      void this.connection.disconnect();
    });
  }

  update(_time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.inventoryKey)) {
      this.setBuildMode(false);
      toggleInventory();
    }
    if (Phaser.Input.Keyboard.JustDown(this.buildKey) && !isInventoryOpen()) {
      this.setBuildMode(!this.buildModeActive);
    }
    if (Phaser.Input.Keyboard.JustDown(this.rotateBuildKey) && this.buildModeActive) {
      this.buildOrientation = this.buildOrientation === "horizontal" ? "vertical" : "horizontal";
      clearBuildEvent();
    }
    if (Phaser.Input.Keyboard.JustDown(this.flashlightKey) && !isInventoryOpen()) {
      this.connection.toggleFlashlight();
    }
    if (
      Phaser.Input.Keyboard.JustDown(this.interactKey)
      && !this.isTransitioning
      && !isInventoryOpen()
    ) {
      this.connection.interact();
    }

    this.processLocalInput(delta);
    this.updatePerformanceReadout(delta);
    this.updateRemotePlayers(delta);
    this.updateZombies(delta);
    this.updateCharacterAnimations();
    this.updatePlayerDepths();
    this.updateZombieDepths();
    this.updateSearchProgressBars();

    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (localPlayer) {
      this.updateLocalAim(localPlayer);
      this.updateLocalPresentation(localPlayer);
      this.updateBuildPreview(localPlayer);
    }
  }

  private createCharacterAnimations(): void {
    this.anims.create({
      key: PLAYER_TEXTURE_KEYS.idle,
      frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE_KEYS.idle),
      frameRate: 5,
      repeat: -1,
    });
    this.anims.create({
      key: PLAYER_TEXTURE_KEYS.walk,
      frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE_KEYS.walk),
      frameRate: 9,
      repeat: -1,
    });
    this.anims.create({
      key: PLAYER_TEXTURE_KEYS.shot,
      frames: this.anims.generateFrameNumbers(PLAYER_TEXTURE_KEYS.shot),
      frameRate: 18,
      repeat: 0,
    });

    for (let type = 1; type <= SPRITE_ASSETS.zombies.length; type += 1) {
      (["idle", "walk", "attack", "hurt", "dead"] as const).forEach((action) => {
        const key = zombieTextureKey(type, action);
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key),
          frameRate: action === "idle" ? 5 : action === "walk" ? 8 : 10,
          repeat: action === "idle" || action === "walk" || action === "attack" ? -1 : 0,
        });
      });
    }
  }

  private createExteriorObjects(): void {
    this.createStartingTownRoads();
    this.safeZoneVisual = this.add.graphics().setDepth(-9000);
    this.safeZoneVisual.fillStyle(0xc6d67a, 0.025);
    this.safeZoneVisual.fillCircle(0, 0, STARTING_SAFE_ZONE_RADIUS);
    this.safeZoneVisual.lineStyle(2, 0xdce69a, 0.12);
    this.safeZoneVisual.strokeCircle(0, 0, STARTING_SAFE_ZONE_RADIUS);
    BUILDINGS.forEach((building) => this.upsertExteriorBuilding(building));
    STARTING_TOWN_PROPS.forEach((prop) => this.createTownProp(prop));
  }

  private createStartingTownRoads(): void {
    const roads = this.add.graphics().setDepth(-9500);
    const drawRoadLayer = (widthOffset: number, color: number, alpha: number): void => {
      STARTING_TOWN_ROADS.forEach((road) => {
        const width = road.width + widthOffset;
        roads.lineStyle(width, color, alpha);
        road.points.slice(1).forEach((point, index) => {
          const previous = road.points[index]!;
          roads.lineBetween(previous.x, previous.y, point.x, point.y);
        });
        roads.fillStyle(color, alpha);
        road.points.forEach((point) => roads.fillCircle(point.x, point.y, width / 2));
      });
    };

    STARTING_TOWN_PLAZAS.forEach((plaza) => {
      roads.fillStyle(0x6c5539, 0.9);
      roads.fillCircle(plaza.x, plaza.y, plaza.radius + 12);
    });
    drawRoadLayer(18, 0x6c5539, 0.92);
    STARTING_TOWN_PLAZAS.forEach((plaza) => {
      roads.fillStyle(0xc89b61, 1);
      roads.fillCircle(plaza.x, plaza.y, plaza.radius);
      roads.lineStyle(3, 0xe0ba7e, 0.42);
      roads.strokeCircle(plaza.x, plaza.y, plaza.radius - 8);
    });
    drawRoadLayer(0, 0xc89b61, 1);
    drawRoadLayer(-28, 0xe0b475, 0.16);
    this.townRoadVisual = roads;
  }

  private createTownProp(prop: TownPropDefinition): void {
    const image = this.add
      .image(prop.position.x, prop.position.y, townTextureKey(prop.spriteId))
      .setOrigin(0.5, prop.originY)
      .setDepth(prop.position.y + 0.01)
      .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
    image.setScale(prop.displayWidth / image.width);
    this.townPropVisuals.set(prop.id, image);
  }

  private upsertExteriorBuilding(building: ResolvedBuildingDefinition): void {
    const existing = this.exteriorBuildings.get(building.id);
    if (existing) {
      existing
        .setPosition(building.exterior.position.x, building.exterior.position.y)
        .setDepth(building.exterior.position.y)
        .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
      return;
    }
    const image = this.add
      .image(
        building.exterior.position.x,
        building.exterior.position.y,
        houseTextureKey(building.exterior.spriteId),
      )
      .setOrigin(0.5, 1)
      .setDepth(building.exterior.position.y)
      .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
    image.setScale(building.exterior.displayWidth / image.width);
    this.exteriorBuildings.set(building.id, image);
  }

  private allBuildings(): ResolvedBuildingDefinition[] {
    return [...this.worldBuildings.values()];
  }

  private buildingForSpace(spaceId: string): ResolvedBuildingDefinition | undefined {
    return [...this.worldBuildings.values()].find(
      (building) => building.interior.spaceId === spaceId,
    );
  }

  private containerDefinition(containerId: string) {
    return this.allBuildings()
      .flatMap((building) => building.interior.containers)
      .find((container) => container.id === containerId);
  }

  private ensureBuildingForSpace(spaceId: string): ResolvedBuildingDefinition | undefined {
    const known = this.buildingForSpace(spaceId);
    if (known) {
      return known;
    }
    const generated = generatedBuildingFromInteriorSpace(this.worldSeed, spaceId);
    if (!generated) {
      return undefined;
    }
    this.worldBuildings.set(generated.id, generated);
    this.ensureBuildingInterior(generated);
    return generated;
  }

  private ensureBuildingInterior(building: ResolvedBuildingDefinition): void {
    if (!this.interiorObjectsBySpace.has(building.interior.spaceId)) {
      this.createBuildingInterior(building);
    }
  }

  private createBuildPreview(): void {
    this.buildPreview = this.add
      .image(0, 0, WOOD_WALL_HORIZONTAL_TEXTURE_KEY)
      .setAlpha(0.72)
      .setVisible(false);
    this.updateBuildPreviewTexture();
  }

  private updateBuildPreviewTexture(): void {
    const definition = BUILDABLES["wood-wall"];
    const horizontal = this.buildOrientation === "horizontal";
    this.buildPreview.setTexture(
      horizontal ? WOOD_WALL_HORIZONTAL_TEXTURE_KEY : WOOD_WALL_VERTICAL_TEXTURE_KEY,
    );
    if (horizontal) {
      this.buildPreview.setDisplaySize(
        definition.displayLength,
        definition.displayLength * this.buildPreview.height / this.buildPreview.width,
      );
    } else {
      this.buildPreview.setDisplaySize(
        definition.displayLength * this.buildPreview.width / this.buildPreview.height,
        definition.displayLength,
      );
    }
  }

  private setBuildMode(active: boolean): void {
    this.buildModeActive = active && this.currentSpaceId === OVERWORLD_SPACE_ID;
    this.buildPreview.setVisible(this.buildModeActive);
    this.buildPreviewValid = false;
    this.buildInvalidReason = "";
    if (this.buildModeActive) {
      clearBuildEvent();
    }
    updateBuildToolbar(this.buildModeActive, this.buildOrientation, false);
  }

  private updateBuildPreview(localPlayer: PlayerVisual): void {
    if (!this.buildModeActive || this.currentSpaceId !== OVERWORLD_SPACE_ID) {
      this.buildPreview.setVisible(false);
      return;
    }
    const definition = BUILDABLES["wood-wall"];
    const worldPoint = this.cameras.main.getWorldPoint(
      this.input.activePointer.x,
      this.input.activePointer.y,
    );
    const x = snapBuildCoordinate(worldPoint.x, definition.gridSize);
    const y = snapBuildCoordinate(worldPoint.y, definition.gridSize);
    const collider = buildableCollider(definition, x, y, this.buildOrientation);
    const hasWood = (this.previousInventory?.wood ?? 0) >= (definition.cost.wood ?? 0);
    const withinRange = distanceBetween(localPlayer.container, { x, y })
      <= definition.maximumPlacementRange;
    const overlapsBuilding = this.allBuildings().some((building) => (
      rectanglesOverlap(collider, building.exterior.collider, 8)
    ));
    const overlapsTownProp = STARTING_TOWN_PROP_COLLIDERS.some((propCollider) => (
      rectanglesOverlap(collider, propCollider, 4)
    ));
    const overlapsStructure = [...this.structures.values()].some((structure) => {
      if (!isBuildableId(structure.buildableId) || !isBuildOrientation(structure.orientation)) {
        return false;
      }
      return buildableCollidersConflict(
        collider,
        buildableCollider(
          BUILDABLES[structure.buildableId],
          structure.x,
          structure.y,
          structure.orientation,
        ),
      );
    });
    const overlapsPlayer = [...this.playerVisuals.values()].some((visual) => (
      visual.spaceId === OVERWORLD_SPACE_ID
      && circleOverlapsRect(visual.container, PLAYER_COLLISION_RADIUS + 3, collider)
    ));
    const overlapsZombie = [...this.zombieVisuals.values()].some((visual) => (
      visual.alive
      && visual.spaceId === OVERWORLD_SPACE_ID
      && circleOverlapsRect(visual.container, ZOMBIE_COLLISION_RADIUS + 3, collider)
    ));
    const overlapsResource = [...this.resources.values()].some((resource) => (
      resource.available
      && rectanglesOverlap(collider, resourceCollisionRect(resource.kind, resource.x, resource.y), 2)
    ));
    this.buildPreviewValid = hasWood
      && withinRange
      && !overlapsBuilding
      && !overlapsTownProp
      && !overlapsStructure
      && !overlapsPlayer
      && !overlapsZombie
      && !overlapsResource;
    if (!hasWood) {
      this.buildInvalidReason = `Need ${definition.cost.wood ?? 0} wood to place this wall.`;
    } else if (!withinRange) {
      this.buildInvalidReason = "Move closer to place this wall.";
    } else if (
      overlapsBuilding
      || overlapsTownProp
      || overlapsStructure
      || overlapsPlayer
      || overlapsZombie
      || overlapsResource
    ) {
      this.buildInvalidReason = "That position is blocked.";
    } else {
      this.buildInvalidReason = "";
    }
    this.buildPreview
      .setPosition(x, y)
      .setDepth(y + 0.04)
      .setVisible(true)
      .setTint(this.buildPreviewValid ? 0x8fc693 : 0xd9877f);
    this.updateBuildPreviewTexture();
    updateBuildToolbar(this.buildModeActive, this.buildOrientation, this.buildPreviewValid);
  }

  private placeBuildPreview(): void {
    if (!this.buildModeActive || !this.buildPreviewValid) {
      if (this.buildModeActive) {
        showBuildEvent({
          kind: "error",
          message: this.buildInvalidReason || "Cannot place a wall here.",
          structureId: "",
        });
      }
      return;
    }
    this.connection.placeStructure({
      operationId: crypto.randomUUID(),
      buildableId: "wood-wall",
      x: this.buildPreview.x,
      y: this.buildPreview.y,
      orientation: this.buildOrientation,
    });
  }

  private fireAtPointer(pointer: Phaser.Input.Pointer): void {
    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (
      !localPlayer
      || this.currentSpaceId !== OVERWORLD_SPACE_ID
      || this.isTransitioning
      || isInventoryOpen()
      || localPlayer.activeSearchId
    ) {
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const angle = Math.atan2(
      worldPoint.y - localPlayer.container.y,
      worldPoint.x - localPlayer.container.x,
    );
    localPlayer.facing = angle;
    localPlayer.flashlightGlow.setRotation(angle);
    this.fireSequence += 1;
    this.connection.fire({ sequence: this.fireSequence, angle });
  }

  private updateLocalAim(localPlayer: PlayerVisual): void {
    if (this.currentSpaceId !== OVERWORLD_SPACE_ID) {
      return;
    }
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    localPlayer.facing = Math.atan2(
      worldPoint.y - localPlayer.container.y,
      worldPoint.x - localPlayer.container.x,
    );
    localPlayer.flashlightGlow.setRotation(localPlayer.facing);
  }

  private handleCombatEvent(event: CombatEvent): void {
    if (event.kind === "shot" && this.currentSpaceId === OVERWORLD_SPACE_ID) {
      const shooter = this.playerVisuals.get(event.actorId);
      if (shooter) {
        shooter.animationLockedUntil = this.time.now + 420;
        shooter.sprite.play(PLAYER_TEXTURE_KEYS.shot, true);
      }
      const hitZombie = this.zombieVisuals.get(event.targetId);
      if (hitZombie && event.amount > 0) {
        hitZombie.animationLockedUntil = this.time.now + 260;
        hitZombie.sprite.play(zombieTextureKey(hitZombie.type, "hurt"), true);
      }
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

  private handleInventoryEvent(event: InventoryEvent): void {
    showInventoryEvent(event);
    if (event.kind === "success") {
      showLootNotification(event.message);
    }
  }

  private handleBuildEvent(event: BuildEvent): void {
    showBuildEvent(event);
    if (event.kind === "success") {
      showLootNotification(event.message);
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
      .text(cupboardDefinition.position.x, cupboardDefinition.position.y - 25, "LARDER", {
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
    const acceptMovement = !this.isTransitioning
      && !isInventoryOpen()
      && !localPlayer?.activeSearchId;
    return {
      sequence: this.sequence,
      up: acceptMovement && this.cursors.up.isDown,
      down: acceptMovement && this.cursors.down.isDown,
      left: acceptMovement && this.cursors.left.isDown,
      right: acceptMovement && this.cursors.right.isDown,
      sprint: acceptMovement && this.sprintKey.isDown && this.localStamina > 0,
    };
  }

  private updatePerformanceReadout(delta: number): void {
    this.performanceAccumulator += delta;
    if (this.performanceAccumulator >= 500) {
      this.performanceAccumulator = 0;
      updateFrameRate(this.game.loop.actualFps);
      this.updateMinimapPresentation();
    }
  }

  private updateMinimapPresentation(): void {
    const localPlayer = this.playerVisuals.get(this.localSessionId);
    if (!localPlayer) {
      return;
    }
    const markers = [
      ...[...this.playerVisuals.entries()]
        .filter(([, visual]) => visual.spaceId === this.currentSpaceId)
        .map(([id, visual]) => ({
          x: visual.container.x,
          y: visual.container.y,
          kind: id === this.localSessionId ? "player" as const : "ally" as const,
        })),
      ...[...this.zombieVisuals.values()]
        .filter((zombie) => zombie.alive && zombie.spaceId === this.currentSpaceId)
        .map((zombie) => ({
          x: zombie.container.x,
          y: zombie.container.y,
          kind: "zombie" as const,
        })),
      ...this.allBuildings().map((building) => ({
        x: building.exterior.position.x,
        y: building.exterior.position.y,
        kind: "building" as const,
      })),
      ...[...this.structures.values()].map((structure) => ({
        x: structure.x,
        y: structure.y,
        kind: "structure" as const,
      })),
      ...[...this.resources.values()]
        .filter((resource) => resource.available)
        .map((resource) => ({
          x: resource.x,
          y: resource.y,
          kind: "resource" as const,
        })),
    ];
    updateMinimap(localPlayer.container, markers);
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

  private updateCharacterAnimations(): void {
    this.playerVisuals.forEach((visual) => {
      const moved = Math.hypot(
        visual.container.x - visual.lastVisualX,
        visual.container.y - visual.lastVisualY,
      ) > 0.08;
      visual.sprite.setFlipX(Math.cos(visual.facing) < 0);
      visual.sprite.anims.timeScale = visual.sprinting ? 1.45 : 1;
      visual.flashlightGlow
        .setRotation(visual.facing)
        .setVisible(visual.flashlight && visual.spaceId === this.currentSpaceId);
      if (this.time.now >= visual.animationLockedUntil) {
        const animation = moved ? PLAYER_TEXTURE_KEYS.walk : PLAYER_TEXTURE_KEYS.idle;
        if (visual.sprite.anims.currentAnim?.key !== animation) {
          visual.sprite.play(animation, true);
        }
      }
      visual.lastVisualX = visual.container.x;
      visual.lastVisualY = visual.container.y;
    });

    this.zombieVisuals.forEach((visual) => {
      const movementX = visual.container.x - visual.lastVisualX;
      const movementY = visual.container.y - visual.lastVisualY;
      const moved = Math.hypot(movementX, movementY) > 0.05;
      if (Math.abs(movementX) > 0.01) {
        visual.sprite.setFlipX(movementX < 0);
      }
      if (this.time.now >= visual.animationLockedUntil) {
        const action = moved ? "walk" : visual.aggroTarget ? "attack" : "idle";
        const animation = zombieTextureKey(visual.type, action);
        if (visual.sprite.anims.currentAnim?.key !== animation) {
          visual.sprite.play(animation, true);
        }
      }
      visual.lastVisualX = visual.container.x;
      visual.lastVisualY = visual.container.y;
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
      const activeResource = [...this.resources.values()].find(
        (resource) => resource.harvestingBy === playerId,
      );
      const isSearching = Boolean(
        (activeContainer && !activeContainer.opened)
        || (activeResource && activeResource.available),
      );
      visual.searchBarBackground.setVisible(isSearching);
      visual.searchBarFill.setVisible(isSearching);
      visual.searchLabel.setVisible(isSearching);

      if (!activeContainer && !activeResource) {
        return;
      }

      const progress = activeContainer?.searchProgress ?? activeResource?.harvestProgress ?? 0;
      visual.searchBarFill.setScale(progress, 1);
      visual.searchLabel.setText(
        `${activeResource ? "HARVESTING" : "SEARCHING"} ${Math.round(progress * 100)}%`,
      );
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
      const areaName = Math.hypot(localX, localY) <= STARTING_SAFE_ZONE_RADIUS
        ? STARTING_TOWN_NAME
        : BIOMES[tile.biome].name;
      if (areaName === STARTING_TOWN_NAME) {
        updateAreaReadout(this.worldId, areaName, this.playersInCurrentSpace());
      } else {
        updateWorldReadout(this.worldId, tile.biome, this.playersInCurrentSpace());
      }
      updateSignalReadout(areaName, Math.hypot(localX, localY) / 10);
    } else {
      const building = this.buildingForSpace(this.currentSpaceId);
      updateAreaReadout(
        this.worldId,
        building?.name ?? "Unknown interior",
        this.playersInCurrentSpace(),
      );
      updateSignalReadout(building?.name ?? "Unknown interior", Math.hypot(localX, localY) / 10);
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
      gameElement.dataset.buildings = JSON.stringify(this.allBuildings().map((building) => ({
        id: building.id,
        name: building.name,
        x: building.exterior.position.x,
        y: building.exterior.position.y,
        spriteId: building.exterior.spriteId,
        spaceId: building.interior.spaceId,
      })));
    }
  }

  private updateInteractionPrompt(x: number, y: number): void {
    if (this.isTransitioning) {
      hideInteractionPrompt();
      return;
    }

    const playerPosition = { x, y };
    const localPlayer = this.playerVisuals.get(this.localSessionId);
    const activeResource = localPlayer?.activeSearchId
      ? this.resources.get(localPlayer.activeSearchId)
      : undefined;
    if (activeResource) {
      showInteractionPrompt(`Cancel harvesting ${activeResource.kind}`);
      return;
    }
    const nearbyPickup = [...this.pickups.values()]
      .filter(
        (pickup) => pickup.spaceId === this.currentSpaceId
          && distanceBetween(playerPosition, pickup) <= 38,
      )
      .sort(
        (left, right) => distanceBetween(playerPosition, left)
          - distanceBetween(playerPosition, right),
      )[0];
    if (nearbyPickup && isItemId(nearbyPickup.itemId)) {
      showInteractionPrompt(
        `Pick up ${nearbyPickup.quantity} ${ITEMS[nearbyPickup.itemId].name.toLowerCase()}`,
      );
      return;
    }

    if (this.currentSpaceId === OVERWORLD_SPACE_ID) {
      const nearbyResource = [...this.resources.values()]
        .filter((resource) => resource.available
          && distanceBetween(playerPosition, resource) <= RESOURCE_INTERACTION_RADIUS)
        .sort(
          (left, right) => distanceBetween(playerPosition, left)
            - distanceBetween(playerPosition, right),
        )[0];
      if (nearbyResource) {
        if (nearbyResource.harvestingBy) {
          showInteractionPrompt(`Being harvested by ${nearbyResource.harvestingByName}`, false);
        } else {
          showInteractionPrompt(`Harvest ${nearbyResource.kind}`);
        }
        return;
      }
      const nearbyTownProp = STARTING_TOWN_PROPS
        .filter((prop) => prop.interaction
          && distanceBetween(playerPosition, prop.position) <= prop.interaction.radius)
        .sort(
          (left, right) => distanceBetween(playerPosition, left.position)
            - distanceBetween(playerPosition, right.position),
        )[0];
      if (nearbyTownProp?.interaction?.kind === "draw-water") {
        showInteractionPrompt(`Draw water from ${nearbyTownProp.name.toLowerCase()}`);
        return;
      }
      const nearbyBuilding = this.allBuildings()
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

    const building = this.buildingForSpace(this.currentSpaceId);
    if (!building) {
      hideInteractionPrompt();
      return;
    }

    if (localPlayer?.activeSearchId) {
      const definition = this.containerDefinition(localPlayer.activeSearchId);
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
      closeInventory();
      this.setBuildMode(false);
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

    this.pickups.clear();
    snapshot.pickups.forEach((pickup) => {
      this.pickups.set(pickup.id, pickup);
      this.upsertPickup(pickup);
    });
    const activePickupIds = new Set(snapshot.pickups.map((pickup) => pickup.id));
    this.pickupVisuals.forEach((visual, id) => {
      if (!activePickupIds.has(id)) {
        visual.container.destroy();
        this.pickupVisuals.delete(id);
      }
    });

    this.structures.clear();
    snapshot.structures.forEach((structure) => {
      this.structures.set(structure.id, structure);
      this.upsertStructure(structure);
    });
    const activeStructureIds = new Set(snapshot.structures.map((structure) => structure.id));
    this.structureVisuals.forEach((visual, id) => {
      if (!activeStructureIds.has(id)) {
        visual.image.destroy();
        this.structureVisuals.delete(id);
      }
    });

    this.resources.clear();
    snapshot.resources.forEach((resource) => {
      this.resources.set(resource.id, resource);
      this.upsertResource(resource);
    });
    const activeResourceIds = new Set(snapshot.resources.map((resource) => resource.id));
    this.resourceVisuals.forEach((visual, id) => {
      if (!activeResourceIds.has(id)) {
        visual.image.destroy();
        this.resourceVisuals.delete(id);
      }
    });

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
      gameElement.dataset.pickups = JSON.stringify(snapshot.pickups);
      gameElement.dataset.structures = JSON.stringify(snapshot.structures);
      gameElement.dataset.resources = JSON.stringify(snapshot.resources);
    }

    const current = snapshot.players.find((player) => player.id === snapshot.sessionId);
    if (current && current.spaceId !== OVERWORLD_SPACE_ID) {
      const building = this.ensureBuildingForSpace(current.spaceId);
      if (building) {
        this.ensureBuildingInterior(building);
        this.updateContainerPresentation();
      }
    }
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
      this.localStamina = current.stamina;
      this.updateInventoryPresentation(current.inventory);
      updateHealth(current.health, current.maxHealth);
      updateStamina(current.stamina, current.maxStamina, current.sprinting);
      updateFlashlight(current.flashlight);
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
      if (player.id !== this.localSessionId) {
        existing.facing = player.facing;
      }
      existing.sprinting = player.sprinting;
      existing.flashlight = player.flashlight;
      if (player.id !== this.localSessionId || existing.spaceId !== this.currentSpaceId) {
        existing.targetX = player.x;
        existing.targetY = player.y;
      }
      return;
    }

    const shadow = this.add.ellipse(0, 2, 27, 9, 0x08100c, 0.3);
    const sprite = this.add
      .sprite(0, -30, PLAYER_TEXTURE_KEYS.idle)
      .setScale(0.82)
      .play(PLAYER_TEXTURE_KEYS.idle);
    const flashlightGlow = this.add.graphics().setPosition(0, -30).setVisible(player.flashlight);
    flashlightGlow.fillStyle(0xfff2b0, 0.1);
    flashlightGlow.fillTriangle(8, -5, 150, -34, 150, 34);
    flashlightGlow.fillStyle(0xfff6c7, 0.16);
    flashlightGlow.fillCircle(8, 0, 13);
    flashlightGlow.setRotation(player.facing);
    const label = this.add
      .text(0, -72, player.name, {
        color: "#f2f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        stroke: "#101713",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const searchBarBackground = this.add
      .rectangle(0, -87, 44, 7, 0x101713, 0.92)
      .setStrokeStyle(1, 0x718078)
      .setVisible(false);
    const searchBarFill = this.add
      .rectangle(-20, -87, 40, 3, 0xe3cb70)
      .setOrigin(0, 0.5)
      .setVisible(false);
    const searchLabel = this.add
      .text(0, -96, "SEARCHING 0%", {
        color: "#f2f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "7px",
        stroke: "#101713",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setVisible(false);
    const container = this.add.container(player.x, player.y, [
      flashlightGlow,
      shadow,
      sprite,
      label,
      searchBarBackground,
      searchBarFill,
      searchLabel,
    ]);

    this.playerVisuals.set(player.id, {
      container,
      sprite,
      targetX: player.x,
      targetY: player.y,
      spaceId: player.spaceId,
      activeSearchId: player.activeSearchId,
      depthOffset: stableDepthOffset(player.id),
      searchBarBackground,
      searchBarFill,
      searchLabel,
      facing: player.facing,
      sprinting: player.sprinting,
      flashlight: player.flashlight,
      flashlightGlow,
      lastVisualX: player.x,
      lastVisualY: player.y,
      animationLockedUntil: 0,
    });
  }

  private upsertZombie(zombie: ZombieSnapshot): void {
    const existing = this.zombieVisuals.get(zombie.id);
    if (existing) {
      existing.targetX = zombie.x;
      existing.targetY = zombie.y;
      existing.spaceId = zombie.spaceId;
      existing.alive = zombie.alive;
      existing.aggroTarget = zombie.aggroTarget;
      existing.container.setVisible(zombie.alive && zombie.spaceId === this.currentSpaceId);
      existing.healthBarFill.setScale(Math.max(0, zombie.health / zombie.maxHealth), 1);
      return;
    }

    const type = zombieType(zombie.id);
    const shadow = this.add.ellipse(0, 2, 27, 9, 0x08100c, 0.32);
    const sprite = this.add
      .sprite(0, -30, zombieTextureKey(type, "idle"))
      .setScale(0.82)
      .play(zombieTextureKey(type, "idle"));
    const label = this.add
      .text(0, -74, zombie.name.toUpperCase(), {
        color: "#d3d9bc",
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        stroke: "#101713",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const healthBackground = this.add.rectangle(0, -63, 34, 5, 0x1b211d, 0.95);
    const healthBarFill = this.add
      .rectangle(-16, -63, 32, 3, 0xb9574f)
      .setOrigin(0, 0.5)
      .setScale(Math.max(0, zombie.health / zombie.maxHealth), 1);
    const container = this.add.container(zombie.x, zombie.y, [
      shadow,
      sprite,
      label,
      healthBackground,
      healthBarFill,
    ]);
    container.setVisible(zombie.alive && zombie.spaceId === this.currentSpaceId);
    this.zombieVisuals.set(zombie.id, {
      container,
      sprite,
      targetX: zombie.x,
      targetY: zombie.y,
      spaceId: zombie.spaceId,
      alive: zombie.alive,
      healthBarFill,
      type,
      aggroTarget: zombie.aggroTarget,
      lastVisualX: zombie.x,
      lastVisualY: zombie.y,
      animationLockedUntil: 0,
    });
  }

  private upsertPickup(pickup: WorldPickupSnapshot): void {
    const existing = this.pickupVisuals.get(pickup.id);
    if (existing) {
      existing.spaceId = pickup.spaceId;
      existing.container.setPosition(pickup.x, pickup.y);
      existing.container.setVisible(pickup.spaceId === this.currentSpaceId);
      const quantityLabel = existing.container.getByName("quantity") as Phaser.GameObjects.Text | null;
      quantityLabel?.setText(String(pickup.quantity));
      return;
    }
    if (!isItemId(pickup.itemId)) {
      return;
    }
    const shadow = this.add.ellipse(0, 5, 30, 11, 0x07100c, 0.32);
    const image = this.add.image(0, 0, itemTextureKey(pickup.itemId));
    image.setDisplaySize(32, 32);
    const quantity = this.add
      .text(14, 8, String(pickup.quantity), {
        color: "#f2f0df",
        fontFamily: "Arial, sans-serif",
        fontSize: "8px",
        stroke: "#101713",
        strokeThickness: 3,
      })
      .setName("quantity")
      .setOrigin(1, 1);
    const container = this.add.container(pickup.x, pickup.y, [shadow, image, quantity]);
    container.setDepth(pickup.y + 0.015);
    container.setVisible(pickup.spaceId === this.currentSpaceId);
    this.pickupVisuals.set(pickup.id, { container, spaceId: pickup.spaceId });
  }

  private upsertStructure(structure: PlacedStructureSnapshot): void {
    if (!isBuildableId(structure.buildableId) || !isBuildOrientation(structure.orientation)) {
      return;
    }
    const existing = this.structureVisuals.get(structure.id);
    const horizontal = structure.orientation === "horizontal";
    const texture = horizontal
      ? WOOD_WALL_HORIZONTAL_TEXTURE_KEY
      : WOOD_WALL_VERTICAL_TEXTURE_KEY;
    const definition = BUILDABLES[structure.buildableId];
    if (existing) {
      existing.image
        .setPosition(structure.x, structure.y)
        .setDepth(structure.y + 6)
        .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
      return;
    }
    const image = this.add.image(structure.x, structure.y, texture);
    if (horizontal) {
      image.setDisplaySize(definition.displayLength, definition.displayLength * image.height / image.width);
    } else {
      image.setDisplaySize(definition.displayLength * image.width / image.height, definition.displayLength);
    }
    image
      .setDepth(structure.y + 6)
      .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
    this.structureVisuals.set(structure.id, { image });
  }

  private upsertResource(resource: ResourceNodeSnapshot): void {
    const existing = this.resourceVisuals.get(resource.id);
    if (existing) {
      existing.image
        .setPosition(resource.x, resource.y)
        .setVisible(resource.available && this.currentSpaceId === OVERWORLD_SPACE_ID)
        .setAlpha(resource.harvestingBy ? 0.72 : 1);
      return;
    }
    const texture = `resource:${resource.kind}:${resource.variant}`;
    const image = this.add.image(resource.x, resource.y, texture);
    if (resource.kind === "tree") {
      const width = RESOURCE_DISPLAY_WIDTHS.tree[resource.variant]
        ?? RESOURCE_DISPLAY_WIDTHS.tree[1]!;
      image.setOrigin(0.5, 0.9).setDisplaySize(width, width * image.height / image.width);
    } else {
      const width = RESOURCE_DISPLAY_WIDTHS.stone[resource.variant]
        ?? RESOURCE_DISPLAY_WIDTHS.stone[0]!;
      image.setOrigin(0.5, 0.76).setDisplaySize(width, width * image.height / image.width);
    }
    image
      .setDepth(resource.y + 0.02)
      .setVisible(resource.available && this.currentSpaceId === OVERWORLD_SPACE_ID);
    this.resourceVisuals.set(resource.id, { image });
  }

  private movementEnvironment(spaceId: string) {
    if (spaceId !== OVERWORLD_SPACE_ID) {
      const building = this.buildingForSpace(spaceId);
      return building
        ? movementEnvironmentForBuilding(building)
        : movementEnvironmentForSpace(spaceId);
    }
    const colliders = [
      ...this.allBuildings().map((building) => building.exterior.collider),
      ...STARTING_TOWN_PROP_COLLIDERS,
    ];
    this.structures.forEach((structure) => {
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
    this.resources.forEach((resource) => {
      if (resource.available) {
        colliders.push(resourceCollisionRect(resource.kind, resource.x, resource.y));
      }
    });
    return { colliders };
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
      this.movementEnvironment(visual.spaceId),
      input.sprint && this.localStamina > 0 ? SPRINT_MOVE_SPEED : DEFAULT_MOVE_SPEED,
    );
    visual.sprinting = input.sprint
      && (input.up || input.down || input.left || input.right)
      && this.localStamina > 0;
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
        this.movementEnvironment(authoritative.spaceId),
        input.sprint && authoritative.stamina > 0 ? SPRINT_MOVE_SPEED : DEFAULT_MOVE_SPEED,
      );
    });

    visual.container.setPosition(reconciled.x, reconciled.y);
    visual.targetX = reconciled.x;
    visual.targetY = reconciled.y;
    visual.spaceId = authoritative.spaceId;
    visual.activeSearchId = authoritative.activeSearchId;
    visual.sprinting = authoritative.sprinting;
    visual.flashlight = authoritative.flashlight;
  }

  private transitionToSpace(spaceId: string): void {
    if (spaceId === this.currentSpaceId || spaceId === this.transitionTarget) {
      return;
    }

    this.transitionTarget = spaceId;
    if (spaceId !== OVERWORLD_SPACE_ID) {
      const building = this.ensureBuildingForSpace(spaceId);
      if (building) {
        this.ensureBuildingInterior(building);
      }
    }
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
    this.townRoadVisual.setVisible(showExterior);
    this.townPropVisuals.forEach((prop) => prop.setVisible(showExterior));
    this.safeZoneVisual.setVisible(showExterior);
    this.terrainChunks.forEach((image) => image.setVisible(showExterior));
    this.ambientProps.forEach((image) => image.setVisible(showExterior));
    this.structureVisuals.forEach((visual) => visual.image.setVisible(showExterior));
    if (!showExterior) {
      this.setBuildMode(false);
    }
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
    this.pickupVisuals.forEach((visual) => {
      visual.container.setVisible(visual.spaceId === this.currentSpaceId);
    });
    this.resourceVisuals.forEach((visual, id) => {
      visual.image.setVisible(
        this.currentSpaceId === OVERWORLD_SPACE_ID && this.resources.get(id)?.available === true,
      );
    });
  }

  private updateContainerPresentation(): void {
    this.allBuildings().flatMap((building) => building.interior.containers).forEach((definition) => {
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
    updateInventoryMenu(inventory);
    if (this.previousInventory) {
      const labels = {
        scrap: "scrap",
        parts: "parts",
        food: "food",
        medicine: "medicine",
        water: "water",
        wood: "wood",
        stone: "stone",
      } as const;
      const gains = (Object.keys(labels) as Array<keyof typeof labels>)
        .map((item) => ({ item, amount: inventory[item] - this.previousInventory![item] }))
        .filter((gain) => gain.amount > 0)
        .map((gain) => `+${gain.amount} ${labels[gain.item]}`);

      if (gains.length > 0) {
        showLootNotification(gains.join("  |  "));
      }
    }

    this.previousInventory = {
      ...inventory,
      slots: inventory.slots.map((slot) => ({ ...slot })),
    };
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
    const activePropIds = new Set<string>();
    const activeGeneratedBuildingIds = new Set<string>();

    for (let chunkY = centerChunkY - 1; chunkY <= centerChunkY + 1; chunkY += 1) {
      for (let chunkX = centerChunkX - 1; chunkX <= centerChunkX + 1; chunkX += 1) {
        generateChunkBuildings(this.worldSeed, chunkX, chunkY).forEach((placement) => {
          const building = resolveGeneratedBuilding(placement);
          activeGeneratedBuildingIds.add(building.id);
          this.worldBuildings.set(building.id, building);
          this.upsertExteriorBuilding(building);
        });
      }
    }

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

        generateChunkProps(this.worldSeed, chunkX, chunkY).forEach((prop) => {
          const overlapsBuilding = this.allBuildings().some((building) => {
            const collider = building.exterior.collider;
            return prop.x >= collider.x - 32
              && prop.x <= collider.x + collider.width + 32
              && prop.y >= collider.y - 32
              && prop.y <= collider.y + collider.height + 32;
          });
          if (overlapsBuilding) {
            return;
          }
          activePropIds.add(prop.id);
          if (this.ambientProps.has(prop.id)) {
            return;
          }
          const image = this.add
            .image(prop.x, prop.y, `ambient:${prop.kind}:${prop.variant}`)
            .setOrigin(0.5, 0.78)
            .setFlipX(prop.flipX)
            .setDepth(prop.kind === "grass" ? prop.y - 1 : prop.y + 0.005)
            .setVisible(this.currentSpaceId === OVERWORLD_SPACE_ID);
          const displaySize = (prop.kind === "grass" ? 42 : 38) * prop.scale;
          image.setDisplaySize(displaySize, displaySize);
          this.ambientProps.set(prop.id, image);
        });
      }
    }

    this.terrainChunks.forEach((image, textureKey) => {
      if (!activeTextureKeys.has(textureKey)) {
        image.destroy();
        this.terrainChunks.delete(textureKey);
      }
    });
    this.ambientProps.forEach((image, propId) => {
      if (!activePropIds.has(propId)) {
        image.destroy();
        this.ambientProps.delete(propId);
      }
    });
    this.exteriorBuildings.forEach((image, buildingId) => {
      if (this.staticBuildingIds.has(buildingId) || activeGeneratedBuildingIds.has(buildingId)) {
        return;
      }
      const building = this.worldBuildings.get(buildingId);
      if (building?.interior.spaceId === this.currentSpaceId) {
        return;
      }
      image.destroy();
      this.exteriorBuildings.delete(buildingId);
      if (building) {
        building.interior.containers.forEach((container) => {
          this.containerVisuals.delete(container.id);
        });
        this.interiorObjectsBySpace.get(building.interior.spaceId)?.forEach((object) => {
          object.destroy();
        });
        this.interiorObjectsBySpace.delete(building.interior.spaceId);
      }
      this.worldBuildings.delete(buildingId);
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
    this.ambientProps.forEach((image) => image.destroy());
    this.ambientProps.clear();
    this.exteriorBuildings.forEach((image, buildingId) => {
      if (!this.staticBuildingIds.has(buildingId)) {
        image.destroy();
        this.exteriorBuildings.delete(buildingId);
      }
    });
    this.worldBuildings.forEach((building, buildingId) => {
      if (this.staticBuildingIds.has(buildingId)) {
        return;
      }
      this.interiorObjectsBySpace.get(building.interior.spaceId)?.forEach((object) => {
        object.destroy();
      });
      this.interiorObjectsBySpace.delete(building.interior.spaceId);
      building.interior.containers.forEach((container) => {
        this.containerVisuals.delete(container.id);
      });
      this.worldBuildings.delete(buildingId);
    });
  }

  private terrainTextureKey(chunkX: number, chunkY: number): string {
    return `terrain:${this.worldSeed}:${chunkX}:${chunkY}`;
  }

  private colorToCss(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }
}
