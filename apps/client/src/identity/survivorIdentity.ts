const SURVIVOR_ID_KEY = "last-survivor:v2:survivor-id";

function generateSurvivorId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `survivor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateSurvivorId(): string {
  const existing = localStorage.getItem(SURVIVOR_ID_KEY);
  if (existing) {
    return existing;
  }

  const survivorId = generateSurvivorId();
  localStorage.setItem(SURVIVOR_ID_KEY, survivorId);
  return survivorId;
}
