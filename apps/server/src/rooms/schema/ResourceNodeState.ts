import { defineTypes, Schema } from "@colyseus/schema";

export class ResourceNodeState extends Schema {
  id = "";
  kind = "tree";
  variant = 0;
  x = 0;
  y = 0;
  available = true;
  respawnAt = 0;
  harvestingBy = "";
  harvestingByName = "";
  harvestStartedAt = 0;
  harvestDurationMs = 0;
  harvestProgress = 0;
}

defineTypes(ResourceNodeState, {
  id: "string",
  kind: "string",
  variant: "number",
  x: "number",
  y: "number",
  available: "boolean",
  respawnAt: "number",
  harvestingBy: "string",
  harvestingByName: "string",
  harvestStartedAt: "number",
  harvestDurationMs: "number",
  harvestProgress: "number",
});
