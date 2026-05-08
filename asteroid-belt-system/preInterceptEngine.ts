import { AsteroidState } from './types';
import {
  AsteroidPalette,
  AsteroidRockProfile,
  asteroidVisualSeed,
  generateAsteroidRockProfile,
  getAsteroidPalette,
} from './asteroidVisuals';

export interface PreInterceptTarget {
  id: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  baseY: number;
  sinePhase: number;
  driftPhase: number;
  driftPhase2: number;
  rotation: number;
  flowVelX: number;
  flowVelY: number;
  flowMinX: number;
  flowMaxX: number;
  flowMinY: number;
  flowMaxY: number;
  radius: number;
  palette: AsteroidPalette;
  profile: AsteroidRockProfile | null;
}

export function layoutPreInterceptTargets(source: AsteroidState[], W: number, H: number): PreInterceptTarget[] {
  const count = Math.max(1, source.length);
  const spread = count === 1 ? 0 : Math.min(W * 0.46, 140 + count * 34);
  const startX = W * 0.5 - spread / 2;
  const spacing = count === 1 ? 0 : spread / (count - 1);
  return source.map((ast, i) => {
    const x = startX + spacing * i;
    const y = H * 0.5 + Math.sin(i * 1.8) * 52;
    const radius = Math.max(32, Math.min(56, ast.radius * 0.48));
    const flowRangeX = Math.max(40, Math.min(90, W * 0.07));
    const flowRangeY = Math.max(26, Math.min(64, H * 0.055));
    const driftAngle = Math.random() * Math.PI * 2;
    const driftSpeed = 78 + Math.random() * 68;
    return {
      id: ast.id,
      x,
      y,
      prevX: x,
      prevY: y,
      baseY: y,
      sinePhase: Math.random() * Math.PI * 2,
      driftPhase: Math.random() * Math.PI * 2,
      driftPhase2: Math.random() * Math.PI * 2,
      rotation: 0,
      flowVelX: Math.cos(driftAngle) * driftSpeed,
      flowVelY: Math.sin(driftAngle) * driftSpeed,
      flowMinX: x - flowRangeX,
      flowMaxX: x + flowRangeX,
      flowMinY: y - flowRangeY,
      flowMaxY: y + flowRangeY,
      radius,
      palette: getAsteroidPalette(ast.traits),
      profile: generateAsteroidRockProfile(asteroidVisualSeed(ast), radius),
    };
  });
}

export function relayoutPreInterceptTargets(prev: PreInterceptTarget[], W: number, H: number): PreInterceptTarget[] {
  const count = Math.max(1, prev.length);
  const spread = count === 1 ? 0 : Math.min(W * 0.46, 140 + count * 34);
  const startX = W * 0.5 - spread / 2;
  const spacing = count === 1 ? 0 : spread / (count - 1);
  return prev.map((ast, i) => {
    const x = startX + spacing * i;
    const y = H * 0.5 + Math.sin(i * 1.8) * 52;
    const flowRangeX = Math.max(40, Math.min(90, W * 0.07));
    const flowRangeY = Math.max(26, Math.min(64, H * 0.055));
    return {
      ...ast,
      x,
      y,
      prevX: x,
      prevY: y,
      baseY: y,
      flowMinX: x - flowRangeX,
      flowMaxX: x + flowRangeX,
      flowMinY: y - flowRangeY,
      flowMaxY: y + flowRangeY,
    };
  });
}

export function getActivePreInterceptTarget(asteroids: PreInterceptTarget[], activeTargetIndex: number): PreInterceptTarget | null {
  if (asteroids.length === 0) return null;
  return asteroids[Math.max(0, Math.min(activeTargetIndex, asteroids.length - 1))];
}

export interface ReticleSpawnState {
  reticleX: number;
  reticleY: number;
  reticleSpeedPx: number;
  reticleDriftAmp: number;
  reticleDriftFreq: number;
  reticleDriftPhase: number;
  reticleSpeedPulse: number;
  reticleSpeedPulseFreq: number;
  reticleSpeedPulsePhase: number;
  reticleVelX: number;
  reticleVelY: number;
}

export function createReticleSpawn(
  W: number,
  H: number,
  minSpeed: number,
  maxSpeed: number,
  difficulty: number,
  targetX: number,
  targetY: number,
): ReticleSpawnState {
  const spawnPad = 90;
  const side = Math.floor(Math.random() * 4); // 0:left,1:right,2:top,3:bottom
  let reticleX: number;
  let reticleY: number;
  if (side === 0) {
    reticleX = -spawnPad;
    reticleY = H * (0.2 + Math.random() * 0.6);
  } else if (side === 1) {
    reticleX = W + spawnPad;
    reticleY = H * (0.2 + Math.random() * 0.6);
  } else if (side === 2) {
    reticleX = W * (0.2 + Math.random() * 0.6);
    reticleY = -spawnPad;
  } else {
    reticleX = W * (0.2 + Math.random() * 0.6);
    reticleY = H + spawnPad;
  }

  const reticleSpeedPx = minSpeed + Math.random() * (maxSpeed - minSpeed);
  const reticleDriftAmp = 6 + difficulty * 16 + Math.random() * 7;
  const reticleDriftFreq = 4.5 + Math.random() * 3.8;
  const reticleDriftPhase = Math.random() * Math.PI * 2;
  const reticleSpeedPulse = 0.04 + difficulty * 0.1 + Math.random() * 0.04;
  const reticleSpeedPulseFreq = 5 + Math.random() * 4;
  const reticleSpeedPulsePhase = Math.random() * Math.PI * 2;

  const dx = targetX - reticleX;
  const dy = targetY - reticleY;
  const len = Math.max(1, Math.hypot(dx, dy));
  const reticleVelX = (dx / len) * reticleSpeedPx;
  const reticleVelY = (dy / len) * reticleSpeedPx;

  return {
    reticleX,
    reticleY,
    reticleSpeedPx,
    reticleDriftAmp,
    reticleDriftFreq,
    reticleDriftPhase,
    reticleSpeedPulse,
    reticleSpeedPulseFreq,
    reticleSpeedPulsePhase,
    reticleVelX,
    reticleVelY,
  };
}
