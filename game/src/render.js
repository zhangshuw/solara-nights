// Layered top-down 2.5D coastal city renderer: ocean, beach, roads, extruded buildings, neon signs, vehicles, characters, helicopter, and lighting.

import {
  BEACH_START_X,
  BOARDWALK_X,
  COLORS,
  HORIZONTAL_ROADS,
  LIGHTING_KEYFRAMES,
  SIDEWALK_WIDTH,
  VERTICAL_ROADS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WATER_START_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';
import { clamp, lerp } from './random.js';

export function sampleLighting(timeOfDay) {
  const t = ((timeOfDay % 1) + 1) % 1;
  const frames = LIGHTING_KEYFRAMES;
  let a = frames[frames.length - 1];
  let b = frames[0];
  let span = 1 - a.t + b.t;
  let pos = t >= a.t ? t - a.t : 1 - a.t + t;

  for (let i = 0; i < frames.length - 1; i++) {
    if (t >= frames[i].t && t <= frames[i + 1].t) {
      a = frames[i];
      b = frames[i + 1];
      span = b.t - a.t;
      pos = t - a.t;
      break;
    }
  }
  const f = span > 0 ? clamp(pos / span, 0, 1) : 0;
  return {
    r: Math.round(lerp(a.tint[0], b.tint[0], f)),
    g: Math.round(lerp(a.tint[1], b.tint[1], f)),
    b: Math.round(lerp(a.tint[2], b.tint[2], f)),
    a: lerp(a.tint[3], b.tint[3], f),
    darkness: lerp(a.darkness, b.darkness, f),
    lights: lerp(a.lights, b.lights, f),
    label: f < 0.5 ? a.label : b.label,
  };
}

export function renderWorld(ctx, state) {
  const { camera, city, time, timeOfDay } = state;
  const lighting = sampleLighting(timeOfDay);

  const shakeX = camera.shakeOffsetX || 0;
  const shakeY = camera.shakeOffsetY || 0;
  const camX = camera.x + shakeX;
  const camY = camera.y + shakeY;
  const camCenterX = camX + VIEWPORT_WIDTH * 0.5;
  const camCenterY = camY + VIEWPORT_HEIGHT * 0.5;

  ctx.save();
  ctx.translate(-camX, -camY);

  // 1. Base terrain (urban ground, sand, animated ocean)
  drawTerrainAndCoast(ctx, camX, camY, time);

  // 2. Parks & plazas
  drawParks(ctx, city, camX, camY, time);

  // 3. Road grid, sidewalks, crosswalks, lane stripes & dusk neon reflections
  drawRoads(ctx, city, camX, camY, lighting, time);

  // 4. Piers, moored yachts & boardwalk details
  drawPiersAndBeachProps(ctx, city, camX, camY, time);

  // 5. Tire skid marks
  drawSkidMarks(ctx, state.skidMarks, camX, camY);

  // 6. Pickups & mission ground beacons
  drawPickups(ctx, city.pickups, camX, camY, time);
  drawMissionBeacon(ctx, state.missions.marker, time);

  // 7. Ground shadows & vehicles
  drawVehicles(ctx, state.vehicles, camX, camY, lighting, time);

  // 8. Pedestrians, officers, mission enemies, and player
  drawCharacters(ctx, state, camX, camY);

  // 9. Bullets & tracers
  drawBullets(ctx, state.bullets);

  // 10. 2.5D extruded perspective buildings & neon signs
  drawBuildings(ctx, city, camX, camY, camCenterX, camCenterY, lighting);
  drawNeonSigns(ctx, city.neonSigns, camX, camY, lighting, time);

  // 11. Palm & canopy trees (overhead foliage)
  drawTrees(ctx, city.trees, camX, camY, time);

  // 12. Street lamp posts & ground glow pools
  drawStreetLamps(ctx, city.lamps, camX, camY, lighting);

  // 13. Particles (sparks, blood, smoke, explosions)
  drawParticles(ctx, state.particles, camX, camY);

  // 14. Police Helicopter Air-1 & sweeping searchlight cone
  if (state.police.heli) {
    drawPoliceHelicopter(ctx, state.police.heli, lighting, time);
  }

  // 15. Floating popups (+$ cash, +HP, WANTED CLEARED)
  drawPopups(ctx, state.popups);

  ctx.restore();

  // 16. Atmospheric day/dusk/night tint + headlight/neon bloom + vignette
  drawAtmosphereOverlay(ctx, state, camX, camY, lighting);
}

function drawTerrainAndCoast(ctx, camX, camY, time) {
  const vx1 = camX - 40;
  const vy1 = camY - 40;
  const vw = VIEWPORT_WIDTH + 80;
  const vh = VIEWPORT_HEIGHT + 80;

  // Urban concrete ground
  ctx.fillStyle = '#333a4b';
  ctx.fillRect(vx1, vy1, vw, vh);

  // Boardwalk timber strip
  if (vx1 + vw >= BOARDWALK_X - 20) {
    ctx.fillStyle = COLORS.boardwalk;
    ctx.fillRect(BOARDWALK_X, 0, BEACH_START_X - BOARDWALK_X, WORLD_HEIGHT);

    // Subtle timber plank seams
    ctx.strokeStyle = 'rgba(42, 26, 12, 0.28)';
    ctx.lineWidth = 1;
    const startY = Math.max(0, Math.floor(vy1 / 18) * 18);
    const endY = Math.min(WORLD_HEIGHT, vy1 + vh);
    ctx.beginPath();
    for (let y = startY; y <= endY; y += 18) {
      ctx.moveTo(BOARDWALK_X, y);
      ctx.lineTo(BEACH_START_X, y);
    }
    ctx.stroke();

    // Sandy beach gradient
    const sandGrad = ctx.createLinearGradient(BEACH_START_X, 0, WATER_START_X + 20, 0);
    sandGrad.addColorStop(0, COLORS.sandLight);
    sandGrad.addColorStop(0.7, COLORS.sandWarm);
    sandGrad.addColorStop(1, '#c9a66b');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(BEACH_START_X, 0, WATER_START_X - BEACH_START_X + 25, WORLD_HEIGHT);

    // Ocean gradient
    const seaGrad = ctx.createLinearGradient(WATER_START_X, 0, WORLD_WIDTH + 160, 0);
    seaGrad.addColorStop(0, COLORS.oceanShallow);
    seaGrad.addColorStop(0.45, COLORS.oceanMid);
    seaGrad.addColorStop(1, COLORS.oceanDeep);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(WATER_START_X, 0, WORLD_WIDTH - WATER_START_X + 260, WORLD_HEIGHT);

    // Animated shoreline surf foam ribbons
    for (let w = 0; w < 3; w++) {
      ctx.strokeStyle = w === 0 ? COLORS.foam : 'rgba(180, 245, 255, 0.28)';
      ctx.lineWidth = w === 0 ? 5 : 3;
      ctx.beginPath();
      for (let y = Math.max(0, Math.floor(vy1 / 36) * 36); y <= endY + 36; y += 36) {
        const wave = Math.sin(y * 0.014 + time * 1.9 + w * 1.7) * 14 + w * 32;
        const x = WATER_START_X + 6 + wave;
        if (y === Math.max(0, Math.floor(vy1 / 36) * 36)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

function drawParks(ctx, city, camX, camY, time) {
  for (const park of city.parks) {
    if (!inView(park.x, park.y, park.w, park.h, camX, camY, 60)) continue;

    ctx.fillStyle = park.plaza ? '#6d7488' : COLORS.grass;
    ctx.fillRect(park.x, park.y, park.w, park.h);

    if (park.plaza) {
      // Decorative plaza tiles
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let x = park.x; x < park.x + park.w; x += 36) {
        ctx.beginPath();
        ctx.moveTo(x, park.y);
        ctx.lineTo(x, park.y + park.h);
        ctx.stroke();
      }
      for (let y = park.y; y < park.y + park.h; y += 36) {
        ctx.beginPath();
        ctx.moveTo(park.x, y);
        ctx.lineTo(park.x + park.w, y);
        ctx.stroke();
      }
    } else {
      // Park footpaths
      ctx.fillStyle = '#9aa3b2';
      ctx.fillRect(park.x + park.w * 0.5 - 16, park.y, 32, park.h);
      ctx.fillRect(park.x, park.y + park.h * 0.5 - 16, park.w, 32);
    }

    // Center fountain with animated water ripples
    ctx.fillStyle = '#aeb6c4';
    ctx.beginPath();
    ctx.arc(park.fountainX, park.fountainY, 44, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#25b5d4';
    ctx.beginPath();
    ctx.arc(park.fountainX, park.fountainY, 35, 0, Math.PI * 2);
    ctx.fill();

    const ripple = 14 + ((time * 18) % 18);
    ctx.strokeStyle = 'rgba(230, 252, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(park.fountainX, park.fountainY, ripple, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawRoads(ctx, city, camX, camY, lighting, time) {
  // Sidewalks under road corridors
  ctx.fillStyle = COLORS.sidewalk;
  for (const vr of VERTICAL_ROADS) {
    const sw = vr.width + SIDEWALK_WIDTH * 2;
    if (vr.x + sw < camX || vr.x - sw > camX + VIEWPORT_WIDTH) continue;
    ctx.fillRect(vr.x - sw * 0.5, 0, sw, WORLD_HEIGHT);
  }
  for (const hr of HORIZONTAL_ROADS) {
    const sw = hr.width + SIDEWALK_WIDTH * 2;
    if (hr.y + sw < camY || hr.y - sw > camY + VIEWPORT_HEIGHT) continue;
    ctx.fillRect(0, hr.y - sw * 0.5, BOARDWALK_X, sw);
  }

  // Asphalt roadbeds
  ctx.fillStyle = COLORS.asphalt;
  for (const vr of VERTICAL_ROADS) {
    ctx.fillRect(vr.x - vr.width * 0.5, 0, vr.width, WORLD_HEIGHT);
  }
  for (const hr of HORIZONTAL_ROADS) {
    ctx.fillRect(0, hr.y - hr.width * 0.5, BOARDWALK_X, hr.width);
  }

  // Subtle curb edges
  ctx.strokeStyle = COLORS.sidewalkEdge;
  ctx.lineWidth = 2;
  for (const vr of VERTICAL_ROADS) {
    ctx.beginPath();
    ctx.moveTo(vr.x - vr.width * 0.5, 0);
    ctx.lineTo(vr.x - vr.width * 0.5, WORLD_HEIGHT);
    ctx.moveTo(vr.x + vr.width * 0.5, 0);
    ctx.lineTo(vr.x + vr.width * 0.5, WORLD_HEIGHT);
    ctx.stroke();
  }

  // Double amber centerlines and dashed lane dividers
  for (const vr of VERTICAL_ROADS) {
    if (vr.x + vr.width < camX || vr.x - vr.width > camX + VIEWPORT_WIDTH) continue;
    ctx.fillStyle = COLORS.asphaltLine;
    ctx.fillRect(vr.x - 3, 0, 2, WORLD_HEIGHT);
    ctx.fillRect(vr.x + 1, 0, 2, WORLD_HEIGHT);

    if (vr.lanes >= 4) {
      ctx.strokeStyle = COLORS.asphaltWhite;
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 22]);
      ctx.beginPath();
      ctx.moveTo(vr.x - vr.width * 0.25, 0);
      ctx.lineTo(vr.x - vr.width * 0.25, WORLD_HEIGHT);
      ctx.moveTo(vr.x + vr.width * 0.25, 0);
      ctx.lineTo(vr.x + vr.width * 0.25, WORLD_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (const hr of HORIZONTAL_ROADS) {
    if (hr.y + hr.width < camY || hr.y - hr.width > camY + VIEWPORT_HEIGHT) continue;
    ctx.fillStyle = COLORS.asphaltLine;
    ctx.fillRect(0, hr.y - 3, BOARDWALK_X, 2);
    ctx.fillRect(0, hr.y + 1, BOARDWALK_X, 2);

    if (hr.lanes >= 4) {
      ctx.strokeStyle = COLORS.asphaltWhite;
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 22]);
      ctx.beginPath();
      ctx.moveTo(0, hr.y - hr.width * 0.25);
      ctx.lineTo(BOARDWALK_X, hr.y - hr.width * 0.25);
      ctx.moveTo(0, hr.y + hr.width * 0.25);
      ctx.lineTo(BOARDWALK_X, hr.y + hr.width * 0.25);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Clear intersections, paint crisp crosswalk stripes, corner traffic signals & dusk neon asphalt sheen
  const greenNS = Math.floor(time * 0.25) % 2 === 0;
  for (const vr of VERTICAL_ROADS) {
    for (const hr of HORIZONTAL_ROADS) {
      if (!inView(vr.x - 110, hr.y - 110, 220, 220, camX, camY, 40)) continue;
      ctx.fillStyle = COLORS.asphalt;
      ctx.fillRect(vr.x - vr.width * 0.5, hr.y - hr.width * 0.5, vr.width, hr.width);

      // Subtle dusk neon wet-asphalt reflection pool at major boulevards
      if (lighting && lighting.lights > 0.35) {
        const rg = ctx.createRadialGradient(vr.x, hr.y, 6, vr.x, hr.y, 92);
        const tint = (vr.x + hr.y) % 2 === 0 ? 'rgba(255, 77, 148, 0.14)' : 'rgba(46, 242, 255, 0.14)';
        rg.addColorStop(0, tint);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(vr.x, hr.y, 92, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(235, 240, 250, 0.55)';
      // North & South crosswalks
      for (let x = vr.x - vr.width * 0.42; x <= vr.x + vr.width * 0.36; x += 14) {
        ctx.fillRect(x, hr.y - hr.width * 0.5 - 16, 7, 13);
        ctx.fillRect(x, hr.y + hr.width * 0.5 + 3, 7, 13);
      }
      // West & East crosswalks
      for (let y = hr.y - hr.width * 0.42; y <= hr.y + hr.width * 0.36; y += 14) {
        ctx.fillRect(vr.x - vr.width * 0.5 - 16, y, 13, 7);
        ctx.fillRect(vr.x + vr.width * 0.5 + 3, y, 13, 7);
      }

      // Corner traffic light beacons
      const corners = [
        [vr.x - vr.width * 0.5 - 10, hr.y - hr.width * 0.5 - 10, greenNS],
        [vr.x + vr.width * 0.5 + 10, hr.y + hr.width * 0.5 + 10, greenNS],
        [vr.x + vr.width * 0.5 + 10, hr.y - hr.width * 0.5 - 10, !greenNS],
        [vr.x - vr.width * 0.5 - 10, hr.y + hr.width * 0.5 + 10, !greenNS],
      ];
      for (const [cx, cy, isGreen] of corners) {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isGreen ? '#3effa8' : '#ff4d6d';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPiersAndBeachProps(ctx, city, camX, camY, time) {
  // Wooden piers
  for (const pier of city.piers) {
    if (!inView(pier.x, pier.y, pier.w, pier.h, camX, camY, 60)) continue;
    ctx.fillStyle = 'rgba(0, 18, 35, 0.38)';
    ctx.fillRect(pier.x + 8, pier.y + 10, pier.w, pier.h);
    ctx.fillStyle = '#8b623f';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.strokeStyle = '#5c3d24';
    ctx.lineWidth = 2;
    for (let x = pier.x; x < pier.x + pier.w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, pier.y);
      ctx.lineTo(x, pier.y + pier.h);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c89b6e';
    ctx.strokeRect(pier.x, pier.y, pier.w, pier.h);
  }

  // Moored coastal yachts & speedboats gently bobbing in Solara Bay
  for (const boat of city.boats || []) {
    if (!inView(boat.x - 80, boat.y - 60, 160, 120, camX, camY, 40)) continue;
    const bob = Math.sin(time * 2.1 + boat.y * 0.03) * 2.2;
    ctx.save();
    ctx.translate(boat.x, boat.y + bob);
    ctx.rotate(boat.angle);
    const hl = boat.length * 0.5;
    const hw = boat.width * 0.5;

    // Water wake halo
    ctx.strokeStyle = 'rgba(220, 252, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, hl + 6, hw + 5, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Hull shadow + pointed bow hull
    ctx.fillStyle = 'rgba(0, 20, 42, 0.38)';
    ctx.beginPath();
    ctx.moveTo(hl + 5, 4);
    ctx.quadraticCurveTo(hl * 0.25, hw + 4, -hl + 4, hw * 0.85 + 4);
    ctx.lineTo(-hl + 4, -hw * 0.85 + 4);
    ctx.quadraticCurveTo(hl * 0.25, -hw + 4, hl + 5, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = boat.color;
    ctx.beginPath();
    ctx.moveTo(hl, 0);
    ctx.quadraticCurveTo(hl * 0.25, hw, -hl, hw * 0.82);
    ctx.lineTo(-hl, -hw * 0.82);
    ctx.quadraticCurveTo(hl * 0.25, -hw, hl, 0);
    ctx.closePath();
    ctx.fill();

    // Deck cabin & neon accent stripe
    ctx.fillStyle = boat.stripe;
    ctx.fillRect(-hl * 0.65, -2.5, boat.length * 0.55, 5);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, -hl * 0.38, -hw * 0.52, boat.length * 0.36, boat.width * 0.52, 5);
    ctx.fill();
    ctx.restore();
  }

  // Beach umbrellas
  for (const prop of city.beachProps) {
    if (!inView(prop.x - 24, prop.y - 24, 48, 48, camX, camY, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(prop.x + 6, prop.y + 7, prop.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = prop.color;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, prop.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y);
      ctx.lineTo(prop.x + Math.cos(a) * prop.radius, prop.y + Math.sin(a) * prop.radius);
      ctx.stroke();
    }
  }
}

function drawSkidMarks(ctx, skidMarks, camX, camY) {
  ctx.fillStyle = 'rgba(14, 16, 22, 0.42)';
  for (const m of skidMarks) {
    if (!inView(m.x - 10, m.y - 10, 20, 20, camX, camY, 20)) continue;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.fillRect(-6, -2.5, 12, 5);
    ctx.restore();
  }
}

function drawPickups(ctx, pickups, camX, camY, time) {
  for (const p of pickups) {
    if (!p.active) continue;
    if (!inView(p.x - 25, p.y - 25, 50, 50, camX, camY, 30)) continue;
    const pulse = 1 + Math.sin(time * 5 + p.x) * 0.14;
    const color = p.kind === 'health' ? '#3effa8' : p.kind === 'armor' ? '#4cc9f0' : '#ffd166';

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#121826';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    if (p.kind === 'health') {
      ctx.fillRect(-5, -1.8, 10, 3.6);
      ctx.fillRect(-1.8, -5, 3.6, 10);
    } else if (p.kind === 'armor') {
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, -2);
      ctx.lineTo(4, 5);
      ctx.lineTo(0, 7);
      ctx.lineTo(-4, 5);
      ctx.lineTo(-5, -2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-4.5, -4.5, 9, 9);
    }
    ctx.restore();
  }
}

function drawMissionBeacon(ctx, marker, time) {
  if (!marker) return;
  const pulse = (time * 1.4) % 1;
  ctx.save();
  ctx.translate(marker.x, marker.y);

  // Expanding outer ring
  ctx.strokeStyle = marker.color;
  ctx.globalAlpha = 1 - pulse;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 26 + pulse * 42, 0, Math.PI * 2);
  ctx.stroke();

  // Solid beacon base
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = marker.color;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();

  // Label badge
  ctx.font = 'bold 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10, 12, 22, 0.85)';
  const label = (marker.label || 'OBJECTIVE').toUpperCase();
  const tw = ctx.measureText(label).width + 14;
  ctx.fillRect(-tw * 0.5, -44, tw, 18);
  ctx.fillStyle = marker.color;
  ctx.fillText(label, 0, -31);
  ctx.restore();
}

function drawVehicles(ctx, vehicles, camX, camY, lighting, time) {
  for (const v of vehicles) {
    if (!inView(v.x - 140, v.y - 140, 280, 280, camX, camY, 80)) continue;

    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);

    const hl = v.length * 0.5;
    const hw = v.width * 0.5;

    // Headlight cones painted underneath/ahead of car
    if (v.headlightsOn && !v.destroyed && (lighting.lights > 0.25 || v.driver === 'player' || v.isPolice)) {
      const coneAlpha = clamp(0.14 + lighting.lights * 0.26, 0.12, 0.42);
      const grad = ctx.createLinearGradient(hl, 0, hl + 215, 0);
      grad.addColorStop(0, `rgba(255, 244, 200, ${coneAlpha})`);
      grad.addColorStop(1, 'rgba(255, 244, 200, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(hl - 2, -hw * 0.72);
      ctx.lineTo(hl + 215, -hw * 2.55);
      ctx.lineTo(hl + 215, hw * 2.55);
      ctx.lineTo(hl - 2, hw * 0.72);
      ctx.closePath();
      ctx.fill();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    roundRect(ctx, -hl + 4, -hw + 6, v.length, v.width, 7);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#11141c';
    ctx.fillRect(-hl + 9, -hw - 2, 15, 4);
    ctx.fillRect(-hl + 9, hw - 2, 15, 4);
    ctx.fillRect(hl - 24, -hw - 2, 15, 4);
    ctx.fillRect(hl - 24, hw - 2, 15, 4);

    // Main body chassis
    ctx.fillStyle = v.destroyed ? '#25272d' : v.color;
    roundRect(ctx, -hl, -hw, v.length, v.width, v.style === 'van' || v.style === 'enforcer' ? 5 : 8);
    ctx.fill();

    // Police livery stripes or taxi checkerboard roof
    if (!v.destroyed && v.style === 'police') {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(-hl * 0.42, -hw + 2, v.length * 0.44, v.width - 4);
      ctx.fillStyle = '#2ef2ff';
      ctx.fillRect(-hl + 6, -hw + 2, v.length - 12, 2);
      ctx.fillRect(-hl + 6, hw - 4, v.length - 12, 2);
    } else if (!v.destroyed && v.style === 'enforcer') {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-hl + 6, -hw + 3, v.length - 12, v.width - 6);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-hl + 10, -2, v.length - 20, 4);
    } else if (!v.destroyed && v.style === 'sports' || v.style === 'super') {
      // Racing twin stripe
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(-hl + 5, -4, v.length - 10, 2.5);
      ctx.fillRect(-hl + 5, 1.5, v.length - 10, 2.5);
    }

    // Cabin windshield & rear glass
    if (v.style === 'convertible') {
      ctx.fillStyle = '#2b2438';
      roundRect(ctx, -hl * 0.42, -hw + 4.5, v.length * 0.48, v.width - 9, 4);
      ctx.fill();
      ctx.fillStyle = '#89c2d9';
      ctx.fillRect(hl * 0.08, -hw + 4.5, 9, v.width - 9);
    } else {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.55)';
      roundRect(ctx, -hl * 0.48, -hw + 4.5, v.length * 0.62, v.width - 9, 4);
      ctx.fill();
      ctx.fillStyle = v.destroyed ? '#1a1c21' : shadeHex(v.color, 18);
      roundRect(ctx, -hl * 0.34, -hw + 6, v.length * 0.36, v.width - 12, 3);
      ctx.fill();
    }

    // Taxi roof sign
    if (v.style === 'taxi' && !v.destroyed) {
      ctx.fillStyle = '#111827';
      ctx.fillRect(-5, -7, 10, 14);
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(-3, -5, 6, 10);
    }

    // Sports spoiler
    if ((v.style === 'super' || v.style === 'sports') && !v.destroyed) {
      ctx.fillStyle = '#141824';
      ctx.fillRect(-hl + 2, -hw + 2, 5, v.width - 4);
    }

    // Headlight bulbs & glowing brake/tail lights
    if (!v.destroyed) {
      ctx.fillStyle = '#fff9db';
      ctx.fillRect(hl - 3.5, -hw + 4, 3.5, 6);
      ctx.fillRect(hl - 3.5, hw - 10, 3.5, 6);

      ctx.fillStyle = v.braking ? '#ff2a55' : '#a81c30';
      ctx.fillRect(-hl, -hw + 4, 3.5, 6);
      ctx.fillRect(-hl, hw - 10, 3.5, 6);

      if (lighting.lights > 0.3 || v.braking) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = v.braking ? 'rgba(255, 42, 85, 0.36)' : 'rgba(255, 42, 85, 0.16)';
        ctx.beginPath();
        ctx.arc(-hl - 3, -hw + 7, v.braking ? 14 : 9, 0, Math.PI * 2);
        ctx.arc(-hl - 3, hw - 7, v.braking ? 14 : 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Police flashing lightbar + colored glow
    if (v.isPolice && !v.destroyed) {
      const flash = Math.sin(v.sirenPhase + time * 2) > 0;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-4, -hw + 5, 8, v.width - 10);
      ctx.fillStyle = v.sirenOn && flash ? '#ff2a55' : '#6b1224';
      ctx.fillRect(-3, -hw + 6, 6, (v.width - 12) * 0.48);
      ctx.fillStyle = v.sirenOn && !flash ? '#2ef2ff' : '#124e66';
      ctx.fillRect(-3, 0.5, 6, (v.width - 12) * 0.48);

      if (v.sirenOn) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glowColor = flash ? 'rgba(255, 42, 85, 0.45)' : 'rgba(46, 242, 255, 0.45)';
        const rg = ctx.createRadialGradient(0, flash ? -10 : 10, 2, 0, flash ? -10 : 10, 56);
        rg.addColorStop(0, glowColor);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, flash ? -10 : 10, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Subtle body outline
    ctx.strokeStyle = v.driver === 'player' ? 'rgba(255, 224, 130, 0.65)' : 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = v.driver === 'player' ? 1.8 : 1.2;
    roundRect(ctx, -hl, -hw, v.length, v.width, v.style === 'van' ? 5 : 8);
    ctx.stroke();

    ctx.restore();
  }
}

function drawCharacters(ctx, state, camX, camY) {
  // Pedestrians
  for (const p of state.pedestrians) {
    if (!inView(p.x - 24, p.y - 24, 48, 48, camX, camY, 30)) continue;
    drawHuman(ctx, {
      x: p.x,
      y: p.y,
      angle: p.angle,
      radius: p.radius,
      shirt: p.shirt,
      skin: p.skin,
      hair: p.hair,
      walkPhase: p.walkPhase,
      alive: p.alive,
      hasGun: false,
    });
  }

  // Foot police officers
  for (const off of state.police.officers) {
    if (!inView(off.x - 24, off.y - 24, 48, 48, camX, camY, 30)) continue;
    drawHuman(ctx, {
      x: off.x,
      y: off.y,
      angle: off.angle,
      radius: off.radius,
      shirt: '#1d4ed8',
      skin: '#f1c27d',
      hair: '#0f172a',
      walkPhase: off.walkPhase,
      alive: off.alive,
      hasGun: true,
      muzzleFlash: off.muzzleFlash,
      badgeColor: '#38bdf8',
    });
  }

  // Mission gang enemies
  for (const e of state.missions.enemies) {
    if (!inView(e.x - 30, e.y - 30, 60, 60, camX, camY, 40)) continue;
    drawHuman(ctx, {
      x: e.x,
      y: e.y,
      angle: e.angle,
      radius: e.radius,
      shirt: e.shirt,
      skin: '#e0ac69',
      hair: '#1a1a24',
      walkPhase: e.walkPhase,
      alive: e.alive,
      hasGun: true,
      muzzleFlash: e.muzzleFlash,
      isBoss: e.isBoss,
    });

    // Enemy health bar
    if (e.alive && (e.hp < e.maxHp || e.isBoss)) {
      const bw = e.isBoss ? 40 : 26;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(e.x - bw * 0.5, e.y - e.radius - 12, bw, 5);
      ctx.fillStyle = e.isBoss ? '#ffbe0b' : '#ff4d6d';
      ctx.fillRect(e.x - bw * 0.5 + 1, e.y - e.radius - 11, (bw - 2) * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  // Player (Marco Vega) when on foot
  const player = state.player;
  if (!player.vehicle) {
    drawHuman(ctx, {
      x: player.x,
      y: player.y,
      angle: player.angle,
      radius: player.radius,
      shirt: '#ff5d8f',
      jacket: '#f8fafc',
      skin: '#f0bc86',
      hair: '#181822',
      walkPhase: player.moving ? player.walkCycle : 0,
      alive: !player.dead,
      hasGun: true,
      muzzleFlash: player.muzzleFlash,
      isPlayer: true,
    });
  }
}

function drawHuman(ctx, h) {
  ctx.save();
  ctx.translate(h.x, h.y);

  if (!h.alive) {
    ctx.fillStyle = 'rgba(155, 18, 32, 0.58)';
    ctx.beginPath();
    ctx.arc(0, 0, h.radius + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(h.angle);
    ctx.fillStyle = h.shirt;
    ctx.fillRect(-10, -5, 20, 10);
    ctx.fillStyle = h.skin;
    ctx.beginPath();
    ctx.arc(9, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  ctx.beginPath();
  ctx.ellipse(2, 4, h.radius * 0.95, h.radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(h.angle);
  const swing = Math.sin(h.walkPhase || 0) * 3.8;

  // Player soft highlight ring so protagonist pops cleanly
  if (h.isPlayer) {
    ctx.strokeStyle = 'rgba(46, 242, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, h.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Animated feet
  ctx.fillStyle = '#181c26';
  ctx.fillRect(-3 + swing, -8, 7, 4);
  ctx.fillRect(-3 - swing, 4, 7, 4);

  // Shoulders & torso
  ctx.fillStyle = h.jacket || h.shirt;
  roundRect(ctx, -6, -h.radius + 1, 13, (h.radius - 1) * 2, 5);
  ctx.fill();

  if (h.jacket) {
    ctx.fillStyle = h.shirt;
    ctx.fillRect(-3, -5, 9, 10);
  }

  // Weapon arm & barrel
  if (h.hasGun) {
    ctx.fillStyle = h.skin;
    ctx.fillRect(3, 3, 10, 4);
    ctx.fillStyle = '#1e2430';
    ctx.fillRect(10, 2.5, 11, 3.6);

    if (h.muzzleFlash > 0.08) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(23, 4, 6 + h.muzzleFlash * 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.moveTo(20, 4);
      ctx.lineTo(35 + h.muzzleFlash * 8, 1);
      ctx.lineTo(35 + h.muzzleFlash * 8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Head & hair
  ctx.fillStyle = h.skin;
  ctx.beginPath();
  ctx.arc(1, 0, h.radius * 0.54, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = h.hair;
  ctx.beginPath();
  ctx.arc(-1, 0, h.radius * 0.48, Math.PI * 0.55, Math.PI * 1.45);
  ctx.fill();

  if (h.isBoss) {
    ctx.strokeStyle = '#ffbe0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, h.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBullets(ctx, bullets) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of bullets) {
    const spd = Math.hypot(b.vx, b.vy) || 1;
    const tx = b.x - (b.vx / spd) * b.tracerLen;
    const ty = b.y - (b.vy / spd) * b.tracerLen;

    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBuildings(ctx, city, camX, camY, camCenterX, camCenterY, lighting) {
  for (const b of city.buildings) {
    if (!inView(b.x - 70, b.y - 70, b.w + 140, b.h + 140, camX, camY, 80)) continue;

    // Ground cast shadow
    ctx.fillStyle = 'rgba(6, 9, 18, 0.36)';
    ctx.fillRect(b.x + b.height * 0.42, b.y + b.height * 0.48, b.w, b.h);

    // 2.5D top-down parallax roof offset from camera center
    const cx = b.x + b.w * 0.5;
    const cy = b.y + b.h * 0.5;
    const offX = clamp((cx - camCenterX) * 0.00055 * b.height, -28, 28);
    const offY = clamp((cy - camCenterY) * 0.00055 * b.height, -28, 28);

    const rx = b.x + offX;
    const ry = b.y + offY;

    // Extruded walls connecting base footprint to raised roof
    ctx.fillStyle = b.wallColor;
    if (offY > 0) {
      drawQuad(ctx, b.x, b.y, b.x + b.w, b.y, rx + b.w, ry, rx, ry);
    } else if (offY < 0) {
      drawQuad(ctx, b.x, b.y + b.h, b.x + b.w, b.y + b.h, rx + b.w, ry + b.h, rx, ry + b.h);
    }
    ctx.fillStyle = shadeHex(b.wallColor, -10);
    if (offX > 0) {
      drawQuad(ctx, b.x, b.y, b.x, b.y + b.h, rx, ry + b.h, rx, ry);
    } else if (offX < 0) {
      drawQuad(ctx, b.x + b.w, b.y, b.x + b.w, b.y + b.h, rx + b.w, ry + b.h, rx + b.w, ry);
    }

    // Lit skyscraper windows along visible wall faces at dusk/night
    if (lighting.lights > 0.25 && b.style !== 'container') {
      ctx.fillStyle = `rgba(255, 215, 135, ${0.28 + lighting.lights * 0.36})`;
      if (Math.abs(offY) > 5) {
        const wy = offY < 0 ? b.y + b.h - 4 : b.y + 2;
        for (let wx = b.x + 12; wx < b.x + b.w - 16; wx += 20) {
          ctx.fillRect(wx + offX * 0.5, wy + offY * 0.5, 9, 3);
        }
      }
    }

    // Main roof slab
    ctx.fillStyle = b.roofColor;
    ctx.fillRect(rx, ry, b.w, b.h);

    // Parapet trim
    ctx.strokeStyle = b.style === 'container' ? 'rgba(255,255,255,0.22)' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 2, ry + 2, b.w - 4, b.h - 4);

    // Neon rooftop accent strip on Palm Strip / Downtown towers
    if (b.district === 'strip' || b.district === 'downtown') {
      ctx.strokeStyle = b.accent;
      ctx.globalAlpha = 0.4 + lighting.lights * 0.45;
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 5, ry + 5, b.w - 10, b.h - 10);
      ctx.globalAlpha = 1;
    }

    // Container corrugation ribs
    if (b.style === 'container') {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      for (let x = rx + 10; x < rx + b.w - 8; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, ry + 4);
        ctx.lineTo(x, ry + b.h - 4);
        ctx.stroke();
      }
    }

    // Rooftop details (helipad, pool, skylights, AC units)
    for (const d of b.details) {
      if (d.kind === 'helipad') {
        const hx = rx + b.w * d.rx;
        const hy = ry + b.h * d.ry;
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(hx, hy, d.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 16px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', hx, hy + 1);
      } else if (d.kind === 'pool') {
        ctx.fillStyle = '#2ec4b6';
        ctx.fillRect(rx + b.w * d.rx, ry + b.h * d.ry, b.w * d.rw, b.h * d.rh);
        ctx.strokeStyle = '#cbf3f0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx + b.w * d.rx, ry + b.h * d.ry, b.w * d.rw, b.h * d.rh);
      } else if (d.kind === 'skylight') {
        ctx.fillStyle = '#4f7cac';
        ctx.fillRect(rx + b.w * d.rx, ry + b.h * d.ry, b.w * d.rw, b.h * d.rh);
      } else {
        ctx.fillStyle = '#252a38';
        ctx.fillRect(rx + b.w * d.rx, ry + b.h * d.ry, b.w * d.rw, b.h * d.rh);
      }
    }
  }
}

function drawNeonSigns(ctx, signs, camX, camY, lighting, time) {
  ctx.save();
  ctx.font = 'bold 10px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const s of signs) {
    if (!inView(s.x - 90, s.y - 50, 180, 100, camX, camY, 40)) continue;
    const flicker = 0.88 + Math.sin(time * 9 + s.x) * 0.12;
    const glowAlpha = (0.22 + lighting.lights * 0.35) * flicker;

    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.vertical) ctx.rotate(-Math.PI * 0.5);

    const tw = ctx.measureText(s.text).width + 14;

    // Soft bloom halo
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = s.color;
    ctx.globalAlpha = glowAlpha;
    roundRect(ctx, -tw * 0.55, -13, tw * 1.1, 26, 8);
    ctx.fill();
    ctx.restore();

    // Sign backing & crisp glowing border
    ctx.fillStyle = 'rgba(11, 13, 24, 0.9)';
    roundRect(ctx, -tw * 0.5, -9, tw, 18, 4);
    ctx.fill();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.fillStyle = s.color;
    ctx.fillText(s.text, 0, 0.5);
    ctx.restore();
  }
  ctx.restore();
}

function drawTrees(ctx, trees, camX, camY, time) {
  for (const t of trees) {
    if (!inView(t.x - 45, t.y - 45, 90, 90, camX, camY, 30)) continue;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(t.x + 8, t.y + 9, t.radius * 0.92, 0, Math.PI * 2);
    ctx.fill();

    if (t.kind === 'palm') {
      const sway = Math.sin(time * 1.6 + t.phase) * 0.08;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.phase + sway);
      for (let f = 0; f < 7; f++) {
        const a = (f / 7) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = f % 2 === 0 ? '#2f9e66' : '#3bb273';
        ctx.beginPath();
        ctx.ellipse(t.radius * 0.56, 0, t.radius * 0.62, t.radius * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#6c4f3d';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = '#2a7d52';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3ca36b';
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 4, t.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawStreetLamps(ctx, lamps, camX, camY, lighting) {
  for (const l of lamps) {
    if (!inView(l.x - 70, l.y - 70, 140, 140, camX, camY, 40)) continue;

    if (lighting.lights > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 68);
      rg.addColorStop(0, `rgba(255, 198, 108, ${0.24 * lighting.lights})`);
      rg.addColorStop(1, 'rgba(255, 198, 108, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 68, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(l.x, l.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, particles, camX, camY) {
  for (const p of particles) {
    if (!inView(p.x - 30, p.y - 30, 60, 60, camX, camY, 30)) continue;
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = p.kind === 'smoke' ? alpha * 0.5 : alpha;
    if (p.kind === 'spark' || p.kind === 'explosion') {
      ctx.globalCompositeOperation = 'lighter';
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPoliceHelicopter(ctx, heli, lighting, time) {
  // Dramatic searchlight beam from heli to ground spot
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const spotGrad = ctx.createRadialGradient(heli.spotX, heli.spotY, 10, heli.spotX, heli.spotY, 128);
  spotGrad.addColorStop(0, `rgba(235, 250, 255, ${0.42 + lighting.lights * 0.2})`);
  spotGrad.addColorStop(0.6, 'rgba(130, 220, 255, 0.16)');
  spotGrad.addColorStop(1, 'rgba(130, 220, 255, 0)');
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.arc(heli.spotX, heli.spotY, 128, 0, Math.PI * 2);
  ctx.fill();

  // Cone shaft connecting heli nose to spotlight pool
  const beamGrad = ctx.createLinearGradient(heli.x, heli.y, heli.spotX, heli.spotY);
  beamGrad.addColorStop(0, 'rgba(220, 246, 255, 0.28)');
  beamGrad.addColorStop(1, 'rgba(145, 225, 255, 0.08)');
  ctx.fillStyle = beamGrad;
  const ang = Math.atan2(heli.spotY - heli.y, heli.spotX - heli.x);
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(heli.x + px * 8, heli.y + py * 8);
  ctx.lineTo(heli.x - px * 8, heli.y - py * 8);
  ctx.lineTo(heli.spotX - px * 88, heli.spotY - py * 88);
  ctx.lineTo(heli.spotX + px * 88, heli.spotY + py * 88);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Offset ground shadow of helicopter
  ctx.save();
  ctx.translate(heli.x + 62, heli.y + 72);
  ctx.rotate(heli.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-52, -3, 30, 6);
  ctx.restore();

  // Helicopter fuselage & spinning rotor blades
  ctx.save();
  ctx.translate(heli.x, heli.y);
  ctx.rotate(heli.angle);

  // Tail boom
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-56, -4, 38, 8);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-58, -10, 6, 20);

  // Main cabin
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-10, -10, 14, 20);
  // Cockpit glass
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.ellipse(12, 0, 11, 8, 0, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.fill();

  // Flashing nav strobe
  const flash = Math.sin(heli.sirenPhase + time * 4) > 0;
  ctx.fillStyle = flash ? '#ff2a55' : '#2ef2ff';
  ctx.beginPath();
  ctx.arc(-54, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // Spinning rotor blur disc & blades
  ctx.rotate(heli.rotorAngle);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(241, 245, 249, 0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-56, 0);
  ctx.lineTo(56, 0);
  ctx.moveTo(0, -56);
  ctx.lineTo(0, 56);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPopups(ctx, popups) {
  ctx.save();
  ctx.font = 'bold 14px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(p.text, p.x + 1, p.y + 1);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.restore();
}

function drawAtmosphereOverlay(ctx, state, camX, camY, lighting) {
  // Day / Golden Hour / Dusk / Neon Night color wash
  ctx.fillStyle = `rgba(${lighting.r}, ${lighting.g}, ${lighting.b}, ${lighting.a})`;
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  // Hit flash red vignette
  if (state.player.hitFlash > 0.02) {
    ctx.fillStyle = `rgba(255, 42, 85, ${state.player.hitFlash * 0.28})`;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  }

  // Subtle cinema edge vignette for HUD contrast
  const vig = ctx.createRadialGradient(
    VIEWPORT_WIDTH * 0.5,
    VIEWPORT_HEIGHT * 0.5,
    VIEWPORT_HEIGHT * 0.38,
    VIEWPORT_WIDTH * 0.5,
    VIEWPORT_HEIGHT * 0.5,
    VIEWPORT_WIDTH * 0.68,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, `rgba(6, 8, 18, ${0.34 + lighting.darkness * 0.22})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
}

function inView(x, y, w, h, camX, camY, pad = 0) {
  return (
    x + w >= camX - pad &&
    x <= camX + VIEWPORT_WIDTH + pad &&
    y + h >= camY - pad &&
    y <= camY + VIEWPORT_HEIGHT + pad
  );
}

function drawQuad(ctx, x1, y1, x2, y2, x3, y3, x4, y4) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function shadeHex(hex, delta) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  const r = clamp(parseInt(hex.slice(1, 3), 16) + delta, 0, 255);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + delta, 0, 255);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + delta, 0, 255);
  return `rgb(${r},${g},${b})`;
}
