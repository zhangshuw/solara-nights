// Vehicle physics, steering, drift/skid marks, headlights, collisions, damage, and explosions.

import { VEHICLE_TYPES } from './config.js';
import { resolveCircleWorld } from './city.js';
import { clamp } from './random.js';

let nextVehicleId = 1;

export function resetVehicleIds() {
  nextVehicleId = 1;
}

export function createVehicle(typeId, x, y, angle, rng, overrides = {}) {
  const spec = VEHICLE_TYPES[typeId] || VEHICLE_TYPES.bayside;
  const color = overrides.color || (rng ? rng.pick(spec.palette) : spec.palette[0]);
  return {
    id: nextVehicleId++,
    typeId: spec.id,
    name: spec.name,
    style: spec.style,
    x,
    y,
    vx: 0,
    vy: 0,
    angle,
    speed: 0,
    steerInput: 0,
    throttleInput: 0,
    braking: false,
    drifting: false,
    length: spec.length,
    width: spec.width,
    radius: Math.max(spec.length, spec.width) * 0.37,
    maxSpeed: spec.maxSpeed,
    reverseSpeed: spec.reverseSpeed,
    accel: spec.accel,
    brake: spec.brake,
    turnRate: spec.turnRate,
    grip: spec.grip,
    driftGrip: spec.driftGrip,
    mass: spec.mass,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    color,
    driver: overrides.driver || null, // 'player' | 'traffic' | 'police' | 'mission' | null
    isPolice: spec.style === 'police' || spec.style === 'enforcer',
    sirenOn: Boolean(overrides.sirenOn),
    sirenPhase: rng ? rng.range(0, 6.28) : 0,
    headlightsOn: true,
    destroyed: false,
    missionTag: overrides.missionTag || null,
    ai: overrides.ai || null,
    smokeTimer: 0,
    skidTimer: 0,
    hitCooldown: 0,
    stolen: false,
  };
}

export function applyVehicleControls(vehicle, { throttle, steer, handbrake }, dt, state) {
  if (vehicle.destroyed) {
    vehicle.vx *= Math.exp(-3.5 * dt);
    vehicle.vy *= Math.exp(-3.5 * dt);
    vehicle.speed = Math.hypot(vehicle.vx, vehicle.vy);
    return;
  }

  vehicle.throttleInput = throttle;
  vehicle.steerInput = steer;

  const fx = Math.cos(vehicle.angle);
  const fy = Math.sin(vehicle.angle);
  const rx = -fy;
  const ry = fx;

  let forwardVel = vehicle.vx * fx + vehicle.vy * fy;
  let lateralVel = vehicle.vx * rx + vehicle.vy * ry;

  // Acceleration / braking / reverse
  vehicle.braking = false;
  if (throttle > 0.05) {
    if (forwardVel < -15) {
      forwardVel += vehicle.brake * dt;
      vehicle.braking = true;
    } else {
      forwardVel += vehicle.accel * throttle * dt;
    }
  } else if (throttle < -0.05) {
    if (forwardVel > 20) {
      forwardVel -= vehicle.brake * dt;
      vehicle.braking = true;
    } else {
      forwardVel += vehicle.accel * 0.65 * throttle * dt;
    }
  } else {
    // Natural rolling drag
    forwardVel *= Math.exp(-1.6 * dt);
  }

  if (handbrake) {
    forwardVel *= Math.exp(-2.8 * dt);
    vehicle.braking = true;
  }

  forwardVel = clamp(forwardVel, -vehicle.reverseSpeed, vehicle.maxSpeed);

  // Speed-sensitive steering
  const speedNorm = clamp(Math.abs(forwardVel) / 140, 0, 1);
  const dirSign = forwardVel >= -5 ? 1 : -1;
  const driftBoost = handbrake ? 1.28 : 1.0;
  vehicle.angle += steer * vehicle.turnRate * driftBoost * speedNorm * dirSign * dt;

  // Lateral grip (lower grip during handbrake creates smooth powerslide drift)
  const grip = handbrake ? vehicle.driftGrip : vehicle.grip;
  lateralVel *= Math.exp(-grip * dt);

  const nfx = Math.cos(vehicle.angle);
  const nfy = Math.sin(vehicle.angle);
  const nrx = -nfy;
  const nry = nfx;

  vehicle.vx = nfx * forwardVel + nrx * lateralVel;
  vehicle.vy = nfy * forwardVel + nry * lateralVel;
  vehicle.speed = Math.hypot(vehicle.vx, vehicle.vy);
  vehicle.drifting = Math.abs(lateralVel) > 65 || (handbrake && vehicle.speed > 130);

  // Emit tire skid marks when drifting or braking hard
  if ((vehicle.drifting || (vehicle.braking && vehicle.speed > 240)) && state) {
    vehicle.skidTimer -= dt;
    if (vehicle.skidTimer <= 0) {
      vehicle.skidTimer = 0.028;
      const rearX = vehicle.x - nfx * (vehicle.length * 0.33);
      const rearY = vehicle.y - nfy * (vehicle.length * 0.33);
      const halfTrack = vehicle.width * 0.36;
      addSkidMark(state, rearX + nrx * halfTrack, rearY + nry * halfTrack, vehicle.angle);
      addSkidMark(state, rearX - nrx * halfTrack, rearY - nry * halfTrack, vehicle.angle);
    }
  }
}

