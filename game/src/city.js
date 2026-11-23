// Deterministic generator for Solara Bay: coastal road grid, districts, buildings, neon signs, parks, pier, and collisions.

import {
  BEACH_START_X,
  BOARDWALK_X,
  HORIZONTAL_ROADS,
  SIDEWALK_WIDTH,
  VERTICAL_ROADS,
  WATER_START_X,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';
import { clamp } from './random.js';

const NEON_SIGN_POOL = [
  { text: 'HOTEL SOLARA', color: '#ff4d94' },
  { text: 'VELVET LOUNGE', color: '#2ef2ff' },
  { text: 'PALM ARCADE', color: '#ffb347' },
  { text: 'MARINA CLUB', color: '#3effa8' },
  { text: 'SUNSET BAR', color: '#ff6b6b' },
  { text: 'SOLA MOTORS', color: '#4cc9f0' },
  { text: 'CORAL GRILL', color: '#ffd166' },
  { text: 'BAYSIDE PAWN', color: '#c77dff' },
  { text: 'AZURE SUITES', color: '#00f5d4' },
  { text: 'MIDNIGHT DINER', color: '#ff5d8f' },
  { text: 'HARBOR FREIGHT', color: '#ff9f1c' },
  { text: 'OASIS PLAZA', color: '#72efdd' },
];

const ROOF_PALETTES = {
  downtown: ['#343b52', '#3c455f', '#46506b', '#2e354a', '#4f5873'],
  strip: ['#57415c', '#453c63', '#614357', '#3f4968', '#6b4d5a'],
  industrial: ['#454b54', '#50565f', '#3d454d', '#5c544b'],
  heights: ['#6e5753', '#7a6158', '#5e5663', '#6c625b'],
};

const WALL_PALETTES = {
  downtown: ['#23283a', '#293044', '#1f2536'],
  strip: ['#36283e', '#2d2642', '#3f293c'],
  industrial: ['#2c3138', '#333840', '#292e33'],
  heights: ['#473836', '#523e3a', '#3d3742'],
};

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const lamps = [];
  const neonSigns = [];
  const beachProps = [];
  const parkingSpots = [];
  const pickups = [];
  const piers = [];

  // Build city blocks between road corridors
  const vEdges = [
    { left: 60, right: VERTICAL_ROADS[0].x - VERTICAL_ROADS[0].width / 2 - SIDEWALK_WIDTH },
  ];
  for (let i = 0; i < VERTICAL_ROADS.length - 1; i++) {
    const rA = VERTICAL_ROADS[i];
    const rB = VERTICAL_ROADS[i + 1];
    vEdges.push({
      left: rA.x + rA.width / 2 + SIDEWALK_WIDTH,
      right: rB.x - rB.width / 2 - SIDEWALK_WIDTH,
    });
  }
  const lastV = VERTICAL_ROADS[VERTICAL_ROADS.length - 1];
  vEdges.push({
    left: lastV.x + lastV.width / 2 + SIDEWALK_WIDTH,
    right: BOARDWALK_X - 28,
  });

  const hEdges = [
    { top: 60, bottom: HORIZONTAL_ROADS[0].y - HORIZONTAL_ROADS[0].width / 2 - SIDEWALK_WIDTH },
  ];
  for (let i = 0; i < HORIZONTAL_ROADS.length - 1; i++) {
    const rA = HORIZONTAL_ROADS[i];
    const rB = HORIZONTAL_ROADS[i + 1];
    hEdges.push({
      top: rA.y + rA.width / 2 + SIDEWALK_WIDTH,
      bottom: rB.y - rB.width / 2 - SIDEWALK_WIDTH,
    });
  }
  const lastH = HORIZONTAL_ROADS[HORIZONTAL_ROADS.length - 1];
  hEdges.push({
    top: lastH.y + lastH.width / 2 + SIDEWALK_WIDTH,
    bottom: WORLD_HEIGHT - 60,
  });

  let signCursor = 0;

  for (let row = 0; row < hEdges.length; row++) {
    for (let col = 0; col < vEdges.length; col++) {
      const bx = vEdges[col].left;
      const by = hEdges[row].top;
      const bw = vEdges[col].right - bx;
      const bh = hEdges[row].bottom - by;
      if (bw < 90 || bh < 90) continue;

      const district = classifyDistrict(col, row);

      // Emerald Park occupies central block (col 2, row 2)
      if (col === 2 && row === 2) {
        parks.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          name: 'Emerald Park',
          fountainX: bx + bw * 0.5,
          fountainY: by + bh * 0.5,
        });
        for (let t = 0; t < 16; t++) {
          const ang = (t / 16) * Math.PI * 2 + rng.range(-0.15, 0.15);
          const rad = rng.range(Math.min(bw, bh) * 0.25, Math.min(bw, bh) * 0.44);
          trees.push({
            x: bx + bw * 0.5 + Math.cos(ang) * rad,
            y: by + bh * 0.5 + Math.sin(ang) * rad,
            radius: rng.range(20, 30),
            kind: rng.chance(0.55) ? 'palm' : 'canopy',
            phase: rng.range(0, Math.PI * 2),
          });
        }
        continue;
      }

      // Marina Plaza & Helipad Courtyard (col 4, row 3)
      if (col === 4 && row === 3) {
        parks.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          name: 'Sunset Plaza',
          fountainX: bx + bw * 0.5,
          fountainY: by + bh * 0.5,
          plaza: true,
        });
        // Add corner kiosks
        buildings.push(makeBuilding(bx + 14, by + 14, 110, 88, 'strip', rng, { label: 'PLAZA CAFE' }));
        buildings.push(makeBuilding(bx + bw - 124, by + bh - 102, 110, 88, 'strip', rng));
        continue;
      }

      // Port Solara Container Yard (col 1, row 4)
      if (col === 1 && row === 4) {
        const containerColors = ['#c44536', '#2a6f97', '#e09f3e', '#386641', '#5a189a'];
        const cols = 3;
        const rows = 2;
        const cw = (bw - 44) / cols;
        const ch = (bh - 50) / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = bx + 14 + c * (cw + 8);
            const y = by + 16 + r * (ch + 18);
            buildings.push({
              x,
              y,
              w: cw - 6,
              h: ch - 12,
              height: 18,
              roofColor: rng.pick(containerColors),
              wallColor: '#1f242c',
              accent: '#d9e2ec',
              district: 'industrial',
              style: 'container',
              details: [],
            });
          }
        }
        continue;
      }

      // Subdivide standard blocks into 2-4 varied buildings with alleys
      const pad = 12;
      const innerX = bx + pad;
      const innerY = by + pad;
      const innerW = bw - pad * 2;
      const innerH = bh - pad * 2;
      const splitV = innerW > 270;
      const splitH = innerH > 260;
      const alley = 22;

      const subRects = [];
      if (splitV && splitH) {
        const w1 = innerW * rng.range(0.44, 0.56) - alley * 0.5;
        const h1 = innerH * rng.range(0.44, 0.56) - alley * 0.5;
        subRects.push({ x: innerX, y: innerY, w: w1, h: h1 });
        subRects.push({ x: innerX + w1 + alley, y: innerY, w: innerW - w1 - alley, h: h1 });
        subRects.push({ x: innerX, y: innerY + h1 + alley, w: w1, h: innerH - h1 - alley });
        subRects.push({
          x: innerX + w1 + alley,
          y: innerY + h1 + alley,
          w: innerW - w1 - alley,
          h: innerH - h1 - alley,
        });
      } else if (splitV) {
        const w1 = innerW * rng.range(0.45, 0.55) - alley * 0.5;
        subRects.push({ x: innerX, y: innerY, w: w1, h: innerH });
        subRects.push({ x: innerX + w1 + alley, y: innerY, w: innerW - w1 - alley, h: innerH });
      } else if (splitH) {
        const h1 = innerH * rng.range(0.45, 0.55) - alley * 0.5;
        subRects.push({ x: innerX, y: innerY, w: innerW, h: h1 });
        subRects.push({ x: innerX, y: innerY + h1 + alley, w: innerW, h: innerH - h1 - alley });
      } else {
        subRects.push({ x: innerX, y: innerY, w: innerW, h: innerH });
      }

      subRects.forEach((sr, idx) => {
        if (sr.w < 58 || sr.h < 58) return;
        const b = makeBuilding(sr.x, sr.y, sr.w, sr.h, district, rng);
        buildings.push(b);

        // Attach neon signs along major avenues and Palm Strip
        if (
          (district === 'strip' || district === 'downtown') &&
          (idx === 0 || rng.chance(0.42))
        ) {
          const signDef = NEON_SIGN_POOL[signCursor % NEON_SIGN_POOL.length];
          signCursor++;
          const faceEast = col >= 3;
          neonSigns.push({
            x: faceEast ? b.x + b.w : b.x + b.w * 0.5,
            y: faceEast ? b.y + b.h * 0.5 : b.y + b.h,
            text: signDef.text,
            color: signDef.color,
            vertical: faceEast,
          });
        }
      });

      // Add corner courtyard palms in strip/heights
      if (district === 'strip' || district === 'heights') {
        trees.push({
          x: bx + 6,
          y: by + 6,
          radius: 19,
          kind: 'palm',
          phase: rng.range(0, Math.PI * 2),
        });
      }
    }
  }

  // Street lamps along every avenue edge (skipping intersections)
  for (const vr of VERTICAL_ROADS) {
    const offset = vr.width * 0.5 + 14;
    for (let y = 120; y < WORLD_HEIGHT - 120; y += 220) {
      if (nearHorizontalRoad(y, 125)) continue;
      lamps.push({ x: vr.x - offset, y });
      lamps.push({ x: vr.x + offset, y: y + 110 < WORLD_HEIGHT - 120 ? y + 110 : y });
    }
  }
  for (const hr of HORIZONTAL_ROADS) {
    const offset = hr.width * 0.5 + 14;
    for (let x = 140; x < BOARDWALK_X - 120; x += 240) {
      if (nearVerticalRoad(x, 130)) continue;
      lamps.push({ x, y: hr.y - offset });
      lamps.push({ x: x + 120 < BOARDWALK_X - 100 ? x + 120 : x, y: hr.y + offset });
    }
  }

  // Palm Boulevard trees lining the boardwalk & beach
  for (let y = 140; y < WORLD_HEIGHT - 140; y += 135) {
    trees.push({
      x: BOARDWALK_X - 16,
      y,
      radius: rng.range(22, 28),
      kind: 'palm',
      phase: rng.range(0, Math.PI * 2),
    });
    if (rng.chance(0.62)) {
      trees.push({
        x: BEACH_START_X + rng.range(36, 110),
        y: y + rng.range(-30, 30),
        radius: rng.range(20, 26),
        kind: 'palm',
        phase: rng.range(0, Math.PI * 2),
      });
    }
  }

  // Beach umbrellas, loungers, and boats
  const umbrellaColors = ['#ff595e', '#ffca3a', '#1982c4', '#ff70a6', '#2ec4b6'];
  for (let y = 210; y < WORLD_HEIGHT - 220; y += 185) {
    beachProps.push({
      kind: 'umbrella',
      x: BEACH_START_X + rng.range(95, 200),
      y: y + rng.range(-25, 25),
      color: rng.pick(umbrellaColors),
      radius: 18,
    });
  }

  // Two coastal piers extending into Solara Bay + moored coastal yachts
  piers.push({ x: BOARDWALK_X + 75, y: 1475, w: 430, h: 118, name: 'Solara Pier' });
  piers.push({ x: BOARDWALK_X + 75, y: 2470, w: 380, h: 100, name: 'Marina Dock' });

  const boats = [
    { x: BOARDWALK_X + 265, y: 1432, length: 84, width: 28, angle: 0.04, color: '#f8fafc', stripe: '#ff4d94' },
    { x: BOARDWALK_X + 390, y: 1425, length: 92, width: 32, angle: -0.05, color: '#f1f5f9', stripe: '#2ef2ff' },
    { x: BOARDWALK_X + 310, y: 1635, length: 76, width: 26, angle: 0.08, color: '#fff8e7', stripe: '#ffb347' },
    { x: BOARDWALK_X + 240, y: 2425, length: 98, width: 34, angle: -0.04, color: '#f8fafc', stripe: '#3effa8' },
    { x: BOARDWALK_X + 345, y: 2612, length: 82, width: 28, angle: 0.06, color: '#e2e8f0', stripe: '#ff6b6b' },
  ];

  // Curbside parking spots along avenues
  for (const vr of VERTICAL_ROADS) {
    for (let y = 480; y < WORLD_HEIGHT - 420; y += 360) {
      if (nearHorizontalRoad(y, 170)) continue;
      parkingSpots.push({ x: vr.x + vr.width * 0.5 - 22, y, angle: -Math.PI * 0.5 });
      parkingSpots.push({ x: vr.x - vr.width * 0.5 + 22, y: y + 130, angle: Math.PI * 0.5 });
    }
  }
  for (const hr of HORIZONTAL_ROADS) {
    for (let x = 520; x < BOARDWALK_X - 320; x += 410) {
      if (nearVerticalRoad(x, 180)) continue;
      parkingSpots.push({ x, y: hr.y + hr.width * 0.5 - 22, angle: 0 });
    }
  }

  // Fixed pickups across the city (health kits, armor vests, ammo crates)
  const pickupDefs = [
    { x: 1620, y: 1360, kind: 'health' },
    { x: 2940, y: 1230, kind: 'health' },
    { x: 960, y: 2350, kind: 'health' },
    { x: 2280, y: 760, kind: 'health' },
    { x: 3425, y: 1535, kind: 'health' },
    { x: 1960, y: 1850, kind: 'armor' },
    { x: 640, y: 2740, kind: 'armor' },
    { x: 2640, y: 540, kind: 'armor' },
    { x: 1290, y: 920, kind: 'ammo' },
    { x: 2620, y: 2160, kind: 'ammo' },
    { x: 1620, y: 2520, kind: 'ammo' },
    { x: 3250, y: 920, kind: 'ammo' },
  ];
  for (const p of pickupDefs) {
    pickups.push({ ...p, active: true, respawnTimer: 0 });
  }

  // Named landmarks used by missions and HUD district display
  const landmarks = {
    pierStart: { x: 3210, y: 1540, name: 'Palm Strip Pier' },
    chopShop: { x: 640, y: 2740, name: 'Marina Chop Shop' },
    sunsetPlaza: { x: 2608, y: 1855, name: 'Sunset Plaza' },
    velvetLounge: { x: 2940, y: 920, name: 'Velvet Lounge' },
    portDockyard: { x: 650, y: 2450, name: 'Port Solara Dockyard' },
    bankPlaza: { x: 1620, y: 920, name: 'Downtown Bank Plaza' },
    coralSafehouse: { x: 2280, y: 340, name: 'Coral Heights Safehouse' },
    marinaCompound: { x: 3240, y: 2520, name: 'Moretti Marina Compound' },
    hospital: { x: 1620, y: 1980, name: 'Solara General' },
  };

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    verticalRoads: VERTICAL_ROADS,
    horizontalRoads: HORIZONTAL_ROADS,
    buildings,
    parks,
    trees,
    lamps,
    neonSigns,
    beachProps,
    piers,
    boats,
    parkingSpots,
    pickups,
    landmarks,
  };
}

