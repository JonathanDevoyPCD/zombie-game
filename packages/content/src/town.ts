import type { WorldPoint, WorldRect } from "./world";

export const STARTING_TOWN_NAME = "Hearthwick";
export const STARTING_TOWN_RADIUS = 1_450;

export type TownPropSpriteId =
  | "barrel"
  | "bench"
  | "fence-horizontal"
  | "fence-vertical"
  | "firepit"
  | "hay-bale"
  | "lamp-post"
  | "lantern"
  | "market-stall"
  | "signpost"
  | "stone-wall-horizontal"
  | "stone-wall-vertical"
  | "trough"
  | "wagon"
  | "well";

export interface TownRoadDefinition {
  id: string;
  width: number;
  points: readonly WorldPoint[];
}

export interface TownPlazaDefinition extends WorldPoint {
  radius: number;
}

export interface TownPropDefinition {
  id: string;
  name: string;
  spriteId: TownPropSpriteId;
  position: WorldPoint;
  displayWidth: number;
  originY: number;
  collider?: WorldRect;
  interaction?: {
    kind: "draw-water";
    radius: number;
    amount: number;
  };
}

interface TownPropTemplate {
  displayWidth: number;
  originY: number;
  collider?: WorldRect;
}

const PROP_TEMPLATES: Readonly<Record<TownPropSpriteId, TownPropTemplate>> = {
  barrel: {
    displayWidth: 54,
    originY: 0.82,
    collider: { x: -18, y: -13, width: 36, height: 24 },
  },
  bench: {
    displayWidth: 90,
    originY: 0.82,
    collider: { x: -39, y: -10, width: 78, height: 20 },
  },
  "fence-horizontal": {
    displayWidth: 110,
    originY: 0.78,
    collider: { x: -52, y: -8, width: 104, height: 14 },
  },
  "fence-vertical": {
    displayWidth: 28,
    originY: 0.9,
    collider: { x: -11, y: -43, width: 22, height: 86 },
  },
  firepit: {
    displayWidth: 74,
    originY: 0.75,
    collider: { x: -28, y: -12, width: 56, height: 26 },
  },
  "hay-bale": {
    displayWidth: 62,
    originY: 0.82,
    collider: { x: -26, y: -11, width: 52, height: 22 },
  },
  "lamp-post": {
    displayWidth: 46,
    originY: 0.92,
    collider: { x: -10, y: -9, width: 20, height: 18 },
  },
  lantern: {
    displayWidth: 34,
    originY: 0.84,
    collider: { x: -10, y: -8, width: 20, height: 16 },
  },
  "market-stall": {
    displayWidth: 150,
    originY: 0.88,
    collider: { x: -64, y: -24, width: 128, height: 44 },
  },
  signpost: {
    displayWidth: 52,
    originY: 0.9,
    collider: { x: -9, y: -8, width: 18, height: 16 },
  },
  "stone-wall-horizontal": {
    displayWidth: 120,
    originY: 0.82,
    collider: { x: -58, y: -10, width: 116, height: 18 },
  },
  "stone-wall-vertical": {
    displayWidth: 34,
    originY: 0.9,
    collider: { x: -13, y: -52, width: 26, height: 104 },
  },
  trough: {
    displayWidth: 100,
    originY: 0.84,
    collider: { x: -43, y: -13, width: 86, height: 26 },
  },
  wagon: {
    displayWidth: 145,
    originY: 0.8,
    collider: { x: -58, y: -18, width: 116, height: 34 },
  },
  well: {
    displayWidth: 90,
    originY: 0.86,
    collider: { x: -33, y: -14, width: 66, height: 28 },
  },
};

function translateRect(rect: WorldRect, position: WorldPoint): WorldRect {
  return {
    x: rect.x + position.x,
    y: rect.y + position.y,
    width: rect.width,
    height: rect.height,
  };
}

function townProp(
  id: string,
  name: string,
  spriteId: TownPropSpriteId,
  x: number,
  y: number,
  interaction?: TownPropDefinition["interaction"],
): TownPropDefinition {
  const template = PROP_TEMPLATES[spriteId];
  const position = { x, y };
  return {
    id: `town:hearthwick:prop:${id}`,
    name,
    spriteId,
    position,
    displayWidth: template.displayWidth,
    originY: template.originY,
    ...(template.collider ? { collider: translateRect(template.collider, position) } : {}),
    ...(interaction ? { interaction } : {}),
  };
}

