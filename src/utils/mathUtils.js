// src/utils/mathUtils.js

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

export function angle(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function spawnPositionOnEdge(width, height, margin = 30) {
  const edge = Math.floor(Math.random() * 4);
  switch (edge) {
    case 0: return { x: randomRange(0, width), y: -margin };
    case 1: return { x: width + margin, y: randomRange(0, height) };
    case 2: return { x: randomRange(0, width), y: height + margin };
    case 3: return { x: -margin, y: randomRange(0, height) };
    default: return { x: 0, y: 0 };
  }
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

export function vectorFromAngle(angle, magnitude) {
  return {
    x: Math.cos(angle) * magnitude,
    y: Math.sin(angle) * magnitude,
  };
}

let _id = 1;
export function uid() {
  return _id++;
}
