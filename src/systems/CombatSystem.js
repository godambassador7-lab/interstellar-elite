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
const DESTROYER_MISSILE_MIX_CHANCE = 0.5;
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
const LEGIONARY_PHOTON_RANGE_SQ = 360 * 360;
const LEGIONARY_PHOTON_RATE_MS = 260;
const LEGIONARY_PHOTON_DAMAGE = 4.2;
const LEGIONARY_PHOTON_SPEED = 390;
const LEGIONARY_PHOTON_SIZE = 5;
const LEGIONARY_PHOTON_LIFE_MS = 2000;
const RAYBIN_MISSILE_RANGE_SQ = 460 * 460;
const RAYBIN_MISSILE_RATE_MS = 1800;
const RAYBIN_MISSILE_DAMAGE = 22;
const RAYBIN_MISSILE_SPEED = 332;
const RAYBIN_MISSILE_TURN = 0.11;
const RAYBIN_MISSILE_SIZE = 10;
const RAYBIN_MISSILE_LIFE_MS = 7000;
const HORD_WELL_RANGE_SQ = 420 * 420;
const HORD_WELL_RATE_MS = 7000;
const HORD_WELL_RADIUS = 92;
const HORD_WELL_STRENGTH = 240;
const HORD_WELL_LIFE_MS = 4200;
const SHIP_GRAVITY_WELL_STRENGTH_MULT = 10;
const OUTLANDER_TELEPORT_RANGE_SQ = 540 * 540;
const OUTLANDER_TELEPORT_RATE_MS = 3600;
const OUTLANDER_LASER_RANGE_SQ = 240 * 240;
const OUTLANDER_LASER_RATE_MS = 140;
const OUTLANDER_LASER_DAMAGE = 0.014;

const FLAGSHIP_BARRAGE_DURATION_MS = 3000;
const FLAGSHIP_BARRAGE_RATE_MS = 110;
const FLAGSHIP_BARRAGE_RANGE_SQ = 420 * 420;
const FLAGSHIP_BARRAGE_DAMAGE = 3.2;
const FLAGSHIP_BARRAGE_SPEED = 300;
const FLAGSHIP_BARRAGE_SIZE = 5;
const FLAGSHIP_BARRAGE_LIFE_MS = 2200;
const FLAGSHIP_RED_BARRAGE_CHANCE = 0.10;
const FLAGSHIP_RED_BARRAGE_SPEED_MULT = 1.25;
const FLAGSHIP_RED_BARRAGE_SIZE = 8;

const FLAGSHIP_CHARGE_DURATION_MS = 5000;
const FLAGSHIP_CHARGE_RANGE_SQ = 520 * 520;
const FLAGSHIP_CHARGE_DAMAGE = 34;
const FLAGSHIP_CHARGE_SPEED = 210;
const FLAGSHIP_CHARGE_SIZE = 30;
const FLAGSHIP_CHARGE_LIFE_MS = 3800;
const FLAGSHIP_SUPER_ORB_TRAVEL_MS = 5000;
const FLAGSHIP_SUPER_ORB_EXPAND_MS = 5000;
const FLAGSHIP_SUPER_ORB_MAX_SIZE = 140;
const FLAGSHIP_SUPER_ORB_FREEZE_MS = 3000;
const FLAGSHIP_PATTERN_COOLDOWN_MS = 4500;
const FIRST_QUADRANT_SPECIAL_CHANCE = 0.05;
const MAX_PARTICLES = 420;
const MAX_PHOTONS = 220;
const MAX_DESTROYER_MISSILES = 64;
const FLAGSHIP_MINION_LAUNCH_SPACING_MS = 120;
const FLAGSHIP_MINION_GUNSHOT_DURATION_MS = 420;
const FLAGSHIP_MINION_GUNSHOT_SPEED_MULT = 3.6;
const GIGANAUT_MINION_GUNSHOT_DURATION_MS = 520;
const GIGANAUT_MINION_GUNSHOT_SPEED_MULT = 2.8;
const FLAGSHIP_REINFORCE_BY_QUADRANT = {
  bayron: { count: 20, intervalMs: 10000 },   // Quadrant I
  crimson: { count: 30, intervalMs: 8500 },   // Quadrant II
  watupi: { count: 40, intervalMs: 7000 },    // Quadrant III
  ultra316: { count: 50, intervalMs: 5000 },  // Quadrant IV
};
const GIGANAUT_PHASE_LABELS = {
  1: 'DREAD ARRIVAL',
  2: 'SHIELD BREAK',
  3: 'INTERNAL BREACH',
  4: 'CORE AWAKENING',
  5: 'CATACLYSM',
};
const GIGANAUT_WEAPON_DEFS = {
  horizonCannons: { phase: 1, role: 'Gigantic spinal railguns with warning lanes and one-shot pressure.' },
  swarmPorts: { phase: 1, role: 'Launches interceptor drones, suicide bombers, and boarding pods.' },
  gravityDistortionPulse: { phase: 1, role: 'Creates slow zones, projectile curvature, and drift instability.' },
  starflareBatteries: { phase: 2, role: 'Rapid plasma artillery burst for bullet-hell pressure.' },
  voidLances: { phase: 2, role: 'Precision beam sweeps tracking player movement windows.' },
  flakStormGrid: { phase: 2, role: 'Shrapnel zones and temporary no-fly corridors.' },
  sentinelWalls: { phase: 3, role: 'Interior wall turrets represented as perimeter kill-lanes.' },
  arcCorridors: { phase: 3, role: 'Electrified corridor patterns that pulse on timed intervals.' },
  naniteReconstruction: { phase: 3, role: 'Enemy reconstruction unless reactor systems are crippled.' },
  stellarAnnihilator: { phase: 4, role: 'Superweapon charge event requiring interruption pressure.' },
  eventHorizonGenerator: { phase: 4, role: 'Mini-black holes that pull ships and distort trajectories.' },
  realityFractureMissiles: { phase: 4, role: 'Experimental distortion missiles and battlefield chaos.' },
};
const GIGANAUT_VARIANTS = {
  cathedral: ['light_beams', 'choir_sonic_weapons', 'halo_shields'],
  hive: ['living_missiles', 'organic_tentacles', 'regenerating_armor'],
  ancientMachine: ['time_distortion', 'precision_lasers', 'self_repair_nanites'],
  nomadFortress: ['fleet_deployment', 'mobile_shipyards', 'mining_stations'],
};
const GIGANAUT_SWEEP_RATE_BY_PHASE = {
  1: 540,
  2: 380,
  3: 250,
  4: 220,
  5: 180,
};
const GIGANAUT_REINFORCE_RATE_BY_PHASE = {
  1: 12000,
  2: 9000,
  3: 6800,
  4: 5200,
  5: 4400,
};
const GIGANAUT_ESCORT_RESPAWN_MS = 20000;
const GIGANAUT_ESCORT_BATCH = 3;
const GIGANAUT_ESCORT_SIZE_MULT = 1;
const GIGANAUT_GRAVITY_WELL_RATE_BY_PHASE = {
  1: 0,
  2: 15000,
  3: 11000,
  4: 9000,
  5: 7000,
};

