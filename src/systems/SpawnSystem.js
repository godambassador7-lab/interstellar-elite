// src/systems/SpawnSystem.js

import { ENEMY_TYPES, SCREEN } from '../utils/constants';
import { uid } from '../utils/mathUtils';

const GIGANAUT_SIZE = ENEMY_TYPES.elite.size * 2;
const SPECIAL_CLASS_SIZE_MULT = 3;
const ELITE_SIZE_MULT = 2 / 3;
const MASS_REFERENCE_SIZE = ENEMY_TYPES.swarm.size || 14;
const MASS_SPEED_EXP = 0.58;

const SYSTEM_ELITE_SPAWN_WEIGHTS = {
  frontier: [
    { key: 'legionary', w: 0.46 },
    { key: 'raybin', w: 0.24 },
    { key: 'hord', w: 0.14 },
    { key: 'outlander', w: 0.16 },
  ],
  contested: [
    { key: 'legionary', w: 0.22 },
    { key: 'raybin', w: 0.42 },
    { key: 'hord', w: 0.14 },
    { key: 'outlander', w: 0.22 },
  ],
  warzone: [
    { key: 'legionary', w: 0.16 },
    { key: 'raybin', w: 0.2 },
    { key: 'hord', w: 0.48 },
    { key: 'outlander', w: 0.16 },
  ],
  core: [
    { key: 'legionary', w: 0.14 },
    { key: 'raybin', w: 0.22 },
    { key: 'hord', w: 0.2 },
    { key: 'outlander', w: 0.44 },
  ],
};

const SYSTEM_DIFFICULTY_CURVES = {
  frontier: { waveMult: 0.92, spawnIntervalMult: 1.08, activeCapMult: 0.9, eliteChanceBonus: -0.02 },
  contested: { waveMult: 1.04, spawnIntervalMult: 0.97, activeCapMult: 1.03, eliteChanceBonus: 0.01 },
  warzone: { waveMult: 1.14, spawnIntervalMult: 0.88, activeCapMult: 1.16, eliteChanceBonus: 0.03 },
  core: { waveMult: 1.22, spawnIntervalMult: 0.81, activeCapMult: 1.24, eliteChanceBonus: 0.05 },
};

function getSystemType(state) {
  const galaxySystems = Math.max(1, Number(state?.galaxy?.systems) || 1);
  const systemNumber = Math.max(1, Math.min(galaxySystems, Number(state?.systemNumber) || 1));
  const t = systemNumber / galaxySystems;
  if (t <= 0.25) return 'frontier';
  if (t <= 0.5) return 'contested';
  if (t <= 0.75) return 'warzone';
  return 'core';
}

function chooseWeightedType(entries, fallback = ENEMY_TYPES.legionary) {
  if (!entries?.length) return fallback;
  let r = Math.random();
  for (const entry of entries) {
    r -= entry.w;
    if (r <= 0) return ENEMY_TYPES[entry.key] || fallback;
  }
  const tail = entries[entries.length - 1];
  return ENEMY_TYPES[tail.key] || fallback;
}

function getSystemSpawnProfile(state) {
  const systemType = getSystemType(state);
  const weights = SYSTEM_ELITE_SPAWN_WEIGHTS[systemType] || SYSTEM_ELITE_SPAWN_WEIGHTS.frontier;
  const curve = SYSTEM_DIFFICULTY_CURVES[systemType] || SYSTEM_DIFFICULTY_CURVES.frontier;
  return { systemType, weights, curve };
}

