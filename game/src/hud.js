// Readable coastal-noir HUD, wanted stars, objective bar, banners, title screen, pause menu, and controls overlay.

import { COLORS, VIEWPORT_HEIGHT, VIEWPORT_WIDTH, WEAPONS } from './config.js';
import { getDistrictName } from './city.js';
import { getActiveWeapon } from './player.js';
import { hasSavedGame } from './save.js';
import { clamp, dist } from './random.js';
import { roundRect, sampleLighting } from './render.js';
import { renderMinimap } from './minimap.js';

export function renderHud(ctx, state) {
  const { player, police, missions } = state;

  // Top-right tactical minimap
  renderMinimap(ctx, state);

  // Off-screen objective directional indicator
  if (missions.marker && !state.player.dead) {
    drawOffscreenArrow(ctx, state, missions.marker);
  }

  // Top-left: Health, Armor, Stamina, Money, Weapon & Ammo
  const panelX = 18;
  const panelY = 18;
  ctx.save();

  ctx.fillStyle = COLORS.hudBg;
  ctx.strokeStyle = COLORS.hudBorder;
  ctx.lineWidth = 1.5;
  roundRect(ctx, panelX, panelY, 276, 116, 12);
  ctx.fill();
  ctx.stroke();

  // Cash counter & district
  ctx.font = '800 22px Segoe UI, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#3effa8';
  ctx.fillText(`$${Math.floor(player.money).toLocaleString()}`, panelX + 14, panelY + 30);

  const district = getDistrictName(player.x, player.y);
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb347';
  ctx.fillText(district, panelX + 262, panelY + 26);

  // Health bar
  drawMeter(ctx, panelX + 14, panelY + 44, 152, 11, player.health / player.maxHealth, '#ff4d6d', 'HP');
  // Armor bar
  drawMeter(ctx, panelX + 14, panelY + 62, 152, 8, player.armor / player.maxArmor, '#4cc9f0', 'AR');
  // Stamina bar
  drawMeter(ctx, panelX + 14, panelY + 76, 152, 6, player.stamina / player.maxStamina, '#ffd166', '');

  // Weapon & ammo readout box
  const weapon = getActiveWeapon(player);
  const slot = player.ammo[player.weaponIndex];
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, panelX + 176, panelY + 40, 88, 48, 8);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff9f1c';
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.fillText(weapon.shortName, panelX + 220, panelY + 56);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 15px Segoe UI, sans-serif';
  const ammoText = player.reloadTimer > 0 ? 'RELOAD' : `${slot.mag}/${slot.reserve}`;
  ctx.fillText(ammoText, panelX + 220, panelY + 78);

  // Bottom bar inside top-left panel: weapon slot selector + mute indicator
  ctx.textAlign = 'left';
  ctx.font = '600 10px Segoe UI, sans-serif';
  WEAPONS.forEach((w, idx) => {
    const active = idx === player.weaponIndex;
    ctx.fillStyle = active ? '#ffd166' : 'rgba(203, 213, 225, 0.5)';
    ctx.fillText(`[${idx + 1}] ${w.shortName}`, panelX + 14 + idx * 62, panelY + 104);
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = state.audio.muted ? '#ff6b6b' : '#94a3b8';
  ctx.fillText(state.audio.muted ? 'M: MUTED' : 'M: SFX ON', panelX + 262, panelY + 104);

  // Wanted level stars (top-center-right, directly left of minimap)
  drawWantedStars(ctx, VIEWPORT_WIDTH - 222, 24, police, state.time);

  // Speedometer / Vehicle status pill when driving
  if (player.vehicle) {
    const mph = Math.round(player.vehicle.speed * 0.22);
    const vx = VIEWPORT_WIDTH - 204;
    const vy = 216;
    ctx.fillStyle = COLORS.hudBg;
    ctx.strokeStyle = 'rgba(46, 242, 255, 0.42)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, vx, vy, 186, 46, 10);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#2ef2ff';
    ctx.font = '800 18px Segoe UI, sans-serif';
    ctx.fillText(`${mph} MPH`, vx + 12, vy + 24);

    ctx.font = '600 10px Segoe UI, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(player.vehicle.name.toUpperCase(), vx + 12, vy + 39);

    // Vehicle integrity bar
    const hpRatio = clamp(player.vehicle.hp / player.vehicle.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(vx + 110, vy + 14, 64, 7);
    ctx.fillStyle = hpRatio > 0.4 ? '#3effa8' : '#ff4d6d';
    ctx.fillRect(vx + 110, vy + 14, 64 * hpRatio, 7);
  } else {
    // Time-of-day tag below minimap when on foot
    const lightInfo = sampleLighting(state.timeOfDay);
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, VIEWPORT_WIDTH - 204, 214, 186, 26, 8);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillStyle = '#ffb347';
    ctx.fillText(`${lightInfo.label}  ·  ${district}`, VIEWPORT_WIDTH - 111, 231);
  }

  // Bottom-left: Mission objective card + distance
  drawObjectivePanel(ctx, state);

  // Story subtitle bar (bottom center)
  if (missions.storyTimer > 0 && missions.storyLine) {
    const sw = 680;
    const sx = (VIEWPORT_WIDTH - sw) * 0.5;
    const sy = VIEWPORT_HEIGHT - 54;
    ctx.fillStyle = 'rgba(9, 12, 22, 0.84)';
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.4)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, sx, sy, sw, 36, 9);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '600 13px Segoe UI, sans-serif';
    ctx.fillStyle = '#fff5d6';
    ctx.fillText(missions.storyLine, VIEWPORT_WIDTH * 0.5, sy + 22);
  }

  // Interaction prompt ("Press E to steal Solara GT")
  if (!player.vehicle && player.nearVehicle && !player.dead) {
    const prompt = `PRESS [E] TO ${player.nearVehicle.stolen ? 'DRIVE' : 'STEAL'} ${player.nearVehicle.name.toUpperCase()}`;
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    const pw = ctx.measureText(prompt).width + 26;
    const px = (VIEWPORT_WIDTH - pw) * 0.5;
    const py = VIEWPORT_HEIGHT - 96;
    ctx.fillStyle = 'rgba(11, 14, 26, 0.88)';
    ctx.strokeStyle = '#2ef2ff';
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, 28, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2ef2ff';
    ctx.fillText(prompt, VIEWPORT_WIDTH * 0.5, py + 18);
  }

  // Big centered mission/event banner
  if (state.banner && state.banner.timer > 0) {
    const alpha = clamp(state.banner.timer * 1.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = 460;
    const bx = (VIEWPORT_WIDTH - bw) * 0.5;
    const by = 110;
    ctx.fillStyle = 'rgba(10, 12, 24, 0.9)';
    ctx.strokeStyle = state.banner.color;
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, 76, 12);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = state.banner.color;
    ctx.font = '900 24px Segoe UI, sans-serif';
    ctx.fillText(state.banner.title, VIEWPORT_WIDTH * 0.5, by + 35);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 13px Segoe UI, sans-serif';
    ctx.fillText(state.banner.subtitle, VIEWPORT_WIDTH * 0.5, by + 58);
    ctx.restore();
  }

  // Wasted respawn overlay when downed
  if (player.dead) {
    ctx.fillStyle = 'rgba(18, 6, 12, 0.56)';
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
    ctx.textAlign = 'center';
    ctx.font = '900 58px Segoe UI, sans-serif';
    ctx.fillStyle = '#ff4d6d';
    ctx.fillText('WASTED', VIEWPORT_WIDTH * 0.5, VIEWPORT_HEIGHT * 0.46);
    ctx.font = '700 16px Segoe UI, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(
      `Solara General ambulance inbound (${Math.max(1, Math.ceil(player.respawnTimer))}s) · Press ENTER to respawn`,
      VIEWPORT_WIDTH * 0.5,
      VIEWPORT_HEIGHT * 0.53,
    );
  }

  // Subtle controls bar at bottom right
  ctx.textAlign = 'right';
  ctx.font = '600 10px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(203, 213, 225, 0.65)';
  ctx.fillText('WASD Move/Drive · SHIFT Sprint/Drift · E Car · LMB Shoot · R Reload · ESC Pause', VIEWPORT_WIDTH - 18, VIEWPORT_HEIGHT - 12);

  // Aim reticle (when actively playing)
  if (state.mode === 'playing' && !player.dead && !state.shotMode) {
    drawReticle(ctx, state.input.mouseX, state.input.mouseY);
  }

  ctx.restore();
}

