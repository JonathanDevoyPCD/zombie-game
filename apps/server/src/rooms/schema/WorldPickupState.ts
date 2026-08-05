import { defineTypes, Schema } from "@colyseus/schema";

export class WorldPickupState extends Schema {
  id = "";
  itemId = "";
  quantity = 0;
  x = 0;
  y = 0;
  spaceId = "overworld";
  droppedBy = "";
}

defineTypes(WorldPickupState, {
  id: "string",
  itemId: "string",
  quantity: "number",
  x: "number",
  y: "number",
  spaceId: "string",
  droppedBy: "string",
});

