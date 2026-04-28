// src/systems/CombatSystem.js

import { circlesOverlap, dist, normalize, uid } from '../utils/mathUtils';
import { PLAYER, ENEMY_TYPES, COMBO, PARTICLES, COLORS, ABILITIES } from '../utils/constants';

const ELITE_LASER_RANGE_SQ   = 150 * 150;
const ELITE_LASER_RATE_MS    = 200;
const ELITE_LASER_DAMAGE     = 0.01;

const HEAVY_PHOTON_RANGE_SQ  = 320 * 320;
const HEAVY_PHOTON_RATE_MS   = 2800;
const HEAVY_PHOTON_DAMAGE    = 14;
const HEAVY_PHOTON_SPEED     = 180;
const HEAVY_PHOTON_SIZE      = 14;
const HEAVY_PHOTON_LIFE_MS   = 3500;

const SWARM_PHOTON_RANGE_SQ  = 220 * 220;
const SWARM_PHOTON_RATE_MS   = 350;
const SWARM_PHOTON_DAMAGE    = 2.5;
const SWARM_PHOTON_SPEED     = 250;
const SWARM_PHOTON_SIZE      = 5;
const SWARM_PHOTON_LIFE_MS   = 2000;

// Absorb damage into shield first; any overflow hits HP; resets regen timer.
function applyPlayerDamage(player, amount) {
  if (player.phaseShift) return;
  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, amount);
    player.shield = Math.max(0, player.shield - absorbed);
    const overflow = amount - absorbed;
    if (overflow > 0) player.hp = Math.max(0, player.hp - overflow);
  } else {
    player.hp = Math.max(0, player.hp - amount);
  }
  player.shieldRegenDelay = PLAYER.SHIELD_REGEN_DELAY;
}

/**
 * Run one frame of combat: auto-attack, ability hits, enemy contact damage.
 * Returns mutations to apply to the mutable game state ref.
 */
