// Sidewalk pedestrians strolling Solara Bay, fleeing gunfire or speeding cars, and dropping cash when hit.

import {
  BOARDWALK_X,
  HORIZONTAL_ROADS,
  SIDEWALK_WIDTH,
  VERTICAL_ROADS,
  WORLD_HEIGHT,
} from './config.js';
import { pointInBuilding, resolveCircleWorld } from './city.js';
import { clamp, dist } from './random.js';

const TARGET_PEDS = 36;

const SHIRT_COLORS = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#ff9f1c',
  '#a8dadc',
  '#f72585',
  '#72efdd',
  '#e9ecef',
  '#c77dff',
  '#80ed99',
];

const SKIN_TONES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function spawnInitialPedestrians(state) {
  for (let i = 0; i < TARGET_PEDS; i++) {
    spawnPedestrian(state, false);
  }
}

export function spawnPedestrian(state, outsideCamera = true) {
  const { city, rng, player, pedestrians } = state;

  for (let attempt = 0; attempt < 20; attempt++) {
    let x = 0;
    let y = 0;
    let axis = 'v';
    let dir = rng.chance(0.5) ? 1 : -1;

    if (rng.chance(0.24)) {
      // Boardwalk stroller
      x = BOARDWALK_X + rng.range(18, 66);
      y = rng.range(180, WORLD_HEIGHT - 180);
      axis = 'v';
    } else if (rng.chance(0.5)) {
      const road = rng.pick(VERTICAL_ROADS);
      const side = rng.chance(0.5) ? 1 : -1;
      x = road.x + side * (road.width * 0.5 + SIDEWALK_WIDTH * 0.45);
      y = rng.range(140, WORLD_HEIGHT - 140);
      axis = 'v';
    } else {
      const road = rng.pick(HORIZONTAL_ROADS);
      const side = rng.chance(0.5) ? 1 : -1;
      x = rng.range(180, BOARDWALK_X - 40);
      y = road.y + side * (road.width * 0.5 + SIDEWALK_WIDTH * 0.45);
      axis = 'h';
    }

    if (pointInBuilding(city, x, y, 12)) continue;
    const d = dist(x, y, player.x, player.y);
    if (outsideCamera && (d < 620 || d > 1550)) continue;
    if (!outsideCamera && d < 90) continue;

    const angle = axis === 'v' ? (dir === 1 ? Math.PI * 0.5 : -Math.PI * 0.5) : dir === 1 ? 0 : Math.PI;
    pedestrians.push({
      x,
      y,
      angle,
      axis,
      dir,
      speed: rng.range(48, 76),
      radius: 11,
      hp: 40,
      fleeTimer: 0,
      fleeX: 0,
      fleeY: 0,
      walkPhase: rng.range(0, 6.28),
      shirt: rng.pick(SHIRT_COLORS),
      skin: rng.pick(SKIN_TONES),
      hair: rng.pick(['#1b1b22', '#4a3222', '#d4a359', '#6e2c1f']),
      cash: rng.int(15, 65),
      alive: true,
      deathTimer: 0,
    });
    return;
  }
}

export function scarePedestriansNear(state, x, y, radius = 320) {
  for (const p of state.pedestrians) {
    if (!p.alive) continue;
    if (dist(x, y, p.x, p.y) < radius) {
      p.fleeTimer = 5.5;
      p.fleeX = x;
      p.fleeY = y;
    }
  }
}

export function updatePedestrians(state, dt) {
  const { pedestrians, vehicles, player, city } = state;
  let aliveCount = 0;

  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const p = pedestrians[i];

    if (!p.alive) {
      p.deathTimer -= dt;
      if (p.deathTimer <= 0) pedestrians.splice(i, 1);
      continue;
    }

    if (dist(p.x, p.y, player.x, player.y) > 1750) {
      pedestrians.splice(i, 1);
      continue;
    }

    aliveCount++;

    let moveSpeed = p.speed;
    if (p.fleeTimer > 0) {
      p.fleeTimer -= dt;
      p.angle = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
      moveSpeed = 165;
    } else {
      // Gently patrol sidewalk
      if (p.axis === 'v') {
        if (p.y < 140) p.dir = 1;
        if (p.y > WORLD_HEIGHT - 140) p.dir = -1;
        p.angle = p.dir === 1 ? Math.PI * 0.5 : -Math.PI * 0.5;
      } else {
        if (p.x < 160) p.dir = 1;
        if (p.x > BOARDWALK_X - 40) p.dir = -1;
        p.angle = p.dir === 1 ? 0 : Math.PI;
      }
    }

    p.x += Math.cos(p.angle) * moveSpeed * dt;
    p.y += Math.sin(p.angle) * moveSpeed * dt;
    p.walkPhase += dt * (p.fleeTimer > 0 ? 14 : 6.5);

    const hitWall = resolveCircleWorld(city, p, p.radius);
    if (hitWall.hit) {
      p.dir *= -1;
      p.angle += Math.PI * 0.5;
    }

    // Check fast vehicles hitting or startling pedestrians
    for (const v of vehicles) {
      const d = dist(p.x, p.y, v.x, v.y);
      if (d < v.radius + p.radius + 36 && v.speed > 175) {
        p.fleeTimer = 4.0;
        p.fleeX = v.x;
        p.fleeY = v.y;
      }
      if (d < v.radius + p.radius - 2 && v.speed > 105) {
        downPedestrian(state, p, v.driver === 'player', v.vx * 0.25, v.vy * 0.25);
        break;
      }
    }
  }

  if (aliveCount < TARGET_PEDS && state.tick % 6 === 0) {
    spawnPedestrian(state, true);
  }
}

export function damagePedestrian(state, ped, amount, byPlayer, kx = 0, ky = 0) {
  if (!ped.alive) return;
  ped.hp -= amount;
  ped.fleeTimer = 6.0;
  ped.fleeX = state.player.x;
  ped.fleeY = state.player.y;

  if (ped.hp <= 0) {
    downPedestrian(state, ped, byPlayer, kx, ky);
  } else if (byPlayer) {
    state.reportCrime(15, 'Assault');
  }
}

function downPedestrian(state, ped, byPlayer, kx, ky) {
  ped.alive = false;
  ped.deathTimer = 14;
  ped.x = clamp(ped.x + kx * 0.1, 60, BOARDWALK_X + 240);
  ped.y = clamp(ped.y + ky * 0.1, 60, WORLD_HEIGHT - 60);

  for (let i = 0; i < 9; i++) {
    const a = state.rng.angle();
    const s = state.rng.range(35, 130);
    state.particles.push({
      x: ped.x,
      y: ped.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: state.rng.range(2.5, 5.5),
      life: 0.45,
      maxLife: 0.45,
      color: '#c1121f',
      kind: 'blood',
    });
  }

  if (byPlayer) {
    state.player.money += ped.cash;
    state.addPopup(ped.x, ped.y - 12, `+$${ped.cash}`, '#3effa8');
    state.reportCrime(32, 'Civilian Harm');
    scarePedestriansNear(state, ped.x, ped.y, 340);
  }
}
