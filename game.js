const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

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
  toast: document.getElementById("toast"),
  mainMenu: document.getElementById("mainMenu"),
  pauseMenu: document.getElementById("pauseMenu"),
  newGameButton: document.getElementById("newGameButton"),
  loadGameButton: document.getElementById("loadGameButton"),
  resumeButton: document.getElementById("resumeButton"),
  saveGameButton: document.getElementById("saveGameButton"),
  pauseLoadButton: document.getElementById("pauseLoadButton"),
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
const particles = [];
const drops = [];

const FRAME_SIZE = 128;
const spriteSheets = {};
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
  range: {
    name: "Signal Range",
    desc: "Push the perimeter deeper into the dead grid.",
    level: 0,
    max: 6,
    baseCost: 50
  },
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
  hp: 100,
  maxHp: 100,
  armor: 0,
  maxArmor: 0,
  stamina: 100,
  maxStamina: 100,
  speed: 190,
  scrap: 0,
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
  shotTimer: 0
};

let selectedCharacter = "male";

const world = {
  time: 0,
  nextSpawn: 0,
  nextCrate: 0,
  nextDropId: 1,
  messageTimer: 0,
  lootPrompt: null,
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

function resize() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * scale);
  canvas.height = Math.floor(window.innerHeight * scale);
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
  ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  ctx.drawImage(sheet.image, sx, 0, FRAME_SIZE, FRAME_SIZE, -drawW / 2, -drawH + 25 * scale, drawW, drawH);
  ctx.restore();
  return true;
}

function unlockedRadius() {
  return 640 + tech.range.level * 360;
}