function classifyDistrict(col, row) {
  if (col >= 4) return 'strip';
  if (row <= 1 && col >= 2) return 'heights';
  if (row >= 4 || col === 0) return 'industrial';
  return 'downtown';
}

function makeBuilding(x, y, w, h, district, rng, extra = {}) {
  const height =
    district === 'downtown'
      ? rng.range(30, 58)
      : district === 'strip'
        ? rng.range(24, 46)
        : district === 'heights'
          ? rng.range(16, 30)
          : rng.range(18, 28);

  const roofColor = rng.pick(ROOF_PALETTES[district]);
  const wallColor = rng.pick(WALL_PALETTES[district]);
  const accent =
    district === 'strip'
      ? rng.pick(['#ff4d94', '#2ef2ff', '#ffb347', '#3effa8'])
      : district === 'downtown'
        ? rng.pick(['#58a6ff', '#7bdff2', '#ffd166'])
        : '#8b95a5';

  const details = [];
  // Rooftop AC units, skylights, helipads, or pools
  if (w > 120 && h > 110 && district === 'downtown' && rng.chance(0.32)) {
    details.push({ kind: 'helipad', rx: 0.5, ry: 0.5, r: Math.min(w, h) * 0.24 });
  } else if (district === 'strip' && w > 110 && h > 95 && rng.chance(0.45)) {
    details.push({ kind: 'pool', rx: 0.24, ry: 0.26, rw: 0.52, rh: 0.36 });
  } else {
    const count = rng.int(2, 4);
    for (let i = 0; i < count; i++) {
      details.push({
        kind: rng.chance(0.35) ? 'skylight' : 'ac',
        rx: rng.range(0.14, 0.72),
        ry: rng.range(0.14, 0.72),
        rw: rng.range(0.12, 0.22),
        rh: rng.range(0.1, 0.2),
      });
    }
  }

  return {
    x,
    y,
    w,
    h,
    height,
    roofColor,
    wallColor,
    accent,
    district,
    style: 'tower',
    details,
    ...extra,
  };
}

