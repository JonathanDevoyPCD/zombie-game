import { defineTypes, Schema } from "@colyseus/schema";

export class ZombieState extends Schema {
  id = "";
  name = "Zombie";
  x = 0;
  y = 0;
  spaceId = "overworld";
  health = 100;
  maxHealth = 100;
  alive = true;
  aggroTarget = "";
  respawnAt = 0;
}

defineTypes(ZombieState, {
  id: "string",
  name: "string",
  x: "number",
  y: "number",
  spaceId: "string",
  health: "number",
  maxHealth: "number",
  alive: "boolean",
  aggroTarget: "string",
  respawnAt: "number",
});
