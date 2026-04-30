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
const DESTROYER_MISSILE_RANGE_SQ = 380 * 380;
const DESTROYER_MISSILE_RATE_MS = 2600;
const DESTROYER_MISSILE_DAMAGE = 18;
const DESTROYER_MISSILE_SPEED = 252;
const DESTROYER_MISSILE_TURN = 0.085;
const DESTROYER_MISSILE_SIZE = 12;
const DESTROYER_MISSILE_LIFE_MS = 9000;

const SWARM_PHOTON_RANGE_SQ  = 220 * 220;
const SWARM_PHOTON_RATE_MS   = 350;
const SWARM_PHOTON_DAMAGE    = 2.5;
const SWARM_PHOTON_SPEED     = 250;
const SWARM_PHOTON_SIZE      = 5;
const SWARM_PHOTON_LIFE_MS   = 2000;

const FLAGSHIP_BARRAGE_DURATION_MS = 3000;
const FLAGSHIP_BARRAGE_RATE_MS = 110;
const FLAGSHIP_BARRAGE_RANGE_SQ = 420 * 420;
const FLAGSHIP_BARRAGE_DAMAGE = 3.2;
const FLAGSHIP_BARRAGE_SPEED = 300;
const FLAGSHIP_BARRAGE_SIZE = 5;
const FLAGSHIP_BARRAGE_LIFE_MS = 2200;