function drawMeter(ctx, x, y, w, h, ratio, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  roundRect(ctx, x, y, w, h, 3);
  ctx.fill();

  const fillW = Math.max(0, w * clamp(ratio, 0, 1));
  if (fillW > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, fillW, h, 3);
    ctx.fill();
  }

  if (label) {
    ctx.font = 'bold 9px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(label, x + w - 4, y + h - 1.5);
  }
}

function drawWantedStars(ctx, rightX, topY, police, time) {
  const starSpacing = 28;
  const startX = rightX - starSpacing * 4;
  const flash = police.evading ? Math.sin(time * 9) > 0 : true;

  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  ctx.strokeStyle = police.stars > 0 ? 'rgba(255, 77, 109, 0.55)' : 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.4;
  roundRect(ctx, startX - 20, topY - 6, 156, 46, 10);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < 5; i++) {
    const active = i < police.stars;
    const sx = startX + i * starSpacing;
    const sy = topY + 12;
    drawStar(
      ctx,
      sx,
      sy,
      10,
      4.5,
      active ? (flash ? '#ffd166' : 'rgba(255, 209, 102, 0.32)') : 'rgba(148, 163, 184, 0.25)',
      active ? '#ff6b35' : 'rgba(255,255,255,0.1)',
    );
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  if (police.stars > 0) {
    ctx.fillStyle = police.evading ? '#2ef2ff' : '#ff4d6d';
    const status = police.evading
      ? `EVADING · ${Math.ceil(police.evadeTimer)}s`
      : police.lastCrimeTimer > 0 && police.lastCrimeText
        ? police.lastCrimeText.toUpperCase()
        : `SOLARA PD PURSUIT (${police.stars}★)`;
    ctx.fillText(status, startX + 56, topY + 34);
  } else {
    ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
    ctx.fillText('HEAT: CLEAR', startX + 56, topY + 34);
  }
  ctx.restore();
}

