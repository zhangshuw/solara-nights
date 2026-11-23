// 5-star Wanted system, pursuit police cruisers, tactical enforcers, foot officers, and Air-1 helicopter with spotlight.

import {
  BOARDWALK_X,
  HORIZONTAL_ROADS,
  VERTICAL_ROADS,
  WANTED_CONFIG,
  WORLD_HEIGHT,
} from './config.js';
import { resolveCircleWorld, segmentHitsBuilding } from './city.js';
import { applyVehicleControls, createVehicle } from './vehicles.js';
import { angleDiff, clamp, dist } from './random.js';

export function createPoliceSystem() {
  return {
    stars: 0,
    heat: 0,
    evadeTimer: 0,
    evading: false,
    lastCrimeText: '',
    lastCrimeTimer: 0,
    spawnCooldown: 0,
    officers: [],
    heli: null,
  };
}

export function reportCrime(state, heatAmount, reason = '') {
  const police = state.police;
  if (state.player.dead) return;

  police.heat = clamp(police.heat + heatAmount, 0, WANTED_CONFIG.thresholds[5] + 40);
  if (reason) {
    police.lastCrimeText = reason;
    police.lastCrimeTimer = 3.0;
  }

  let newStars = police.stars;
  for (let s = 1; s <= WANTED_CONFIG.maxStars; s++) {
    if (police.heat >= WANTED_CONFIG.thresholds[s]) {
      newStars = Math.max(newStars, s);
    }
  }

  if (newStars > police.stars) {
    police.stars = newStars;
    state.audio.playUiBlip(540 + newStars * 70, 0.14, 'sawtooth');
  }
  police.evadeTimer = WANTED_CONFIG.evadeSeconds[police.stars] || 0;
  police.evading = false;
}

export function setWantedStars(state, stars) {
  const police = state.police;
  const clamped = clamp(Math.floor(stars), 0, WANTED_CONFIG.maxStars);
  police.stars = clamped;
  police.heat = WANTED_CONFIG.thresholds[clamped];
  police.evadeTimer = WANTED_CONFIG.evadeSeconds[clamped];
  police.evading = false;
}

