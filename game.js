const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const lightingCanvas = document.createElement("canvas");
const lightingCtx = lightingCanvas.getContext("2d");
const fogCanvas = document.createElement("canvas");
const fogCtx = fogCanvas.getContext("2d");

ctx.imageSmoothingEnabled = false;

const ui = {
  healthBar: document.getElementById("healthBar"),
  healthText: document.getElementById("healthText"),
  staminaBar: document.getElementById("staminaBar"),
  staminaText: document.getElementById("staminaText"),
  armorBar: document.getElementById("armorBar"),
  armorText: document.getElementById("armorText"),
  weaponText: document.getElementById("weaponText"),
  ammoText: document.getElementById("ammoText"),
  scrapText: document.getElementById("scrapText"),
  runStatus: document.getElementById("runStatus"),
  upgradePanel: document.getElementById("upgradePanel"),
  upgradeList: document.getElementById("upgradeList"),
  panelToggle: document.getElementById("panelToggle"),
  levelText: document.getElementById("levelText"),
  distanceText: document.getElementById("distanceText"),
  questTitle: document.getElementById("questTitle"),
  questText: document.getElementById("questText"),
  baseUpgradeButton: document.getElementById("baseUpgradeButton"),
  toast: document.getElementById("toast"),
  adminMenu: document.getElementById("adminMenu"),
  adminTimeButtons: document.querySelectorAll("[data-time]"),
  mainMenu: document.getElementById("mainMenu"),
  pauseMenu: document.getElementById("pauseMenu"),
  newGameButton: document.getElementById("newGameButton"),
  loadGameButton: document.getElementById("loadGameButton"),
  resumeButton: document.getElementById("resumeButton"),
  saveGameButton: document.getElementById("saveGameButton"),
  pauseLoadButton: document.getElementById("pauseLoadButton"),
  settingsButton: document.getElementById("settingsButton"),
  settingsPanel: document.getElementById("settingsPanel"),
  settingsBackButton: document.getElementById("settingsBackButton"),
  musicVolumeSlider: document.getElementById("musicVolumeSlider"),
  sfxVolumeSlider: document.getElementById("sfxVolumeSlider"),
  muteMusicButton: document.getElementById("muteMusicButton"),
  muteSfxButton: document.getElementById("muteSfxButton"),
  craftingMenu: document.getElementById("craftingMenu"),
  craftingCloseButton: document.getElementById("craftingCloseButton"),
  craftAxeButton: document.getElementById("craftAxeButton"),
  craftPickaxeButton: document.getElementById("craftPickaxeButton"),
  pauseNewButton: document.getElementById("pauseNewButton"),
  quitGameButton: document.getElementById("quitGameButton"),
  characterButtons: document.querySelectorAll(".character-option"),
  deathScreen: document.getElementById("deathScreen"),
  restartButton: document.getElementById("restartButton")
};

const keys = new Set();
const mouse = {
  x: 0,
  y: 0,
  down: false,
  worldX: 0,
  worldY: 0
};

const camera = { x: 0, y: 0 };
const bullets = [];
const zombies = [];
const crates = [];
const structures = [];
const majorLandmarks = [];
const particles = [];
const drops = [];
const revealedFog = new Set();
const generatedStructureIds = new Set();
const harvestStates = new Map();

const FRAME_SIZE = 128;
const SUMMER_GROUND_TILE_SIZE = 192;
const DAY_LENGTH = 420;
const MUSIC_VERSION = "direct-1";
const SETTINGS_KEY = "dead-grid-settings-v1";
const FOG_CELL_SIZE = 160;
const FOG_REVEAL_RADIUS = 430;
const FOG_SAFE_RADIUS = 230;
const HARVEST_REGROW_STAGE = 180;
const music = {
  day: new Audio(`music/DayMusic.mp3?v=${MUSIC_VERSION}`),
  night: new Audio(`music/NightMusic.mp3?v=${MUSIC_VERSION}`),
  started: false
};
const settings = {
  musicVolume: 0.2,
  sfxVolume: 0.8,
  musicMuted: false,
  sfxMuted: false
};
const spriteSheets = {};
const terrainAssets = {
  ground: createTerrainAssetList(56, (index) => `sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Ground ${String(index).padStart(2, "0")}.png`),
  tent: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Tent.png"),
  campfire: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Campfire.png"),
  house: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - House.png"),
  windmill: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Windmill.png"),
  well: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Well.png"),
  chest: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Treasure Chest.png"),
  barrel: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Wooden Barrel.png"),
  watchtower: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Watchtower Short.png"),
  fenceHorizontal: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Wooden Fence Horizontal.png"),
  fenceVertical: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Wooden Fence Vertical.png"),
  treeLarge: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_prop - Tree Large.png"),
  treeMedium: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Tree Medium.png"),
  treeSmall: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Tree Small.png"),
  treeStumpShort: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Tree Stump Short.png"),
  treeStumpTall: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Tree Stump Tall.png"),
  rockSmall: createTerrainAssetList(1, () => "sprites/Tile-Vector-Terrain/Top-Down Simple Summer_Prop - Rock 01.png"),
  grass: createTerrainAssetList(20, (index) => `sprites/TerrainOptimized/Grass/Grass-${String(index).padStart(2, "0")}.png`),
  clouds: createTerrainAssetList(41, (index) => `sprites/Clouds/Asset ${index}.png`)
};
const playerSpriteSets = {
  male: {
    folder: "Raider_1",
    idle: "Idle.png",
    walk: "Walk.png",
    run: "Run.png",
    shoot: "Shot.png",
    reload: "Recharge.png",
    hurt: "Hurt.png",
    dead: "Dead.png"
  },
  female: {
    folder: "Raider_2",
    idle: "Idle.png",
    walk: "Walk.png",
    run: "Run.png",
    shoot: "Shot_2.png",
    reload: "Recharge.png",
    hurt: "Hurt.png",
    dead: "Dead.png"
  }
};

const zombieSpriteSets = {
  zombie1: { folder: "Zombie_1", idle: "Idle.png", walk: "Walk.png", attack: "Attack.png", hurt: "Hurt.png", dead: "Dead.png" },
  zombie2: { folder: "Zombie_2", idle: "Idle.png", walk: "Walk.png", attack: "Attack.png", hurt: "Hurt.png", dead: "Dead.png" },
  zombie3: { folder: "Zombie_3", idle: "Idle.png", walk: "Walk.png", attack: "Attack.png", hurt: "Hurt.png", dead: "Dead.png" },
  zombie4: { folder: "Zombie_4", idle: "Idle.png", walk: "Walk.png", attack: "Attack.png", hurt: "Hurt.png", dead: "Dead.png" }
};

const zombieSetKeys = Object.keys(zombieSpriteSets);

const weapons = [
  {
    id: "pistol",
    name: "Pistol",
    damage: 18,
    fireDelay: 0.27,
    bulletSpeed: 780,
    range: 560,
    spread: 0.03,
    pellets: 1,
    clip: 12,
    reload: 1.05,
    ammoUse: 1,
    unlock: () => true
  },
  {
    id: "shotgun",
    name: "Shotgun",
    damage: 13,
    fireDelay: 0.72,
    bulletSpeed: 680,
    range: 340,
    spread: 0.24,
    pellets: 6,
    clip: 6,
    reload: 1.35,
    ammoUse: 1,
    unlock: () => tech.weapon.level >= 1
  },
  {
    id: "rifle",
    name: "Rifle",
    damage: 28,
    fireDelay: 0.16,
    bulletSpeed: 940,
    range: 720,
    spread: 0.035,
    pellets: 1,
    clip: 24,
    reload: 1.55,
    ammoUse: 1,
    unlock: () => tech.weapon.level >= 2
  }
];

const tech = {
  health: {
    name: "Field Medicine",
    desc: "Increase maximum health and recover to full.",
    level: 0,
    max: 8,
    baseCost: 35
  },
  armor: {
    name: "Armor Plating",
    desc: "Reduce incoming bite damage.",
    level: 0,
    max: 8,
    baseCost: 45
  },
  stamina: {
    name: "Endurance Rig",
    desc: "Move longer before exhaustion slows you down.",
    level: 0,
    max: 8,
    baseCost: 40
  },
  ammo: {
    name: "Ammo Harness",
    desc: "Carry more ammunition between runs.",
    level: 0,
    max: 7,
    baseCost: 45
  },
  weapon: {
    name: "Weapons Bench",
    desc: "Unlock shotgun, then rifle.",
    level: 0,
    max: 2,
    baseCost: 95
  }
};

const player = {
  x: 0,
  y: 0,
  radius: 15,
  z: 0,
  vz: 0,
  jumpCooldown: 0,
  crouching: false,
  sprinting: false,
  hp: 100,
  maxHp: 100,
  armor: 0,
  maxArmor: 0,
  stamina: 100,
  maxStamina: 100,
  speed: 190,
  scrap: 0,
  wood: 0,
  stone: 0,
  parts: 0,
  tools: {
    axe: false,
    pickaxe: false
  },
  xp: 0,
  level: 1,
  weaponIndex: 0,
  ammo: 12,
  reserveAmmo: 42,
  ammoCap: 54,
  reloading: 0,
  lastShot: -99,
  alive: true,
  invulnerable: 0,
  character: "male",
  facing: 1,
  shotTimer: 0,
  flashlight: false
};

let selectedCharacter = "male";

const world = {
  time: DAY_LENGTH * 0.35,
  nextSpawn: 0,
  nextCrate: 0,
  nextDropId: 1,
  messageTimer: 0,
  lootPrompt: null,
  activeSearch: null,
  craftingOpen: false,
  questIndex: 0,
  baseLevel: 0,
  harvestClock: 0,
  started: performance.now(),
  state: "menu"
};

const SAVE_KEY = "dead-grid-save-v1";
const SAFE_ZONE_RADIUS = 86;
const safeZones = [
  { id: "base", name: "Base Camp", x: 0, y: 0, radius: SAFE_ZONE_RADIUS },
  { id: "ranger", name: "Ranger Cache", x: -720, y: -520, radius: 74 },
  { id: "bridge", name: "Bridge Camp", x: 180, y: 690, radius: 70 },
  { id: "checkpoint", name: "Old Checkpoint", x: 980, y: -330, radius: 78 }
];

const baseStages = [
  { name: "Tent Camp", radius: SAFE_ZONE_RADIUS, heal: 7, armor: 9, stamina: 34, cost: null },
  { name: "Fenced Camp", radius: 126, heal: 10, armor: 13, stamina: 42, cost: { wood: 80, scrap: 65 } },
  { name: "Fortified Camp", radius: 166, heal: 13, armor: 18, stamina: 52, cost: { wood: 155, scrap: 120, parts: 25 } },
  { name: "Survivor Outpost", radius: 214, heal: 17, armor: 24, stamina: 64, cost: { wood: 250, scrap: 210, parts: 65 } }
];

const structureTypes = {
  farm: { name: "Abandoned Farm", resource: "wood", minZone: 1, color: "#9f7b43" },
  cabin: { name: "Hunter Cabin", resource: "scrap", minZone: 1, color: "#79513a" },
  camp: { name: "Survivor Camp", resource: "wood", minZone: 2, color: "#6f8452" },
  depot: { name: "Supply Depot", resource: "parts", minZone: 2, color: "#646f73" },
  clinic: { name: "Field Clinic", resource: "parts", minZone: 3, color: "#87948c" },
  radio: { name: "Radio Tower", resource: "parts", minZone: 4, color: "#6b7385" }
};

const landmarkTypes = {
  clinic: { name: "Abandoned Clinic", color: "#dfe8dc", marker: "#e9f1e7" },
  radio: { name: "Radio Tower", color: "#b7c4bd", marker: "#87b6ff" },
  checkpoint: { name: "Police Checkpoint", color: "#6b7385", marker: "#6f9bd8" },
  convoy: { name: "Crashed Convoy", color: "#7b6860", marker: "#d8b75f" },
  farmhouse: { name: "Old Farmhouse", color: "#9f7b43", marker: "#aacd62" },
  bunker: { name: "Bunker Hatch", color: "#596461", marker: "#bcb7a4" }
};

const landmarkDefinitions = [
  {
    id: "st-marrow-clinic",
    type: "clinic",
    name: "St. Marrow Clinic",
    x: -1160,
    y: -860,
    radius: 185,
    revealRadius: 760,
    discoveryReward: { xp: 45, parts: 6, med: 40 },
    lootReward: { parts: 18, scrap: 85, med: 70 }
  },
  {
    id: "ridge-radio",
    type: "radio",
    name: "Ridge Radio Tower",
    x: 1420,
    y: -940,
    radius: 175,
    revealRadius: 1180,
    discoveryReward: { xp: 60, parts: 10, scrap: 45 },
    lootReward: { parts: 28, scrap: 70, ammo: 30 }
  },
  {
    id: "south-checkpoint",
    type: "checkpoint",
    name: "South Police Checkpoint",
    x: 1060,
    y: 850,
    radius: 180,
    revealRadius: 820,
    discoveryReward: { xp: 45, ammo: 24, scrap: 50 },
    lootReward: { ammo: 65, scrap: 95, parts: 12 }
  },
  {
    id: "broken-convoy",
    type: "convoy",
    name: "Broken Supply Convoy",
    x: -1480,
    y: 690,
    radius: 190,
    revealRadius: 840,
    discoveryReward: { xp: 50, scrap: 70, parts: 8 },
    lootReward: { scrap: 135, parts: 24, ammo: 36 }
  },
  {
    id: "green-acre-farm",
    type: "farmhouse",
    name: "Green Acre Farmhouse",
    x: -360,
    y: 1510,
    radius: 205,
    revealRadius: 780,
    discoveryReward: { xp: 42, wood: 95, med: 24 },
    lootReward: { wood: 190, scrap: 55, ammo: 24 }
  },
  {
    id: "sealed-bunker",
    type: "bunker",
    name: "Sealed Bunker Hatch",
    x: 1780,
    y: 1340,
    radius: 170,
    revealRadius: 700,
    discoveryReward: { xp: 75, parts: 18 },
    lootReward: { parts: 45, scrap: 120, ammo: 55 }
  }
];

const toolRecipes = {
  axe: { name: "Axe", cost: { wood: 35, scrap: 20 } },
  pickaxe: { name: "Pickaxe", cost: { wood: 45, scrap: 30, parts: 8 } }
};

const questDefinitions = [
  {
    title: "Secure the Camp",
    text: () => `Collect 80 wood and 65 scrap, then return to base. Wood ${player.wood}/80 - Scrap ${player.scrap}/65.`,
    done: () => isPlayerInSafeZone() && player.wood >= 80 && player.scrap >= 65
  },
  {
    title: "Raise the Fence",
    text: () => "Use the Base Upgrade button to turn the tent camp into a fenced camp.",
    done: () => world.baseLevel >= 1
  },
  {
    title: "Scout a Farm",
    text: () => "Find and enter an abandoned farm beyond the first fog line.",
    done: () => structures.some((structure) => structure.discovered && structure.type === "farm" && structure.zone >= 2)
  },
  {
    title: "Recover Radio Parts",
    text: () => `Loot depots, clinics, or towers until you have 25 parts, then return to base. Parts ${player.parts}/25.`,
    done: () => isPlayerInSafeZone() && player.parts >= 25
  },
  {
    title: "Fortify the Outpost",
    text: () => "Upgrade the base again to expand the safe zone and improve recovery.",
    done: () => world.baseLevel >= 2
  },
  {
    title: "Write Your Route",
    text: () => "Keep exploring. The map, camps, and loot you uncover are now your story.",
    done: () => false
  }
];

function resize() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * scale);
  canvas.height = Math.floor(window.innerHeight * scale);
  lightingCanvas.width = window.innerWidth;
  lightingCanvas.height = window.innerHeight;
  fogCanvas.width = window.innerWidth;
  fogCanvas.height = window.innerHeight;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function hash2(x, y, salt = 0) {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453) % 1;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, salt = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = hash2(x0, y0, salt);
  const b = hash2(x0 + 1, y0, salt);
  const c = hash2(x0, y0 + 1, salt);
  const d = hash2(x0 + 1, y0 + 1, salt);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function fbm(x, y, salt = 0, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let total = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(x * frequency, y * frequency, salt + i * 13) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

function dist(a, b, c, d) {
  return Math.hypot(a - c, b - d);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function validCharacter(character) {
  return character === "female" ? "female" : "male";
}

function spriteKey(folder, file) {
  return `${folder}/${file}`;
}

function createTerrainAssetList(count, pathForIndex) {
  return Array.from({ length: count }, (_, index) => ({
    image: new Image(),
    src: pathForIndex(index + 1),
    loaded: false
  }));
}

function loadSpriteSheets() {
  const loadSet = (set) => {
    Object.values(set).forEach((file) => {
      if (file === set.folder) return;
      const key = spriteKey(set.folder, file);
      if (spriteSheets[key]) return;
      const image = new Image();
      image.src = `sprites/${set.folder}/${file}`;
      spriteSheets[key] = { image, frames: 1, loaded: false };
      image.addEventListener("load", () => {
        spriteSheets[key].frames = Math.max(1, Math.floor(image.width / FRAME_SIZE));
        spriteSheets[key].loaded = true;
      });
    });
  };
  Object.values(playerSpriteSets).forEach(loadSet);
  Object.values(zombieSpriteSets).forEach(loadSet);
}

function loadTerrainAssets() {
  Object.values(terrainAssets).flat().forEach((asset) => {
    if (asset.loaded || asset.image.src) return;
    asset.image.addEventListener("load", () => {
      asset.loaded = true;
    });
    asset.image.src = asset.src;
  });
}

function getSpriteSheet(set, action) {
  const file = set[action] || set.idle;
  return spriteSheets[spriteKey(set.folder, file)];
}

function drawSpriteSheetFrame(sheet, frame, x, y, scale, facing, alpha = 1) {
  if (!sheet || !sheet.loaded) return false;
  const sx = (frame % sheet.frames) * FRAME_SIZE;
  const drawW = FRAME_SIZE * scale;
  const drawH = FRAME_SIZE * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  ctx.drawImage(sheet.image, sx, 0, FRAME_SIZE, FRAME_SIZE, -drawW / 2, -drawH + 25 * scale, drawW, drawH);
  ctx.restore();
  return true;
}

function currentZone() {
  return Math.max(1, Math.floor(Math.hypot(player.x, player.y) / 430) + 1);
}

function exploredRadius() {
  return Math.max(1200, Math.hypot(player.x, player.y) + 700);
}

function fogKey(cx, cy) {
  return `${cx},${cy}`;
}

function fogCellAt(x, y) {
  return {
    x: Math.floor(x / FOG_CELL_SIZE),
    y: Math.floor(y / FOG_CELL_SIZE)
  };
}

function isFogRevealedCell(cx, cy) {
  return revealedFog.has(fogKey(cx, cy));
}

function isFogRevealedAt(x, y) {
  const cell = fogCellAt(x, y);
  return isFogRevealedCell(cell.x, cell.y);
}

function isCurrentlyVisibleAt(x, y) {
  if (dist(x, y, player.x, player.y) <= FOG_REVEAL_RADIUS * 0.92) return true;
  return safeZones.some((zone) => dist(x, y, zone.x, zone.y) <= FOG_SAFE_RADIUS);
}

function revealFogCircle(x, y, radius) {
  const minX = Math.floor((x - radius) / FOG_CELL_SIZE);
  const maxX = Math.floor((x + radius) / FOG_CELL_SIZE);
  const minY = Math.floor((y - radius) / FOG_CELL_SIZE);
  const maxY = Math.floor((y + radius) / FOG_CELL_SIZE);
  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const cellX = cx * FOG_CELL_SIZE + FOG_CELL_SIZE / 2;
      const cellY = cy * FOG_CELL_SIZE + FOG_CELL_SIZE / 2;
      if (dist(cellX, cellY, x, y) <= radius + FOG_CELL_SIZE * 0.55) {
        revealedFog.add(fogKey(cx, cy));
      }
    }
  }
}

