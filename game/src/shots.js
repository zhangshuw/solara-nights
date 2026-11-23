// Deterministic ?shot=<name>&seed=<n> staging for cover and showcase screenshots using the real game simulation & renderer.

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { addSkidMark, createVehicle } from './vehicles.js';
import { createPoliceHeli, setWantedStars, spawnPoliceCruiser } from './police.js';
import { refreshMissionMarker, spawnMissionGang } from './missions.js';
import { firePlayerWeapon, fireEnemyBullet, spawnHitSparks } from './combat.js';
import { clamp, dist } from './random.js';

function clearAreaForStage(state, cx, cy, radius = 320) {
  state.vehicles = state.vehicles.filter((v) => dist(v.x, v.y, cx, cy) > radius);
  state.pedestrians = state.pedestrians.filter((p) => dist(p.x, p.y, cx, cy) > radius);
  state.particles = [];
  state.bullets = [];
  state.skidMarks = [];
}

export function parseShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedRaw = params.get('seed');
  const seed = seedRaw ? parseInt(seedRaw, 10) || 202607 : 202607;
  return { shot: shot ? shot.toLowerCase() : null, seed };
}

export function stageShotScene(state, shotName, stepSimulation) {
  state.shotMode = true;
  state.mode = 'playing';
  state.banner = null;

  if (shotName === 'chase') {
    stageChaseShot(state, stepSimulation);
  } else if (shotName === 'foot') {
    stageFootShot(state, stepSimulation);
  } else if (shotName === 'drive') {
    stageDriveShot(state, stepSimulation);
  } else if (shotName === 'mission') {
    stageMissionShot(state, stepSimulation);
  } else {
    stageChaseShot(state, stepSimulation);
  }

  // Center camera cleanly onto staged subject inside world bounds
  const leadX = state.player.vehicle ? Math.cos(state.player.angle) * 75 : 35;
  const leadY = state.player.vehicle ? Math.sin(state.player.angle) * 50 : 0;
  state.camera.x = clamp(state.player.x + leadX - VIEWPORT_WIDTH * 0.5, 0, WORLD_WIDTH - VIEWPORT_WIDTH);
  state.camera.y = clamp(state.player.y + leadY - VIEWPORT_HEIGHT * 0.5, 0, WORLD_HEIGHT - VIEWPORT_HEIGHT);
  state.camera.shake = 0;
  state.camera.shakeOffsetX = 0;
  state.camera.shakeOffsetY = 0;
}