export function updatePolice(state, dt) {
  const { police, player, city, vehicles } = state;

  if (police.lastCrimeTimer > 0) police.lastCrimeTimer = Math.max(0, police.lastCrimeTimer - dt);

  if (police.stars <= 0) {
    police.evading = false;
    police.evadeTimer = 0;
    police.heli = null;
    // Retire stray empty police cars gradually
    for (let i = police.officers.length - 1; i >= 0; i--) {
      if (dist(police.officers[i].x, police.officers[i].y, player.x, player.y) > 950) {
        police.officers.splice(i, 1);
      }
    }
    return;
  }

  // Count active police units & determine line of sight
  const policeCars = vehicles.filter((v) => v.isPolice && v.driver === 'police' && !v.destroyed);
  let spotted = false;

  for (const car of policeCars) {
    const d = dist(car.x, car.y, player.x, player.y);
    if (d < 540 && !segmentHitsBuilding(city, car.x, car.y, player.x, player.y)) {
      spotted = true;
      break;
    }
  }
  if (!spotted) {
    for (const off of police.officers) {
      if (!off.alive) continue;
      const d = dist(off.x, off.y, player.x, player.y);
      if (d < 440 && !segmentHitsBuilding(city, off.x, off.y, player.x, player.y)) {
        spotted = true;
        break;
      }
    }
  }
  if (!spotted && police.heli && dist(police.heli.spotX, police.heli.spotY, player.x, player.y) < 165) {
    spotted = true;
  }

  // Evasion timer & star decay
  if (spotted) {
    police.evading = false;
    police.evadeTimer = WANTED_CONFIG.evadeSeconds[police.stars];
  } else {
    police.evading = true;
    police.evadeTimer -= dt;
    if (police.evadeTimer <= 0) {
      police.stars = Math.max(0, police.stars - 1);
      police.heat = WANTED_CONFIG.thresholds[police.stars];
      if (police.stars > 0) {
        police.evadeTimer = WANTED_CONFIG.evadeSeconds[police.stars] * 0.72;
      } else {
        police.evading = false;
        police.heli = null;
        state.addPopup(player.x, player.y - 26, 'WANTED CLEARED', '#3effa8');
        state.audio.playUiBlip(740, 0.16);
      }
    }
  }

  // Spawn pursuit cruisers up to wanted star cap
  const maxCars = WANTED_CONFIG.maxPoliceCars[police.stars] || 0;
  police.spawnCooldown -= dt;
  if (policeCars.length < maxCars && police.spawnCooldown <= 0) {
    if (spawnPoliceCruiser(state)) {
      police.spawnCooldown = clamp(3.8 - police.stars * 0.45, 1.3, 3.6);
    } else {
      police.spawnCooldown = 0.8;
    }
  }

  // Update each police vehicle's pursuit & ramming AI
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const car = vehicles[i];
    if (!car.isPolice || car.driver !== 'police') continue;

    const d = dist(car.x, car.y, player.x, player.y);
    if (d > 1900) {
      vehicles.splice(i, 1);
      continue;
    }
    if (car.destroyed) {
      car.driver = null;
      continue;
    }

    car.sirenOn = true;
    car.headlightsOn = true;

    // Predict player position slightly for aggressive intercept/ramming
    const leadTime = clamp(d / 650, 0.1, 0.65);
    const aimX = player.x + player.vx * leadTime;
    const aimY = player.y + player.vy * leadTime;

    // Avoid buildings by steering along road corridors when blocked
    let targetX = aimX;
    let targetY = aimY;
    if (segmentHitsBuilding(city, car.x, car.y, aimX, aimY)) {
      const waypoint = pickRoadChasePoint(car, player);
      targetX = waypoint.x;
      targetY = waypoint.y;
    }

    const desiredAngle = Math.atan2(targetY - car.y, targetX - car.x);
    const diff = angleDiff(car.angle, desiredAngle);
    const steer = clamp(diff * 2.5, -1, 1);

    let throttle = 1;
    let handbrake = false;

    // If reversing out of a jam
    if (car.ai && car.ai.stuckTimer > 0.7) {
      throttle = -1;
      car.ai.unstuckTimer = 0.55;
      car.ai.stuckTimer = 0;
    }
    if (car.ai && car.ai.unstuckTimer > 0) {
      car.ai.unstuckTimer -= dt;
      throttle = -0.85;
    } else {
      if (Math.abs(diff) > 1.35 && car.speed > 130) {
        handbrake = true;
      }
      if (!player.vehicle && d < 185) {
        // Stop close to on-foot player and deploy officer
        throttle = -0.6;
        handbrake = true;
        if (car.speed < 45 && car.ai && !car.ai.deployed && police.officers.length < 2 + police.stars * 2) {
          car.ai.deployed = true;
          deployOfficerFromCar(state, car);
        }
      }
    }

    if (car.ai) {
      if (car.speed < 28 && d > 195) {
        car.ai.stuckTimer += dt;
      } else {
        car.ai.stuckTimer = Math.max(0, car.ai.stuckTimer - dt);
      }

      // High-star pursuit cars also fire from passenger window when close
      car.ai.fireCooldown -= dt;
      if (police.stars >= 2 && d < 390 && car.ai.fireCooldown <= 0 && !segmentHitsBuilding(city, car.x, car.y, player.x, player.y)) {
        const shotAngle = Math.atan2(player.y - car.y, player.x - car.x) + state.rng.range(-0.14, 0.14);
        state.fireEnemyBullet(car.x, car.y, shotAngle, 10, '#72efdd', 'police');
        car.ai.fireCooldown = clamp(1.45 - police.stars * 0.16, 0.55, 1.3);
      }
    }

    applyVehicleControls(car, { throttle, steer, handbrake }, dt, state);
  }

  // Update foot police officers
  for (let i = police.officers.length - 1; i >= 0; i--) {
    const off = police.officers[i];
    if (!off.alive) {
      off.deathTimer -= dt;
      if (off.deathTimer <= 0) police.officers.splice(i, 1);
      continue;
    }

    const d = dist(off.x, off.y, player.x, player.y);
    if (d > 1100) {
      police.officers.splice(i, 1);
      continue;
    }

    const toPlayer = Math.atan2(player.y - off.y, player.x - off.x);
    off.angle = toPlayer;
    off.fireCooldown -= dt;

    const blocked = segmentHitsBuilding(city, off.x, off.y, player.x, player.y);
    if (d > 210 || blocked) {
      off.x += Math.cos(toPlayer) * off.speed * dt;
      off.y += Math.sin(toPlayer) * off.speed * dt;
      off.walkPhase += dt * 10;
      resolveCircleWorld(city, off, off.radius);
    }

    if (d < 420 && !blocked && off.fireCooldown <= 0) {
      const spread = state.rng.range(-0.12, 0.12);
      state.fireEnemyBullet(
        off.x + Math.cos(toPlayer) * 14,
        off.y + Math.sin(toPlayer) * 14,
        toPlayer + spread,
        11,
        '#72efdd',
        'police',
      );
      off.muzzleFlash = 1;
      off.fireCooldown = clamp(1.15 - police.stars * 0.12, 0.48, 1.05);
    }
    if (off.muzzleFlash > 0) off.muzzleFlash = Math.max(0, off.muzzleFlash - dt * 14);
  }

  // Police Helicopter (Air-1) at 3+ stars
  if (police.stars >= WANTED_CONFIG.heliMinStars) {
    if (!police.heli) {
      police.heli = createPoliceHeli(player.x - 420, player.y - 360);
    }
    updatePoliceHeli(state, police.heli, dt);
  } else {
    police.heli = null;
  }
}