export function runCombatFrame(state, deltaMs) {
  const { player, enemies, particles, abilities } = state;
  const phaseDamageMult = abilities?.phase?.active ? (abilities.phase.damageMult || 1) : 1;
  const now = Date.now();
  let scoreGain = 0;
  let comboIncrement = 0;
  const newParticles = [];
  const deadEnemyIds = new Set();

  // ── Auto-attack ─────────────────────────────────────────────────────────────
  if (now - player.lastAttackTime >= player.attackRate) {
    const targets = [];
    const maxTargets = Math.max(1, player.attackTargets || 1);

    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const d = dist(player, enemy);
      if (d < player.attackRange + enemy.size / 2) {
        targets.push({ enemy, d });
      }
    }

    targets.sort((a, b) => a.d - b.d);
    const selectedTargets = targets.slice(0, maxTargets);

    if (selectedTargets.length > 0) {
      player.lastAttackTime = now;
      for (const target of selectedTargets) {
        const enemy = target.enemy;
        if (enemy.dead) continue;
        const dmg = player.damage * player.damageMultiplier * phaseDamageMult;
        applyDamage(state, enemy, dmg, newParticles);
        if (enemy.hp <= 0 && !enemy.dead) {
          killEnemy(enemy, state, newParticles, deadEnemyIds);
          scoreGain += enemy.score;
          comboIncrement++;
        }
      }
      player.attackFlash = 8;
    }
  }

  // ── Dash Slash damage ────────────────────────────────────────────────────────
  if (abilities.dash.active) {
    for (const enemy of enemies) {
      if (enemy.dead || abilities.dash.hitIds.has(enemy.id)) continue;
      if (circlesOverlap(player.x, player.y, PLAYER.SIZE / 2 + 10, enemy.x, enemy.y, enemy.size / 2)) {
        abilities.dash.hitIds.add(enemy.id);
        const dmg = ABILITIES.DASH.DAMAGE * player.damageMultiplier * phaseDamageMult;
        applyDamage(state, enemy, dmg, newParticles);
        if (enemy.hp <= 0 && !enemy.dead) {
          killEnemy(enemy, state, newParticles, deadEnemyIds);
          scoreGain += enemy.score;
          comboIncrement++;
        }
      }
    }
  }

  // ── Energy Pulse damage ─────────────────────────────────────────────────────
  if (abilities.pulse.active && !abilities.pulse.dealtDamage) {
    abilities.pulse.dealtDamage = true;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (dist(player, enemy) <= ABILITIES.PULSE.RADIUS + enemy.size / 2) {
        const dmg = ABILITIES.PULSE.DAMAGE * player.damageMultiplier * phaseDamageMult;
        applyDamage(state, enemy, dmg, newParticles);
        if (enemy.hp <= 0 && !enemy.dead) {
          killEnemy(enemy, state, newParticles, deadEnemyIds);
          scoreGain += enemy.score;
          comboIncrement++;
        }
      }
    }
  }

  // ── Drone orbit damage ──────────────────────────────────────────────────────
  if (abilities.drone.active) {
    for (let di = 0; di < abilities.drone.positions.length; di++) {
      const dPos = abilities.drone.positions[di];
      for (const enemy of enemies) {
        if (enemy.dead) continue;
        if (circlesOverlap(dPos.x, dPos.y, 8, enemy.x, enemy.y, enemy.size / 2)) {
          const hitKey = `d${di}_${enemy.id}`;
          if (!abilities.drone.hitCooldowns.has(hitKey) ||
              now - abilities.drone.hitCooldowns.get(hitKey) > 600) {
            abilities.drone.hitCooldowns.set(hitKey, now);
            const dmg = ABILITIES.DRONE.DAMAGE * player.damageMultiplier * phaseDamageMult;
            applyDamage(state, enemy, dmg, newParticles);
            if (enemy.hp <= 0 && !enemy.dead) {
              killEnemy(enemy, state, newParticles, deadEnemyIds);
              scoreGain += enemy.score;
              comboIncrement++;
            }
          }
        }
      }
    }
  }

  // ── Enemy contact damage ────────────────────────────────────────────────────
  if (!player.invincible && now > player.invincibleUntil) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (circlesOverlap(player.x, player.y, PLAYER.SIZE / 2, enemy.x, enemy.y, enemy.size / 2)) {
        applyPlayerDamage(player, enemy.damage * (deltaMs / 1000) * 0.6);
        player.hitFlash = 12;
        player.invincibleUntil = now + PLAYER.INVINCIBILITY_MS;
        state.screenShake = Math.max(state.screenShake, enemy.type === 'heavy' ? 10 : 5);
        break;
      }
    }
  }

  // ── Elite laser attacks (medium-sized enemies only) ────────────────────────
  // Smallest (swarm) and largest (heavy) do not fire lasers.
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'elite') continue;
    if (enemy.laserFlash > 0) enemy.laserFlash -= deltaMs;
    const ldx = player.x - enemy.x;
    const ldy = player.y - enemy.y;
    if (ldx * ldx + ldy * ldy > ELITE_LASER_RANGE_SQ) continue;
    if (now - enemy.lastLaserAt >= ELITE_LASER_RATE_MS) {
      enemy.lastLaserAt = now;
      enemy.laserFlash  = 80;
      applyPlayerDamage(player, ELITE_LASER_DAMAGE);
      if (player.hitFlash < 4) player.hitFlash = 4;
    }
  }

  // ── Heavy photon balls (largest enemy type) ─────────────────────────────────
  if (!state.photons) state.photons = [];
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'heavy') continue;
    const pdx = player.x - enemy.x;
    const pdy = player.y - enemy.y;
    const pDistSq = pdx * pdx + pdy * pdy;
    if (pDistSq > HEAVY_PHOTON_RANGE_SQ) continue;
    if (now - (enemy.lastPhotonAt || 0) >= HEAVY_PHOTON_RATE_MS) {
      enemy.lastPhotonAt = now;
      const pDist = Math.sqrt(pDistSq);
      state.photons.push({
        id: uid(),
        x: enemy.x, y: enemy.y,
        vx: (pdx / pDist) * HEAVY_PHOTON_SPEED,
        vy: (pdy / pDist) * HEAVY_PHOTON_SPEED,
        damage: HEAVY_PHOTON_DAMAGE,
        size: HEAVY_PHOTON_SIZE,
        life: HEAVY_PHOTON_LIFE_MS,
        maxLife: HEAVY_PHOTON_LIFE_MS,
        color: '#FFE566',
        glowColor: 'rgba(255,193,58,0.15)',
      });
    }
  }
  // ── Swarm photon balls (smallest enemy type) ────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'swarm') continue;
    const sdx = player.x - enemy.x;
    const sdy = player.y - enemy.y;
    const sDistSq = sdx * sdx + sdy * sdy;
    if (sDistSq > SWARM_PHOTON_RANGE_SQ) continue;
    if (now - (enemy.lastSwarmPhotonAt || 0) >= SWARM_PHOTON_RATE_MS) {
      enemy.lastSwarmPhotonAt = now;
      const sDist = Math.sqrt(sDistSq);
      state.photons.push({
        id: uid(),
        x: enemy.x, y: enemy.y,
        vx: (sdx / sDist) * SWARM_PHOTON_SPEED,
        vy: (sdy / sDist) * SWARM_PHOTON_SPEED,
        damage: SWARM_PHOTON_DAMAGE,
        size: SWARM_PHOTON_SIZE,
        life: SWARM_PHOTON_LIFE_MS,
        maxLife: SWARM_PHOTON_LIFE_MS,
        color: '#2DFFB2',
        glowColor: 'rgba(45,255,178,0.12)',
      });
    }
  }

  // Move photons and check player collision
  {
    const dt = deltaMs / 1000;
    const playerRadius = PLAYER.SIZE / 2 + 4;
    for (const ph of state.photons) {
      ph.x    += ph.vx * dt;
      ph.y    += ph.vy * dt;
      ph.life -= deltaMs;
      if (circlesOverlap(player.x, player.y, playerRadius, ph.x, ph.y, ph.size)) {
        applyPlayerDamage(player, ph.damage);
        player.hitFlash   = 14;
        state.screenShake = Math.max(state.screenShake, 8);
        ph.life = -1;
      }
    }
    state.photons = state.photons.filter((ph) => ph.life > 0);
  }

  // ── Combo logic ─────────────────────────────────────────────────────────────
  if (comboIncrement > 0) {
    state.combo += comboIncrement;
    state.lastKillTime = now;
    state.comboTimeout = COMBO.TIMEOUT_MS;
  }
  if (state.combo > 0 && now - state.lastKillTime > COMBO.TIMEOUT_MS) {
    state.combo = 0;
  }

  // ── Score multiplier from combo ─────────────────────────────────────────────
  const mult = 1 + Math.floor(state.combo / COMBO.MULTIPLIER_STEP);
  state.score += scoreGain * mult;

  // ── Clean up dead enemies ────────────────────────────────────────────────────
  state.enemies = enemies.filter(e => !deadEnemyIds.has(e.id));

  // ── Add particles ────────────────────────────────────────────────────────────
  for (const p of newParticles) {
    particles.push(p);
  }
}

