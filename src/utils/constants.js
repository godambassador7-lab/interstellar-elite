// src/utils/constants.js

import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN = { width, height };

// Player
export const PLAYER = {
  SIZE: 28,
  BASE_SPEED: 280,
  MAX_SPEED: 420,
  FRICTION: 0.82,
  HEALTH: 100,
  ATTACK_RANGE: 90,
  ATTACK_DAMAGE: 18,
  ATTACK_RATE: 180,       // ms between auto attacks
  INVINCIBILITY_MS: 800,
  SHIELD_MAX: 50,
  SHIELD_REGEN_RATE: 10,   // HP/sec restored when not recently hit
  SHIELD_REGEN_DELAY: 3000, // ms after last hit before regen begins
};

// Abilities
export const ABILITIES = {
  DASH: {
    COOLDOWN: 2800,
    FORCE: 520,
    DAMAGE: 35,
    DURATION: 280,
    TRAIL_COUNT: 6,
  },
  PULSE: {
    COOLDOWN: 5000,
    RADIUS: 160,
    DAMAGE: 55,
    DURATION: 350,
  },
  DRONE: {
    COOLDOWN: 8000,
    RADIUS: 75,
    DAMAGE: 12,
    DURATION: 6000,
    SPEED: 3.8,          // radians per second
    COUNT: 2,
  },
};

// Enemies
export const ENEMY_TYPES = {
  swarm: {
    type: 'swarm',
    size: 14,
    hp: 22,
    speed: 95,
    damage: 8,
    score: 10,
    color: '#2DFFB2',
    glow: '#1CD891',
    points: 3,
  },
  heavy: {
    type: 'heavy',
    size: 26,
    hp: 90,
    speed: 45,
    damage: 20,
    score: 40,
    color: '#FF4F62',
    glow: '#F13A50',
    points: 1,
  },
  elite: {
    type: 'elite',
    size: 20,
    hp: 55,
    speed: 130,
    damage: 14,
    score: 65,
    color: '#B46CFF',
    glow: '#9B4CFF',
    points: 2,
  },
};

// Spawn
export const SPAWN = {
  BASE_INTERVAL: 1400,
  MIN_INTERVAL: 380,
  INTERVAL_DECREASE: 14,    // ms reduction per second of game time
  ELITE_CHANCE_BASE: 0.08,
  HEAVY_CHANCE_BASE: 0.14,
  WAVE_ELITE_BONUS: 0.006,
  WAVE_HEAVY_BONUS: 0.008,
  SPAWN_MARGIN: 30,
};

// Combo
export const COMBO = {
  TIMEOUT_MS: 2800,
  MIN_FOR_DISPLAY: 2,
  MULTIPLIER_STEP: 5,    // every N combo â†’ multiplier++
};

// Upgrade thresholds
export const UPGRADE_THRESHOLDS = [150, 400, 800, 1400, 2200, 3200];

export function getUpgradeThresholdsForRun({ threat = 1, systemNumber = 1, maxWaves = 1 } = {}) {
  const t = Math.max(1, Number(threat) || 1);
  const s = Math.max(1, Number(systemNumber) || 1);
  const w = Math.max(1, Number(maxWaves) || 1);

  const threatFactor = Math.max(0, t - 1) * 0.35;
  const depthFactor = Math.min(0.55, (s - 1) * 0.015);
  const waveFactor = Math.min(0.4, Math.max(0, w - 6) * 0.06);
  const totalFactor = 1 + threatFactor + depthFactor + waveFactor;

  return UPGRADE_THRESHOLDS.map((base, idx) => {
    const tierWeight = 0.55 + idx * 0.12; // later upgrades scale harder
    const scaled = base * (1 + (totalFactor - 1) * tierWeight);
    return Math.round(scaled / 10) * 10;
  });
}

// â”€â”€ Universe: Four Quadrons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Bayron (blue, weakest) Â· Crimson (red) Â· Watupi (green) Â· Ultra-316 (UV, strongest)
// Map canvas: 2400 Ã— 1400  |  Quadron boundary: x=1200, y=700

