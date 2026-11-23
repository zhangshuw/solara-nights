// Solara Nights game bootstrap, simulation loop, state machine, camera controller, and save/shot integration.

import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { SeededRandom, clamp } from './random.js';
import { InputManager } from './input.js';
import { AudioEngine } from './audio.js';
import { createCity } from './city.js';
import { createPlayer, damagePlayer, updatePlayer } from './player.js';
import { resetVehicleIds, updateVehicles } from './vehicles.js';
import { spawnInitialVehicles, updateTraffic } from './traffic.js';
import { spawnInitialPedestrians, updatePedestrians } from './pedestrians.js';
import { createPoliceSystem, getClosestSirenProximity, reportCrime, setWantedStars, updatePolice } from './police.js';
import { fireEnemyBullet, firePlayerWeapon, updateCombat } from './combat.js';
import { createMissionSystem, refreshMissionMarker, updateMissions } from './missions.js';
import { renderWorld } from './render.js';
import { getMenuButtons, renderHud, renderOverlayMenus } from './hud.js';
import { loadSavedGame, saveGameState } from './save.js';
import { parseShotParams, stageShotScene } from './shots.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const input = new InputManager(canvas);
const audio = new AudioEngine();

let state = null;
let lastFrameMs = 0;
let accumulator = 0;
const FIXED_DT = 1 / 60;

function createGameState(seed = 202607, mode = 'title') {
  resetVehicleIds();
  const rng = new SeededRandom(seed);
  const city = createCity(rng.fork(101));
  const player = createPlayer(3052, 1540);
  const police = createPoliceSystem();
  const missions = createMissionSystem();

  const gameState = {
    seed,
    rng,
    city,
    input,
    audio,
    mode, // 'title' | 'playing' | 'paused' | 'controls'
    prevMenuMode: 'title',
    menuIndex: 0,
    shotMode: false,
    time: 0,
    tick: 0,
    timeOfDay: 0.08, // starts at vibrant coastal golden hour transitioning into dusk & neon night
    player,
    vehicles: [],
    pedestrians: [],
    bullets: [],
    particles: [],
    skidMarks: [],
    popups: [],
    police,
    missions,
    banner: null,
    camera: {
      x: player.x - VIEWPORT_WIDTH * 0.5,
      y: player.y - VIEWPORT_HEIGHT * 0.5,
      shake: 0,
      shakeOffsetX: 0,
      shakeOffsetY: 0,
    },

    reportCrime(heat, reason) {
      reportCrime(gameState, heat, reason);
    },
    damagePlayer(amount) {
      damagePlayer(gameState, amount);
    },
    firePlayerWeapon(angle) {
      firePlayerWeapon(gameState, angle);
    },
    fireEnemyBullet(x, y, angle, dmg, color, owner) {
      fireEnemyBullet(gameState, x, y, angle, dmg, color, owner);
    },
    addPopup(x, y, text, color = '#ffffff') {
      gameState.popups.push({ x, y, text, color, life: 1.25, maxLife: 1.25 });
    },
    pushBanner(title, subtitle, color = '#ffd166', duration = 3.2) {
      gameState.banner = { title, subtitle, color, timer: duration };
    },
    autosave() {
      if (!gameState.shotMode) saveGameState(gameState);
    },
  };

  spawnInitialVehicles(gameState);
  spawnInitialPedestrians(gameState);
  refreshMissionMarker(gameState);
  return gameState;
}