export function applyQuantumSlashSwipe(state, from, to) {
  const { abilities, enemies, player } = state;
  if (!abilities?.quantum?.active || abilities.quantum.slashWindowRemaining <= 0) return 0;
  const now = Date.now();
  let kills = 0;
  let scoreGain = 0;
  const hitMap = abilities.quantum.hitCooldowns;
  const slashRadius = 26;
  const slashDamage = 140 * (player.damageMultiplier || 1);
  const deadEnemyIds = new Set();
  const newParticles = [];

  for (const enemy of enemies) {
    if (enemy.dead) continue;
    const lastHit = hitMap.get(enemy.id) || 0;
    if (now - lastHit < 130) continue;
    const d = distancePointToSegment(enemy.x, enemy.y, from.x, from.y, to.x, to.y);
    if (d > enemy.size * 0.55 + slashRadius) continue;
    hitMap.set(enemy.id, now);
    applyDamage(state, enemy, slashDamage, newParticles);
    if (enemy.hp <= 0 && !enemy.dead) {
      killEnemy(enemy, state, newParticles, deadEnemyIds);
      scoreGain += enemy.score;
      kills++;
    }
  }

  if (kills > 0) {
    state.combo += kills;
    state.lastKillTime = now;
    state.score += scoreGain * (1 + Math.floor(state.combo / COMBO.MULTIPLIER_STEP));
  }
  state.enemies = enemies.filter(e => !deadEnemyIds.has(e.id));
  for (const p of newParticles) state.particles.push(p);
  return kills;
}

