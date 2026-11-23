// 6-mission original crime story campaign ("Marco Vega" & "Elena Cruz" in Solara Bay) with objectives, enemy AI, and rewards.

import { resolveCircleWorld, segmentHitsBuilding } from './city.js';
import { createVehicle } from './vehicles.js';
import { setWantedStars } from './police.js';
import { dist } from './random.js';

export const STORY_MISSIONS = [
  {
    id: 'first_wheels',
    title: '01 · FIRST WHEELS',
    startLandmark: 'pierStart',
    intro: 'Elena Cruz: "Welcome back to Solara Bay, Marco. Grab that crimson Solara GT and bring it to my chop shop."',
    reward: 650,
    steps: [
      { type: 'stealVehicle', label: 'Steal the Crimson Solara GT near Palm Strip Pier', vehicleTag: 'm1_gt' },
      { type: 'goto', label: 'Deliver the Solara GT to Marina Chop Shop', landmark: 'chopShop', requireVehicleTag: 'm1_gt', radius: 95 },
    ],
  },
  {
    id: 'boardwalk_debt',
    title: '02 · BOARDWALK DEBT',
    startLandmark: 'chopShop',
    intro: 'Elena Cruz: "Viper Cartel crews are extorting Sunset Plaza. Clear them out and remind them whose coast this is."',
    reward: 950,
    steps: [
      { type: 'goto', label: 'Drive to Sunset Plaza', landmark: 'sunsetPlaza', radius: 130 },
      { type: 'eliminate', label: 'Eliminate Viper Cartel enforcers at Sunset Plaza' },
    ],
  },
  {
    id: 'neon_heist',
    title: '03 · NEON HEIST',
    startLandmark: 'sunsetPlaza',
    intro: 'Elena Cruz: "Dante Moretti left an armored cash van outside Velvet Lounge. Boost it and lose the cops."',
    reward: 1350,
    steps: [
      { type: 'stealVehicle', label: 'Hijack the Syndicate Van at Velvet Lounge', vehicleTag: 'm3_van', triggerStars: 2 },
      { type: 'evade', label: 'Lose the Solara PD pursuit' },
      { type: 'goto', label: 'Stash the Syndicate Van at Port Solara', landmark: 'portDockyard', requireVehicleTag: 'm3_van', radius: 110 },
    ],
  },
  {
    id: 'pier_ambush',
    title: '04 · DOCKYARD AMBUSH',
    startLandmark: 'portDockyard',
    intro: 'Elena Cruz: "It is a trap! Cartel Lieutenant Victor Raze locked down Port Solara. Take him out."',
    reward: 1750,
    steps: [
      { type: 'eliminate', label: 'Eliminate Victor Raze and his dockyard crew' },
    ],
  },
  {
    id: 'hot_pursuit',
    title: '05 · HOT PURSUIT',
    startLandmark: 'bankPlaza',
    intro: 'Elena Cruz: "Grab the vault courier case at Downtown Bank Plaza. The entire PD will light up — burn rubber to Coral Heights!"',
    reward: 2400,
    steps: [
      { type: 'goto', label: 'Collect the vault ledger at Downtown Bank Plaza', landmark: 'bankPlaza', radius: 85, triggerStars: 4 },
      { type: 'evade', label: 'Escape the 4-star Solara PD manhunt' },
      { type: 'goto', label: 'Reach the Coral Heights Safehouse', landmark: 'coralSafehouse', radius: 100 },
    ],
  },
  {
    id: 'king_of_solara',
    title: '06 · KING OF SOLARA',
    startLandmark: 'coralSafehouse',
    intro: 'Elena Cruz: "This ends tonight. Hit Dante Moretti at his Marina Compound and claim Solara Bay."',
    reward: 5000,
    steps: [
      { type: 'goto', label: 'Assault Moretti Marina Compound', landmark: 'marinaCompound', radius: 145 },
      { type: 'eliminate', label: 'Take down Crime Boss Dante Moretti and his guards' },
    ],
  },
];

