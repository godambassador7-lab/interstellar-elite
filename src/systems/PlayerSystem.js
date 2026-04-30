// src/systems/PlayerSystem.js

import { PLAYER, ABILITIES, SCREEN } from '../utils/constants';
import { clamp, uid } from '../utils/mathUtils';

/**
 * Update player position, velocity, ability states, and trail.
 */
export function updatePlayer(state, joystick, deltaMs, abilities) {
  const dt = deltaMs / 1000;
  const { player } = state;
  const hyperspaceActive = !!state?.inIntercept;
  const phaseActive = !!abilities.phase?.active;
  const phaseSpeedMult = phaseActive ? abilities.phase.speedMult || 1.35 : 1;
  player.phaseShift = phaseActive;
  const hyperspaceTurbulence = hyperspaceActive
    ? (0.85 + Math.abs(Math.sin((state.gameTime || 0) * 3.9 + 0.73)) * 0.55 + Math.abs(Math.sin((state.gameTime || 0) * 1.7 + 2.1)) * 0.25)
    : 1;

  // ── Input → velocity ─────────────────────────────────────────────────────────
  if (!abilities.dash.active) {
    const inputX = joystick.dx;
    const inputY = joystick.dy;
    const len = Math.sqrt(inputX * inputX + inputY * inputY);
    const magnitude = Math.min(len, 1);

    if (magnitude > 0.08) {
      const nx = inputX / len;
      const ny = inputY / len;
      const speed = player.speed * phaseSpeedMult * hyperspaceTurbulence;
      const controlGain = hyperspaceActive ? 8.4 : 12;
      player.vx += nx * speed * magnitude * controlGain * dt;
      player.vy += ny * speed * magnitude * controlGain * dt;

      // Store facing direction for dash
      player.facingX = hyperspaceActive ? 1 : nx;
      player.facingY = hyperspaceActive ? 0 : ny;
    }
  }

  // Apply friction
  const friction = abilities.dash.active
    ? 0.96
    : hyperspaceActive
      ? 0.93
      : PLAYER.FRICTION;
  player.vx *= Math.pow(friction, deltaMs / 16.67);
  player.vy *= Math.pow(friction, deltaMs / 16.67);

  if (hyperspaceActive) {
    // Add slight lateral slip so controls feel drifty in hyperspace.
    const slip = Math.sin((state.gameTime || 0) * 2.2 + player.x * 0.0023 + player.y * 0.0017);
    player.vy += slip * player.speed * 0.06 * dt;
  }

  // Cap velocity
  const maxSpd = player.speed * phaseSpeedMult * hyperspaceTurbulence * 1.5;
  const spd = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  if (spd > maxSpd) {
    player.vx = (player.vx / spd) * maxSpd;
    player.vy = (player.vy / spd) * maxSpd;
  }

  // Keep sprite facing the movement direction while moving.
  if (hyperspaceActive) {
    player.facingAngle = 90;
    player.facingX = 1;
    player.facingY = 0;
  } else if (spd > 6) {
    player.facingAngle = (Math.atan2(player.vy, player.vx) * 180) / Math.PI + 90;
  }

  // Apply position
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Wall bounce
  const worldWidth = state?.world?.width || SCREEN.width;
  const worldHeight = state?.world?.height || SCREEN.height;
  const hr = PLAYER.SIZE / 2;
  if (player.x < hr) { player.x = hr; player.vx = Math.abs(player.vx) * 0.5; }
  if (player.x > worldWidth - hr) { player.x = worldWidth - hr; player.vx = -Math.abs(player.vx) * 0.5; }
  if (player.y < hr) { player.y = hr; player.vy = Math.abs(player.vy) * 0.5; }
  if (player.y > worldHeight - hr) { player.y = worldHeight - hr; player.vy = -Math.abs(player.vy) * 0.5; }

  // ── Flash decay ───────────────────────────────────────────────────────────────
  if (player.hitFlash > 0) player.hitFlash--;
  if (player.attackFlash > 0) player.attackFlash--;

  // ── Ability: Dash ─────────────────────────────────────────────────────────────
  if (abilities.dash.active) {
    abilities.dash.elapsed += deltaMs;
    if (abilities.dash.elapsed >= ABILITIES.DASH.DURATION) {
      abilities.dash.active = false;
      abilities.dash.elapsed = 0;
    }
  }
  // Cooldown tick
  if (!abilities.dash.active && abilities.dash.cooldownRemaining > 0) {
    abilities.dash.cooldownRemaining = Math.max(0, abilities.dash.cooldownRemaining - deltaMs);
  }

  // ── Ability: Pulse ────────────────────────────────────────────────────────────
  if (abilities.pulse.active) {
    abilities.pulse.elapsed += deltaMs;
    if (abilities.pulse.elapsed >= ABILITIES.PULSE.DURATION) {
      abilities.pulse.active = false;
      abilities.pulse.elapsed = 0;
      abilities.pulse.dealtDamage = false;
    }
  }
  if (!abilities.pulse.active && abilities.pulse.cooldownRemaining > 0) {
    abilities.pulse.cooldownRemaining = Math.max(0, abilities.pulse.cooldownRemaining - deltaMs);
  }

  // ── Ability: Drone ────────────────────────────────────────────────────────────
  if (abilities.drone.active) {
    abilities.drone.elapsed += deltaMs;
    abilities.drone.angle += ABILITIES.DRONE.SPEED * (abilities.drone.speedMult || 1) * dt;
    const count = abilities.drone.count || ABILITIES.DRONE.COUNT;
    abilities.drone.positions = [];
    for (let i = 0; i < count; i++) {
      const a = abilities.drone.angle + (i / count) * Math.PI * 2;
      abilities.drone.positions.push({
        x: player.x + Math.cos(a) * ABILITIES.DRONE.RADIUS,
        y: player.y + Math.sin(a) * ABILITIES.DRONE.RADIUS,
      });
    }
    if (abilities.drone.elapsed >= ABILITIES.DRONE.DURATION) {
      abilities.drone.active = false;
      abilities.drone.elapsed = 0;
      abilities.drone.positions = [];
      abilities.drone.hitCooldowns.clear();
    }
  }
  if (!abilities.drone.active && abilities.drone.cooldownRemaining > 0) {
    abilities.drone.cooldownRemaining = Math.max(0, abilities.drone.cooldownRemaining - deltaMs);
  }

  // Phase Swap timers
  if (abilities.phase.active) {
    abilities.phase.elapsed += deltaMs;
    if (abilities.phase.elapsed >= abilities.phase.durationMs) {
      abilities.phase.active = false;
      abilities.phase.elapsed = 0;
      player.phaseShift = false;
    }
  }
  if (!abilities.phase.active && abilities.phase.cooldownRemaining > 0) {
    abilities.phase.cooldownRemaining = Math.max(0, abilities.phase.cooldownRemaining - deltaMs);
  }

  // Quantum Slash timers
  if (abilities.quantum.active) {
    abilities.quantum.freezeRemaining = Math.max(0, abilities.quantum.freezeRemaining - deltaMs);
    abilities.quantum.slashWindowRemaining = Math.max(0, abilities.quantum.slashWindowRemaining - deltaMs);
    if (abilities.quantum.freezeRemaining <= 0 && abilities.quantum.slashWindowRemaining <= 0) {
      abilities.quantum.active = false;
      abilities.quantum.hitCooldowns.clear();
      abilities.quantum.lastSwipePoint = null;
    }
  }
  if (abilities.quantum.unlocked && !abilities.quantum.active && abilities.quantum.cooldownRemaining > 0) {
    abilities.quantum.cooldownRemaining = Math.max(0, abilities.quantum.cooldownRemaining - deltaMs);
  }

  // ── Dash trail ────────────────────────────────────────────────────────────────
  if (abilities.dash.active) {
    state.dashTrail.push({
      id: uid(),
      x: player.x,
      y: player.y,
      life: 200,
      maxLife: 200,
    });
  }
  // Update trail
  for (const t of state.dashTrail) t.life -= deltaMs;
  state.dashTrail = state.dashTrail.filter(t => t.life > 0);

  // ── Shield regeneration ──────────────────────────────────────────────────────
  if (player.shieldRegenDelay > 0) {
    player.shieldRegenDelay = Math.max(0, player.shieldRegenDelay - deltaMs);
  } else if (player.shield < player.maxShield) {
    player.shield = Math.min(player.maxShield, player.shield + PLAYER.SHIELD_REGEN_RATE * dt);
  }

  // ── Screen shake decay ────────────────────────────────────────────────────────
  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - deltaMs * 0.04);
  }

  // ── Particle update ───────────────────────────────────────────────────────────
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= deltaMs;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