function applySavedProgress(gameState, saved) {
  if (!saved) return;
  gameState.player.money = typeof saved.money === 'number' ? saved.money : gameState.player.money;
  gameState.player.health = clamp(saved.health || 100, 25, gameState.player.maxHealth);
  gameState.player.armor = clamp(saved.armor || 0, 0, gameState.player.maxArmor);
  gameState.player.x = clamp(saved.playerX, 120, WORLD_WIDTH - 480);
  gameState.player.y = clamp(saved.playerY, 120, WORLD_HEIGHT - 120);
  gameState.player.angle = saved.playerAngle || 0;
  if (Array.isArray(saved.ammo)) {
    saved.ammo.forEach((slot, idx) => {
      if (gameState.player.ammo[idx] && typeof slot.mag === 'number') {
        gameState.player.ammo[idx].mag = slot.mag;
        gameState.player.ammo[idx].reserve = slot.reserve;
      }
    });
  }
  gameState.player.weaponIndex = clamp(saved.weaponIndex || 0, 0, 2);
  gameState.missions.currentIndex = Math.max(0, saved.missionIndex || 0);
  gameState.missions.completedCount = Math.max(0, saved.completedCount || 0);
  gameState.missions.active = false;
  if (saved.wantedStars > 0) {
    setWantedStars(gameState, saved.wantedStars);
  }
  if (typeof saved.timeOfDay === 'number') {
    gameState.timeOfDay = saved.timeOfDay;
  }
  gameState.camera.x = gameState.player.x - VIEWPORT_WIDTH * 0.5;
  gameState.camera.y = gameState.player.y - VIEWPORT_HEIGHT * 0.5;
  refreshMissionMarker(gameState);
}

function stepSimulation(dt) {
  state.time += dt;
  state.tick++;

  // Advance day/dusk/night cycle slowly during live play
  if (!state.shotMode) {
    state.timeOfDay = (state.timeOfDay + dt * 0.0042) % 1;
  }

  if (state.banner && state.banner.timer > 0) {
    state.banner.timer = Math.max(0, state.banner.timer - dt);
  }

  if (state.mode === 'title') {
    // Gentle cinematic pan over Palm Strip, Solara Pier & moored yachts on the start screen
    updateTraffic(state, dt);
    updateVehicles(state, dt);
    updatePedestrians(state, dt);
    state.camera.x = clamp(2760 + Math.sin(state.time * 0.16) * 210, 0, WORLD_WIDTH - VIEWPORT_WIDTH);
    state.camera.y = clamp(1220 + Math.cos(state.time * 0.12) * 200, 0, WORLD_HEIGHT - VIEWPORT_HEIGHT);
    audio.updateContinuous(dt, { inVehicle: false, speedRatio: 0, sirenProximity: 0, active: false });
    return;
  }

  if (state.mode !== 'playing') {
    audio.updateContinuous(dt, { inVehicle: false, speedRatio: 0, sirenProximity: 0, active: false });
    return;
  }

  updatePlayer(state, dt);
  updateTraffic(state, dt);
  updatePolice(state, dt);
  updateVehicles(state, dt);
  updatePedestrians(state, dt);
  updateCombat(state, dt);
  updateMissions(state, dt);
  updateCamera(dt);

  const speedRatio = state.player.vehicle ? state.player.vehicle.speed / state.player.vehicle.maxSpeed : 0;
  audio.updateContinuous(dt, {
    inVehicle: Boolean(state.player.vehicle),
    speedRatio,
    sirenProximity: getClosestSirenProximity(state),
    active: true,
  });
}

function updateCamera(dt) {
  const { player, camera } = state;
  const leadScale = player.vehicle ? 0.28 : 0.12;
  const targetX = clamp(
    player.x + player.vx * leadScale - VIEWPORT_WIDTH * 0.5,
    0,
    WORLD_WIDTH - VIEWPORT_WIDTH,
  );
  const targetY = clamp(
    player.y + player.vy * leadScale - VIEWPORT_HEIGHT * 0.5,
    0,
    WORLD_HEIGHT - VIEWPORT_HEIGHT,
  );

  const smooth = 1 - Math.exp(-7.5 * dt);
  camera.x += (targetX - camera.x) * smooth;
  camera.y += (targetY - camera.y) * smooth;

  if (camera.shake > 0.05) {
    camera.shakeOffsetX = state.rng.range(-camera.shake, camera.shake);
    camera.shakeOffsetY = state.rng.range(-camera.shake, camera.shake);
    camera.shake *= Math.exp(-12 * dt);
  } else {
    camera.shake = 0;
    camera.shakeOffsetX = 0;
    camera.shakeOffsetY = 0;
  }
}