export const STARTING_TOWN_ROADS: readonly TownRoadDefinition[] = [
  { id: "king-road-east-west", width: 150, points: [{ x: -2_600, y: 0 }, { x: 2_600, y: 0 }] },
  { id: "king-road-north-south", width: 150, points: [{ x: 0, y: -2_600 }, { x: 0, y: 2_600 }] },
  { id: "north-frontage", width: 62, points: [{ x: -1_080, y: -120 }, { x: 1_080, y: -120 }] },
  { id: "south-frontage", width: 68, points: [{ x: -1_080, y: 560 }, { x: 1_080, y: 560 }] },
  { id: "west-lane", width: 66, points: [{ x: -500, y: -1_180 }, { x: -500, y: 1_280 }] },
  { id: "east-lane", width: 66, points: [{ x: 500, y: -1_180 }, { x: 500, y: 1_280 }] },
  {
    id: "outer-town-path",
    width: 72,
    points: [
      { x: -1_100, y: -1_100 },
      { x: 1_100, y: -1_100 },
      { x: 1_100, y: 1_250 },
      { x: -1_100, y: 1_250 },
      { x: -1_100, y: -1_100 },
    ],
  },
  { id: "northwest-alley", width: 44, points: [{ x: -700, y: -825 }, { x: -500, y: -825 }] },
  { id: "northeast-alley", width: 44, points: [{ x: 500, y: -825 }, { x: 700, y: -825 }] },
  { id: "west-workshop-alley", width: 44, points: [{ x: -700, y: -495 }, { x: -500, y: -495 }] },
  { id: "east-workshop-alley", width: 44, points: [{ x: 500, y: -495 }, { x: 700, y: -495 }] },
  { id: "southwest-alley", width: 44, points: [{ x: -700, y: 875 }, { x: -500, y: 875 }] },
  { id: "southeast-alley", width: 44, points: [{ x: 500, y: 875 }, { x: 700, y: 875 }] },
  { id: "far-southwest-alley", width: 44, points: [{ x: -700, y: 1_175 }, { x: -500, y: 1_175 }] },
  { id: "far-southeast-alley", width: 44, points: [{ x: 500, y: 1_175 }, { x: 700, y: 1_175 }] },
] as const;

export const STARTING_TOWN_PLAZAS: readonly TownPlazaDefinition[] = [
  { x: 0, y: 150, radius: 225 },
  { x: -900, y: 300, radius: 105 },
  { x: 900, y: 300, radius: 105 },
] as const;

const lampLocations: readonly WorldPoint[] = [
  { x: -1_100, y: -98 }, { x: -800, y: 98 }, { x: -500, y: -98 }, { x: -250, y: 98 },
  { x: 250, y: -98 }, { x: 500, y: 98 }, { x: 800, y: -98 }, { x: 1_100, y: 98 },
  { x: -98, y: -1_150 }, { x: 98, y: -850 }, { x: -98, y: -580 }, { x: 98, y: -310 },
  { x: -65, y: 500 }, { x: 98, y: 680 }, { x: -98, y: 960 }, { x: 98, y: 1_260 },
];

const farmFenceProps: readonly TownPropDefinition[] = [
  townProp("fence-nw-south-1", "Farm fence", "fence-horizontal", -1_230, -435),
  townProp("fence-nw-south-2", "Farm fence", "fence-horizontal", -1_115, -435),
  townProp("fence-nw-west-1", "Farm fence", "fence-vertical", -1_360, -550),
  townProp("fence-nw-west-2", "Farm fence", "fence-vertical", -1_360, -645),
  townProp("fence-ne-south-1", "Farm fence", "fence-horizontal", 1_115, -435),
  townProp("fence-ne-south-2", "Farm fence", "fence-horizontal", 1_230, -435),
  townProp("fence-ne-east-1", "Farm fence", "fence-vertical", 1_360, -550),
  townProp("fence-ne-east-2", "Farm fence", "fence-vertical", 1_360, -645),
  townProp("fence-sw-south-1", "Farm fence", "fence-horizontal", -1_230, 1_330),
  townProp("fence-sw-south-2", "Farm fence", "fence-horizontal", -1_115, 1_330),
  townProp("fence-sw-west-1", "Farm fence", "fence-vertical", -1_360, 1_115),
  townProp("fence-sw-west-2", "Farm fence", "fence-vertical", -1_360, 1_210),
  townProp("fence-se-south-1", "Farm fence", "fence-horizontal", 1_115, 1_330),
  townProp("fence-se-south-2", "Farm fence", "fence-horizontal", 1_230, 1_330),
  townProp("fence-se-east-1", "Farm fence", "fence-vertical", 1_360, 1_115),
  townProp("fence-se-east-2", "Farm fence", "fence-vertical", 1_360, 1_210),
];

