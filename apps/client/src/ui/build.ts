import type { BuildEvent } from "@last-survivor/shared";
import { SPRITE_ASSETS } from "../assets/spriteCatalog";

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) {
    throw new Error(`Missing build UI element #${id}`);
  }
  return result as T;
}

export function updateBuildToolbar(
  active: boolean,
  orientation: "horizontal" | "vertical",
  valid: boolean,
): void {
  const toolbar = element<HTMLElement>("build-toolbar");
  toolbar.hidden = !active;
  toolbar.dataset.valid = String(valid);
  element<HTMLElement>("app").classList.toggle("is-building", active);
  element<HTMLElement>("build-orientation").textContent = orientation.toUpperCase();
  const image = element<HTMLImageElement>("build-icon");
  image.src = orientation === "horizontal"
    ? SPRITE_ASSETS.structures.woodWallHorizontal
    : SPRITE_ASSETS.structures.woodWallVertical;
}

export function showBuildEvent(event: BuildEvent): void {
  const status = element<HTMLElement>("build-status");
  status.textContent = event.message;
  status.dataset.kind = event.kind;
}

export function clearBuildEvent(): void {
  const status = element<HTMLElement>("build-status");
  status.textContent = "";
  delete status.dataset.kind;
}