export function createMissionSystem() {
  return {
    currentIndex: 0,
    completedCount: 0,
    active: false,
    stepIndex: 0,
    enemies: [],
    storyLine: 'Welcome to Solara Bay. Follow the golden beacon to start your rise.',
    storyTimer: 8,
    objectiveText: 'Head to the golden mission marker',
    marker: null, // { x, y, color, label, kind }
  };
}

export function refreshMissionMarker(state) {
  const { missions, city, vehicles } = state;

  if (missions.currentIndex >= STORY_MISSIONS.length) {
    missions.active = false;
    missions.objectiveText = 'FREE ROAM · You rule Solara Bay';
    missions.marker = null;
    return;
  }

  const def = STORY_MISSIONS[missions.currentIndex];
  if (!missions.active) {
    const lm = city.landmarks[def.startLandmark];
    missions.objectiveText = `Go to ${lm.name} to start ${def.title}`;
    missions.marker = { x: lm.x, y: lm.y, color: '#ffd166', label: def.title, kind: 'start' };
    return;
  }

  const step = def.steps[missions.stepIndex];
  if (!step) return;

  if (step.type === 'goto') {
    const lm = city.landmarks[step.landmark];
    missions.objectiveText = step.label;
    missions.marker = { x: lm.x, y: lm.y, color: '#3effa8', label: lm.name, kind: 'goto' };
  } else if (step.type === 'stealVehicle') {
    const targetCar = vehicles.find((v) => v.missionTag === step.vehicleTag && !v.destroyed);
    missions.objectiveText = step.label;
    missions.marker = targetCar
      ? { x: targetCar.x, y: targetCar.y, color: '#2ef2ff', label: targetCar.name, kind: 'vehicle' }
      : null;
  } else if (step.type === 'eliminate') {
    const alive = missions.enemies.filter((e) => e.alive);
    missions.objectiveText = `${step.label} (${alive.length} left)`;
    if (alive.length > 0) {
      let nearest = alive[0];
      let bestD = Infinity;
      for (const e of alive) {
        const d = dist(state.player.x, state.player.y, e.x, e.y);
        if (d < bestD) {
          bestD = d;
          nearest = e;
        }
      }
      missions.marker = { x: nearest.x, y: nearest.y, color: '#ff4d6d', label: nearest.name, kind: 'target' };
    } else {
      missions.marker = null;
    }
  } else if (step.type === 'evade') {
    missions.objectiveText = `${step.label} (${state.police.stars}★ active)`;
    missions.marker = null;
  }
}