export function nearVerticalRoad(x, margin) {
  for (const r of VERTICAL_ROADS) {
    if (Math.abs(x - r.x) < r.width * 0.5 + margin) return true;
  }
  return false;
}

export function nearHorizontalRoad(y, margin) {
  for (const r of HORIZONTAL_ROADS) {
    if (Math.abs(y - r.y) < r.width * 0.5 + margin) return true;
  }
  return false;
}

export function getDistrictName(x, y) {
  if (x >= WATER_START_X) return 'SOLARA BAY';
  if (x >= BEACH_START_X) return 'SOLARA BEACH';
  if (x >= BOARDWALK_X - 80) return 'PALM BOARDWALK';
  if (x >= 2600) return 'PALM STRIP';
  if (y < 760 && x > 1400) return 'CORAL HEIGHTS';
  if (y > 2280 || x < 720) return 'PORT SOLARA';
  if (x > 1074 && x < 1491 && y > 1039 && y < 1416) return 'EMERALD PARK';
  return 'DOWNTOWN SOLARA';
}

export function isPointOnPier(city, x, y) {
  for (const pier of city.piers) {
    if (x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h) {
      return true;
    }
  }
  return false;
}

export function isPointInWater(city, x, y) {
  return x > WATER_START_X + 16 && !isPointOnPier(city, x, y);
}