export function addSkidMark(state, x, y, angle) {
  state.skidMarks.push({ x, y, angle, alpha: 0.44 });
  if (state.skidMarks.length > 340) {
    state.skidMarks.shift();
  }
}

export function updateVehicles(state, dt) {
  const { city, vehicles } = state;

  for (const v of vehicles) {
    if (v.hitCooldown > 0) v.hitCooldown = Math.max(0, v.hitCooldown - dt);
    if (v.sirenOn) v.sirenPhase += dt * 7.5;

    // Coast unoccupied cars gently to a halt
    if (!v.driver) {
      v.vx *= Math.exp(-3.4 * dt);
      v.vy *= Math.exp(-3.4 * dt);
      v.speed = Math.hypot(v.vx, v.vy);
      v.braking = false;
      v.drifting = false;
    }

    v.x += v.vx * dt;
    v.y += v.vy * dt;

    // Building & border collisions
    const res = resolveCircleWorld(city, v, v.radius);
    if (res.hit) {
      const impact = Math.abs(v.vx * res.nx + v.vy * res.ny);
      if (impact > 95) {
        const dmg = (impact - 80) * 0.09;
        damageVehicle(state, v, dmg, v.driver === 'player');
        if (v.driver === 'player') {
          state.camera.shake = Math.max(state.camera.shake, clamp(impact / 55, 2, 9));
          state.audio.playCrash(impact / 420);
        }
        spawnSparks(state, v.x - res.nx * v.radius * 0.7, v.y - res.ny * v.radius * 0.7, 5);
      }
      // Slide along wall normal
      const vn = v.vx * res.nx + v.vy * res.ny;
      if (vn < 0) {
        v.vx -= (1.35 * vn) * res.nx;
        v.vy -= (1.35 * vn) * res.ny;
        v.vx *= 0.72;
        v.vy *= 0.72;
      }
    }

    // Engine damage smoke / fire particles
    if (v.hp < v.maxHp * 0.45 && !v.destroyed) {
      v.smokeTimer -= dt;
      if (v.smokeTimer <= 0) {
        v.smokeTimer = v.hp < v.maxHp * 0.22 ? 0.05 : 0.11;
        const hoodX = v.x + Math.cos(v.angle) * (v.length * 0.34);
        const hoodY = v.y + Math.sin(v.angle) * (v.length * 0.34);
        state.particles.push({
          x: hoodX,
          y: hoodY,
          vx: state.rng.range(-18, 18),
          vy: state.rng.range(-28, -8),
          size: state.rng.range(6, 13),
          life: 0.75,
          maxLife: 0.75,
          color: v.hp < v.maxHp * 0.22 ? '#ff6b35' : '#4a5568',
          kind: 'smoke',
        });
      }
    }
  }

  // Vehicle-to-vehicle collisions
  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist || d2 < 0.0001) continue;

      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = minDist - d;
      const totalMass = a.mass + b.mass;
      a.x -= nx * overlap * (b.mass / totalMass);
      a.y -= ny * overlap * (b.mass / totalMass);
      b.x += nx * overlap * (a.mass / totalMass);
      b.y += ny * overlap * (a.mass / totalMass);

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const sepVel = rvx * nx + rvy * ny;
      if (sepVel < 0) {
        const restitution = 0.28;
        const impulse = (-(1 + restitution) * sepVel) / (1 / a.mass + 1 / b.mass);
        a.vx -= (impulse / a.mass) * nx;
        a.vy -= (impulse / a.mass) * ny;
        b.vx += (impulse / b.mass) * nx;
        b.vy += (impulse / b.mass) * ny;

        const impact = Math.abs(sepVel);
        if (impact > 110) {
          const mx = (a.x + b.x) * 0.5;
          const my = (a.y + b.y) * 0.5;
          spawnSparks(state, mx, my, 7);
          const dmg = (impact - 90) * 0.1;
          damageVehicle(state, a, dmg * (b.mass / a.mass), b.driver === 'player');
          damageVehicle(state, b, dmg * (a.mass / b.mass), a.driver === 'player');
          if (a.driver === 'player' || b.driver === 'player') {
            state.camera.shake = Math.max(state.camera.shake, clamp(impact / 55, 2.5, 10));
            state.audio.playCrash(impact / 420);
            if ((a.isPolice && b.driver === 'player') || (b.isPolice && a.driver === 'player')) {
              state.reportCrime(16, 'Ramming PD');
            } else if (impact > 210) {
              state.reportCrime(8, 'Reckless Collision');
            }
          }
        }
      }
    }
  }
}

