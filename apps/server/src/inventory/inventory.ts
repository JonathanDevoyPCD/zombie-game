import {
  INVENTORY_SLOT_COUNT,
  ITEMS,
  isItemId,
  type ItemId,
} from "@last-survivor/content";

export interface InventorySlotLike {
  itemId: string;
  quantity: number;
}

export type InventoryBundle = Readonly<Partial<Record<ItemId, number>>>;

export function emptyInventorySlots(): InventorySlotLike[] {
  return Array.from(
    { length: INVENTORY_SLOT_COUNT },
    () => ({ itemId: "", quantity: 0 }),
  );
}

export function cloneInventorySlots(
  slots: readonly InventorySlotLike[],
): InventorySlotLike[] {
  return Array.from({ length: INVENTORY_SLOT_COUNT }, (_, index) => {
    const slot = slots[index];
    return slot && isItemId(slot.itemId) && slot.quantity > 0
      ? { itemId: slot.itemId, quantity: Math.floor(slot.quantity) }
      : { itemId: "", quantity: 0 };
  });
}

export function inventoryTotals(
  slots: readonly InventorySlotLike[],
): Record<ItemId, number> {
  const totals: Record<ItemId, number> = {
    scrap: 0,
    parts: 0,
    food: 0,
    medicine: 0,
    wood: 0,
    stone: 0,
  };

  slots.forEach((slot) => {
    if (isItemId(slot.itemId) && slot.quantity > 0) {
      totals[slot.itemId] += Math.floor(slot.quantity);
    }
  });
  return totals;
}

export function addInventoryItem(
  slots: InventorySlotLike[],
  itemId: ItemId,
  quantity: number,
): number {
  let remaining = Math.max(0, Math.floor(quantity));
  const maximum = ITEMS[itemId].maxStack;

  slots.forEach((slot) => {
    if (remaining <= 0 || slot.itemId !== itemId || slot.quantity >= maximum) {
      return;
    }
    const transfer = Math.min(remaining, maximum - slot.quantity);
    slot.quantity += transfer;
    remaining -= transfer;
  });

  slots.forEach((slot) => {
    if (remaining <= 0 || slot.itemId) {
      return;
    }
    const transfer = Math.min(remaining, maximum);
    slot.itemId = itemId;
    slot.quantity = transfer;
    remaining -= transfer;
  });

  return Math.max(0, Math.floor(quantity)) - remaining;
}

export function canAddInventoryBundle(
  slots: readonly InventorySlotLike[],
  bundle: InventoryBundle,
): boolean {
  const candidate = cloneInventorySlots(slots);
  return Object.entries(bundle).every(([itemId, quantity]) => {
    if (!isItemId(itemId)) {
      return false;
    }
    const expected = Math.max(0, Math.floor(quantity ?? 0));
    return addInventoryItem(candidate, itemId, expected) === expected;
  });
}

export function addInventoryBundle(
  slots: InventorySlotLike[],
  bundle: InventoryBundle,
): boolean {
  if (!canAddInventoryBundle(slots, bundle)) {
    return false;
  }
  Object.entries(bundle).forEach(([itemId, quantity]) => {
    if (isItemId(itemId)) {
      addInventoryItem(slots, itemId, quantity ?? 0);
    }
  });
  return true;
}

export function removeInventoryBundle(
  slots: InventorySlotLike[],
  bundle: InventoryBundle,
): boolean {
  const totals = inventoryTotals(slots);
  const requirements = Object.entries(bundle);
  if (requirements.some(([itemId, quantity]) => (
    !isItemId(itemId)
    || totals[itemId] < Math.max(0, Math.floor(quantity ?? 0))
  ))) {
    return false;
  }

  requirements.forEach(([itemId, quantity]) => {
    if (!isItemId(itemId)) {
      return;
    }
    let remaining = Math.max(0, Math.floor(quantity ?? 0));
    slots.forEach((slot) => {
      if (remaining <= 0 || slot.itemId !== itemId) {
        return;
      }
      const removed = Math.min(remaining, slot.quantity);
      slot.quantity -= removed;
      remaining -= removed;
      if (slot.quantity <= 0) {
        slot.itemId = "";
        slot.quantity = 0;
      }
    });
  });
  return true;
}

export function moveInventoryStack(
  slots: InventorySlotLike[],
  fromIndex: number,
  toIndex: number,
  requestedQuantity?: number,
): boolean {
  if (
    !Number.isInteger(fromIndex)
    || !Number.isInteger(toIndex)
    || fromIndex < 0
    || toIndex < 0
    || fromIndex >= INVENTORY_SLOT_COUNT
    || toIndex >= INVENTORY_SLOT_COUNT
    || fromIndex === toIndex
  ) {
    return false;
  }

  const source = slots[fromIndex];
  const target = slots[toIndex];
  if (!source || !target || !isItemId(source.itemId) || source.quantity <= 0) {
    return false;
  }

  const quantity = requestedQuantity === undefined
    ? source.quantity
    : Math.min(source.quantity, Math.max(1, Math.floor(requestedQuantity)));

  if (!target.itemId) {
    target.itemId = source.itemId;
    target.quantity = quantity;
    source.quantity -= quantity;
  } else if (target.itemId === source.itemId) {
    const available = ITEMS[source.itemId].maxStack - target.quantity;
    const transfer = Math.min(quantity, Math.max(0, available));
    if (transfer <= 0) {
      return false;
    }
    target.quantity += transfer;
    source.quantity -= transfer;
  } else {
    if (quantity !== source.quantity) {
      return false;
    }
    const sourceItemId = source.itemId;
    const sourceQuantity = source.quantity;
    source.itemId = target.itemId;
    source.quantity = target.quantity;
    target.itemId = sourceItemId;
    target.quantity = sourceQuantity;
  }

  if (source.quantity <= 0) {
    source.itemId = "";
    source.quantity = 0;
  }
  return true;
}

export function removeInventoryItemAt(
  slots: InventorySlotLike[],
  slotIndex: number,
  requestedQuantity?: number,
): { itemId: ItemId; quantity: number } | null {
  const slot = slots[slotIndex];
  if (!slot || !isItemId(slot.itemId) || slot.quantity <= 0) {
    return null;
  }
  const quantity = requestedQuantity === undefined
    ? slot.quantity
    : Math.min(slot.quantity, Math.max(1, Math.floor(requestedQuantity)));
  const itemId = slot.itemId;
  slot.quantity -= quantity;
  if (slot.quantity <= 0) {
    slot.itemId = "";
    slot.quantity = 0;
  }
  return { itemId, quantity };
}
