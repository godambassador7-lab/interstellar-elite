// src/screens/StationDefenseScreen.js

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { SCREEN } from '../utils/constants';
const SPACE_STATION_SPRITE = require('../../space station.png');
const FLAGSHIP_SPRITES = {
  heavy: require('../../Flag ship/flag ship 1.png'),
  elite: require('../../Flag ship/flagship 2.png'),
  bomber: require('../../Flag ship/flagship 3.png'),
};
const SCRAP_BOX_SPRITES = [
  require('../../Scrap Boxes/scrap 1.png'),
  require('../../Scrap Boxes/scrap 2.png'),
  require('../../Scrap Boxes/scrap 3.png'),
  require('../../Scrap Boxes/scrap 4.png'),
  require('../../Scrap Boxes/scrap 5.png'),
  require('../../Scrap Boxes/scrap 6.png'),
];

// ─── Layout ─────────────────────────────────────────────────────────
const CX = SCREEN.width / 2;
const CY = SCREEN.height / 2 - 30;
const STATION_RADIUS = 28;

// ─── Station HP by defense_matrix level (0-3) ───────────────────────
const STATION_MAX_HP   = [200, 280, 380, 500];

// ─── Turret by offense_grid level (0-3) ─────────────────────────────
const TURRET_DAMAGE    = [25, 35,  50,  70 ];
const TURRET_RATE_MS   = [1800, 1400, 1100, 850];
const TURRET_ORBIT_R   = 52;

// ─── Tactical core → fire rate multiplier ───────────────────────────
const CORE_RATE_MULT   = [1.0, 0.85, 0.72, 0.60];

// ─── Missile ────────────────────────────────────────────────────────
const MISSILE_BASE_DMG     = 80;
const MISSILE_BASE_AOE_R   = 60;
const MISSILE_COOLDOWN_MS  = 8000;
const MISSILE_SPEED        = 340;
const SUPPORT_DMG_BONUS    = [0, 20, 40, 60];

// ─── Fighters ───────────────────────────────────────────────────────
const FIGHTER_COOLDOWN_MS  = 12000;
const FIGHTER_DURATION_MS  = 20000;
const FIGHTER_ORBIT_R      = 82;
const FIGHTER_DAMAGE       = 18;
const FIGHTER_RATE_MS      = 1100;
const FIGHTER_BASE_COUNT   = 2;

// ─── Mines ──────────────────────────────────────────────────────────
const MINE_DAMAGE          = 55;
const MINE_AOE_R           = 65;
const MINE_START_COUNT     = 3;

// ─── Power-ups ──────────────────────────────────────────────────────
const POWERUP_TYPES  = ['repair', 'shield', 'ammo', 'nanobots'];
const POWERUP_COLORS = { repair: '#44FF88', shield: '#52D8FF', ammo: '#FFC13A', nanobots: '#CC44FF' };
const PART_TYPE_COLORS = { mech: '#A8B6FF', plasma: '#FF8A6B', void: '#B46CFF', bio: '#44FF88' };
const PART_LABELS = { mech: 'MECH', plasma: 'PLASMA', void: 'VOID', bio: 'BIO' };

const DOCTRINE_CONFIG = {
  fortress: {
    stationHpMult: 1.22,
    turretDamageMult: 1.05,
    turretRateMult: 1.0,
    fighterRateMult: 1,
    mineDamageMult: 1,
    salvageMult: 0.9,
    extraDrones: 0,
    missileCooldownMult: 1,
    regenPerSec: 0.2,
  },
  sniper_grid: {
    stationHpMult: 1.0,
    turretDamageMult: 1.28,
    turretRateMult: 1.12,
    fighterRateMult: 1,
    mineDamageMult: 1,
    salvageMult: 1,
    extraDrones: 0,
    missileCooldownMult: 1,
    regenPerSec: 0,
  },
  swarm_control: {
    stationHpMult: 1.03,
    turretDamageMult: 1,
    turretRateMult: 1,
    fighterRateMult: 0.72,
    mineDamageMult: 1.3,
    salvageMult: 1,
    extraDrones: 0,
    missileCooldownMult: 1,
    regenPerSec: 0,
  },
  scavenger: {
    stationHpMult: 0.95,
    turretDamageMult: 0.96,
    turretRateMult: 1,
    fighterRateMult: 1,
    mineDamageMult: 1,
    salvageMult: 1.55,
    extraDrones: 1,
    missileCooldownMult: 1.08,
    regenPerSec: 0,
  },
};

const HARDPOINT_THRESHOLDS = { mech: 7, plasma: 7, void: 7, bio: 7 };

function getCounterProfile(counterStyle = 'balanced') {
  const profile = {
    hpMult: 1,
    speedMult: 1,
    damageMult: 1,
    spawnBias: {},
  };
  if (counterStyle === 'siege') {
    profile.hpMult = 1.15;
    profile.damageMult = 1.18;
    profile.spawnBias = { heavy: 0.35, bomber: 0.35, swarm: 0.15, elite: 0.15 };
  } else if (counterStyle === 'raider') {
    profile.speedMult = 1.18;
    profile.spawnBias = { elite: 0.35, swarm: 0.35, heavy: 0.2, bomber: 0.1 };
  } else if (counterStyle === 'interceptor') {
    profile.speedMult = 1.12;
    profile.damageMult = 1.08;
    profile.spawnBias = { swarm: 0.45, elite: 0.28, heavy: 0.17, bomber: 0.1 };
  } else if (counterStyle === 'hunter-killer') {
    profile.hpMult = 1.05;
    profile.speedMult = 1.08;
    profile.spawnBias = { elite: 0.32, bomber: 0.24, heavy: 0.22, swarm: 0.22 };
  }
  return profile;
}

// ─── Enemy definitions ───────────────────────────────────────────────
const ENEMY_DEFS = {
  swarm:  { size: 10, baseHp: 20,  speed: 90,  damage: 5,  score: 8,  color: '#2DFFB2', dropChance: 0.10, partYield: 2, partType: 'bio', faction: 'Verdant Swarm', explodes: false },
  heavy:  { size: 22, baseHp: 110, speed: 38,  damage: 22, score: 35, color: '#FF4F62', dropChance: 0.22, partYield: 4, partType: 'mech', faction: 'Aegis Forge', explodes: false },
  elite:  { size: 16, baseHp: 60,  speed: 120, damage: 12, score: 60, color: '#B46CFF', dropChance: 0.18, partYield: 5, partType: 'void', faction: 'Void Phantoms', explodes: false },
  bomber: { size: 18, baseHp: 75,  speed: 55,  damage: 40, score: 50, color: '#FFC13A', dropChance: 0.25, partYield: 4, partType: 'plasma', faction: 'Crimson Corsairs', explodes: true  },
};

// ─── Between-wave upgrade pool ───────────────────────────────────────
const UPGRADE_POOL = [
  { id: 'reinforce_hull',    label: 'REINFORCE HULL',    desc: 'Restore 20% of max station HP' },
  { id: 'overclock_turrets', label: 'OVERCLOCK TURRETS', desc: 'Turret fire rate +25%' },
  { id: 'warhead_extend',    label: 'EXTENDED WARHEADS', desc: 'Missile +20 dmg & +20px AoE' },
  { id: 'sentinel_drone',    label: 'DEPLOY SENTINEL',   desc: 'Adds a 3rd active fighter' },
  { id: 'mine_cache',        label: 'MINE CACHE',        desc: '+2 mines available' },
  { id: 'nanite_repair',     label: 'NANITE REPAIR',     desc: 'Passive regen 2 HP/sec' },
];