function drawObjectivePanel(ctx, state) {
  const { missions, player } = state;
  const x = 18;
  const y = VIEWPORT_HEIGHT - 104;
  const w = 340;
  const h = 76;

  ctx.save();
  ctx.fillStyle = COLORS.hudBg;
  ctx.strokeStyle = missions.active ? 'rgba(62, 255, 168, 0.48)' : 'rgba(255, 209, 102, 0.48)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.fillStyle = missions.active ? '#3effa8' : '#ffd166';
  ctx.fillText(missions.active ? 'ACTIVE OBJECTIVE' : 'NEXT CONTRACT', x + 12, y + 18);

  if (missions.marker) {
    const meters = Math.round(dist(player.x, player.y, missions.marker.x, missions.marker.y) * 0.25);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2ef2ff';
    ctx.fillText(`${meters}m`, x + w - 12, y + 18);
  }

  ctx.textAlign = 'left';
  ctx.font = '700 13px Segoe UI, sans-serif';
  ctx.fillStyle = '#f8fafc';
  wrapText(ctx, missions.objectiveText, x + 12, y + 38, w - 24, 17, 2);
  ctx.restore();
}

function drawOffscreenArrow(ctx, state, marker) {
  const sx = marker.x - state.camera.x;
  const sy = marker.y - state.camera.y;
  if (sx >= 40 && sx <= VIEWPORT_WIDTH - 40 && sy >= 40 && sy <= VIEWPORT_HEIGHT - 40) return;

  const cx = VIEWPORT_WIDTH * 0.5;
  const cy = VIEWPORT_HEIGHT * 0.5;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ax = clamp(cx + Math.cos(ang) * 560, 44, VIEWPORT_WIDTH - 44);
  const ay = clamp(cy + Math.sin(ang) * 300, 44, VIEWPORT_HEIGHT - 44);

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = marker.color;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0b0e1a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawReticle(ctx, mx, my) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 224, 130, 0.9)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(mx, my, 9, 0, Math.PI * 2);
  ctx.moveTo(mx - 14, my);
  ctx.lineTo(mx - 5, my);
  ctx.moveTo(mx + 5, my);
  ctx.lineTo(mx + 14, my);
  ctx.moveTo(mx, my - 14);
  ctx.lineTo(mx, my - 5);
  ctx.moveTo(mx, my + 5);
  ctx.lineTo(mx, my + 14);
  ctx.stroke();
  ctx.restore();
}

