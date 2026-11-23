// Player state, on-foot locomotion, vehicle hijacking/entering, weapons, pickups, and hospital respawn.

import { PLAYER_CONFIG, WEAPONS } from './config.js';
import { resolveCircleWorld } from './city.js';
import { applyVehicleControls } from './vehicles.js';
import { clamp, dist } from './random.js';

export function createPlayer(x = 3090, y = 1540) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    radius: PLAYER_CONFIG.radius,
    health: PLAYER_CONFIG.maxHealth,
    maxHealth: PLAYER_CONFIG.maxHealth,
    armor: 25,
    maxArmor: PLAYER_CONFIG.maxArmor,
    stamina: PLAYER_CONFIG.maxStamina,
    money: 450,
    vehicle: null,
    walkCycle: 0,
    moving: false,
    sprinting: false,
    weaponIndex: 0,
    ammo: WEAPONS.map((w) => ({
      mag: w.magSize,
      reserve: w.startAmmo,
    })),
    fireCooldown: 0,
    reloadTimer: 0,
    muzzleFlash: 0,
    hitFlash: 0,
    dead: false,
    respawnTimer: 0,
    nearVehicle: null,
  };
}

export function getActiveWeapon(player) {
  return WEAPONS[player.weaponIndex] || WEAPONS[0];
}

export function updatePlayer(state, dt) {
  const { player, input, city, vehicles, camera } = state;

  if (player.hitFlash > 0) player.hitFlash = Math.max(0, player.hitFlash - dt * 3.5);
  if (player.muzzleFlash > 0) player.muzzleFlash = Math.max(0, player.muzzleFlash - dt * 14);
  if (player.fireCooldown > 0) player.fireCooldown = Math.max(0, player.fireCooldown - dt);

  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0 || input.wasPressed('Enter') || input.wasPressed('Space')) {
      respawnPlayer(state);
    }
    return;
  }

  // Weapon switching (1/2/3 or Q)
  if (input.wasPressed('Digit1')) switchWeapon(player, 0, state.audio);
  if (input.wasPressed('Digit2')) switchWeapon(player, 1, state.audio);
  if (input.wasPressed('Digit3')) switchWeapon(player, 2, state.audio);
  if (input.wasPressed('KeyQ')) switchWeapon(player, (player.weaponIndex + 1) % WEAPONS.length, state.audio);

  // Reload handling
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      finishReload(player);
    }
  } else if (input.wasPressed('KeyR')) {
    startReload(player, state.audio);
  }

  // Vehicle enter / exit toggle (E)
  player.nearVehicle = player.vehicle ? null : findNearestVehicle(player, vehicles);
  if (input.wasPressed('KeyE')) {
    if (player.vehicle) {
      exitVehicle(state);
    } else if (player.nearVehicle) {
      enterVehicle(state, player.nearVehicle);
    }
  }

  // Aim angle from camera-projected mouse position
  const worldMouseX = camera.x + input.mouseX;
  const worldMouseY = camera.y + input.mouseY;

  if (player.vehicle) {
    const v = player.vehicle;
    const drive = input.getDriveInputs();
    applyVehicleControls(v, drive, dt, state);
    player.x = v.x;
    player.y = v.y;
    player.vx = v.vx;
    player.vy = v.vy;
    player.angle = v.angle;
    player.moving = v.speed > 10;
    player.stamina = Math.min(player.maxStamina, player.stamina + 28 * dt);

    // Drive-by shooting from vehicle with mouse click
    if (input.mouseDown && player.fireCooldown <= 0 && player.reloadTimer <= 0) {
      const aimAngle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
      state.firePlayerWeapon(aimAngle);
    }
  } else {
    // On-foot movement
    const axes = input.getMoveAxes();
    const wantsSprint = input.isSprinting() && (axes.x !== 0 || axes.y !== 0) && player.stamina > 6;
    player.sprinting = wantsSprint;
    const speed = wantsSprint ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.walkSpeed;

    if (wantsSprint) {
      player.stamina = Math.max(0, player.stamina - 32 * dt);
    } else {
      player.stamina = Math.min(player.maxStamina, player.stamina + 24 * dt);
    }

    player.vx = axes.x * speed;
    player.vy = axes.y * speed;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.moving = axes.x !== 0 || axes.y !== 0;

    if (player.moving) {
      player.walkCycle += dt * (wantsSprint ? 14 : 9.5);
    }

    resolveCircleWorld(city, player, player.radius);

    // Push player gently out of parked/slow cars
    for (const v of vehicles) {
      const dx = player.x - v.x;
      const dy = player.y - v.y;
      const minDist = player.radius + v.radius * 0.88;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist * minDist && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = minDist - d;
        player.x += (dx / d) * push;
        player.y += (dy / d) * push;
        if (v.speed > 150 && v.hitCooldown <= 0) {
          v.hitCooldown = 0.65;
          state.damagePlayer(clamp(v.speed * 0.075, 10, 32));
        }
      }
    }

    player.angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);

    if (input.mouseDown && player.fireCooldown <= 0 && player.reloadTimer <= 0) {
      state.firePlayerWeapon(player.angle);
    }
  }

  // Collect nearby pickups
  updatePickups(state, dt);
}