export function createPoliceHeli(x, y) {
  return {
    x,
    y,
    angle: 0,
    rotorAngle: 0,
    orbitAngle: 0,
    spotX: x + 120,
    spotY: y + 80,
    fireCooldown: 1.4,
    sirenPhase: 0,
  };
}

function updatePoliceHeli(state, heli, dt) {
  const { player, police } = state;
  heli.rotorAngle += dt * 26;
  heli.sirenPhase += dt * 8;
  heli.orbitAngle += dt * 0.52;

  const orbitR = 230;
  const targetX = player.x + Math.cos(heli.orbitAngle) * orbitR;
  const targetY = player.y + Math.sin(heli.orbitAngle) * orbitR;

  const dx = targetX - heli.x;
  const dy = targetY - heli.y;
  heli.x += dx * clamp(dt * 1.9, 0, 1);
  heli.y += dy * clamp(dt * 1.9, 0, 1);

  const desiredAngle = Math.atan2(player.y - heli.y, player.x - heli.x);
  heli.angle += angleDiff(heli.angle, desiredAngle) * clamp(dt * 3.2, 0, 1);

  // Searchlight sweeps tightly onto the player
  const swayX = Math.cos(heli.orbitAngle * 3.1) * 34;
  const swayY = Math.sin(heli.orbitAngle * 2.7) * 34;
  heli.spotX += (player.x + swayX - heli.spotX) * clamp(dt * 3.5, 0, 1);
  heli.spotY += (player.y + swayY - heli.spotY) * clamp(dt * 3.5, 0, 1);

  // At 4-5 stars, Air-1 fires bursts when spotlight locks on
  heli.fireCooldown -= dt;
  if (police.stars >= 4 && heli.fireCooldown <= 0 && dist(heli.spotX, heli.spotY, player.x, player.y) < 120) {
    const aim = Math.atan2(player.y - heli.y, player.x - heli.x) + state.rng.range(-0.1, 0.1);
    state.fireEnemyBullet(heli.x, heli.y, aim, 9, '#9bf6ff', 'police');
    heli.fireCooldown = police.stars >= 5 ? 0.42 : 0.72;
  }
}