// COVER SHOT: 4-star high-speed police chase on Palm Grand Ave & Ocean Strip at neon dusk with Air-1 helicopter spotlight
function stageChaseShot(state, stepSimulation) {
  clearAreaForStage(state, 2820, 1550, 420);
  state.timeOfDay = 0.34; // vibrant Solara Dusk / Neon Night
  state.player.money = 4850;
  state.player.health = 82;
  state.player.armor = 34;
  state.player.weaponIndex = 1;

  // Stolen crimson Solara GT tearing east along Palm Grand Ave toward Ocean Strip & Solara Pier
  const heroCar = createVehicle('solaraGT', 2810, 1574, -0.06, state.rng, {
    color: '#ff2e63',
    driver: 'player',
  });
  heroCar.vx = 435;
  heroCar.vy = -28;
  heroCar.speed = 436;
  heroCar.stolen = true;
  state.vehicles.push(heroCar);
  state.player.vehicle = heroCar;
  state.player.x = heroCar.x;
  state.player.y = heroCar.y;
  state.player.angle = heroCar.angle;

  // Drift tire skid marks trailing the sports car
  for (let i = 0; i < 18; i++) {
    const t = i * 11;
    addSkidMark(state, heroCar.x - 36 - t, heroCar.y + 13 + t * 0.12, -0.12);
    addSkidMark(state, heroCar.x - 36 - t, heroCar.y - 11 + t * 0.12, -0.12);
  }

  // 4-star active pursuit with 3 visible police cruisers + Air-1 helicopter
  setWantedStars(state, 4);
  state.police.lastCrimeText = 'High-Speed Pursuit';
  state.police.lastCrimeTimer = 5;

  const p1 = spawnPoliceCruiser(state, { x: 2625, y: 1584, angle: -0.05 });
  p1.vx = 415;
  p1.vy = -20;
  p1.sirenPhase = 0.25;

  const p2 = spawnPoliceCruiser(state, { x: 2565, y: 1510, angle: 0.14 });
  p2.vx = 390;
  p2.vy = 38;
  p2.sirenPhase = 3.45;

  const p3 = spawnPoliceCruiser(state, { x: 2948, y: 1368, angle: Math.PI * 0.56 });
  p3.vx = -22;
  p3.vy = 290;
  p3.sirenPhase = 1.65;

  // Nearby civilian traffic & coastal road energy
  state.vehicles.push(createVehicle('valkyrie', 2982, 1695, -Math.PI * 0.5, state.rng, { color: '#f9ed69', driver: 'traffic' }));
  state.vehicles.push(createVehicle('marlin', 2898, 1445, Math.PI * 0.5, state.rng, { color: '#48dbfb', driver: 'traffic' }));

  // Police helicopter Air-1 locked onto the stolen GT with dramatic spotlight
  const heli = createPoliceHeli(2920, 1415);
  heli.angle = Math.atan2(heroCar.y - heli.y, heroCar.x - heli.x);
  heli.spotX = heroCar.x + 28;
  heli.spotY = heroCar.y - 4;
  heli.rotorAngle = 0.55;
  state.police.heli = heli;

  // Active Story Mission 05 objective visible on HUD & radar
  state.missions.currentIndex = 4;
  state.missions.active = true;
  state.missions.stepIndex = 2; // 'goto' Coral Heights Safehouse so radar shows green safehouse beacon!
  state.missions.storyLine = 'Elena Cruz: "Air-1 has a lock on you, Marco! Cut north to Coral Heights and shake them!"';
  state.missions.storyTimer = 8;

  // Sparks & gunfire tracer for chase energy
  spawnHitSparks(state, heroCar.x - 28, heroCar.y + 8, '#ffd166', 10);
  fireEnemyBullet(state, p1.x + 34, p1.y - 6, -0.04, 8, '#72efdd', 'police');

  for (let i = 0; i < 6; i++) stepSimulation(1 / 60);
  state.missions.objectiveText = 'Escape 4-star Solara PD · Reach Coral Heights Safehouse';
  state.missions.marker = {
    x: state.city.landmarks.coralSafehouse.x,
    y: state.city.landmarks.coralSafehouse.y,
    color: '#3effa8',
    label: 'SAFEHOUSE',
    kind: 'goto',
  };
}

