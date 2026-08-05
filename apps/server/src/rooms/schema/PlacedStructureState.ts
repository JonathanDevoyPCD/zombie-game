import { defineTypes, Schema } from "@colyseus/schema";

export class PlacedStructureState extends Schema {
  id = "";
  buildableId = "";
  x = 0;
  y = 0;
  orientation = "horizontal";
  placedBy = "";
}

defineTypes(PlacedStructureState, {
  id: "string",
  buildableId: "string",
  x: "number",
  y: "number",
  orientation: "string",
  placedBy: "string",
});
