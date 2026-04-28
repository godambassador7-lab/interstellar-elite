// src/systems/SpawnSystem.js

import { ENEMY_TYPES, SCREEN } from '../utils/constants';
import { uid } from '../utils/mathUtils';

export function getWaveEnemyCount(wave, galaxy) {
  const baseEnemies = galaxy?.baseEnemies ?? 14;
  const enemyGrowth = galaxy?.enemyGrowth ?? 5;
  const threat = galaxy?.threat ?? 1;
  return Math.max(6, Math.round((baseEnemies + (wave - 1) * enemyGrowth) * threat));
}

/**
 * Returns enemies to add for this frame based on wave budgets.
 */
export function trySpawn(state) {
  const now = Date.now();

  if (state.waveSpawnRemaining <= 0) return null;
  if (now < (state.nextWaveSpawnAt || 0)) return null;
  const threat = state.galaxy?.threat ?? 1;
  const maxActive = Math.round((12 + state.currentWave * 2) * threat);
  if (state.enemies.length >= maxActive) return null;

  const interval = Math.max(220, (780 - state.currentWave * 58) / threat);
  if (now - state.lastSpawnTime < interval) return null;
  state.lastSpawnTime = now;

  const waveProgress = state.currentWave / Math.max(1, state.maxWaves);
  const eliteChance = Math.min(0.3, 0.04 + waveProgress * 0.14 + state.currentWave * 0.018 * threat);
  const heavyChance = Math.min(0.34, 0.1 + waveProgress * 0.12 + state.currentWave * 0.02 * threat);

  const r = Math.random();
  let typeDef;
  if (r < eliteChance) {
    typeDef = ENEMY_TYPES.elite;
  } else if (r < eliteChance + heavyChance) {
    typeDef = ENEMY_TYPES.heavy;
  } else {
    typeDef = ENEMY_TYPES.swarm;
  }

  const desiredCount =
    typeDef.type === 'swarm' && Math.random() < Math.min(0.72, 0.44 + state.currentWave * 0.05)
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

  if (!state.nemesisSpawned && state.currentWave >= Math.max(2, Math.floor(state.maxWaves * 0.5)) && Math.random() < 0.08) {
    state.nemesisSpawned = true;
    const nemesis = createEnemy(ENEMY_TYPES.elite, basePos);
    nemesis.isNemesis = true;
    nemesis.name = 'RIVAL NEMESIS';
    nemesis.hp *= 2.2;
    nemesis.maxHp = nemesis.hp;
    nemesis.speed *= 1.2;
    nemesis.damage *= 1.35;
    nemesis.score = Math.round(nemesis.score * 3.2);
    state.waveSpawnRemaining = Math.max(0, state.waveSpawnRemaining - 1);
    return [nemesis];
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

function createEnemy(def, pos) {
  return {
    id: uid(),
    type: def.type,
    x: pos.x,
    y: pos.y,
    vx: 0,
    vy: 0,
    facingAngle: 0,
    size: def.size,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed * (0.85 + Math.random() * 0.3),
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
  };
}

export function updateEnemyMovement(state, deltaMs) {
  const dt = deltaMs / 1000;
  const { player, enemies } = state;
  const worldWidth = state?.world?.width || SCREEN.width;
  const worldHeight = state?.world?.height || SCREEN.height;
  const frozen = !!state?.abilities?.quantum?.active && (state?.abilities?.quantum?.freezeRemaining || 0) > 0;

  for (const enemy of enemies) {
    if (enemy.dead) continue;

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

    if (enemy.type === 'swarm') {
      enemy.vx = nx * enemy.speed;
      enemy.vy = ny * enemy.speed;
    } else if (enemy.type === 'heavy') {
      const targetVx = nx * enemy.speed;
      const targetVy = ny * enemy.speed;
      enemy.vx += (targetVx - enemy.vx) * 0.04;
      enemy.vy += (targetVy - enemy.vy) * 0.04;
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
    }

    if (enemy.hitFlash > 0) enemy.hitFlash--;

    const velLen = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
    if (velLen > 0.01) {
      // 0deg points "up" in our ship art, so add 90deg to atan2 result.
      enemy.facingAngle = (Math.atan2(enemy.vy, enemy.vx) * 180) / Math.PI + 90;
    }

    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    const hr = enemy.size / 2;
    enemy.x = Math.max(hr, Math.min(worldWidth - hr, enemy.x));
    enemy.y = Math.max(hr, Math.min(worldHeight - hr, enemy.y));
  }
}