function chooseAdvancedTypeBySystem(state) {
  const { systemType, weights } = getSystemSpawnProfile(state);
  const quadrant = state?.galaxy?.quadrant || 'bayron';
  const locks = {
    bayron: {
      frontier: 'legionary',
      contested: 'outlander',
      warzone: 'raybin',
      core: 'hord',
    },
    crimson: {
      frontier: 'raybin',
      contested: 'legionary',
      warzone: 'hord',
      core: 'outlander',
    },
    watupi: {
      frontier: 'hord',
      contested: 'legionary',
      warzone: 'outlander',
      core: 'raybin',
    },
    ultra316: {
      frontier: 'outlander',
      contested: 'raybin',
      warzone: 'hord',
      core: 'outlander',
    },
  };
  const lockPick = (locks[quadrant] && locks[quadrant][systemType]) || 'legionary';
  const lockWeight = 0.52;
  if (Math.random() < lockWeight) return ENEMY_TYPES[lockPick] || ENEMY_TYPES.legionary;
  return chooseWeightedType(weights, ENEMY_TYPES[lockPick] || ENEMY_TYPES.legionary);
}

function chooseTypeForSpecialScenario(state) {
  const mode = state?.specialScenario;
  if (!mode) return null;
  const r = Math.random();
  if (mode === 'singularity') {
    if (r < 0.24) return ENEMY_TYPES.outlander;
    if (r < 0.44) return ENEMY_TYPES.raybin;
    if (r < 0.62) return ENEMY_TYPES.legionary;
    if (r < 0.78) return ENEMY_TYPES.elite;
    return ENEMY_TYPES.hord;
  }
  if (mode === 'meganaut') {
    if (r < 0.26) return ENEMY_TYPES.hord;
    if (r < 0.48) return ENEMY_TYPES.raybin;
    if (r < 0.64) return ENEMY_TYPES.outlander;
    if (r < 0.8) return ENEMY_TYPES.heavy;
    return ENEMY_TYPES.elite;
  }
  if (mode === 'armageddon') {
    if (r < 0.17) return ENEMY_TYPES.hord;
    if (r < 0.31) return ENEMY_TYPES.raybin;
    if (r < 0.43) return ENEMY_TYPES.outlander;
    if (r < 0.56) return ENEMY_TYPES.legionary;
    if (r < 0.72) return ENEMY_TYPES.heavy;
    if (r < 0.88) return ENEMY_TYPES.elite;
    return ENEMY_TYPES.swarm;
  }
  return null;
}

