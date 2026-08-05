import { Client, type Room } from "@colyseus/sdk";
import {
  ClientMessage,
  ServerMessage,
  WORLD_ROOM,
  type CombatEvent,
  type BuildEvent,
  type BuildPlaceInput,
  type ContainerSnapshot,
  type FireWeaponInput,
  type InventoryDropInput,
  type InventoryEvent,
  type InventoryMoveInput,
  type InventorySlotSnapshot,
  type JoinWorldOptions,
  type MovementInput,
  type PlayerSnapshot,
  type PlacedStructureSnapshot,
  type ResourceNodeSnapshot,
  type ZombieSnapshot,
  type WorldPickupSnapshot,
} from "@last-survivor/shared";

interface NetworkPlayerState extends Omit<PlayerSnapshot, "inventory"> {
  scrap: number;
  parts: number;
  food: number;
  medicine: number;
  wood: number;
  stone: number;
  inventorySlots: Array<InventorySlotSnapshot>;
}

interface NetworkWorldState {
  worldId: string;
  seed: string;
  tick: number;
  players: Map<string, NetworkPlayerState>;
  containers: Map<string, ContainerSnapshot>;
  zombies: Map<string, ZombieSnapshot>;
  pickups: Map<string, WorldPickupSnapshot>;
  structures: Map<string, PlacedStructureSnapshot>;
  resources: Map<string, ResourceNodeSnapshot>;
}

export interface WorldSnapshot {
  connected: boolean;
  sessionId: string;
  worldId: string;
  seed: string;
  players: PlayerSnapshot[];
  containers: ContainerSnapshot[];
  zombies: ZombieSnapshot[];
  pickups: WorldPickupSnapshot[];
  structures: PlacedStructureSnapshot[];
  resources: ResourceNodeSnapshot[];
}

type SnapshotListener = (snapshot: WorldSnapshot) => void;
type CombatEventListener = (event: CombatEvent) => void;
type InventoryEventListener = (event: InventoryEvent) => void;
type BuildEventListener = (event: BuildEvent) => void;

const endpoint = import.meta.env.VITE_SERVER_URL ?? "http://127.0.0.1:2567";

export class WorldConnection {
  private readonly client = new Client(endpoint);
  private room: Room<unknown, NetworkWorldState> | null = null;
  private listener: SnapshotListener | null = null;
  private combatEventListener: CombatEventListener | null = null;
  private inventoryEventListener: InventoryEventListener | null = null;
  private buildEventListener: BuildEventListener | null = null;

  async connect(
    options: JoinWorldOptions,
    listener: SnapshotListener,
    combatEventListener?: CombatEventListener,
    inventoryEventListener?: InventoryEventListener,
    buildEventListener?: BuildEventListener,
  ): Promise<void> {
    this.listener = listener;
    this.combatEventListener = combatEventListener ?? null;
    this.inventoryEventListener = inventoryEventListener ?? null;
    this.buildEventListener = buildEventListener ?? null;
    this.room = await this.client.joinOrCreate<NetworkWorldState>(WORLD_ROOM, options);
    this.room.onMessage(ServerMessage.COMBAT_EVENT, (event: CombatEvent) => {
      this.combatEventListener?.(event);
    });
    this.room.onMessage(ServerMessage.INVENTORY_EVENT, (event: InventoryEvent) => {
      this.inventoryEventListener?.(event);
    });
    this.room.onMessage(ServerMessage.BUILD_EVENT, (event: BuildEvent) => {
      this.buildEventListener?.(event);
    });
    this.room.onStateChange(() => this.publish());
    this.room.onLeave(() => {
      this.room = null;
      this.publishDisconnected();
    });
  }

  sendInput(input: MovementInput): boolean {
    if (!this.room) {
      return false;
    }

    this.room.send(ClientMessage.INPUT, input);
    return true;
  }

  interact(): void {
    this.room?.send(ClientMessage.INTERACT);
  }

  fire(input: FireWeaponInput): void {
    this.room?.send(ClientMessage.FIRE, input);
  }

  moveInventory(input: InventoryMoveInput): void {
    this.room?.send(ClientMessage.INVENTORY_MOVE, input);
  }

  dropInventory(input: InventoryDropInput): void {
    this.room?.send(ClientMessage.INVENTORY_DROP, input);
  }