// ON FOOT: Lively Palm Strip sidewalk near Solara Pier, beach umbrellas & yachts, pedestrians, traffic, mission marker
function stageFootShot(state, stepSimulation) {
  clearAreaForStage(state, 3060, 1520, 380);
  state.timeOfDay = 0.04; // warm Golden Hour coastal sunlight
  state.player.money = 1280;
  state.player.health = 100;
  state.player.armor = 35;
  state.player.vehicle = null;
  state.player.x = 3042;
  state.player.y = 1522;
  state.player.angle = 0.16;
  state.player.moving = true;
  state.player.walkCycle = 1.2;

  setWantedStars(state, 0);

  // Nearby parked sports car (triggers visible [E] prompt!) & lively Ocean Strip traffic
  const parkedGT = createVehicle('solaraGT', 3022, 1588, 0.04, state.rng, { color: '#ff476f' });
  state.vehicles.push(parkedGT);
  state.player.nearVehicle = parkedGT;
  state.vehicles.push(createVehicle('taxi', 2902, 1405, Math.PI * 0.5, state.rng, { color: '#f7b801', driver: 'traffic' }));
  state.vehicles.push(createVehicle('marlin', 2978, 1655, -Math.PI * 0.5, state.rng, { color: '#00d2d3', driver: 'traffic' }));
  state.vehicles.push(createVehicle('kodiak', 2790, 1576, 0, state.rng, { color: '#6d597a', driver: 'traffic' }));

  // Pedestrians strolling Ocean Strip sidewalk & Palm Boardwalk
  const pedSpots = [
    [3072, 1445, Math.PI * 0.5, '#ffe66d'],
    [3095, 1612, -Math.PI * 0.5, '#4ecdc4'],
    [3158, 1502, Math.PI, '#ff6b6b'],
    [3185, 1588, -Math.PI * 0.35, '#c77dff'],
    [3398, 1465, Math.PI * 0.5, '#80ed99'],
    [3404, 1590, -Math.PI * 0.5, '#ff9f1c'],
    [2826, 1462, Math.PI * 0.5, '#f72585'],
  ];
  for (const [px, py, ang, shirt] of pedSpots) {
    state.pedestrians.push({
      x: px,
      y: py,
      angle: ang,
      axis: 'v',
      dir: 1,
      speed: 58,
      radius: 11,
      hp: 40,
      fleeTimer: 0,
      fleeX: 0,
      fleeY: 0,
      walkPhase: 1.5,
      shirt,
      skin: '#f1c27d',
      hair: '#222230',
      cash: 35,
      alive: true,
      deathTimer: 0,
    });
  }

  state.missions.currentIndex = 0;
  state.missions.active = false;
  state.missions.storyLine = 'Elena Cruz: "Meet me by Palm Strip Pier, Marco. Fresh wheels waiting on Ocean Strip."';
  state.missions.storyTimer = 8;
  refreshMissionMarker(state);

  for (let i = 0; i < 4; i++) stepSimulation(1 / 60);
  state.player.nearVehicle = parkedGT;
}

// DRIVING AT DUSK: Stolen Valkyrie Turbo cruising through Downtown neon traffic with bright headlights & 2 wanted stars
function stageDriveShot(state, stepSimulation) {
  clearAreaForStage(state, 1620, 1100, 420);
  state.timeOfDay = 0.44; // rich Solara Dusk / Neon Night
  state.player.money = 2490;
  state.player.health = 92;
  state.player.armor = 40;
  state.player.weaponIndex = 0;

  const car = createVehicle('valkyrie', 1664, 1140, -Math.PI * 0.5, state.rng, {
    color: '#08d9d6',
    driver: 'player',
  });
  car.vx = 0;
  car.vy = -360;
  car.speed = 360;
  car.stolen = true;
  state.vehicles.push(car);
  state.player.vehicle = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;

  // Twin skid marks from cornering onto Solara Ave
  for (let i = 0; i < 12; i++) {
    addSkidMark(state, car.x - 12, car.y + 42 + i * 11, -Math.PI * 0.5);
    addSkidMark(state, car.x + 12, car.y + 42 + i * 11, -Math.PI * 0.5);
  }

  setWantedStars(state, 2);
  state.police.lastCrimeText = 'Grand Theft Auto';
  state.police.lastCrimeTimer = 4;

  const pd = spawnPoliceCruiser(state, { x: 1656, y: 1355, angle: -Math.PI * 0.5 });
  pd.vx = 0;
  pd.vy = -315;
  pd.sirenPhase = 0.4;

  // Busy downtown traffic with headlights shining
  state.vehicles.push(createVehicle('bayside', 1578, 1020, Math.PI * 0.5, state.rng, { color: '#d6dde6', driver: 'traffic' }));
  state.vehicles.push(createVehicle('taxi', 1664, 868, -Math.PI * 0.5, state.rng, { color: '#f7b801', driver: 'traffic' }));
  state.vehicles.push(createVehicle('solaraGT', 1805, 954, 0, state.rng, { color: '#ff8c42', driver: 'traffic' }));
  state.vehicles.push(createVehicle('kodiak', 1425, 888, Math.PI, state.rng, { color: '#6d597a', driver: 'traffic' }));

  state.missions.currentIndex = 0;
  state.missions.active = true;
  state.missions.stepIndex = 1;
  state.missions.storyLine = 'Elena Cruz: "Keep the headlights low and cut southwest to Marina Chop Shop before PD seals the avenue."';
  state.missions.storyTimer = 8;
  refreshMissionMarker(state);

  for (let i = 0; i < 6; i++) stepSimulation(1 / 60);
  state.missions.objectiveText = 'Deliver stolen Valkyrie Turbo to Marina Chop Shop';
}