function currentZone() {
  return Math.max(1, Math.floor(Math.hypot(player.x, player.y) / 430) + 1);
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

function rebuildUpgradePanel() {
  ui.upgradeList.innerHTML = "";
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

function terrainAt(x, y) {
  const river = Math.abs(y - riverCenter(x));
  if (river < 70 && !isBridgeTile(x, y)) return "water";
  if (isBridgeTile(x, y)) return "bridge";
  if (isInAnySafeZone(x, y, 74)) return "camp";
  if (Math.abs(x) < 54 && y > -60 && y < riverCenter(x) + 40) return "path";
  if (Math.abs(y + 330 + Math.sin(x * 0.003) * 42) < 50) return "road";
  if (x < -820 || y < -780) return "forest";
  if (x > 980 || y > 980) return "dry";
  return "grass";
}

function spawnCrate() {
  const maxR = Math.max(260, unlockedRadius() - 120);
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
    const maxRadius = Math.max(850, unlockedRadius() + 120);
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
  let found = null;
  for (const crate of crates) {
    if (!crate.looted && dist(player.x, player.y, crate.x, crate.y) < 54) {
      found = crate;
      break;
    }
  }
  if (found) {
    found.looted = true;
    const scrap = Math.round(rand(18, 34) * found.zone);
    const ammo = Math.round(rand(8, 18) + found.zone * 4);
    const med = Math.random() > 0.64;
    player.scrap += scrap;
    player.reserveAmmo = clamp(player.reserveAmmo + ammo, 0, player.ammoCap);
    if (med) player.hp = clamp(player.hp + 28, 0, player.maxHp);
    addHitParticles(found.x, found.y, "#d8b75f", 10);
    flash(`Looted ${scrap} scrap and ${ammo} ammo${med ? ", patched wounds" : ""}`);
    rebuildUpgradePanel();
    saveProgress();
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
  if (drop.kind === "scrap") player.scrap += drop.amount;
  if (drop.kind === "ammo") player.reserveAmmo = clamp(player.reserveAmmo + drop.amount, 0, player.ammoCap);
  drops.splice(index, 1);
  rebuildUpgradePanel();
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
    xp: player.xp,
    level: player.level,
    weaponIndex: player.weaponIndex,
    player: {
      character: player.character,
      x: player.x,
      y: player.y,
      hp: player.hp,
      armor: player.armor,
      stamina: player.stamina,
      ammo: player.ammo,
      reserveAmmo: player.reserveAmmo
    },
    world: {
      time: world.time,
      nextSpawn: world.nextSpawn,
      nextCrate: world.nextCrate,
      nextDropId: world.nextDropId
    },
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
    drops: drops.map((drop) => ({
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
    player.alive = true;
    player.reloading = 0;
    player.invulnerable = 0.8;
    player.shotTimer = 0;

    world.time = Number(data.world?.time) || 0;
    world.nextSpawn = Number(data.world?.nextSpawn) || 0;
    world.nextCrate = Number(data.world?.nextCrate) || 0;
    world.nextDropId = Number(data.world?.nextDropId) || 1;
    bullets.length = 0;
    particles.length = 0;
    zombies.length = 0;
    crates.length = 0;
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
    (data.drops || []).forEach((drop) => drops.push(drop));
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
  player.xp = 0;
  player.level = 1;
  player.weaponIndex = 0;
  player.character = validCharacter(selectedCharacter);
  world.time = 0;
  world.nextSpawn = 0;
  world.nextCrate = 0;
  world.nextDropId = 1;
  applyTechStats();
  restartRun(false);
  updateMenuButtons();
}

function ensureWorldPopulated() {
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

function restartRun(showMessage = true) {
  player.x = 0;
  player.y = 0;
  player.hp = player.maxHp;
  player.armor = player.maxArmor;
  player.stamina = player.maxStamina;
  player.ammo = weapons[player.weaponIndex].clip;
  player.reserveAmmo = player.ammoCap;
  player.reloading = 0;
  player.alive = true;
  player.invulnerable = 1;
  player.shotTimer = 0;
  world.state = "playing";
  bullets.length = 0;
  zombies.length = 0;
  crates.length = 0;
  particles.length = 0;
  drops.length = 0;
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
  ui.deathScreen.hidden = true;
  mouse.down = false;
  updateHud();
  flash(fromSave ? "Save loaded" : "New run started");
}

function openNewGameMenu() {
  world.state = "menu";
  ui.mainMenu.hidden = false;
  ui.pauseMenu.hidden = true;
  ui.deathScreen.hidden = true;
  mouse.down = false;
  updateMenuButtons();
}

function pauseGame() {
  if (world.state !== "playing") return;
  world.state = "paused";
  ui.pauseMenu.hidden = false;
  mouse.down = false;
  updateMenuButtons();
}

function resumeGame() {
  if (world.state !== "paused") return;
  world.state = "playing";
  ui.pauseMenu.hidden = true;
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
  ui.deathScreen.hidden = true;
  mouse.down = false;
  flash("Save loaded");
}

function saveFromPause() {
  saveProgress();
  flash("Game saved");
}

function quitToMainMenu() {
  saveProgress();
  world.state = "menu";
  ui.mainMenu.hidden = false;
  ui.pauseMenu.hidden = true;
  ui.deathScreen.hidden = true;
  mouse.down = false;
  updateMenuButtons();
}

function updateMenuButtons() {
  const enabled = hasSave();
  ui.loadGameButton.disabled = !enabled;
  ui.pauseLoadButton.disabled = !enabled;
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
    updateHud();
    return;
  }

  world.time += dt;

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
  updateSpawns(dt);
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
  if (moving) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
    if (Math.abs(dx) > 0.12) player.facing = dx > 0 ? 1 : -1;
    const exhausted = player.stamina <= 4;
    const speed = player.speed * (exhausted ? 0.55 : 1);
    const nextX = player.x + dx * speed * dt;
    const nextY = player.y + dy * speed * dt;
    if (canStandAt(nextX, player.y)) player.x = nextX;
    if (canStandAt(player.x, nextY)) player.y = nextY;
    player.stamina = clamp(player.stamina - 10 * dt, 0, player.maxStamina);
  } else {
    player.stamina = clamp(player.stamina + 24 * dt, 0, player.maxStamina);
  }

  const d = Math.hypot(player.x, player.y);
  const gate = unlockedRadius();
  if (d > gate) {
    player.x = (player.x / d) * gate;
    player.y = (player.y / d) * gate;
    flash("Perimeter limit reached");
  }

  const safeZone = getSafeZoneAt(player.x, player.y);
  if (safeZone) {
    player.hp = clamp(player.hp + 7 * dt, 0, player.maxHp);
    player.armor = clamp(player.armor + 9 * dt, 0, player.maxArmor);
    player.stamina = clamp(player.stamina + 34 * dt, 0, player.maxStamina);
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
              spawnDrop(zombie.x, zombie.y, Math.random() > 0.5 ? "ammo" : "scrap", Math.round(rand(5, 14)));
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

    const limit = unlockedRadius() + 100;
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
  for (const crate of crates) {
    if (!crate.looted && dist(player.x, player.y, crate.x, crate.y) < 54) {
      world.lootPrompt = { x: crate.x, y: crate.y - 34, label: "E" };
      break;
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
  const zone = currentZone();
  const pressure = Math.min(1.2, world.time / 240);
  const targetPopulation = 7 + zone * 3 + tech.range.level * 2;
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
  ui.scrapText.textContent = `${player.scrap} scrap`;
  ui.runStatus.textContent = `Zone ${currentZone()} - ${Math.round(Math.hypot(player.x, player.y))}m`;
  ui.levelText.textContent = `Level ${player.level} - ${player.xp}/${player.level * 60} XP`;
  ui.distanceText.textContent = `Range ${unlockedRadius()}m`;
}

function draw() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawGround();
  drawSceneryProps();
  drawGate();
  drawBase();
  drawCrates();
  drawDrops();
  drawBullets();
  drawZombies();
  drawPlayer();
  drawParticles();
  drawPrompt();
  drawMinimap();
}

function drawGround() {
  const tile = 32;
  const startX = Math.floor((camera.x - window.innerWidth / 2) / tile) * tile;
  const startY = Math.floor((camera.y - window.innerHeight / 2) / tile) * tile;
  const endX = camera.x + window.innerWidth / 2 + tile;
  const endY = camera.y + window.innerHeight / 2 + tile;

  ctx.fillStyle = "#263d24";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  for (let x = startX; x < endX; x += tile) {
    for (let y = startY; y < endY; y += tile) {
      const screen = worldToScreen(x, y);
      const hash = hash2(x, y);
      const sx = Math.floor(screen.x);
      const sy = Math.floor(screen.y);
      const terrain = terrainAt(x + tile / 2, y + tile / 2);
      if (terrain === "water") {
        const shimmer = Math.sin(world.time * 1.8 + x * 0.035 + y * 0.02) * 0.5 + 0.5;
        ctx.fillStyle = shimmer > 0.62 ? "#319a82" : hash > 0.55 ? "#2f8f7a" : "#267a6f";
      } else if (terrain === "bridge") {
        ctx.fillStyle = hash > 0.5 ? "#8a6743" : "#765638";
      } else if (terrain === "path") {
        ctx.fillStyle = hash > 0.5 ? "#b99d68" : "#a88c5d";
      } else if (terrain === "road") {
        ctx.fillStyle = hash > 0.5 ? "#565a54" : "#4b504b";
      } else if (terrain === "forest") {
        ctx.fillStyle = hash > 0.6 ? "#213a23" : "#1c321e";
      } else if (terrain === "dry") {
        ctx.fillStyle = hash > 0.58 ? "#9a894f" : "#877947";
      } else if (terrain === "camp") {
        ctx.fillStyle = hash > 0.56 ? "#526d38" : "#496333";
      } else {
        ctx.fillStyle = hash > 0.78 ? "#31502b" : hash > 0.46 ? "#2c4728" : "#263d24";
      }
      ctx.fillRect(sx, sy, tile, tile);

      if (terrain === "water") {
        const wave = Math.floor((world.time * 18 + hash * 16) % 18);
        ctx.fillStyle = "rgba(194, 235, 213, 0.18)";
        ctx.fillRect(sx + ((wave + Math.floor(hash * 7)) % 9), sy + 5 + Math.floor(hash * 12), 18, 2);
        ctx.fillStyle = "rgba(34, 85, 78, 0.18)";
        ctx.fillRect(sx, sy + tile - 5 - Math.floor(wave / 5), tile, 2);
        continue;
      }

      if (terrain === "bridge") {
        ctx.fillStyle = "rgba(45, 28, 18, 0.34)";
        ctx.fillRect(sx, sy + 4, tile, 3);
        ctx.fillRect(sx, sy + 22, tile, 3);
        ctx.fillStyle = "#513b2b";
        ctx.fillRect(sx + 4, sy, 4, tile);
        ctx.fillRect(sx + tile - 8, sy, 4, tile);
        continue;
      }

      if (terrain === "road" && hash > 0.72) {
        ctx.fillStyle = "#2f352f";
        ctx.fillRect(sx + 4, sy + 14, 9, 3);
        ctx.fillRect(sx + 20, sy + 7, 6, 4);
      }

      ctx.fillStyle = terrain === "dry" ? "rgba(91, 77, 42, 0.22)" : "rgba(18, 36, 18, 0.22)";
      ctx.fillRect(sx, sy + tile - 4, tile, 4);
      ctx.fillStyle = terrain === "dry" ? "rgba(184, 162, 84, 0.16)" : "rgba(96, 137, 67, 0.18)";
      ctx.fillRect(sx, sy, tile, 4);

      const bladeHash = hash2(x + 19, y - 7, 2);
      if ((terrain === "grass" || terrain === "forest" || terrain === "camp") && bladeHash > 0.18) {
        ctx.fillStyle = bladeHash > 0.72 ? "#557b39" : "#3f662f";
        ctx.fillRect(sx + 5, sy + 9, 4, 11);
        ctx.fillRect(sx + 11, sy + 5, 3, 8);
        ctx.fillRect(sx + 22, sy + 15, 5, 10);
      }

      if ((terrain === "grass" || terrain === "dry") && hash > 0.9) {
        ctx.fillStyle = "#5a4930";
        ctx.fillRect(sx + 7, sy + 20, 9, 5);
        ctx.fillRect(sx + 18, sy + 8, 5, 4);
      }
    }
  }

  ctx.strokeStyle = "rgba(237, 242, 223, 0.025)";
  ctx.lineWidth = 1;
  for (let x = startX; x < endX; x += tile) {
    const screen = worldToScreen(x, 0);
    ctx.beginPath();
    ctx.moveTo(Math.floor(screen.x), 0);
    ctx.lineTo(Math.floor(screen.x), window.innerHeight);
    ctx.stroke();
  }
  for (let y = startY; y < endY; y += tile) {
    const screen = worldToScreen(0, y);
    ctx.beginPath();
    ctx.moveTo(0, Math.floor(screen.y));
    ctx.lineTo(window.innerWidth, Math.floor(screen.y));
    ctx.stroke();
  }
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
      if (isInAnySafeZone(centerX, centerY, 150) || terrain === "water" || terrain === "bridge" || terrain === "path") continue;

      const screen = worldToScreen(centerX + (hash2(x, y, 9) - 0.5) * 54, centerY + (hash2(x, y, 10) - 0.5) * 54);
      if (terrain === "forest" && h > 0.28) {
        drawTree(screen.x, screen.y, h);
      } else if (terrain === "grass" && h > 0.82) {
        drawBush(screen.x, screen.y, h);
      } else if (terrain === "road" && h > 0.7) {
        drawBrokenCar(screen.x, screen.y, h);
      } else if (terrain === "dry" && h > 0.72) {
        drawRubble(screen.x, screen.y, h);
      }
    }
  }
}

function drawTree(x, y, seed) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(Math.floor(x - 26), Math.floor(y + 20), 54, 10);
  ctx.fillStyle = "#4d321f";
  ctx.fillRect(Math.floor(x - 9), Math.floor(y - 8), 18, 44);
  ctx.fillStyle = "#2f4e27";
  ctx.fillRect(Math.floor(x - 35), Math.floor(y - 52), 70, 34);
  ctx.fillRect(Math.floor(x - 48), Math.floor(y - 32), 96, 34);
  ctx.fillStyle = seed > 0.6 ? "#3f642e" : "#36582b";
  ctx.fillRect(Math.floor(x - 28), Math.floor(y - 65), 58, 30);
  ctx.fillRect(Math.floor(x - 42), Math.floor(y - 42), 36, 26);
  ctx.fillRect(Math.floor(x + 8), Math.floor(y - 43), 36, 27);
  ctx.fillStyle = "#1c321e";
  ctx.fillRect(Math.floor(x - 43), Math.floor(y - 18), 20, 7);
  ctx.fillRect(Math.floor(x + 22), Math.floor(y - 16), 18, 7);
}

function drawBush(x, y, seed) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(Math.floor(x - 18), Math.floor(y + 8), 36, 6);
  ctx.fillStyle = seed > 0.5 ? "#4f7835" : "#456f31";
  ctx.fillRect(Math.floor(x - 18), Math.floor(y - 8), 36, 18);
  ctx.fillStyle = "#5c8940";
  ctx.fillRect(Math.floor(x - 8), Math.floor(y - 16), 22, 14);
  ctx.fillRect(Math.floor(x - 25), Math.floor(y - 2), 17, 12);
}

function drawRubble(x, y, seed) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  ctx.fillRect(Math.floor(x - 20), Math.floor(y + 8), 44, 7);
  ctx.fillStyle = "#6b6f68";
  ctx.fillRect(Math.floor(x - 18), Math.floor(y - 5), 22, 15);
  ctx.fillStyle = "#8a887c";
  ctx.fillRect(Math.floor(x + 4), Math.floor(y - 13), 24, 20);
  ctx.fillStyle = "#55443a";
  ctx.fillRect(Math.floor(x - 29), Math.floor(y + 1), 12, 9);
  if (seed > 0.55) {
    ctx.fillStyle = "#9d8d5b";
    ctx.fillRect(Math.floor(x + 27), Math.floor(y - 2), 9, 8);
  }
}

function drawBrokenCar(x, y, seed) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.27)";
  ctx.fillRect(Math.floor(x - 31), Math.floor(y + 15), 64, 9);
  ctx.fillStyle = seed > 0.5 ? "#733e37" : "#4f6670";
  ctx.fillRect(Math.floor(x - 30), Math.floor(y - 10), 60, 27);
  ctx.fillStyle = "#252b2f";
  ctx.fillRect(Math.floor(x - 14), Math.floor(y - 21), 26, 14);
  ctx.fillStyle = "#1a1d1f";
  ctx.fillRect(Math.floor(x - 24), Math.floor(y + 13), 12, 12);
  ctx.fillRect(Math.floor(x + 13), Math.floor(y + 13), 12, 12);
  ctx.fillStyle = "#9a8b64";
  ctx.fillRect(Math.floor(x + 27), Math.floor(y - 4), 8, 5);
  ctx.fillStyle = "#2f3538";
  ctx.fillRect(Math.floor(x - 4), Math.floor(y - 18), 17, 9);
}