  placeStructure(input: BuildPlaceInput): void {
    this.room?.send(ClientMessage.BUILD_PLACE, input);
  }

  toggleFlashlight(): void {
    this.room?.send(ClientMessage.FLASHLIGHT_TOGGLE);
  }

  async disconnect(): Promise<void> {
    await this.room?.leave();
    this.room = null;
  }

  private publish(): void {
    if (!this.room || !this.listener) {
      return;
    }

    const state = this.room.state;
    if (!state?.worldId || !state.seed || !state.players) {
      return;
    }

    const players: PlayerSnapshot[] = [];
    state.players?.forEach((player) => {
      players.push({
        id: player.id,
        survivorId: player.survivorId,
        name: player.name,
        x: player.x,
        y: player.y,
        facing: player.facing,
        spaceId: player.spaceId,
        activeSearchId: player.activeSearchId,
        health: player.health,
        maxHealth: player.maxHealth,
        stamina: player.stamina,
        maxStamina: player.maxStamina,
        sprinting: player.sprinting,
        flashlight: player.flashlight,
        inventory: {
          scrap: player.scrap,
          parts: player.parts,
          food: player.food,
          medicine: player.medicine,
          wood: player.wood,
          stone: player.stone,
          capacity: player.inventorySlots.length,
          slots: [...player.inventorySlots].map((slot) => ({
            index: slot.index,
            itemId: slot.itemId,
            quantity: slot.quantity,
          })),
        },
        lastProcessedInput: player.lastProcessedInput,
      });
    });

    const containers: ContainerSnapshot[] = [];
    state.containers?.forEach((container) => {
      containers.push({
        id: container.id,
        spaceId: container.spaceId,
        opened: container.opened,
        searchedBy: container.searchedBy,
        searchingBy: container.searchingBy,
        searchingByName: container.searchingByName,
        searchStartedAt: container.searchStartedAt,
        searchDurationMs: container.searchDurationMs,
        searchProgress: container.searchProgress,
      });
    });

    const zombies: ZombieSnapshot[] = [];
    state.zombies?.forEach((zombie) => {
      zombies.push({
        id: zombie.id,
        name: zombie.name,
        x: zombie.x,
        y: zombie.y,
        spaceId: zombie.spaceId,
        health: zombie.health,
        maxHealth: zombie.maxHealth,
        alive: zombie.alive,
        aggroTarget: zombie.aggroTarget,
        respawnAt: zombie.respawnAt,
      });
    });

    const pickups: WorldPickupSnapshot[] = [];
    state.pickups?.forEach((pickup) => {
      pickups.push({
        id: pickup.id,
        itemId: pickup.itemId,
        quantity: pickup.quantity,
        x: pickup.x,
        y: pickup.y,
        spaceId: pickup.spaceId,
        droppedBy: pickup.droppedBy,
      });
    });

    const structures: PlacedStructureSnapshot[] = [];
    state.structures?.forEach((structure) => {
      structures.push({
        id: structure.id,
        buildableId: structure.buildableId,
        x: structure.x,
        y: structure.y,
        orientation: structure.orientation,
        placedBy: structure.placedBy,
      });
    });

    const resources: ResourceNodeSnapshot[] = [];
    state.resources?.forEach((resource) => {
      if (resource.kind !== "tree" && resource.kind !== "stone") {
        return;
      }
      resources.push({
        id: resource.id,
        kind: resource.kind,
        variant: resource.variant,
        x: resource.x,
        y: resource.y,
        available: resource.available,
        respawnAt: resource.respawnAt,
        harvestingBy: resource.harvestingBy,
        harvestingByName: resource.harvestingByName,
        harvestProgress: resource.harvestProgress,
      });
    });

    this.listener({
      connected: true,
      sessionId: this.room.sessionId,
      worldId: state.worldId,
      seed: state.seed,
      players,
      containers,
      zombies,
      pickups,
      structures,
      resources,
    });
  }

  private publishDisconnected(): void {
    if (!this.listener) {
      return;
    }

    this.listener({
      connected: false,
      sessionId: "",
      worldId: "",
      seed: "",
      players: [],
      containers: [],
      zombies: [],
      pickups: [],
      structures: [],
      resources: [],
    });
  }
}