export const STARTING_TOWN_PROPS: readonly TownPropDefinition[] = [
  townProp("well-market", "Market well", "well", -285, 205, { kind: "draw-water", radius: 66, amount: 2 }),
  townProp("well-west", "West ward well", "well", -900, 220, { kind: "draw-water", radius: 66, amount: 2 }),
  townProp("well-east", "East ward well", "well", 900, 220, { kind: "draw-water", radius: 66, amount: 2 }),
  townProp("wagon-west-gate", "Merchant wagon", "wagon", -1_180, 125),
  townProp("wagon-east-gate", "Merchant wagon", "wagon", 1_180, -125),
  townProp("wagon-south", "Farm wagon", "wagon", 420, 700),
  townProp("wagon-north", "Empty wagon", "wagon", -420, -590),
  townProp("market-stall-west", "Market stall", "market-stall", -165, 300),
  townProp("market-stall-east", "Market stall", "market-stall", 165, 300),
  townProp("market-stall-southwest", "Market stall", "market-stall", -165, 415),
  townProp("market-stall-southeast", "Market stall", "market-stall", 165, 415),
  townProp("market-firepit", "Town firepit", "firepit", 0, 235),
  townProp("market-bench-west", "Market bench", "bench", -130, 125),
  townProp("market-bench-east", "Market bench", "bench", 130, 125),
  townProp("market-barrel-west", "Supply barrel", "barrel", -265, 545),
  townProp("market-barrel-east", "Supply barrel", "barrel", 265, 545),
  townProp("west-barrel", "Rain barrel", "barrel", -975, 600),
  townProp("east-barrel", "Rain barrel", "barrel", 975, 600),
  townProp("north-sign", "North road sign", "signpost", 110, -1_360),
  townProp("south-sign", "South road sign", "signpost", -110, 1_390),
  townProp("west-sign", "West road sign", "signpost", -1_390, -110),
  townProp("east-sign", "East road sign", "signpost", 1_390, 110),
  townProp("west-gate-wall-north", "West gate wall", "stone-wall-vertical", -1_420, -205),
  townProp("west-gate-wall-south", "West gate wall", "stone-wall-vertical", -1_420, 205),
  townProp("east-gate-wall-north", "East gate wall", "stone-wall-vertical", 1_420, -205),
  townProp("east-gate-wall-south", "East gate wall", "stone-wall-vertical", 1_420, 205),
  townProp("north-gate-wall-west", "North gate wall", "stone-wall-horizontal", -205, -1_420),
  townProp("north-gate-wall-east", "North gate wall", "stone-wall-horizontal", 205, -1_420),
  townProp("south-gate-wall-west", "South gate wall", "stone-wall-horizontal", -205, 1_420),
  townProp("south-gate-wall-east", "South gate wall", "stone-wall-horizontal", 205, 1_420),
  townProp("northwest-hay", "Hay bale", "hay-bale", -1_285, -520),
  townProp("northeast-hay", "Hay bale", "hay-bale", 1_285, -520),
  townProp("southwest-hay", "Hay bale", "hay-bale", -1_285, 1_240),
  townProp("southeast-hay", "Hay bale", "hay-bale", 1_285, 1_240),
  townProp("northwest-trough", "Water trough", "trough", -1_190, -510),
  townProp("northeast-trough", "Water trough", "trough", 1_190, -510),
  townProp("southwest-trough", "Water trough", "trough", -1_190, 1_245),
  townProp("southeast-trough", "Water trough", "trough", 1_190, 1_245),
  townProp("market-lantern-west", "Market lantern", "lantern", -215, 250),
  townProp("market-lantern-east", "Market lantern", "lantern", 215, 250),
  townProp("alley-lantern-northwest", "Alley lantern", "lantern", -520, -520),
  townProp("alley-lantern-northeast", "Alley lantern", "lantern", 520, -520),
  townProp("alley-lantern-southwest", "Alley lantern", "lantern", -520, 890),
  townProp("alley-lantern-southeast", "Alley lantern", "lantern", 520, 890),
  ...lampLocations.map((position, index) => townProp(
    `lamp-${String(index + 1).padStart(2, "0")}`,
    "Road lantern",
    "lamp-post",
    position.x,
    position.y,
  )),
  ...farmFenceProps,
] as const;

export const STARTING_TOWN_PROP_COLLIDERS: readonly WorldRect[] = STARTING_TOWN_PROPS.flatMap(
  (prop) => prop.collider ? [prop.collider] : [],
);

export function townPropById(propId: string): TownPropDefinition | undefined {
  return STARTING_TOWN_PROPS.find((prop) => prop.id === propId);
}