function normalizeAngleDelta(delta) {
  let d = delta;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

export function getWaveEnemyCount(wave, galaxy, systemNumber = 1) {
  const baseEnemies = galaxy?.baseEnemies ?? 14;
  const enemyGrowth = galaxy?.enemyGrowth ?? 5;
  const threat = galaxy?.threat ?? 1;
  const systemType = getSystemType({ galaxy, systemNumber });
  const curveCfg = SYSTEM_DIFFICULTY_CURVES[systemType] || SYSTEM_DIFFICULTY_CURVES.frontier;
  const curve = 1 + Math.min(0.42, Math.max(0, wave - 1) * 0.035);
  return Math.max(6, Math.round((baseEnemies + (wave - 1) * enemyGrowth) * threat * curve * curveCfg.waveMult));
}

/**
 * Returns enemies to add for this frame based on wave budgets.
 */
export function trySpawn(state) {
  const now = Date.now();

  if (state.waveSpawnRemaining <= 0) return null;
  if (now < (state.nextWaveSpawnAt || 0)) return null;
  const threat = state.galaxy?.threat ?? 1;
  const { curve: systemCurve } = getSystemSpawnProfile(state);
  const specialMode = state?.specialScenario;
  const specialActiveMult = specialMode === 'armageddon' ? 1.85 : specialMode === 'meganaut' ? 1.46 : specialMode === 'singularity' ? 1.28 : 1;
  const maxActive = Math.round((10 + state.currentWave * 1.8) * threat * specialActiveMult * systemCurve.activeCapMult);
  if (state.enemies.length >= maxActive) return null;

  const waveSoft = Math.min(11, state.currentWave);
  const interval = Math.max(
    130,
    ((840 - waveSoft * 44) / threat) *
      (specialMode === 'armageddon' ? 0.5 : specialMode === 'meganaut' ? 0.62 : specialMode === 'singularity' ? 0.56 : 1) *
      systemCurve.spawnIntervalMult
  );
  if (now - state.lastSpawnTime < interval) return null;
  state.lastSpawnTime = now;

  const waveProgress = state.currentWave / Math.max(1, state.maxWaves);
  const eliteChance = Math.min(0.34, Math.max(0.02, 0.035 + waveProgress * 0.13 + state.currentWave * 0.015 * threat + systemCurve.eliteChanceBonus));
  const heavyChance = Math.min(0.3, 0.085 + waveProgress * 0.11 + state.currentWave * 0.016 * threat);

  const advancedChance = Math.min(0.42, Math.max(0, waveProgress - 0.14) * 0.55 + state.currentWave * 0.012);
  const r = Math.random();
  let typeDef;
  const specialDef = chooseTypeForSpecialScenario(state);
  if (specialDef) {
    typeDef = specialDef;
  } else if (r < advancedChance) {
    typeDef = chooseAdvancedTypeBySystem(state);
  } else if (r < advancedChance + eliteChance) {
    typeDef = ENEMY_TYPES.elite;
  } else if (r < advancedChance + eliteChance + heavyChance) {
    typeDef = ENEMY_TYPES.heavy;
  } else {
    typeDef = ENEMY_TYPES.swarm;
  }

  const desiredCount =
    specialMode === 'armageddon'
      ? Math.floor(3 + Math.random() * 4)
      : specialMode === 'meganaut'
        ? Math.floor(2 + Math.random() * 4)
      : typeDef.type === 'hord' && Math.random() < Math.min(0.86, 0.5 + state.currentWave * 0.04)
      ? Math.floor(3 + Math.random() * 3)
      : (typeDef.type === 'swarm' || typeDef.type === 'legionary') && Math.random() < Math.min(0.72, 0.44 + state.currentWave * 0.05)
      ? Math.floor(2 + Math.random() * 3)
      : 1;
  const count = Math.max(1, Math.min(desiredCount, state.waveSpawnRemaining));

  const worldWidth = state?.world?.width || SCREEN.width;
  const worldHeight = state?.world?.height || SCREEN.height;
  const camX = state?.cameraX ?? Math.max(0, Math.min(worldWidth - SCREEN.width, state.player.x - SCREEN.width / 2));
  const camY = state?.cameraY ?? Math.max(0, Math.min(worldHeight - SCREEN.height, state.player.y - SCREEN.height / 2));
  const margin = 36;
  const edge = Math.floor(Math.random() * 4);
  let basePos;
  if (edge === 0) {
    basePos = { x: camX + Math.random() * SCREEN.width, y: camY - margin };
  } else if (edge === 1) {
    basePos = { x: camX + SCREEN.width + margin, y: camY + Math.random() * SCREEN.height };
  } else if (edge === 2) {
    basePos = { x: camX + Math.random() * SCREEN.width, y: camY + SCREEN.height + margin };
  } else {
    basePos = { x: camX - margin, y: camY + Math.random() * SCREEN.height };
  }
  const enemies = [];

  if (state.forceGiganautOnly) {
    if (state.giganautForcedSpawned) return null;
    state.giganautForcedSpawned = true;
    state.nemesisSpawned = true;
    state.waveSpawnRemaining = 0;
    return [createGiganautNemesis(basePos)];
  }

  for (let i = 0; i < count; i++) {
    const spread = count > 1 ? 34 : 0;
    enemies.push(createEnemy(typeDef, {
      x: Math.max(22, Math.min(worldWidth - 22, basePos.x + (Math.random() - 0.5) * spread)),
      y: Math.max(22, Math.min(worldHeight - 22, basePos.y + (Math.random() - 0.5) * spread)),
    }));
  }

  state.waveSpawnRemaining -= count;
  return enemies;
}

function createGiganautNemesis(basePos) {
  const nemesis = createEnemy(ENEMY_TYPES.elite, basePos);
  nemesis.isNemesis = true;
  nemesis.isGiganaut = true;
  nemesis.size = GIGANAUT_SIZE;
  nemesis.name = 'GIGANAUT-CLASS FLAGSHIP';
  nemesis.hp *= 8.2;
  nemesis.maxHp = nemesis.hp;
  // Flagship baseline is elite speed * 1.2; Giganaut should be half of that => elite * 0.6.
  nemesis.speed *= 0.6;
  nemesis.damage *= 1.65;
  nemesis.score = Math.round(nemesis.score * 7.5);
  nemesis.giganaut = {
    phase: 1,
    phaseLabel: 'ARRIVAL',
    subsystems: {
      coreReactor: 100,
      commandBridge: 100,
      shieldNodes: 100,
      weaponArrays: 100,
      hangarBays: 100,
      engineCore: 100,
    },
  };
  nemesis.visualRadiusHint = 250;
  return nemesis;
}

export function createGiganautNemesisAt(basePos) {
  return createGiganautNemesis(basePos);
}

function createEnemy(def, pos) {
  const isSpecialClass =
    def.type === 'legionary' ||
    def.type === 'raybin' ||
    def.type === 'hord' ||
    def.type === 'outlander';
  const isElite = def.type === 'elite';
  const heavyRole = def.type === 'heavy'
    ? (Math.random() < 0.5 ? 'siege' : 'hunter')
    : null;
  const eliteRole = isElite
    ? (Math.random() < 0.34 ? 'long_range_laser' : 'standard')
    : null;
  const scaledSize = isSpecialClass
    ? def.size * SPECIAL_CLASS_SIZE_MULT
    : isElite
      ? def.size * ELITE_SIZE_MULT
      : def.size;
  const massSpeedFactor = Math.pow(MASS_REFERENCE_SIZE / Math.max(8, scaledSize), MASS_SPEED_EXP);
  const smallFighterSpeedMult = def.type === 'swarm' ? 2.5 : 1;
  const flankSide = Math.random() < 0.5 ? -1 : 1;
  return {
    id: uid(),
    type: def.type,
    heavyRole,
    eliteRole,
    flankSide,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    facingAngle: 0,
    size: scaledSize,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * (0.85 + Math.random() * 0.3) * massSpeedFactor * smallFighterSpeedMult,
    damage: def.damage,
    score: def.score,
    color: def.color,
    glow: def.glow,
    points: def.points,
    dead: false,
    hitFlash: 0,
    zigZagPhase: Math.random() * Math.PI * 2,
    zigZagTimer: 0,
    burstTimer: 0,
    burstActive: false,
    burstDuration: 0,
    lastLaserAt: 0,
    laserFlash: 0,
    lastPhotonAt: 0,
    lastSwarmPhotonAt: 0,
    lastRaybinMissileAt: 0,
    lastLegionaryPhotonAt: 0,
    lastHordWellAt: 0,
    lastOutlanderLaserAt: 0,
    lastOutlanderTeleportAt: 0,
    tacticPhase: Math.random() * Math.PI * 2,
    tacticTimer: 0,
    surgeUntil: 0,
  };
}

export function updateEnemyMovement(state, deltaMs) {
  const dt = deltaMs / 1000;
  const { player, enemies } = state;
  const now = Date.now();
  const worldWidth = state?.world?.width || SCREEN.width;
  const worldHeight = state?.world?.height || SCREEN.height;
  const frozen = !!state?.abilities?.quantum?.active && (state?.abilities?.quantum?.freezeRemaining || 0) > 0;
  const hordAllies = enemies.filter((e) => !e.dead && e.type === 'hord');
  const raybinAllies = enemies.filter((e) => !e.dead && e.type === 'raybin');
  const legionaryAllies = enemies.filter((e) => !e.dead && e.type === 'legionary');
  const hordCenter = hordAllies.length
    ? {
        x: hordAllies.reduce((a, e) => a + e.x, 0) / hordAllies.length,
        y: hordAllies.reduce((a, e) => a + e.y, 0) / hordAllies.length,
      }
    : null;

  for (const enemy of enemies) {
    if (enemy.dead) continue;

    // Flagship reinforcements launch outward first before converging.
    if (enemy.isFlagshipMinion && enemy.launchUntil && now < enemy.launchUntil) {
      enemy.vx = enemy.launchVx ?? 0;
      enemy.vy = enemy.launchVy ?? 0;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      const hr = enemy.size / 2;
      enemy.x = Math.max(hr, Math.min(worldWidth - hr, enemy.x));
      enemy.y = Math.max(hr, Math.min(worldHeight - hr, enemy.y));
      if (enemy.hitFlash > 0) enemy.hitFlash--;
      continue;
    }

    if (frozen) {
      enemy.vx *= 0.82;
      enemy.vy *= 0.82;
      if (enemy.hitFlash > 0) enemy.hitFlash--;
      enemy.x = Math.max(enemy.size / 2, Math.min(worldWidth - enemy.size / 2, enemy.x));
      enemy.y = Math.max(enemy.size / 2, Math.min(worldHeight - enemy.size / 2, enemy.y));
      continue;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d < 0.1) continue;
    const nx = dx / d;
    const ny = dy / d;

    if (enemy.isNemesis) {
      // Flagship should drive forward toward the player; avoid lateral orbiting.
      const targetVx = nx * enemy.speed * 0.96;
      const targetVy = ny * enemy.speed * 0.96;
      enemy.vx += (targetVx - enemy.vx) * 0.16;
      enemy.vy += (targetVy - enemy.vy) * 0.16;
      const vmax = enemy.speed * 1.02;
      const vlen = Math.hypot(enemy.vx, enemy.vy);
      if (vlen > vmax && vlen > 0) {
        const s = vmax / vlen;
        enemy.vx *= s;
        enemy.vy *= s;
      }
    } else if (enemy.type === 'swarm') {
      enemy.vx = nx * enemy.speed;
      enemy.vy = ny * enemy.speed;
    } else if (enemy.type === 'heavy') {
      const targetVx = nx * enemy.speed;
      const targetVy = ny * enemy.speed;
      if (enemy.heavyRole === 'siege') {
        const standOff = 220;
        const toward = d > standOff ? 1 : 0.25;
        enemy.vx += (targetVx * toward - enemy.vx) * 0.034;
        enemy.vy += (targetVy * toward - enemy.vy) * 0.034;
      } else {
        const perpX = -ny;
        const perpY = nx;
        const strafe = Math.sin((enemy.zigZagTimer || 0) * 2.2 + (enemy.zigZagPhase || 0)) * 0.42;
        enemy.zigZagTimer = (enemy.zigZagTimer || 0) + dt;
        enemy.vx += ((targetVx + perpX * enemy.speed * strafe) - enemy.vx) * 0.05;
        enemy.vy += ((targetVy + perpY * enemy.speed * strafe) - enemy.vy) * 0.05;
      }
    } else if (enemy.type === 'elite') {
      enemy.zigZagTimer += dt;

      const perpX = -ny;
      const perpY = nx;
      const zigZag = Math.sin(enemy.zigZagTimer * 4.5 + enemy.zigZagPhase) * 0.7;

      enemy.burstTimer += dt;
      if (enemy.burstTimer > 2.2 && !enemy.burstActive) {
        enemy.burstActive = true;
        enemy.burstDuration = 0;
        enemy.burstTimer = 0;
      }
      if (enemy.burstActive) {
        enemy.burstDuration += dt;
        if (enemy.burstDuration > 0.35) enemy.burstActive = false;
      }

      const speedMult = enemy.burstActive ? 2.4 : 1;
      enemy.vx = (nx + perpX * zigZag) * enemy.speed * speedMult;
      enemy.vy = (ny + perpY * zigZag) * enemy.speed * speedMult;
    } else if (enemy.type === 'legionary') {
      // Legionaries run suppressive strafing lines, keeping lateral pressure.
      enemy.zigZagTimer += dt;
      const groupPressure = Math.min(1, legionaryAllies.length / 6);
      const strafe = Math.sin(enemy.zigZagTimer * (3.4 + groupPressure) + enemy.zigZagPhase) * (0.34 + groupPressure * 0.24);
      const perpX = -ny;
      const perpY = nx;
      const standoff = 200;
      const toward = d > standoff ? 1 : 0.45;
      enemy.vx = (nx * toward + perpX * strafe) * enemy.speed;
      enemy.vy = (ny * toward + perpY * strafe) * enemy.speed;
    } else if (enemy.type === 'raybin') {
      // Raybins flank: maintain offset ring and strafe around player before missile shots.
      const standOff = 280;
      const flank = enemy.flankSide || 1;
      const perpX = -ny;
      const perpY = nx;
      const ringErr = (d - standOff) / standOff;
      const radial = Math.max(-0.7, Math.min(0.7, ringErr));
      const flankStrength = Math.min(1.1, 0.6 + raybinAllies.length * 0.08);
      const targetVx = (nx * radial + perpX * flank * flankStrength) * enemy.speed;
      const targetVy = (ny * radial + perpY * flank * flankStrength) * enemy.speed;
      enemy.vx += (targetVx - enemy.vx) * 0.08;
      enemy.vy += (targetVy - enemy.vy) * 0.08;
    } else if (enemy.type === 'hord') {
      // Hord fights as a swarm mass: cohesion + periodic surge rushes.
      enemy.tacticTimer = (enemy.tacticTimer || 0) + dt;
      if (!enemy.surgeUntil || now >= enemy.surgeUntil) {
        const surgeTrigger = hordAllies.length >= 3 && enemy.tacticTimer > (1.8 + Math.random() * 1.4);
        if (surgeTrigger) {
          enemy.surgeUntil = now + 850;
          enemy.tacticTimer = 0;
        }
      }
      const inSurge = now < (enemy.surgeUntil || 0);
      const cohesionX = hordCenter ? (hordCenter.x - enemy.x) : 0;
      const cohesionY = hordCenter ? (hordCenter.y - enemy.y) : 0;
      const cohesionD = Math.max(1, Math.hypot(cohesionX, cohesionY));
      const cx = cohesionX / cohesionD;
      const cy = cohesionY / cohesionD;
      const press = inSurge ? 1.25 : 0.7;
      const coh = inSurge ? 0.2 : 0.5;
      const targetVx = (nx * press + cx * coh) * enemy.speed;
      const targetVy = (ny * press + cy * coh) * enemy.speed;
      enemy.vx += (targetVx - enemy.vx) * (inSurge ? 0.09 : 0.05);
      enemy.vy += (targetVy - enemy.vy) * (inSurge ? 0.09 : 0.05);
    } else if (enemy.type === 'outlander') {
      // Outlanders use hit-and-fade movement around teleport windows.
      enemy.tacticTimer = (enemy.tacticTimer || 0) + dt;
      const perpX = -ny;
      const perpY = nx;
      const weave = Math.sin(enemy.tacticTimer * 4.8 + enemy.tacticPhase) * 0.6;
      const preferred = 165;
      const err = (d - preferred) / preferred;
      const radial = Math.max(-0.9, Math.min(0.9, err));
      enemy.vx = (nx * radial + perpX * weave) * enemy.speed * 1.08;
      enemy.vy = (ny * radial + perpY * weave) * enemy.speed * 1.08;
    }

    if (enemy.hitFlash > 0) enemy.hitFlash--;

    const velLen = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
    if (velLen > 0.01) {
      // 0deg points "up" in our ship art, so add 90deg to atan2 result.
      const targetAngle = (Math.atan2(enemy.vy, enemy.vx) * 180) / Math.PI + 90;
      const current = enemy.facingAngle ?? targetAngle;
      const delta = normalizeAngleDelta(targetAngle - current);
      const maxTurnSpeed = enemy.isNemesis ? 160 : (enemy.type === 'heavy' || enemy.type === 'hord') ? 95 : 260; // deg/sec
      const maxTurnStep = maxTurnSpeed * dt;
      const applied = Math.max(-maxTurnStep, Math.min(maxTurnStep, delta));
      enemy.facingAngle = current + applied;
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    const hr = enemy.size / 2;
    enemy.x = Math.max(hr, Math.min(worldWidth - hr, enemy.x));
    enemy.y = Math.max(hr, Math.min(worldHeight - hr, enemy.y));
  }
}