const FLAGSHIP_CHARGE_DURATION_MS = 5000;
const FLAGSHIP_CHARGE_RANGE_SQ = 520 * 520;
const FLAGSHIP_CHARGE_DAMAGE = 34;
const FLAGSHIP_CHARGE_SPEED = 210;
const FLAGSHIP_CHARGE_SIZE = 30;
const FLAGSHIP_CHARGE_LIFE_MS = 3800;
const FLAGSHIP_PATTERN_COOLDOWN_MS = 4500;
const FIRST_QUADRANT_SPECIAL_CHANCE = 0.05;

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
  const lastStandDamageMult = state?.lastStand?.active ? (state.lastStand.damageMult || 1) : 1;
  const now = Date.now();
  let scoreGain = 0;
  let comboIncrement = 0;
  const newParticles = [];
  const deadEnemyIds = new Set();
  let playerTookDamage = false;
  let playerDealtDamage = false;
  if (!state.destroyerMissiles) state.destroyerMissiles = [];

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
        const dmg = player.damage * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
        const dealt = applyDamage(state, enemy, dmg, newParticles);
        if (dealt > 0) playerDealtDamage = true;
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
        const dmg = ABILITIES.DASH.DAMAGE * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
        const dealt = applyDamage(state, enemy, dmg, newParticles);
        if (dealt > 0) playerDealtDamage = true;
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
        const dmg = ABILITIES.PULSE.DAMAGE * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
        const dealt = applyDamage(state, enemy, dmg, newParticles, 'offensive_shield');
        if (dealt > 0) playerDealtDamage = true;
        if (enemy.hp <= 0 && !enemy.dead) {
          killEnemy(enemy, state, newParticles, deadEnemyIds);
          scoreGain += enemy.score;
          comboIncrement++;
        }
      }
    }
    const pulseMissileRadius = ABILITIES.PULSE.RADIUS + 12;
    for (const missile of state.destroyerMissiles) {
      if (missile.dead) continue;
      if (dist(player, missile) <= pulseMissileRadius + (missile.size || DESTROYER_MISSILE_SIZE) * 0.5) {
        missile.dead = true;
        missile.life = -1;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          newParticles.push({
            id: uid(),
            x: missile.x,
            y: missile.y,
            vx: Math.cos(a) * 120 * (0.6 + Math.random() * 0.6),
            vy: Math.sin(a) * 120 * (0.6 + Math.random() * 0.6),
            life: 300,
            maxLife: 300,
            size: 2 + Math.random() * 2,
            color: '#FF725C',
            type: 'hit',
          });
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
            const dmg = ABILITIES.DRONE.DAMAGE * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
            const dealt = applyDamage(state, enemy, dmg, newParticles);
            if (dealt > 0) playerDealtDamage = true;
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
        playerTookDamage = true;
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
      playerTookDamage = true;
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
    if (pDistSq > DESTROYER_MISSILE_RANGE_SQ) continue;
    if (now - (enemy.lastPhotonAt || 0) >= DESTROYER_MISSILE_RATE_MS) {
      enemy.lastPhotonAt = now;
      const pDist = Math.sqrt(pDistSq);
      state.destroyerMissiles.push({
        id: uid(),
        x: enemy.x, y: enemy.y,
        vx: (pdx / pDist) * DESTROYER_MISSILE_SPEED,
        vy: (pdy / pDist) * DESTROYER_MISSILE_SPEED,
        speed: DESTROYER_MISSILE_SPEED,
        turnRate: DESTROYER_MISSILE_TURN,
        damage: DESTROYER_MISSILE_DAMAGE,
        size: DESTROYER_MISSILE_SIZE,
        life: DESTROYER_MISSILE_LIFE_MS,
        maxLife: DESTROYER_MISSILE_LIFE_MS,
        color: '#FFB857',
        glowColor: 'rgba(255,128,72,0.22)',
        missile: true,
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

  // ── Nemesis flagship special attacks ─────────────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || !enemy.isNemesis) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distSq = dx * dx + dy * dy;
    const quadrant = state?.galaxy?.quadrant || '';
    const inFirstQuadrant = quadrant === 'bayron';

    if (!enemy.flagshipPattern) {
      enemy.flagshipPattern = {
        mode: 'idle', // idle | barrage | charge
        nextAt: now + 1200,
        modeEndsAt: 0,
        lastShotAt: 0,
      };
    }
    const p = enemy.flagshipPattern;
    enemy.flagshipChargeActive = p.mode === 'charge';
    enemy.flagshipChargeT = p.mode === 'charge' && p.modeEndsAt > now
      ? 1 - ((p.modeEndsAt - now) / FLAGSHIP_CHARGE_DURATION_MS)
      : 0;

    if (p.mode === 'charge') {
      if (now >= p.modeEndsAt) {
        if (distSq <= FLAGSHIP_CHARGE_RANGE_SQ) {
          const d = Math.max(1, Math.sqrt(distSq));
          state.photons.push({
            id: uid(),
            x: enemy.x, y: enemy.y,
            vx: (dx / d) * FLAGSHIP_CHARGE_SPEED,
            vy: (dy / d) * FLAGSHIP_CHARGE_SPEED,
            damage: FLAGSHIP_CHARGE_DAMAGE,
            size: FLAGSHIP_CHARGE_SIZE,
            life: FLAGSHIP_CHARGE_LIFE_MS,
            maxLife: FLAGSHIP_CHARGE_LIFE_MS,
            color: '#7BD8FF',
            glowColor: 'rgba(106,206,255,0.28)',
          });
        }
        p.mode = 'idle';
        p.nextAt = now + FLAGSHIP_PATTERN_COOLDOWN_MS;
        enemy.flagshipChargeActive = false;
        enemy.flagshipChargeT = 0;
      }
      continue;
    }

    if (p.mode === 'barrage') {
      if (now >= p.modeEndsAt) {
        p.mode = 'idle';
        p.nextAt = now + FLAGSHIP_PATTERN_COOLDOWN_MS;
      } else if (distSq <= FLAGSHIP_BARRAGE_RANGE_SQ && now - p.lastShotAt >= FLAGSHIP_BARRAGE_RATE_MS) {
        p.lastShotAt = now;
        const d = Math.max(1, Math.sqrt(distSq));
        const baseNx = dx / d;
        const baseNy = dy / d;
        const spread = (Math.random() - 0.5) * 0.16;
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const nx = baseNx * cos - baseNy * sin;
        const ny = baseNx * sin + baseNy * cos;
        state.photons.push({
          id: uid(),
          x: enemy.x, y: enemy.y,
          vx: nx * FLAGSHIP_BARRAGE_SPEED,
          vy: ny * FLAGSHIP_BARRAGE_SPEED,
          damage: FLAGSHIP_BARRAGE_DAMAGE,
          size: FLAGSHIP_BARRAGE_SIZE,
          life: FLAGSHIP_BARRAGE_LIFE_MS,
          maxLife: FLAGSHIP_BARRAGE_LIFE_MS,
          color: '#86DFFF',
          glowColor: 'rgba(105,207,255,0.16)',
        });
      }
      continue;
    }

    if (p.mode === 'idle' && now >= p.nextAt) {
      const useSpecialCharge = inFirstQuadrant && Math.random() < FIRST_QUADRANT_SPECIAL_CHANCE;
      if (useSpecialCharge) {
        p.mode = 'charge';
        p.modeEndsAt = now + FLAGSHIP_CHARGE_DURATION_MS;
      } else {
        p.mode = 'barrage';
        p.modeEndsAt = now + FLAGSHIP_BARRAGE_DURATION_MS;
        p.lastShotAt = 0;
      }
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
        playerTookDamage = true;
        player.hitFlash   = 14;
        state.screenShake = Math.max(state.screenShake, 8);
        ph.life = -1;
      }
    }
    state.photons = state.photons.filter((ph) => ph.life > 0);
    for (const missile of state.destroyerMissiles) {
      if (missile.dead) continue;
      const dx = player.x - missile.x;
      const dy = player.y - missile.y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const tvx = (dx / d) * (missile.speed || DESTROYER_MISSILE_SPEED);
      const tvy = (dy / d) * (missile.speed || DESTROYER_MISSILE_SPEED);
      const turn = missile.turnRate || DESTROYER_MISSILE_TURN;
      missile.vx += (tvx - missile.vx) * turn;
      missile.vy += (tvy - missile.vy) * turn;
      missile.x += missile.vx * dt;
      missile.y += missile.vy * dt;
      missile.life -= deltaMs;
      if (circlesOverlap(player.x, player.y, playerRadius, missile.x, missile.y, missile.size || DESTROYER_MISSILE_SIZE)) {
        applyPlayerDamage(player, missile.damage || DESTROYER_MISSILE_DAMAGE);
        playerTookDamage = true;
        player.hitFlash = 14;
        state.screenShake = Math.max(state.screenShake, 10);
        missile.life = -1;
      }
    }
    state.destroyerMissiles = state.destroyerMissiles.filter((m) => m.life > 0 && !m.dead);
  }
  if (!playerTookDamage) {
    state.nearMissTimer = (state.nearMissTimer || 0) + deltaMs;
    if (state.nearMissTimer >= 1200 && hasCloseThreat(state, 34)) {
      state.perfectDodges = (state.perfectDodges || 0) + 1;
      state.nearMissTimer = 0;
      state.lastPerfectDodgeAt = now;
    }
  } else {
    state.nearMissTimer = 0;
  }
  if (playerDealtDamage) {
    player.attackDamageFlash = Math.max(player.attackDamageFlash || 0, 9);
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

function applyDamage(state, enemy, dmg, particleList, source = 'default') {
  const dealt = Math.max(0, Math.min(enemy.hp, dmg));
  const critical = dealt >= Math.max(26, enemy.maxHp * 0.35);
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
      source,
      critical,
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
  return dealt;
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
  triggerChainReaction(enemy, state, particleList, deadSet);
}

function triggerChainReaction(sourceEnemy, state, particleList, deadSet) {
  const radius = sourceEnemy.type === 'heavy' ? 120 : 84;
  const baseDamage = sourceEnemy.type === 'heavy' ? 42 : 24;
  let chainKills = 0;
  for (const other of state.enemies) {
    if (other.dead || deadSet.has(other.id) || other.id === sourceEnemy.id) continue;
    const d = dist(sourceEnemy, other);
    if (d > radius + other.size * 0.5) continue;
    const falloff = Math.max(0.2, 1 - d / (radius + 1));
    const dmg = baseDamage * falloff;
    applyDamage(state, other, dmg, particleList);
    if (other.hp <= 0 && !other.dead) {
      other.dead = true;
      deadSet.add(other.id);
      state.resources = (state.resources || 0) + other.points;
      chainKills++;
    }
  }
  if (chainKills > 0) {
    state.chainReactionKills = (state.chainReactionKills || 0) + chainKills;
    state.combo += chainKills;
    state.lastKillTime = Date.now();
    state.screenShake = Math.max(state.screenShake, 12);
  }
}

function hasCloseThreat(state, threshold) {
  const player = state.player;
  const threatRadius = PLAYER.SIZE * 0.5 + threshold;
  for (const enemy of state.enemies || []) {
    if (enemy.dead) continue;
    if (dist(player, enemy) <= threatRadius + enemy.size * 0.5) return true;
  }
  for (const ph of state.photons || []) {
    if (circlesOverlap(player.x, player.y, threatRadius, ph.x, ph.y, ph.size + 2)) return true;
  }
  for (const missile of state.destroyerMissiles || []) {
    if (circlesOverlap(player.x, player.y, threatRadius, missile.x, missile.y, (missile.size || DESTROYER_MISSILE_SIZE) + 2)) return true;
  }
  return false;
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
