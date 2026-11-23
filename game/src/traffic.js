// Lane-following road-grid traffic AI with intersection turning, obstacle braking, and parked car seeding.

import {
  BOARDWALK_X,
  HORIZONTAL_ROADS,
  TRAFFIC_POOL,
  VERTICAL_ROADS,
  WORLD_HEIGHT,
} from './config.js';
import { applyVehicleControls, createVehicle } from './vehicles.js';
import { angleDiff, clamp, dist } from './random.js';

const TARGET_TRAFFIC_COUNT = 22;

export function spawnInitialVehicles(state) {
  const { city, rng, vehicles } = state;

  // Seed parked cars in curbside spots (including a guaranteed Solara GT near the pier start)
  vehicles.push(createVehicle('solaraGT', 3015, 1612, 0, rng, { color: '#ff476f' }));
  vehicles.push(createVehicle('marlin', 3015, 1468, Math.PI, rng, { color: '#48dbfb' }));
  vehicles.push(createVehicle('valkyrie', 1682, 1455, -Math.PI * 0.5, rng, { color: '#f9ed69' }));

  for (let i = 0; i < city.parkingSpots.length; i++) {
    if (!rng.chance(0.42)) continue;
    const spot = city.parkingSpots[i];
    if (isSpotCrowded(vehicles, spot.x, spot.y, 95)) continue;
    const typeId = rng.pick(TRAFFIC_POOL);
    vehicles.push(createVehicle(typeId, spot.x, spot.y, spot.angle, rng));
  }

  // Spawn active moving traffic across avenues
  for (let i = 0; i < TARGET_TRAFFIC_COUNT; i++) {
    spawnTrafficCar(state, false);
  }
}

export function spawnTrafficCar(state, outsideCamera = true) {
  const { rng, vehicles, player } = state;

  for (let attempt = 0; attempt < 18; attempt++) {
    const vertical = rng.chance(0.5);
    let x = 0;
    let y = 0;
    let dir = 1;
    let roadIndex = 0;
    let angle = 0;

    if (vertical) {
      roadIndex = rng.int(0, VERTICAL_ROADS.length - 1);
      const road = VERTICAL_ROADS[roadIndex];
      dir = rng.chance(0.5) ? 1 : -1;
      const laneOffset = road.width * 0.24;
      x = road.x + (dir === 1 ? -laneOffset : laneOffset);
      y = rng.range(180, WORLD_HEIGHT - 180);
      angle = dir === 1 ? Math.PI * 0.5 : -Math.PI * 0.5;
    } else {
      roadIndex = rng.int(0, HORIZONTAL_ROADS.length - 1);
      const road = HORIZONTAL_ROADS[roadIndex];
      dir = rng.chance(0.5) ? 1 : -1;
      const laneOffset = road.width * 0.24;
      x = rng.range(200, BOARDWALK_X - 180);
      y = road.y + (dir === 1 ? laneOffset : -laneOffset);
      angle = dir === 1 ? 0 : Math.PI;
    }

    const dPlayer = dist(x, y, player.x, player.y);
    if (outsideCamera && (dPlayer < 720 || dPlayer > 1750)) continue;
    if (!outsideCamera && dPlayer < 190) continue;
    if (isSpotCrowded(vehicles, x, y, 130)) continue;

    const typeId = rng.pick(TRAFFIC_POOL);
    const v = createVehicle(typeId, x, y, angle, rng, {
      driver: 'traffic',
      ai: {
        axis: vertical ? 'v' : 'h',
        roadIndex,
        dir,
        cruiseSpeed: rng.range(165, 240),
        turnCooldown: 1.0,
        panicTimer: 0,
      },
    });
    v.vx = Math.cos(angle) * v.ai.cruiseSpeed * 0.7;
    v.vy = Math.sin(angle) * v.ai.cruiseSpeed * 0.7;
    vehicles.push(v);
    return v;
  }
  return null;
}

export function alertTrafficNear(state, x, y, radius = 340) {
  for (const v of state.vehicles) {
    if (v.driver !== 'traffic' || !v.ai) continue;
    if (dist(x, y, v.x, v.y) < radius) {
      v.ai.panicTimer = 4.5;
    }
  }
}