/**
 * Trigger dash ability.
 */
export function triggerDash(player, abilities) {
  if (abilities.dash.cooldownRemaining > 0 || abilities.dash.active) return;
  abilities.dash.active = true;
  abilities.dash.elapsed = 0;
  abilities.dash.hitIds = new Set();
  abilities.dash.cooldownRemaining = abilities.dash.maxCooldown;

  const fx = player.facingX || 1;
  const fy = player.facingY || 0;
  player.vx = fx * ABILITIES.DASH.FORCE;
  player.vy = fy * ABILITIES.DASH.FORCE;
}

/**
 * Trigger pulse ability.
 */
export function triggerPulse(player, abilities) {
  if (abilities.pulse.cooldownRemaining > 0 || abilities.pulse.active) return;
  abilities.pulse.active = true;
  abilities.pulse.elapsed = 0;
  abilities.pulse.dealtDamage = false;
  abilities.pulse.cooldownRemaining = abilities.pulse.maxCooldown;
}

/**
 * Trigger drone ability.
 */
export function triggerDrone(player, abilities) {
  if (abilities.drone.cooldownRemaining > 0 || abilities.drone.active) return;
  abilities.drone.active = true;
  abilities.drone.elapsed = 0;
  abilities.drone.angle = 0;
  abilities.drone.positions = [];
  abilities.drone.hitCooldowns = new Map();
  abilities.drone.cooldownRemaining = abilities.drone.maxCooldown;
}

