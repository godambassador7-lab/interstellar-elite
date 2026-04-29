// src/screens/GameScreen.js

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Animated, Text, TouchableOpacity, PanResponder, Image, Platform, Share } from 'react-native';
import * as Haptics from 'expo-haptics';

import { SCREEN, COLORS, getUpgradeThresholdsForRun } from '../utils/constants';
import {
  createPlayer,
  createAbilities,
  updatePlayer,
  triggerDash,
  triggerPulse,
  triggerDrone,
  triggerQuantumSlash,
  triggerPhaseSwap,
} from '../systems/PlayerSystem';
import { runCombatFrame, applyQuantumSlashSwipe } from '../systems/CombatSystem';
import { trySpawn, updateEnemyMovement, getWaveEnemyCount } from '../systems/SpawnSystem';
import { pickUpgradeChoices, applyUpgrade } from '../systems/UpgradeSystem';
import { pickShopOffers, randomShopInterval, applyShopOffer } from '../systems/ShopSystem';
import { applyMetaUpgrades } from '../systems/MetaUpgradeSystem';

import { VirtualJoystick } from '../components/VirtualJoystick';
import { HUD } from '../components/HUD';
import {
  PlayerShip,
  EnemyShip,
  Particle,
  DashTrail,
  PulseRing,
  DroneOrbit,
  StarField,
  AttackRangeIndicator,
  QuantumPickup,
  QuantumSwipeTrail,
  DamageNumbers,
  useShakeOffset,
} from '../components/GameCanvas';
import { UpgradeScreen } from '../components/UpgradeScreen';
import { ShopScreen } from '../components/ShopScreen';
import { GameOver } from '../components/GameOver';

const BATTLE_BACKGROUND_IMAGE = require('../../battle background.png');
let LAST_BATTLE_BG_CROP = null;

function pickBattleBgCrop() {
  const scale = 2.15; // Show a zoomed section so each battle feels distinct.
  const maxOffsetX = SCREEN.width * (scale - 1);
  const maxOffsetY = SCREEN.height * (scale - 1);
  const minDelta = Math.min(maxOffsetX, maxOffsetY) * 0.12;

  let best = null;
  for (let i = 0; i < 12; i++) {
    const candidate = {
      scale,
      offsetX: Math.random() * maxOffsetX,
      offsetY: Math.random() * maxOffsetY,
    };
    if (!LAST_BATTLE_BG_CROP) {
      LAST_BATTLE_BG_CROP = candidate;
      return candidate;
    }
    const delta = Math.hypot(
      candidate.offsetX - LAST_BATTLE_BG_CROP.offsetX,
      candidate.offsetY - LAST_BATTLE_BG_CROP.offsetY
    );
    if (!best || delta > best.delta) best = { candidate, delta };
    if (delta >= minDelta) {
      LAST_BATTLE_BG_CROP = candidate;
      return candidate;
    }
  }

  LAST_BATTLE_BG_CROP = best?.candidate || {
    scale,
    offsetX: Math.random() * maxOffsetX,
    offsetY: Math.random() * maxOffsetY,
  };
  return LAST_BATTLE_BG_CROP;
}

function EnemyLaserBeam({ x1, y1, x2, y2, alpha, color }) {
  const dx  = x2 - x1;
  const dy  = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return null;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - len / 2,
        top:  (y1 + y2) / 2 - 1,
        width: len,
        height: 2,
        backgroundColor: color,
        opacity: alpha * 0.82,
        borderRadius: 1,
        transform: [{ rotate: `${angle}deg` }],
        shadowColor: color,
        shadowOpacity: 0.9,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function PhotonBall({ photon }) {
  const { color = '#FFE566', glowColor = 'rgba(255,193,58,0.15)', size: s, life } = photon;
  const fadeOpacity = Math.min(1, life / 500);
  const showGlow = s > 6;
  return (
    <>
      {showGlow && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: photon.x - s * 2,
            top:  photon.y - s * 2,
            width: s * 4,
            height: s * 4,
            borderRadius: s * 2,
            backgroundColor: glowColor,
            opacity: fadeOpacity,
          }}
        />
      )}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: photon.x - s,
          top:  photon.y - s,
          width: s * 2,
          height: s * 2,
          borderRadius: s,
          backgroundColor: color,
          opacity: fadeOpacity,
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: showGlow ? 18 : 6,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </>
  );
}

function snapshotAbilities(abilities) {
  return {
    dash: {
      active: abilities.dash.active,
      cooldownRemaining: abilities.dash.cooldownRemaining,
      maxCooldown: abilities.dash.maxCooldown,
    },
    pulse: {
      active: abilities.pulse.active,
      cooldownRemaining: abilities.pulse.cooldownRemaining,
      maxCooldown: abilities.pulse.maxCooldown,
    },
    drone: {
      active: abilities.drone.active,
      cooldownRemaining: abilities.drone.cooldownRemaining,
      maxCooldown: abilities.drone.maxCooldown,
    },
    quantum: {
      active: abilities.quantum.active,
      cooldownRemaining: abilities.quantum.cooldownRemaining,
      maxCooldown: abilities.quantum.maxCooldown,
      unlocked: abilities.quantum.unlocked,
    },
    phase: {
      active: abilities.phase.active,
      cooldownRemaining: abilities.phase.cooldownRemaining,
      maxCooldown: abilities.phase.maxCooldown,
    },
  };
}

function makeUiState() {
  return {
    playerHp: 100,
    playerMaxHp: 100,
    playerShield: 50,
    playerMaxShield: 50,
    photons: [],
    playerX: SCREEN.width / 2,
    playerY: SCREEN.height / 2,
    playerHitFlash: 0,
    playerAttackFlash: 0,
    playerFacingAngle: 0,
    playerMoving: false,
    cameraX: 0,
    cameraY: 0,
    dashActive: false,
    score: 0,
    combo: 0,
    totalDamage: 0,
    peakCombo: 0,
    abilities: null,
    enemies: [],
    particles: [],
    dashTrail: [],
    pulseActive: false,
    pulseElapsed: 0,
    dronePositions: [],
    droneActive: false,
    attackRange: 90,
    time: 0,
    gameTime: 0,
    isDead: false,
    isVictory: false,
    showUpgrade: false,
    upgradeChoices: [],
    showShop: false,
    shopOffers: [],
    currentWave: 1,
    maxWaves: 1,
    waveRemaining: 0,
    quantumPickup: null,
    quantumTrails: [],
    damageNumbers: [],
    gravityWells: [],
    meteors: [],
    phaseLabel: 'SYSTEM BATTLE',
    phaseTimer: 0,
    eventBanner: '',
    perfectDodges: 0,
    latestHighlight: null,
    flagshipEscape: null,
  };
}

