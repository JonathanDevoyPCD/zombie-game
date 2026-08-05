import { ITEMS, isItemId } from "@last-survivor/content";
import type { InventoryEvent, InventorySnapshot } from "@last-survivor/shared";
import { SPRITE_ASSETS } from "../assets/spriteCatalog";

interface InventoryActions {
  move(fromIndex: number, toIndex: number, quantity?: number): void;
  drop(slotIndex: number, quantity?: number): void;
}

let actions: InventoryActions | null = null;
let currentInventory: InventorySnapshot | null = null;
let selectedIndex: number | null = null;
let draggedIndex: number | null = null;
let renderedInventorySignature = "";

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) {
    throw new Error(`Missing inventory UI element #${id}`);
  }
  return result as T;
}

export function initializeInventoryUi(nextActions: InventoryActions): void {
  actions = nextActions;
  element<HTMLButtonElement>("inventory-close").addEventListener("click", closeInventory);
  element<HTMLButtonElement>("inventory-split").addEventListener("click", splitSelectedStack);
  element<HTMLButtonElement>("inventory-drop").addEventListener("click", dropSelectedStack);
}

export function toggleInventory(): void {
  const menu = element<HTMLElement>("inventory-menu");
  if (menu.hidden) {
    menu.hidden = false;
    renderInventory();
  } else {
    closeInventory();
  }
}

export function closeInventory(): void {
  element<HTMLElement>("inventory-menu").hidden = true;
  selectedIndex = null;
}

export function isInventoryOpen(): boolean {
  return !element<HTMLElement>("inventory-menu").hidden;
}

export function updateInventoryMenu(inventory: InventorySnapshot): void {
  currentInventory = inventory;
  let selectionChanged = false;
  if (selectedIndex !== null && !inventory.slots[selectedIndex]?.itemId) {
    selectedIndex = null;
    selectionChanged = true;
  }
  const signature = `${inventory.capacity}:${inventory.slots
    .map((slot) => `${slot.index}:${slot.itemId}:${slot.quantity}`)
    .join("|")}`;
  if (!selectionChanged && signature === renderedInventorySignature) {
    return;
  }
  renderedInventorySignature = signature;
  renderInventory();
}

export function showInventoryEvent(event: InventoryEvent): void {
  const status = element<HTMLElement>("inventory-status");
  status.textContent = event.message;
  status.dataset.kind = event.kind;
}

function renderInventory(): void {
  const grid = element<HTMLElement>("inventory-slot-grid");
  const capacity = element<HTMLElement>("inventory-capacity");
  const details = element<HTMLElement>("inventory-details");
  const splitButton = element<HTMLButtonElement>("inventory-split");
  const dropButton = element<HTMLButtonElement>("inventory-drop");
  grid.replaceChildren();

  const inventory = currentInventory;
  if (!inventory) {
    capacity.textContent = "0 / 16";
    details.textContent = "Waiting for field pack...";
    splitButton.disabled = true;
    dropButton.disabled = true;
    return;
  }

  const occupied = inventory.slots.filter((slot) => slot.itemId && slot.quantity > 0).length;
  capacity.textContent = `${occupied} / ${inventory.capacity}`;

  for (let index = 0; index < inventory.capacity; index += 1) {
    const slot = inventory.slots[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-slot${selectedIndex === index ? " is-selected" : ""}`;
    button.dataset.index = String(index);
    button.ariaLabel = slot?.itemId && isItemId(slot.itemId)
      ? `${ITEMS[slot.itemId].name}, quantity ${slot.quantity}`
      : `Empty inventory slot ${index + 1}`;
    button.addEventListener("click", () => selectOrMove(index));
    button.addEventListener("dragover", (event) => event.preventDefault());
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        actions?.move(draggedIndex, index);
      }
      draggedIndex = null;
      selectedIndex = null;
    });

    if (slot?.itemId && isItemId(slot.itemId) && slot.quantity > 0) {
      button.classList.add("is-filled");
      button.draggable = true;
      button.addEventListener("dragstart", () => {
        draggedIndex = index;
      });
      button.addEventListener("dragend", () => {
        draggedIndex = null;
      });
      const image = document.createElement("img");
      image.src = SPRITE_ASSETS.items[slot.itemId];
      image.alt = "";
      image.draggable = false;
      const amount = document.createElement("b");
      amount.textContent = String(slot.quantity);
      button.append(image, amount);
    }
    grid.append(button);
  }

  const selected = selectedIndex === null ? undefined : inventory.slots[selectedIndex];
  if (selected?.itemId && isItemId(selected.itemId)) {
    details.textContent = `${ITEMS[selected.itemId].name} - ${selected.quantity}`;
    splitButton.disabled = selected.quantity < 2 || !inventory.slots.some((slot) => !slot.itemId);
    dropButton.disabled = false;
  } else {
    details.textContent = "Select an item stack";
    splitButton.disabled = true;
    dropButton.disabled = true;
  }
}

function selectOrMove(index: number): void {
  const slot = currentInventory?.slots[index];
  if (selectedIndex === null) {
    if (slot?.itemId) {
      selectedIndex = index;
      renderInventory();
    }
    return;
  }
  if (selectedIndex === index) {
    selectedIndex = null;
    renderInventory();
    return;
  }
  actions?.move(selectedIndex, index);
  selectedIndex = null;
}

function splitSelectedStack(): void {
  if (selectedIndex === null || !currentInventory) {
    return;
  }
  const source = currentInventory.slots[selectedIndex];
  const target = currentInventory.slots.find((slot) => !slot.itemId);
  if (!source || !target || source.quantity < 2) {
    return;
  }
  actions?.move(selectedIndex, target.index, Math.floor(source.quantity / 2));
  selectedIndex = null;
}

function dropSelectedStack(): void {
  if (selectedIndex === null) {
    return;
  }
  actions?.drop(selectedIndex);
  selectedIndex = null;
}