function drawGate() {
  const center = worldToScreen(0, 0);
  ctx.save();
  ctx.strokeStyle = "rgba(216, 183, 95, 0.44)";
  ctx.setLineDash([12, 12]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center.x, center.y, unlockedRadius(), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBase() {
  safeZones.forEach((zone) => drawSafeZoneCamp(zone));
}

function drawSafeZoneCamp(zone) {
  const base = worldToScreen(zone.x, zone.y);
  ctx.save();
  ctx.strokeStyle = "rgba(90, 160, 106, 0.48)";
  ctx.setLineDash([8, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(base.x, base.y, zone.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#2a3c39";
  ctx.fillRect(Math.floor(base.x - 44), Math.floor(base.y - 38), 88, 74);
  ctx.fillStyle = zone.id === "base" ? "#52665f" : "#5d6049";
  ctx.fillRect(Math.floor(base.x - 30), Math.floor(base.y - 26), 60, 48);
  ctx.fillStyle = "#d8b75f";
  ctx.fillRect(Math.floor(base.x - 7), Math.floor(base.y - 48), 14, 28);
  ctx.fillStyle = "#111515";
  ctx.fillRect(Math.floor(base.x - 7), Math.floor(base.y - 3), 14, 25);
  ctx.fillStyle = "#80664a";
  ctx.fillRect(Math.floor(base.x + 31), Math.floor(base.y + 12), 28, 10);
  ctx.fillStyle = "#29302b";
  ctx.fillRect(Math.floor(base.x + 37), Math.floor(base.y - 10), 13, 22);
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

function drawDrops() {
  for (const drop of drops) {
    const s = worldToScreen(drop.x, drop.y);
    ctx.fillStyle = drop.kind === "ammo" ? "#d8b75f" : "#aeb8a6";
    ctx.fillRect(Math.floor(s.x - 6), Math.floor(s.y - 6), 12, 12);
    ctx.fillStyle = "#111515";
    ctx.fillRect(Math.floor(s.x - 2), Math.floor(s.y - 6), 4, 12);
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
  const action = player.reloading > 0 ? "reload" : player.shotTimer > 0 ? "shoot" : moving ? "walk" : "idle";
  const sheet = getSpriteSheet(set, action);
  const fps = action === "reload" ? 12 : action === "shoot" ? 18 : moving ? 10 : 5;
  const frame = Math.floor(world.time * fps);
  const walk = moving ? Math.sin(world.time * 15) : 0;
  const bob = moving ? Math.abs(Math.sin(world.time * 15)) * 2 : Math.sin(world.time * 3) * 0.9;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(Math.floor(s.x - 20), Math.floor(s.y + 39), 42, 7);
  const drewSprite = drawSpriteSheetFrame(sheet, frame, s.x, s.y + 22 + bob, 0.66, facing);
  if (drewSprite) {
    ctx.restore();
    return;
  }

  ctx.translate(Math.floor(s.x), Math.floor(s.y + bob));
  ctx.scale(facing, 1);
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

function drawMinimap() {
  const size = 132;
  const x = window.innerWidth - size - 18;
  const y = 92;
  const radius = unlockedRadius();
  ctx.fillStyle = "rgba(14, 18, 18, 0.78)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(237, 242, 223, 0.18)";
  ctx.strokeRect(x, y, size, size);
  ctx.strokeStyle = "rgba(216, 183, 95, 0.62)";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#5b93a8";
  ctx.fillRect(
    x + size / 2 + (player.x / radius) * (size / 2 - 12) - 3,
    y + size / 2 + (player.y / radius) * (size / 2 - 12) - 3,
    6,
    6
  );
  ctx.fillStyle = "#5aa06a";
  for (const zone of safeZones) {
    const zx = x + size / 2 + (zone.x / radius) * (size / 2 - 12);
    const zy = y + size / 2 + (zone.y / radius) * (size / 2 - 12);
    if (zx < x + 4 || zx > x + size - 4 || zy < y + 4 || zy > y + size - 4) continue;
    ctx.fillRect(Math.floor(zx - 3), Math.floor(zy - 3), 6, 6);
  }
  for (const zombie of zombies) {
    const zx = x + size / 2 + (zombie.x / radius) * (size / 2 - 12);
    const zy = y + size / 2 + (zombie.y / radius) * (size / 2 - 12);
    if (zx < x + 4 || zx > x + size - 4 || zy < y + 4 || zy > y + size - 4) continue;
    ctx.fillStyle = zombie.aggro ? "#dc5148" : "#7aa354";
    ctx.fillRect(Math.floor(zx - 2), Math.floor(zy - 2), 4, 4);
  }
}

function initInput() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "e", "r", "b", "p", "escape", "1", "2", "3"].includes(key)) event.preventDefault();
    if (key === "escape" || key === "p") {
      togglePause();
      return;
    }
    if (world.state !== "playing") return;
    if (key === "e") lootNearby();
    if (key === "r") reload();
    if (key === "b") ui.upgradePanel.classList.toggle("collapsed");
    if (key === "1" && weapons[0].unlock()) player.weaponIndex = 0;
    if (key === "2" && weapons[1].unlock()) player.weaponIndex = 1;
    if (key === "3" && weapons[2].unlock()) player.weaponIndex = 2;
    keys.add(key);
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener("mousemove", (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });

  window.addEventListener("mousedown", (event) => {
    if (world.state !== "playing") return;
    if (event.target.closest(".panel, .death-screen, .menu-screen")) return;
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
  ui.restartButton.addEventListener("click", restartRun);
  ui.newGameButton.addEventListener("click", () => startGame(false));
  ui.loadGameButton.addEventListener("click", loadGameFromMenu);
  ui.resumeButton.addEventListener("click", resumeGame);
  ui.saveGameButton.addEventListener("click", saveFromPause);
  ui.pauseLoadButton.addEventListener("click", loadGameFromMenu);
  ui.pauseNewButton.addEventListener("click", openNewGameMenu);
  ui.quitGameButton.addEventListener("click", quitToMainMenu);
  ui.characterButtons.forEach((button) => {
    button.addEventListener("click", () => setSelectedCharacter(button.dataset.character));
  });
  [ui.upgradePanel, ui.deathScreen, ui.mainMenu, ui.pauseMenu].forEach((element) => {
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
  initInput();
  applyTechStats();
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
