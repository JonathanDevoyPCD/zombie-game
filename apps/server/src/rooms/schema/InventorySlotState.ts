import { defineTypes, Schema } from "@colyseus/schema";

export class InventorySlotState extends Schema {
  index = 0;
  itemId = "";
  quantity = 0;
}

defineTypes(InventorySlotState, {
  index: "number",
  itemId: "string",
  quantity: "number",
});

