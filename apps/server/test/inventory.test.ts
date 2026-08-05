import { describe, expect, it } from "vitest";
import {
  addInventoryBundle,
  addInventoryItem,
  canAddInventoryBundle,
  emptyInventorySlots,
  inventoryTotals,
  moveInventoryStack,
  removeInventoryItemAt,
} from "../src/inventory/inventory";

describe("authoritative inventory operations", () => {
  it("stacks loot and derives resource totals", () => {
    const slots = emptyInventorySlots();
    expect(addInventoryItem(slots, "scrap", 12)).toBe(12);
    expect(addInventoryItem(slots, "scrap", 7)).toBe(7);
    expect(addInventoryBundle(slots, { parts: 3, medicine: 1 })).toBe(true);
    expect(inventoryTotals(slots)).toMatchObject({ scrap: 19, parts: 3, medicine: 1 });
    expect(slots.filter((slot) => slot.itemId === "scrap")).toHaveLength(1);
  });

  it("moves, splits, merges, and swaps stacks", () => {
    const slots = emptyInventorySlots();
    addInventoryItem(slots, "scrap", 20);
    addInventoryItem(slots, "parts", 4);
    expect(moveInventoryStack(slots, 0, 2, 8)).toBe(true);
    expect(slots[0]).toMatchObject({ itemId: "scrap", quantity: 12 });
    expect(slots[2]).toMatchObject({ itemId: "scrap", quantity: 8 });
    expect(moveInventoryStack(slots, 2, 0)).toBe(true);
    expect(slots[0]).toMatchObject({ itemId: "scrap", quantity: 20 });
    expect(moveInventoryStack(slots, 0, 1)).toBe(true);
    expect(slots[0]).toMatchObject({ itemId: "parts", quantity: 4 });
    expect(slots[1]).toMatchObject({ itemId: "scrap", quantity: 20 });
  });

  it("refuses an atomic bundle when no slot can hold it", () => {
    const slots = emptyInventorySlots();
    slots.forEach((slot) => {
      slot.itemId = "food";
      slot.quantity = 20;
    });
    expect(canAddInventoryBundle(slots, { medicine: 1 })).toBe(false);
    expect(addInventoryBundle(slots, { medicine: 1 })).toBe(false);
    expect(inventoryTotals(slots).medicine).toBe(0);
  });

  it("removes only the requested drop quantity", () => {
    const slots = emptyInventorySlots();
    addInventoryItem(slots, "stone", 15);
    expect(removeInventoryItemAt(slots, 0, 6)).toEqual({ itemId: "stone", quantity: 6 });
    expect(slots[0]).toMatchObject({ itemId: "stone", quantity: 9 });
  });
});