function updateFogOfWar() {
  revealFogCircle(player.x, player.y, FOG_REVEAL_RADIUS);
  const safeZone = getSafeZoneAt(player.x, player.y);
  if (safeZone) revealFogCircle(safeZone.x, safeZone.y, FOG_SAFE_RADIUS);
}

function fogCloudAsset(cx, cy, salt = 0) {
  const list = terrainAssets.clouds;
  return list[Math.floor(hash2(cx, cy, 900 + salt) * list.length) % list.length];
}

function fogColor(dayColor, nightColor, night, alpha) {
  const r = Math.round(lerp(dayColor[0], nightColor[0], night));
  const g = Math.round(lerp(dayColor[1], nightColor[1], night));
  const b = Math.round(lerp(dayColor[2], nightColor[2], night));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function cutFogHole(x, y, clearRadius, feather) {
  const radius = clearRadius + feather;
  const gradient = fogCtx.createRadialGradient(x, y, clearRadius, x, y, radius);
  gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  fogCtx.fillStyle = gradient;
  fogCtx.beginPath();
  fogCtx.arc(x, y, radius, 0, Math.PI * 2);
  fogCtx.fill();
}

function drawFogCloud(cx, cy, screenX, screenY, alpha, night, salt = 0) {
  const asset = fogCloudAsset(cx, cy, salt);
  if (!asset?.loaded) return;
  const scale = 1.7 + hash2(cx, cy, 920 + salt) * 0.7;
  const width = FOG_CELL_SIZE * scale;
  const height = width * (asset.image.height / asset.image.width);
  const drift = Math.sin(world.time * 0.02 + hash2(cx, cy, 930 + salt) * Math.PI * 2) * 8;
  const offsetX = (hash2(cx, cy, 940 + salt) - 0.5) * FOG_CELL_SIZE * 0.68 + drift;
  const offsetY = (hash2(cx, cy, 950 + salt) - 0.5) * FOG_CELL_SIZE * 0.58;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = alpha;
  ctx.filter = `brightness(${lerp(1, 0.38, night)}) saturate(${lerp(1, 0.72, night)})`;
  ctx.drawImage(
    asset.image,
    screenX + FOG_CELL_SIZE / 2 - width / 2 + offsetX,
    screenY + FOG_CELL_SIZE / 2 - height / 2 + offsetY,
    width,
    height
  );
  ctx.restore();
}

function fogEdgeStrength(cx, cy) {
  if (isFogRevealedCell(cx, cy)) return 0;
  let strength = 0;
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      if (x === 0 && y === 0) continue;
      const distance = Math.hypot(x, y);
      if (distance > 2.25 || !isFogRevealedCell(cx + x, cy + y)) continue;
      strength = Math.max(strength, distance <= 1.1 ? 1 : 0.56);
    }
  }
  return strength;
}

function dayProgress() {
  return (world.time % DAY_LENGTH) / DAY_LENGTH;
}

function daylightAmount() {
  const sun = Math.sin(dayProgress() * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
  return smoothstep(clamp(sun, 0, 1));
}

function nightAmount() {
  return 1 - daylightAmount();
}

function timeOfDayLabel() {
  const progress = dayProgress();
  if (progress < 0.18 || progress > 0.82) return "Night";
  if (progress < 0.3) return "Dawn";
  if (progress < 0.68) return "Day";
  return "Dusk";
}

function dayMusicAmount() {
  const progress = dayProgress();
  if (progress < 0.18 || progress > 0.82) return 0;
  if (progress < 0.3) return smoothstep((progress - 0.18) / 0.12);
  if (progress < 0.68) return 1;
  return 1 - smoothstep((progress - 0.68) / 0.14);
}

function configureMusic() {
  [music.day, music.night].forEach((track) => {
    track.loop = true;
    track.preload = "auto";
    track.volume = 0;
  });
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    settings.musicVolume = clamp(Number(data.musicVolume ?? settings.musicVolume), 0, 1);
    settings.sfxVolume = clamp(Number(data.sfxVolume ?? settings.sfxVolume), 0, 1);
    settings.musicMuted = Boolean(data.musicMuted);
    settings.sfxMuted = Boolean(data.sfxMuted);
  } catch {
    localStorage.removeItem(SETTINGS_KEY);
  }
  syncSettingsUi();
  updateMusicVolumes();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function syncSettingsUi() {
  ui.musicVolumeSlider.value = Math.round(settings.musicVolume * 100);
  ui.sfxVolumeSlider.value = Math.round(settings.sfxVolume * 100);
  ui.muteMusicButton.textContent = settings.musicMuted ? "Unmute Music" : "Mute Music";
  ui.muteSfxButton.textContent = settings.sfxMuted ? "Unmute SFX" : "Mute SFX";
}

function updateMusicVolumes() {
  const dayAmount = dayMusicAmount();
  const volume = settings.musicMuted ? 0 : settings.musicVolume;
  music.day.volume = volume * dayAmount;
  music.night.volume = volume * (1 - dayAmount);
}

function startMusic() {
  updateMusicVolumes();
  if (music.started) return;
  music.started = true;
  const plays = [music.day.play(), music.night.play()].filter(Boolean);
  Promise.allSettled(plays).then((results) => {
    if (results.length && results.every((result) => result.status === "rejected")) {
      music.started = false;
    }
  });
}

function stopMusic() {
  music.day.pause();
  music.night.pause();
  music.started = false;
}

function setTimePreset(preset) {
  const presets = {
    morning: 0.3,
    midday: 0.5,
    evening: 0.72,
    midnight: 0
  };
  const progress = presets[preset];
  if (progress === undefined) return;
  const day = Math.floor(world.time / DAY_LENGTH);
  world.time = day * DAY_LENGTH + DAY_LENGTH * progress;
  updateMusicVolumes();
  flash(`${preset[0].toUpperCase()}${preset.slice(1)}`);
  updateHud();
}

function getSafeZoneAt(x, y) {
  return safeZones.find((zone) => dist(x, y, zone.x, zone.y) <= zone.radius) || null;
}

function isInAnySafeZone(x, y, padding = 0) {
  return safeZones.some((zone) => dist(x, y, zone.x, zone.y) <= zone.radius + padding);
}

function isPlayerInSafeZone() {
  return Boolean(getSafeZoneAt(player.x, player.y));
}

function canStandAt(x, y) {
  return terrainAt(x, y) !== "water";
}

function techCost(item) {
  return Math.floor(item.baseCost * Math.pow(1.58, item.level));
}

function applyTechStats() {
  const hpRatio = player.hp / player.maxHp || 1;
  const staminaRatio = player.stamina / player.maxStamina || 1;
  player.maxHp = 100 + tech.health.level * 25;
  player.maxArmor = tech.armor.level * 12;
  player.maxStamina = 100 + tech.stamina.level * 22;
  player.ammoCap = 54 + tech.ammo.level * 18;
  player.hp = clamp(Math.round(player.maxHp * hpRatio), 1, player.maxHp);
  player.stamina = clamp(Math.round(player.maxStamina * staminaRatio), 0, player.maxStamina);
  player.armor = clamp(player.armor, 0, player.maxArmor);
  player.reserveAmmo = clamp(player.reserveAmmo, 0, player.ammoCap);
}

function applyBaseStats() {
  const stage = baseStages[world.baseLevel] || baseStages[0];
  safeZones[0].radius = stage.radius;
}

function resourceAmount(kind) {
  if (kind === "ammo") return player.reserveAmmo;
  return Number(player[kind]) || 0;
}

function addResource(kind, amount) {
  if (kind === "ammo") {
    player.reserveAmmo = clamp(player.reserveAmmo + amount, 0, player.ammoCap);
    return;
  }
  if (kind === "med") {
    player.hp = clamp(player.hp + amount, 0, player.maxHp);
    return;
  }
  if (["scrap", "wood", "stone", "parts"].includes(kind)) {
    player[kind] += amount;
  }
}

function canAfford(cost) {
  if (!cost) return false;
  return Object.entries(cost).every(([kind, amount]) => resourceAmount(kind) >= amount);
}

function spendResources(cost) {
  if (!canAfford(cost)) return false;
  Object.entries(cost).forEach(([kind, amount]) => {
    player[kind] -= amount;
  });
  return true;
}

function formatCost(cost) {
  if (!cost) return "";
  return Object.entries(cost).map(([kind, amount]) => `${amount} ${kind}`).join(", ");
}

function currentQuest() {
  return questDefinitions[Math.min(world.questIndex, questDefinitions.length - 1)];
}

function updateQuestProgress() {
  let advanced = false;
  while (world.questIndex < questDefinitions.length - 1 && currentQuest().done()) {
    world.questIndex += 1;
    advanced = true;
  }
  if (advanced) flash(`Objective: ${currentQuest().title}`);
}

function isNearWorkbench() {
  return world.baseLevel >= 1 && dist(player.x, player.y, safeZones[0].x + 74, safeZones[0].y + 34) < 70;
}

function updateCraftingButtons() {
  ui.craftAxeButton.disabled = player.tools.axe || !canAfford(toolRecipes.axe.cost);
  ui.craftPickaxeButton.disabled = player.tools.pickaxe || !canAfford(toolRecipes.pickaxe.cost);
  ui.craftAxeButton.querySelector("small").textContent = player.tools.axe ? "Owned" : `Harvest trees for wood - ${formatCost(toolRecipes.axe.cost)}`;
  ui.craftPickaxeButton.querySelector("small").textContent = player.tools.pickaxe ? "Owned" : `Harvest stone from rocks - ${formatCost(toolRecipes.pickaxe.cost)}`;
}

function openCraftingMenu() {
  if (!isNearWorkbench()) {
    flash(world.baseLevel >= 1 ? "Move closer to the workbench" : "Upgrade the base to build a workbench");
    return;
  }
  world.craftingOpen = true;
  ui.craftingMenu.hidden = false;
  updateCraftingButtons();
  mouse.down = false;
  keys.clear();
}

function closeCraftingMenu() {
  world.craftingOpen = false;
  ui.craftingMenu.hidden = true;
}

function craftTool(kind) {
  const recipe = toolRecipes[kind];
  if (!recipe || player.tools[kind]) return;
  if (!spendResources(recipe.cost)) {
    flash(`Need ${formatCost(recipe.cost)}`);
    return;
  }
  player.tools[kind] = true;
  flash(`Crafted ${recipe.name}`);
  updateCraftingButtons();
  rebuildUpgradePanel();
  saveProgress();
}

function resetLandmarks() {
  majorLandmarks.length = 0;
  landmarkDefinitions.forEach((landmark) => {
    majorLandmarks.push({
      ...landmark,
      discovered: false,
      looted: false
    });
  });
}

function landmarkRewardText(rewards) {
  return Object.entries(rewards)
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => {
      if (kind === "med") return "patched wounds";
      if (kind === "xp") return `${amount} XP`;
      return `${amount} ${kind}`;
    })
    .join(", ");
}

function applyLandmarkReward(rewards) {
  Object.entries(rewards).forEach(([kind, amount]) => {
    if (kind === "xp") {
      gainXp(amount);
    } else {
      addResource(kind, amount);
    }
  });
}

function discoverLandmark(landmark) {
  if (!landmark || landmark.discovered) return false;
  landmark.discovered = true;
  revealFogCircle(landmark.x, landmark.y, landmark.revealRadius);
  applyLandmarkReward(landmark.discoveryReward);
  addHitParticles(landmark.x, landmark.y, landmarkTypes[landmark.type].marker, 18);
  flash(`Discovered ${landmark.name}: ${landmarkRewardText(landmark.discoveryReward)}`);
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
  return true;
}

function lootLandmark(landmark) {
  if (!landmark || landmark.looted) return false;
  if (!landmark.discovered) discoverLandmark(landmark);
  landmark.looted = true;
  applyLandmarkReward(landmark.lootReward);
  addHitParticles(landmark.x, landmark.y, landmarkTypes[landmark.type].marker, 24);
  flash(`${landmark.name}: ${landmarkRewardText(landmark.lootReward)}`);
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
  return true;
}

function crateSearchDuration(crate) {
  return clamp(2.1 + crate.zone * 0.35, 2, 4.8);
}

function structureSearchDuration(structure) {
  const durations = { cabin: 3, camp: 4.2, farm: 5.2, depot: 6.4, clinic: 7.1, radio: 7.8 };
  return durations[structure.type] || 4;
}

function landmarkSearchDuration(landmark) {
  const durations = { checkpoint: 6.2, convoy: 7.4, farmhouse: 8, clinic: 8.6, radio: 9.4, bunker: 10 };
  return durations[landmark.type] || 7;
}

function completeCrateLoot(crate) {
  if (!crate || crate.looted) return;
  crate.looted = true;
  const scrap = Math.round(rand(18, 34) * crate.zone);
  const ammo = Math.round(rand(8, 18) + crate.zone * 4);
  const wood = Math.random() > 0.45 ? Math.round(rand(10, 24) * crate.zone) : 0;
  const stone = crate.zone >= 2 && Math.random() > 0.62 ? Math.round(rand(8, 18) * crate.zone) : 0;
  const parts = crate.zone >= 2 && Math.random() > 0.7 ? Math.round(rand(3, 8) * crate.zone) : 0;
  const med = Math.random() > 0.64;
  player.scrap += scrap;
  player.wood += wood;
  player.stone += stone;
  player.parts += parts;
  player.reserveAmmo = clamp(player.reserveAmmo + ammo, 0, player.ammoCap);
  if (med) player.hp = clamp(player.hp + 28, 0, player.maxHp);
  addHitParticles(crate.x, crate.y, "#d8b75f", 10);
  flash(`Looted ${scrap} scrap, ${ammo} ammo${wood ? `, ${wood} wood` : ""}${stone ? `, ${stone} stone` : ""}${parts ? `, ${parts} parts` : ""}${med ? ", patched wounds" : ""}`);
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
}

function harvestNodeKey(kind, tileX, tileY) {
  return `${kind}:${tileX},${tileY}`;
}

function harvestStateStage(state) {
  if (!state) return "ready";
  const elapsed = world.harvestClock - state.started;
  if (elapsed >= HARVEST_REGROW_STAGE * 2) {
    harvestStates.delete(state.key);
    return "ready";
  }
  return elapsed >= HARVEST_REGROW_STAGE ? "middle" : "early";
}

function harvestNodeReady(node) {
  return harvestStateStage(harvestStates.get(node.key)) === "ready";
}

function saveHarvestStates() {
  return Array.from(harvestStates.values())
    .filter((state) => world.harvestClock - state.started < HARVEST_REGROW_STAGE * 2)
    .map((state) => ({
      key: state.key,
      kind: state.kind,
      started: state.started,
      variant: state.variant
    }));
}

function restoreHarvestStates(items) {
  harvestStates.clear();
  (Array.isArray(items) ? items : []).forEach((state) => {
    if (typeof state === "string") {
      harvestStates.set(state, {
        key: state,
        kind: state.startsWith("stone:") ? "stone" : "tree",
        started: world.harvestClock,
        variant: 0
      });
      return;
    }
    if (!state?.key || typeof state.key !== "string") return;
    harvestStates.set(state.key, {
      key: state.key,
      kind: state.kind === "stone" ? "stone" : "tree",
      started: Number(state.started) || world.harvestClock,
      variant: Number(state.variant) || 0
    });
  });
}

function treeAssetForNode(node) {
  const variants = ["treeLarge", "treeMedium", "treeSmall"];
  return variants[Math.floor(hash2(node.x, node.y, 941) * variants.length) % variants.length];
}

function rockAssetForNode(node) {
  return terrainAssets.rockSmall[0];
}

function drawHarvestNode(node, fallbackScreen = null, fallbackSeed = 0) {
  const state = harvestStates.get(node.key);
  const stage = harvestStateStage(state);
  const flip = hash2(node.x, node.y, 943) > 0.5;
  if (node.kind === "wood") {
    if (stage === "early") return drawPropImage("treeStumpShort", node.x, node.y + 22, 44, 0.98, flip);
    if (stage === "middle") return drawPropImage("treeStumpTall", node.x, node.y + 20, 48, 0.98, flip);
    const width = node.treeAsset === "treeLarge" ? 142 : node.treeAsset === "treeMedium" ? 116 : 88;
    return drawPropImage(node.treeAsset || treeAssetForNode(node), node.x, node.y + 28, width, 0.98, flip);
  }

  if (stage === "early") return drawPropImage("rockSmall", node.x, node.y + 18, 28, 0.54, flip);
  if (stage === "middle") return drawPropImage("rockSmall", node.x, node.y + 18, 36, 0.76, flip);
  const asset = rockAssetForNode(node);
  if (asset?.loaded) return drawLoadedAsset(asset, node.x, node.y + 18, 46, 0.98, flip);
  return false;
}

