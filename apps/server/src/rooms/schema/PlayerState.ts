import { ArraySchema, defineTypes, Schema } from "@colyseus/schema";
import { InventorySlotState } from "./InventorySlotState.js";

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
  stamina = 100;
  maxStamina = 100;
  sprinting = false;
  flashlight = false;
  scrap = 0;
  parts = 0;
  food = 0;
  medicine = 0;
  wood = 0;
  stone = 0;
  inventorySlots = new ArraySchema<InventorySlotState>();
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
  stamina: "number",
  maxStamina: "number",
  sprinting: "boolean",
  flashlight: "boolean",
  scrap: "number",
  parts: "number",
  food: "number",
  medicine: "number",
  wood: "number",
  stone: "number",
  inventorySlots: [InventorySlotState],
  lastProcessedInput: "number",
});
