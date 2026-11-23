// Top-right tactical radar minimap displaying coastline, roads, buildings, traffic, police, helicopter, enemies, and mission marker.

import {
  BEACH_START_X,
  HORIZONTAL_ROADS,
  VERTICAL_ROADS,
  VIEWPORT_WIDTH,
  WATER_START_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';
import { clamp } from './random.js';
import { roundRect } from './render.js';

export function renderMinimap(ctx, state) {
  const size = 186;
  const pad = 18;
  const x = VIEWPORT_WIDTH - size - pad;
  const y = pad;
  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  const scale = 0.088; // world px -> minimap px (shows ~2100px span around player)

  const px = state.player.x;
  const py = state.player.y;

  ctx.save();

  // Outer panel shadow & border
  ctx.fillStyle = 'rgba(8, 11, 22, 0.88)';
  roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 16);
  ctx.fill();

  // Clip radar interior
  roundRect(ctx, x, y, size, size, 12);
  ctx.save();
  ctx.clip();

  // Urban background
  ctx.fillStyle = '#141a2b';
  ctx.fillRect(x, y, size, size);

  const toMapX = (wx) => cx + (wx - px) * scale;
  const toMapY = (wy) => cy + (wy - py) * scale;

  // Beach & ocean on east edge
  const beachX = toMapX(BEACH_START_X);
  const waterX = toMapX(WATER_START_X);
  ctx.fillStyle = '#5f5646';
  ctx.fillRect(beachX, toMapY(0), Math.max(0, waterX - beachX), WORLD_HEIGHT * scale);
  ctx.fillStyle = '#124e73';
  ctx.fillRect(waterX, toMapY(0), (WORLD_WIDTH - WATER_START_X + 600) * scale, WORLD_HEIGHT * scale);

  // Parks
  ctx.fillStyle = '#20573e';
  for (const park of state.city.parks) {
    ctx.fillRect(toMapX(park.x), toMapY(park.y), park.w * scale, park.h * scale);
  }

  // Buildings
  ctx.fillStyle = '#252e45';
  for (const b of state.city.buildings) {
    const bx = toMapX(b.x);
    const by = toMapY(b.y);
    const bw = b.w * scale;
    const bh = b.h * scale;
    if (bx + bw < x || bx > x + size || by + bh < y || by > y + size) continue;
    ctx.fillRect(bx, by, bw, bh);
  }

  // Road grid
  ctx.fillStyle = '#4f5d7a';
  for (const vr of VERTICAL_ROADS) {
    ctx.fillRect(toMapX(vr.x - vr.width * 0.5), toMapY(0), vr.width * scale, WORLD_HEIGHT * scale);
  }
  for (const hr of HORIZONTAL_ROADS) {
    ctx.fillRect(toMapX(0), toMapY(hr.y - hr.width * 0.5), BEACH_START_X * scale, hr.width * scale);
  }

  // Health/armor pickups
  for (const p of state.city.pickups) {
    if (!p.active) continue;
    const mx = toMapX(p.x);
    const my = toMapY(p.y);
    if (mx < x || mx > x + size || my < y || my > y + size) continue;
    ctx.fillStyle = p.kind === 'health' ? '#3effa8' : p.kind === 'armor' ? '#4cc9f0' : '#ffd166';
    ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
  }

  // Traffic & police vehicle blips
  const flash = Math.sin(state.time * 12) > 0;
  for (const v of state.vehicles) {
    if (v === state.player.vehicle || v.destroyed) continue;
    const mx = toMapX(v.x);
    const my = toMapY(v.y);
    if (mx < x - 6 || mx > x + size + 6 || my < y - 6 || my > y + size + 6) continue;

    if (v.isPolice) {
      ctx.fillStyle = flash ? '#ff2a55' : '#2ef2ff';
      ctx.beginPath();
      ctx.arc(mx, my, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (v.missionTag) {
      ctx.fillStyle = '#2ef2ff';
      ctx.fillRect(mx - 3.5, my - 3.5, 7, 7);
    } else {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.58)';
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
  }

  // Mission enemies
  for (const e of state.missions.enemies) {
    if (!e.alive) continue;
    const mx = toMapX(e.x);
    const my = toMapY(e.y);
    if (mx < x - 6 || mx > x + size + 6 || my < y - 6 || my > y + size + 6) continue;
    ctx.fillStyle = e.isBoss ? '#ffbe0b' : '#ff4d6d';
    ctx.beginPath();
    ctx.arc(mx, my, e.isBoss ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Police helicopter blip
  if (state.police.heli) {
    const hx = clamp(toMapX(state.police.heli.x), x + 10, x + size - 10);
    const hy = clamp(toMapY(state.police.heli.y), y + 10, y + size - 10);
    ctx.strokeStyle = flash ? '#2ef2ff' : '#ff2a55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 6, hy);
    ctx.lineTo(hx + 6, hy);
    ctx.moveTo(hx, hy - 6);
    ctx.lineTo(hx, hy + 6);
    ctx.stroke();
  }

  // Mission objective waypoint (clamped to radar edge if off-radar)
  if (state.missions.marker) {
    const m = state.missions.marker;
    const rawX = toMapX(m.x);
    const rawY = toMapY(m.y);
    const clampedX = clamp(rawX, x + 11, x + size - 11);
    const clampedY = clamp(rawY, y + 11, y + size - 11);

    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(clampedX, clampedY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b0e1a';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Player directional chevron at center
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-2.5, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0b0e1a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end clip

  // Radar rim border (pulses red/blue during active police chase!)
  ctx.strokeStyle =
    state.police.stars > 0
      ? flash
        ? 'rgba(255, 42, 85, 0.88)'
        : 'rgba(46, 242, 255, 0.88)'
      : 'rgba(255, 166, 110, 0.48)';
  ctx.lineWidth = 2.2;
  roundRect(ctx, x, y, size, size, 12);
  ctx.stroke();

  // Compass "N" tag
  ctx.fillStyle = '#0b0e1a';
  ctx.beginPath();
  ctx.arc(cx, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, y + 0.5);

  ctx.restore();
}