// ─── Pure helpers ───────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lvl(obj, key)     { return clamp((obj?.[key] ?? 0), 0, 3); }

function getWaveCount(threat) {
  if (threat < 2) return 3;
  if (threat < 4) return 4;
  if (threat < 6) return 5;
  if (threat < 8) return 6;
  return 8;
}

function getEnemyCountForWave(wave, threat) {
  return clamp(4 + wave * 2 + Math.floor(threat * 1.5), 4, 30);
}

function pickUpgradeChoices() {
  return [...UPGRADE_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
}

function pickEnemyTypeForWave(wave, counterProfile) {
  let typePool;
  if (wave <= 1) typePool = ['swarm', 'swarm', 'swarm', 'heavy'];
  else if (wave <= 3) typePool = ['swarm', 'heavy', 'heavy', 'elite', 'bomber'];
  else typePool = ['swarm', 'heavy', 'elite', 'elite', 'bomber', 'bomber'];

  if (!counterProfile?.spawnBias || !Object.keys(counterProfile.spawnBias).length) {
    return typePool[Math.floor(Math.random() * typePool.length)];
  }

  const bag = [];
  for (const t of typePool) {
    const w = Math.max(1, Math.round((counterProfile.spawnBias[t] || 0.2) * 10));
    for (let i = 0; i < w; i++) bag.push(t);
  }
  return bag[Math.floor(Math.random() * bag.length)] || typePool[Math.floor(Math.random() * typePool.length)];
}

function spawnEnemyOnEdge(id, wave, threat, counterProfile) {
  const type = pickEnemyTypeForWave(wave, counterProfile);
  const def  = ENEMY_DEFS[type];
  const hp   = Math.round(def.baseHp * (1 + threat * 0.1) * (counterProfile?.hpMult || 1));

  const edge = Math.floor(Math.random() * 4);
  const m    = 22;
  let x, y;
  if (edge === 0)      { x = Math.random() * SCREEN.width; y = -m; }
  else if (edge === 1) { x = SCREEN.width + m; y = Math.random() * SCREEN.height; }
  else if (edge === 2) { x = Math.random() * SCREEN.width; y = SCREEN.height + m; }
  else                 { x = -m; y = Math.random() * SCREEN.height; }

  return { id, type, x, y, hp, maxHp: hp, speed: def.speed * (counterProfile?.speedMult || 1), damage: def.damage * (counterProfile?.damageMult || 1),
    size: def.size, color: def.color, dropChance: def.dropChance, explodes: def.explodes,
    score: def.score, partYield: def.partYield || 1, partType: def.partType || 'mech', faction: def.faction || 'Unknown',
    lastHitSource: null, hitFlash: 0 };
}

function damageEnemy(enemy, amount, source = null, hitFlash = 0) {
  if (!enemy || enemy.hp <= 0 || amount <= 0) return;
  enemy.hp -= amount;
  if (source) enemy.lastHitSource = source;
  if (hitFlash > 0) enemy.hitFlash = Math.max(enemy.hitFlash || 0, hitFlash);
}

function ensurePartBag() {
  return { mech: 0, plasma: 0, void: 0, bio: 0 };
}

function spawnWreckage(g, counters, x, y, partType, amount) {
  const dx = x - g.station.x;
  const dy = y - g.station.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const drift = 22 + Math.random() * 26;
  g.wrecks.push({
    id: `wr${counters.current.wr++}`,
    x,
    y,
    vx: (dx / len) * drift + (Math.random() - 0.5) * 10,
    vy: (dy / len) * drift + (Math.random() - 0.5) * 10,
    partType: partType || 'mech',
    amount: Math.max(1, Math.round(amount || 1)),
    life: 8000,
    targetedBy: null,
    spriteIndex: Math.floor(Math.random() * SCRAP_BOX_SPRITES.length),
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.45),
    size: 16 + Math.random() * 8,
  });
}

function syncHardpointBonuses(g) {
  const mechLv = g.hardpoints.mech || 0;
  const plasmaLv = g.hardpoints.plasma || 0;
  const voidLv = g.hardpoints.void || 0;
  const bioLv = g.hardpoints.bio || 0;

  g.hardpointRegen = bioLv * 0.45;
  for (const t of g.turrets) {
    t.damage = g.baseTurretDamage + mechLv * 3;
    t.rateMs = Math.max(320, Math.round(g.baseTurretRateMs * Math.pow(0.965, voidLv)));
  }
  g.missiles.damage = g.baseMissileDamage + plasmaLv * 10;
}

function updateHardpointsFromSalvage(g) {
  for (const key of Object.keys(HARDPOINT_THRESHOLDS)) {
    const lvl = Math.max(0, Math.floor((g.salvageByType[key] || 0) / HARDPOINT_THRESHOLDS[key]));
    g.hardpoints[key] = Math.min(5, lvl);
  }
  syncHardpointBonuses(g);
}

function applyPowerup(type, g) {
  if (type === 'repair') {
    g.station.hp = Math.min(g.station.maxHp, g.station.hp + g.station.maxHp * 0.15);
  } else if (type === 'shield') {
    g.station.shieldActive = true;
    g.station.shieldTimer  = 3000;
  } else if (type === 'ammo') {
    g.missiles.lastFiredAt = Date.now() - g.missiles.cooldownMs;
  } else if (type === 'nanobots') {
    g.activeBuffs.nanobotsTimer = 10000;
  }
}

function applyDefenseUpgrade(id, g) {
  if (id === 'reinforce_hull') {
    g.station.hp = Math.min(g.station.maxHp, g.station.hp + g.station.maxHp * 0.2);
  } else if (id === 'overclock_turrets') {
    g.baseTurretRateMs = Math.round(g.baseTurretRateMs * 0.75);
    syncHardpointBonuses(g);
  } else if (id === 'warhead_extend') {
    g.baseMissileDamage += 20;
    syncHardpointBonuses(g);
    g.missiles.aoeRadius += 20;
  } else if (id === 'sentinel_drone') {
    g.fighters.extraSlot = true;
  } else if (id === 'mine_cache') {
    g.mineCount = Math.min(g.mineCount + 2, 9);
  } else if (id === 'nanite_repair') {
    g.activeBuffs.regenActive = true;
  }
}