export const QUADRANT_DEFS = [
  { id: 'bayron',   label: 'BAYRON',    rank: 'I',   accent: '#52D8FF', bgColor: 'rgba(52,168,255,0.045)',  x1: 0,    y1: 0,   x2: 1200, y2: 700  },
  { id: 'crimson',  label: 'CRIMSON',   rank: 'II',  accent: '#FF3D3D', bgColor: 'rgba(255,60,60,0.045)',   x1: 1200, y1: 0,   x2: 2400, y2: 700  },
  { id: 'watupi',   label: 'WATUPI',    rank: 'III', accent: '#44FF88', bgColor: 'rgba(40,220,100,0.045)',  x1: 0,    y1: 700, x2: 1200, y2: 1400 },
  { id: 'ultra316', label: 'ULTRA-316', rank: 'IV',  accent: '#CC44FF', bgColor: 'rgba(180,40,255,0.045)', x1: 1200, y1: 700, x2: 2400, y2: 1400 },
];

// â”€â”€ Galaxy Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Deterministic integer hash â€” XOR-shift only, no float-precision risk
function _h(n) {
  let s = (n >>> 0) ^ 0xdeadbeef;
  s ^= s >>> 16;
  s ^= s << 13; s = s >>> 0;
  s ^= s >>> 7;
  s ^= s << 17; s = s >>> 0;
  return s / 4294967296;
}

// Per-quadron galaxy name word banks (prefixes and suffixes are disjoint across quadrons)
const _NAMES = {
  bayron: {
    p: ['Vor','Kel','Ara','Syl','Nyx','Cael','Vael','Ori','Lyri','Aqu',
        'Zer','Mal','Ven','Tur','Pan','Dal','Sol','Kira','Zeph','Nol',
        'Ael','Eth','Cor','Pax','Tel','Dyn','Myr','Zar','Cal','Hel',
        'Ixa','Ull','Ves','Wyr','Xan','Bel','Del','Elm','Far','Har',
        'Ind','Jar','Kar','Lan','Mar','Nar','Orl','Per','Quan','Ran'],
    s: ['Reach','Expanse','Gate','Drift','Void','Deep','Field','Cloud',
        'Belt','Arm','Ring','Arc','Abyss','Basin','Sweep','Shore',
        'Haven','Strand','Fringe','Rim','Tract','Span','Hollow','Veil','Scape'],
  },
  crimson: {
    p: ['Rax','Pyr','Ign','Cin','Torx','Charn','Embr','Slagn','Vex','Sear',
        'Brand','Torr','Kael','Drax','Xorg','Ygg','Zul','Thex','Varn','Brul',
        'Corg','Drak','Ferr','Garg','Hord','Jurk','Koth','Lorg','Mord','Norg',
        'Prax','Rorg','Skorn','Targ','Urax','Vorg','Warg','Borg','Crag','Dreg',
        'Evet','Flarg','Grax','Hrax','Irax','Jorg','Karg','Larg','Marg','Narg'],
    s: ['Burn','Scar','Flare','Forge','Fury','Wrath','Storm','Rage','Rift','Blight',
        'Cinder','Blaze','Gash','Pyre','Smelt','Wound','Wake','Scorch',
        'Ash','Char','Flame','Ember','Mark','Slag','Brand'],
  },
  watupi: {
    p: ['Ath','Gal','Fen','Bor','Nar','Sep','Thal','Mor','Glor','Syl',
        'Lum','Chor','Vir','Wat','Alg','Bren','Dru','Eld','Glar','Hyla',
        'Jord','Kelt','Lynd','Meld','Ond','Rend','Seld','Uldr','Veld','Arb',
        'Celd','Feld','Held','Ildra','Jeld','Keld','Leld','Morn','Neld','Peld',
        'Qeld','Reld','Teld','Ueld','Weld','Yeld','Zeld','Amal','Breld','Cren'],
    s: ['Canopy','Grove','Vale','Bloom','Wilds','Sprawl','Glade','Thicket','Arbor',
        'Bough','Root','Frond','Weald','Heath','Moor','Copse','Dell','Lea',
        'Wald','Verdure','Stand','Tarn','Glen','Fern','Briar'],
  },
  ultra316: {
    p: ['Xen','Omn','Asc','Hyp','Nex','Arx','Pri','Sup','Aeon','Crit',
        'Frac','Glyph','Hex','Icon','Kern','Meta','Para','Quat','Ryx','Sig',
        'Typh','Axon','Byon','Cyan','Dyon','Eyon','Fyon','Gyon','Hyon','Iyon',
        'Jyon','Kyon','Lyon','Myon','Nyon','Oyon','Pyon','Ryon','Syon','Tyon',
        'Uyon','Vyon','Wyon','Xyon','Yyon','Zyon','Alph','Beth','Gamm','Delt'],
    s: ['Ascendance','Pinnacle','Crown','Apex','Zenith','Dominion','Throne',
        'Convergence','Summit','Spire','Crest','Vertex','Meridian','Node',
        'Vortex','Nexus','Pulse','Core','Heart','Flux','Prism','Rise','Void','Peak','Ascent'],
  },
};