function applyDamage(state, enemy, dmg, particleList) {
  const dealt = Math.max(0, Math.min(enemy.hp, dmg));
  enemy.hp -= dmg;
  enemy.hitFlash = 10;
  if (dealt > 0) {
    state.totalDamageDealt = (state.totalDamageDealt || 0) + dealt;
    if (!state.damageNumbers) state.damageNumbers = [];
    state.damageNumbers.push({
      id: uid(),
      x: enemy.x + (Math.random() - 0.5) * 8,
      y: enemy.y - enemy.size * 0.35,
      value: Math.round(dealt),
      life: 560,
      maxLife: 560,
      vy: -0.026 - Math.random() * 0.012,
    });
  }
  // Hit spark particles
  const angle = Math.random() * Math.PI * 2;
  for (let i = 0; i < PARTICLES.HIT_COUNT; i++) {
    const a = angle + (i / PARTICLES.HIT_COUNT) * Math.PI * 2;
    particleList.push({
      id: uid(),
      x: enemy.x + Math.cos(a) * enemy.size * 0.3,
      y: enemy.y + Math.sin(a) * enemy.size * 0.3,
      vx: Math.cos(a) * PARTICLES.HIT_SPEED * (0.5 + Math.random()),
      vy: Math.sin(a) * PARTICLES.HIT_SPEED * (0.5 + Math.random()),
      life: PARTICLES.HIT_LIFE,
      maxLife: PARTICLES.HIT_LIFE,
      size: 2 + Math.random() * 2,
      color: enemy.color,
      type: 'hit',
    });
  }
}

function killEnemy(enemy, state, particleList, deadSet) {
  enemy.dead = true;
  deadSet.add(enemy.id);
  state.screenShake = Math.max(state.screenShake, enemy.type === 'heavy' ? 14 : 7);

  // Explosion particles
  const count = enemy.type === 'heavy' ? PARTICLES.EXPLOSION_COUNT * 2 : PARTICLES.EXPLOSION_COUNT;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = PARTICLES.EXPLOSION_SPEED * (0.4 + Math.random() * 0.8);
    particleList.push({
      id: uid(),
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: PARTICLES.EXPLOSION_LIFE * (0.6 + Math.random() * 0.8),
      maxLife: PARTICLES.EXPLOSION_LIFE,
      size: 3 + Math.random() * (enemy.type === 'heavy' ? 7 : 4),
      color: COLORS.particleColors[Math.floor(Math.random() * COLORS.particleColors.length)],
      type: 'explosion',
    });
  }

  // Drop resource
  state.resources = (state.resources || 0) + enemy.points;
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const cx = px - x1;
    const cy = py - y1;
    return Math.sqrt(cx * cx + cy * cy);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const lx = x1 + t * dx;
  const ly = y1 + t * dy;
  const ex = px - lx;
  const ey = py - ly;
  return Math.sqrt(ex * ex + ey * ey);
}