/**
 * Trigger phase swap ability (brief intangibility + mobility burst).
 */
export function triggerPhaseSwap(player, abilities) {
  if (abilities.phase.cooldownRemaining > 0 || abilities.phase.active) return;
  abilities.phase.active = true;
  abilities.phase.elapsed = 0;
  abilities.phase.cooldownRemaining = abilities.phase.maxCooldown;
  player.phaseShift = true;
}

/**
 * Trigger quantum slash ability (freeze + swipe damage window).
 */
export function triggerQuantumSlash(player, abilities) {
  if (!abilities.quantum.unlocked) return;
  if (abilities.quantum.cooldownRemaining > 0 || abilities.quantum.active) return;
  abilities.quantum.active = true;
  abilities.quantum.freezeRemaining = 3000;
  abilities.quantum.slashWindowRemaining = 3000;
  abilities.quantum.cooldownRemaining = abilities.quantum.maxCooldown;
  abilities.quantum.lastSwipePoint = null;
  abilities.quantum.hitCooldowns.clear();
}

/**
 * Create initial player state.
 */
export function createPlayer() {
  return {
    x: SCREEN.width / 2,
    y: SCREEN.height / 2,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
    facingAngle: 0,
    hp: PLAYER.HEALTH,
    maxHp: PLAYER.HEALTH,
    shield: PLAYER.SHIELD_MAX,
    maxShield: PLAYER.SHIELD_MAX,
    shieldRegenDelay: 0,
    speed: PLAYER.BASE_SPEED,
    damage: PLAYER.ATTACK_DAMAGE,
    damageMultiplier: 1,
    attackTargets: 1,
    attackRate: PLAYER.ATTACK_RATE,
    attackRange: PLAYER.ATTACK_RANGE,
    lastAttackTime: 0,
    hitFlash: 0,
    attackFlash: 0,
    invincibleUntil: 0,
    comboWindowBonus: 0,
  };
}

/**
 * Create initial abilities state.
 */
export function createAbilities() {
  return {
    dash: {
      active: false,
      elapsed: 0,
      cooldownRemaining: 0,
      maxCooldown: ABILITIES.DASH.COOLDOWN,
      hitIds: new Set(),
    },
    pulse: {
      active: false,
      elapsed: 0,
      cooldownRemaining: 0,
      maxCooldown: ABILITIES.PULSE.COOLDOWN,
      dealtDamage: false,
      damageMult: 1,
    },
    drone: {
      active: false,
      elapsed: 0,
      cooldownRemaining: 0,
      maxCooldown: ABILITIES.DRONE.COOLDOWN,
      angle: 0,
      positions: [],
      count: ABILITIES.DRONE.COUNT,
      speedMult: 1,
      hitCooldowns: new Map(),
    },
    quantum: {
      unlocked: false,
      active: false,
      freezeRemaining: 0,
      slashWindowRemaining: 0,
      cooldownRemaining: 0,
      maxCooldown: 14000,
      lastSwipePoint: null,
      hitCooldowns: new Map(),
    },
    phase: {
      active: false,
      elapsed: 0,
      durationMs: 1300,
      cooldownRemaining: 0,
      maxCooldown: 7000,
      speedMult: 1.42,
      damageMult: 1.25,
    },
  };
}
