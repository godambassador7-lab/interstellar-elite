export interface GalaxyNode {
  id: number;
  x: number;
  y: number;
  ring: number;
  angle: number;
  radius: number;
}

export interface GalaxyProjectedPoint {
  id: string | number;
  x: number; // percent
  y: number; // percent
  z: number; // -1 far .. +1 near
  scale: number;
  opacity: number;
}

export interface GalaxySystemPoint extends GalaxyProjectedPoint {
  systemNumber: number;
}

export interface GalaxyModel {
  starsFar: GalaxyProjectedPoint[];
  starsNear: GalaxyProjectedPoint[];
  dust: GalaxyProjectedPoint[];
  systems: GalaxySystemPoint[];
}

function seededRng(seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = ((seed * 33) + seedText.charCodeAt(i)) >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

export function buildGalaxyNodes(total: number, seedKey: string): GalaxyNode[] {
  const count = Math.max(1, total);
  const rand = seededRng(seedKey || 'galaxy');
  const nodes: GalaxyNode[] = [];
  for (let i = 0; i < count; i++) {
    const ring = i % 3;
    const radius = 24 + ring * 8 + ((i % 2) ? 2 : -2);
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.2;
    nodes.push({
      id: i + 1,
      ring,
      angle,
      radius,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * (radius * 0.64),
    });
  }
  return nodes;
}

export function buildGalaxyStars(seedKey: string, count = 900) {
  const rand = seededRng(seedKey || 'galaxy-stars');
  const palette = ['#FFFFFF', '#EAF4FF', '#CFE8FF', '#89C7FF', '#FFB58E', '#FFD96C', '#FF8E8E'];
  return Array.from({ length: Math.max(1, count) }, (_, i) => {
    const armCount = 4;
    const arm = i % armCount;
    const twist = rand() * 0.9 + 0.2;
    const rNorm = Math.pow(rand(), 0.62);
    const armAngle = (arm / armCount) * (Math.PI * 2);
    const a = armAngle + rNorm * 5.4 + (rand() - 0.5) * twist;
    const rx = 46 * rNorm;
    const ry = 31 * rNorm;
    return {
      id: `gs-${i}`,
      x: 50 + Math.cos(a) * rx + (rand() - 0.5) * 3,
      y: 50 + Math.sin(a) * ry + (rand() - 0.5) * 2.2,
      size: 0.65 + rand() * 2.35,
      opacity: 0.24 + rand() * 0.76,
      color: palette[Math.floor(rand() * palette.length)],
    };
  });
}

function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function buildProjectedPoint(
  id: string | number,
  x3: number,
  y3: number,
  z3: number,
): GalaxyProjectedPoint {
  // z3 expected roughly in [-1,1]
  const t = clamp01((z3 + 1) * 0.5);
  const perspectiveScale = 1 + (t - 0.5) * 0.45;
  const px = 50 + x3 * perspectiveScale;
  const py = 50 + y3 + z3 * 5.4;
  const scale = 0.58 + t * 0.82;
  const opacity = 0.16 + t * 0.78;
  return { id, x: px, y: py, z: z3, scale, opacity };
}

export function buildSideViewGalaxyModel(
  seedKey: string,
  systemCount: number,
): GalaxyModel {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) seed = ((seed * 41) + seedKey.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const galaxyRadius = 45;
  const spiralTightness = 0.11;
  const depthCompression = 0.82;
  const diskThickness = 4.7;

  const starsRaw: GalaxyProjectedPoint[] = [];
  const dustRaw: GalaxyProjectedPoint[] = [];

  for (let i = 0; i < 640; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * galaxyRadius;
    const spiralOffset = angle + radius * spiralTightness;
    const x = Math.cos(spiralOffset) * radius;
    const z = Math.sin(spiralOffset) * radius * depthCompression / galaxyRadius;
    const y = gaussian(rand) * diskThickness * (1 - (radius / galaxyRadius) * 0.4);
    starsRaw.push(buildProjectedPoint(`sf-${i}`, x, y, z));
  }

  for (let i = 0; i < 260; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * galaxyRadius * (0.9 + rand() * 0.15);
    const spiralOffset = angle + radius * (spiralTightness * 0.9);
    const x = Math.cos(spiralOffset) * radius;
    const z = Math.sin(spiralOffset) * radius * (depthCompression * 0.75) / galaxyRadius;
    const y = gaussian(rand) * (diskThickness * 1.45);
    dustRaw.push(buildProjectedPoint(`d-${i}`, x, y, z));
  }

  const systemsRaw: GalaxySystemPoint[] = [];
  const totalSystems = Math.max(1, systemCount);
  for (let i = 0; i < totalSystems; i++) {
    const baseAngle = (i / totalSystems) * Math.PI * 2 + (rand() - 0.5) * 0.35;
    const radius = Math.sqrt((i + 1) / totalSystems) * (galaxyRadius * 0.92);
    const spiralOffset = baseAngle + radius * (spiralTightness * 1.16);
    const x = Math.cos(spiralOffset) * radius;
    const z = Math.sin(spiralOffset) * radius * (depthCompression * 0.92) / galaxyRadius;
    const y = gaussian(rand) * (diskThickness * 0.72) * (1 - (radius / galaxyRadius) * 0.35);
    const p = buildProjectedPoint(`sys-${i}`, x, y, z);
    systemsRaw.push({
      ...p,
      systemNumber: i + 1,
      scale: 0.7 + ((z + 1) * 0.5) * 0.9,
      opacity: 0.35 + ((z + 1) * 0.5) * 0.65,
    });
  }

  const starsFar = starsRaw.filter((s) => s.z < 0).sort((a, b) => a.z - b.z);
  const starsNear = starsRaw.filter((s) => s.z >= 0).sort((a, b) => a.z - b.z);
  const dust = dustRaw.sort((a, b) => a.z - b.z);
  const systems = systemsRaw.sort((a, b) => a.z - b.z);

  return { starsFar, starsNear, dust, systems };
}
