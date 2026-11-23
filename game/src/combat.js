// Weapon firing, bullet tracers, muzzle flashes, hit detection, particle effects, and floating text popups.

import { segmentHitsBuilding } from './city.js';
import { getActiveWeapon, startReload } from './player.js';
import { damagePedestrian, scarePedestriansNear } from './pedestrians.js';
import { alertTrafficNear } from './traffic.js';
import { damageVehicle } from './vehicles.js';
import { clamp, dist } from './random.js';

export function firePlayerWeapon(state, aimAngle) {
  const { player, rng } = state;
  const weapon = getActiveWeapon(player);
  const slot = player.ammo[player.weaponIndex];

  if (slot.mag <= 0) {
    if (slot.reserve > 0) {
      startReload(player, state.audio);
    } else {
      state.audio.playUiBlip(190, 0.04, 'square');
      player.fireCooldown = 0.28;
    }
    return;
  }

  slot.mag--;
  player.fireCooldown = weapon.fireRate;
  player.muzzleFlash = 1;
  state.camera.shake = Math.max(state.camera.shake, weapon.shake);
  state.audio.playGunshot(weapon.sound, 1);

  const muzzleDist = player.vehicle ? 28 : 20;
  const mx = player.x + Math.cos(aimAngle) * muzzleDist;
  const my = player.y + Math.sin(aimAngle) * muzzleDist;

  for (let i = 0; i < weapon.pellets; i++) {
    const spread = rng.range(-weapon.spread, weapon.spread);
    const a = aimAngle + spread;
    state.bullets.push({
      x: mx,
      y: my,
      prevX: mx,
      prevY: my,
      vx: Math.cos(a) * weapon.bulletSpeed,
      vy: Math.sin(a) * weapon.bulletSpeed,
      damage: weapon.damage,
      life: weapon.range / weapon.bulletSpeed,
      color: weapon.tracerColor,
      tracerLen: weapon.tracerLen,
      owner: 'player',
    });
  }

  // Muzzle spark burst
  for (let i = 0; i < 4; i++) {
    const a = aimAngle + rng.range(-0.45, 0.45);
    const s = rng.range(120, 260);
    state.particles.push({
      x: mx,
      y: my,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: rng.range(2, 4.5),
      life: 0.1,
      maxLife: 0.1,
      color: '#fff3b0',
      kind: 'spark',
    });
  }

  scarePedestriansNear(state, player.x, player.y, 350);
  alertTrafficNear(state, player.x, player.y, 280);
  state.reportCrime(4, 'Discharging Firearm');

  if (slot.mag <= 0 && slot.reserve > 0) {
    startReload(player, state.audio);
  }
}

export function fireEnemyBullet(state, x, y, angle, damage, color = '#ff6b6b', owner = 'enemy') {
  const speed = 780;
  state.bullets.push({
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    life: 0.85,
    color,
    tracerLen: 24,
    owner,
  });

  const d = dist(x, y, state.player.x, state.player.y);
  if (d < 850) {
    state.audio.playGunshot('pistol', clamp(1 - d / 850, 0.15, 0.65));
  }
}

export function updateCombat(state, dt) {
  const { bullets, particles, popups, city, vehicles, pedestrians, police, missions, player } = state;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    if (b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }

    // Building wall hit
    const wallHit = segmentHitsBuilding(city, b.prevX, b.prevY, b.x, b.y);
    if (wallHit) {
      spawnHitSparks(state, wallHit.x, wallHit.y, '#ffd166', 5);
      bullets.splice(i, 1);
      continue;
    }

    let consumed = false;

    if (b.owner === 'player') {
      // Check mission enemies
      for (const e of missions.enemies) {
        if (!e.alive) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.radius + 7) {
          damageMissionEnemy(state, e, b.damage);
          spawnHitSparks(state, b.x, b.y, '#e63946', 6);
          consumed = true;
          break;
        }
      }

      // Check police officers
      if (!consumed) {
        for (const off of police.officers) {
          if (!off.alive) continue;
          if (dist(b.x, b.y, off.x, off.y) < off.radius + 6) {
            off.hp -= b.damage;
            spawnHitSparks(state, b.x, b.y, '#e63946', 6);
            if (off.hp <= 0) {
              off.alive = false;
              off.deathTimer = 14;
              state.reportCrime(42, 'Officer Down');
              state.player.money += 75;
              state.addPopup(off.x, off.y - 16, '+$75', '#3effa8');
            } else {
              state.reportCrime(16, 'Firing on PD');
            }
            consumed = true;
            break;
          }
        }
      }

      // Check pedestrians
      if (!consumed) {
        for (const ped of pedestrians) {
          if (!ped.alive) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < ped.radius + 5) {
            damagePedestrian(state, ped, b.damage, true, b.vx * 0.08, b.vy * 0.08);
            consumed = true;
            break;
          }
        }
      }
    } else {
      // Enemy/police bullet hitting player
      if (!player.dead) {
        const hitRadius = player.vehicle ? player.vehicle.radius * 0.85 : player.radius + 5;
        if (dist(b.x, b.y, player.x, player.y) < hitRadius) {
          if (player.vehicle) {
            damageVehicle(state, player.vehicle, b.damage * 0.65, false);
            state.damagePlayer(b.damage * 0.35);
            spawnHitSparks(state, b.x, b.y, '#ffd166', 4);
          } else {
            state.damagePlayer(b.damage);
            spawnHitSparks(state, b.x, b.y, '#e63946', 5);
          }
          consumed = true;
        }
      }
    }

    // Check vehicles (excluding player's own car when player shoots)
    if (!consumed) {
      for (const v of vehicles) {
        if (b.owner === 'player' && v === player.vehicle) continue;
        if (b.owner === 'police' && v.isPolice) continue;
        if (dist(b.x, b.y, v.x, v.y) < v.radius * 0.92) {
          damageVehicle(state, v, b.damage * 0.85, b.owner === 'player');
          spawnHitSparks(state, b.x, b.y, '#ffd166', 5);
          if (b.owner === 'player' && v.isPolice) {
            state.reportCrime(12, 'Damaging PD Cruiser');
          }
          consumed = true;
          break;
        }
      }
    }

    if (consumed) {
      bullets.splice(i, 1);
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-3.4 * dt);
    p.vy *= Math.exp(-3.4 * dt);
    p.life -= dt;
    if (p.kind === 'smoke' || p.kind === 'explosion') {
      p.size += dt * 14;
    }
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Update floating popups
  for (let i = popups.length - 1; i >= 0; i--) {
    const pop = popups[i];
    pop.y -= 28 * dt;
    pop.life -= dt;
    if (pop.life <= 0) popups.splice(i, 1);
  }
}

function damageMissionEnemy(state, enemy, amount) {
  enemy.hp -= amount;
  enemy.alerted = true;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    enemy.deathTimer = 18;
    const reward = enemy.isBoss ? 600 : 120;
    state.player.money += reward;
    state.addPopup(enemy.x, enemy.y - 16, enemy.isBoss ? `BOSS DOWN +$${reward}` : `+$${reward}`, '#ffd166');
    for (let i = 0; i < 10; i++) {
      const a = state.rng.angle();
      const s = state.rng.range(40, 150);
      state.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: state.rng.range(3, 6),
        life: 0.45,
        maxLife: 0.45,
        color: '#d90429',
        kind: 'blood',
      });
    }
  }
}

export function spawnHitSparks(state, x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = state.rng.angle();
    const s = state.rng.range(60, 210);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: state.rng.range(2, 4.5),
      life: state.rng.range(0.16, 0.34),
      maxLife: 0.34,
      color,
      kind: 'spark',
    });
  }
}
