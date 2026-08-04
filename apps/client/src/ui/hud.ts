import { BIOMES, type BiomeId } from "@last-survivor/content";
import type { InventorySnapshot } from "@last-survivor/shared";

let lootToastTimer = 0;
let combatToastTimer = 0;

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

export function updateConnectionStatus(connected: boolean): void {
  setText("connection-status", connected ? "World server online" : "World server unavailable");
  document.getElementById("connection-dot")?.classList.toggle("is-online", connected);
}

export function updateWorldReadout(worldId: string, biome: BiomeId, playerCount: number): void {
  updateAreaReadout(worldId, BIOMES[biome].name, playerCount);
}

export function updateAreaReadout(worldId: string, areaName: string, playerCount: number): void {
  setText("world-id", worldId.toUpperCase());
  setText("biome-name", areaName);
  setText("player-count", `${playerCount} / 4 SURVIVORS`);
}

export function updateFrameRate(frameRate: number): void {
  setText("frame-rate", `${Math.round(frameRate)} FPS`);
}

export function updateInventory(inventory: InventorySnapshot): void {
  setText("inventory-scrap", String(inventory.scrap));
  setText("inventory-parts", String(inventory.parts));
  setText("inventory-food", String(inventory.food));
  setText("inventory-medicine", String(inventory.medicine));
}

export function updateHealth(health: number, maxHealth: number): void {
  const safeMaximum = Math.max(1, maxHealth);
  const ratio = Math.max(0, Math.min(1, health / safeMaximum));
  const fill = document.getElementById("health-fill");
  if (fill) {
    fill.style.transform = `scaleX(${ratio})`;
  }
  setText("health-value", `${Math.round(health)} / ${Math.round(safeMaximum)}`);
}

export function showCombatNotification(message: string): void {
  const toast = document.getElementById("combat-toast");
  if (!toast) {
    return;
  }

  window.clearTimeout(combatToastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("is-leaving");
  combatToastTimer = window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-leaving");
    }, 180);
  }, 2800);
}

export function showLootNotification(message: string): void {
  const toast = document.getElementById("loot-toast");
  if (!toast) {
    return;
  }

  window.clearTimeout(lootToastTimer);
  setText("loot-toast-text", message);
  toast.hidden = false;
  toast.classList.remove("is-leaving");
  lootToastTimer = window.setTimeout(() => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-leaving");
    }, 180);
  }, 2600);
}

export function showInteractionPrompt(message: string, actionable = true): void {
  const prompt = document.getElementById("interaction-prompt");
  if (!prompt) {
    return;
  }

  prompt.hidden = false;
  prompt.classList.toggle("is-status", !actionable);
  setText("interaction-text", message);
}

export function hideInteractionPrompt(): void {
  const prompt = document.getElementById("interaction-prompt");
  if (prompt) {
    prompt.hidden = true;
  }
}
