export type PartType = 'MECH' | 'PLASMA' | 'VOID' | 'BIO';

export interface OrbitalPoint {
  id: string;
  radius: number;
  angle: number;
  armIndex: number;
  orbitalSpeed: number;
  verticalOffset: number;
  jitter: number;
}

export interface OrbitalSystem extends OrbitalPoint {
  systemNumber: number;
  conquered?: boolean;
  partType?: PartType;
}

export interface GalaxyModel {
  arms: OrbitalPoint[];
  lanes: OrbitalPoint[];
  dust: OrbitalPoint[];
  halo: OrbitalPoint[];
  systems: OrbitalSystem[];
  maxRadius: number;
  armCount: number;
}

export interface ProjectedPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  armIndex: number;
  scale: number;
  opacity: number;
  blur: number;
}

export interface ProjectedSystem extends ProjectedPoint {
  systemNumber: number;
  conquered?: boolean;
  partType?: PartType;
}

export interface ProjectedFrame {
  arms: ProjectedPoint[];
  lanes: ProjectedPoint[];
  dust: ProjectedPoint[];
  halo: ProjectedPoint[];
  systems: ProjectedSystem[];
}

function seeded(seedText: string) {
  let seed = 0;
  for (let i = 0; i < seedText.length; i++) seed = ((seed * 33) + seedText.charCodeAt(i)) >>> 0;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

function gauss(rand: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function buildOrbitalGalaxyModel(
  seedKey: string,
  systemCount: number,
  systemMeta: Array<{ systemNumber: number; conquered?: boolean; partType?: PartType }> = []
): GalaxyModel {
  const rand = seeded(seedKey || 'galaxy');
  // Milky Way-like profile tuned from the provided Three.js model.
  const armCount = 4;
  const maxRadius = 48;
  const armSpacing = (Math.PI * 2) / armCount;
  const spiralTightness = 0.9;
  const minRadius = 1.8;
  const randomness = 0.18;
  const randomnessPower = 2.8;
  const scatter = (radius: number, flatten = 1) =>
    Math.pow(rand(), randomnessPower) * (rand() < 0.5 ? 1 : -1) * randomness * radius * flatten;

  const arms: OrbitalPoint[] = [];
  for (let i = 0; i < 4200; i++) {
    const armIndex = i % armCount;
    const radius = minRadius + Math.pow(rand(), 0.75) * (maxRadius - minRadius);
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * spiralTightness;
    const randomArmSpread = scatter(radius, 0.06);
    const angle = baseArmAngle + twist + randomArmSpread;
    arms.push({
      id: `a-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00012 + (1 - radius / maxRadius) * 0.00028,
      verticalOffset: scatter(radius, 0.12),
      jitter: scatter(radius, 0.04),
    });
  }

  const dust: OrbitalPoint[] = [];
  for (let i = 0; i < 2200; i++) {
    const armIndex = i % armCount;
    const radius = minRadius + Math.pow(rand(), 0.75) * (maxRadius - minRadius);
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * (spiralTightness * 0.94);
    const randomArmSpread = scatter(radius, 0.12);
    const angle = baseArmAngle + twist + randomArmSpread;
    dust.push({
      id: `d-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00009 + (1 - radius / maxRadius) * 0.00018,
      verticalOffset: scatter(radius, 0.18),
      jitter: scatter(radius, 0.06),
    });
  }

  const lanes: OrbitalPoint[] = [];
  for (let i = 0; i < 2400; i++) {
    const armIndex = i % armCount;
    const radius = minRadius + Math.pow(rand(), 0.74) * (maxRadius - minRadius);
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * (spiralTightness * 0.98);
    const randomArmSpread = scatter(radius, 0.08);
    const angle = baseArmAngle + (armSpacing * 0.5) + twist + randomArmSpread;
    lanes.push({
      id: `l-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00008 + (1 - radius / maxRadius) * 0.00013,
      verticalOffset: scatter(radius, 0.1),
      jitter: scatter(radius, 0.05),
    });
  }

  const halo: OrbitalPoint[] = [];
  for (let i = 0; i < 1400; i++) {
    const armIndex = i % armCount;
    const radius = (0.55 + Math.pow(rand(), 0.55) * 0.75) * maxRadius;
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * (spiralTightness * 0.82);
    const randomArmSpread = scatter(radius, 0.2);
    const angle = baseArmAngle + twist + randomArmSpread;
    halo.push({
      id: `h-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00005 + (1 - Math.min(1, radius / (maxRadius * 1.3))) * 0.00008,
      verticalOffset: scatter(radius, 0.2),
      jitter: scatter(radius, 0.08),
    });
  }

  const meta = new Map(systemMeta.map((s) => [Number(s.systemNumber), s]));
  const systems: OrbitalSystem[] = [];
  const total = Math.max(1, systemCount);
  for (let i = 0; i < total; i++) {
    const n = i + 1;
    const t = (i + 0.5) / total;
    const radius = minRadius + (0.16 + Math.pow(t, 0.82) * 0.84) * (maxRadius - minRadius);
    const armIndex = i % armCount;
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * (spiralTightness * 1.05);
    const randomArmSpread = scatter(radius, 0.025);
    const angle = baseArmAngle + twist + randomArmSpread + Math.floor(i / armCount) * 0.14;
    const m = meta.get(n);
    systems.push({
      id: `s-${n}`,
      systemNumber: n,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.0002 + (1 - radius / maxRadius) * 0.00028,
      verticalOffset: scatter(radius, 0.05),
      jitter: scatter(radius, 0.02),
      conquered: m?.conquered,
      partType: m?.partType,
    });
  }

  return { arms, lanes, dust, halo, systems, maxRadius, armCount };
}

export function projectOrbitalFrame(model: GalaxyModel, timeMs: number): ProjectedFrame {
  const spiralTwist = 0.22;
  const armSpacing = (Math.PI * 2) / model.armCount;
  const tilt = 1.0; // keep galaxy level
  const scale = 1.0;

  const project = (p: OrbitalPoint, laneOffset = 0): ProjectedPoint => {
    const rotation = timeMs * p.orbitalSpeed;
    const theta = p.angle + p.radius * spiralTwist + laneOffset * armSpacing + p.jitter + rotation;
    const x = Math.cos(theta) * p.radius;
    const y = Math.sin(theta) * p.radius;

    // Preserve top-down arm structure with only mild perspective compression.
    const verticalJitter = p.verticalOffset;
    const screenX = 50 + x * scale;
    const screenY = 50 + y * scale * tilt + verticalJitter;

    // Depth only affects style, not arm geometry.
    const zNorm = clamp(Math.sin(theta), -1, 1);
    const t = (zNorm + 1) * 0.5;
    const depthScale = 0.65 + t * 0.6;
    const opacity = 0.35 + t * 0.65;
    const blur = 2 - t * 2;

    return {
      id: p.id,
      x: screenX,
      y: screenY,
      z: zNorm,
      armIndex: p.armIndex,
      scale: depthScale,
      opacity,
      blur,
    };
  };

  const arms = model.arms.map(project).sort((a, b) => a.z - b.z);
  const lanes = model.lanes.map((p) => project(p, 0.5)).sort((a, b) => a.z - b.z);
  const dust = model.dust.map(project).sort((a, b) => a.z - b.z);
  const halo = model.halo.map(project).sort((a, b) => a.z - b.z);
  const systems = model.systems
    .map((s) => {
      const p = project(s);
      return {
        ...p,
        systemNumber: s.systemNumber,
        conquered: s.conquered,
        partType: s.partType,
      } as ProjectedSystem;
    })
    .sort((a, b) => a.z - b.z);

  return { arms, lanes, dust, halo, systems };
}