export function isPointOnRoad(x, y) {
  for (const r of VERTICAL_ROADS) {
    if (Math.abs(x - r.x) <= r.width * 0.5) return true;
  }
  for (const r of HORIZONTAL_ROADS) {
    if (Math.abs(y - r.y) <= r.width * 0.5 && x <= BOARDWALK_X) return true;
  }
  return false;
}

// Resolve circle against buildings and world/water borders; returns { hit, nx, ny }
export function resolveCircleWorld(city, entity, radius) {
  let hit = false;
  let nx = 0;
  let ny = 0;

  // World bounds
  if (entity.x < 40 + radius) {
    entity.x = 40 + radius;
    hit = true;
    nx = 1;
  }
  if (entity.y < 40 + radius) {
    entity.y = 40 + radius;
    hit = true;
    ny = 1;
  }
  if (entity.y > WORLD_HEIGHT - 40 - radius) {
    entity.y = WORLD_HEIGHT - 40 - radius;
    hit = true;
    ny = -1;
  }
  // Keep out of deep ocean unless on pier
  if (entity.x > WATER_START_X - radius && !isPointOnPier(city, entity.x, entity.y)) {
    entity.x = WATER_START_X - radius;
    hit = true;
    nx = -1;
  }

  for (const b of city.buildings) {
    const cx = clamp(entity.x, b.x, b.x + b.w);
    const cy = clamp(entity.y, b.y, b.y + b.h);
    const dx = entity.x - cx;
    const dy = entity.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        const ux = dx / d;
        const uy = dy / d;
        entity.x += ux * push;
        entity.y += uy * push;
        nx = ux;
        ny = uy;
      } else {
        // Inside AABB fallback: push to nearest side
        const dl = entity.x - b.x;
        const dr = b.x + b.w - entity.x;
        const dt = entity.y - b.y;
        const db = b.y + b.h - entity.y;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) {
          entity.x = b.x - radius;
          nx = -1;
        } else if (m === dr) {
          entity.x = b.x + b.w + radius;
          nx = 1;
        } else if (m === dt) {
          entity.y = b.y - radius;
          ny = -1;
        } else {
          entity.y = b.y + b.h + radius;
          ny = 1;
        }
      }
    }
  }
  return { hit, nx, ny };
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) {
      return b;
    }
  }
  return null;
}

// Fast ray-segment vs buildings test for bullets and police line-of-sight
export function segmentHitsBuilding(city, x1, y1, x2, y2) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const dx = x2 - x1;
  const dy = y2 - y1;

  for (const b of city.buildings) {
    if (b.x + b.w < minX || b.x > maxX || b.y + b.h < minY || b.y > maxY) continue;
    let t0 = 0;
    let t1 = 1;
    const checks = [
      [-dx, x1 - b.x],
      [dx, b.x + b.w - x1],
      [-dy, y1 - b.y],
      [dy, b.y + b.h - y1],
    ];
    let ok = true;
    for (const [p, q] of checks) {
      if (Math.abs(p) < 1e-6) {
        if (q < 0) {
          ok = false;
          break;
        }
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) {
            ok = false;
            break;
          }
          if (r > t0) t0 = r;
        } else {
          if (r < t0) {
            ok = false;
            break;
          }
          if (r < t1) t1 = r;
        }
      }
    }
    if (ok && t0 <= t1) {
      return {
        building: b,
        t: t0,
        x: x1 + dx * t0,
        y: y1 + dy * t0,
      };
    }
  }
  return null;
}
