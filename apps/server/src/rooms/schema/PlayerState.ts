import { defineTypes, Schema } from "@colyseus/schema";

export class PlayerState extends Schema {
  id = "";
  survivorId = "";
  name = "Survivor";
  x = 0;
  y = 0;
  facing = 0;
  spaceId = "overworld";
  activeSearchId = "";
  health = 100;
  maxHealth = 100;
  scrap = 0;
  parts = 0;
  food = 0;
  medicine = 0;
  lastProcessedInput = 0;
}

defineTypes(PlayerState, {
  id: "string",
  survivorId: "string",
  name: "string",
  x: "number",
  y: "number",
  facing: "number",
  spaceId: "string",
  activeSearchId: "string",
  health: "number",
  maxHealth: "number",
  scrap: "number",
  parts: "number",
  food: "number",
  medicine: "number",
  lastProcessedInput: "number",
});