function makeGameState(stationUpgrades, territory, doctrine = 'fortress', enemyCounterStyle = 'balanced') {
  const off  = lvl(stationUpgrades, 'offense_grid');
  const def  = lvl(stationUpgrades, 'defense_matrix');
  const core = lvl(stationUpgrades, 'tactical_core');
  const sup  = lvl(stationUpgrades, 'support_wing');
  const doctrineCfg = DOCTRINE_CONFIG[doctrine] || DOCTRINE_CONFIG.fortress;
  const counterProfile = getCounterProfile(enemyCounterStyle);

  const threat   = territory?.threat ?? 2;
  const maxWaves = getWaveCount(threat);
  const maxHp    = Math.round(STATION_MAX_HP[def] * doctrineCfg.stationHpMult);
  const rateMs   = Math.round(TURRET_RATE_MS[off] * CORE_RATE_MULT[core] * doctrineCfg.turretRateMult);
  const turretDamage = Math.round(TURRET_DAMAGE[off] * doctrineCfg.turretDamageMult);
  const missileDamage = Math.round((MISSILE_BASE_DMG + SUPPORT_DMG_BONUS[sup]));
  const droneCount = 2 + doctrineCfg.extraDrones;

  const g = {
    station: { x: CX, y: CY, hp: maxHp, maxHp, hitFlash: 0, shieldActive: false, shieldTimer: 0 },
    turrets: Array.from({ length: 4 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 4;
      return {
        angle, orbitRadius: TURRET_ORBIT_R,
        x: CX + Math.cos(angle) * TURRET_ORBIT_R,
        y: CY + Math.sin(angle) * TURRET_ORBIT_R,
        lastFireAt: 0, rateMs,
        damage:     turretDamage,
        laserFlash: 0, laserTx: CX, laserTy: CY,
      };
    }),
    missiles: {
      cooldownMs:  Math.round(MISSILE_COOLDOWN_MS * doctrineCfg.missileCooldownMult),
      lastFiredAt: -MISSILE_COOLDOWN_MS,
      damage:      missileDamage,
      aoeRadius:   MISSILE_BASE_AOE_R,
    },
    fighters: {
      active: false, positions: [], angles: [], lastFireAt: [],
      cooldownMs: FIGHTER_COOLDOWN_MS, lastDeployAt: 0, expireAt: 0, extraSlot: false,
    },
    traps:      [],
    mineCount:  MINE_START_COUNT,
    enemies:    [],
    projectiles:[],
    wrecks: [],
    salvageDrones: Array.from({ length: droneCount }, (_, i) => ({
      id: `sd${i}`,
      x: CX + Math.cos((Math.PI * 2 * i) / Math.max(1, droneCount)) * (STATION_RADIUS + 18),
      y: CY + Math.sin((Math.PI * 2 * i) / Math.max(1, droneCount)) * (STATION_RADIUS + 18),
      orbitAngle: (Math.PI * 2 * i) / Math.max(1, droneCount),
      state: 'idle',
      targetWreckId: null,
      cargoType: null,
      cargoAmount: 0,
      stunMs: 0,
    })),
    particles:  [],
    powerups:   [],
    activeBuffs:{ nanobotsTimer: 0, regenActive: false },
    currentWave:        1,
    maxWaves,
    waveSpawnRemaining: getEnemyCountForWave(1, threat),
    nextEnemySpawnAt:   Date.now() + 3500,
    nextWaveStartAt:    Date.now() + 3000,
    waveActive:         false,
    score: 0, kills: 0, threat,
    salvageParts: 0,
    salvageByType: ensurePartBag(),
    stationKills: 0,
    hardpoints: ensurePartBag(),
    hardpointRegen: 0,
    doctrine,
    enemyCounterStyle,
    doctrineCfg,
    counterProfile,
    salvageMode: false,
    fighterRateMs: Math.max(380, Math.round(FIGHTER_RATE_MS * doctrineCfg.fighterRateMult)),
    mineDamage: Math.round(MINE_DAMAGE * doctrineCfg.mineDamageMult),
    salvageYieldMult: doctrineCfg.salvageMult || 1,
    baseTurretDamage: turretDamage,
    baseTurretRateMs: rateMs,
    baseMissileDamage: missileDamage,
    basePassiveRegen: doctrineCfg.regenPerSec || 0,
    trapMode: false, gameOver: false, victory: false, time: 0,
  };

  syncHardpointBonuses(g);
  return g;
}

function makeUiState() {
  return {
    stationHp: 200, stationMaxHp: 200, stationHitFlash: 0, shieldActive: false,
    turrets: [], laserBeams: [],
    enemies: [], projectiles: [], particles: [], powerups: [], traps: [],
    wrecks: [], salvageDrones: [],
    fighterActive: false, fighterPositions: [],
    missileFraction: 1, fighterFraction: 1,
    mineCount: MINE_START_COUNT,
    currentWave: 1, maxWaves: 4, waveRemaining: 0,
    score: 0, kills: 0,
    salvageParts: 0, stationKills: 0,
    salvageByType: ensurePartBag(),
    hardpoints: ensurePartBag(),
    doctrine: 'fortress',
    enemyCounterStyle: 'balanced',
    salvageMode: false,
    trapMode: false, showUpgrade: false, upgradeChoices: [],
    gameOver: false, victory: false, waveActive: false,
  };
}

// ─── Render components ───────────────────────────────────────────────

function LaserBeam({ x1, y1, x2, y2, alpha, color }) {
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
        top:  (y1 + y2) / 2 - 1.5,
        width: len, height: 3,
        backgroundColor: color || '#67F3FF',
        opacity: alpha * 0.9,
        borderRadius: 1,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function StationView({ hp, maxHp, hitFlash, shieldActive }) {
  const flash = hitFlash > 0;
  const s     = STATION_RADIUS;
  return (
    <>
      {shieldActive && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: CX - s * 2.4, top: CY - s * 2.4,
            width: s * 4.8, height: s * 4.8, borderRadius: s * 2.4,
            borderWidth: 2, borderColor: '#52D8FF',
            backgroundColor: 'rgba(82,216,255,0.07)',
          }}
        />
      )}
      <Image
        source={SPACE_STATION_SPRITE}
        resizeMode="contain"
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: CX - s * 1.35,
          top: CY - s * 1.35,
          width: s * 2.7,
          height: s * 2.7,
          opacity: flash ? 0.68 : 1,
          tintColor: flash ? '#FF6A7A' : undefined,
        }}
      />
    </>
  );
}

function EnemyView({ enemy }) {
  const { x, y, size, color, hitFlash, hp, maxHp } = enemy;
  const hpFrac = hp / maxHp;
  const flagshipSprite = FLAGSHIP_SPRITES[enemy.type] || null;
  const usesFlagshipSprite = !!flagshipSprite;
  return (
    <>
      {usesFlagshipSprite ? (
        <Image
          source={flagshipSprite}
          resizeMode="contain"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: x - size * 1.15,
            top: y - size * 1.15,
            width: size * 2.3,
            height: size * 2.3,
            opacity: hitFlash > 0 ? 0.72 : 0.96,
            tintColor: hitFlash > 0 ? '#FFFFFF' : undefined,
          }}
        />
      ) : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: x - size, top: y - size,
            width: size * 2, height: size * 2,
            borderRadius: size,
            backgroundColor: hitFlash > 0 ? '#FFFFFF' : color,
            opacity: 0.92,
            shadowColor: color, shadowOpacity: 0.65,
            shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
          }}
        />
      )}
      {hpFrac < 1 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: x - size, top: y - size - 6, width: size * 2, height: 3, backgroundColor: '#333', borderRadius: 2 }}
        >
          <View style={{ width: `${hpFrac * 100}%`, height: '100%', backgroundColor: hpFrac > 0.5 ? '#44FF88' : '#FFC13A', borderRadius: 2 }} />
        </View>
      )}
    </>
  );
}

function TurretView({ x, y }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 6, top: y - 6,
        width: 12, height: 12,
        backgroundColor: '#FFC13A',
        borderRadius: 2, transform: [{ rotate: '45deg' }],
        shadowColor: '#FFC13A', shadowOpacity: 0.75,
        shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function FighterView({ x, y }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 7, top: y - 7,
        width: 14, height: 14,
        backgroundColor: '#52D8FF', borderRadius: 3,
        shadowColor: '#52D8FF', shadowOpacity: 0.85,
        shadowRadius: 9, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function PowerupView({ x, y, type }) {
  const color = POWERUP_COLORS[type] || '#FFF';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 8, top: y - 8,
        width: 16, height: 16,
        backgroundColor: color, opacity: 0.9,
        transform: [{ rotate: '45deg' }],
        shadowColor: color, shadowOpacity: 1,
        shadowRadius: 11, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function MineView({ x, y }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 10, top: y - 10,
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, borderColor: '#FF9A00',
        backgroundColor: 'rgba(255,154,0,0.12)',
        shadowColor: '#FF9A00', shadowOpacity: 0.7,
        shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function ParticleView({ p }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: p.x - p.size / 2, top: p.y - p.size / 2,
        width: p.size, height: p.size,
        borderRadius: p.size / 2,
        backgroundColor: p.color || '#FFF',
        opacity: p.life / p.maxLife,
      }}
    />
  );
}

function MissileView({ x, y }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 6, top: y - 6,
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#FF9A00',
        shadowColor: '#FF9A00', shadowOpacity: 1,
        shadowRadius: 11, shadowOffset: { width: 0, height: 0 },
      }}
    />
  );
}