export function spawnPoliceCruiser(state, forcedPos = null) {
  const { rng, vehicles, player, police } = state;

  if (forcedPos) {
    const typeId = police.stars >= 5 ? 'enforcer' : 'police';
    const car = createVehicle(typeId, forcedPos.x, forcedPos.y, forcedPos.angle, rng, {
      driver: 'police',
      sirenOn: true,
      ai: { stuckTimer: 0, unstuckTimer: 0, fireCooldown: 1.0, deployed: false },
    });
    vehicles.push(car);
    return car;
  }

  for (let attempt = 0; attempt < 16; attempt++) {
    const vertical = rng.chance(0.5);
    let x = 0;
    let y = 0;
    let angle = 0;
    if (vertical) {
      const road = rng.pick(VERTICAL_ROADS);
      x = road.x + rng.range(-24, 24);
      y = clamp(player.y + (rng.chance(0.5) ? 1 : -1) * rng.range(680, 980), 140, WORLD_HEIGHT - 140);
      angle = player.y > y ? Math.PI * 0.5 : -Math.PI * 0.5;
    } else {
      const road = rng.pick(HORIZONTAL_ROADS);
      x = clamp(player.x + (rng.chance(0.5) ? 1 : -1) * rng.range(680, 980), 160, BOARDWALK_X - 140);
      y = road.y + rng.range(-24, 24);
      angle = player.x > x ? 0 : Math.PI;
    }

    const d = dist(x, y, player.x, player.y);
    if (d < 580 || d > 1350) continue;
    let crowded = false;
    for (const v of vehicles) {
      if (dist(x, y, v.x, v.y) < 110) {
        crowded = true;
        break;
      }
    }
    if (crowded) continue;

    const typeId = police.stars >= 4 && rng.chance(0.32) ? 'enforcer' : 'police';
    const car = createVehicle(typeId, x, y, angle, rng, {
      driver: 'police',
      sirenOn: true,
      ai: { stuckTimer: 0, unstuckTimer: 0, fireCooldown: 1.2, deployed: false },
    });
    car.vx = Math.cos(angle) * 180;
    car.vy = Math.sin(angle) * 180;
    vehicles.push(car);
    return car;
  }
  return null;
}

function deployOfficerFromCar(state, car) {
  const sideX = -Math.sin(car.angle) * (car.width * 0.8 + 14);
  const sideY = Math.cos(car.angle) * (car.width * 0.8 + 14);
  state.police.officers.push({
    x: car.x + sideX,
    y: car.y + sideY,
    angle: Math.atan2(state.player.y - car.y, state.player.x - car.x),
    radius: 12,
    hp: 65,
    maxHp: 65,
    speed: 145,
    fireCooldown: 0.5,
    muzzleFlash: 0,
    walkPhase: 0,
    alive: true,
    deathTimer: 0,
  });
}

function pickRoadChasePoint(car, player) {
  let bestVR = VERTICAL_ROADS[0];
  let minVD = Infinity;
  for (const vr of VERTICAL_ROADS) {
    const d = Math.abs(car.x - vr.x);
    if (d < minVD) {
      minVD = d;
      bestVR = vr;
    }
  }
  let bestHR = HORIZONTAL_ROADS[0];
  let minHD = Infinity;
  for (const hr of HORIZONTAL_ROADS) {
    const d = Math.abs(car.y - hr.y);
    if (d < minHD) {
      minHD = d;
      bestHR = hr;
    }
  }

  if (minVD < minHD) {
    return { x: bestVR.x, y: player.y };
  }
  return { x: player.x, y: bestHR.y };
}

export function getClosestSirenProximity(state) {
  if (state.police.stars <= 0) return 0;
  let nearest = Infinity;
  for (const v of state.vehicles) {
    if (v.isPolice && v.sirenOn && !v.destroyed) {
      const d = dist(v.x, v.y, state.player.x, state.player.y);
      if (d < nearest) nearest = d;
    }
  }
  if (!Number.isFinite(nearest)) return 0;
  return clamp(1 - nearest / 950, 0, 1);
}