function harvestNodeFromCell(tileX, tileY) {
  const tile = 128;
  const centerX = tileX + tile / 2;
  const centerY = tileY + tile / 2;
  const terrain = terrainAt(centerX, centerY);
  const h = hash2(tileX, tileY, 8);
  if (isInAnySafeZone(centerX, centerY, 150) || isSummerDirtWorld(centerX, centerY) || terrain === "water" || terrain === "bridge" || terrain === "path") return null;

  const x = centerX + (hash2(tileX, tileY, 9) - 0.5) * 54;
  const y = centerY + (hash2(tileX, tileY, 10) - 0.5) * 54;
  const zone = Math.max(1, Math.floor(Math.hypot(x, y) / 430) + 1);
  if (terrain === "forest" && h > 0.34) {
    return {
      key: harvestNodeKey("tree", tileX, tileY),
      kind: "wood",
      name: "Tree",
      tool: "axe",
      treeAsset: treeAssetForNode({ x, y }),
      x,
      y,
      duration: 3.2,
      amount: Math.round(18 + zone * 7 + h * 14)
    };
  }
  if ((terrain === "dry" && h > 0.74) || (terrain === "forest" && h > 0.9)) {
    return {
      key: harvestNodeKey("stone", tileX, tileY),
      kind: "stone",
      name: "Stone",
      tool: "pickaxe",
      x,
      y,
      duration: 4.4,
      amount: Math.round(12 + zone * 5 + h * 12)
    };
  }
  return null;
}

function nearestHarvestTarget() {
  let best = null;
  const tile = 128;
  const baseX = Math.floor(player.x / tile) * tile;
  const baseY = Math.floor(player.y / tile) * tile;
  for (let y = baseY - tile * 2; y <= baseY + tile * 2; y += tile) {
    for (let x = baseX - tile * 2; x <= baseX + tile * 2; x += tile) {
      const node = harvestNodeFromCell(x, y);
      if (!node || !harvestNodeReady(node)) continue;
      const d = dist(player.x, player.y, node.x, node.y);
      if (d > 70 || (best && d >= best.distance)) continue;
      best = { ...node, distance: d };
    }
  }
  return best;
}

function beginSearch(search) {
  if (world.activeSearch || world.state !== "playing") return;
  world.activeSearch = {
    ...search,
    elapsed: 0
  };
  mouse.down = false;
}

function cancelSearch(message = "") {
  if (!world.activeSearch) return;
  world.activeSearch = null;
  if (message) flash(message);
}

function completeActiveSearch() {
  const search = world.activeSearch;
  world.activeSearch = null;
  if (!search) return;
  if (search.kind === "crate") completeCrateLoot(search.target);
  else if (search.kind === "structure") lootStructure(search.target);
  else if (search.kind === "landmark") lootLandmark(search.target);
  else if (search.kind === "harvest") {
    if (!harvestNodeReady(search.target)) return;
    harvestStates.set(search.target.key, {
      key: search.target.key,
      kind: search.target.kind === "stone" ? "stone" : "tree",
      started: world.harvestClock,
      variant: Math.floor(hash2(search.target.x, search.target.y, world.harvestClock) * 3)
    });
    addResource(search.target.kind, search.target.amount);
    addHitParticles(search.target.x, search.target.y, search.target.kind === "wood" ? "#8b5a32" : "#aeb8a6", 12);
    flash(`Harvested ${search.target.amount} ${search.target.kind}`);
    rebuildUpgradePanel();
    updateQuestProgress();
    saveProgress();
  }
}

function updateActiveSearch(dt) {
  const search = world.activeSearch;
  if (!search || !player.alive || world.state !== "playing") return;
  const target = search.target;
  if (dist(player.x, player.y, search.x, search.y) > search.range) {
    cancelSearch("Search interrupted");
    return;
  }
  if ((search.kind === "crate" || search.kind === "structure" || search.kind === "landmark") && target.looted) {
    cancelSearch();
    return;
  }
  if (search.kind === "harvest" && !harvestNodeReady(target)) {
    cancelSearch();
    return;
  }
  search.elapsed += dt;
  if (search.elapsed >= search.duration) completeActiveSearch();
}

function rebuildUpgradePanel() {
  ui.upgradeList.innerHTML = "";
  updateBaseUpgradeButton();
  Object.entries(tech).forEach(([key, item]) => {
    const row = document.createElement("div");
    row.className = "upgrade-card";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    const desc = document.createElement("small");
    title.textContent = `${item.name} ${item.level}/${item.max}`;
    desc.textContent = item.desc;
    text.append(title);
    text.append(desc);

    const button = document.createElement("button");
    if (item.level >= item.max) {
      button.textContent = "Max";
      button.disabled = true;
    } else {
      const cost = techCost(item);
      button.textContent = `${cost}`;
      button.disabled = player.scrap < cost;
      button.addEventListener("click", () => buyUpgrade(key));
    }

    row.append(text);
    row.append(button);
    ui.upgradeList.append(row);
  });
}

function updateBaseUpgradeButton() {
  const nextStage = baseStages[world.baseLevel + 1];
  if (!nextStage) {
    ui.baseUpgradeButton.textContent = `${baseStages[world.baseLevel].name} - Max`;
    ui.baseUpgradeButton.disabled = true;
    return;
  }
  ui.baseUpgradeButton.textContent = `Upgrade Base: ${formatCost(nextStage.cost)}`;
  ui.baseUpgradeButton.disabled = !canAfford(nextStage.cost) || !isPlayerInSafeZone();
}

function upgradeBase() {
  const nextStage = baseStages[world.baseLevel + 1];
  if (!nextStage) {
    flash("Base fully upgraded");
    return;
  }
  if (!isPlayerInSafeZone()) {
    flash("Return to base to build");
    return;
  }
  if (!spendResources(nextStage.cost)) {
    flash(`Need ${formatCost(nextStage.cost)}`);
    return;
  }
  world.baseLevel += 1;
  applyBaseStats();
  updateFogOfWar();
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
  flash(`${nextStage.name} built`);
}

function buyUpgrade(key) {
  const item = tech[key];
  if (!item || item.level >= item.max) return;
  const cost = techCost(item);
  if (player.scrap < cost) {
    flash("Not enough scrap");
    return;
  }
  player.scrap -= cost;
  item.level += 1;
  if (key === "health") player.hp = 10000;
  if (key === "armor") player.armor = 10000;
  if (key === "stamina") player.stamina = 10000;
  if (key === "ammo") player.reserveAmmo = 10000;
  applyTechStats();
  if (key === "weapon") {
    player.weaponIndex = Math.min(item.level, weapons.length - 1);
    syncWeaponAmmo();
  }
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
  flash(`${item.name} upgraded`);
}

function syncWeaponAmmo() {
  const weapon = weapons[player.weaponIndex];
  player.ammo = clamp(player.ammo, 0, weapon.clip);
}

function flash(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(world.messageTimer);
  world.messageTimer = setTimeout(() => ui.toast.classList.remove("show"), 1500);
}

function worldToScreen(x, y) {
  return {
    x: x - camera.x + window.innerWidth / 2,
    y: y - camera.y + window.innerHeight / 2
  };
}

function screenToWorld(x, y) {
  return {
    x: x + camera.x - window.innerWidth / 2,
    y: y + camera.y - window.innerHeight / 2
  };
}

function riverCenter(x) {
  return 520 + Math.sin(x * 0.004) * 56 + Math.sin(x * 0.0017) * 34;
}

function isBridgeTile(x, y) {
  return Math.abs(x) < 88 && Math.abs(y - riverCenter(x)) < 96;
}

function terrainFieldAt(x, y) {
  const broad = fbm(x * 0.0009 + 20, y * 0.0009 - 14, 5, 4);
  const medium = fbm(x * 0.0022 - 31, y * 0.0022 + 18, 19, 3);
  const detail = fbm(x * 0.005, y * 0.005, 41, 2);
  const distanceLift = clamp(Math.hypot(x, y) / 4200, 0, 0.16);
  return clamp(broad * 0.56 + medium * 0.32 + detail * 0.12 + distanceLift, 0, 1);
}

function terrainMoistureAt(x, y) {
  const broad = fbm(x * 0.0011 - 11, y * 0.0011 + 7, 73, 4);
  const medium = fbm(x * 0.0031 + 6, y * 0.0031 - 19, 91, 3);
  const riverInfluence = clamp(1 - Math.abs(y - riverCenter(x)) / 620, 0, 1) * 0.16;
  return clamp(broad * 0.68 + medium * 0.24 + riverInfluence, 0, 1);
}

function baseTerrainAt(x, y) {
  if (Math.hypot(x, y) < 260) return "grass";
  const field = terrainFieldAt(x, y);
  const moisture = terrainMoistureAt(x, y);
  if (moisture > 0.68 && field < 0.76) return "forest";
  if (field > 0.68 && moisture < 0.66) return "dry";
  if (field > 0.78) return "dry";
  if (moisture > 0.76) return "forest";
  return "grass";
}

function terrainAt(x, y) {
  const river = Math.abs(y - riverCenter(x));
  if (river < 70 && !isBridgeTile(x, y)) return "water";
  if (isBridgeTile(x, y)) return "bridge";
  if (isInAnySafeZone(x, y, 74)) return "camp";
  return baseTerrainAt(x, y);
}

const roadTileMemo = new Map();
const clearingTileMemo = new Map();

function tileKey(tx, ty) {
  return `${tx},${ty}`;
}

function safeZoneTile(zone) {
  const size = SUMMER_GROUND_TILE_SIZE;
  return {
    tx: Math.round(zone.x / size),
    ty: Math.round(zone.y / size)
  };
}

function summerTileToWorld(tx, ty) {
  const size = SUMMER_GROUND_TILE_SIZE;
  return {
    x: tx * size - size / 2,
    y: ty * size - size / 2
  };
}

function primaryRoadCenterY(tx) {
  return Math.round(-1.55 + Math.sin(tx * 0.28) * 0.95 + Math.sin(tx * 0.09 + 1.7) * 1.15);
}

function northRoadCenterY(tx) {
  return Math.round(-9.5 + Math.sin(tx * 0.18 + 2.4) * 1.1);
}

function southRoadCenterY(tx) {
  return Math.round(8.5 + Math.sin(tx * 0.2 - 1.2) * 1.15);
}

function verticalBranchCenterX(ty, offset = 0) {
  return Math.round(offset + Math.sin(ty * 0.22) * 0.9 + Math.sin(ty * 0.08 + 1.1) * 0.7);
}

function isWideHorizontalRoad(tx, ty, centerY, halfWidth, minX = -Infinity, maxX = Infinity) {
  return tx >= minX && tx <= maxX && Math.abs(ty - centerY(tx)) <= halfWidth;
}

function isWideVerticalRoad(tx, ty, centerX, halfWidth, minY = -Infinity, maxY = Infinity) {
  return ty >= minY && ty <= maxY && Math.abs(tx - centerX(ty)) <= halfWidth;
}

function isRoadTile(tx, ty) {
  const key = tileKey(tx, ty);
  if (roadTileMemo.has(key)) return roadTileMemo.get(key);
  const value = false;
  roadTileMemo.set(key, value);
  return value;
}

function isClearingTile(tx, ty) {
  const key = tileKey(tx, ty);
  if (clearingTileMemo.has(key)) return clearingTileMemo.get(key);

  let value = safeZones.some((zone) => {
    const center = safeZoneTile(zone);
    return Math.hypot(tx - center.tx, ty - center.ty) <= 0.7;
  });

  clearingTileMemo.set(key, value);
  return value;
}

function isSummerDirtTile(tx, ty) {
  return isClearingTile(tx, ty);
}

function isSummerDirtWorld(x, y) {
  const size = SUMMER_GROUND_TILE_SIZE;
  return isSummerDirtTile(Math.floor((x + size / 2) / size), Math.floor((y + size / 2) / size));
}

function summerGroundTile(tx, ty) {
  if (!isSummerDirtTile(tx, ty)) {
    return { number: hash2(tx, ty, 211) > 0.52 ? 43 : 52, rotation: 0 };
  }
  return { number: 5, rotation: 0 };
}

function structureTypeForCell(gx, gy, zone) {
  const roll = hash2(gx, gy, 520);
  if (zone >= 4 && roll > 0.88) return "radio";
  if (zone >= 3 && roll > 0.7) return "clinic";
  if (zone >= 2 && roll > 0.52) return "depot";
  if (roll > 0.36) return "camp";
  if (roll > 0.16) return "farm";
  return "cabin";
}

function generateStructuresAroundPlayer() {
  const grid = 720;
  const radius = exploredRadius() + 980;
  const minGx = Math.floor((player.x - radius) / grid);
  const maxGx = Math.ceil((player.x + radius) / grid);
  const minGy = Math.floor((player.y - radius) / grid);
  const maxGy = Math.ceil((player.y + radius) / grid);

  for (let gy = minGy; gy <= maxGy; gy += 1) {
    for (let gx = minGx; gx <= maxGx; gx += 1) {
      const id = `${gx},${gy}`;
      if (generatedStructureIds.has(id)) continue;
      generatedStructureIds.add(id);
      if (hash2(gx, gy, 500) < 0.72) continue;

      const x = gx * grid + grid * (0.22 + hash2(gx, gy, 501) * 0.56);
      const y = gy * grid + grid * (0.22 + hash2(gx, gy, 502) * 0.56);
      const distanceFromBase = Math.hypot(x, y);
      const zone = Math.floor(distanceFromBase / 430) + 1;
      if (distanceFromBase < 520 || isInAnySafeZone(x, y, 240) || !canStandAt(x, y)) continue;

      structures.push({
        id,
        x,
        y,
        zone,
        type: structureTypeForCell(gx, gy, zone),
        discovered: false,
        looted: false,
        wobble: hash2(gx, gy, 503) * 10
      });
    }
  }
}

function structureRewards(structure) {
  const zoneBoost = Math.max(1, structure.zone);
  const table = {
    farm: { wood: Math.round(rand(34, 58) * zoneBoost), scrap: Math.round(rand(6, 14) * zoneBoost) },
    cabin: { wood: Math.round(rand(18, 34) * zoneBoost), scrap: Math.round(rand(18, 34) * zoneBoost), ammo: Math.round(rand(8, 20)) },
    camp: { wood: Math.round(rand(28, 46) * zoneBoost), scrap: Math.round(rand(18, 30) * zoneBoost), ammo: Math.round(rand(12, 28)) },
    depot: { scrap: Math.round(rand(28, 48) * zoneBoost), parts: Math.round(rand(8, 16) * zoneBoost), ammo: Math.round(rand(16, 34)) },
    clinic: { parts: Math.round(rand(10, 20) * zoneBoost), med: 42, scrap: Math.round(rand(14, 26) * zoneBoost) },
    radio: { parts: Math.round(rand(18, 32) * zoneBoost), scrap: Math.round(rand(24, 42) * zoneBoost) }
  };
  return table[structure.type] || table.cabin;
}

function describeRewards(rewards) {
  return Object.entries(rewards)
    .filter(([, amount]) => amount > 0)
    .map(([kind, amount]) => kind === "med" ? "patched wounds" : `${amount} ${kind}`)
    .join(", ");
}

function lootStructure(structure) {
  if (!structure || structure.looted) return false;
  structure.discovered = true;
  structure.looted = true;
  const rewards = structureRewards(structure);
  Object.entries(rewards).forEach(([kind, amount]) => addResource(kind, amount));
  addHitParticles(structure.x, structure.y, "#d8b75f", 14);
  flash(`${structureTypes[structure.type].name}: ${describeRewards(rewards)}`);
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
  return true;
}

function spawnCrate() {
  const maxR = Math.max(520, exploredRadius());
  const minR = Math.min(maxR - 60, 190);
  const angle = rand(0, Math.PI * 2);
  const radius = rand(minR, maxR);
  const zone = Math.floor(radius / 430) + 1;
  crates.push({
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    radius: 18,
    zone,
    looted: false,
    wobble: rand(0, 10)
  });
}

function spawnDrop(x, y, kind, amount) {
  drops.push({
    id: world.nextDropId++,
    x,
    y,
    kind,
    amount,
    radius: 10,
    ttl: 24
  });
}

function spawnZombie() {
  if (!player.alive) return;
  let x = 0;
  let y = 0;
  let zone = 1;
  let found = false;
  for (let tries = 0; tries < 44; tries += 1) {
    const angle = rand(0, Math.PI * 2);
    const maxRadius = Math.max(950, Math.hypot(player.x, player.y) + 900);
    const minRadius = Math.min(maxRadius - 80, 620);
    const radius = rand(minRadius, maxRadius);
    x = Math.cos(angle) * radius;
    y = Math.sin(angle) * radius;
    zone = Math.floor(Math.hypot(x, y) / 430) + 1;
    if (
      dist(x, y, player.x, player.y) > 520 &&
      !isInAnySafeZone(x, y, 280) &&
      canStandAt(x, y)
    ) {
      found = true;
      break;
    }
  }
  if (!found) return;

  const roll = Math.random();
  const type = zone >= 5 && roll > 0.62 ? "brute" : zone >= 3 && roll > 0.48 ? "runner" : "walker";
  const profile = {
    walker: { hp: 38, speed: 72, damage: 12, size: 15, color: "#5f8f45" },
    runner: { hp: 28, speed: 126, damage: 10, size: 13, color: "#7aa354" },
    brute: { hp: 95, speed: 58, damage: 22, size: 22, color: "#486f3b" }
  }[type];

  const scale = 0.9 + zone * 0.15 + world.time * 0.0015;
  zombies.push({
    x,
    y,
    type,
    spriteSet: zombieSetKeys[Math.floor(Math.random() * zombieSetKeys.length)],
    facing: Math.random() > 0.5 ? 1 : -1,
    radius: profile.size,
    hp: Math.round(profile.hp * scale),
    maxHp: Math.round(profile.hp * scale),
    speed: profile.speed * (1 + zone * 0.035),
    damage: Math.round(profile.damage * scale),
    color: profile.color,
    attackCooldown: 0,
    hitFlash: 0,
    aggro: false,
    alertTimer: 0,
    wanderAngle: rand(0, Math.PI * 2),
    wanderTimer: rand(0.8, 2.4),
    detectRange: type === "runner" ? 250 : type === "brute" ? 210 : 225
  });
}

