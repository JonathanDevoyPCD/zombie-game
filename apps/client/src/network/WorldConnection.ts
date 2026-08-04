import { Client, type Room } from "@colyseus/sdk";
import {
  ClientMessage,
  ServerMessage,
  WORLD_ROOM,
  type CombatEvent,
  type ContainerSnapshot,
  type FireWeaponInput,
  type JoinWorldOptions,
  type MovementInput,
  type PlayerSnapshot,
  type ZombieSnapshot,
} from "@last-survivor/shared";

interface NetworkPlayerState extends Omit<PlayerSnapshot, "inventory"> {
  scrap: number;
  parts: number;
  food: number;
  medicine: number;
}

interface NetworkWorldState {
  worldId: string;
  seed: string;
  tick: number;
  players: Map<string, NetworkPlayerState>;
  containers: Map<string, ContainerSnapshot>;
  zombies: Map<string, ZombieSnapshot>;
}

export interface WorldSnapshot {
  connected: boolean;
  sessionId: string;
  worldId: string;
  seed: string;
  players: PlayerSnapshot[];
  containers: ContainerSnapshot[];
  zombies: ZombieSnapshot[];
}

type SnapshotListener = (snapshot: WorldSnapshot) => void;
type CombatEventListener = (event: CombatEvent) => void;

const endpoint = import.meta.env.VITE_SERVER_URL ?? "http://127.0.0.1:2567";

export class WorldConnection {
  private readonly client = new Client(endpoint);
  private room: Room<unknown, NetworkWorldState> | null = null;
  private listener: SnapshotListener | null = null;
  private combatEventListener: CombatEventListener | null = null;

  async connect(
    options: JoinWorldOptions,
    listener: SnapshotListener,
    combatEventListener?: CombatEventListener,
  ): Promise<void> {
    this.listener = listener;
    this.combatEventListener = combatEventListener ?? null;
    this.room = await this.client.joinOrCreate<NetworkWorldState>(WORLD_ROOM, options);
    this.room.onMessage(ServerMessage.COMBAT_EVENT, (event: CombatEvent) => {
      this.combatEventListener?.(event);
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
        inventory: {
          scrap: player.scrap,
          parts: player.parts,
          food: player.food,
          medicine: player.medicine,
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

    this.listener({
      connected: true,
      sessionId: this.room.sessionId,
      worldId: state.worldId,
      seed: state.seed,
      players,
      containers,
      zombies,
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
    });
  }
}
