import type { MovementInput } from "@last-survivor/shared";

export interface Vector2 {
  x: number;
  y: number;
}

export interface Position extends Vector2 {}

export interface CollisionRect extends Position {
  width: number;
  height: number;
}

export interface CollisionEnvironment {
  bounds?: CollisionRect;
  colliders: readonly CollisionRect[];
}

export interface RayHitCircle extends Position {
  radius: number;
}

export const DEFAULT_MOVE_SPEED = 190;
export const SPRINT_MOVE_SPEED = 285;

export function calculateSearchProgress(
  now: number,
  startedAt: number,
  durationMs: number,
): number {
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || durationMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, (now - startedAt) / durationMs));
}

export function normalizeMovement(input: MovementInput): Vector2 {
  const x = Number(input.right) - Number(input.left);
  const y = Number(input.down) - Number(input.up);
  const magnitude = Math.hypot(x, y);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / magnitude, y: y / magnitude };
}

export function integrateMovement(
  position: Position,
  input: MovementInput,
  deltaSeconds: number,
  speed = DEFAULT_MOVE_SPEED,
): Position {
  const movement = normalizeMovement(input);
  const safeDelta = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(deltaSeconds, 0.1))
    : 0;

  return {
    x: position.x + movement.x * speed * safeDelta,
    y: position.y + movement.y * speed * safeDelta,
  };
}

function circleIntersectsRect(position: Position, radius: number, rect: CollisionRect): boolean {
  const closestX = Math.max(rect.x, Math.min(position.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(position.y, rect.y + rect.height));
  const deltaX = position.x - closestX;
  const deltaY = position.y - closestY;
  return deltaX * deltaX + deltaY * deltaY < radius * radius;
}

function clampToBounds(position: Position, radius: number, bounds?: CollisionRect): Position {
  if (!bounds) {
    return position;
  }

  return {
    x: Math.max(bounds.x + radius, Math.min(position.x, bounds.x + bounds.width - radius)),
    y: Math.max(bounds.y + radius, Math.min(position.y, bounds.y + bounds.height - radius)),
  };
}

function isBlocked(position: Position, radius: number, colliders: readonly CollisionRect[]): boolean {
  return colliders.some((collider) => circleIntersectsRect(position, radius, collider));
}

function resolveMovementWithCollisions(
  position: Position,
  intended: Position,
  radius: number,
  environment: CollisionEnvironment,
): Position {
  let resolved = clampToBounds({ x: intended.x, y: position.y }, radius, environment.bounds);

  if (isBlocked(resolved, radius, environment.colliders)) {
    resolved.x = position.x;
  }

  resolved = clampToBounds({ x: resolved.x, y: intended.y }, radius, environment.bounds);
  if (isBlocked(resolved, radius, environment.colliders)) {
    resolved.y = position.y;
  }

  return resolved;
}

export function integrateMovementWithCollisions(
  position: Position,
  input: MovementInput,
  deltaSeconds: number,
  radius: number,
  environment: CollisionEnvironment,
  speed = DEFAULT_MOVE_SPEED,
): Position {
  const intended = integrateMovement(position, input, deltaSeconds, speed);
  return resolveMovementWithCollisions(position, intended, radius, environment);
}

export function integrateVectorWithCollisions(
  position: Position,
  direction: Vector2,
  deltaSeconds: number,
  radius: number,
  environment: CollisionEnvironment,
  speed: number,
): Position {
  const magnitude = Math.hypot(direction.x, direction.y);
  const safeDelta = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(deltaSeconds, 0.1))
    : 0;
  const intended = magnitude > 0
    ? {
        x: position.x + (direction.x / magnitude) * speed * safeDelta,
        y: position.y + (direction.y / magnitude) * speed * safeDelta,
      }
    : { ...position };

  return resolveMovementWithCollisions(position, intended, radius, environment);
}

export function rayCircleHitDistance(
  origin: Position,
  angle: number,
  circle: RayHitCircle,
  maximumRange: number,
): number | null {
  if (!Number.isFinite(angle) || maximumRange <= 0 || circle.radius <= 0) {
    return null;
  }

  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const offsetX = circle.x - origin.x;
  const offsetY = circle.y - origin.y;
  const projection = offsetX * directionX + offsetY * directionY;
  if (projection < 0 || projection - circle.radius > maximumRange) {
    return null;
  }

  const perpendicularSquared = offsetX * offsetX + offsetY * offsetY - projection * projection;
  const radiusSquared = circle.radius * circle.radius;
  if (perpendicularSquared > radiusSquared) {
    return null;
  }

  const entryDistance = Math.max(0, projection - Math.sqrt(radiusSquared - perpendicularSquared));
  return entryDistance <= maximumRange ? entryDistance : null;
}

export function rayRectHitDistance(
  origin: Position,
  angle: number,
  rect: CollisionRect,
  maximumRange: number,
): number | null {
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  let near = 0;
  let far = maximumRange;

  for (const axis of [
    { origin: origin.x, direction: directionX, minimum: rect.x, maximum: rect.x + rect.width },
    { origin: origin.y, direction: directionY, minimum: rect.y, maximum: rect.y + rect.height },
  ]) {
    if (Math.abs(axis.direction) < 1e-9) {
      if (axis.origin < axis.minimum || axis.origin > axis.maximum) {
        return null;
      }
      continue;
    }

    const first = (axis.minimum - axis.origin) / axis.direction;
    const second = (axis.maximum - axis.origin) / axis.direction;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) {
      return null;
    }
  }

  return near >= 0 && near <= maximumRange ? near : null;
}

export function sanitizeMovementInput(value: unknown): MovementInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<MovementInput>;
  if (!Number.isSafeInteger(candidate.sequence) || Number(candidate.sequence) < 0) {
    return null;
  }

  return {
    sequence: Number(candidate.sequence),
    up: candidate.up === true,
    down: candidate.down === true,
    left: candidate.left === true,
    right: candidate.right === true,
    sprint: candidate.sprint === true,
  };
}