function handleMenuAndGlobalKeys() {
  if (input.anyInteraction) {
    audio.unlock();
  }

  if (input.wasPressed('KeyM')) {
    audio.toggleMute();
  }

  if (state.mode === 'playing') {
    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
      state.mode = 'paused';
      state.menuIndex = 0;
      audio.playUiBlip(420, 0.07);
    }
    return;
  }

  const buttons = getMenuButtons(state.mode);
  if (buttons.length === 0) return;

  if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
    state.menuIndex = (state.menuIndex + 1) % buttons.length;
    audio.playUiBlip(460, 0.05);
  }
  if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
    state.menuIndex = (state.menuIndex - 1 + buttons.length) % buttons.length;
    audio.playUiBlip(460, 0.05);
  }

  if (input.wasPressed('Escape')) {
    if (state.mode === 'paused') {
      state.mode = 'playing';
      audio.playUiBlip(540, 0.07);
      return;
    }
    if (state.mode === 'controls') {
      state.mode = state.prevMenuMode;
      state.menuIndex = 0;
      audio.playUiBlip(460, 0.07);
      return;
    }
  }

  // Click detection on menu buttons
  if (input.mouseJustPressed) {
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      if (input.mouseX >= b.x && input.mouseX <= b.x + b.w && input.mouseY >= b.y && input.mouseY <= b.y + b.h) {
        activateMenuButton(b.id);
        return;
      }
    }
  }

  if (input.wasPressed('Enter') || input.wasPressed('Space')) {
    const active = buttons[clamp(state.menuIndex, 0, buttons.length - 1)];
    if (active) activateMenuButton(active.id);
  }
}

function activateMenuButton(id) {
  audio.unlock();
  audio.playUiBlip(640, 0.09);

  if (id === 'start') {
    state = createGameState(202607, 'playing');
    state.pushBanner('SOLARA NIGHTS', 'Welcome to Solara Bay, Marco Vega', '#ffd166', 3.4);
  } else if (id === 'continue') {
    const saved = loadSavedGame();
    state = createGameState(202607, 'playing');
    applySavedProgress(state, saved);
    state.pushBanner('WELCOME BACK', 'Progress restored in Solara Bay', '#2ef2ff', 2.8);
  } else if (id === 'controls') {
    state.prevMenuMode = state.mode;
    state.mode = 'controls';
    state.menuIndex = 0;
  } else if (id === 'back') {
    state.mode = state.prevMenuMode;
    state.menuIndex = 0;
  } else if (id === 'resume') {
    state.mode = 'playing';
  } else if (id === 'save') {
    const ok = saveGameState(state);
    state.mode = 'playing';
    state.pushBanner(ok ? 'GAME SAVED' : 'SAVE FAILED', 'Stored locally in Solara Bay ledger', '#3effa8', 2.2);
  } else if (id === 'title') {
    saveGameState(state);
    state = createGameState(202607, 'title');
  }
}

function renderFrame() {
  renderWorld(ctx, state);
  if (state.mode !== 'title') {
    renderHud(ctx, state);
  }
  renderOverlayMenus(ctx, state);
}

function loop(nowMs) {
  if (!lastFrameMs) lastFrameMs = nowMs;
  const elapsed = Math.min((nowMs - lastFrameMs) / 1000, 0.08);
  lastFrameMs = nowMs;

  handleMenuAndGlobalKeys();

  accumulator += elapsed;
  while (accumulator >= FIXED_DT) {
    stepSimulation(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  renderFrame();
  input.endFrame();
  window.requestAnimationFrame(loop);
}

function bootstrap() {
  const { shot, seed } = parseShotParams();
  if (shot) {
    state = createGameState(seed, 'playing');
    stageShotScene(state, shot, stepSimulation);
    renderFrame();
    window.__shotReady = true;
    return;
  }

  state = createGameState(seed, 'title');
  window.addEventListener('beforeunload', () => {
    if (state && state.mode === 'playing' && !state.shotMode) {
      saveGameState(state);
    }
  });
  renderFrame();
  window.requestAnimationFrame(loop);
}

bootstrap();