export function startCurrentMission(state) {
  const { missions, city, rng, vehicles } = state;
  if (missions.currentIndex >= STORY_MISSIONS.length) return;

  const def = STORY_MISSIONS[missions.currentIndex];
  missions.active = true;
  missions.stepIndex = 0;
  missions.enemies = [];
  missions.storyLine = def.intro;
  missions.storyTimer = 9.5;
  state.pushBanner(def.title, 'MISSION STARTED', '#ffd166', 2.8);
  state.audio.playUiBlip(620, 0.14);

  // Mission-specific world setup
  if (def.id === 'first_wheels') {
    const existing = vehicles.find((v) => v.missionTag === 'm1_gt' && !v.destroyed);
    if (!existing) {
      vehicles.push(
        createVehicle('solaraGT', 3090, 1466, Math.PI, rng, {
          color: '#ff2e63',
          missionTag: 'm1_gt',
        }),
      );
    }
  } else if (def.id === 'boardwalk_debt') {
    spawnMissionGang(state, city.landmarks.sunsetPlaza.x, city.landmarks.sunsetPlaza.y, [
      { dx: -75, dy: -55, name: 'Viper Guard', hp: 70 },
      { dx: 70, dy: -45, name: 'Viper Guard', hp: 70 },
      { dx: -55, dy: 68, name: 'Viper Enforcer', hp: 85 },
      { dx: 82, dy: 58, name: 'Viper Enforcer', hp: 85 },
    ]);
  } else if (def.id === 'neon_heist') {
    const vl = city.landmarks.velvetLounge;
    vehicles.push(
      createVehicle('harborVan', vl.x + 115, vl.y + 42, Math.PI, rng, {
        color: '#222f3e',
        missionTag: 'm3_van',
      }),
    );
    spawnMissionGang(state, vl.x + 115, vl.y + 42, [
      { dx: -65, dy: -55, name: 'Syndicate Guard', hp: 75 },
      { dx: 75, dy: 45, name: 'Syndicate Guard', hp: 75 },
    ]);
  } else if (def.id === 'pier_ambush') {
    const pd = city.landmarks.portDockyard;
    spawnMissionGang(state, pd.x, pd.y, [
      { dx: -90, dy: -65, name: 'Cartel Gunner', hp: 80 },
      { dx: 85, dy: -70, name: 'Cartel Gunner', hp: 80 },
      { dx: -80, dy: 75, name: 'Cartel Bruiser', hp: 95 },
      { dx: 95, dy: 65, name: 'Cartel Bruiser', hp: 95 },
      { dx: 0, dy: -115, name: 'Victor Raze', hp: 180, isBoss: true },
    ]);
  } else if (def.id === 'king_of_solara') {
    const mc = city.landmarks.marinaCompound;
    spawnMissionGang(state, mc.x, mc.y, [
      { dx: -110, dy: -75, name: 'Moretti Bodyguard', hp: 90 },
      { dx: 95, dy: -85, name: 'Moretti Bodyguard', hp: 90 },
      { dx: -90, dy: 80, name: 'Moretti Hitman', hp: 100 },
      { dx: 105, dy: 70, name: 'Moretti Hitman', hp: 100 },
      { dx: -15, dy: -125, name: 'Moretti Captain', hp: 120 },
      { dx: 15, dy: 0, name: 'Dante Moretti', hp: 260, isBoss: true },
    ]);
  }

  refreshMissionMarker(state);
}

export function spawnMissionGang(state, cx, cy, members) {
  const { city } = state;
  for (const m of members) {
    const enemy = {
      x: cx + m.dx,
      y: cy + m.dy,
      angle: Math.PI,
      radius: m.isBoss ? 15 : 12,
      hp: m.hp,
      maxHp: m.hp,
      name: m.name,
      isBoss: Boolean(m.isBoss),
      speed: m.isBoss ? 128 : 115,
      fireCooldown: state.rng.range(0.4, 1.1),
      muzzleFlash: 0,
      walkPhase: state.rng.range(0, 6.28),
      alerted: false,
      alive: true,
      deathTimer: 0,
      shirt: m.isBoss ? '#ffbe0b' : '#e63946',
    };
    resolveCircleWorld(city, enemy, enemy.radius + 4);
    state.missions.enemies.push(enemy);
  }
}