function shoot() {
  const weapon = weapons[player.weaponIndex];
  if (!weapon.unlock() || player.reloading > 0 || !player.alive) return;
  if (world.time - player.lastShot < weapon.fireDelay) return;
  if (player.ammo < weapon.ammoUse) {
    reload();
    return;
  }

  player.lastShot = world.time;
  player.shotTimer = 0.22;
  player.ammo -= weapon.ammoUse;
  const angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  for (let i = 0; i < weapon.pellets; i += 1) {
    const offset = rand(-weapon.spread, weapon.spread);
    const a = angle + offset;
    bullets.push({
      x: player.x + Math.cos(a) * 22,
      y: player.y + Math.sin(a) * 22,
      vx: Math.cos(a) * weapon.bulletSpeed,
      vy: Math.sin(a) * weapon.bulletSpeed,
      life: weapon.range / weapon.bulletSpeed,
      damage: weapon.damage,
      radius: weapon.pellets > 1 ? 4 : 3
    });
  }
  addMuzzleFlash(angle);
}

function reload() {
  const weapon = weapons[player.weaponIndex];
  if (player.reloading > 0 || player.ammo >= weapon.clip || player.reserveAmmo <= 0) return;
  player.reloading = weapon.reload;
}

function completeReload() {
  const weapon = weapons[player.weaponIndex];
  const needed = weapon.clip - player.ammo;
  const moved = Math.min(needed, player.reserveAmmo);
  player.ammo += moved;
  player.reserveAmmo -= moved;
}

function addMuzzleFlash(angle) {
  particles.push({
    x: player.x + Math.cos(angle) * 24,
    y: player.y + Math.sin(angle) * 24,
    vx: Math.cos(angle) * 24,
    vy: Math.sin(angle) * 24,
    life: 0.08,
    maxLife: 0.08,
    size: 8,
    color: "#e7c35a"
  });
}

function addHitParticles(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    const s = rand(35, 120);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: rand(0.22, 0.42),
      maxLife: 0.42,
      size: rand(3, 7),
      color
    });
  }
}

function lootNearby() {
  if (world.activeSearch) return;
  if (isNearWorkbench()) {
    openCraftingMenu();
    return;
  }

  let found = null;
  for (const crate of crates) {
    if (!crate.looted && dist(player.x, player.y, crate.x, crate.y) < 54) {
      found = crate;
      break;
    }
  }
  if (found) {
    beginSearch({
      kind: "crate",
      label: "Searching crate",
      target: found,
      x: found.x,
      y: found.y,
      range: 72,
      duration: crateSearchDuration(found)
    });
    return;
  }

  for (const landmark of majorLandmarks) {
    if (!landmark.looted && dist(player.x, player.y, landmark.x, landmark.y) < 112) {
      beginSearch({
        kind: "landmark",
        label: `Searching ${landmark.name}`,
        target: landmark,
        x: landmark.x,
        y: landmark.y,
        range: 140,
        duration: landmarkSearchDuration(landmark)
      });
      return;
    }
  }

  for (const structure of structures) {
    if (!structure.looted && dist(player.x, player.y, structure.x, structure.y) < 78) {
      beginSearch({
        kind: "structure",
        label: `Searching ${structureTypes[structure.type].name}`,
        target: structure,
        x: structure.x,
        y: structure.y,
        range: 100,
        duration: structureSearchDuration(structure)
      });
      return;
    }
  }

  const harvest = nearestHarvestTarget();
  if (harvest) {
    if (!player.tools[harvest.tool]) {
      flash(`Craft a ${toolRecipes[harvest.tool].name} at the workbench first`);
      return;
    }
    beginSearch({
      kind: "harvest",
      label: `Harvesting ${harvest.name}`,
      target: harvest,
      x: harvest.x,
      y: harvest.y,
      range: 84,
      duration: harvest.duration
    });
    return;
  }

  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    if (dist(player.x, player.y, drop.x, drop.y) < 40) {
      collectDrop(i);
      return;
    }
  }
}

function collectDrop(index) {
  const drop = drops[index];
  addResource(drop.kind, drop.amount);
  drops.splice(index, 1);
  rebuildUpgradePanel();
  updateQuestProgress();
  saveProgress();
}

function gainXp(amount) {
  player.xp += amount;
  const needed = player.level * 60;
  if (player.xp >= needed) {
    player.xp -= needed;
    player.level += 1;
    player.scrap += 30 + player.level * 8;
    flash(`Level ${player.level}`);
    rebuildUpgradePanel();
    saveProgress();
  }
}

function saveProgress() {
  const data = {
    scrap: player.scrap,
    wood: player.wood,
    stone: player.stone,
    parts: player.parts,
    xp: player.xp,
    level: player.level,
    weaponIndex: player.weaponIndex,
    tools: { ...player.tools },
    player: {
      character: player.character,
      x: player.x,
      y: player.y,
      hp: player.hp,
      armor: player.armor,
      stamina: player.stamina,
      ammo: player.ammo,
      reserveAmmo: player.reserveAmmo,
      flashlight: player.flashlight
    },
    world: {
      time: world.time,
      nextSpawn: world.nextSpawn,
      nextCrate: world.nextCrate,
      nextDropId: world.nextDropId,
      questIndex: world.questIndex,
      baseLevel: world.baseLevel,
      harvestClock: world.harvestClock
    },
    fog: Array.from(revealedFog),
    harvested: saveHarvestStates(),
    tech: Object.fromEntries(Object.entries(tech).map(([key, item]) => [key, item.level])),
    zombies: zombies.slice(0, 70).map((zombie) => ({
      x: zombie.x,
      y: zombie.y,
      type: zombie.type,
      spriteSet: zombie.spriteSet,
      facing: zombie.facing,
      radius: zombie.radius,
      hp: zombie.hp,
      maxHp: zombie.maxHp,
      speed: zombie.speed,
      damage: zombie.damage,
      color: zombie.color,
      attackCooldown: zombie.attackCooldown,
      hitFlash: 0,
      aggro: zombie.aggro,
      alertTimer: zombie.alertTimer,
      wanderAngle: zombie.wanderAngle,
      wanderTimer: zombie.wanderTimer,
      detectRange: zombie.detectRange
    })),
    crates: crates.map((crate) => ({
      x: crate.x,
      y: crate.y,
      radius: crate.radius,
      zone: crate.zone,
      looted: crate.looted,
      wobble: crate.wobble
    })),
    structures: structures.map((structure) => ({
      id: structure.id,
      x: structure.x,
      y: structure.y,
      zone: structure.zone,
      type: structure.type,
      discovered: structure.discovered,
      looted: structure.looted,
      wobble: structure.wobble
    })),
    landmarks: majorLandmarks.map((landmark) => ({
      id: landmark.id,
      discovered: landmark.discovered,
      looted: landmark.looted
    })),
    drops: drops.map((drop) => ({
      id: drop.id,
      x: drop.x,
      y: drop.y,
      kind: drop.kind,
      amount: drop.amount,
      radius: drop.radius,
      ttl: drop.ttl
    }))
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  updateMenuButtons();
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    player.scrap = Number(data.scrap) || 0;
    player.wood = Number(data.wood) || 0;
    player.stone = Number(data.stone) || 0;
    player.parts = Number(data.parts) || 0;
    player.tools.axe = Boolean(data.tools?.axe);
    player.tools.pickaxe = Boolean(data.tools?.pickaxe);
    player.xp = Number(data.xp) || 0;
    player.level = Number(data.level) || 1;
    Object.entries(data.tech || {}).forEach(([key, level]) => {
      if (tech[key]) tech[key].level = clamp(Number(level) || 0, 0, tech[key].max);
    });
    applyTechStats();
    player.weaponIndex = clamp(Number(data.weaponIndex ?? tech.weapon.level) || 0, 0, tech.weapon.level);
    const savedPlayer = data.player || {};
    player.character = validCharacter(savedPlayer.character);
    selectedCharacter = player.character;
    updateCharacterSelection();
    player.x = Number(savedPlayer.x) || 0;
    player.y = Number(savedPlayer.y) || 0;
    player.hp = clamp(Number(savedPlayer.hp) || player.maxHp, 1, player.maxHp);
    player.armor = clamp(Number(savedPlayer.armor) || 0, 0, player.maxArmor);
    player.stamina = clamp(Number(savedPlayer.stamina) || player.maxStamina, 0, player.maxStamina);
    player.ammo = clamp(Number(savedPlayer.ammo) || weapons[player.weaponIndex].clip, 0, weapons[player.weaponIndex].clip);
    player.reserveAmmo = clamp(Number(savedPlayer.reserveAmmo) || player.ammoCap, 0, player.ammoCap);
    player.flashlight = Boolean(savedPlayer.flashlight);
    player.alive = true;
    player.reloading = 0;
    player.invulnerable = 0.8;
    player.shotTimer = 0;

    world.time = Number(data.world?.time) || 0;
    world.nextSpawn = Number(data.world?.nextSpawn) || 0;
    world.nextCrate = Number(data.world?.nextCrate) || 0;
    world.nextDropId = Number(data.world?.nextDropId) || 1;
    world.questIndex = clamp(Number(data.world?.questIndex) || 0, 0, questDefinitions.length - 1);
    world.baseLevel = clamp(Number(data.world?.baseLevel) || 0, 0, baseStages.length - 1);
    world.harvestClock = Number(data.world?.harvestClock ?? data.world?.time) || 0;
    world.activeSearch = null;
    closeCraftingMenu();
    applyBaseStats();
    revealedFog.clear();
    (Array.isArray(data.fog) ? data.fog : []).forEach((key) => {
      if (typeof key === "string") revealedFog.add(key);
    });
    restoreHarvestStates(data.harvested);
    updateFogOfWar();
    bullets.length = 0;
    particles.length = 0;
    zombies.length = 0;
    crates.length = 0;
    structures.length = 0;
    resetLandmarks();
    generatedStructureIds.clear();
    drops.length = 0;
    (data.zombies || []).forEach((zombie) => zombies.push({
      ...zombie,
      spriteSet: zombie.spriteSet || zombieSetKeys[0],
      facing: Number(zombie.facing) || 1,
      aggro: Boolean(zombie.aggro),
      alertTimer: Number(zombie.alertTimer) || 0,
      wanderAngle: Number(zombie.wanderAngle) || rand(0, Math.PI * 2),
      wanderTimer: Number(zombie.wanderTimer) || rand(1, 3),
      detectRange: Number(zombie.detectRange) || 225
    }));
    (data.crates || []).forEach((crate) => crates.push(crate));
    (data.structures || []).forEach((structure) => {
      if (!structure.id) return;
      generatedStructureIds.add(structure.id);
      structures.push({
        ...structure,
        type: structureTypes[structure.type] ? structure.type : "cabin",
        discovered: Boolean(structure.discovered),
        looted: Boolean(structure.looted)
      });
    });
    const landmarkStates = new Map((data.landmarks || []).map((landmark) => [landmark.id, landmark]));
    majorLandmarks.forEach((landmark) => {
      const state = landmarkStates.get(landmark.id);
      landmark.discovered = Boolean(state?.discovered);
      landmark.looted = Boolean(state?.looted);
      if (landmark.discovered) revealFogCircle(landmark.x, landmark.y, landmark.revealRadius);
    });
    (data.drops || []).forEach((drop) => drops.push({
      ...drop,
      id: Number(drop.id) || world.nextDropId++
    }));
    generateStructuresAroundPlayer();
    ensureWorldPopulated();
    rebuildUpgradePanel();
    updateHud();
    updateCamera(1);
    return true;
  } catch {
    localStorage.removeItem(SAVE_KEY);
    updateMenuButtons();
    return false;
  }
}

function hasSave() {
  return Boolean(localStorage.getItem(SAVE_KEY));
}

function clearProgress() {
  localStorage.removeItem(SAVE_KEY);
  Object.values(tech).forEach((item) => {
    item.level = 0;
  });
  player.scrap = 0;
  player.wood = 0;
  player.stone = 0;
  player.parts = 0;
  player.tools.axe = false;
  player.tools.pickaxe = false;
  player.xp = 0;
  player.level = 1;
  player.weaponIndex = 0;
  player.character = validCharacter(selectedCharacter);
  player.flashlight = false;
  revealedFog.clear();
  harvestStates.clear();
  structures.length = 0;
  resetLandmarks();
  generatedStructureIds.clear();
  world.questIndex = 0;
  world.baseLevel = 0;
  world.activeSearch = null;
  closeCraftingMenu();
  world.time = DAY_LENGTH * 0.35;
  world.nextSpawn = 0;
  world.nextCrate = 0;
  world.nextDropId = 1;
  world.harvestClock = 0;
  applyBaseStats();
  applyTechStats();
  restartRun(false);
  updateMenuButtons();
}

function ensureWorldPopulated() {
  generateStructuresAroundPlayer();
  while (crates.filter((crate) => !crate.looted).length < 8) spawnCrate();
  while (zombies.length < 7) spawnZombie();
}

function damagePlayer(amount) {
  if (player.invulnerable > 0 || !player.alive || isPlayerInSafeZone()) return;
  const reduction = player.armor > 0 ? 0.42 : 0;
  const hpDamage = Math.max(2, Math.round(amount * (1 - reduction)));
  const armorDamage = Math.min(player.armor, Math.ceil(amount * 0.55));
  player.armor -= armorDamage;
  player.hp -= hpDamage;
  player.invulnerable = 0.24;
  addHitParticles(player.x, player.y, "#dc5148", 8);
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
    world.state = "dead";
    mouse.down = false;
    ui.deathScreen.hidden = false;
  }
}

function jumpPlayer() {
  if (world.state !== "playing" || !player.alive || player.jumpCooldown > 0 || player.z > 0 || player.crouching) return;
  player.vz = 285;
  player.z = 1;
  player.jumpCooldown = 0.35;
}

function restartRun(showMessage = true) {
  player.x = 0;
  player.y = 0;
  player.z = 0;
  player.vz = 0;
  player.jumpCooldown = 0;
  player.crouching = false;
  player.sprinting = false;
  player.hp = player.maxHp;
  player.armor = player.maxArmor;
  player.stamina = player.maxStamina;
  player.ammo = weapons[player.weaponIndex].clip;
  player.reserveAmmo = player.ammoCap;
  player.reloading = 0;
  player.alive = true;
  player.invulnerable = 1;
  player.shotTimer = 0;
  player.flashlight = false;
  updateFogOfWar();
  world.state = "playing";
  bullets.length = 0;
  zombies.length = 0;
  crates.length = 0;
  particles.length = 0;
  drops.length = 0;
  world.activeSearch = null;
  closeCraftingMenu();
  ui.deathScreen.hidden = true;
  ensureWorldPopulated();
  if (showMessage) flash("Back at base");
}

function setSelectedCharacter(character) {
  selectedCharacter = validCharacter(character);
  updateCharacterSelection();
}