export function getMenuButtons(mode) {
  const hasSave = hasSavedGame();
  if (mode === 'title') {
    const items = [{ id: 'start', label: 'NEW GAME' }];
    if (hasSave) items.push({ id: 'continue', label: 'CONTINUE SAVE' });
    items.push({ id: 'controls', label: 'CONTROLS' });
    return items.map((item, i) => ({
      ...item,
      x: 112,
      y: 356 + i * 64,
      w: 280,
      h: 48,
    }));
  }
  if (mode === 'paused') {
    return [
      { id: 'resume', label: 'RESUME', x: 500, y: 274, w: 280, h: 48 },
      { id: 'save', label: 'SAVE PROGRESS', x: 500, y: 336, w: 280, h: 48 },
      { id: 'controls', label: 'CONTROLS', x: 500, y: 398, w: 280, h: 48 },
      { id: 'title', label: 'TITLE SCREEN', x: 500, y: 460, w: 280, h: 48 },
    ];
  }
  if (mode === 'controls') {
    return [{ id: 'back', label: 'BACK (ENTER / ESC)', x: 500, y: 556, w: 280, h: 48 }];
  }
  return [];
}

export function renderOverlayMenus(ctx, state) {
  if (state.mode === 'title') {
    renderTitleScreen(ctx, state);
  } else if (state.mode === 'paused') {
    renderPauseMenu(ctx, state);
  } else if (state.mode === 'controls') {
    renderControlsOverlay(ctx, state);
  }
}

function renderTitleScreen(ctx, state) {
  // Dramatic coastal sunset gradient overlay over live city backdrop
  const grad = ctx.createLinearGradient(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  grad.addColorStop(0, 'rgba(10, 11, 24, 0.9)');
  grad.addColorStop(0.55, 'rgba(32, 16, 46, 0.62)');
  grad.addColorStop(1, 'rgba(255, 89, 100, 0.24)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  // Decorative neon horizon stripes
  ctx.fillStyle = '#ff4d94';
  ctx.fillRect(112, 134, 84, 5);
  ctx.fillStyle = '#2ef2ff';
  ctx.fillRect(204, 134, 46, 5);

  ctx.textAlign = 'left';
  ctx.font = '700 13px Segoe UI, sans-serif';
  ctx.fillStyle = '#2ef2ff';
  ctx.fillText('SOLARA BAY  ·  OPEN-WORLD CRIME SANDBOX', 112, 162);

  // Title logotype
  ctx.font = '900 76px Segoe UI, sans-serif';
  ctx.fillStyle = '#ff4d94';
  ctx.fillText('SOLARA', 110, 238);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('NIGHTS', 110, 304);

  ctx.font = '500 16px Segoe UI, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('Steal fast cars, outrun a 5-star coastal manhunt, and climb the syndicate.', 112, 336);

  const buttons = getMenuButtons('title');
  drawMenuButtons(ctx, buttons, state.menuIndex, state.input);

  // Right-side feature card
  const cx = 770;
  const cy = 198;
  ctx.fillStyle = 'rgba(11, 14, 26, 0.78)';
  ctx.strokeStyle = 'rgba(255, 166, 110, 0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, cx, cy, 400, 290, 14);
  ctx.fill();
  ctx.stroke();

  ctx.font = '800 14px Segoe UI, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('TONIGHT IN SOLARA BAY', cx + 24, cy + 36);

  const lines = [
    '• 6-Mission Underworld Campaign (Marco Vega & Elena Cruz)',
    '• Sun-Soaked Coastline, Neon Palm Strip, Parks & Port Docks',
    '• Drifting Vehicles, Road-Grid Traffic & Fleeing Pedestrians',
    '• 5-Star Police Response with Pursuit Cruisers & Air-1 Chopper',
    '• Pistol, SMG & Shotgun Combat + Local Save Persistence',
  ];
  ctx.font = '500 13px Segoe UI, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  lines.forEach((line, idx) => {
    ctx.fillText(line, cx + 24, cy + 74 + idx * 38);
  });

  ctx.font = '600 12px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.fillText('Use Arrow Keys + Enter or click a button to begin.', 112, VIEWPORT_HEIGHT - 36);
}