const BATTLE_WORLD = {
  width: SCREEN.width * 3.2,
  height: SCREEN.height * 3.2,
};
const PLAYER_PICKUP_RADIUS = 42;
const ENHANCEMENT_SETTLE_MS = 220;
const GRAVITY_WELL_MAX = 2;
const GRAVITY_WELL_SPAWN_MS = 13000;
const DESKTOP_MIN_WIDTH = 1024;
const DESKTOP_MIN_HEIGHT = 640;
const BG_PARALLAX = 0.28;

function GravityWellView({ well, time = 0 }) {
  const r = well.radius;
  const t = time * 2.6;
  const swirlPoints = Array.from({ length: 8 }, (_, i) => {
    const a = t + (i / 8) * Math.PI * 2;
    const radius = r * (0.18 + (i % 4) * 0.12);
    return {
      x: well.x + Math.cos(a * (1 + i * 0.05)) * radius,
      y: well.y + Math.sin(a * (1 + i * 0.05)) * radius,
      size: 2 + (i % 3),
      opacity: 0.35 + (i % 4) * 0.1,
    };
  });
  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: well.x - r,
          top: well.y - r,
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 1,
          borderColor: 'rgba(125,195,255,0.65)',
          backgroundColor: 'rgba(70,120,255,0.09)',
        }}
      />
      {swirlPoints.map((p, idx) => (
        <View
          key={`sw-${well.id}-${idx}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: p.x - p.size,
            top: p.y - p.size,
            width: p.size * 2,
            height: p.size * 2,
            borderRadius: p.size,
            backgroundColor: idx % 2 === 0 ? 'rgba(117,224,255,0.9)' : 'rgba(154,179,255,0.85)',
            opacity: p.opacity,
          }}
        />
      ))}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: well.x - 6,
          top: well.y - 6,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: '#9BD7FF',
          shadowColor: '#9BD7FF',
          shadowOpacity: 0.95,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </>
  );
}

function MeteorView({ meteor }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: meteor.x - meteor.size,
        top: meteor.y - meteor.size,
        width: meteor.size * 2,
        height: meteor.size * 2,
        borderRadius: meteor.size,
        backgroundColor: 'rgba(255,170,92,0.92)',
        shadowColor: '#FFAA5C',
        shadowOpacity: 0.9,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function applyGravityFromWells(entity, wells, dtSec, weight = 1) {
  if (!entity || !wells?.length) return;
  for (const w of wells) {
    const dx = w.x - entity.x;
    const dy = w.y - entity.y;
    const distSq = dx * dx + dy * dy;
    const radiusSq = w.radius * w.radius;
    if (distSq > radiusSq || distSq < 4) continue;
    const dist = Math.sqrt(distSq);
    const normalized = 1 - dist / w.radius;
    const pull = w.strength * normalized * weight;
    entity.vx += (dx / dist) * pull * dtSec;
    entity.vy += (dy / dist) * pull * dtSec;
  }
}

function hasActiveWeapon(abilities) {
  if (!abilities) return false;
  return !!(
    abilities.dash?.active ||
    abilities.pulse?.active ||
    abilities.drone?.active ||
    abilities.quantum?.active
  );
}

export default function GameScreen({
  galaxy,
  systemNumber = 1,
  metaUpgrades = {},
  onSystemComplete,
  onMainMenu,
}) {
  const [uiState, setUiState] = useState(makeUiState);
  const [gameKey, setGameKey] = useState(0);
  const [battleBgCrop, setBattleBgCrop] = useState(() => pickBattleBgCrop());

  const G = useRef(null);
  const joystick = useRef({ dx: 0, dy: 0 });
  const keyInput = useRef({ dx: 0, dy: 0 });
  const pressedKeys = useRef(new Set());
  const keyboardEnabled = useRef(false);
  const abilityHotkeysRef = useRef({
    dash: () => {},
    pulse: () => {},
    drone: () => {},
    quantum: () => {},
  });
  const rafRef = useRef(null);
  const lastTs = useRef(null);
  const isRunning = useRef(false);
  const isPaused = useRef(false);
  const upgradeQueue = useRef([]);
  const nextThresholdIdx = useRef(0);
  const peakComboRef = useRef(0);
  const abilityUsageRef = useRef({ dash: 0, pulse: 0, drone: 0, phase: 0 });
  const basePlayerDamageRef = useRef(0);

  const { shakeX, shakeY, applyShake } = useShakeOffset();

  const pushHighlight = useCallback((g, type, details = {}) => {
    g.latestHighlight = {
      id: `hl-${Date.now()}-${Math.random()}`,
      type,
      details,
      score: g.score,
      combo: g.combo,
      at: Date.now(),
    };
  }, []);

  const shareHighlight = useCallback(async (highlight) => {
    if (!highlight) return;
    const line = `[Interstellar Elite] ${highlight.type} | Score ${highlight.score} | Combo ${highlight.combo}x`;
    try {
      await Share.share({ message: line });
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    const refreshDesktopMode = () => {
      keyboardEnabled.current =
        window.innerWidth >= DESKTOP_MIN_WIDTH && window.innerHeight >= DESKTOP_MIN_HEIGHT;
      if (!keyboardEnabled.current) {
        pressedKeys.current.clear();
        keyInput.current = { dx: 0, dy: 0 };
      }
    };

    const updateKeyVector = () => {
      const keys = pressedKeys.current;
      const left = keys.has('arrowleft') || keys.has('a');
      const right = keys.has('arrowright') || keys.has('d');
      const up = keys.has('arrowup') || keys.has('w');
      const down = keys.has('arrowdown') || keys.has('s');
      const rawDx = (right ? 1 : 0) - (left ? 1 : 0);
      const rawDy = (down ? 1 : 0) - (up ? 1 : 0);
      const mag = Math.hypot(rawDx, rawDy);
      if (mag > 0) {
        keyInput.current = { dx: rawDx / mag, dy: rawDy / mag };
      } else {
        keyInput.current = { dx: 0, dy: 0 };
      }
    };

    const onKeyDown = (evt) => {
      if (!keyboardEnabled.current) return;
      const key = String(evt.key || '').toLowerCase();
      if (['j', 'k', 'l', ';'].includes(key)) {
        evt.preventDefault();
        if (evt.repeat) return;
        if (key === 'j') abilityHotkeysRef.current.dash();
        if (key === 'k') abilityHotkeysRef.current.pulse();
        if (key === 'l') abilityHotkeysRef.current.drone();
        if (key === ';') abilityHotkeysRef.current.quantum();
        return;
      }
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) return;
      evt.preventDefault();
      pressedKeys.current.add(key);
      updateKeyVector();
    };

    const onKeyUp = (evt) => {
      const key = String(evt.key || '').toLowerCase();
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) return;
      evt.preventDefault();
      pressedKeys.current.delete(key);
      updateKeyVector();
    };
    const onBlur = () => {
      pressedKeys.current.clear();
      keyInput.current = { dx: 0, dy: 0 };
    };

    refreshDesktopMode();
    window.addEventListener('resize', refreshDesktopMode);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('resize', refreshDesktopMode);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    setBattleBgCrop(pickBattleBgCrop());
    isRunning.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const baseWaves = galaxy?.waves ?? 4;
    const extraWaves = Math.min(4, Math.floor((systemNumber - 1) / 12));
    const maxWaves = baseWaves + extraWaves;
    const runUpgradeThresholds = getUpgradeThresholdsForRun({
      threat: galaxy?.threat ?? 1,
      systemNumber,
      maxWaves,
    });

    const player = createPlayer();
    player.x = BATTLE_WORLD.width / 2;
    player.y = BATTLE_WORLD.height / 2;
    basePlayerDamageRef.current = player.damage;
    const abilities = createAbilities();
    applyMetaUpgrades(player, abilities, metaUpgrades);

    G.current = {
      world: BATTLE_WORLD,
      player,
      abilities,
      enemies: [],
      particles: [],
      dashTrail: [],
      score: 0,
      combo: 0,
      totalDamageDealt: 0,
      lastKillTime: 0,
      resources: 0,
      screenShake: 0,
      gameStartTime: Date.now(),
      lastSpawnTime: 0,
      gameTime: 0,
      galaxy,
      currentWave: 1,
      maxWaves,
      waveSpawnRemaining: getWaveEnemyCount(1, galaxy),
      nextWaveSpawnAt: Date.now() + 500,
      nextShopWave: randomShopInterval(),
      upgradeThresholds: runUpgradeThresholds,
      lastWeaponActiveAt: 0,
      cameraX: Math.max(0, player.x - SCREEN.width / 2),
      cameraY: Math.max(0, player.y - SCREEN.height / 2),
      quantumPickup: null,
      nextQuantumSpawnAt: Date.now() + 12000,
      quantumTrails: [],
      damageNumbers: [],
      victory: false,
      photons: [],
      gravityWells: [],
      nextGravityWellAt: Date.now() + 4500,
      meteors: [],
      nextMeteorAt: Date.now() + 6000,
      meteorStormUntil: 0,
      inIntercept: Math.random() < 0.65,
      interceptEndsAt: 0,
      nextInterceptHazardAt: 0,
      nextMutationAt: Date.now() + 32000,
      phaseLabel: 'SYSTEM BATTLE',
      latestHighlight: null,
      perfectDodges: 0,
      chainReactionKills: 0,
      lastStand: { active: false, damageMult: 1.5, speedMult: 1.22 },
      flagshipEscape: {
        active: false,
        countdownMs: 3000,
        blastRadius: 24,
        blastGrowth: 460,
        centerX: BATTLE_WORLD.width * 0.5,
        centerY: BATTLE_WORLD.height * 0.5,
      },
    };
    if (G.current.inIntercept) {
      G.current.interceptEndsAt = Date.now() + (20000 + Math.random() * 25000);
      G.current.nextInterceptHazardAt = Date.now() + 800;
      G.current.phaseLabel = 'LIGHTSPEED INTERCEPT';
    }

    joystick.current = { dx: 0, dy: 0 };
    upgradeQueue.current = [];
    nextThresholdIdx.current = 0;
    isPaused.current = false;
    peakComboRef.current = 0;
    abilityUsageRef.current = { dash: 0, pulse: 0, drone: 0, phase: 0 };
    lastTs.current = null;
    isRunning.current = true;

    const loop = (ts) => {
      if (!isRunning.current) return;

      const g = G.current;
      if (!g) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (lastTs.current === null) lastTs.current = ts;
      const dt = Math.min(ts - lastTs.current, 50);
      lastTs.current = ts;

      if (isPaused.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      g.gameTime += dt / 1000;
      const dtSec = dt / 1000;
      const nowMs = Date.now();

      if (g.player.hp > 0 && g.player.hp / Math.max(1, g.player.maxHp) <= 0.2) {
        if (!g.lastStand.active) pushHighlight(g, 'LAST STAND ONLINE');
        g.lastStand.active = true;
      } else {
        g.lastStand.active = false;
      }
      g.player.damage = basePlayerDamageRef.current * (g.lastStand.active ? g.lastStand.damageMult : 1);

      if (nowMs >= (g.nextMutationAt || 0)) {
        const roll = Math.random();
        if (roll < 0.34) {
          g.player.damageMultiplier = (g.player.damageMultiplier || 1) + 0.18;
          g.phaseLabel = 'MUTATION: WEAPON SPIKE';
        } else if (roll < 0.67) {
          g.player.attackRange += 10;
          g.phaseLabel = 'MUTATION: RANGE BOOST';
        } else {
          g.player.speed += 28;
          g.phaseLabel = 'MUTATION: ENGINE OVERCLOCK';
        }
        g.nextMutationAt = nowMs + 36000 + Math.random() * 22000;
        pushHighlight(g, 'MUTATION UPGRADE');
      }

      if (nowMs >= (g.nextGravityWellAt || 0) && g.gravityWells.length < GRAVITY_WELL_MAX) {
        g.gravityWells.push({
          id: `gw-${Date.now()}-${Math.random()}`,
          x: 120 + Math.random() * (g.world.width - 240),
          y: 120 + Math.random() * (g.world.height - 240),
          radius: 170 + Math.random() * 60,
          strength: 520 + Math.random() * 240,
          lifeMs: 10500 + Math.random() * 2500,
        });
        g.nextGravityWellAt = nowMs + GRAVITY_WELL_SPAWN_MS + Math.random() * 3000;
      }
      for (const w of g.gravityWells) w.lifeMs -= dt;
      g.gravityWells = g.gravityWells.filter((w) => w.lifeMs > 0);

      if (nowMs >= (g.nextMeteorAt || 0)) {
        g.meteorStormUntil = nowMs + 7000 + Math.random() * 4000;
        g.nextMeteorAt = nowMs + 18000 + Math.random() * 12000;
        g.phaseLabel = 'METEOR STORM';
      }
      if (nowMs < g.meteorStormUntil && Math.random() < 0.24) {
        g.meteors.push({
          id: `m-${nowMs}-${Math.random()}`,
          x: 60 + Math.random() * (g.world.width - 120),
          y: -50,
          vx: -40 + Math.random() * 80,
          vy: 260 + Math.random() * 130,
          size: 10 + Math.random() * 10,
          damage: 20 + Math.random() * 12,
        });
      }
      for (const m of g.meteors) {
        m.x += m.vx * dtSec;
        m.y += m.vy * dtSec;
        for (const e of g.enemies) {
          if (e.dead) continue;
          const dx = e.x - m.x;
          const dy = e.y - m.y;
          if (dx * dx + dy * dy <= (m.size + e.size * 0.5) ** 2) e.hp -= m.damage;
        }
        const pdx = g.player.x - m.x;
        const pdy = g.player.y - m.y;
        if (pdx * pdx + pdy * pdy <= (m.size + 18) ** 2) {
          g.player.hp = Math.max(0, g.player.hp - m.damage * 0.16);
          g.player.shieldRegenDelay = 3000;
          g.player.hitFlash = 8;
        }
      }
      g.meteors = g.meteors.filter((m) => m.y < g.world.height + 80 && m.x > -80 && m.x < g.world.width + 80);

      if (g.inIntercept) {
        if (nowMs >= g.nextInterceptHazardAt) {
          const spawnCount = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < spawnCount; i++) {
            g.enemies.push({
              id: `int-${nowMs}-${i}-${Math.random()}`,
              type: 'elite',
              x: 80 + Math.random() * (g.world.width - 160),
              y: -20,
              vx: 0, vy: 0, facingAngle: 0,
              size: 16, hp: 34, maxHp: 34, speed: 170, damage: 10, score: 32,
              color: '#67F3FF', glow: '#67F3FF', points: 2, dead: false, hitFlash: 0,
              zigZagPhase: Math.random() * Math.PI * 2, zigZagTimer: 0, burstTimer: 0, burstActive: false, burstDuration: 0,
              lastLaserAt: 0, laserFlash: 0, lastPhotonAt: 0, lastSwarmPhotonAt: 0,
            });
          }
          g.nextInterceptHazardAt = nowMs + 700 + Math.random() * 1000;
        }
        if (nowMs >= g.interceptEndsAt) {
          g.inIntercept = false;
          g.phaseLabel = 'SYSTEM BATTLE';
          g.score += 120 + Math.floor(g.combo * 6);
          pushHighlight(g, 'LIGHTSPEED SURVIVAL');
        }
      }

      const keyboardVector = keyInput.current;
      const hasKeyboardInput = Math.abs(keyboardVector.dx) > 0.001 || Math.abs(keyboardVector.dy) > 0.001;
      const movementInput = hasKeyboardInput ? keyboardVector : joystick.current;
      updatePlayer(g, movementInput, dt, g.abilities);
      applyGravityFromWells(g.player, g.gravityWells, dtSec, 0.9);

      g.cameraX = Math.max(0, Math.min(g.world.width - SCREEN.width, g.player.x - SCREEN.width / 2));
      g.cameraY = Math.max(0, Math.min(g.world.height - SCREEN.height, g.player.y - SCREEN.height / 2));

      if (!g.inIntercept && !g.flagshipEscape.active) {
        const spawned = trySpawn(g);
        if (spawned) g.enemies.push(...spawned);
      }

      updateEnemyMovement(g, dt);
      for (const e of g.enemies) applyGravityFromWells(e, g.gravityWells, dtSec, 0.65);

      if (hasActiveWeapon(g.abilities)) {
        g.lastWeaponActiveAt = Date.now();
      }

      const prevShake = g.screenShake;
      runCombatFrame(g, dt);
      for (const ph of g.photons || []) applyGravityFromWells(ph, g.gravityWells, dtSec, 0.55);
      if (g.screenShake > prevShake + 1) {
        applyShake(g.screenShake);
      }

      if (g.combo > peakComboRef.current) peakComboRef.current = g.combo;
      if (g.combo >= 20 && (!g.lastComboHighlightAt || nowMs - g.lastComboHighlightAt > 12000)) {
        g.lastComboHighlightAt = nowMs;
        pushHighlight(g, 'MASSIVE COMBO', { combo: g.combo });
      }
      if (g.player.hp > 0 && g.player.hp / Math.max(1, g.player.maxHp) <= 0.14 && (!g.lastNearDeathAt || nowMs - g.lastNearDeathAt > 10000)) {
        g.lastNearDeathAt = nowMs;
        pushHighlight(g, 'NEAR DEATH SURVIVAL');
      }

      if (!g.abilities.quantum.unlocked && !g.quantumPickup && Date.now() >= g.nextQuantumSpawnAt) {
        g.quantumPickup = {
          id: `q-${Date.now()}`,
          x: 80 + Math.random() * (g.world.width - 160),
          y: 80 + Math.random() * (g.world.height - 160),
          radius: 22,
        };
      }

      if (g.quantumPickup) {
        const dx = g.player.x - g.quantumPickup.x;
        const dy = g.player.y - g.quantumPickup.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= PLAYER_PICKUP_RADIUS) {
          g.abilities.quantum.unlocked = true;
          g.quantumPickup = null;
          g.nextQuantumSpawnAt = Date.now() + 60000;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }

      for (const t of g.quantumTrails) t.life -= dt;
      g.quantumTrails = g.quantumTrails.filter((t) => t.life > 0);
      for (const n of g.damageNumbers) {
        n.life -= dt;
        n.y += n.vy * dt;
      }
      g.damageNumbers = g.damageNumbers.filter((n) => n.life > 0);

      const thresholds = g.upgradeThresholds || [];
      while (
        nextThresholdIdx.current < thresholds.length &&
        g.score >= thresholds[nextThresholdIdx.current]
      ) {
        upgradeQueue.current.push(pickUpgradeChoices());
        nextThresholdIdx.current++;
      }

      const weaponSequenceComplete =
        !hasActiveWeapon(g.abilities) &&
        Date.now() - (g.lastWeaponActiveAt || 0) >= ENHANCEMENT_SETTLE_MS;

      if (upgradeQueue.current.length > 0 && weaponSequenceComplete) {
        const choices = upgradeQueue.current.shift();
        isPaused.current = true;
        setUiState((prev) => ({
          ...prev,
          showUpgrade: true,
          upgradeChoices: choices,
          score: g.score,
          peakCombo: peakComboRef.current,
          currentWave: g.currentWave,
          maxWaves: g.maxWaves,
          waveRemaining: g.waveSpawnRemaining + g.enemies.length,
        }));
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (g.player.hp <= 0) {
        isRunning.current = false;
        g.player.hp = 0;
        setUiState((prev) => ({
          ...prev,
          isDead: true,
          playerHp: 0,
          score: g.score,
          gameTime: g.gameTime,
          peakCombo: peakComboRef.current,
        }));
        return;
      }

      if (g.flagshipEscape.active) {
        g.phaseLabel = g.flagshipEscape.countdownMs > 0 ? 'FLAGSHIP CORE CRITICAL' : 'ESCAPE THE BLAST';
        if (g.flagshipEscape.countdownMs > 0) {
          g.flagshipEscape.countdownMs = Math.max(0, g.flagshipEscape.countdownMs - dt);
        } else {
          g.flagshipEscape.blastRadius += g.flagshipEscape.blastGrowth * dtSec;
          const dx = g.player.x - g.flagshipEscape.centerX;
          const dy = g.player.y - g.flagshipEscape.centerY;
          const distFromBlast = Math.sqrt(dx * dx + dy * dy);
          if (distFromBlast <= g.flagshipEscape.blastRadius + 16) {
            g.player.hp = 0;
          } else if (g.flagshipEscape.blastRadius >= Math.min(g.world.width, g.world.height) * 0.56) {
            g.victory = true;
            isRunning.current = false;
            g.score += 400;
            pushHighlight(g, 'CLOSE ESCAPE', { blastRadius: Math.round(g.flagshipEscape.blastRadius) });
          }
        }
      }

      const waveRemaining = g.waveSpawnRemaining + g.enemies.length;
      if (waveRemaining <= 0 && !g.victory) {
        if (g.currentWave < g.maxWaves) {
          const clearedWave = g.currentWave;
          const shouldOpenShop = clearedWave >= g.nextShopWave;
          g.currentWave += 1;
          g.waveSpawnRemaining = getWaveEnemyCount(g.currentWave, galaxy);
          g.nextWaveSpawnAt = Date.now() + (shouldOpenShop ? 350 : 900);

          if (shouldOpenShop) {
            g.nextShopWave = clearedWave + randomShopInterval();
            isPaused.current = true;
            const offers = pickShopOffers({
              count: 3,
              systemNumber,
              threat: galaxy?.threat ?? 1,
              currentWave: g.currentWave,
              guaranteeWeaponSlot: true,
            });
            setUiState((prev) => ({
              ...prev,
              showShop: true,
              shopOffers: offers,
              score: g.score,
              currentWave: g.currentWave,
              maxWaves: g.maxWaves,
              waveRemaining: g.waveSpawnRemaining + g.enemies.length,
            }));
            rafRef.current = requestAnimationFrame(loop);
            return;
          }
        } else if (!g.flagshipEscape.active) {
          g.flagshipEscape.active = true;
          g.flagshipEscape.countdownMs = 3000;
          g.flagshipEscape.blastRadius = 24;
          g.flagshipEscape.centerX = g.player.x;
          g.flagshipEscape.centerY = g.player.y;
          g.world.width = Math.round(g.world.width * 1.24);
          g.world.height = Math.round(g.world.height * 1.24);
          g.player.x += 40;
          g.player.y += 40;
          g.phaseLabel = 'FLAGSHIP CORE CRITICAL';
          pushHighlight(g, 'FLAGSHIP DESTROYED');
        }
      }

      const remainingNow = g.waveSpawnRemaining + g.enemies.length;
      const toScreen = (x, y) => ({ x: x - g.cameraX, y: y - g.cameraY });

      setUiState({
        playerHp: g.player.hp,
        playerMaxHp: g.player.maxHp,
        playerShield: g.player.shield,
        playerMaxShield: g.player.maxShield,
        playerX: g.player.x - g.cameraX,
        playerY: g.player.y - g.cameraY,
        playerHitFlash: g.player.hitFlash,
        playerAttackFlash: g.player.attackFlash,
        playerFacingAngle: g.player.facingAngle ?? 0,
        playerMoving: Math.hypot(g.player.vx || 0, g.player.vy || 0) > 8,
        cameraX: g.cameraX,
        cameraY: g.cameraY,
        dashActive: g.abilities.dash.active,
        score: g.score,
        combo: g.combo,
        totalDamage: g.totalDamageDealt || 0,
        peakCombo: peakComboRef.current,
        abilities: snapshotAbilities(g.abilities),
        enemies: g.enemies.map((e) => {
          const s = toScreen(e.x, e.y);
          return { ...e, x: s.x, y: s.y, gameTime: g.gameTime };
        }),
        particles: g.particles.map((p) => {
          const s = toScreen(p.x, p.y);
          return { ...p, x: s.x, y: s.y };
        }),
        dashTrail: g.dashTrail.map((t) => {
          const s = toScreen(t.x, t.y);
          return { ...t, x: s.x, y: s.y };
        }),
        pulseActive: g.abilities.pulse.active,
        pulseElapsed: g.abilities.pulse.elapsed,
        dronePositions: g.abilities.drone.positions
          ? g.abilities.drone.positions.map((p) => {
              const s = toScreen(p.x, p.y);
              return { ...p, x: s.x, y: s.y };
            })
          : [],
        droneActive: g.abilities.drone.active,
        attackRange: g.player.attackRange,
        time: ts / 1000,
        gameTime: g.gameTime,
        isDead: false,
        isVictory: g.victory,
        showUpgrade: false,
        upgradeChoices: [],
        showShop: false,
        shopOffers: [],
        currentWave: g.currentWave,
        maxWaves: g.maxWaves,
        waveRemaining: remainingNow,
        quantumPickup: g.quantumPickup
          ? {
              x: g.quantumPickup.x - g.cameraX,
              y: g.quantumPickup.y - g.cameraY,
              active: true,
            }
          : null,
        quantumTrails: g.quantumTrails.map((tr) => ({
          id: tr.id,
          fromX: tr.fromX - g.cameraX,
          fromY: tr.fromY - g.cameraY,
          toX: tr.toX - g.cameraX,
          toY: tr.toY - g.cameraY,
          opacity: tr.life / tr.maxLife,
        })),
        damageNumbers: g.damageNumbers.map((n) => ({
          id: n.id,
          x: n.x - g.cameraX,
          y: n.y - g.cameraY,
          value: n.value,
          opacity: n.life / n.maxLife,
        })),
        photons: (g.photons || []).map((ph) => ({
          ...ph,
          x: ph.x - g.cameraX,
          y: ph.y - g.cameraY,
        })),
        gravityWells: (g.gravityWells || []).map((w) => ({
          ...w,
          x: w.x - g.cameraX,
          y: w.y - g.cameraY,
        })),
        meteors: (g.meteors || []).map((m) => ({
          ...m,
          x: m.x - g.cameraX,
          y: m.y - g.cameraY,
        })),
        phaseLabel: g.phaseLabel,
        phaseTimer: g.inIntercept ? Math.max(0, (g.interceptEndsAt - Date.now()) / 1000) : 0,
        eventBanner: g.inIntercept ? 'Warp tunnel combat active' : '',
        perfectDodges: g.perfectDodges || 0,
        latestHighlight: g.latestHighlight || null,
        flagshipEscape: g.flagshipEscape.active
          ? {
              countdownMs: g.flagshipEscape.countdownMs,
              blastRadius: g.flagshipEscape.blastRadius,
              x: g.flagshipEscape.centerX - g.cameraX,
              y: g.flagshipEscape.centerY - g.cameraY,
            }
          : null,
      });

      if (g.victory) return;
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameKey, galaxy, systemNumber, metaUpgrades, applyShake]);

  const handleJoystick = useCallback((delta) => {
    joystick.current = delta;
  }, []);

  const handleDash = useCallback(() => {
    const g = G.current;
    if (!g || g.victory) return;
    triggerDash(g.player, g.abilities);
    abilityUsageRef.current.dash += 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const handlePulse = useCallback(() => {
    const g = G.current;
    if (!g || g.victory) return;
    triggerPulse(g.player, g.abilities);
    abilityUsageRef.current.pulse += 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  const handleDrone = useCallback(() => {
    const g = G.current;
    if (!g || g.victory) return;
    triggerDrone(g.player, g.abilities);
    abilityUsageRef.current.drone += 1;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const handleQuantum = useCallback(() => {
    const g = G.current;
    if (!g || g.victory) return;
    triggerQuantumSlash(g.player, g.abilities);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  }, []);

  const handlePhase = useCallback(() => {
    const g = G.current;
    if (!g || g.victory) return;
    triggerPhaseSwap(g.player, g.abilities);
    abilityUsageRef.current.phase += 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  useEffect(() => {
    abilityHotkeysRef.current = {
      dash: handleDash,
      pulse: handlePulse,
      drone: handleDrone,
      quantum: handleQuantum,
    };
  }, [handleDash, handlePulse, handleDrone, handleQuantum]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const g = G.current;
        return !!g?.abilities?.quantum?.active;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const g = G.current;
        return !!g?.abilities?.quantum?.active && (Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 4);
      },
      onPanResponderGrant: (evt) => {
        const g = G.current;
        if (!g?.abilities?.quantum?.active) return;
        const { locationX, locationY } = evt.nativeEvent;
        g.abilities.quantum.lastSwipePoint = {
          x: locationX + g.cameraX,
          y: locationY + g.cameraY,
        };
      },
      onPanResponderMove: (evt) => {
        const g = G.current;
        if (!g?.abilities?.quantum?.active) return;
        const { locationX, locationY } = evt.nativeEvent;
        const curr = { x: locationX + g.cameraX, y: locationY + g.cameraY };
        const prev = g.abilities.quantum.lastSwipePoint || curr;
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        if (dx * dx + dy * dy < 90) return;
        applyQuantumSlashSwipe(g, prev, curr);
        g.quantumTrails.push({
          id: `${Date.now()}-${Math.random()}`,
          fromX: prev.x,
          fromY: prev.y,
          toX: curr.x,
          toY: curr.y,
          life: 220,
          maxLife: 220,
        });
        g.abilities.quantum.lastSwipePoint = curr;
      },
      onPanResponderRelease: () => {
        const g = G.current;
        if (g?.abilities?.quantum) g.abilities.quantum.lastSwipePoint = null;
      },
      onPanResponderTerminate: () => {
        const g = G.current;
        if (g?.abilities?.quantum) g.abilities.quantum.lastSwipePoint = null;
      },
    })
  ).current;

  const handleUpgradeSelect = useCallback((upgradeId) => {
    const g = G.current;
    if (!g) return;
    applyUpgrade(upgradeId, g.player, g.abilities);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    isPaused.current = false;
    setUiState((prev) => ({ ...prev, showUpgrade: false, upgradeChoices: [] }));
  }, []);

  const handleShopBuy = useCallback((offerId) => {
    const g = G.current;
    if (!g) return;
    const selected = uiState.shopOffers.find((o) => o.id === offerId);
    if (!selected || g.score < selected.price) return;

    g.score -= selected.price;
    applyShopOffer(offerId, g.player, g.abilities);
    isPaused.current = false;
    setUiState((prev) => ({
      ...prev,
      showShop: false,
      shopOffers: [],
      score: g.score,
    }));
    Haptics.selectionAsync().catch(() => {});
  }, [uiState.shopOffers]);

  const handleShopSkip = useCallback(() => {
    isPaused.current = false;
    setUiState((prev) => ({ ...prev, showShop: false, shopOffers: [] }));
  }, []);

  const handleRestart = useCallback(() => {
    setUiState(makeUiState());
    setGameKey((k) => k + 1);
  }, []);

  const {
    playerHp,
    playerMaxHp,
    playerShield,
    playerMaxShield,
    photons,
    playerX,
    playerY,
    playerHitFlash,
    playerAttackFlash,
    playerFacingAngle,
    playerMoving,
    cameraX,
    cameraY,
    dashActive,
    score,
    combo,
    totalDamage,
    peakCombo,
    abilities,
    enemies,
    particles,
    dashTrail,
    pulseActive,
    pulseElapsed,
    dronePositions,
    droneActive,
    attackRange,
    time,
    gameTime,
    isDead,
    isVictory,
    showUpgrade,
    upgradeChoices,
    showShop,
    shopOffers,
    currentWave,
    maxWaves,
    waveRemaining,
    quantumPickup,
    quantumTrails,
    damageNumbers,
    gravityWells,
    meteors,
    phaseLabel,
    phaseTimer,
    eventBanner,
    perfectDodges,
    latestHighlight,
    flagshipEscape,
  } = uiState;

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, { transform: [{ translateX: shakeX }, { translateY: shakeY }] }]}>
        <View style={styles.bg} pointerEvents="none">
          <Image
            source={BATTLE_BACKGROUND_IMAGE}
            resizeMode="cover"
            style={[
              styles.battleBackdrop,
              {
                width: SCREEN.width * battleBgCrop.scale,
                height: SCREEN.height * battleBgCrop.scale,
                transform: [
                  {
                    translateX:
                      -battleBgCrop.offsetX -
                      ((cameraX / Math.max(1, BATTLE_WORLD.width - SCREEN.width)) *
                        (SCREEN.width * (battleBgCrop.scale - 1))) *
                        BG_PARALLAX,
                  },
                  {
                    translateY:
                      -battleBgCrop.offsetY -
                      ((cameraY / Math.max(1, BATTLE_WORLD.height - SCREEN.height)) *
                        (SCREEN.height * (battleBgCrop.scale - 1))) *
                        BG_PARALLAX,
                  },
                ],
              },
            ]}
          />
          <View style={styles.gridH1} />
          <View style={styles.gridH2} />
          <View style={styles.gridV1} />
          <View style={styles.gridV2} />
          <View style={styles.gridV3} />
          <StarField time={time} cameraX={cameraX} cameraY={cameraY} />
        </View>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <DashTrail trail={dashTrail} />
          <QuantumSwipeTrail trail={quantumTrails} />
          <DamageNumbers numbers={damageNumbers} />
          <AttackRangeIndicator x={playerX} y={playerY} range={attackRange} />
          <QuantumPickup x={quantumPickup?.x || 0} y={quantumPickup?.y || 0} active={!!quantumPickup?.active} />
          {gravityWells.map((w) => (
            <GravityWellView key={w.id} well={w} time={time} />
          ))}
          {meteors.map((m) => (
            <MeteorView key={m.id} meteor={m} />
          ))}
          {flagshipEscape && (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: flagshipEscape.x - flagshipEscape.blastRadius * 1.18,
                  top: flagshipEscape.y - flagshipEscape.blastRadius * 1.18,
                  width: flagshipEscape.blastRadius * 2.36,
                  height: flagshipEscape.blastRadius * 2.36,
                  borderRadius: flagshipEscape.blastRadius * 1.18,
                  borderWidth: 2,
                  borderColor: 'rgba(255,66,150,0.78)',
                  backgroundColor: 'rgba(255,80,210,0.08)',
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: flagshipEscape.x - flagshipEscape.blastRadius,
                  top: flagshipEscape.y - flagshipEscape.blastRadius,
                  width: flagshipEscape.blastRadius * 2,
                  height: flagshipEscape.blastRadius * 2,
                  borderRadius: flagshipEscape.blastRadius,
                  borderWidth: 2.5,
                  borderColor: 'rgba(255,142,54,0.9)',
                  backgroundColor: 'rgba(255,170,66,0.12)',
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: flagshipEscape.x - flagshipEscape.blastRadius * 0.72,
                  top: flagshipEscape.y - flagshipEscape.blastRadius * 0.72,
                  width: flagshipEscape.blastRadius * 1.44,
                  height: flagshipEscape.blastRadius * 1.44,
                  borderRadius: flagshipEscape.blastRadius * 0.72,
                  borderWidth: 1.5,
                  borderColor: 'rgba(117,246,255,0.88)',
                  backgroundColor: 'rgba(117,246,255,0.1)',
                }}
              />
            </>
          )}
          {enemies.map((e) => e.laserFlash > 0 && (
            <EnemyLaserBeam
              key={`lb-${e.id}`}
              x1={e.x} y1={e.y}
              x2={playerX} y2={playerY}
              alpha={e.laserFlash / 80}
              color={e.glow || e.color || '#FF4F62'}
            />
          ))}
          {enemies.map((e) => (
            <EnemyShip key={e.id} enemy={e} />
          ))}
          {particles.map((p) => (
            <Particle key={p.id} p={p} />
          ))}
          {photons.map((ph) => (
            <PhotonBall key={ph.id} photon={ph} />
          ))}
          <PulseRing x={playerX} y={playerY} active={pulseActive} elapsed={pulseElapsed} />
          <DroneOrbit positions={dronePositions} active={droneActive} />
          <PlayerShip
            x={playerX}
            y={playerY}
            hitFlash={playerHitFlash}
            attackFlash={playerAttackFlash}
            facingAngle={playerFacingAngle}
            dashActive={dashActive}
            isMoving={playerMoving}
            time={time}
          />
        </View>

        {abilities && !isDead && !isVictory && !showShop && (
          <HUD
            playerHp={playerHp}
            playerMaxHp={playerMaxHp}
            playerShield={playerShield}
            playerMaxShield={playerMaxShield}
            score={score}
            totalDamage={totalDamage}
            combo={combo}
            abilities={abilities}
            onDash={handleDash}
            onPulse={handlePulse}
            onDrone={handleDrone}
            onQuantum={handleQuantum}
            onPhase={handlePhase}
            gameTime={gameTime}
            currentWave={currentWave}
            maxWaves={maxWaves}
            waveRemaining={waveRemaining}
          />
        )}

        {!isDead && !isVictory && (
          <View style={styles.phaseHeader} pointerEvents="none">
            <Text style={styles.phaseHeaderText}>
              {phaseLabel}{phaseTimer > 0 ? ` • ${phaseTimer.toFixed(1)}s` : ''}
            </Text>
            {!!eventBanner && <Text style={styles.phaseBannerText}>{eventBanner}</Text>}
            <Text style={styles.phaseMetaText}>Perfect Dodges: {perfectDodges}</Text>
            {!!flagshipEscape && flagshipEscape.countdownMs > 0 && (
              <Text style={styles.phaseWarningText}>CORE DETONATION IN {(flagshipEscape.countdownMs / 1000).toFixed(1)}s</Text>
            )}
          </View>
        )}

        {!!latestHighlight && !isDead && (
          <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85} onPress={() => shareHighlight(latestHighlight)}>
            <Text style={styles.shareBtnText}>SHARE CLIP MOMENT: {latestHighlight.type}</Text>
          </TouchableOpacity>
        )}

        {abilities?.quantum?.active && (
          <View
            style={styles.quantumSlashLayer}
            {...panResponder.panHandlers}
          />
        )}
        {abilities?.phase?.active && !abilities?.quantum?.active && (
          <View pointerEvents="none" style={styles.phaseShiftLayer} />
        )}

        {!isDead && !isVictory && !showUpgrade && !showShop && (
          <View style={styles.controls}>
            <VirtualJoystick onMove={handleJoystick} />
          </View>
        )}

        {showUpgrade && (
          <UpgradeScreen choices={upgradeChoices} score={score} onSelect={handleUpgradeSelect} />
        )}

        {showShop && (
          <ShopScreen
            wave={currentWave - 1}
            score={score}
            offers={shopOffers}
            onBuy={handleShopBuy}
            onSkip={handleShopSkip}
          />
        )}

        {isDead && (
          <GameOver score={score} combo={peakCombo} gameTime={gameTime} onRestart={handleRestart} />
        )}

        {isVictory && (
          <View style={styles.victoryOverlay}>
            <Text style={styles.victoryTitle}>SYSTEM SECURED</Text>
            <Text style={styles.victorySub}>
              {(galaxy?.name?.toUpperCase() || 'SECTOR') + ` | SYSTEM ${systemNumber}`}
            </Text>
            <Text style={styles.victoryMeta}>Score {score.toLocaleString()} | Peak Combo {peakCombo}x</Text>
            <TouchableOpacity
              style={styles.victoryBtn}
              activeOpacity={0.8}
              onPress={() =>
                onSystemComplete?.(galaxy?.id, {
                  score,
                  waves: maxWaves,
                  systemNumber,
                  abilityUsage: { ...abilityUsageRef.current },
                })
              }
            >
              <Text style={styles.victoryBtnText}>CONFIRM SYSTEM VICTORY</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuBtn} activeOpacity={0.8} onPress={onMainMenu}>
              <Text style={styles.menuBtnText}>MAIN MENU</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  battleBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.45,
  },
  gridH1: {
    position: 'absolute',
    top: SCREEN.height * 0.33,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(79,165,255,0.12)',
  },
  gridH2: {
    position: 'absolute',
    top: SCREEN.height * 0.66,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(79,165,255,0.12)',
  },
  gridV1: {
    position: 'absolute',
    left: SCREEN.width * 0.33,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(79,165,255,0.1)',
  },
  gridV2: {
    position: 'absolute',
    left: SCREEN.width * 0.5,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(79,165,255,0.07)',
  },
  gridV3: {
    position: 'absolute',
    left: SCREEN.width * 0.66,
    top: 0,
    bottom: 0,
    width: 0.5,
    backgroundColor: 'rgba(79,165,255,0.1)',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 16,
  },
  phaseHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 210,
  },
  phaseHeaderText: {
    color: '#A9F3FF',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    textShadowColor: '#67F3FF',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  phaseBannerText: {
    marginTop: 2,
    color: 'rgba(176,207,236,0.86)',
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 1,
  },
  phaseMetaText: {
    marginTop: 1,
    color: 'rgba(255,214,153,0.92)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  phaseWarningText: {
    marginTop: 2,
    color: '#FF7D6E',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
  shareBtn: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    borderWidth: 1,
    borderColor: '#67F3FF',
    backgroundColor: 'rgba(4,22,36,0.82)',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    zIndex: 230,
  },
  shareBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  quantumSlashLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 220,
    backgroundColor: 'rgba(74,168,255,0.06)',
  },
  phaseShiftLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    backgroundColor: 'rgba(132,212,255,0.08)',
  },
  victoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5,10,18,0.92)',
    paddingHorizontal: 20,
    zIndex: 250,
  },
  victoryTitle: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 28,
    letterSpacing: 3,
    textShadowColor: '#67F3FF',
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  victorySub: {
    marginTop: 10,
    color: 'rgba(176,207,236,0.88)',
    fontFamily: 'Courier New',
    fontSize: 12,
    letterSpacing: 2,
    textAlign: 'center',
  },
  victoryMeta: {
    marginTop: 10,
    color: 'rgba(127,242,255,0.8)',
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
  },
  victoryBtn: {
    marginTop: 28,
    borderWidth: 1.5,
    borderColor: '#67F3FF',
    backgroundColor: 'rgba(103,243,255,0.12)',
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  victoryBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  menuBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(170,192,220,0.55)',
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  menuBtnText: {
    color: 'rgba(202,219,242,0.8)',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