// MISSION COMBAT: Open Sunset Plaza fountain firefight with muzzle flashes, tracers, particles, enemy health bars & banner
function stageMissionShot(state, stepSimulation) {
  clearAreaForStage(state, 2608, 1855, 360);
  state.timeOfDay = 0.25; // twilight sunset
  state.player.money = 3150;
  state.player.health = 78;
  state.player.armor = 22;
  state.player.vehicle = null;
  state.player.weaponIndex = 1; // Viper SMG
  state.player.x = 2496;
  state.player.y = 1898;
  state.player.angle = -0.22;

  setWantedStars(state, 1);
  state.police.lastCrimeText = 'Gang Shootout';
  state.police.lastCrimeTimer = 4;

  // Getaway car parked right at the edge of Sunset Plaza
  state.vehicles.push(createVehicle('solaraGT', 2436, 1966, -0.35, state.rng, { color: '#ff8c42' }));
  state.vehicles.push(createVehicle('harborVan', 2748, 1732, Math.PI * 0.5, state.rng, { color: '#222f3e' }));

  // Spawn Viper Cartel crew & boss squarely in open Sunset Plaza around the central fountain (2608, 1855)
  state.missions.currentIndex = 1;
  state.missions.active = true;
  state.missions.stepIndex = 1;
  state.missions.enemies = [];
  spawnMissionGang(state, 2665, 1838, [
    { dx: -25, dy: -52, name: 'Viper Guard', hp: 55 },
    { dx: 45, dy: -22, name: 'Viper Enforcer', hp: 70 },
    { dx: 18, dy: 58, name: 'Viper Captain', hp: 120, isBoss: true },
    { dx: 92, dy: 12, name: 'Viper Guard', hp: 70 },
  ]);
  for (const e of state.missions.enemies) {
    e.alerted = true;
    e.angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
  }
  state.missions.enemies[0].hp = 26;
  state.missions.enemies[2].hp = 82;

  state.missions.storyLine = 'Elena Cruz: "That is the Viper Captain by the fountain — finish the crew and take Sunset Plaza!"';
  state.missions.storyTimer = 8;
  state.pushBanner('02 · BOARDWALK DEBT', 'ELIMINATE VIPER CARTEL AT SUNSET PLAZA', '#ff4d6d', 4);
  refreshMissionMarker(state);

  // Fire live tracers, muzzle flashes, and impact sparks across the open plaza
  state.input.mouseX = VIEWPORT_WIDTH * 0.64;
  state.input.mouseY = VIEWPORT_HEIGHT * 0.46;
  firePlayerWeapon(state, -0.22);
  stepSimulation(1 / 60);
  stepSimulation(1 / 60);
  firePlayerWeapon(state, -0.14);
  fireEnemyBullet(state, state.missions.enemies[0].x - 14, state.missions.enemies[0].y + 4, Math.PI - 0.16, 9, '#ff6b6b', 'enemy');
  fireEnemyBullet(state, state.missions.enemies[2].x - 14, state.missions.enemies[2].y - 6, Math.PI + 0.14, 12, '#ffbe0b', 'enemy');

  spawnHitSparks(state, state.missions.enemies[0].x - 6, state.missions.enemies[0].y, '#e63946', 9);
  spawnHitSparks(state, 2595, 1862, '#ffd166', 7);

  for (let i = 0; i < 2; i++) stepSimulation(1 / 60);
  state.player.muzzleFlash = 0.95;
  state.missions.enemies[0].muzzleFlash = 0.92;
  state.missions.enemies[2].muzzleFlash = 0.84;
}
