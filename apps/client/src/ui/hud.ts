import { BIOMES, type BiomeId } from "@last-survivor/content";
import type { InventorySnapshot } from "@last-survivor/shared";
import { SPRITE_ASSETS } from "../assets/spriteCatalog";

let lootToastTimer = 0;
let combatToastTimer = 0;
let resourceIconsReady = false;

export interface MinimapMarker {
  x: number;
  y: number;
  kind: "player" | "ally" | "zombie" | "building" | "structure" | "resource";
}

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
  initializeResourceIcons();
  setText("inventory-scrap", String(inventory.scrap));
  setText("inventory-parts", String(inventory.parts));
  setText("inventory-food", String(inventory.food));
  setText("inventory-medicine", String(inventory.medicine));
  setText("inventory-wood", String(inventory.wood));
  setText("inventory-stone", String(inventory.stone));
}

export function updateSignalReadout(areaName: string, distanceFromCamp: number): void {
  setText("signal-time", "Time: Day");
  setText("signal-district", `District: ${areaName}`);
  setText("signal-distance", `Camp: ${Math.max(0, Math.round(distanceFromCamp))}m`);
}

export function updateStamina(stamina: number, maxStamina: number, sprinting: boolean): void {
  const safeMaximum = Math.max(1, maxStamina);
  const ratio = Math.max(0, Math.min(1, stamina / safeMaximum));
  const fill = document.getElementById("stamina-fill");
  if (fill) {
    fill.style.transform = `scaleX(${ratio})`;
    fill.classList.toggle("is-sprinting", sprinting);
  }
  setText("stamina-value", `${Math.round(stamina)} / ${Math.round(safeMaximum)}`);
}

export function updateFlashlight(enabled: boolean): void {
  const status = document.getElementById("flashlight-status");
  if (status) {
    status.textContent = enabled ? "ON" : "OFF";
    status.classList.toggle("is-on", enabled);
  }
}

export function updateMinimap(
  player: { x: number; y: number },
  markers: readonly MinimapMarker[],
): void {
  const canvas = document.getElementById("minimap") as HTMLCanvasElement | null;
  const context = canvas?.getContext("2d");
  if (!canvas || !context) {
    return;
  }
  const center = canvas.width / 2;
  const radius = center - 8;
  const scale = 0.13;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = "#17221b";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(143, 166, 132, 0.12)";
  context.lineWidth = 1;
  for (let offset = -48; offset <= 48; offset += 16) {
    context.beginPath();
    context.moveTo(center + offset, 0);
    context.lineTo(center + offset, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, center + offset);
    context.lineTo(canvas.width, center + offset);
    context.stroke();
  }
  const colors: Record<MinimapMarker["kind"], string> = {
    player: "#e3cb70",
    ally: "#8fc6d9",
    zombie: "#bd655c",
    building: "#8b7656",
    structure: "#b28b58",
    resource: "#78a95e",
  };
  markers.forEach((marker) => {
    const x = center + (marker.x - player.x) * scale;
    const y = center + (marker.y - player.y) * scale;
    if (Math.hypot(x - center, y - center) > radius - 3) {
      return;
    }
    context.fillStyle = colors[marker.kind];
    const size = marker.kind === "player" ? 5 : 4;
    context.fillRect(x - size / 2, y - size / 2, size, size);
  });
  context.restore();
  context.strokeStyle = "rgba(199, 218, 184, 0.28)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();
}

function initializeResourceIcons(): void {
  if (resourceIconsReady) {
    return;
  }
  resourceIconsReady = true;
  (Object.keys(SPRITE_ASSETS.items) as Array<keyof typeof SPRITE_ASSETS.items>).forEach((itemId) => {
    const image = document.getElementById(`resource-${itemId}-icon`) as HTMLImageElement | null;
    if (image) {
      image.src = SPRITE_ASSETS.items[itemId];
    }
  });
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