function updateCharacterSelection() {
  ui.characterButtons.forEach((button) => {
    const selected = button.dataset.character === selectedCharacter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function startGame(fromSave = false) {
  if (fromSave && !loadProgress()) {
    flash("No save found");
    return;
  }
  if (!fromSave) {
    clearProgress();
  }
  world.state = "playing";
  ui.mainMenu.hidden = true;
  ui.pauseMenu.hidden = true;
  ui.settingsPanel.hidden = true;
  closeCraftingMenu();
  ui.deathScreen.hidden = true;
  mouse.down = false;
  startMusic();
  updateHud();
  flash(fromSave ? "Save loaded" : "New run started");
}

function openNewGameMenu() {
  world.state = "menu";
  world.activeSearch = null;
  ui.mainMenu.hidden = false;
  ui.pauseMenu.hidden = true;
  ui.settingsPanel.hidden = true;
  closeCraftingMenu();
  ui.deathScreen.hidden = true;
  mouse.down = false;
  stopMusic();
  updateMenuButtons();
}

function pauseGame() {
  if (world.state !== "playing") return;
  world.state = "paused";
  ui.pauseMenu.hidden = false;
  closeSettingsPanel();
  closeCraftingMenu();
  mouse.down = false;
  keys.clear();
  updateMenuButtons();
}

function resumeGame() {
  if (world.state !== "paused") return;
  world.state = "playing";
  ui.pauseMenu.hidden = true;
  ui.settingsPanel.hidden = true;
  mouse.down = false;
}

function togglePause() {
  if (world.state === "playing") pauseGame();
  else if (world.state === "paused") resumeGame();
}

function loadGameFromMenu() {
  if (!loadProgress()) {
    flash("No save found");
    return;
  }
  world.state = "playing";
  ui.mainMenu.hidden = true;
  ui.pauseMenu.hidden = true;
  ui.settingsPanel.hidden = true;
  closeCraftingMenu();
  ui.deathScreen.hidden = true;
  mouse.down = false;
  startMusic();
  flash("Save loaded");
}

function saveFromPause() {
  saveProgress();
  flash("Game saved");
}

function quitToMainMenu() {
  saveProgress();
  world.state = "menu";
  world.activeSearch = null;
  ui.mainMenu.hidden = false;
  ui.pauseMenu.hidden = true;
  ui.settingsPanel.hidden = true;
  closeCraftingMenu();
  ui.deathScreen.hidden = true;
  mouse.down = false;
  stopMusic();
  updateMenuButtons();
}

function updateMenuButtons() {
  const enabled = hasSave();
  ui.loadGameButton.disabled = !enabled;
  ui.pauseLoadButton.disabled = !enabled;
}

function openSettingsPanel() {
  syncSettingsUi();
  ui.settingsPanel.hidden = false;
}

function closeSettingsPanel() {
  ui.settingsPanel.hidden = true;
}

function switchWeapon(delta) {
  const available = weapons.filter((weapon) => weapon.unlock());
  if (available.length <= 1) return;
  const currentId = weapons[player.weaponIndex].id;
  const current = available.findIndex((weapon) => weapon.id === currentId);
  const next = (current + delta + available.length) % available.length;
  player.weaponIndex = weapons.findIndex((weapon) => weapon.id === available[next].id);
  player.ammo = Math.min(player.ammo, weapons[player.weaponIndex].clip);
  player.reloading = 0;
}

function update(dt) {
  mouse.worldX = screenToWorld(mouse.x, mouse.y).x;
  mouse.worldY = screenToWorld(mouse.x, mouse.y).y;

  if (world.state === "menu" || world.state === "paused") {
    updateMusicVolumes();
    updateHud();
    return;
  }

  world.time += dt;
  world.harvestClock += dt;
  updateMusicVolumes();

  if (!player.alive) {
    updateParticles(dt);
    return;
  }

  updatePlayer(dt);
  updateShooting(dt);
  updateZombies(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateCratesAndDrops(dt);
  updateActiveSearch(dt);
  updateSpawns(dt);
  updateFogOfWar();
  updateQuestProgress();
  updateCamera(dt);
  updateHud();
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has("w")) dy -= 1;
  if (keys.has("s")) dy += 1;
  if (keys.has("a")) dx -= 1;
  if (keys.has("d")) dx += 1;

  const moving = dx || dy;
  player.crouching = keys.has("control");
  player.sprinting = false;
  if (moving) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    if (Math.abs(dx) > 0.12) player.facing = dx > 0 ? 1 : -1;
    const canSprint = keys.has("shift") && player.stamina > 4 && !player.crouching && player.z <= 0;
    player.sprinting = canSprint;
    const speedMultiplier = player.crouching ? 0.52 : canSprint ? 1.55 : 1;
    const speed = player.speed * speedMultiplier;
    const nextX = player.x + dx * speed * dt;
    const nextY = player.y + dy * speed * dt;
    if (canStandAt(nextX, player.y)) player.x = nextX;
    if (canStandAt(player.x, nextY)) player.y = nextY;
    if (canSprint) player.stamina = clamp(player.stamina - 24 * dt, 0, player.maxStamina);
  }

  if (!player.sprinting) {
    player.stamina = clamp(player.stamina + (moving ? 12 : 24) * dt, 0, player.maxStamina);
  }

  if (player.z > 0 || player.vz > 0) {
    player.z += player.vz * dt;
    player.vz -= 780 * dt;
    if (player.z <= 0) {
      player.z = 0;
      player.vz = 0;
    }
  }
  player.jumpCooldown = Math.max(0, player.jumpCooldown - dt);

  const safeZone = getSafeZoneAt(player.x, player.y);
  if (safeZone) {
    const stage = safeZone.id === "base" ? baseStages[world.baseLevel] : baseStages[0];
    player.hp = clamp(player.hp + stage.heal * dt, 0, player.maxHp);
    player.armor = clamp(player.armor + stage.armor * dt, 0, player.maxArmor);
    player.stamina = clamp(player.stamina + stage.stamina * dt, 0, player.maxStamina);
  }

  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.shotTimer = Math.max(0, player.shotTimer - dt);
}

function updateShooting(dt) {
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      player.reloading = 0;
      completeReload();
    }
  }
  if (mouse.down) shoot();
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let removed = bullet.life <= 0;
    if (!removed) {
      for (let j = zombies.length - 1; j >= 0; j -= 1) {
        const zombie = zombies[j];
        if (dist(bullet.x, bullet.y, zombie.x, zombie.y) <= zombie.radius + bullet.radius) {
          zombie.hp -= bullet.damage;
          if (!isPlayerInSafeZone()) {
            zombie.aggro = true;
            zombie.alertTimer = 7;
          }
          zombie.hitFlash = 0.08;
          addHitParticles(bullet.x, bullet.y, "#7fac60", 4);
          removed = true;
          if (zombie.hp <= 0) {
            const value = zombie.type === "brute" ? 26 : zombie.type === "runner" ? 14 : 10;
            player.scrap += Math.round(value * rand(0.7, 1.15));
            gainXp(value);
            if (Math.random() > 0.74) {
              const dropRoll = Math.random();
              const kind = dropRoll > 0.82 ? "parts" : dropRoll > 0.58 ? "wood" : dropRoll > 0.3 ? "ammo" : "scrap";
              spawnDrop(zombie.x, zombie.y, kind, Math.round(kind === "parts" ? rand(2, 6) : rand(5, 14)));
            }
            addHitParticles(zombie.x, zombie.y, "#5f8f45", 12);
            zombies.splice(j, 1);
            saveProgress();
          }
          break;
        }
      }
    }

    if (removed) bullets.splice(i, 1);
  }
}

function updateZombies(dt) {
  const safeZone = getSafeZoneAt(player.x, player.y);
  const playerSafe = Boolean(safeZone);
  for (const zombie of zombies) {
    const d = dist(player.x, player.y, zombie.x, zombie.y);
    if (playerSafe) {
      zombie.aggro = false;
      zombie.alertTimer = 0;
    } else if (d < zombie.detectRange) {
      zombie.aggro = true;
      zombie.alertTimer = 5;
    } else if (zombie.alertTimer > 0) {
      zombie.alertTimer -= dt;
    } else {
      zombie.aggro = false;
    }

    const crowding = zombies.reduce((push, other) => {
      if (other === zombie) return push;
      const nearby = dist(zombie.x, zombie.y, other.x, other.y);
      if (nearby > 0 && nearby < zombie.radius + other.radius + 8) {
        push.x += (zombie.x - other.x) / nearby;
        push.y += (zombie.y - other.y) / nearby;
      }
      return push;
    }, { x: 0, y: 0 });

    let moveX = crowding.x * 0.45;
    let moveY = crowding.y * 0.45;
    if (zombie.aggro) {
      const angle = Math.atan2(player.y - zombie.y, player.x - zombie.x);
      moveX += Math.cos(angle);
      moveY += Math.sin(angle);
    } else if (safeZone && dist(zombie.x, zombie.y, safeZone.x, safeZone.y) < safeZone.radius + 150) {
      const awayFromBase = Math.atan2(zombie.y - safeZone.y, zombie.x - safeZone.x);
      moveX += Math.cos(awayFromBase) * 0.9;
      moveY += Math.sin(awayFromBase) * 0.9;
    } else {
      zombie.wanderTimer -= dt;
      if (zombie.wanderTimer <= 0) {
        zombie.wanderAngle += rand(-1.4, 1.4);
        zombie.wanderTimer = rand(1.0, 3.2);
      }
      moveX += Math.cos(zombie.wanderAngle) * 0.22;
      moveY += Math.sin(zombie.wanderAngle) * 0.22;
    }

    const moveLength = Math.hypot(moveX, moveY) || 1;
    const speed = zombie.speed * (zombie.aggro ? 1 : 0.32);
    if (Math.abs(moveX) > 0.08) zombie.facing = moveX > 0 ? 1 : -1;
    const nextX = zombie.x + (moveX / moveLength) * speed * dt;
    const nextY = zombie.y + (moveY / moveLength) * speed * dt;
    if (canStandAt(nextX, zombie.y)) zombie.x = nextX;
    else zombie.wanderAngle += Math.PI * 0.5;
    if (canStandAt(zombie.x, nextY)) zombie.y = nextY;
    else zombie.wanderAngle += Math.PI * 0.5;

    const limit = exploredRadius() + 600;
    const fromBase = Math.hypot(zombie.x, zombie.y);
    if (fromBase > limit) {
      zombie.x = (zombie.x / fromBase) * limit;
      zombie.y = (zombie.y / fromBase) * limit;
      zombie.wanderAngle += Math.PI;
    }

    zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);
    zombie.hitFlash = Math.max(0, zombie.hitFlash - dt);

    if (!playerSafe && zombie.aggro && d < player.radius + zombie.radius + 4 && zombie.attackCooldown <= 0) {
      zombie.attackCooldown = 0.82;
      damagePlayer(zombie.damage);
    }
  }
}

function updateCratesAndDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    drop.ttl -= dt;
    if (drop.ttl <= 0) drops.splice(i, 1);
  }

  world.lootPrompt = null;
  if (world.activeSearch) return;
  if (isNearWorkbench()) {
    world.lootPrompt = { x: safeZones[0].x + 74, y: safeZones[0].y + 12, label: "E" };
  }
  for (const landmark of majorLandmarks) {
    if (!landmark.discovered && dist(player.x, player.y, landmark.x, landmark.y) < landmark.radius) {
      discoverLandmark(landmark);
    }
  }
  for (const structure of structures) {
    if (!structure.discovered && dist(player.x, player.y, structure.x, structure.y) < 190) {
      structure.discovered = true;
      flash(`Discovered ${structureTypes[structure.type].name}`);
      updateQuestProgress();
      saveProgress();
    }
  }
  for (const crate of crates) {
    if (!crate.looted && dist(player.x, player.y, crate.x, crate.y) < 54) {
      world.lootPrompt = { x: crate.x, y: crate.y - 34, label: "E" };
      break;
    }
  }
  if (!world.lootPrompt) {
    for (const landmark of majorLandmarks) {
      if (!landmark.looted && dist(player.x, player.y, landmark.x, landmark.y) < 112) {
        world.lootPrompt = { x: landmark.x, y: landmark.y - 88, label: "E" };
        break;
      }
    }
  }
  if (!world.lootPrompt) {
    for (const structure of structures) {
      if (!structure.looted && dist(player.x, player.y, structure.x, structure.y) < 78) {
        world.lootPrompt = { x: structure.x, y: structure.y - 58, label: "E" };
        break;
      }
    }
  }
  if (!world.lootPrompt) {
    const harvest = nearestHarvestTarget();
    if (harvest) {
      world.lootPrompt = { x: harvest.x, y: harvest.y - 42, label: "E" };
    }
  }
  if (!world.lootPrompt) {
    for (const drop of drops) {
      if (dist(player.x, player.y, drop.x, drop.y) < 40) {
        world.lootPrompt = { x: drop.x, y: drop.y - 26, label: "E" };
        break;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function updateSpawns(dt) {
  generateStructuresAroundPlayer();
  const zone = currentZone();
  const pressure = Math.min(1.2, world.time / 240);
  const targetPopulation = 7 + zone * 3;
  if (world.time > world.nextSpawn && zombies.length < targetPopulation) {
    spawnZombie();
    world.nextSpawn = world.time + Math.max(0.7, 3.6 - zone * 0.26 - pressure * 0.45);
  }
  if (world.time > world.nextCrate && crates.filter((crate) => !crate.looted).length < 12) {
    spawnCrate();
    world.nextCrate = world.time + rand(5, 9);
  }
}

function updateCamera(dt) {
  camera.x += (player.x - camera.x) * Math.min(1, dt * 8);
  camera.y += (player.y - camera.y) * Math.min(1, dt * 8);
}

function updateHud() {
  const hp = Math.max(0, Math.round(player.hp));
  const armor = Math.max(0, Math.round(player.armor));
  const stamina = Math.max(0, Math.round(player.stamina));
  ui.healthBar.style.width = `${(hp / player.maxHp) * 100}%`;
  ui.healthText.textContent = `${hp} / ${player.maxHp}`;
  ui.staminaBar.style.width = `${(stamina / player.maxStamina) * 100}%`;
  ui.staminaText.textContent = `${stamina} / ${player.maxStamina}`;
  ui.armorBar.style.width = `${player.maxArmor ? (armor / player.maxArmor) * 100 : 0}%`;
  ui.armorText.textContent = `${armor} / ${player.maxArmor}`;
  ui.weaponText.textContent = player.reloading > 0 ? "Reloading" : weapons[player.weaponIndex].name;
  ui.ammoText.textContent = `${player.ammo} / ${player.reserveAmmo}`;
  ui.scrapText.textContent = `${player.scrap} scrap | ${player.wood} wood | ${player.stone} stone | ${player.parts} parts`;
  ui.runStatus.textContent = `${timeOfDayLabel()} - Zone ${currentZone()} - ${Math.round(Math.hypot(player.x, player.y))}m`;
  ui.levelText.textContent = `Level ${player.level} - ${player.xp}/${player.level * 60} XP`;
  ui.distanceText.textContent = baseStages[world.baseLevel].name;
  ui.questTitle.textContent = currentQuest().title;
  ui.questText.textContent = currentQuest().text();
  updateBaseUpgradeButton();
  updateCraftingButtons();
}

function draw() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawGround();
  drawSceneryProps();
  drawLandmarks();
  drawStructures();
  drawBase();
  drawCrates();
  drawDrops();
  drawBullets();
  drawZombies();
  drawPlayer();
  drawParticles();
  drawSearchProgress();
  drawLighting();
  drawFogOfWar();
  drawPrompt();
  drawMinimap();
}

function viewportBounds(padding = 0) {
  return {
    left: camera.x - window.innerWidth / 2 - padding,
    right: camera.x + window.innerWidth / 2 + padding,
    top: camera.y - window.innerHeight / 2 - padding,
    bottom: camera.y + window.innerHeight / 2 + padding
  };
}

function strokeWorldCurve(points, width, color, alpha = 1) {
  if (points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    const screen = worldToScreen(point.x, point.y);
    if (index === 0) ctx.moveTo(screen.x, screen.y);
    else ctx.lineTo(screen.x, screen.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawSoftEllipse(worldX, worldY, radiusX, radiusY, color, alpha = 1, rotation = 0) {
  const screen = worldToScreen(worldX, worldY);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, radiusX, radiusY, rotation, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRegionEdge(axis, position, color, shadowColor, direction) {
  const view = viewportBounds(160);
  const start = axis === "x" ? view.top : view.left;
  const end = axis === "x" ? view.bottom : view.right;
  const step = 132;
  for (let value = Math.floor(start / step) * step; value < end + step; value += step) {
    const wobble = (hash2(value, position, 31) - 0.5) * 70;
    const size = 150 + hash2(value, position, 32) * 100;
    if (axis === "x") {
      drawSoftEllipse(position + direction * 32, value + wobble, size * 0.35, size, shadowColor, 0.16);
      drawSoftEllipse(position + direction * 22, value + wobble, size * 0.28, size * 0.82, color, 0.32);
    } else {
      drawSoftEllipse(value + wobble, position + direction * 32, size, size * 0.35, shadowColor, 0.16);
      drawSoftEllipse(value + wobble, position + direction * 22, size * 0.82, size * 0.28, color, 0.32);
    }
  }
}

function drawBridge() {
  const centerY = riverCenter(0);
  const top = worldToScreen(0, centerY - 108);
  const bottom = worldToScreen(0, centerY + 108);
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.fillStyle = "rgba(52, 35, 21, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 108, 82, 128, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8f6843";
  ctx.strokeStyle = "#553a25";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-74, 0);
  ctx.lineTo(74, 0);
  ctx.lineTo(68, bottom.y - top.y);
  ctx.lineTo(-68, bottom.y - top.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(83, 58, 37, 0.58)";
  ctx.lineWidth = 5;
  for (let y = 22; y < bottom.y - top.y; y += 28) {
    ctx.beginPath();
    ctx.moveTo(-70, y);
    ctx.lineTo(70, y + Math.sin(y * 0.2) * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4b3320";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-82, -4);
  ctx.lineTo(-76, bottom.y - top.y + 4);
  ctx.moveTo(82, -4);
  ctx.lineTo(76, bottom.y - top.y + 4);
  ctx.stroke();
  ctx.restore();
}

function terrainPalette(terrain) {
  if (terrain === "forest") {
    return {
      base: "#4f7b3d",
      light: "#6e9b4b",
      mid: "#416f36",
      dark: "#294a2c",
      edge: "#26432a"
    };
  }
  if (terrain === "dry") {
    return {
      base: "#bfa95f",
      light: "#dac777",
      mid: "#aa9251",
      dark: "#7f6b3c",
      edge: "#8a7441"
    };
  }
  if (terrain === "camp") {
    return {
      base: "#8eae60",
      light: "#a9c777",
      mid: "#78984f",
      dark: "#536d3e",
      edge: "#67854a"
    };
  }
  return {
    base: "#79b94f",
    light: "#9ad463",
    mid: "#66a846",
    dark: "#477b38",
    edge: "#5d943f"
  };
}

function drawRoundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTilePatch(tileX, tileY, size, color, seed, alpha = 0.2) {
  const sx = worldToScreen(tileX, tileY).x;
  const sy = worldToScreen(tileX, tileY).y;
  const px = sx + size * (0.2 + hash2(tileX, tileY, seed) * 0.6);
  const py = sy + size * (0.2 + hash2(tileX, tileY, seed + 1) * 0.6);
  const rx = size * (0.16 + hash2(tileX, tileY, seed + 2) * 0.18);
  const ry = size * (0.08 + hash2(tileX, tileY, seed + 3) * 0.12);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(px, py, rx, ry, hash2(tileX, tileY, seed + 4) * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTileGrassDetail(tileX, tileY, size, palette) {
  const density = 4 + Math.floor(hash2(tileX, tileY, 123) * 5);
  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < density; i += 1) {
    const wx = tileX + size * (0.1 + hash2(tileX, tileY, 130 + i) * 0.8);
    const wy = tileY + size * (0.12 + hash2(tileX, tileY, 150 + i) * 0.76);
    const s = worldToScreen(wx, wy);
    const blade = 5 + hash2(tileX, tileY, 170 + i) * 7;
    ctx.strokeStyle = i % 2 ? palette.mid : palette.dark;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + blade * 0.4);
    ctx.quadraticCurveTo(s.x - blade * 0.35, s.y, s.x + blade * 0.18, s.y - blade);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVectorTerrainTile(tileX, tileY, size, terrain) {
  const screen = worldToScreen(tileX, tileY);
  const palette = terrainPalette(terrain);
  const inset = 1;
  ctx.fillStyle = palette.base;
  drawRoundedRect(screen.x + inset, screen.y + inset, size - inset * 2, size - inset * 2, 9);
  ctx.fill();

  ctx.strokeStyle = palette.edge;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 2;
  drawRoundedRect(screen.x + inset + 2, screen.y + inset + 2, size - inset * 2 - 4, size - inset * 2 - 4, 8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  drawTilePatch(tileX, tileY, size, palette.light, 91, terrain === "forest" ? 0.24 : 0.2);
  drawTilePatch(tileX + 17, tileY - 23, size, palette.mid, 97, terrain === "dry" ? 0.24 : 0.16);
  drawTilePatch(tileX - 11, tileY + 29, size, palette.dark, 101, terrain === "forest" ? 0.2 : 0.12);

  if (terrain === "forest") {
    drawTileGrassDetail(tileX, tileY, size, palette);
    drawTileGrassDetail(tileX + 31, tileY - 17, size, palette);
  } else if (terrain === "grass" || terrain === "camp") {
    drawTileGrassDetail(tileX, tileY, size, palette);
  }
}

function drawTerrainTileTransitions(tileX, tileY, size, terrain) {
  const screen = worldToScreen(tileX, tileY);
  const neighbors = [
    { dx: 0, dy: -size, side: "top" },
    { dx: size, dy: 0, side: "right" },
    { dx: 0, dy: size, side: "bottom" },
    { dx: -size, dy: 0, side: "left" }
  ];

  for (const neighbor of neighbors) {
    const other = baseTerrainAt(tileX + size / 2 + neighbor.dx, tileY + size / 2 + neighbor.dy);
    if (other === terrain) continue;
    const palette = terrainPalette(other);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = palette.base;
    if (neighbor.side === "top") {
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.bezierCurveTo(screen.x + size * 0.24, screen.y + 13, screen.x + size * 0.64, screen.y - 8, screen.x + size, screen.y + 9);
      ctx.lineTo(screen.x + size, screen.y);
      ctx.closePath();
    } else if (neighbor.side === "right") {
      ctx.beginPath();
      ctx.moveTo(screen.x + size, screen.y);
      ctx.bezierCurveTo(screen.x + size - 9, screen.y + size * 0.28, screen.x + size + 8, screen.y + size * 0.66, screen.x + size - 10, screen.y + size);
      ctx.lineTo(screen.x + size, screen.y + size);
      ctx.closePath();
    } else if (neighbor.side === "bottom") {
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y + size);
      ctx.bezierCurveTo(screen.x + size * 0.32, screen.y + size - 11, screen.x + size * 0.72, screen.y + size + 9, screen.x + size, screen.y + size - 10);
      ctx.lineTo(screen.x + size, screen.y + size);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.bezierCurveTo(screen.x + 11, screen.y + size * 0.32, screen.x - 8, screen.y + size * 0.68, screen.x + 10, screen.y + size);
      ctx.lineTo(screen.x, screen.y + size);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawVectorTerrainTiles(view) {
  const tile = 192;
  const startX = Math.floor(view.left / tile) * tile;
  const startY = Math.floor(view.top / tile) * tile;
  for (let y = startY; y < view.bottom + tile; y += tile) {
    for (let x = startX; x < view.right + tile; x += tile) {
      const terrain = baseTerrainAt(x + tile / 2, y + tile / 2);
      drawVectorTerrainTile(x, y, tile, terrain);
    }
  }
  for (let y = startY; y < view.bottom + tile; y += tile) {
    for (let x = startX; x < view.right + tile; x += tile) {
      const terrain = baseTerrainAt(x + tile / 2, y + tile / 2);
      drawTerrainTileTransitions(x, y, tile, terrain);
    }
  }
}

function drawSummerGroundTiles(view) {
  const size = SUMMER_GROUND_TILE_SIZE;
  const startTx = Math.floor((view.left + size / 2) / size);
  const startTy = Math.floor((view.top + size / 2) / size);
  const endTx = Math.ceil((view.right + size / 2) / size);
  const endTy = Math.ceil((view.bottom + size / 2) / size);

  for (let ty = startTy; ty <= endTy; ty += 1) {
    for (let tx = startTx; tx <= endTx; tx += 1) {
      const tile = summerGroundTile(tx, ty);
      const tileNumber = tile.number;
      const asset = terrainAssets.ground[tileNumber - 1];
      const world = summerTileToWorld(tx, ty);
      const screen = worldToScreen(world.x, world.y);
      if (asset?.loaded) {
        drawGroundTileImage(asset.image, Math.round(screen.x), Math.round(screen.y), size, tile.rotation);
      } else {
        const dirt = isSummerDirtTile(tx, ty);
        ctx.fillStyle = dirt ? "#edc176" : "#6bad43";
        ctx.fillRect(Math.round(screen.x), Math.round(screen.y), size, size);
      }
    }
  }
}

function drawGroundTileImage(image, x, y, size, rotation = 0) {
  if (!rotation) {
    ctx.drawImage(image, x, y, size, size);
    return;
  }
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawGround() {
  const view = viewportBounds(260);
  ctx.save();
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = "#6bad43";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  drawSummerGroundTiles(view);

  for (const zone of safeZones) {
    drawSoftEllipse(zone.x, zone.y, zone.radius + 88, zone.radius + 60, "#9bb866", 0.42);
    drawSoftEllipse(zone.x - 28, zone.y + 16, zone.radius + 38, zone.radius + 24, "#7fa653", 0.34, -0.2);
  }

  const riverPoints = [];
  for (let x = view.left; x <= view.right; x += 100) {
    riverPoints.push({ x, y: riverCenter(x) });
  }
  strokeWorldCurve(riverPoints, 186, "rgba(219, 232, 184, 0.42)");
  strokeWorldCurve(riverPoints, 158, "#2e957d");
  strokeWorldCurve(riverPoints, 116, "#36a88c");
  strokeWorldCurve(riverPoints, 72, "#2d876f");

  for (let x = Math.floor(view.left / 180) * 180; x < view.right + 180; x += 180) {
    const y = riverCenter(x) + Math.sin(world.time * 1.4 + x * 0.015) * 12;
    strokeWorldCurve([{ x: x - 44, y }, { x: x + 48, y: y + Math.sin(x) * 5 }], 3, "rgba(210, 246, 222, 0.26)");
  }

  drawBridge();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function pickTerrainAsset(kind, x, y, salt) {
  const list = terrainAssets[kind];
  if (!list || list.length === 0) return null;
  return list[Math.floor(hash2(x, y, salt) * list.length) % list.length];
}

function drawTerrainAsset(kind, worldX, worldY, scale, salt, alpha = 1) {
  const asset = pickTerrainAsset(kind, worldX, worldY, salt);
  if (!asset || !asset.loaded) return false;
  const screen = worldToScreen(worldX, worldY);
  const width = asset.image.width * scale;
  const height = asset.image.height * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = alpha;
  ctx.translate(screen.x, screen.y);
  if (hash2(worldX, worldY, salt + 12) > 0.5) ctx.scale(-1, 1);
  ctx.drawImage(asset.image, -width / 2, -height, width, height);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  return true;
}

function drawPropImage(kind, worldX, worldY, width, alpha = 1, flip = false) {
  const asset = terrainAssets[kind]?.[0];
  if (!asset?.loaded) return false;
  return drawLoadedAsset(asset, worldX, worldY, width, alpha, flip);
}

function drawLoadedAsset(asset, worldX, worldY, width, alpha = 1, flip = false, anchor = "center") {
  const screen = worldToScreen(worldX, worldY);
  const height = (asset.image.height / asset.image.width) * width;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = alpha;
  ctx.translate(screen.x, screen.y);
  if (flip) ctx.scale(-1, 1);
  const y = anchor === "bottom" ? -height : -height / 2;
  ctx.drawImage(asset.image, -width / 2, y, width, height);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  return true;
}

function drawSceneryProps() {
  const tile = 128;
  const startX = Math.floor((camera.x - window.innerWidth / 2) / tile) * tile;
  const startY = Math.floor((camera.y - window.innerHeight / 2) / tile) * tile;
  const endX = camera.x + window.innerWidth / 2 + tile;
  const endY = camera.y + window.innerHeight / 2 + tile;

  for (let y = startY; y < endY; y += tile) {
    for (let x = startX; x < endX; x += tile) {
      const centerX = x + tile / 2;
      const centerY = y + tile / 2;
      const terrain = terrainAt(centerX, centerY);
      const h = hash2(x, y, 8);
      if (isInAnySafeZone(centerX, centerY, 150) || isSummerDirtWorld(centerX, centerY) || terrain === "water" || terrain === "bridge" || terrain === "path") continue;

      const propX = centerX + (hash2(x, y, 9) - 0.5) * 54;
      const propY = centerY + (hash2(x, y, 10) - 0.5) * 54;
      const screen = worldToScreen(propX, propY);
      const harvestNode = harvestNodeFromCell(x, y);
      if (terrain === "forest" && h > 0.28) {
        if (harvestNode?.kind === "wood") {
          drawHarvestNode(harvestNode, screen, h);
        }
      } else if ((terrain === "grass" || terrain === "camp") && h > 0.58) {
        drawTerrainAsset("grass", propX, propY + 20, 0.34 + h * 0.22, 21, 0.96) || drawBush(screen.x, screen.y, h);
      } else if (terrain === "grass" && h > 0.42) {
        drawTerrainAsset("grass", propX, propY + 22, 0.2 + h * 0.16, 23, 0.82);
      } else if (terrain === "dry" && h > 0.72) {
        if (harvestNode?.kind === "stone") {
          drawHarvestNode(harvestNode, screen, h);
        }
      } else if (terrain === "dry" && h > 0.52) {
        if (harvestNode?.kind === "stone") {
          drawHarvestNode(harvestNode, screen, h);
        } else {
          drawTerrainAsset("grass", propX, propY + 18, 0.18 + h * 0.12, 27, 0.72);
        }
      }
    }
  }
}

function drawStructureFallback(structure, screen) {
  const color = structureTypes[structure.type].color;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 28, 54, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(screen.x - 34), Math.floor(screen.y - 34), 68, 54);
  ctx.fillStyle = "#4f3929";
  ctx.beginPath();
  ctx.moveTo(screen.x - 42, screen.y - 32);
  ctx.lineTo(screen.x, screen.y - 66);
  ctx.lineTo(screen.x + 42, screen.y - 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#201b18";
  ctx.fillRect(Math.floor(screen.x - 7), Math.floor(screen.y - 4), 14, 24);
  ctx.restore();
}

function drawStructureDetails(structure) {
  const flip = hash2(structure.x, structure.y, 580) > 0.5;
  const alpha = structure.looted ? 0.62 : 1;
  if (structure.type === "farm") {
    drawPropImage("house", structure.x, structure.y - 8, 120, alpha, flip) || drawStructureFallback(structure, worldToScreen(structure.x, structure.y));
    drawPropImage("windmill", structure.x + 96, structure.y - 22, 92, alpha);
    drawPropImage("well", structure.x - 74, structure.y + 42, 54, alpha);
  } else if (structure.type === "camp") {
    drawPropImage("tent", structure.x - 34, structure.y - 6, 82, alpha);
    drawPropImage("tent", structure.x + 42, structure.y + 18, 72, alpha, true);
    drawPropImage("barrel", structure.x + 84, structure.y + 54, 34, alpha);
  } else if (structure.type === "depot") {
    drawPropImage("house", structure.x, structure.y - 6, 104, alpha) || drawStructureFallback(structure, worldToScreen(structure.x, structure.y));
    drawPropImage("barrel", structure.x - 58, structure.y + 44, 38, alpha);
    drawPropImage("chest", structure.x + 62, structure.y + 46, 44, alpha);
  } else if (structure.type === "clinic") {
    drawPropImage("house", structure.x, structure.y - 6, 112, alpha) || drawStructureFallback(structure, worldToScreen(structure.x, structure.y));
    const s = worldToScreen(structure.x, structure.y - 66);
    ctx.fillStyle = "#dfe8dc";
    ctx.fillRect(Math.floor(s.x - 10), Math.floor(s.y - 3), 20, 6);
    ctx.fillRect(Math.floor(s.x - 3), Math.floor(s.y - 10), 6, 20);
  } else if (structure.type === "radio") {
    drawPropImage("watchtower", structure.x, structure.y - 18, 112, alpha) || drawStructureFallback(structure, worldToScreen(structure.x, structure.y));
    const s = worldToScreen(structure.x + 40, structure.y - 86);
    ctx.strokeStyle = "#b7c4bd";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + 74);
    ctx.lineTo(s.x, s.y - 18);
    ctx.moveTo(s.x - 23, s.y + 8);
    ctx.lineTo(s.x, s.y - 18);
    ctx.lineTo(s.x + 23, s.y + 8);
    ctx.stroke();
  } else {
    drawPropImage("house", structure.x, structure.y - 4, 98, alpha, flip) || drawStructureFallback(structure, worldToScreen(structure.x, structure.y));
  }
}

function drawLandmarkDetails(landmark) {
  const alpha = landmark.looted ? 0.66 : 1;
  const flip = hash2(landmark.x, landmark.y, 730) > 0.5;
  if (landmark.type === "clinic") {
    drawPropImage("house", landmark.x, landmark.y - 10, 146, alpha, flip) || drawStructureFallback({ type: "clinic" }, worldToScreen(landmark.x, landmark.y));
    const s = worldToScreen(landmark.x, landmark.y - 86);
    ctx.fillStyle = "#edf2df";
    ctx.fillRect(Math.floor(s.x - 14), Math.floor(s.y - 4), 28, 8);
    ctx.fillRect(Math.floor(s.x - 4), Math.floor(s.y - 14), 8, 28);
    drawPropImage("well", landmark.x - 92, landmark.y + 54, 52, alpha);
  } else if (landmark.type === "radio") {
    drawPropImage("watchtower", landmark.x, landmark.y - 18, 148, alpha) || drawStructureFallback({ type: "radio" }, worldToScreen(landmark.x, landmark.y));
    const s = worldToScreen(landmark.x + 58, landmark.y - 112);
    ctx.strokeStyle = "#c7d3d0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + 114);
    ctx.lineTo(s.x, s.y - 34);
    ctx.moveTo(s.x - 34, s.y + 6);
    ctx.lineTo(s.x, s.y - 34);
    ctx.lineTo(s.x + 34, s.y + 6);
    ctx.moveTo(s.x - 25, s.y + 48);
    ctx.lineTo(s.x + 25, s.y + 48);
    ctx.stroke();
  } else if (landmark.type === "checkpoint") {
    drawPropImage("watchtower", landmark.x - 74, landmark.y - 22, 92, alpha);
    drawPropImage("watchtower", landmark.x + 86, landmark.y - 18, 84, alpha, true);
    drawPropImage("barrel", landmark.x - 16, landmark.y + 58, 38, alpha);
    drawPropImage("chest", landmark.x + 38, landmark.y + 64, 42, alpha);
    const s = worldToScreen(landmark.x, landmark.y + 10);
    ctx.strokeStyle = "#7a5232";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(s.x - 114, s.y);
    ctx.lineTo(s.x + 112, s.y);
    ctx.stroke();
  } else if (landmark.type === "convoy") {
    const s = worldToScreen(landmark.x, landmark.y);
    ctx.save();
    ctx.fillStyle = "#68473e";
    ctx.fillRect(Math.floor(s.x - 92), Math.floor(s.y - 34), 78, 42);
    ctx.fillStyle = "#4e6068";
    ctx.fillRect(Math.floor(s.x + 10), Math.floor(s.y - 12), 94, 46);
    ctx.fillStyle = "#1d1f1f";
    [-72, -28, 32, 84].forEach((wheel) => {
      ctx.beginPath();
      ctx.arc(s.x + wheel, s.y + 14, 9, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    drawPropImage("barrel", landmark.x - 28, landmark.y + 74, 40, alpha);
    drawPropImage("chest", landmark.x + 78, landmark.y + 76, 46, alpha);
  } else if (landmark.type === "farmhouse") {
    drawPropImage("house", landmark.x, landmark.y - 8, 152, alpha, flip) || drawStructureFallback({ type: "farm" }, worldToScreen(landmark.x, landmark.y));
    drawPropImage("windmill", landmark.x + 130, landmark.y - 28, 122, alpha);
    drawPropImage("well", landmark.x - 104, landmark.y + 64, 58, alpha);
    drawPropImage("barrel", landmark.x + 54, landmark.y + 88, 38, alpha);
  } else if (landmark.type === "bunker") {
    const s = worldToScreen(landmark.x, landmark.y);
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 18, 82, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#596461";
    ctx.fillRect(Math.floor(s.x - 64), Math.floor(s.y - 32), 128, 64);
    ctx.fillStyle = "#252d2d";
    ctx.fillRect(Math.floor(s.x - 38), Math.floor(s.y - 12), 76, 42);
    ctx.strokeStyle = "#bcb7a4";
    ctx.lineWidth = 4;
    ctx.strokeRect(Math.floor(s.x - 38), Math.floor(s.y - 12), 76, 42);
    ctx.restore();
    drawPropImage("chest", landmark.x + 96, landmark.y + 58, 44, alpha);
  }
}

function drawLandmarks() {
  const view = viewportBounds(260);
  for (const landmark of majorLandmarks) {
    if (landmark.x < view.left || landmark.x > view.right || landmark.y < view.top || landmark.y > view.bottom) continue;
    const s = worldToScreen(landmark.x, landmark.y);
    const type = landmarkTypes[landmark.type];
    ctx.save();
    ctx.fillStyle = landmark.looted ? "rgba(122, 104, 76, 0.22)" : "rgba(216, 183, 95, 0.2)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 20, landmark.radius * 0.72, landmark.radius * 0.34, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = landmark.discovered ? "rgba(216, 183, 95, 0.48)" : "rgba(237, 242, 223, 0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 20, landmark.radius * 0.74, landmark.radius * 0.36, -0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawLandmarkDetails(landmark);
    if (!landmark.looted) {
      const marker = worldToScreen(landmark.x, landmark.y - 106);
      ctx.fillStyle = landmark.discovered ? type.marker : "rgba(237, 242, 223, 0.7)";
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 7);
      ctx.lineTo(marker.x + 7, marker.y);
      ctx.lineTo(marker.x, marker.y + 7);
      ctx.lineTo(marker.x - 7, marker.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawStructures() {
  const view = viewportBounds(220);
  for (const structure of structures) {
    if (structure.x < view.left || structure.x > view.right || structure.y < view.top || structure.y > view.bottom) continue;
    const s = worldToScreen(structure.x, structure.y);
    const radius = structure.type === "farm" ? 118 : 86;
    ctx.save();
    ctx.fillStyle = structure.looted ? "rgba(122, 104, 76, 0.2)" : "rgba(216, 183, 95, 0.18)";
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 18, radius, radius * 0.52, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawStructureDetails(structure);
    if (!structure.looted) {
      const marker = worldToScreen(structure.x, structure.y - 78);
      ctx.fillStyle = structure.discovered ? "#d8b75f" : "rgba(237, 242, 223, 0.65)";
      ctx.fillRect(Math.floor(marker.x - 3), Math.floor(marker.y - 3), 6, 6);
    }
  }
}

function drawTree(x, y, seed) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 26, 42, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#68462d";
  ctx.beginPath();
  ctx.moveTo(x - 11, y + 32);
  ctx.bezierCurveTo(x - 7, y + 5, x - 12, y - 10, x - 5, y - 32);
  ctx.lineTo(x + 13, y - 31);
  ctx.bezierCurveTo(x + 5, y - 6, x + 13, y + 7, x + 10, y + 32);
  ctx.closePath();
  ctx.fill();
  const leafA = seed > 0.6 ? "#507b38" : "#456f35";
  const leafB = seed > 0.6 ? "#5f8b41" : "#3d6330";
  ctx.fillStyle = leafA;
  ctx.beginPath();
  ctx.ellipse(x - 26, y - 46, 34, 29, -0.2, 0, Math.PI * 2);
  ctx.ellipse(x + 20, y - 50, 36, 31, 0.25, 0, Math.PI * 2);
  ctx.ellipse(x, y - 72, 39, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = leafB;
  ctx.beginPath();
  ctx.ellipse(x - 4, y - 38, 54, 32, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 36, y - 25, 31, 24, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 37, y - 25, 30, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function drawBush(x, y, seed) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = seed > 0.5 ? "#5c8940" : "#4f7835";
  ctx.beginPath();
  ctx.ellipse(x - 12, y, 18, 14, -0.2, 0, Math.PI * 2);
  ctx.ellipse(x + 7, y - 4, 22, 17, 0.2, 0, Math.PI * 2);
  ctx.ellipse(x + 20, y + 4, 14, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function drawRubble(x, y, seed) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(0, 0, 0, 0.17)";
  ctx.beginPath();
  ctx.ellipse(x, y + 10, 35, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8d8a7d";
  ctx.beginPath();
  ctx.ellipse(x - 12, y, 20, 14, -0.25, 0, Math.PI * 2);
  ctx.ellipse(x + 12, y - 5, 23, 18, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = seed > 0.55 ? "#6f6f67" : "#766b5d";
  ctx.beginPath();
  ctx.ellipse(x - 31, y + 6, 10, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 34, y + 5, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function drawBrokenCar(x, y, seed) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.beginPath();
  ctx.ellipse(x, y + 17, 39, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = seed > 0.5 ? "#7d4940" : "#5e7680";
  ctx.beginPath();
  ctx.moveTo(x - 34, y - 5);
  ctx.quadraticCurveTo(x - 28, y - 20, x - 4, y - 20);
  ctx.lineTo(x + 26, y - 12);
  ctx.quadraticCurveTo(x + 36, y - 8, x + 33, y + 13);
  ctx.lineTo(x - 31, y + 13);
  ctx.quadraticCurveTo(x - 38, y + 5, x - 34, y - 5);
  ctx.fill();
  ctx.fillStyle = "#263033";
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 18);
  ctx.lineTo(x + 7, y - 16);
  ctx.lineTo(x + 16, y - 8);
  ctx.lineTo(x - 18, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a1d1f";
  ctx.beginPath();
  ctx.arc(x - 23, y + 12, 8, 0, Math.PI * 2);
  ctx.arc(x + 22, y + 12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
}

function drawBase() {
  safeZones.forEach((zone) => drawSafeZoneCamp(zone));
}

function drawSafeZoneCamp(zone) {
  const base = worldToScreen(zone.x, zone.y);
  const campfireScreen = worldToScreen(zone.x + 42, zone.y + 30);
  const isMainBase = zone.id === "base";
  const stage = isMainBase ? world.baseLevel : 0;
  ctx.save();
  ctx.strokeStyle = "rgba(90, 160, 106, 0.34)";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(base.x, base.y, zone.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (isMainBase && stage >= 1) {
    const fenceRadius = zone.radius - 10;
    const segments = stage >= 3 ? 20 : 14;
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const fx = zone.x + Math.cos(angle) * fenceRadius;
      const fy = zone.y + Math.sin(angle) * fenceRadius * 0.74;
      const kind = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? "fenceVertical" : "fenceHorizontal";
      drawPropImage(kind, fx, fy, 46, 0.98, Math.cos(angle) < 0);
    }
  }

  const tent = terrainAssets.tent[0];
  if (tent?.loaded) {
    drawPropImage("tent", zone.x, zone.y, 112);
    if (isMainBase && stage >= 2) {
      drawPropImage("tent", zone.x - 72, zone.y + 52, 86, 1, true);
      drawPropImage("tent", zone.x + 92, zone.y - 26, 82);
      drawPropImage("barrel", zone.x - 8, zone.y + 82, 34);
    }
    if (isMainBase && stage >= 1) {
      drawPropImage("barrel", zone.x + 74, zone.y + 34, 36);
      drawPropImage("chest", zone.x + 102, zone.y + 42, 40);
      const bench = worldToScreen(zone.x + 76, zone.y + 56);
      ctx.save();
      ctx.fillStyle = "#7b4f2e";
      ctx.fillRect(Math.floor(bench.x - 28), Math.floor(bench.y - 8), 56, 12);
      ctx.fillStyle = "#452f23";
      ctx.fillRect(Math.floor(bench.x - 22), Math.floor(bench.y + 4), 6, 18);
      ctx.fillRect(Math.floor(bench.x + 16), Math.floor(bench.y + 4), 6, 18);
      ctx.restore();
    }
    if (isMainBase && stage >= 3) {
      drawPropImage("watchtower", zone.x - zone.radius + 34, zone.y - 22, 74);
      drawPropImage("watchtower", zone.x + zone.radius - 34, zone.y - 22, 74, 1, true);
      drawPropImage("chest", zone.x + 64, zone.y + 78, 44);
    }
    drawCampfireSprite(campfireScreen.x, campfireScreen.y);
    return;
  }

  ctx.fillStyle = "#7d5a2c";
  ctx.beginPath();
  ctx.moveTo(Math.floor(base.x), Math.floor(base.y - 45));
  ctx.lineTo(Math.floor(base.x + 48), Math.floor(base.y + 36));
  ctx.lineTo(Math.floor(base.x - 48), Math.floor(base.y + 36));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#261912";
  ctx.fillRect(Math.floor(base.x - 8), Math.floor(base.y + 8), 16, 28);
}

function drawCampfireSprite(x, y) {
  const campfire = terrainAssets.campfire[0];
  if (campfire?.loaded) {
    const width = 46;
    const height = (campfire.image.height / campfire.image.width) * width;
    ctx.drawImage(campfire.image, x - width / 2, y - height / 2, width, height);
    return;
  }
  ctx.fillStyle = "#4e4037";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d96a34";
  ctx.beginPath();
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x + 10, y + 8);
  ctx.lineTo(x - 10, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f5d26d";
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.lineTo(x + 5, y + 7);
  ctx.lineTo(x - 5, y + 7);
  ctx.closePath();
  ctx.fill();
}

function drawCrates() {
  for (const crate of crates) {
    if (crate.looted) continue;
    const s = worldToScreen(crate.x, crate.y);
    ctx.fillStyle = "#7a5738";
    ctx.fillRect(Math.floor(s.x - 16), Math.floor(s.y - 14), 32, 28);
    ctx.fillStyle = "#a77846";
    ctx.fillRect(Math.floor(s.x - 12), Math.floor(s.y - 10), 24, 20);
    ctx.fillStyle = "#493321";
    ctx.fillRect(Math.floor(s.x - 3), Math.floor(s.y - 14), 6, 28);
    ctx.fillRect(Math.floor(s.x - 16), Math.floor(s.y - 2), 32, 5);
  }
}

function drawLootIcon(kind, x, y, size = 1) {
  ctx.save();
  ctx.translate(Math.floor(x), Math.floor(y));
  ctx.scale(size, size);
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(-10, 8, 20, 4);
  if (kind === "ammo") {
    ctx.fillStyle = "#d8b75f";
    ctx.fillRect(-9, -8, 5, 15);
    ctx.fillRect(-2, -8, 5, 15);
    ctx.fillRect(5, -8, 5, 15);
    ctx.fillStyle = "#f5dda3";
    ctx.fillRect(-9, -10, 5, 3);
    ctx.fillRect(-2, -10, 5, 3);
    ctx.fillRect(5, -10, 5, 3);
  } else if (kind === "wood") {
    ctx.fillStyle = "#8b5a32";
    ctx.fillRect(-12, -5, 20, 6);
    ctx.fillRect(-7, 2, 20, 6);
    ctx.fillStyle = "#c08a4a";
    ctx.fillRect(-10, -4, 4, 4);
    ctx.fillRect(8, 3, 4, 4);
  } else if (kind === "parts") {
    ctx.fillStyle = "#b8c0ba";
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = "#445055";
    ctx.fillRect(-3, -3, 6, 6);
    ctx.fillRect(-12, -2, 24, 4);
    ctx.fillRect(-2, -12, 4, 24);
  } else if (kind === "stone") {
    ctx.fillStyle = "#8e938b";
    ctx.beginPath();
    ctx.moveTo(-11, 3);
    ctx.lineTo(-5, -9);
    ctx.lineTo(8, -8);
    ctx.lineTo(13, 2);
    ctx.lineTo(5, 9);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#b8beb5";
    ctx.fillRect(-3, -5, 8, 4);
  } else if (kind === "med") {
    ctx.fillStyle = "#dfe8dc";
    ctx.fillRect(-10, -8, 20, 16);
    ctx.fillStyle = "#dc5148";
    ctx.fillRect(-7, -2, 14, 4);
    ctx.fillRect(-2, -7, 4, 14);
  } else {
    ctx.fillStyle = "#aeb8a6";
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = "#778077";
    ctx.fillRect(-4, -4, 8, 8);
  }
  ctx.restore();
}

function drawDrops() {
  for (const drop of drops) {
    const s = worldToScreen(drop.x, drop.y);
    const pulse = 1 + Math.sin(world.time * 6 + drop.id) * 0.05;
    drawLootIcon(drop.kind, s.x, s.y, pulse);
  }
}

function drawBullets() {
  ctx.fillStyle = "#f5dda3";
  for (const bullet of bullets) {
    const s = worldToScreen(bullet.x, bullet.y);
    ctx.fillRect(Math.floor(s.x - 2), Math.floor(s.y - 2), 5, 5);
  }
}

function drawZombies() {
  for (const zombie of zombies) {
    const s = worldToScreen(zombie.x, zombie.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
    ctx.fillRect(Math.floor(s.x - 20), Math.floor(s.y + 37), 40, 7);

    const moving = zombie.aggro || zombie.alertTimer > 0;
    const action = zombie.hitFlash > 0 ? "hurt" : zombie.attackCooldown > 0.45 ? "attack" : moving ? "walk" : "idle";
    const sheet = getSpriteSheet(zombieSpriteSets[zombie.spriteSet] || zombieSpriteSets.zombie1, action);
    const fps = action === "attack" ? 12 : action === "hurt" ? 10 : moving ? 10 : 5;
    const frame = Math.floor((world.time + zombie.x * 0.001 + zombie.y * 0.001) * fps);
    const drewSprite = drawSpriteSheetFrame(sheet, frame, s.x, s.y + 22, 0.62, zombie.facing || 1, zombie.hitFlash > 0 ? 0.85 : 1);

    if (!drewSprite) {
      ctx.fillStyle = zombie.hitFlash > 0 ? "#e2f0c4" : zombie.color;
      ctx.fillRect(Math.floor(s.x - zombie.radius), Math.floor(s.y - zombie.radius), zombie.radius * 2, zombie.radius * 2);
      ctx.fillStyle = "#1a211e";
      ctx.fillRect(Math.floor(s.x - 5), Math.floor(s.y - 3), 3, 3);
      ctx.fillRect(Math.floor(s.x + 4), Math.floor(s.y - 3), 3, 3);
    }

    ctx.fillStyle = "#263622";
    ctx.fillRect(Math.floor(s.x - 18), Math.floor(s.y - 48), 36, 4);
    ctx.fillStyle = "#a74b44";
    ctx.fillRect(Math.floor(s.x - 18), Math.floor(s.y - 48), Math.floor(36 * (zombie.hp / zombie.maxHp)), 4);
  }
}

function drawPlayer() {
  const s = worldToScreen(player.x, player.y);
  const flicker = player.invulnerable > 0 && Math.floor(world.time * 24) % 2 === 0;
  if (flicker) return;

  const moving = world.state === "playing" && (keys.has("w") || keys.has("a") || keys.has("s") || keys.has("d"));
  const facing = mouse.worldX < player.x ? -1 : 1;
  player.facing = facing;
  const set = playerSpriteSets[player.character] || playerSpriteSets.male;
  const action = player.reloading > 0 ? "reload" : player.shotTimer > 0 ? "shoot" : player.sprinting ? "run" : moving ? "walk" : "idle";
  const sheet = getSpriteSheet(set, action);
  const fps = action === "reload" ? 12 : action === "shoot" ? 18 : player.sprinting ? 13 : moving ? 10 : 5;
  const frame = Math.floor(world.time * fps);
  const walk = moving ? Math.sin(world.time * 15) : 0;
  const bob = moving ? Math.abs(Math.sin(world.time * (player.sprinting ? 19 : 15))) * 2 : Math.sin(world.time * 3) * 0.9;
  const crouchOffset = player.crouching ? 9 : 0;
  const spriteScale = player.crouching ? 0.58 : 0.66;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.globalAlpha = player.z > 0 ? 0.16 : 0.28;
  ctx.fillRect(Math.floor(s.x - 20), Math.floor(s.y + 39), 42, 7);
  ctx.globalAlpha = 1;
  const drewSprite = drawSpriteSheetFrame(sheet, frame, s.x, s.y + 22 + bob + crouchOffset - player.z, spriteScale, facing);
  if (drewSprite) {
    ctx.restore();
    return;
  }

  ctx.translate(Math.floor(s.x), Math.floor(s.y + bob + crouchOffset - player.z));
  ctx.scale(facing, 1);
  if (player.crouching) ctx.scale(1, 0.86);
  if (player.character === "female") {
    drawFemaleSurvivor(walk, moving);
  } else {
    drawMaleSurvivor(walk, moving);
  }
  ctx.restore();
}

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawMaleSurvivor(walk, moving) {
  const frontLeg = moving ? walk * 4 : 0;
  const backLeg = moving ? -walk * 3 : 0;
  const armSwing = moving ? -walk * 2 : 0;

  px(-9 + backLeg, 4, 7, 18, "#171b22");
  px(-10 + backLeg, 20, 9, 5, "#633927");
  px(3 + frontLeg, 4, 7, 18, "#222838");
  px(2 + frontLeg, 20, 11, 5, "#74422e");
  px(-14, -20, 8, 24, "#34242d");
  px(-19, -16, 7, 20, "#241d23");
  px(-17, 0, 5, 7, "#c48461");
  px(-8, -23, 19, 29, "#263331");
  px(-5, -22, 15, 25, "#394b45");
  px(-1, -21, 3, 26, "#17201f");
  px(8, -18 + armSwing, 6, 20, "#24302d");
  px(11, -1 + armSwing, 5, 7, "#d49a72");
  px(-12, -18, 5, 17, "#43332b");
  px(-11, -18, 2, 15, "#855936");
  px(5, -42, 16, 17, "#d99b72");
  px(3, -46, 18, 8, "#6d342b");
  px(1, -41, 6, 12, "#5a2b27");
  px(17, -36, 5, 8, "#2a2020");
  px(18, -31, 4, 4, "#4f2b27");
  px(15, -36, 2, 2, "#1b1718");
  px(12, -26, 26, 6, "#23282d");
  px(35, -24, 9, 3, "#d8d1bd");
  px(18, -28, 4, 9, "#111516");
  px(-11, -28, 4, 28, "#1b2022");
  px(-9, -33, 3, 22, "#6e553d");
}

function drawFemaleSurvivor(walk, moving) {
  const frontLeg = moving ? walk * 4 : 0;
  const backLeg = moving ? -walk * 3 : 0;
  const armSwing = moving ? -walk * 2 : 0;

  px(-8 + backLeg, 4, 7, 18, "#3d3c42");
  px(-10 + backLeg, 20, 10, 5, "#23201f");
  px(4 + frontLeg, 4, 7, 18, "#595250");
  px(3 + frontLeg, 20, 10, 5, "#24211f");
  px(-15, -20, 8, 25, "#563c32");
  px(-18, -16, 7, 20, "#342824");
  px(-17, 1, 5, 7, "#c88763");
  px(-8, -24, 20, 30, "#242331");
  px(-4, -23, 13, 25, "#30273a");
  px(-1, -22, 3, 26, "#5b3834");
  px(9, -18 + armSwing, 6, 20, "#695040");
  px(12, -1 + armSwing, 5, 7, "#d99c70");
  px(-11, -19, 5, 18, "#4d322b");
  px(4, -43, 16, 17, "#d99c70");
  px(1, -48, 20, 10, "#a26034");
  px(0, -40, 6, 20, "#8d522f");
  px(17, -39, 5, 18, "#7b452b");
  px(16, -35, 2, 2, "#1b1718");
  px(14, -27, 25, 6, "#1f2429");
  px(36, -25, 8, 3, "#d8d1bd");
  px(19, -29, 4, 9, "#111516");
  px(-12, -29, 4, 29, "#1a1f23");
  px(-10, -35, 3, 24, "#6e553d");
}

function drawParticles() {
  for (const particle of particles) {
    const s = worldToScreen(particle.x, particle.y);
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.fillRect(Math.floor(s.x - particle.size / 2), Math.floor(s.y - particle.size / 2), particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
}

function cutLight(x, y, radius, strength = 1) {
  const gradient = lightingCtx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${0.96 * strength})`);
  gradient.addColorStop(0.52, `rgba(0, 0, 0, ${0.58 * strength})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  lightingCtx.fillStyle = gradient;
  lightingCtx.beginPath();
  lightingCtx.arc(x, y, radius, 0, Math.PI * 2);
  lightingCtx.fill();
}

function cutFlashlight(x, y, angle, distance, spread) {
  const originOffset = 2;
  const neck = 5;
  const originX = x + Math.cos(angle) * originOffset;
  const originY = y + Math.sin(angle) * originOffset;
  lightingCtx.save();
  lightingCtx.globalAlpha = 0.78;
  lightingCtx.translate(originX, originY);
  lightingCtx.rotate(angle);
  lightingCtx.beginPath();
  lightingCtx.moveTo(0, -neck);
  lightingCtx.lineTo(distance, -spread);
  lightingCtx.quadraticCurveTo(distance + 34, 0, distance, spread);
  lightingCtx.lineTo(0, neck);
  lightingCtx.closePath();
  lightingCtx.fillStyle = "rgba(0, 0, 0, 0.82)";
  lightingCtx.fill();
  lightingCtx.restore();

  cutLight(originX + Math.cos(angle) * distance * 0.76, originY + Math.sin(angle) * distance * 0.76, spread * 1.08, 0.44);
}

function drawWarmGlow(x, y, radius, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(255, 177, 78, ${alpha})`);
  gradient.addColorStop(0.38, `rgba(232, 116, 47, ${alpha * 0.34})`);
  gradient.addColorStop(1, "rgba(232, 116, 47, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawLighting() {
  const night = nightAmount();
  const darkness = clamp(night * 0.95, 0, 0.95);
  if (darkness < 0.035) return;
  lightingCtx.clearRect(0, 0, lightingCanvas.width, lightingCanvas.height);
  lightingCtx.globalCompositeOperation = "source-over";
  lightingCtx.fillStyle = `rgba(9, 13, 22, ${darkness})`;
  lightingCtx.fillRect(0, 0, lightingCanvas.width, lightingCanvas.height);

  lightingCtx.globalCompositeOperation = "destination-out";
  if (night > 0.18) {
    for (const zone of safeZones) {
      const s = worldToScreen(zone.x, zone.y);
      cutLight(s.x, s.y, zone.radius + 130, 0.72);
    }

    const playerScreen = worldToScreen(player.x, player.y);
    cutLight(playerScreen.x, playerScreen.y, player.flashlight ? 92 : 42, player.flashlight ? 0.48 : 0.18);
    if (player.flashlight) {
      const angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
      cutFlashlight(playerScreen.x, playerScreen.y - player.z * 0.4, angle, 430, 72);
    }
  }

  lightingCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(lightingCanvas, 0, 0);

  if (night > 0.16) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const zone of safeZones) {
      const s = worldToScreen(zone.x + 42, zone.y + 30);
      drawWarmGlow(s.x, s.y, 110 + Math.sin(world.time * 8) * 5, 0.12 + night * 0.18);
    }
    ctx.restore();
  }
}

function drawFogOfWar() {
  const view = viewportBounds(FOG_CELL_SIZE * 3);
  const startX = Math.floor(view.left / FOG_CELL_SIZE);
  const endX = Math.floor(view.right / FOG_CELL_SIZE);
  const startY = Math.floor(view.top / FOG_CELL_SIZE);
  const endY = Math.floor(view.bottom / FOG_CELL_SIZE);
  const night = nightAmount();

  fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
  fogCtx.globalCompositeOperation = "source-over";
  fogCtx.fillStyle = fogColor([244, 248, 240], [12, 16, 25], night, 0.94);
  fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

  fogCtx.globalCompositeOperation = "destination-out";
  for (let cy = startY; cy <= endY; cy += 1) {
    for (let cx = startX; cx <= endX; cx += 1) {
      if (!isFogRevealedCell(cx, cy)) continue;
      const screen = worldToScreen(cx * FOG_CELL_SIZE + FOG_CELL_SIZE / 2, cy * FOG_CELL_SIZE + FOG_CELL_SIZE / 2);
      cutFogHole(screen.x, screen.y, FOG_CELL_SIZE * 0.78, FOG_CELL_SIZE * 0.42);
    }
  }
  fogCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(fogCanvas, 0, 0);

  ctx.save();
  for (let cy = startY - 1; cy <= endY + 1; cy += 1) {
    for (let cx = startX - 1; cx <= endX + 1; cx += 1) {
      const edge = fogEdgeStrength(cx, cy);
      if (edge <= 0) continue;
      const screen = worldToScreen(cx * FOG_CELL_SIZE, cy * FOG_CELL_SIZE);
      drawFogCloud(cx, cy, screen.x, screen.y, (0.78 + night * 0.08) * edge, night, 0);
      drawFogCloud(cx, cy, screen.x, screen.y, (0.54 + night * 0.08) * edge, night, 23);
      if (hash2(cx, cy, 981) > 0.45) {
        drawFogCloud(cx, cy, screen.x, screen.y, (0.38 + night * 0.06) * edge, night, 47);
      }
    }
  }
  ctx.restore();
}

function drawPrompt() {
  if (!world.lootPrompt) return;
  const s = worldToScreen(world.lootPrompt.x, world.lootPrompt.y);
  ctx.fillStyle = "rgba(15, 18, 18, 0.9)";
  ctx.fillRect(Math.floor(s.x - 14), Math.floor(s.y - 14), 28, 24);
  ctx.strokeStyle = "rgba(237, 242, 223, 0.35)";
  ctx.strokeRect(Math.floor(s.x - 14), Math.floor(s.y - 14), 28, 24);
  ctx.fillStyle = "#edf2df";
  ctx.font = "bold 14px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(world.lootPrompt.label, Math.floor(s.x), Math.floor(s.y + 4));
}

function drawSearchProgress() {
  const search = world.activeSearch;
  if (!search) return;
  const s = worldToScreen(player.x, player.y - player.z - 82);
  const width = 92;
  const height = 9;
  const progress = clamp(search.elapsed / search.duration, 0, 1);
  ctx.save();
  ctx.fillStyle = "rgba(12, 16, 16, 0.86)";
  drawScreenRoundRect(Math.floor(s.x - width / 2), Math.floor(s.y), width, height + 18, 5);
  ctx.fill();
  ctx.fillStyle = "#edf2df";
  ctx.font = "bold 10px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(search.label, Math.floor(s.x), Math.floor(s.y + 10));
  ctx.fillStyle = "#222c2a";
  ctx.fillRect(Math.floor(s.x - width / 2 + 7), Math.floor(s.y + 15), width - 14, height);
  ctx.fillStyle = "#d8b75f";
  ctx.fillRect(Math.floor(s.x - width / 2 + 7), Math.floor(s.y + 15), Math.floor((width - 14) * progress), height);
  ctx.strokeStyle = "rgba(237, 242, 223, 0.24)";
  ctx.strokeRect(Math.floor(s.x - width / 2 + 7), Math.floor(s.y + 15), width - 14, height);
  ctx.restore();
}

function drawMinimap() {
  const size = 132;
  const x = 18;
  const y = window.innerHeight - size - 18;
  let radius = exploredRadius();
  for (const key of revealedFog) {
    const parts = key.split(",");
    if (parts.length !== 2) continue;
    const cx = Number(parts[0]);
    const cy = Number(parts[1]);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    radius = Math.max(
      radius,
      dist(0, 0, cx * FOG_CELL_SIZE + FOG_CELL_SIZE / 2, cy * FOG_CELL_SIZE + FOG_CELL_SIZE / 2) + FOG_CELL_SIZE
    );
  }
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const mapRadius = size / 2 - 12;
  const worldToMini = (worldX, worldY) => ({
    x: centerX + (worldX / radius) * mapRadius,
    y: centerY + (worldY / radius) * mapRadius
  });
  ctx.fillStyle = "rgba(14, 18, 18, 0.78)";
  drawScreenRoundRect(x, y, size, size, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(237, 242, 223, 0.18)";
  drawScreenRoundRect(x, y, size, size, 8);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
  ctx.clip();
  for (const key of revealedFog) {
    const parts = key.split(",");
    if (parts.length !== 2) continue;
    const cx = Number(parts[0]);
    const cy = Number(parts[1]);
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;

    const worldX = cx * FOG_CELL_SIZE;
    const worldY = cy * FOG_CELL_SIZE;
    const cellCenterX = worldX + FOG_CELL_SIZE / 2;
    const cellCenterY = worldY + FOG_CELL_SIZE / 2;
    if (dist(0, 0, cellCenterX, cellCenterY) > radius + FOG_CELL_SIZE) continue;

    const topLeft = worldToMini(worldX, worldY);
    const bottomRight = worldToMini(worldX + FOG_CELL_SIZE, worldY + FOG_CELL_SIZE);
    ctx.fillStyle = isCurrentlyVisibleAt(cellCenterX, cellCenterY) ? "rgba(132, 169, 78, 0.48)" : "rgba(96, 128, 86, 0.26)";
    ctx.fillRect(
      Math.floor(topLeft.x),
      Math.floor(topLeft.y),
      Math.max(1, Math.ceil(bottomRight.x - topLeft.x)),
      Math.max(1, Math.ceil(bottomRight.y - topLeft.y))
    );
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(237, 242, 223, 0.16)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, mapRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#5b93a8";
  const playerMini = worldToMini(player.x, player.y);
  ctx.fillRect(Math.floor(playerMini.x - 3), Math.floor(playerMini.y - 3), 6, 6);
  ctx.fillStyle = "#5aa06a";
  for (const zone of safeZones) {
    if (!isFogRevealedAt(zone.x, zone.y)) continue;
    const zoneMini = worldToMini(zone.x, zone.y);
    const zx = zoneMini.x;
    const zy = zoneMini.y;
    if (zx < x + 4 || zx > x + size - 4 || zy < y + 4 || zy > y + size - 4) continue;
    ctx.fillRect(Math.floor(zx - 3), Math.floor(zy - 3), 6, 6);
  }
  for (const structure of structures) {
    if (!structure.discovered || !isFogRevealedAt(structure.x, structure.y)) continue;
    const structureMini = worldToMini(structure.x, structure.y);
    const sx = structureMini.x;
    const sy = structureMini.y;
    if (sx < x + 4 || sx > x + size - 4 || sy < y + 4 || sy > y + size - 4) continue;
    ctx.fillStyle = structure.looted ? "rgba(216, 183, 95, 0.46)" : "#d8b75f";
    ctx.fillRect(Math.floor(sx - 2), Math.floor(sy - 2), 4, 4);
  }
  for (const landmark of majorLandmarks) {
    if (!landmark.discovered || !isFogRevealedAt(landmark.x, landmark.y)) continue;
    const landmarkMini = worldToMini(landmark.x, landmark.y);
    const lx = landmarkMini.x;
    const ly = landmarkMini.y;
    if (lx < x + 4 || lx > x + size - 4 || ly < y + 4 || ly > y + size - 4) continue;
    ctx.fillStyle = landmark.looted ? "rgba(237, 242, 223, 0.62)" : landmarkTypes[landmark.type].marker;
    ctx.beginPath();
    ctx.moveTo(Math.floor(lx), Math.floor(ly - 4));
    ctx.lineTo(Math.floor(lx + 4), Math.floor(ly));
    ctx.lineTo(Math.floor(lx), Math.floor(ly + 4));
    ctx.lineTo(Math.floor(lx - 4), Math.floor(ly));
    ctx.closePath();
    ctx.fill();
  }
  for (const zombie of zombies) {
    if (!isFogRevealedAt(zombie.x, zombie.y) || !isCurrentlyVisibleAt(zombie.x, zombie.y)) continue;
    const zombieMini = worldToMini(zombie.x, zombie.y);
    const zx = zombieMini.x;
    const zy = zombieMini.y;
    if (zx < x + 4 || zx > x + size - 4 || zy < y + 4 || zy > y + size - 4) continue;
    ctx.fillStyle = zombie.aggro ? "#dc5148" : "#7aa354";
    ctx.fillRect(Math.floor(zx - 2), Math.floor(zy - 2), 4, 4);
  }
}

function drawScreenRoundRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function initInput() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const inputKey = event.code === "Space" ? " " : key;
    if (["w", "a", "s", "d", "e", "f", "m", "r", "b", "p", "escape", "1", "2", "3", " ", "shift", "control"].includes(inputKey)) event.preventDefault();
    if (key === "escape" || key === "p") {
      if (!ui.craftingMenu.hidden) {
        closeCraftingMenu();
        return;
      }
      if (world.state === "paused" && !ui.settingsPanel.hidden) {
        closeSettingsPanel();
        return;
      }
      togglePause();
      return;
    }
    if (key === "m") {
      ui.adminMenu.hidden = !ui.adminMenu.hidden;
      return;
    }
    if (world.state !== "playing" || world.craftingOpen) return;
    if (event.code === "Space") jumpPlayer();
    if (key === "e") lootNearby();
    if (key === "f") {
      player.flashlight = !player.flashlight;
      flash(player.flashlight ? "Flashlight on" : "Flashlight off");
    }
    if (key === "r") reload();
    if (key === "b") ui.upgradePanel.classList.toggle("collapsed");
    if (key === "1" && weapons[0].unlock()) player.weaponIndex = 0;
    if (key === "2" && weapons[1].unlock()) player.weaponIndex = 1;
    if (key === "3" && weapons[2].unlock()) player.weaponIndex = 2;
    if (key === "shift") keys.add("shift");
    else if (key === "control" && event.code === "ControlLeft") keys.add("control");
    else keys.add(inputKey);
  });

  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "shift") keys.delete("shift");
    else if (key === "control" && event.code === "ControlLeft") keys.delete("control");
    else keys.delete(event.code === "Space" ? " " : key);
  });

  window.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  window.addEventListener("mousedown", (event) => {
    if (world.state !== "playing") return;
    if (event.target.closest(".panel, .death-screen, .menu-screen, .crafting-menu")) return;
    if (world.activeSearch) return;
    if (event.button === 0) {
      mouse.down = true;
      shoot();
    }
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) mouse.down = false;
  });

  window.addEventListener("wheel", (event) => {
    if (world.state !== "playing") return;
    switchWeapon(Math.sign(event.deltaY));
  }, { passive: true });

  ui.panelToggle.addEventListener("click", () => ui.upgradePanel.classList.toggle("collapsed"));
  ui.baseUpgradeButton.addEventListener("click", upgradeBase);
  ui.adminTimeButtons.forEach((button) => {
    button.addEventListener("click", () => setTimePreset(button.dataset.time));
  });
  ui.restartButton.addEventListener("click", restartRun);
  ui.newGameButton.addEventListener("click", () => startGame(false));
  ui.loadGameButton.addEventListener("click", loadGameFromMenu);
  ui.resumeButton.addEventListener("click", resumeGame);
  ui.saveGameButton.addEventListener("click", saveFromPause);
  ui.pauseLoadButton.addEventListener("click", loadGameFromMenu);
  ui.settingsButton.addEventListener("click", openSettingsPanel);
  ui.settingsBackButton.addEventListener("click", closeSettingsPanel);
  ui.musicVolumeSlider.addEventListener("input", () => {
    settings.musicVolume = Number(ui.musicVolumeSlider.value) / 100;
    settings.musicMuted = settings.musicVolume <= 0;
    syncSettingsUi();
    updateMusicVolumes();
    saveSettings();
  });
  ui.sfxVolumeSlider.addEventListener("input", () => {
    settings.sfxVolume = Number(ui.sfxVolumeSlider.value) / 100;
    settings.sfxMuted = settings.sfxVolume <= 0;
    syncSettingsUi();
    saveSettings();
  });
  ui.muteMusicButton.addEventListener("click", () => {
    settings.musicMuted = !settings.musicMuted;
    syncSettingsUi();
    updateMusicVolumes();
    saveSettings();
  });
  ui.muteSfxButton.addEventListener("click", () => {
    settings.sfxMuted = !settings.sfxMuted;
    syncSettingsUi();
    saveSettings();
  });
  ui.craftingCloseButton.addEventListener("click", closeCraftingMenu);
  ui.craftAxeButton.addEventListener("click", () => craftTool("axe"));
  ui.craftPickaxeButton.addEventListener("click", () => craftTool("pickaxe"));
  ui.pauseNewButton.addEventListener("click", openNewGameMenu);
  ui.quitGameButton.addEventListener("click", quitToMainMenu);
  ui.characterButtons.forEach((button) => {
    button.addEventListener("click", () => setSelectedCharacter(button.dataset.character));
  });
  [ui.upgradePanel, ui.adminMenu, ui.craftingMenu, ui.deathScreen, ui.mainMenu, ui.pauseMenu].forEach((element) => {
    element.addEventListener("mousedown", (event) => event.stopPropagation());
    element.addEventListener("mouseup", (event) => event.stopPropagation());
  });
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

function init() {
  resize();
  window.addEventListener("resize", resize);
  loadSpriteSheets();
  loadTerrainAssets();
  configureMusic();
  loadSettings();
  initInput();
  applyBaseStats();
  applyTechStats();
  resetLandmarks();
  player.armor = player.maxArmor;
  player.ammo = weapons[player.weaponIndex].clip;
  player.reserveAmmo = player.ammoCap;
  ensureWorldPopulated();
  rebuildUpgradePanel();
  updateHud();
  updateMenuButtons();
  updateCharacterSelection();
  ui.mainMenu.hidden = false;
  ui.pauseMenu.hidden = true;
  ui.deathScreen.hidden = true;
  requestAnimationFrame(frame);
}

init();
