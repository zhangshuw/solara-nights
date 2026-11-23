// Persistent save/load in localStorage for Solara Nights progress.

const SAVE_KEY = 'solara_nights_save_v1';

export function hasSavedGame() {
  try {
    return Boolean(window.localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function loadSavedGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.playerX !== 'number' || typeof parsed.playerY !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGameState(state) {
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      money: Math.round(state.player.money),
      health: Math.round(state.player.health),
      armor: Math.round(state.player.armor),
      playerX: Math.round(state.player.x),
      playerY: Math.round(state.player.y),
      playerAngle: Number(state.player.angle.toFixed(3)),
      weaponIndex: state.player.weaponIndex,
      ammo: state.player.ammo.map((a) => ({ mag: a.mag, reserve: a.reserve })),
      missionIndex: state.missions.currentIndex,
      missionPhase: state.missions.active ? 'brief' : 'idle',
      wantedStars: state.police.stars,
      wantedHeat: Math.round(state.police.heat),
      timeOfDay: Number(state.timeOfDay.toFixed(4)),
      completedCount: state.missions.completedCount,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedGame() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore restricted storage environments.
  }
}
