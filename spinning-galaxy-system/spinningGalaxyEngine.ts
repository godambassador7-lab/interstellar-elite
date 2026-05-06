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
  const armCount = 6;
  const maxRadius = 47;
  const armSpacing = (Math.PI * 2) / armCount;
  const spiralTightness = 0.27;
  const minRadius = 2.2;

  const arms: OrbitalPoint[] = [];
  for (let i = 0; i < 4200; i++) {
    const armIndex = i % armCount;
    const radius = minRadius + Math.pow(rand(), 0.65) * (maxRadius - minRadius);
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * spiralTightness;
    const randomArmSpread = (rand() - 0.5) * 0.82;
    const angle = baseArmAngle + twist + randomArmSpread;
    arms.push({
      id: `a-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00012 + (1 - radius / maxRadius) * 0.00028,
      verticalOffset: gauss(rand) * (6.4 * (1 - radius / (maxRadius * 1.08))),
      jitter: (rand() - 0.5) * 0.42,
    });
  }

  const dust: OrbitalPoint[] = [];
  for (let i = 0; i < 2200; i++) {
    const armIndex = i % armCount;
    const radius = minRadius + Math.pow(rand(), 0.72) * (maxRadius - minRadius);
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * (spiralTightness * 0.92);
    const randomArmSpread = (rand() - 0.5) * 1.06;
    const angle = baseArmAngle + twist + randomArmSpread;
    dust.push({
      id: `d-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00009 + (1 - radius / maxRadius) * 0.00018,
      verticalOffset: gauss(rand) * 8.8,
      jitter: (rand() - 0.5) * 0.66,
    });
  }

  const lanes: OrbitalPoint[] = [];
  for (let i = 0; i < 2400; i++) {
    const armIndex = i % armCount;
    const radius = minRadius + Math.pow(rand(), 0.7) * (maxRadius - minRadius);
    const baseArmAngle = armIndex * armSpacing;
    // Dark lanes sit between bright arms.
    const twist = radius * (spiralTightness * 0.98);
    const randomArmSpread = (rand() - 0.5) * 0.72;
    const angle = baseArmAngle + (armSpacing * 0.5) + twist + randomArmSpread;
    lanes.push({
      id: `l-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00008 + (1 - radius / maxRadius) * 0.00013,
      verticalOffset: gauss(rand) * 4.9,
      jitter: (rand() - 0.5) * 0.34,
    });
  }

  const halo: OrbitalPoint[] = [];
  for (let i = 0; i < 1400; i++) {
    const armIndex = i % armCount;
    const radius = (0.55 + Math.pow(rand(), 0.55) * 0.75) * maxRadius;
    const baseArmAngle = armIndex * armSpacing;
    const twist = radius * (spiralTightness * 0.75);
    const randomArmSpread = (rand() - 0.5) * 1.7;
    const angle = baseArmAngle + twist + randomArmSpread;
    halo.push({
      id: `h-${i}`,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.00005 + (1 - Math.min(1, radius / (maxRadius * 1.3))) * 0.00008,
      verticalOffset: gauss(rand) * 10.8,
      jitter: (rand() - 0.5) * 0.8,
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
    const twist = radius * (spiralTightness * 1.1);
    const randomArmSpread = (rand() - 0.5) * 0.26;
    const angle = baseArmAngle + twist + randomArmSpread + Math.floor(i / armCount) * 0.14;
    const m = meta.get(n);
    systems.push({
      id: `s-${n}`,
      systemNumber: n,
      radius,
      angle,
      armIndex,
      orbitalSpeed: 0.0002 + (1 - radius / maxRadius) * 0.00028,
      verticalOffset: gauss(rand) * (2.2 + (1 - radius / maxRadius) * 1.2),
      jitter: (rand() - 0.5) * 0.24,
      conquered: m?.conquered,
      partType: m?.partType,
    });
  }

  return { arms, lanes, dust, halo, systems, maxRadius, armCount };
}

export function projectOrbitalFrame(model: GalaxyModel, timeMs: number): ProjectedFrame {
  const spiralTwist = 0.16;
  const armSpacing = (Math.PI * 2) / model.armCount;
  const depthCompression = 0.9;
  const tiltFactor = 0.16;
  const inclination = 0.94; // keep side-angle feel

  const project = (p: OrbitalPoint, laneOffset = 0): ProjectedPoint => {
    const angle = p.angle + timeMs * p.orbitalSpeed;
    const spiralAngle = angle + p.radius * spiralTwist + (p.armIndex + laneOffset) * armSpacing + p.jitter;
    const xRaw = Math.cos(spiralAngle) * p.radius;
    const zRaw = Math.sin(spiralAngle) * p.radius;
    const armPhase = (p.armIndex / Math.max(1, model.armCount)) * (Math.PI * 2);
    const armLift = Math.sin(armPhase) * (1.9 + (p.radius / model.maxRadius) * 1.2);
    const yRaw = p.verticalOffset * 0.72
      + Math.sin(spiralAngle * 0.72) * (1.05 + (p.radius / model.maxRadius) * 0.85)
      + armLift;

    // Rotate around x-axis to get tilted disk projection with preserved arm curvature.
    const cosI = Math.cos(inclination);
    const sinI = Math.sin(inclination);
    const yTilt = yRaw * cosI - zRaw * sinI;
    const zTilt = yRaw * sinI + zRaw * cosI;

    const x3 = xRaw;
    const z3 = zTilt * depthCompression;
    const y3 = yTilt + z3 * tiltFactor;

    const zNorm = clamp(z3 / model.maxRadius, -1, 1);
    const t = (zNorm + 1) * 0.5;
    const scale = 0.55 + t * 0.8;
    const opacity = 0.35 + t * 0.65;
    const blur = 2 - t * 2;

    return {
      id: p.id,
      x: 50 + x3,
      y: 50 + y3,
      z: zNorm,
      armIndex: p.armIndex,
      scale,
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