function renderPauseMenu(ctx, state) {
  ctx.fillStyle = 'rgba(8, 10, 20, 0.72)';
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  ctx.fillStyle = 'rgba(13, 17, 32, 0.94)';
  ctx.strokeStyle = 'rgba(255, 166, 110, 0.45)';
  ctx.lineWidth = 2;
  roundRect(ctx, 440, 170, 400, 380, 16);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 34px Segoe UI, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('PAUSED', VIEWPORT_WIDTH * 0.5, 232);

  drawMenuButtons(ctx, getMenuButtons('paused'), state.menuIndex, state.input);
}

function renderControlsOverlay(ctx, state) {
  ctx.fillStyle = 'rgba(8, 10, 20, 0.84)';
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  ctx.fillStyle = 'rgba(13, 17, 32, 0.96)';
  ctx.strokeStyle = 'rgba(46, 242, 255, 0.48)';
  ctx.lineWidth = 2;
  roundRect(ctx, 310, 106, 660, 524, 16);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '900 30px Segoe UI, sans-serif';
  ctx.fillStyle = '#2ef2ff';
  ctx.fillText('SOLARA NIGHTS · CONTROLS', VIEWPORT_WIDTH * 0.5, 158);

  const rows = [
    ['W A S D / Arrows', 'Walk, Run, or Drive & Steer'],
    ['Shift / Space', 'Sprint on Foot · Handbrake Drift in Car'],
    ['E', 'Steal / Enter / Exit Nearest Vehicle'],
    ['Mouse + Left Click', 'Aim & Fire Weapon (On Foot or Drive-By)'],
    ['1 / 2 / 3 / Q', 'Switch Weapon (9mm · SMG · Shotgun)'],
    ['R', 'Reload Current Weapon'],
    ['M', 'Toggle Synthesized Audio Mute'],
    ['Esc / P', 'Pause & Save Progress'],
  ];

  ctx.font = '700 14px Segoe UI, sans-serif';
  rows.forEach(([key, desc], idx) => {
    const ry = 208 + idx * 40;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(key, 560, ry);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(desc, 592, ry);
  });

  drawMenuButtons(ctx, getMenuButtons('controls'), state.menuIndex, state.input);
}

function drawMenuButtons(ctx, buttons, selectedIndex, input) {
  buttons.forEach((btn, i) => {
    const hovered =
      input.mouseX >= btn.x &&
      input.mouseX <= btn.x + btn.w &&
      input.mouseY >= btn.y &&
      input.mouseY <= btn.y + btn.h;
    const active = hovered || i === selectedIndex;

    ctx.fillStyle = active ? '#ff4d94' : 'rgba(15, 20, 38, 0.88)';
    ctx.strokeStyle = active ? '#ffd166' : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = active ? 2.2 : 1.4;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '800 15px Segoe UI, sans-serif';
    ctx.fillStyle = active ? '#0b0e1a' : '#f8fafc';
    ctx.fillText(btn.label, btn.x + btn.w * 0.5, btn.y + 30);
  });
}

function drawStar(ctx, cx, cy, outerR, innerR, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || '').split(' ');
  let line = '';
  let lineNum = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineNum * lineHeight);
      line = words[i];
      lineNum++;
      if (lineNum >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lineNum < maxLines) {
    ctx.fillText(line, x, y + lineNum * lineHeight);
  }
}