export function damageVehicle(state, vehicle, amount, byPlayer = false) {
  if (vehicle.destroyed || amount <= 0) return;
  vehicle.hp -= amount;
  if (vehicle.hp <= 0) {
    vehicle.hp = 0;
    vehicle.destroyed = true;
    vehicle.sirenOn = false;
    vehicle.headlightsOn = false;
    triggerVehicleExplosion(state, vehicle, byPlayer);
  }
}

function triggerVehicleExplosion(state, vehicle, byPlayer) {
  state.audio.playExplosion();
  state.camera.shake = Math.max(state.camera.shake, 14);

  for (let i = 0; i < 32; i++) {
    const ang = state.rng.angle();
    const spd = state.rng.range(60, 290);
    state.particles.push({
      x: vehicle.x,
      y: vehicle.y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: state.rng.range(8, 24),
      life: state.rng.range(0.35, 0.85),
      maxLife: 0.85,
      color: i % 3 === 0 ? '#fff3b0' : i % 2 === 0 ? '#ff6b35' : '#2d3142',
      kind: 'explosion',
    });
  }

  // Eject player if driving
  if (state.player.vehicle === vehicle) {
    state.player.vehicle = null;
    state.player.x = vehicle.x + 48;
    state.player.y = vehicle.y + 18;
    state.damagePlayer(45);
  }

  if (byPlayer) {
    state.reportCrime(vehicle.isPolice ? 48 : 26, 'Vehicle Destruction');
  }
}

function spawnSparks(state, x, y, count) {
  for (let i = 0; i < count; i++) {
    const ang = state.rng.angle();
    const spd = state.rng.range(70, 220);
    state.particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      size: state.rng.range(2, 4),
      life: state.rng.range(0.18, 0.34),
      maxLife: 0.34,
      color: '#ffd166',
      kind: 'spark',
    });
  }
}
