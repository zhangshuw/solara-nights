// Deterministic seeded PRNG (Mulberry32) so Solara Bay and screenshot scenes reproduce identically.

export class SeededRandom {
  constructor(seed = 202607) {
    this.seed = seed >>> 0;
    this.state = this.seed || 1;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(list) {
    if (!list || list.length === 0) return undefined;
    return list[Math.floor(this.next() * list.length)];
  }

  angle() {
    return this.next() * Math.PI * 2;
  }

  fork(salt = 1) {
    const derived = ((this.state ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0) || 1;
    return new SeededRandom(derived);
  }
}

export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

export function distSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}