// Internal layout + difficulty specs for each quadron's galaxy grid
// x1/y1/x2/y2 = usable inner area (inset from quadron boundary for clean padding)
const _SPECS = [
  { id: 'bayron',   accent: '#52D8FF', x1: 100,  y1: 80,  x2: 1100, y2: 640,  tMin:1.00, tMax:1.50, wMin:3, wMax:6,  bMin:8,  bMax:13, gMin:3, gMax:5,  sMin:50,  sMax:130, n:63 },
  { id: 'crimson',  accent: '#FF3D3D', x1: 1300, y1: 80,  x2: 2300, y2: 640,  tMin:1.60, tMax:2.50, wMin:5, wMax:8,  bMin:13, bMax:18, gMin:4, gMax:7,  sMin:60,  sMax:150, n:63 },
  { id: 'watupi',   accent: '#44FF88', x1: 100,  y1: 760, x2: 1100, y2: 1320, tMin:2.60, tMax:3.50, wMin:7, wMax:10, bMin:18, bMax:24, gMin:6, gMax:9,  sMin:80,  sMax:170, n:62 },
  { id: 'ultra316', accent: '#CC44FF', x1: 1300, y1: 760, x2: 2300, y2: 1320, tMin:3.60, tMax:5.00, wMin:9, wMax:12, bMin:24, bMax:32, gMin:8, gMax:12, sMin:100, sMax:200, n:62 },
];

