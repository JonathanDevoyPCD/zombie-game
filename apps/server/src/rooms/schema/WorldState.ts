import { defineTypes, MapSchema, Schema } from "@colyseus/schema";
import { ContainerState } from "./ContainerState.js";
import { PlayerState } from "./PlayerState.js";
import { ZombieState } from "./ZombieState.js";

export class WorldState extends Schema {
  worldId = "dev-world";
  seed = "last-survivor-dev";
  tick = 0;
  players = new MapSchema<PlayerState>();
  containers = new MapSchema<ContainerState>();
  zombies = new MapSchema<ZombieState>();
}

defineTypes(WorldState, {
  worldId: "string",
  seed: "string",
  tick: "number",
  players: { map: PlayerState },
  containers: { map: ContainerState },
  zombies: { map: ZombieState },
});