export function updateMissions(state, dt) {
  const { missions, player, city, vehicles } = state;

  if (missions.storyTimer > 0) {
    missions.storyTimer = Math.max(0, missions.storyTimer - dt);
  }

  // Update mission enemy AI
  for (let i = missions.enemies.length - 1; i >= 0; i--) {
    const e = missions.enemies[i];
    if (!e.alive) {
      e.deathTimer -= dt;
      if (e.deathTimer <= 0) missions.enemies.splice(i, 1);
      continue;
    }

    if (e.muzzleFlash > 0) e.muzzleFlash = Math.max(0, e.muzzleFlash - dt * 14);
    const d = dist(e.x, e.y, player.x, player.y);
    if (d < 490) e.alerted = true;

    if (e.alerted && !player.dead) {
      const aim = Math.atan2(player.y - e.y, player.x - e.x);
      e.angle = aim;
      e.fireCooldown -= dt;

      const blocked = segmentHitsBuilding(city, e.x, e.y, player.x, player.y);
      if (d > 220 || blocked) {
        e.x += Math.cos(aim) * e.speed * dt;
        e.y += Math.sin(aim) * e.speed * dt;
        e.walkPhase += dt * 9;
        resolveCircleWorld(city, e, e.radius);
      } else if (d < 130) {
        // Strafe backward slightly
        e.x -= Math.cos(aim) * e.speed * 0.55 * dt;
        e.y -= Math.sin(aim) * e.speed * 0.55 * dt;
        e.walkPhase += dt * 7;
        resolveCircleWorld(city, e, e.radius);
      }

      if (d < 440 && !blocked && e.fireCooldown <= 0) {
        const spread = state.rng.range(-0.13, 0.13);
        state.fireEnemyBullet(
          e.x + Math.cos(aim) * 15,
          e.y + Math.sin(aim) * 15,
          aim + spread,
          e.isBoss ? 14 : 9,
          '#ff6b6b',
          'enemy',
        );
        e.muzzleFlash = 1;
        e.fireCooldown = e.isBoss ? 0.52 : 0.95;
      }
    }
  }

  if (missions.currentIndex >= STORY_MISSIONS.length) {
    refreshMissionMarker(state);
    return;
  }

  const def = STORY_MISSIONS[missions.currentIndex];

  // Waiting at mission start marker
  if (!missions.active) {
    refreshMissionMarker(state);
    if (missions.marker && dist(player.x, player.y, missions.marker.x, missions.marker.y) < 74) {
      startCurrentMission(state);
    }
    return;
  }

  // Evaluate current step completion
  const step = def.steps[missions.stepIndex];
  if (!step) {
    completeCurrentMission(state);
    return;
  }

  let stepDone = false;
  if (step.type === 'stealVehicle') {
    const target = vehicles.find((v) => v.missionTag === step.vehicleTag);
    if (!target || target.destroyed) {
      // Respawn mission car if somehow destroyed so player is never soft-locked
      const lm = city.landmarks[def.startLandmark];
      vehicles.push(
        createVehicle(step.vehicleTag === 'm3_van' ? 'harborVan' : 'solaraGT', lm.x + 60, lm.y + 40, 0, state.rng, {
          missionTag: step.vehicleTag,
        }),
      );
    } else if (player.vehicle === target) {
      stepDone = true;
      if (step.triggerStars) setWantedStars(state, step.triggerStars);
    }
  } else if (step.type === 'goto') {
    const lm = city.landmarks[step.landmark];
    const inRadius = dist(player.x, player.y, lm.x, lm.y) < (step.radius || 95);
    const hasCar = !step.requireVehicleTag || (player.vehicle && player.vehicle.missionTag === step.requireVehicleTag);
    if (inRadius && hasCar) {
      stepDone = true;
      if (step.triggerStars) setWantedStars(state, step.triggerStars);
    }
  } else if (step.type === 'eliminate') {
    const remaining = missions.enemies.filter((e) => e.alive).length;
    if (remaining === 0) stepDone = true;
  } else if (step.type === 'evade') {
    if (state.police.stars === 0) stepDone = true;
  }

  if (stepDone) {
    missions.stepIndex++;
    state.audio.playUiBlip(690, 0.12);
    if (missions.stepIndex >= def.steps.length) {
      completeCurrentMission(state);
    } else {
      refreshMissionMarker(state);
    }
  } else {
    refreshMissionMarker(state);
  }
}

function completeCurrentMission(state) {
  const { missions, player } = state;
  const def = STORY_MISSIONS[missions.currentIndex];
  player.money += def.reward;
  missions.completedCount++;
  missions.currentIndex++;
  missions.active = false;
  missions.stepIndex = 0;
  missions.enemies = [];

  state.audio.playMissionComplete();
  state.pushBanner('MISSION COMPLETE', `${def.title}  ·  +$${def.reward.toLocaleString()}`, '#3effa8', 4.2);

  if (missions.currentIndex >= STORY_MISSIONS.length) {
    missions.storyLine = 'Solara Bay is yours, Marco Vega. Free Roam unlocked — own the night.';
    missions.storyTimer = 11;
  } else {
    missions.storyLine = `Elena Cruz: "Clean work, Marco. Cash wired (+$${def.reward}). Next contract is live on your radar."`;
    missions.storyTimer = 8.5;
  }

  refreshMissionMarker(state);
  state.autosave();
}