// Absorb damage into shield first; any overflow hits HP; resets regen timer.
function applyPlayerDamage(player, amount, source = 'unknown') {
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
  if (amount > 0) player.lastDamageSource = source;
}

function isOvershieldActive(state) {
  return !!state?.abilities?.pulse?.overshieldActive;
}

function applyPlayerFreeze(player, now, durationMs = FLAGSHIP_SUPER_ORB_FREEZE_MS) {
  player.freezeUntil = Math.max(player.freezeUntil || 0, now + durationMs);
  player.hitFlash = Math.max(player.hitFlash || 0, 10);
}

/**
 * Run one frame of combat: auto-attack, ability hits, enemy contact damage.
 * Returns mutations to apply to the mutable game state ref.
 */
export function runCombatFrame(state, deltaMs) {
  const { player, enemies, particles, abilities } = state;
  const overshieldActive = isOvershieldActive(state);
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
        const overshieldRingBonus = overshieldActive ? 5 : 0;
        const dmg = (player.damage + overshieldRingBonus) * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
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
  // Giganaut Ultimate Beam damage
  if (abilities.ultimate?.active) {
    const beamLen = Math.max(state?.world?.width || 0, state?.world?.height || 0, 2200);
    const bdx = abilities.ultimate.dirX || 1;
    const bdy = abilities.ultimate.dirY || 0;
    const bx1 = player.x;
    const by1 = player.y;
    const bx2 = bx1 + bdx * beamLen;
    const by2 = by1 + bdy * beamLen;
    const t = Math.max(0, Math.min(1, (abilities.ultimate.elapsed || 0) / Math.max(1, abilities.ultimate.durationMs || 4000)));
    const width = 60 - 42 * t;
    const ramp = 1.85 - 1.1 * t;
    const beamDps = 145 * (abilities.pulse?.damageMult || 1) * ramp;
    const beamDamage = beamDps * (deltaMs / 1000) * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const dBeam = distancePointToSegment(enemy.x, enemy.y, bx1, by1, bx2, by2);
      if (dBeam > enemy.size * 0.5 + width * 0.5) continue;
      const dealt = applyDamage(state, enemy, beamDamage, newParticles, 'ultimate_beam');
      if (dealt > 0) playerDealtDamage = true;
      if (enemy.hp <= 0 && !enemy.dead) {
        killEnemy(enemy, state, newParticles, deadEnemyIds);
        scoreGain += enemy.score;
        comboIncrement++;
      }
    }
  }

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

  // Interdimensional Filaments: upgraded orbit arms that shred close targets.
  if (abilities.drone.active && (player.filamentArmsCount || 0) > 0) {
    const arms = Math.max(0, player.filamentArmsCount || 0);
    const filamentRadius = 34 + arms * 9;
    const filamentDps = 16 + arms * 5.5;
    const filamentDamage = filamentDps * (deltaMs / 1000) * player.damageMultiplier * phaseDamageMult * lastStandDamageMult;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (!circlesOverlap(player.x, player.y, filamentRadius, enemy.x, enemy.y, enemy.size * 0.5)) continue;
      const dealt = applyDamage(state, enemy, filamentDamage, newParticles, 'filaments');
      if (dealt > 0) playerDealtDamage = true;
      if (enemy.hp <= 0 && !enemy.dead) {
        killEnemy(enemy, state, newParticles, deadEnemyIds);
        scoreGain += enemy.score;
        comboIncrement++;
      }
    }
  }

  // ── Enemy contact damage ────────────────────────────────────────────────────
  if (!player.invincible && now > player.invincibleUntil) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      if (overshieldActive) continue;
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
      if (overshieldActive) continue;
      applyPlayerDamage(player, ELITE_LASER_DAMAGE, 'elite_laser');
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
      if (Math.random() < DESTROYER_MISSILE_MIX_CHANCE) {
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
      } else {
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
  // ── Legionary hyper photons (alien class) ───────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'legionary') continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > LEGIONARY_PHOTON_RANGE_SQ) continue;
    if (now - (enemy.lastLegionaryPhotonAt || 0) >= LEGIONARY_PHOTON_RATE_MS) {
      enemy.lastLegionaryPhotonAt = now;
      const d = Math.max(1, Math.sqrt(dSq));
      state.photons.push({
        id: uid(),
        x: enemy.x, y: enemy.y,
        vx: (dx / d) * LEGIONARY_PHOTON_SPEED,
        vy: (dy / d) * LEGIONARY_PHOTON_SPEED,
        damage: LEGIONARY_PHOTON_DAMAGE,
        size: LEGIONARY_PHOTON_SIZE,
        life: LEGIONARY_PHOTON_LIFE_MS,
        maxLife: LEGIONARY_PHOTON_LIFE_MS,
        color: '#67E8FF',
        glowColor: 'rgba(103,232,255,0.18)',
      });
    }
  }
  // ── Raybin rapid missiles (alien class) ─────────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'raybin') continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > RAYBIN_MISSILE_RANGE_SQ) continue;
    if (now - (enemy.lastRaybinMissileAt || 0) >= RAYBIN_MISSILE_RATE_MS) {
      enemy.lastRaybinMissileAt = now;
      const d = Math.max(1, Math.sqrt(dSq));
      state.destroyerMissiles.push({
        id: uid(),
        x: enemy.x, y: enemy.y,
        vx: (dx / d) * RAYBIN_MISSILE_SPEED,
        vy: (dy / d) * RAYBIN_MISSILE_SPEED,
        speed: RAYBIN_MISSILE_SPEED,
        turnRate: RAYBIN_MISSILE_TURN,
        damage: RAYBIN_MISSILE_DAMAGE,
        size: RAYBIN_MISSILE_SIZE,
        life: RAYBIN_MISSILE_LIFE_MS,
        maxLife: RAYBIN_MISSILE_LIFE_MS,
        color: '#FFBA7A',
        glowColor: 'rgba(255,164,92,0.26)',
        missile: true,
      });
    }
  }
  // ── Hord gravity well caster (alien class) ──────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'hord') continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > HORD_WELL_RANGE_SQ) continue;
    if (now - (enemy.lastHordWellAt || 0) >= HORD_WELL_RATE_MS) {
      enemy.lastHordWellAt = now;
      if (!state.gravityWells) state.gravityWells = [];
      if (state.gravityWells.length < 6) {
        state.gravityWells.push({
          id: uid(),
          x: player.x + (Math.random() - 0.5) * 120,
          y: player.y + (Math.random() - 0.5) * 120,
          radius: HORD_WELL_RADIUS,
          strength: HORD_WELL_STRENGTH * SHIP_GRAVITY_WELL_STRENGTH_MULT,
          lifeMs: HORD_WELL_LIFE_MS,
        });
      }
    }
  }
  // ── Outlander teleport + photon laser (alien class) ─────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || enemy.type !== 'outlander') continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dSq = dx * dx + dy * dy;
    if (enemy.laserFlash > 0) enemy.laserFlash -= deltaMs;
    if (dSq <= OUTLANDER_TELEPORT_RANGE_SQ && now - (enemy.lastOutlanderTeleportAt || 0) >= OUTLANDER_TELEPORT_RATE_MS) {
      enemy.lastOutlanderTeleportAt = now;
      const angle = Math.atan2(dy, dx) + ((Math.random() - 0.5) * 1.0);
      const radius = 90 + Math.random() * 55;
      enemy.x = Math.max(enemy.size / 2, Math.min((state?.world?.width || 1200) - enemy.size / 2, player.x - Math.cos(angle) * radius));
      enemy.y = Math.max(enemy.size / 2, Math.min((state?.world?.height || 800) - enemy.size / 2, player.y - Math.sin(angle) * radius));
    }
    if (dSq <= OUTLANDER_LASER_RANGE_SQ && now - (enemy.lastOutlanderLaserAt || 0) >= OUTLANDER_LASER_RATE_MS) {
      enemy.lastOutlanderLaserAt = now;
      enemy.laserFlash = 90;
      if (overshieldActive) continue;
      applyPlayerDamage(player, OUTLANDER_LASER_DAMAGE, 'outlander_photon_laser');
      playerTookDamage = true;
      if (player.hitFlash < 4) player.hitFlash = 4;
    }
  }

  // ── Nemesis flagship special attacks ─────────────────────────────────────────
  for (const enemy of enemies) {
    if (enemy.dead || !enemy.isNemesis) continue;
    if (enemy.isGiganaut) {
      runGiganautBehavior(state, enemy, now);
      continue;
    }
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distSq = dx * dx + dy * dy;
    const quadrant = state?.galaxy?.quadrant || '';
    const inFirstQuadrant = quadrant === 'bayron';
    const reinforceCfg = FLAGSHIP_REINFORCE_BY_QUADRANT[quadrant] || FLAGSHIP_REINFORCE_BY_QUADRANT.bayron;
    const reinforceCount = reinforceCfg.count;
    const reinforceIntervalMs = reinforceCfg.intervalMs;

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
    if (!enemy.flagshipReinforceAt) {
      enemy.flagshipReinforceAt = now + reinforceIntervalMs;
    } else if (now >= enemy.flagshipReinforceAt) {
      enemy.pendingReinforcements = (enemy.pendingReinforcements || 0) + reinforceCount;
      if (!enemy.nextReinforcementShotAt) {
        enemy.nextReinforcementShotAt = now;
      }
      enemy.flagshipReinforceAt = now + reinforceIntervalMs;
    }
    if ((enemy.pendingReinforcements || 0) > 0 && now >= (enemy.nextReinforcementShotAt || 0)) {
      spawnFlagshipReinforcements(state, enemy, 1);
      enemy.pendingReinforcements = Math.max(0, (enemy.pendingReinforcements || 0) - 1);
      enemy.nextReinforcementShotAt = now + FLAGSHIP_MINION_LAUNCH_SPACING_MS;
    }

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
            baseSize: FLAGSHIP_CHARGE_SIZE,
            life: FLAGSHIP_SUPER_ORB_TRAVEL_MS + FLAGSHIP_SUPER_ORB_EXPAND_MS + 1200,
            maxLife: FLAGSHIP_SUPER_ORB_TRAVEL_MS + FLAGSHIP_SUPER_ORB_EXPAND_MS + 1200,
            color: '#7BD8FF',
            glowColor: 'rgba(106,206,255,0.28)',
            specialType: 'flagship_super_orb',
            bornAt: now,
            exploded: false,
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
      } else {
        const hpPct = enemy.hp / Math.max(1, enemy.maxHp);
        const barrageRate = hpPct < 0.35 ? 84 : hpPct < 0.6 ? 96 : FLAGSHIP_BARRAGE_RATE_MS;
        if (distSq <= FLAGSHIP_BARRAGE_RANGE_SQ && now - p.lastShotAt >= barrageRate) {
        p.lastShotAt = now;
        const d = Math.max(1, Math.sqrt(distSq));
        const baseNx = dx / d;
        const baseNy = dy / d;
        const spread = (Math.random() - 0.5) * 0.16;
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        const nx = baseNx * cos - baseNy * sin;
        const ny = baseNx * sin + baseNy * cos;
        const useRedBarrage = Math.random() < FLAGSHIP_RED_BARRAGE_CHANCE;
        state.photons.push({
          id: uid(),
          x: enemy.x, y: enemy.y,
          vx: nx * FLAGSHIP_BARRAGE_SPEED * (useRedBarrage ? FLAGSHIP_RED_BARRAGE_SPEED_MULT : 1),
          vy: ny * FLAGSHIP_BARRAGE_SPEED * (useRedBarrage ? FLAGSHIP_RED_BARRAGE_SPEED_MULT : 1),
          damage: FLAGSHIP_BARRAGE_DAMAGE,
          size: useRedBarrage ? FLAGSHIP_RED_BARRAGE_SIZE : FLAGSHIP_BARRAGE_SIZE,
          life: FLAGSHIP_BARRAGE_LIFE_MS,
          maxLife: FLAGSHIP_BARRAGE_LIFE_MS,
          color: useRedBarrage ? '#FF4E4E' : '#86DFFF',
          glowColor: useRedBarrage ? 'rgba(255,70,70,0.2)' : 'rgba(105,207,255,0.16)',
        });
        }
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
      if (ph.specialType === 'flagship_super_orb') {
        const age = now - (ph.bornAt || now);
        if (age < FLAGSHIP_SUPER_ORB_TRAVEL_MS) {
          ph.x += ph.vx * dt;
          ph.y += ph.vy * dt;
        } else if (age < FLAGSHIP_SUPER_ORB_TRAVEL_MS + FLAGSHIP_SUPER_ORB_EXPAND_MS) {
          const t = (age - FLAGSHIP_SUPER_ORB_TRAVEL_MS) / FLAGSHIP_SUPER_ORB_EXPAND_MS;
          ph.vx *= 0.95;
          ph.vy *= 0.95;
          ph.x += ph.vx * dt;
          ph.y += ph.vy * dt;
          ph.size = (ph.baseSize || FLAGSHIP_CHARGE_SIZE) + ((FLAGSHIP_SUPER_ORB_MAX_SIZE - (ph.baseSize || FLAGSHIP_CHARGE_SIZE)) * t);
          if (circlesOverlap(player.x, player.y, playerRadius, ph.x, ph.y, ph.size)) {
            if (overshieldActive) {
              ph.life = -1;
              continue;
            }
            applyPlayerFreeze(player, now);
            playerTookDamage = true;
          }
        } else {
          if (!ph.exploded) {
            ph.exploded = true;
            ph.size = FLAGSHIP_SUPER_ORB_MAX_SIZE;
            if (circlesOverlap(player.x, player.y, playerRadius, ph.x, ph.y, ph.size)) {
              if (overshieldActive) {
                ph.life = -1;
                continue;
              }
              applyPlayerFreeze(player, now);
              playerTookDamage = true;
            }
            for (let i = 0; i < 18; i++) {
              const a = (i / 18) * Math.PI * 2;
              newParticles.push({
                id: uid(),
                x: ph.x,
                y: ph.y,
                vx: Math.cos(a) * 165 * (0.65 + Math.random() * 0.5),
                vy: Math.sin(a) * 165 * (0.65 + Math.random() * 0.5),
                life: 620,
                maxLife: 620,
                size: 3 + Math.random() * 3,
                color: '#7BD8FF',
                type: 'explosion',
              });
            }
          }
          ph.life = -1;
        }
        ph.life -= deltaMs;
        continue;
      }
      ph.x    += ph.vx * dt;
      ph.y    += ph.vy * dt;
      ph.life -= deltaMs;
      if (circlesOverlap(player.x, player.y, playerRadius, ph.x, ph.y, ph.size)) {
        if (overshieldActive) {
          ph.life = -1;
          continue;
        }
        applyPlayerDamage(player, ph.damage, ph.color === '#FF4E4E' ? 'flagship_red_barrage' : 'enemy_photon');
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
        if (overshieldActive) {
          missile.dead = true;
          missile.life = -1;
          continue;
        }
        applyPlayerDamage(player, missile.damage || DESTROYER_MISSILE_DAMAGE, 'destroyer_missile');
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
    state.playerTookDamageEver = true;
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
  if (state.particles.length > MAX_PARTICLES) state.particles = state.particles.slice(-MAX_PARTICLES);
  if (state.photons.length > MAX_PHOTONS) state.photons = state.photons.slice(-MAX_PHOTONS);
  if (state.destroyerMissiles.length > MAX_DESTROYER_MISSILES) {
    state.destroyerMissiles = state.destroyerMissiles.slice(-MAX_DESTROYER_MISSILES);
  }
}

function runGiganautBehavior(state, enemy, now) {
  if (!enemy.giganaut) {
    const variantIds = Object.keys(GIGANAUT_VARIANTS);
    const variant = variantIds[Math.floor(Math.random() * variantIds.length)];
    enemy.giganaut = {
      phase: 1,
      phaseLabel: GIGANAUT_PHASE_LABELS[1],
      variant,
      variantWeapons: GIGANAUT_VARIANTS[variant],
      weapons: GIGANAUT_WEAPON_DEFS,
      adaptiveAI: {
        missileInterceptionGrid: false,
        empShockwaves: false,
        cloakingDrones: false,
      },
      desperationMode: false,
      subsystems: {
        coreReactor: 100,
        commandBridge: 100,
        shieldNodes: 100,
        weaponArrays: 100,
        hangarBays: 100,
        engineCore: 100,
      },
    };
  }
  if (!enemy.giganaut.adaptiveAI) {
    enemy.giganaut.adaptiveAI = {
      missileInterceptionGrid: false,
      empShockwaves: false,
      cloakingDrones: false,
    };
  }
  if (!enemy.giganaut.subsystems) {
    enemy.giganaut.subsystems = {
      coreReactor: 100,
      commandBridge: 100,
      shieldNodes: 100,
      weaponArrays: 100,
      hangarBays: 100,
      engineCore: 100,
    };
  }
  if (!enemy.giganaut.variant) {
    const variantIds = Object.keys(GIGANAUT_VARIANTS);
    const variant = variantIds[Math.floor(Math.random() * variantIds.length)];
    enemy.giganaut.variant = variant;
    enemy.giganaut.variantWeapons = GIGANAUT_VARIANTS[variant];
  } else if (!enemy.giganaut.variantWeapons) {
    enemy.giganaut.variantWeapons = GIGANAUT_VARIANTS[enemy.giganaut.variant] || [];
  }
  if (!enemy.giganaut.weapons) enemy.giganaut.weapons = GIGANAUT_WEAPON_DEFS;
  if (!enemy.giganaut.phaseLabel) {
    enemy.giganaut.phaseLabel = GIGANAUT_PHASE_LABELS[enemy.giganaut.phase] || GIGANAUT_PHASE_LABELS[1];
  }
  const gs = enemy.giganaut;
  const hpPct = enemy.hp / Math.max(1, enemy.maxHp);
  const nextPhase = hpPct > 0.8 ? 1 : hpPct > 0.6 ? 2 : hpPct > 0.35 ? 3 : hpPct > 0.12 ? 4 : 5;
  if (nextPhase !== gs.phase) {
    gs.phase = nextPhase;
    gs.phaseLabel = GIGANAUT_PHASE_LABELS[nextPhase];
    gs.phaseChangedAt = now;
  }
  gs.desperationMode = hpPct <= 0.05;
  if (gs.desperationMode) {
    gs.phase = 5;
    gs.phaseLabel = GIGANAUT_PHASE_LABELS[5];
  }
  state.phaseLabel = `GIGANAUT ${gs.phase}: ${gs.phaseLabel}`;
  if (gs.desperationMode) {
    state.eventBanner = 'DESPERATION MODE: ALL WEAPONS HOT';
  }
  if (!enemy.giganautNextEscortAt) enemy.giganautNextEscortAt = now + GIGANAUT_ESCORT_RESPAWN_MS;
  if (now >= enemy.giganautNextEscortAt) {
    spawnGiganautEscortFlagships(state, enemy, GIGANAUT_ESCORT_BATCH);
    enemy.giganautNextEscortAt = now + GIGANAUT_ESCORT_RESPAWN_MS;
  }

  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const nx = dx / d;
  const ny = dy / d;

  const enginePct = (gs.subsystems.engineCore || 0) / 100;
  if (!enemy.giganautBaseSpeed) enemy.giganautBaseSpeed = enemy.speed;
  const engineMult = 0.35 + Math.max(0, enginePct) * 0.65;
  enemy.speed = Math.max(20, enemy.giganautBaseSpeed * engineMult);
  if (gs.phase === 1 && d < 320) {
    // Phase 1 remains distant: back-thrust when player closes in.
    enemy.vx -= nx * 24;
    enemy.vy -= ny * 24;
  }

  // 1) Horizon Cannons
  if (!enemy.giganautNextHorizonAt) enemy.giganautNextHorizonAt = now + 2200;
  if (now >= enemy.giganautNextHorizonAt && gs.phase >= 1) {
    const horizonDamage = gs.phase >= 4 ? 42 : 30;
    for (let i = -1; i <= 1; i += 2) {
      const s = i * 0.07;
      const cos = Math.cos(s);
      const sin = Math.sin(s);
      const sx = nx * cos - ny * sin;
      const sy = nx * sin + ny * cos;
      state.photons.push({
        id: uid(),
        x: enemy.x + sx * enemy.size * 0.45,
        y: enemy.y + sy * enemy.size * 0.45,
        vx: sx * 560,
        vy: sy * 560,
        damage: horizonDamage,
        size: 18,
        life: 1800,
        maxLife: 1800,
        color: '#FFC77A',
        glowColor: 'rgba(255,181,90,0.34)',
      });
    }
    enemy.giganautNextHorizonAt = now + (gs.phase >= 4 ? 1800 : 2800);
  }

  // 2 + 3) Swarm Ports + Gravity Distortion Pulse
  if (!enemy.giganautNextSweepAt) enemy.giganautNextSweepAt = now + 900;
  if (now >= enemy.giganautNextSweepAt) {
    const spread = 0.58 - gs.phase * 0.08;
    const burst = gs.phase >= 3 ? 3 : 2;
    for (let i = 0; i < burst; i++) {
      const s = -spread + (i * (spread * 2)) / Math.max(1, burst - 1);
      const cos = Math.cos(s);
      const sin = Math.sin(s);
      const sx = nx * cos - ny * sin;
      const sy = nx * sin + ny * cos;
      state.photons.push({
        id: uid(),
        x: enemy.x + sx * enemy.size * 0.3,
        y: enemy.y + sy * enemy.size * 0.3,
        vx: sx * (340 + gs.phase * 26),
        vy: sy * (340 + gs.phase * 26),
        damage: 4.6 + gs.phase * 0.7,
        size: gs.phase >= 4 ? 9 : 7,
        life: 2200,
        maxLife: 2200,
        color: gs.phase >= 4 ? '#FF5E5E' : '#86DFFF',
        glowColor: gs.phase >= 4 ? 'rgba(255,88,88,0.22)' : 'rgba(105,207,255,0.16)',
      });
    }
    enemy.giganautNextSweepAt = now + (GIGANAUT_SWEEP_RATE_BY_PHASE[gs.phase] || 320);
  }

  const hangarPct = (gs.subsystems.hangarBays || 0) / 100;
  const hangarMult = 0.35 + hangarPct * 0.65;
  const reinforceRate = (GIGANAUT_REINFORCE_RATE_BY_PHASE[gs.phase] || 9000) / hangarMult;
  if (!enemy.giganautNextReinforceAt) enemy.giganautNextReinforceAt = now + reinforceRate;
  if (now >= enemy.giganautNextReinforceAt && gs.subsystems.engineCore > 0) {
    const count = Math.max(1, Math.round((gs.phase >= 4 ? 2 : 1) * hangarMult));
    spawnFlagshipReinforcements(state, enemy, count);
    enemy.giganautNextReinforceAt = now + reinforceRate;
  }

  const wellRate = GIGANAUT_GRAVITY_WELL_RATE_BY_PHASE[gs.phase] || 0;
  if (wellRate > 0) {
    if (!enemy.giganautNextWellAt) enemy.giganautNextWellAt = now + 1800;
    if (now >= enemy.giganautNextWellAt && (state.gravityWells || []).length < 3) {
      if (!state.gravityWells) state.gravityWells = [];
      state.gravityWells.push({
        id: uid(),
        x: state.player.x + (Math.random() - 0.5) * 140,
        y: state.player.y + (Math.random() - 0.5) * 140,
        radius: 72 + gs.phase * 9,
        strength: (180 + gs.phase * 36) * SHIP_GRAVITY_WELL_STRENGTH_MULT,
        lifeMs: 3600 + gs.phase * 600,
      });
      enemy.giganautNextWellAt = now + wellRate;
    }
  }

  // 4) Starflare Batteries (phase 2+ bullet hell)
  if (!enemy.giganautNextStarflareAt) enemy.giganautNextStarflareAt = now + 1800;
  if (now >= enemy.giganautNextStarflareAt && gs.phase >= 2) {
    const count = gs.phase >= 5 ? 16 : 11;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      state.photons.push({
        id: uid(),
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(a) * (220 + gs.phase * 30),
        vy: Math.sin(a) * (220 + gs.phase * 30),
        damage: 6.8 + gs.phase * 0.8,
        size: 6,
        life: 1800,
        maxLife: 1800,
        color: '#FF7A52',
        glowColor: 'rgba(255,122,82,0.22)',
      });
    }
    enemy.giganautNextStarflareAt = now + (gs.phase >= 4 ? 1600 : 2600);
  }

  // 6) Flak Storm Grid (phase 2+ shrapnel corridors)
  if (!enemy.giganautNextFlakAt) enemy.giganautNextFlakAt = now + 3000;
  if (now >= enemy.giganautNextFlakAt && gs.phase >= 2) {
    const flakCount = gs.phase >= 5 ? 6 : 4;
    for (let i = 0; i < flakCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sx = state.player.x + Math.cos(a) * (80 + Math.random() * 120);
      const sy = state.player.y + Math.sin(a) * (80 + Math.random() * 120);
      if (!state.photons) state.photons = [];
      state.photons.push({
        id: uid(),
        x: sx,
        y: sy,
        vx: Math.cos(a + Math.PI) * (120 + Math.random() * 100),
        vy: Math.sin(a + Math.PI) * (120 + Math.random() * 100),
        damage: 11 + gs.phase * 1.4,
        size: 8,
        life: 1200,
        maxLife: 1200,
        color: '#FFB27A',
        glowColor: 'rgba(255,178,122,0.20)',
      });
    }
    enemy.giganautNextFlakAt = now + (gs.phase >= 4 ? 2600 : 3800);
  }

  // 7 + 8 + 9) Internal Breach simulation
  if (gs.phase >= 3) {
    if (!enemy.giganautNextSentinelAt) enemy.giganautNextSentinelAt = now + 2200;
    if (now >= enemy.giganautNextSentinelAt) {
      const worldW = state?.world?.width || 1200;
      const worldH = state?.world?.height || 800;
      const edges = [
        { x: 20, y: Math.random() * worldH },
        { x: worldW - 20, y: Math.random() * worldH },
        { x: Math.random() * worldW, y: 20 },
        { x: Math.random() * worldW, y: worldH - 20 },
      ];
      for (const e of edges) {
        const tdx = state.player.x - e.x;
        const tdy = state.player.y - e.y;
        const td = Math.max(1, Math.sqrt(tdx * tdx + tdy * tdy));
        state.photons.push({
          id: uid(),
          x: e.x,
          y: e.y,
          vx: (tdx / td) * 280,
          vy: (tdy / td) * 280,
          damage: 9 + gs.phase,
          size: 7,
          life: 1700,
          maxLife: 1700,
          color: '#C0D7FF',
          glowColor: 'rgba(172,204,255,0.2)',
        });
      }
      enemy.giganautNextSentinelAt = now + 2600;
    }
    if (!enemy.giganautNextArcAt) enemy.giganautNextArcAt = now + 1500;
    if (now >= enemy.giganautNextArcAt) {
      const arcBand = 42 + (gs.phase * 4);
      const nearXBand = Math.abs((state.player.x % 160) - 80) < arcBand * 0.25;
      const nearYBand = Math.abs((state.player.y % 160) - 80) < arcBand * 0.25;
      if ((nearXBand || nearYBand) && !isOvershieldActive(state)) {
        applyPlayerDamage(state.player, 7 + gs.phase * 1.4, 'giganaut_arc_corridor');
      }
      enemy.giganautNextArcAt = now + 1150;
    }
    // Nanite reconstruction until reactor is heavily damaged.
    if ((gs.subsystems.coreReactor || 0) > 20) {
      for (const ally of state.enemies) {
        if (ally.dead || ally.id === enemy.id || !ally.isFlagshipMinion) continue;
        ally.hp = Math.min(ally.maxHp, ally.hp + 0.12);
      }
    }
  }

  // 10 + 11 + 12) Core Awakening suite
  if (gs.phase >= 4) {
    if (!enemy.giganautStellarChargeAt) enemy.giganautStellarChargeAt = now + 9000;
    if (!enemy.giganautStellarFireAt) enemy.giganautStellarFireAt = 0;
    if (now >= enemy.giganautStellarChargeAt && now < enemy.giganautStellarChargeAt + 3600) {
      state.eventBanner = "It’s charging a stellar collapse weapon...";
    } else if (enemy.giganautStellarChargeAt > 0 && now >= enemy.giganautStellarChargeAt + 3600 && now >= enemy.giganautStellarFireAt) {
      // Stellar Annihilator
      const px = state.player.x - enemy.x;
      const py = state.player.y - enemy.y;
      const pd = Math.max(1, Math.sqrt(px * px + py * py));
      state.photons.push({
        id: uid(),
        x: enemy.x,
        y: enemy.y,
        vx: (px / pd) * 620,
        vy: (py / pd) * 620,
        damage: 58,
        size: 24,
        life: 1600,
        maxLife: 1600,
        color: '#FFE6A8',
        glowColor: 'rgba(255,230,168,0.34)',
      });
      enemy.giganautStellarFireAt = now + 12000;
      enemy.giganautStellarChargeAt = now + 12000;
    }

    // Event Horizon Generator
    if (!enemy.giganautNextHorizonWellAt) enemy.giganautNextHorizonWellAt = now + 4200;
    if (now >= enemy.giganautNextHorizonWellAt && (state.gravityWells || []).length < 4) {
      if (!state.gravityWells) state.gravityWells = [];
      state.gravityWells.push({
        id: uid(),
        x: state.player.x + (Math.random() - 0.5) * 220,
        y: state.player.y + (Math.random() - 0.5) * 220,
        radius: 88 + gs.phase * 8,
        strength: (260 + gs.phase * 40) * SHIP_GRAVITY_WELL_STRENGTH_MULT,
        lifeMs: 4200 + gs.phase * 700,
      });
      enemy.giganautNextHorizonWellAt = now + 5600;
    }

    // Reality Fracture Missiles
    if (!enemy.giganautNextFractureAt) enemy.giganautNextFractureAt = now + 5200;
    if (now >= enemy.giganautNextFractureAt) {
      const fd = Math.max(1, d);
      state.photons.push({
        id: uid(),
        x: enemy.x,
        y: enemy.y,
        vx: (dx / fd) * 260,
        vy: (dy / fd) * 260,
        damage: 18,
        size: 13,
        life: 2600,
        maxLife: 2600,
        color: '#C488FF',
        glowColor: 'rgba(196,136,255,0.28)',
      });
      enemy.giganautNextFractureAt = now + 6200;
    }
  }

  if (!enemy.giganautNextBarrageAt) enemy.giganautNextBarrageAt = now + 2600;
  if (now >= enemy.giganautNextBarrageAt && gs.phase >= 3) {
    if (!state.meteors) state.meteors = [];
    const stormCount = gs.phase >= 5 ? 8 : 5;
    const worldW = state?.world?.width || 1200;
    const worldH = state?.world?.height || 800;
    for (let i = 0; i < stormCount; i++) {
      state.meteors.push({
        id: uid(),
        x: Math.random() * worldW,
        y: -30 - Math.random() * 90,
        vx: (Math.random() - 0.5) * 55,
        vy: 180 + Math.random() * 150,
        size: 7 + Math.random() * 6,
        damage: 16 + gs.phase * 3,
      });
    }
    enemy.giganautNextBarrageAt = now + (gs.phase >= 5 ? 2400 : 3800);
  }

  // Adaptive AI toggles based on current player pressure profile.
  const closeCombat = d < 150;
  const missileHeavyPressure = (state.destroyerMissiles?.length || 0) > 18;
  const sniperStyle = d > 360;
  gs.adaptiveAI.missileInterceptionGrid = missileHeavyPressure;
  gs.adaptiveAI.empShockwaves = closeCombat;
  gs.adaptiveAI.cloakingDrones = sniperStyle;
  if (gs.adaptiveAI.empShockwaves && now % 1600 < 20 && d < 160 && !isOvershieldActive(state)) {
    applyPlayerDamage(state.player, 6.5, 'giganaut_emp_shockwave');
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
  let applied = dmg;
  if (enemy?.isGiganaut && enemy?.giganaut?.subsystems) {
    const subs = enemy.giganaut.subsystems;
    const shieldPct = Math.max(0, (subs.shieldNodes || 0) / 100);
    const shieldAbsorb = shieldPct > 0 ? Math.min(applied * (0.7 + shieldPct * 0.2), applied) : 0;
    if (shieldAbsorb > 0) {
      subs.shieldNodes = Math.max(0, subs.shieldNodes - shieldAbsorb * 0.22);
      applied -= shieldAbsorb;
    }
    const structuralHit = dmg * 0.07;
    if (subs.commandBridge > 0) subs.commandBridge = Math.max(0, subs.commandBridge - structuralHit * 0.7);
    if (subs.weaponArrays > 0) subs.weaponArrays = Math.max(0, subs.weaponArrays - structuralHit);
    if (subs.hangarBays > 0) subs.hangarBays = Math.max(0, subs.hangarBays - structuralHit * 0.8);
    if (subs.engineCore > 0) subs.engineCore = Math.max(0, subs.engineCore - structuralHit * 0.6);
    if (subs.shieldNodes <= 0) {
      subs.coreReactor = Math.max(0, subs.coreReactor - applied * 0.15);
    }
    if (subs.coreReactor <= 0) {
      applied *= 1.85;
    }
  }
  const dealt = Math.max(0, Math.min(enemy.hp, applied));
  const critical = dealt >= Math.max(26, enemy.maxHp * 0.35);
  enemy.hp -= applied;
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

function spawnFlagshipReinforcements(state, enemy, count) {
  const worldW = state?.world?.width || 0;
  const worldH = state?.world?.height || 0;
  const c = Math.max(0, Math.floor(count));
  for (let i = 0; i < c; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 48 + Math.random() * 42;
    const x = enemy.x + Math.cos(a) * r;
    const y = enemy.y + Math.sin(a) * r;
    const def = ENEMY_TYPES.swarm;
    const headingLen = Math.hypot(enemy.vx || 0, enemy.vy || 0);
    let launchNx = 1;
    let launchNy = 0;
    if (headingLen > 0.001) {
      launchNx = (enemy.vx || 0) / headingLen;
      launchNy = (enemy.vy || 0) / headingLen;
    } else {
      const dx = state.player.x - enemy.x;
      const dy = state.player.y - enemy.y;
      const distToPlayer = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      launchNx = dx / distToPlayer;
      launchNy = dy / distToPlayer;
    }
    const spawnX = worldW > 0 ? Math.max(16, Math.min(worldW - 16, x)) : x;
    const spawnY = worldH > 0 ? Math.max(16, Math.min(worldH - 16, y)) : y;
    state.enemies.push({
      id: uid(),
      type: def.type,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      damage: def.damage,
      size: def.size,
      color: def.color,
      glow: def.glow,
      score: def.score,
      points: def.points,
      dead: false,
      hitFlash: 0,
      angle: Math.random() * 360,
      targetAngle: Math.random() * 360,
      turnRate: 180,
      lastLaserAt: 0,
      lastSwarmPhotonAt: 0,
      isFlagshipMinion: true,
      launchVx: launchNx * def.speed * (enemy.isGiganaut ? GIGANAUT_MINION_GUNSHOT_SPEED_MULT : FLAGSHIP_MINION_GUNSHOT_SPEED_MULT),
      launchVy: launchNy * def.speed * (enemy.isGiganaut ? GIGANAUT_MINION_GUNSHOT_SPEED_MULT : FLAGSHIP_MINION_GUNSHOT_SPEED_MULT),
      launchUntil: Date.now() + (enemy.isGiganaut ? GIGANAUT_MINION_GUNSHOT_DURATION_MS : FLAGSHIP_MINION_GUNSHOT_DURATION_MS),
    });
  }
}

function spawnGiganautEscortFlagships(state, giganaut, count) {
  const worldW = state?.world?.width || 0;
  const worldH = state?.world?.height || 0;
  const c = Math.max(0, Math.floor(count));
  const visualClearRadius = Math.max((giganaut.visualRadiusHint || 250) + 70, (giganaut.size || 0) * 2.8);
  for (let i = 0; i < c; i++) {
    const a = (i / Math.max(1, c)) * Math.PI * 2 + Math.random() * 0.3;
    const r = visualClearRadius + Math.random() * 80;
    const x = giganaut.x + Math.cos(a) * r;
    const y = giganaut.y + Math.sin(a) * r;
    const def = ENEMY_TYPES.elite;
    const spawnX = worldW > 0 ? Math.max(26, Math.min(worldW - 26, x)) : x;
    const spawnY = worldH > 0 ? Math.max(26, Math.min(worldH - 26, y)) : y;
    state.enemies.push({
      id: uid(),
      type: def.type,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      hp: def.hp * 2.7,
      maxHp: def.hp * 2.7,
        speed: def.speed * 1.5,
      damage: def.damage * 1.35,
      size: def.size * GIGANAUT_ESCORT_SIZE_MULT,
      color: def.color,
      glow: def.glow,
      score: Math.round(def.score * 2.6),
      points: def.points,
      dead: false,
      hitFlash: 0,
      angle: Math.random() * 360,
      targetAngle: Math.random() * 360,
      turnRate: 160,
      lastLaserAt: 0,
      lastSwarmPhotonAt: 0,
      zigZagPhase: Math.random() * Math.PI * 2,
      zigZagTimer: 0,
      burstTimer: 0,
      burstActive: false,
      burstDuration: 0,
      isNemesis: true,
      isGiganaut: false,
      name: 'ESCORT FLAGSHIP',
    });
  }
}