function switchWeapon(player, idx, audio) {
  if (idx === player.weaponIndex || idx < 0 || idx >= WEAPONS.length) return;
  player.weaponIndex = idx;
  player.reloadTimer = 0;
  audio.playUiBlip(480 + idx * 90, 0.06);
}

export function startReload(player, audio) {
  const w = getActiveWeapon(player);
  const slot = player.ammo[player.weaponIndex];
  if (player.reloadTimer > 0 || slot.mag >= w.magSize || slot.reserve <= 0) return;
  player.reloadTimer = w.reloadTime;
  audio.playUiBlip(310, 0.08, 'triangle');
}

function finishReload(player) {
  const w = getActiveWeapon(player);
  const slot = player.ammo[player.weaponIndex];
  const need = w.magSize - slot.mag;
  const take = Math.min(need, slot.reserve);
  slot.mag += take;
  slot.reserve -= take;
  player.reloadTimer = 0;
}

export function findNearestVehicle(player, vehicles) {
  let best = null;
  let bestDist = PLAYER_CONFIG.enterVehicleDist;
  for (const v of vehicles) {
    if (v.destroyed) continue;
    const d = dist(player.x, player.y, v.x, v.y);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

export function enterVehicle(state, vehicle) {
  const { player } = state;
  const wasOccupied = vehicle.driver === 'traffic' || vehicle.driver === 'police';
  const wasPolice = vehicle.isPolice;

  vehicle.driver = 'player';
  vehicle.ai = null;
  vehicle.headlightsOn = true;
  if (wasPolice) vehicle.sirenOn = true;

  player.vehicle = vehicle;
  player.x = vehicle.x;
  player.y = vehicle.y;
  state.audio.playDoor();

  if (!vehicle.stolen) {
    vehicle.stolen = true;
    if (wasPolice) {
      state.reportCrime(45, 'Grand Theft Police Cruiser');
    } else if (wasOccupied) {
      state.reportCrime(24, 'Carjacking');
    } else {
      state.reportCrime(14, 'Grand Theft Auto');
    }
  }
}

export function exitVehicle(state) {
  const { player, city } = state;
  const v = player.vehicle;
  if (!v) return;

  const sideX = -Math.sin(v.angle) * (v.width * 0.85 + 14);
  const sideY = Math.cos(v.angle) * (v.width * 0.85 + 14);
  player.x = v.x + sideX;
  player.y = v.y + sideY;
  resolveCircleWorld(city, player, player.radius);

  v.driver = null;
  v.sirenOn = false;
  player.vehicle = null;
  state.audio.playDoor();
}

export function damagePlayer(state, amount) {
  const { player } = state;
  if (player.dead || amount <= 0) return;

  let remaining = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, remaining * 0.65);
    player.armor -= absorbed;
    remaining -= absorbed;
  }

  player.health = Math.max(0, player.health - remaining);
  player.hitFlash = 1;
  state.camera.shake = Math.max(state.camera.shake, 5.5);

  if (player.health <= 0) {
    player.dead = true;
    player.respawnTimer = 3.2;
    if (player.vehicle) {
      player.vehicle.driver = null;
      player.vehicle = null;
    }
    state.pushBanner('WASTED', 'Solara General patched you up (-$150)', '#ff4d6d', 3.4);
  }
}

export function respawnPlayer(state) {
  const { player, city } = state;
  const hosp = city.landmarks.hospital;
  player.dead = false;
  player.health = player.maxHealth;
  player.armor = 25;
  player.stamina = player.maxStamina;
  player.money = Math.max(0, player.money - 150);
  player.x = hosp.x;
  player.y = hosp.y;
  player.vx = 0;
  player.vy = 0;
  player.vehicle = null;
  player.reloadTimer = 0;

  // Clear heat on hospital respawn
  state.police.stars = 0;
  state.police.heat = 0;
  state.police.evadeTimer = 0;
  state.police.officers = [];
  state.police.heli = null;
  state.vehicles = state.vehicles.filter((v) => !v.isPolice);
}

function updatePickups(state, dt) {
  const { city, player } = state;
  for (const p of city.pickups) {
    if (!p.active) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) p.active = true;
      continue;
    }
    if (dist(player.x, player.y, p.x, p.y) < 34) {
      if (p.kind === 'health' && player.health < player.maxHealth) {
        player.health = Math.min(player.maxHealth, player.health + 45);
        p.active = false;
        p.respawnTimer = 30;
        state.audio.playUiBlip(680, 0.12);
        state.addPopup(p.x, p.y - 16, '+45 HP', '#3effa8');
      } else if (p.kind === 'armor' && player.armor < player.maxArmor) {
        player.armor = player.maxArmor;
        p.active = false;
        p.respawnTimer = 40;
        state.audio.playUiBlip(740, 0.12);
        state.addPopup(p.x, p.y - 16, '+ARMOR', '#4cc9f0');
      } else if (p.kind === 'ammo') {
        player.ammo[0].reserve += 24;
        player.ammo[1].reserve += 60;
        player.ammo[2].reserve += 12;
        p.active = false;
        p.respawnTimer = 28;
        state.audio.playUiBlip(560, 0.12);
        state.addPopup(p.x, p.y - 16, '+AMMO', '#ffd166');
      }
    }
  }
}
