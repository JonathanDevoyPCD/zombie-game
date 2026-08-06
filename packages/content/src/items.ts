export const INVENTORY_SLOT_COUNT = 16;

export const ITEM_IDS = [
  "scrap",
  "parts",
  "food",
  "medicine",
  "water",
  "wood",
  "stone",
] as const;

export type ItemId = (typeof ITEM_IDS)[number];
export type ItemCategory = "resource" | "consumable";

export interface ItemDefinition {
  id: ItemId;
  name: string;
  category: ItemCategory;
  maxStack: number;
}

export const ITEMS: Readonly<Record<ItemId, ItemDefinition>> = {
  scrap: { id: "scrap", name: "Scrap", category: "resource", maxStack: 999 },
  parts: { id: "parts", name: "Iron fittings", category: "resource", maxStack: 999 },
  food: { id: "food", name: "Food", category: "consumable", maxStack: 20 },
  medicine: { id: "medicine", name: "Remedy", category: "consumable", maxStack: 20 },
  water: { id: "water", name: "Fresh water", category: "consumable", maxStack: 20 },
  wood: { id: "wood", name: "Wood", category: "resource", maxStack: 999 },
  stone: { id: "stone", name: "Stone", category: "resource", maxStack: 999 },
};

export function isItemId(value: unknown): value is ItemId {
  return typeof value === "string" && ITEM_IDS.includes(value as ItemId);
}
