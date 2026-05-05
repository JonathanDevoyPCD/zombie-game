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
  invulnerable: 0
};

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

function dist(a, b, c, d) {
  return Math.hypot(a - c, b - d);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function unlockedRadius() {
  return 640 + tech.range.level * 360;
}

function currentZone() {
  return Math.max(1, Math.floor(Math.hypot(player.x, player.y) / 430) + 1);
}

function isPlayerInSafeZone() {
  return Math.hypot(player.x, player.y) <= SAFE_ZONE_RADIUS;
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
  for (let tries = 0; tries < 18; tries += 1) {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(360, unlockedRadius() + 80);
    x = Math.cos(angle) * radius;
    y = Math.sin(angle) * radius;
    if (dist(x, y, player.x, player.y) > 360 && Math.hypot(x, y) > 180) break;
  }

  const zone = Math.floor(Math.hypot(x, y) / 430) + 1;
  const roll = Math.random();
  const type = zone >= 3 && roll > 0.78 ? "brute" : zone >= 2 && roll > 0.52 ? "runner" : "walker";
  const profile = {
    walker: { hp: 38, speed: 72, damage: 12, size: 15, color: "#5f8f45" },
    runner: { hp: 28, speed: 126, damage: 10, size: 13, color: "#7aa354" },
    brute: { hp: 95, speed: 58, damage: 22, size: 22, color: "#486f3b" }
  }[type];

  const scale = 1 + zone * 0.12 + world.time * 0.002;
  zombies.push({
    x,
    y,
    type,
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
  while (zombies.length < 16) spawnZombie();
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
    const exhausted = player.stamina <= 4;
    const speed = player.speed * (exhausted ? 0.55 : 1);
    player.x += dx * speed * dt;
    player.y += dy * speed * dt;
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

  const baseDistance = Math.hypot(player.x, player.y);
  if (baseDistance <= SAFE_ZONE_RADIUS) {
    player.hp = clamp(player.hp + 7 * dt, 0, player.maxHp);
    player.armor = clamp(player.armor + 9 * dt, 0, player.maxArmor);
    player.stamina = clamp(player.stamina + 34 * dt, 0, player.maxStamina);
  }

  player.invulnerable = Math.max(0, player.invulnerable - dt);
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
  const playerSafe = isPlayerInSafeZone();
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
    } else if (playerSafe && Math.hypot(zombie.x, zombie.y) < SAFE_ZONE_RADIUS + 150) {
      const awayFromBase = Math.atan2(zombie.y, zombie.x);
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
    zombie.x += (moveX / moveLength) * speed * dt;
    zombie.y += (moveY / moveLength) * speed * dt;

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
  const pressure = Math.min(1.6, world.time / 180);
  if (world.time > world.nextSpawn && zombies.length < 34 + currentZone() * 5) {
    spawnZombie();
    const zone = currentZone();
    world.nextSpawn = world.time + Math.max(0.28, 1.45 - zone * 0.12 - pressure * 0.35);
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
      const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const sx = Math.floor(screen.x);
      const sy = Math.floor(screen.y);
      ctx.fillStyle = hash > 0.78 ? "#31502b" : hash > 0.46 ? "#2c4728" : "#263d24";
      ctx.fillRect(sx, sy, tile, tile);

      ctx.fillStyle = "rgba(18, 36, 18, 0.22)";
      ctx.fillRect(sx, sy + tile - 4, tile, 4);
      ctx.fillStyle = "rgba(96, 137, 67, 0.18)";
      ctx.fillRect(sx, sy, tile, 4);

      const bladeHash = Math.abs(Math.sin((x + 19) * 41.13 + (y - 7) * 9.71) * 9317.21) % 1;
      if (bladeHash > 0.18) {
        ctx.fillStyle = bladeHash > 0.72 ? "#557b39" : "#3f662f";
        ctx.fillRect(sx + 5, sy + 9, 4, 11);
        ctx.fillRect(sx + 11, sy + 5, 3, 8);
        ctx.fillRect(sx + 22, sy + 15, 5, 10);
      }

      if (hash > 0.9) {
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
  const base = worldToScreen(0, 0);
  ctx.fillStyle = "#2a3c39";
  ctx.fillRect(Math.floor(base.x - 48), Math.floor(base.y - 48), 96, 96);
  ctx.fillStyle = "#52665f";
  ctx.fillRect(Math.floor(base.x - 32), Math.floor(base.y - 30), 64, 60);
  ctx.fillStyle = "#d8b75f";
  ctx.fillRect(Math.floor(base.x - 8), Math.floor(base.y - 52), 16, 34);
  ctx.fillStyle = "#111515";
  ctx.fillRect(Math.floor(base.x - 8), Math.floor(base.y - 4), 16, 34);
  ctx.strokeStyle = "rgba(90, 160, 106, 0.44)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(base.x, base.y, SAFE_ZONE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
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
    ctx.fillStyle = zombie.hitFlash > 0 ? "#e2f0c4" : zombie.color;
    ctx.fillRect(Math.floor(s.x - zombie.radius), Math.floor(s.y - zombie.radius), zombie.radius * 2, zombie.radius * 2);
    ctx.fillStyle = "#263622";
    ctx.fillRect(Math.floor(s.x - zombie.radius + 4), Math.floor(s.y - zombie.radius - 5), zombie.radius * 2 - 8, 4);
    ctx.fillStyle = "#a74b44";
    ctx.fillRect(
      Math.floor(s.x - zombie.radius + 4),
      Math.floor(s.y - zombie.radius - 5),
      Math.floor((zombie.radius * 2 - 8) * (zombie.hp / zombie.maxHp)),
      4
    );
    ctx.fillStyle = "#1a211e";
    ctx.fillRect(Math.floor(s.x - 5), Math.floor(s.y - 3), 3, 3);
    ctx.fillRect(Math.floor(s.x + 4), Math.floor(s.y - 3), 3, 3);
  }
}

function drawPlayer() {
  const s = worldToScreen(player.x, player.y);
  const angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  const flicker = player.invulnerable > 0 && Math.floor(world.time * 24) % 2 === 0;
  if (flicker) return;

  ctx.save();
  ctx.translate(Math.floor(s.x), Math.floor(s.y));
  ctx.rotate(angle);
  ctx.fillStyle = "#5b93a8";
  ctx.fillRect(-13, -11, 25, 22);
  ctx.fillStyle = "#d9b58a";
  ctx.fillRect(4, -7, 13, 14);
  ctx.fillStyle = "#222927";
  ctx.fillRect(12, -4, 23, 8);
  ctx.fillStyle = "#edf2df";
  ctx.fillRect(28, -2, 8, 4);
  ctx.restore();
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
  ctx.fillRect(x + size / 2 - 3, y + size / 2 - 3, 6, 6);
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
  ui.pauseNewButton.addEventListener("click", () => startGame(false));
  ui.quitGameButton.addEventListener("click", quitToMainMenu);
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
  initInput();
  applyTechStats();
  player.armor = player.maxArmor;
  player.ammo = weapons[player.weaponIndex].clip;
  player.reserveAmmo = player.ammoCap;
  ensureWorldPopulated();
  rebuildUpgradePanel();
  updateHud();
  updateMenuButtons();
  ui.mainMenu.hidden = false;
  ui.pauseMenu.hidden = true;
  ui.deathScreen.hidden = true;
  requestAnimationFrame(frame);
}

init();