export function updateTraffic(state, dt) {
  const { vehicles, player, rng } = state;
  let activeTraffic = 0;

  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.driver !== 'traffic' || !v.ai) continue;

    // Recycle distant traffic so roads around the player stay busy
    if (dist(v.x, v.y, player.x, player.y) > 1950) {
      vehicles.splice(i, 1);
      continue;
    }

    activeTraffic++;
    const ai = v.ai;
    if (ai.turnCooldown > 0) ai.turnCooldown -= dt;
    if (ai.panicTimer > 0) ai.panicTimer -= dt;

    // Turn around cleanly near road endpoints
    if (ai.axis === 'v') {
      if (v.y < 140 && ai.dir === -1) ai.dir = 1;
      if (v.y > WORLD_HEIGHT - 140 && ai.dir === 1) ai.dir = -1;
    } else {
      if (v.x < 180 && ai.dir === -1) ai.dir = 1;
      if (v.x > BOARDWALK_X - 160 && ai.dir === 1) ai.dir = -1;
    }

    // Decide turns at intersections
    if (ai.turnCooldown <= 0) {
      if (ai.axis === 'v') {
        for (let hi = 0; hi < HORIZONTAL_ROADS.length; hi++) {
          const hr = HORIZONTAL_ROADS[hi];
          if (Math.abs(v.y - hr.y) < 34 && rng.chance(0.35)) {
            ai.axis = 'h';
            ai.roadIndex = hi;
            ai.dir = rng.chance(0.5) ? 1 : -1;
            ai.turnCooldown = 2.4;
            break;
          }
        }
      } else {
        for (let vi = 0; vi < VERTICAL_ROADS.length; vi++) {
          const vr = VERTICAL_ROADS[vi];
          if (Math.abs(v.x - vr.x) < 34 && rng.chance(0.35)) {
            ai.axis = 'v';
            ai.roadIndex = vi;
            ai.dir = rng.chance(0.5) ? 1 : -1;
            ai.turnCooldown = 2.4;
            break;
          }
        }
      }
    }

    // Compute target lookahead point in right-hand lane
    let targetX = v.x;
    let targetY = v.y;
    if (ai.axis === 'v') {
      const road = VERTICAL_ROADS[ai.roadIndex];
      const laneOffset = road.width * 0.24;
      targetX = road.x + (ai.dir === 1 ? -laneOffset : laneOffset);
      targetY = v.y + ai.dir * 165;
    } else {
      const road = HORIZONTAL_ROADS[ai.roadIndex];
      const laneOffset = road.width * 0.24;
      targetX = v.x + ai.dir * 165;
      targetY = road.y + (ai.dir === 1 ? laneOffset : -laneOffset);
    }

    const desiredAngle = Math.atan2(targetY - v.y, targetX - v.x);
    const diff = angleDiff(v.angle, desiredAngle);
    const steer = clamp(diff * 2.4, -1, 1);

    // Check forward corridor for other cars or player to brake cleanly
    const blocked = isObstacleAhead(state, v, ai.panicTimer > 0 ? 110 : 165);
    const targetSpeed = blocked ? 0 : ai.panicTimer > 0 ? ai.cruiseSpeed * 1.48 : ai.cruiseSpeed;

    let throttle = 0;
    if (blocked && v.speed > 12) {
      throttle = -1;
    } else if (v.speed < targetSpeed) {
      throttle = clamp((targetSpeed - v.speed) / 110, 0.2, 1);
    }

    applyVehicleControls(v, { throttle, steer, handbrake: blocked && v.speed > 90 }, dt, state);
  }

  // Replenish traffic up to cap
  if (activeTraffic < TARGET_TRAFFIC_COUNT && state.tick % 8 === 0) {
    spawnTrafficCar(state, true);
  }
}

function isObstacleAhead(state, self, lookDist) {
  const fx = Math.cos(self.angle);
  const fy = Math.sin(self.angle);

  // Check player on foot
  if (!state.player.vehicle) {
    const dx = state.player.x - self.x;
    const dy = state.player.y - self.y;
    const fwd = dx * fx + dy * fy;
    const lat = Math.abs(-dx * fy + dy * fx);
    if (fwd > 28 && fwd < lookDist * 0.85 && lat < 30) return true;
  }

  for (const other of state.vehicles) {
    if (other === self) continue;
    const dx = other.x - self.x;
    const dy = other.y - self.y;
    const fwd = dx * fx + dy * fy;
    if (fwd < 34 || fwd > lookDist) continue;
    const lat = Math.abs(-dx * fy + dy * fx);
    if (lat < (self.width + other.width) * 0.52) return true;
  }
  return false;
}

function isSpotCrowded(vehicles, x, y, minDist) {
  for (const v of vehicles) {
    if (dist(x, y, v.x, v.y) < minDist) return true;
  }
  return false;
}