function WreckView({ w }) {
  const size = w.size || 18;
  const sprite = SCRAP_BOX_SPRITES[w.spriteIndex % SCRAP_BOX_SPRITES.length] || SCRAP_BOX_SPRITES[0];
  return (
    <Image
      pointerEvents="none"
      source={sprite}
      style={{
        position: 'absolute',
        left: w.x - size / 2,
        top: w.y - size / 2,
        width: size,
        height: size,
        opacity: 0.95,
        transform: [{ rotate: `${(w.rotation || 0)}rad` }],
      }}
      resizeMode="contain"
    />
  );
}

function SalvageDroneView({ d }) {
  const color = d.state === 'stunned' ? '#FF4F62' : '#7FD9FF';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: d.x - 5, top: d.y - 5,
        width: 10, height: 10, borderRadius: 5,
        borderWidth: 1, borderColor: color,
        backgroundColor: `${color}66`,
      }}
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────

export default function StationDefenseScreen({
  territory      = {},
  stationUpgrades = {},
  doctrine = 'fortress',
  enemyCounterStyle = 'balanced',
  onDefenseComplete,
  onMainMenu,
}) {
  const [uiState, setUiState] = useState(makeUiState);
  const [gameKey, setGameKey] = useState(0);

  const G            = useRef(null);
  const rafRef       = useRef(null);
  const lastTs       = useRef(null);
  const isRunning    = useRef(false);
  const isPaused     = useRef(false);
  const upgradeQueue = useRef([]);
  const counters     = useRef({ e: 0, p: 0, pa: 0, pu: 0, wr: 0 });
  const fireMissileRef = useRef(null);

  useEffect(() => {
    isRunning.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const g = makeGameState(stationUpgrades, territory, doctrine, enemyCounterStyle);
    G.current = g;
    upgradeQueue.current = [];
    isPaused.current     = false;
    lastTs.current       = null;
    counters.current     = { e: 0, p: 0, pa: 0, pu: 0, wr: 0 };
    isRunning.current    = true;

    // ── Local helpers that close over g ─────────────────────────────
    function spawnParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const s = 55 + Math.random() * 90;
        g.particles.push({
          id: `pa${counters.current.pa++}`, x, y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: 350 + Math.random() * 350, maxLife: 700,
          size: 2.5 + Math.random() * 4, color,
        });
      }
    }

    function fireMissile(targetX, targetY) {
      const now = Date.now();
      if (now - g.missiles.lastFiredAt < g.missiles.cooldownMs) return false;
      const dx   = (targetX ?? CX) - g.station.x;
      const dy   = (targetY ?? CY - 80) - g.station.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      g.missiles.lastFiredAt = now;
      g.projectiles.push({
        id: `pr${counters.current.p++}`,
        x: g.station.x, y: g.station.y,
        vx: (dx / dist) * MISSILE_SPEED,
        vy: (dy / dist) * MISSILE_SPEED,
        damage: g.missiles.damage, aoeRadius: g.missiles.aoeRadius,
        life: 4200,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      return true;
    }

    fireMissileRef.current = fireMissile;

    // ── Game loop ────────────────────────────────────────────────────
    const loop = (ts) => {
      if (!isRunning.current) return;
      if (!G.current) { rafRef.current = requestAnimationFrame(loop); return; }

      if (lastTs.current === null) lastTs.current = ts;
      const dt  = Math.min(ts - lastTs.current, 50);
      lastTs.current = ts;

      if (isPaused.current) { rafRef.current = requestAnimationFrame(loop); return; }

      const now = Date.now();
      g.time += dt / 1000;

      // ── Buffs ──
      if (g.station.shieldActive) {
        g.station.shieldTimer -= dt;
        if (g.station.shieldTimer <= 0) g.station.shieldActive = false;
      }
      if (g.station.hitFlash > 0) g.station.hitFlash -= dt;
      if (g.activeBuffs.nanobotsTimer > 0) g.activeBuffs.nanobotsTimer -= dt;
      if (g.activeBuffs.regenActive || g.basePassiveRegen > 0 || g.hardpointRegen > 0) {
        const regenPerSec = (g.activeBuffs.regenActive ? 2 : 0) + (g.basePassiveRegen || 0) + (g.hardpointRegen || 0);
        g.station.hp = Math.min(g.station.maxHp, g.station.hp + regenPerSec * (dt / 1000));
      }

      // ── Wave management ──
      if (!g.waveActive && now >= g.nextWaveStartAt) {
        g.waveActive     = true;
        g.nextEnemySpawnAt = now;
      }
      if (g.waveActive && g.waveSpawnRemaining > 0 && now >= g.nextEnemySpawnAt) {
        g.enemies.push(spawnEnemyOnEdge(`e${counters.current.e++}`, g.currentWave, g.threat, g.counterProfile));
        g.waveSpawnRemaining--;
        g.nextEnemySpawnAt = now + Math.max(320, 1200 - g.currentWave * 80);
      }

      // ── Wave clear ──
      if (g.waveActive && g.waveSpawnRemaining === 0 && g.enemies.length === 0) {
        g.waveActive = false;
        if (g.currentWave >= g.maxWaves) {
          g.victory = true;
          isRunning.current = false;
        } else {
          upgradeQueue.current.push(pickUpgradeChoices());
          g.currentWave += 1;
          g.waveSpawnRemaining = getEnemyCountForWave(g.currentWave, g.threat);
          g.nextWaveStartAt    = now + 5500;
        }
      }

      // ── Upgrade queue ──
      if (upgradeQueue.current.length > 0) {
        const choices = upgradeQueue.current.shift();
        isPaused.current = true;
        setUiState((prev) => ({ ...prev, showUpgrade: true, upgradeChoices: choices }));
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── Enemy movement ──
      for (const e of g.enemies) {
        const dx   = g.station.x - e.x;
        const dy   = g.station.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) { e.x += (dx / dist) * e.speed * (dt / 1000); e.y += (dy / dist) * e.speed * (dt / 1000); }
        if (e.hitFlash > 0) e.hitFlash -= dt;

        // Station collision
        if (dist <= STATION_RADIUS + e.size * 0.5) {
          if (!g.station.shieldActive) { g.station.hp -= e.damage; g.station.hitFlash = 200; }
          if (e.explodes) spawnParticles(e.x, e.y, ENEMY_DEFS.bomber.color, 14);
          spawnParticles(e.x, e.y, e.color, 6);
          e.lastHitSource = 'ram';
          e.hp = -1;
        }

        // Mine collision
        for (const mine of g.traps) {
          if (mine.triggered) continue;
          if (Math.hypot(mine.x - e.x, mine.y - e.y) < 28) {
            mine.triggered = true;
            spawnParticles(mine.x, mine.y, '#FF9A00', 12);
            for (const tgt of g.enemies) {
              if (Math.hypot(mine.x - tgt.x, mine.y - tgt.y) <= MINE_AOE_R) damageEnemy(tgt, g.mineDamage, 'mine');
            }
          }
        }
      }

      // ── Enemy death ──
      for (const e of g.enemies) {
        if (e.hp <= 0) {
          g.score += e.score; g.kills += 1;
          const killedByStation = e.lastHitSource === 'turret'
            || e.lastHitSource === 'fighter'
            || e.lastHitSource === 'missile'
            || e.lastHitSource === 'mine';
          if (killedByStation) {
            g.stationKills += 1;
            const partAmount = Math.max(1, Math.round((e.partYield || 1) * g.salvageYieldMult));
            spawnWreckage(g, counters, e.x, e.y, e.partType, partAmount);
          }
          spawnParticles(e.x, e.y, e.color, 8);
          if (Math.random() < e.dropChance) {
            const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
            g.powerups.push({ id: `pu${counters.current.pu++}`, type, x: e.x, y: e.y, life: 7000 });
          }
        }
      }
      g.enemies = g.enemies.filter((e) => e.hp > 0);
      g.traps   = g.traps.filter((t) => !t.triggered);

      // ── Turrets ──
      const laserBeams = [];
      for (const t of g.turrets) {
        t.angle += 0.00035 * dt;
        t.x = g.station.x + Math.cos(t.angle) * t.orbitRadius;
        t.y = g.station.y + Math.sin(t.angle) * t.orbitRadius;

        if (t.laserFlash > 0) {
          t.laserFlash -= dt;
          laserBeams.push({ x1: t.x, y1: t.y, x2: t.laserTx, y2: t.laserTy, alpha: t.laserFlash / 140 });
        }

        if (now - t.lastFireAt >= t.rateMs && g.enemies.length > 0) {
          let nearest = null, nd = Infinity;
          for (const e of g.enemies) {
            const d = Math.hypot(e.x - t.x, e.y - t.y);
            if (d < nd) { nd = d; nearest = e; }
          }
          if (nearest) {
            const dmg = g.activeBuffs.nanobotsTimer > 0 ? t.damage * 1.2 : t.damage;
            damageEnemy(nearest, dmg, 'turret', 80);
            t.lastFireAt  = now;
            t.laserFlash  = 140;
            t.laserTx     = nearest.x;
            t.laserTy     = nearest.y;
          }
        }
      }

      // ── Fighters ──
      if (g.fighters.active) {
        if (now >= g.fighters.expireAt) {
          g.fighters.active    = false;
          g.fighters.positions = [];
          g.fighters.angles    = [];
        } else {
          const fCount = g.fighters.extraSlot ? FIGHTER_BASE_COUNT + 1 : FIGHTER_BASE_COUNT;
          for (let i = 0; i < fCount; i++) {
            if (g.fighters.angles[i] === undefined) {
              g.fighters.angles[i]     = (Math.PI * 2 * i) / fCount;
              g.fighters.lastFireAt[i] = 0;
            }
            g.fighters.angles[i] += 0.0018 * dt;
            g.fighters.positions[i] = {
              x: g.station.x + Math.cos(g.fighters.angles[i]) * FIGHTER_ORBIT_R,
              y: g.station.y + Math.sin(g.fighters.angles[i]) * FIGHTER_ORBIT_R,
            };
            if (g.enemies.length > 0 && now - (g.fighters.lastFireAt[i] || 0) >= g.fighterRateMs) {
              const fp = g.fighters.positions[i];
              let nearE = null, nfd = Infinity;
              for (const e of g.enemies) {
                const d = Math.hypot(e.x - fp.x, e.y - fp.y);
                if (d < nfd) { nfd = d; nearE = e; }
              }
              if (nearE) {
                damageEnemy(nearE, FIGHTER_DAMAGE, 'fighter', 70);
                g.fighters.lastFireAt[i] = now;
                laserBeams.push({ x1: fp.x, y1: fp.y, x2: nearE.x, y2: nearE.y, alpha: 0.75, color: '#52D8FF' });
              }
            }
          }
        }
      }

      // ── Missile projectiles ──
      for (const proj of g.projectiles) {
        proj.x    += proj.vx * (dt / 1000);
        proj.y    += proj.vy * (dt / 1000);
        proj.life -= dt;
        for (const e of g.enemies) {
          if (Math.hypot(e.x - proj.x, e.y - proj.y) < proj.aoeRadius * 0.5 + e.size) {
            for (const tgt of g.enemies) {
              const od = Math.hypot(tgt.x - proj.x, tgt.y - proj.y);
              if (od <= proj.aoeRadius) damageEnemy(tgt, proj.damage * (1 - od / proj.aoeRadius * 0.45), 'missile');
            }
            spawnParticles(proj.x, proj.y, '#FF9A00', 16);
            proj.life = -1;
            break;
          }
        }
      }
      g.projectiles = g.projectiles.filter(
        (p) => p.life > 0 && p.x > -60 && p.x < SCREEN.width + 60 && p.y > -60 && p.y < SCREEN.height + 60,
      );

      // Wreck drift and expiry
      for (const w of g.wrecks) {
        w.life -= dt;
        w.x += w.vx * (dt / 1000);
        w.y += w.vy * (dt / 1000);
        w.vx *= 0.992;
        w.vy *= 0.992;
        w.rotation = (w.rotation || 0) + (w.rotationSpeed || 0) * (dt / 1000);
      }
      g.wrecks = g.wrecks.filter((w) => w.life > 0 && w.x > -50 && w.x < SCREEN.width + 50 && w.y > -50 && w.y < SCREEN.height + 50);

      // Salvage drone routing
      for (const d of g.salvageDrones) {
        if (d.stunMs > 0) {
          d.stunMs -= dt;
          if (d.stunMs <= 0) d.state = 'idle';
          continue;
        }

        if (d.state === 'idle') {
          d.orbitAngle += 0.0018 * dt;
          d.x = g.station.x + Math.cos(d.orbitAngle) * (STATION_RADIUS + 18);
          d.y = g.station.y + Math.sin(d.orbitAngle) * (STATION_RADIUS + 18);
          continue;
        }

        if (d.state === 'to_wreck') {
          const target = g.wrecks.find((w) => w.id === d.targetWreckId);
          if (!target) {
            d.state = 'idle';
            d.targetWreckId = null;
            continue;
          }
          const dx = target.x - d.x;
          const dy = target.y - d.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          d.x += (dx / dist) * 120 * (dt / 1000);
          d.y += (dy / dist) * 120 * (dt / 1000);
          if (dist < 12) {
            d.cargoType = target.partType;
            d.cargoAmount = target.amount;
            target.life = -1;
            d.state = 'returning';
          }
        } else if (d.state === 'returning') {
          const dx = g.station.x - d.x;
          const dy = g.station.y - d.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          d.x += (dx / dist) * 130 * (dt / 1000);
          d.y += (dy / dist) * 130 * (dt / 1000);
          if (dist < STATION_RADIUS + 6) {
            if (d.cargoType && d.cargoAmount > 0) {
              g.salvageByType[d.cargoType] = (g.salvageByType[d.cargoType] || 0) + d.cargoAmount;
              g.salvageParts += d.cargoAmount;
              updateHardpointsFromSalvage(g);
            }
            d.cargoType = null;
            d.cargoAmount = 0;
            d.targetWreckId = null;
            d.state = 'idle';
          }
        }

        if (d.state !== 'idle') {
          for (const e of g.enemies) {
            if (Math.hypot(e.x - d.x, e.y - d.y) < e.size + 8) {
              if (d.cargoAmount > 0 && d.cargoType) {
                spawnWreckage(g, counters, d.x, d.y, d.cargoType, Math.max(1, Math.floor(d.cargoAmount * 0.6)));
              }
              d.cargoType = null;
              d.cargoAmount = 0;
              d.targetWreckId = null;
              d.state = 'stunned';
              d.stunMs = 1200;
              break;
            }
          }
        }
      }

      // ── Power-up drift toward station ──
      for (const pu of g.powerups) {
        pu.life -= dt;
        const dx   = g.station.x - pu.x;
        const dy   = g.station.y - pu.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        pu.x += (dx / dist) * 30 * (dt / 1000);
        pu.y += (dy / dist) * 30 * (dt / 1000);
        if (dist < 34) {
          applyPowerup(pu.type, g);
          pu.life = -1;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }
      g.powerups = g.powerups.filter((p) => p.life > 0);

      // ── Particles ──
      for (const p of g.particles) {
        p.life -= dt;
        p.x    += p.vx * (dt / 1000);
        p.y    += p.vy * (dt / 1000);
        p.vx   *= 0.975;
        p.vy   *= 0.975;
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      // ── Game-over check ──
      if (g.station.hp <= 0) {
        g.station.hp  = 0;
        g.gameOver    = true;
        isRunning.current = false;
      }

      // ── UI snapshot ──
      const snapNow     = Date.now();
      const mFrac       = Math.min(1, (snapNow - g.missiles.lastFiredAt) / g.missiles.cooldownMs);
      const fFrac       = g.fighters.active ? 1 : Math.min(1, (snapNow - g.fighters.lastDeployAt) / g.fighters.cooldownMs);

      setUiState({
        stationHp:       g.station.hp,
        stationMaxHp:    g.station.maxHp,
        stationHitFlash: g.station.hitFlash,
        shieldActive:    g.station.shieldActive,
        turrets:         g.turrets.map((t) => ({ x: t.x, y: t.y })),
        laserBeams,
        enemies:         g.enemies.map((e) => ({ ...e })),
        projectiles:     g.projectiles.map((p) => ({ ...p })),
        particles:       g.particles.map((p) => ({ ...p })),
        powerups:        g.powerups.map((pu) => ({ ...pu })),
        traps:           g.traps.map((t) => ({ ...t })),
        wrecks:          g.wrecks.map((w) => ({ ...w })),
        salvageDrones:   g.salvageDrones.map((d) => ({ ...d })),
        fighterActive:    g.fighters.active,
        fighterPositions: g.fighters.active ? g.fighters.positions.filter(Boolean) : [],
        missileFraction:  mFrac,
        fighterFraction:  fFrac,
        mineCount:        g.mineCount,
        currentWave:      g.currentWave,
        maxWaves:         g.maxWaves,
        waveRemaining:    g.waveSpawnRemaining + g.enemies.length,
        score:            g.score,
        kills:            g.kills,
        salvageParts:     g.salvageParts,
        salvageByType:    { ...g.salvageByType },
        hardpoints:       { ...g.hardpoints },
        stationKills:     g.stationKills,
        doctrine:         g.doctrine,
        enemyCounterStyle: g.enemyCounterStyle,
        salvageMode:      g.salvageMode,
        trapMode:         g.trapMode,
        showUpgrade:      false,
        upgradeChoices:   [],
        gameOver:         g.gameOver,
        victory:          g.victory,
        waveActive:       g.waveActive,
      });

      if (!g.gameOver && !g.victory) rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────────

  const handleFieldTap = useCallback((evt) => {
    const g = G.current;
    if (!g || isPaused.current || g.gameOver || g.victory) return;
    const { locationX: lx, locationY: ly } = evt.nativeEvent;
    if (g.salvageMode) {
      let target = null;
      let nearest = Infinity;
      for (const w of g.wrecks) {
        if (w.targetedBy) continue;
        const d = Math.hypot(w.x - lx, w.y - ly);
        if (d < 40 && d < nearest) { nearest = d; target = w; }
      }
      if (target) {
        let drone = null;
        let dd = Infinity;
        for (const sd of g.salvageDrones) {
          if (sd.state !== 'idle') continue;
          const d = Math.hypot(sd.x - target.x, sd.y - target.y);
          if (d < dd) { dd = d; drone = sd; }
        }
        if (drone) {
          drone.state = 'to_wreck';
          drone.targetWreckId = target.id;
          target.targetedBy = drone.id;
          Haptics.selectionAsync().catch(() => {});
        }
      }
      return;
    }
    if (g.trapMode) {
      if (g.mineCount <= 0) return;
      g.traps.push({ id: `m${Date.now()}`, x: lx, y: ly, triggered: false });
      g.mineCount -= 1;
      if (g.mineCount === 0) g.trapMode = false;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      fireMissileRef.current?.(lx, ly);
    }
  }, []);

  const handleMissileButton = useCallback(() => {
    const g = G.current;
    if (!g || isPaused.current) return;
    // Fire toward nearest enemy or default direction
    let tx = CX, ty = CY - 100;
    if (g.enemies.length > 0) {
      let nearest = g.enemies[0], nd = Infinity;
      for (const e of g.enemies) {
        const d = Math.hypot(e.x - g.station.x, e.y - g.station.y);
        if (d < nd) { nd = d; nearest = e; }
      }
      tx = nearest.x; ty = nearest.y;
    }
    fireMissileRef.current?.(tx, ty);
  }, []);

  const handleDeployFighters = useCallback(() => {
    const g = G.current;
    if (!g || isPaused.current) return;
    const now = Date.now();
    if (g.fighters.active || now - g.fighters.lastDeployAt < g.fighters.cooldownMs) return;
    g.fighters.active       = true;
    g.fighters.positions    = [];
    g.fighters.angles       = [];
    g.fighters.lastFireAt   = [];
    g.fighters.lastDeployAt = now;
    g.fighters.expireAt     = now + FIGHTER_DURATION_MS;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const handleToggleTrapMode = useCallback(() => {
    const g = G.current;
    if (!g || isPaused.current) return;
    if (g.mineCount <= 0) return;
    g.trapMode = !g.trapMode;
    if (g.trapMode) g.salvageMode = false;
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const handleToggleSalvageMode = useCallback(() => {
    const g = G.current;
    if (!g || isPaused.current) return;
    g.salvageMode = !g.salvageMode;
    if (g.salvageMode) g.trapMode = false;
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const handleUpgradeSelect = useCallback((id) => {
    const g = G.current;
    if (!g) return;
    applyDefenseUpgrade(id, g);
    isPaused.current = false;
    setUiState((prev) => ({ ...prev, showUpgrade: false, upgradeChoices: [] }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  const handleRestart = useCallback(() => {
    setUiState(makeUiState());
    setGameKey((k) => k + 1);
  }, []);

  // ── Destructure for render ───────────────────────────────────────────
  const {
    stationHp, stationMaxHp, stationHitFlash, shieldActive,
    turrets, laserBeams,
    enemies, projectiles, particles, powerups, traps, wrecks, salvageDrones,
    fighterActive, fighterPositions,
    missileFraction, fighterFraction,
    mineCount, currentWave, maxWaves, waveRemaining,
    score, kills, salvageParts, salvageByType, hardpoints, stationKills, doctrine: activeDoctrine, enemyCounterStyle: activeCounterStyle, salvageMode,
    trapMode, showUpgrade, upgradeChoices,
    gameOver, victory, waveActive,
  } = uiState;

  const hpFrac  = stationHp / Math.max(1, stationMaxHp);
  const hpColor = hpFrac > 0.5 ? '#44FF88' : hpFrac > 0.25 ? '#FFC13A' : '#FF3D3D';
  const mslReady = missileFraction >= 1;
  const ftrReady = !fighterActive && fighterFraction >= 1;

  return (
    <SafeAreaView style={S.safe}>

      {/* Background */}
      <View style={S.bg} pointerEvents="none">
        <View style={S.nebulaA} />
        <View style={S.nebulaB} />
        <View style={[S.gridH, { top: SCREEN.height * 0.33 }]} />
        <View style={[S.gridH, { top: SCREEN.height * 0.66 }]} />
        <View style={[S.gridV, { left: SCREEN.width * 0.33 }]} />
        <View style={[S.gridV, { left: SCREEN.width * 0.66 }]} />
      </View>

      {/* Tap layer — covers full screen for missile fire / mine placement */}
      <TouchableWithoutFeedback onPress={handleFieldTap}>
        <View style={StyleSheet.absoluteFill}>
          {particles.map((p) => <ParticleView key={p.id} p={p} />)}
          {traps.map((t) => <MineView key={t.id} x={t.x} y={t.y} />)}
          {wrecks.map((w) => <WreckView key={w.id} w={w} />)}
          {salvageDrones.map((d) => <SalvageDroneView key={d.id} d={d} />)}
          {powerups.map((pu) => <PowerupView key={pu.id} x={pu.x} y={pu.y} type={pu.type} />)}
          {laserBeams.map((b, i) => (
            <LaserBeam key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} alpha={b.alpha} color={b.color} />
          ))}
          {turrets.map((t, i) => <TurretView key={i} x={t.x} y={t.y} />)}
          {fighterActive && fighterPositions.map((fp, i) => fp && <FighterView key={i} x={fp.x} y={fp.y} />)}
          {enemies.map((e) => <EnemyView key={e.id} enemy={e} />)}
          {projectiles.map((p) => <MissileView key={p.id} x={p.x} y={p.y} />)}
          <StationView hp={stationHp} maxHp={stationMaxHp} hitFlash={stationHitFlash} shieldActive={shieldActive} />
        </View>
      </TouchableWithoutFeedback>

      {/* Trap placement banner */}
      {trapMode && !showUpgrade && !gameOver && !victory && (
        <View style={S.trapBanner} pointerEvents="none">
          <Text style={S.trapBannerText}>TAP ANYWHERE TO PLACE MINE  ({mineCount} LEFT)</Text>
        </View>
      )}
      {salvageMode && !showUpgrade && !gameOver && !victory && (
        <View style={[S.trapBanner, { top: 94 }]} pointerEvents="none">
          <Text style={[S.trapBannerText, { color: '#7FD9FF', borderColor: '#7FD9FF' }]}>SALVAGE MODE: TAP WRECKS TO ROUTE DRONES</Text>
        </View>
      )}

      {/* TOP HUD */}
      {!showUpgrade && !gameOver && !victory && (
        <View style={S.topHud} pointerEvents="none">
          <View style={S.hpRow}>
            <Text style={S.hpLabel}>STATION</Text>
            <View style={S.hpBarOuter}>
              <View style={[S.hpBarFill, { width: `${hpFrac * 100}%`, backgroundColor: hpColor }]} />
            </View>
            <Text style={[S.hpValue, { color: hpColor }]}>{Math.ceil(stationHp)}/{stationMaxHp}</Text>
          </View>
          <View style={S.waveRow}>
            <Text style={S.waveText}>
              WAVE {currentWave}/{maxWaves}{waveActive ? `  ·  ${waveRemaining} LEFT` : '  ·  STAND BY'}
            </Text>
            <Text style={S.scoreText}>SCORE {score.toLocaleString()}</Text>
          </View>
          <Text style={S.waveText}>
            DOC {String(activeDoctrine || doctrine || 'fortress').toUpperCase()}  |  COUNTER {String(activeCounterStyle || enemyCounterStyle || 'balanced').toUpperCase()}  |  HARDPOINTS M{hardpoints.mech || 0} P{hardpoints.plasma || 0} V{hardpoints.void || 0} B{hardpoints.bio || 0}
          </Text>
        </View>
      )}

      {/* BOTTOM ACTION BAR */}
      {!showUpgrade && !gameOver && !victory && (
        <View style={S.actionBar} pointerEvents="box-none">

          {/* MISSILE */}
          <TouchableOpacity style={S.actionBtn} onPress={handleMissileButton} activeOpacity={0.8}>
            <View style={[S.cooldownRing, { borderColor: mslReady ? '#FF9A00' : '#443320' }]}>
              <View style={[S.cooldownFill, { height: `${missileFraction * 100}%`, backgroundColor: '#FF9A00' }]} />
            </View>
            <Text style={[S.actionLabel, { color: mslReady ? '#FF9A00' : '#664422' }]}>MSL</Text>
          </TouchableOpacity>

          {/* FIGHTERS */}
          <TouchableOpacity style={S.actionBtn} onPress={handleDeployFighters} activeOpacity={0.8}>
            <View style={[S.cooldownRing, { borderColor: fighterActive ? '#52D8FF' : (ftrReady ? '#52D8FF' : '#1A3344') }]}>
              <View style={[S.cooldownFill, { height: `${fighterFraction * 100}%`, backgroundColor: '#52D8FF' }]} />
            </View>
            <Text style={[S.actionLabel, { color: fighterActive ? '#52D8FF' : (ftrReady ? '#52D8FF' : '#1A3344') }]}>
              {fighterActive ? 'ACT' : 'FTR'}
            </Text>
          </TouchableOpacity>

          {/* MINE / TRAP */}
          <TouchableOpacity
            style={[S.actionBtn, trapMode && S.actionBtnTrap]}
            onPress={handleToggleTrapMode}
            activeOpacity={0.8}
          >
            <Text style={[S.bigNumber, { color: mineCount > 0 ? '#FF9A00' : '#443320' }]}>{mineCount}</Text>
            <Text style={[S.actionLabel, { color: trapMode ? '#FF9A00' : (mineCount > 0 ? '#996633' : '#443320') }]}>
              {trapMode ? 'PLACE' : 'MINE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[S.actionBtn, salvageMode && S.actionBtnSalvage]}
            onPress={handleToggleSalvageMode}
            activeOpacity={0.8}
          >
            <Text style={[S.bigNumber, { color: wrecks.length > 0 ? '#7FD9FF' : '#415A6E' }]}>{wrecks.length}</Text>
            <Text style={[S.actionLabel, { color: salvageMode ? '#7FD9FF' : '#4C6E85' }]}>SCAV</Text>
          </TouchableOpacity>

          {/* KILLS */}
          <View style={[S.actionBtn, S.statDisplay]}>
            <Text style={[S.bigNumber, { color: '#B46CFF' }]}>{kills}</Text>
            <Text style={[S.actionLabel, { color: '#B46CFF' }]}>KILL</Text>
          </View>

          <View style={[S.actionBtn, S.statDisplay]}>
            <Text style={[S.bigNumber, { color: '#FFC13A' }]}>{salvageParts}</Text>
            <Text style={[S.actionLabel, { color: '#FFC13A' }]}>PARTS</Text>
          </View>
        </View>
      )}

      {/* BETWEEN-WAVE UPGRADE */}
      {showUpgrade && (
        <View style={S.overlay}>
          <Text style={S.overlayTitle}>CHOOSE UPGRADE</Text>
          <Text style={S.overlaySub}>WAVE {currentWave - 1} CLEARED — PICK ONE</Text>
          {upgradeChoices.map((u) => (
            <TouchableOpacity key={u.id} style={S.upgradeCard} onPress={() => handleUpgradeSelect(u.id)} activeOpacity={0.8}>
              <Text style={S.upgradeLabel}>{u.label}</Text>
              <Text style={S.upgradeDesc}>{u.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* VICTORY */}
      {victory && (
        <View style={S.overlay}>
          <Text style={[S.overlayTitle, { color: '#44FF88' }]}>STATION DEFENDED</Text>
          <Text style={S.overlaySub}>All {maxWaves} waves repelled</Text>
          <Text style={S.statLine}>SCORE {score.toLocaleString()}  ·  KILLS {kills}</Text>
          <Text style={S.statLine}>STATION KILLS {stationKills}  |  SALVAGE +{salvageParts}</Text>
          <Text style={S.statLine}>MECH +{salvageByType.mech || 0} | PLASMA +{salvageByType.plasma || 0} | VOID +{salvageByType.void || 0} | BIO +{salvageByType.bio || 0}</Text>
          <TouchableOpacity
            style={[S.resultBtn, { borderColor: '#44FF88', backgroundColor: 'rgba(40,220,80,0.12)' }]}
            onPress={() => onDefenseComplete?.({
              victory: true,
              score,
              kills,
              salvageParts,
              salvageByType,
              stationKills,
              doctrineUsed: activeDoctrine || doctrine,
            })}
            activeOpacity={0.8}
          >
            <Text style={[S.resultBtnText, { color: '#44FF88' }]}>CONFIRM VICTORY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.menuBtn} onPress={onMainMenu} activeOpacity={0.8}>
            <Text style={S.menuBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* GAME OVER */}
      {gameOver && (
        <View style={S.overlay}>
          <Text style={[S.overlayTitle, { color: '#FF3D3D' }]}>STATION LOST</Text>
          <Text style={S.overlaySub}>Overwhelmed by enemy forces</Text>
          <Text style={S.statLine}>SCORE {score.toLocaleString()}  ·  KILLS {kills}</Text>
          <Text style={S.statLine}>STATION KILLS {stationKills}  |  SALVAGE +{salvageParts}</Text>
          <Text style={S.statLine}>MECH +{salvageByType.mech || 0} | PLASMA +{salvageByType.plasma || 0} | VOID +{salvageByType.void || 0} | BIO +{salvageByType.bio || 0}</Text>
          <TouchableOpacity
            style={[S.resultBtn, { borderColor: '#FF3D3D', backgroundColor: 'rgba(255,60,60,0.12)' }]}
            onPress={handleRestart}
            activeOpacity={0.8}
          >
            <Text style={[S.resultBtnText, { color: '#FF3D3D' }]}>RETRY DEFENSE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.menuBtn} onPress={onMainMenu} activeOpacity={0.8}>
            <Text style={S.menuBtnText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000008' },
  bg:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  nebulaA: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    top: -60, right: -80, backgroundColor: 'rgba(82,216,255,0.09)',
  },
  nebulaB: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    bottom: 100, left: -70, backgroundColor: 'rgba(180,108,255,0.08)',
  },
  gridH: { position: 'absolute', left: 0, right: 0, height: 0.5, backgroundColor: 'rgba(79,165,255,0.1)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 0.5,  backgroundColor: 'rgba(79,165,255,0.1)' },

  // HUD
  topHud: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 50 },
  hpRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  hpLabel: { color: 'rgba(176,207,236,0.65)', fontFamily: 'Courier New', fontSize: 9, letterSpacing: 1.5, width: 56 },
  hpBarOuter: { flex: 1, height: 9, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginRight: 8 },
  hpBarFill:  { height: '100%', borderRadius: 4 },
  hpValue: { fontFamily: 'Courier New', fontSize: 10, fontWeight: 'bold', width: 78, textAlign: 'right' },
  waveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  waveText:  { color: 'rgba(176,207,236,0.8)', fontFamily: 'Courier New', fontSize: 10, letterSpacing: 1.2 },
  scoreText: { color: 'rgba(103,243,255,0.8)', fontFamily: 'Courier New', fontSize: 10, letterSpacing: 1 },

  // Trap banner
  trapBanner: {
    position: 'absolute', top: 64, left: 0, right: 0,
    alignItems: 'center', zIndex: 60,
  },
  trapBannerText: {
    color: '#FF9A00', fontFamily: 'Courier New', fontSize: 11, letterSpacing: 2,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 4, borderWidth: 1, borderColor: '#FF9A00',
  },

  // Action bar
  actionBar: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    zIndex: 50,
  },
  actionBtn: {
    width: 56, height: 74, alignItems: 'center', justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,24,44,0.8)',
    borderWidth: 1, borderColor: 'rgba(103,243,255,0.2)',
    borderRadius: 8, paddingBottom: 7,
  },
  actionBtnTrap: { borderColor: '#FF9A00', backgroundColor: 'rgba(40,24,8,0.85)' },
  actionBtnSalvage: { borderColor: '#7FD9FF', backgroundColor: 'rgba(16,40,54,0.85)' },
  statDisplay:  { borderColor: 'rgba(180,108,255,0.25)' },
  cooldownRing: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2, overflow: 'hidden',
    justifyContent: 'flex-end', marginBottom: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cooldownFill: { width: '100%', borderRadius: 17 },
  actionLabel:  { fontFamily: 'Courier New', fontSize: 9, fontWeight: 'bold', letterSpacing: 1.3 },
  bigNumber:    { fontFamily: 'Courier New', fontSize: 18, fontWeight: 'bold', lineHeight: 24, marginBottom: 2 },

  // Overlays
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(5,10,18,0.95)', paddingHorizontal: 24, zIndex: 200,
  },
  overlayTitle: {
    color: '#67F3FF', fontFamily: 'Courier New', fontWeight: 'bold',
    fontSize: 24, letterSpacing: 3, marginBottom: 6,
    textShadowColor: '#67F3FF', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
  },
  overlaySub: {
    color: 'rgba(176,207,236,0.65)', fontFamily: 'Courier New',
    fontSize: 10, letterSpacing: 2, marginBottom: 24,
  },
  statLine: {
    color: 'rgba(127,242,255,0.8)', fontFamily: 'Courier New',
    fontSize: 11, letterSpacing: 1.5, marginBottom: 28,
  },
  upgradeCard: {
    width: '100%', borderWidth: 1, borderColor: 'rgba(103,243,255,0.28)',
    backgroundColor: 'rgba(8,18,38,0.85)', borderRadius: 6,
    paddingVertical: 14, paddingHorizontal: 20, marginBottom: 12,
  },
  upgradeLabel: {
    color: '#67F3FF', fontFamily: 'Courier New', fontWeight: 'bold',
    fontSize: 13, letterSpacing: 2, marginBottom: 4,
  },
  upgradeDesc: {
    color: 'rgba(176,207,236,0.7)', fontFamily: 'Courier New', fontSize: 11, letterSpacing: 1,
  },
  resultBtn: {
    borderWidth: 1.5, borderRadius: 4,
    paddingHorizontal: 24, paddingVertical: 14, marginBottom: 12,
  },
  resultBtnText: { fontFamily: 'Courier New', fontWeight: 'bold', fontSize: 12, letterSpacing: 2 },
  menuBtn: {
    borderWidth: 1, borderColor: 'rgba(170,192,220,0.38)',
    borderRadius: 4, paddingHorizontal: 18, paddingVertical: 10,
  },
  menuBtnText: {
    color: 'rgba(176,207,236,0.65)', fontFamily: 'Courier New',
    fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5,
  },
});
