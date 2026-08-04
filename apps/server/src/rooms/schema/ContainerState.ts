import { defineTypes, Schema } from "@colyseus/schema";

export class ContainerState extends Schema {
  id = "";
  spaceId = "";
  opened = false;
  searchedBy = "";
  searchingBy = "";
  searchingByName = "";
  searchStartedAt = 0;
  searchDurationMs = 0;
  searchProgress = 0;
}

defineTypes(ContainerState, {
  id: "string",
  spaceId: "string",
  opened: "boolean",
  searchedBy: "string",
  searchingBy: "string",
  searchingByName: "string",
  searchStartedAt: "number",
  searchDurationMs: "number",
  searchProgress: "number",
});