function _buildGalaxies() {
  const CENTER_X = 1200;
  const CENTER_Y = 700;
  const RING_STEP = 76;
  const MIN_GALAXY_SPACING = 34;
  const BASE_ANGLES = {
    bayron: 225,
    crimson: 315,
    watupi: 135,
    ultra316: 45,
  };
  const all = [];

  for (const q of _SPECS) {
    const nm = _NAMES[q.id];
    const baseAngle = BASE_ANGLES[q.id] || 0;

    for (let i = 0; i < q.n; i++) {
      const t = q.n > 1 ? i / (q.n - 1) : 0;
      const ring = Math.floor((60 + Math.pow(t, 0.9) * 1080) / RING_STEP);

      let x = (q.x1 + q.x2) / 2;
      let y = (q.y1 + q.y2) / 2;
      let placed = false;
      let bestMinDist = -1;
      let bestX = x;
      let bestY = y;

      for (let attempt = 0; attempt < 72; attempt++) {
        const aSeedA = _h(i * 97 + q.x1 * 13 + q.y1 * 7 + attempt * 71);
        const aSeedB = _h(i * 131 + q.x1 * 5 + q.y1 * 11 + attempt * 53);
        const rSeedA = _h(i * 173 + q.x1 * 17 + q.y1 * 3 + attempt * 89);
        const rSeedB = _h(i * 211 + q.x1 * 19 + q.y1 * 2 + attempt * 41);
        const mSeedX = _h(i * 239 + q.x1 + q.y1 * 2 + attempt * 67);
        const mSeedY = _h(i * 251 + q.x1 * 3 + q.y1 + attempt * 59);

        const angleSpread = 18 + t * 34;
        const angleBias = ((aSeedA - 0.5) + (aSeedB - 0.5)) * angleSpread;
        const angleRad = ((baseAngle + angleBias) * Math.PI) / 180;

        const ringRadius = ring * RING_STEP;
        const radialJitter = ((rSeedA - 0.5) * 0.9 + (rSeedB - 0.5) * 0.6) * RING_STEP;
        const radius = Math.max(30, ringRadius + radialJitter);

        let tx = CENTER_X + Math.cos(angleRad) * radius;
        let ty = CENTER_Y + Math.sin(angleRad) * radius;
        tx += (mSeedX - 0.5) * 12;
        ty += (mSeedY - 0.5) * 12;

        if (tx >= q.x1 && tx <= q.x2 && ty >= q.y1 && ty <= q.y2) {
          let minDist = Infinity;
          for (let n = 0; n < all.length; n++) {
            const dx = tx - all[n].x;
            const dy = ty - all[n].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) minDist = d;
          }
          if (minDist > bestMinDist) {
            bestMinDist = minDist;
            bestX = tx;
            bestY = ty;
          }
          if (minDist >= MIN_GALAXY_SPACING) {
            x = tx;
            y = ty;
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        x = Math.max(q.x1, Math.min(q.x2, bestX));
        y = Math.max(q.y1, Math.min(q.y2, bestY));
      }

      // Secondary repel pass: nudge away if a very rare near-overlap survived the first pass.
      for (let n = 0; n < all.length; n++) {
        const dx = x - all[n].x;
        const dy = y - all[n].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0 && d < MIN_GALAXY_SPACING) {
          const push = (MIN_GALAXY_SPACING - d) * 0.65;
          x += (dx / d) * push;
          y += (dy / d) * push;
        } else if (d === 0) {
          x += 8;
          y += 8;
        }
      }

      x = Math.max(q.x1, Math.min(q.x2, x));
      y = Math.max(q.y1, Math.min(q.y2, y));

      all.push({
        id:          `${q.id}_${i}`,
        name:        `${nm.p[i % nm.p.length]} ${nm.s[Math.floor(i / nm.p.length) % nm.s.length]}`,
        quadrant:    q.id,
        x:           Math.round(x),
        y:           Math.round(y),
        systems:     Math.round(q.sMin + (q.sMax - q.sMin) * t),
        waves:       Math.round(q.wMin + (q.wMax - q.wMin) * t),
        baseEnemies: Math.round(q.bMin + (q.bMax - q.bMin) * t),
        enemyGrowth: Math.round(q.gMin + (q.gMax - q.gMin) * t),
        threat:      parseFloat((q.tMin + (q.tMax - q.tMin) * t).toFixed(2)),
        accent:      q.accent,
      });
    }
  }

  // Final deterministic separation pass guarantees spacing.
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (all[i].quadrant !== all[j].quadrant) continue;
        const dx = all[i].x - all[j].x;
        const dy = all[i].y - all[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0 && d < MIN_GALAXY_SPACING) {
          const push = ((MIN_GALAXY_SPACING - d) / 2) * 0.9;
          const ux = dx / d;
          const uy = dy / d;
          all[i].x += ux * push;
          all[i].y += uy * push;
          all[j].x -= ux * push;
          all[j].y -= uy * push;
        }
      }
    }
    for (let i = 0; i < all.length; i++) {
      const q = _SPECS.find((s) => s.id === all[i].quadrant);
      if (!q) continue;
      all[i].x = Math.round(Math.max(q.x1, Math.min(q.x2, all[i].x)));
      all[i].y = Math.round(Math.max(q.y1, Math.min(q.y2, all[i].y)));
    }
  }

  return all;
}
// 250 galaxies: 63 Bayron + 63 Crimson + 62 Watupi + 62 Ultra-316
export const GALAXIES = _buildGalaxies();

// Colors
export const COLORS = {
  bg: '#05070F',
  playerCore: '#43E8FF',
  playerGlow: '#00BFFF',
  healthBar: '#33FF8F',
  healthLow: '#FF3333',
  comboColor: '#FFC13A',
  scoreColor: '#67F3FF',
  abilityReady: '#72F0FF',
  abilityCooldown: '#25324A',
  abilityActive: '#FFFFFF',
  particleColors: ['#3DFFBA', '#52D8FF', '#B46CFF', '#FF9D2E', '#FF4F62'],
};

// Particles
export const PARTICLES = {
  EXPLOSION_COUNT: 10,
  EXPLOSION_SPEED: 160,
  EXPLOSION_LIFE: 600,
  HIT_COUNT: 4,
  HIT_SPEED: 80,
  HIT_LIFE: 280,
};

