// ============================================================
// src/components/PreInterceptionScreen.tsx
// Pre-interception targeting mini-game.
// Reticles fly across the screen one at a time; player presses
// SPACE when a reticle is over the asteroid.
// Accuracy maps to impact timer: 0% → 45s, 100% → 90s.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { applySfxVolume } from '../app/audioSettings';
import { AsteroidState } from '../game/types';
import targetLockSfx from '../Target locked (192) (mp3cut.net).mp3';
import {
  createReticleSpawn,
  getActivePreInterceptTarget,
  layoutPreInterceptTargets,
  PreInterceptTarget,
  relayoutPreInterceptTargets,
} from '../game/preInterceptEngine';

// ---- Types -------------------------------------------------------

interface Star {
  x: number;
  y: number;
  r: number;
  brightness: number;
  speed: number;
}

interface TransitionLine {
  b: number;         // y-intercept: y = SLOPE * x + b
  speed: number;     // px/s the line travels (b increases each frame)
  width: number;
  color: string;
  glowColor: string;
  alpha: number;     // 0-1 base opacity
}

interface AnimState {
  stars: Star[];
  asteroids: PreInterceptTarget[];
  activeTargetIndex: number;
  clusterStormActive: boolean;
  reticlesPerTarget: number;
  reticlesUsedOnTarget: number;
  // Reticle system
  reticleCount: number;
  currentReticleIndex: number;
  reticleX: number;
  reticleY: number;
  reticleSpeedPx: number;
  reticleTime: number;
  reticleDriftAmp: number;
  reticleDriftFreq: number;
  reticleDriftPhase: number;
  reticleSpeedPulse: number;
  reticleSpeedPulseFreq: number;
  reticleSpeedPulsePhase: number;
  reticleVelX: number;
  reticleVelY: number;
  reticlePattern: ReticlePattern;
  reticlePatternAmp: number;
  reticlePatternFreq: number;
  reticlePatternPhase: number;
  reticlePatternLabel: string;
  reticleJammerActive: boolean;
  currentHitRadius: number;
  currentReticleVerticalTolerance: number;
  baseHitRadius: number;
  baseReticleVerticalTolerance: number;
  hitRadius: number;
  reticleVerticalTolerance: number;
  difficulty: number;
  reticleActive: boolean;
  reticleResolved: boolean;
  playerPressed: boolean;
  pauseTimer: number;
  // Scoring
  hits: number;
  streak: number;
  bestStreak: number;
  precisionSum: number;
  // Timing
  lastTimestamp: number;
  countdownRemaining: number;
  countdownPhase: boolean;
  lastCountdownDisplay: number;
  resultsTimer: number;
  resultsPhase: boolean;
  // Feedback
  flashTimer: number;
  flashType: 'hit' | 'miss' | null;
  // Per-level speed range (computed once on mount)
  minSpeed: number;
  maxSpeed: number;
  // Speed-lines transition
  transitionPhase: boolean;
  transitionTimer: number;    // 0 → 2 (seconds elapsed)
  transitionAccuracy: number; // stored accuracy to pass when done
  transitionLines: TransitionLine[];
  // Triangulation
  triTime: number;
  triConfidence: number;
  triEquationTimer: number;
  triEquationIdx: number;
  triUpdateTimer: number;
  // Orbit rings
  ringAngles: [number, number, number];
  ringTime: number;
  ringLockedCount: number;   // 0-3: how many rings have gold-locked (outermost first)
  ringShakeTimer: number;
}

interface UiState {
  phase: 'countdown' | 'playing' | 'results' | 'transition';
  hitsDisplay: number;
  totalDisplay: number;
  countdownValue: number;
  accuracy: number;
  streakDisplay: number;
  bestStreakDisplay: number;
  patternLabel: string;
  jammerActive: boolean;
  flashResult: 'hit' | 'miss' | null;
  // Triangulation panel
  triAngle1: number;
  triAngle2: number;
  triAngle3: number;
  triBearing: number;
  triRangeKm: number;
  triConfidence: number;
  triEquationIdx: number;
  triNoise: number;
  triLockA: boolean;
  triLockB: boolean;
  triLockC: boolean;
}

type ReticlePattern = 'direct' | 'zigzag' | 'sweep' | 'burst';

// ---- Constants ---------------------------------------------------

const BASE_HIT_RADIUS = 50;

// ---- Triangulation equation sets (cycle every ~2.8s) ------------

const TRI_EQUATIONS = [
  {
    label: 'TRAJECTORY SOLVE',
    eq:   'r\u20d7(t) = r\u20d7\u2080 + v\u20d7t + \u00bdat\u00b2',
    live: (conf: number, noise: number) => [
      `\u03c4_impact = ${(12.4 - conf * 0.08 + noise * 0.3).toFixed(2)} ks`,
      `|\u0394r|     = ${(4.71 - conf * 0.02 + noise * 0.05).toFixed(3)} AU`,
      `v_rel    = ${(24.3 + noise * 1.4).toFixed(1)} km/s`,
    ],
  },
  {
    label: 'ANGULAR MOMENTUM',
    eq:   'L\u20d7 = r\u20d7 \u00d7 m\u00b7v\u20d7',
    live: (conf: number, noise: number) => [
      `L = ${(8.32 + conf * 0.004 + noise * 0.09).toFixed(3)} \u00d7 10\u00b2\u2078 kg m\u00b2/s`,
      `\u03a9 = ${(2.14 + noise * 0.06).toFixed(4)} rad/ks`,
      `\u03b2_prec = ${(0.41 + conf * 0.002 + noise * 0.02).toFixed(3)}\u00b0/ks`,
    ],
  },
  {
    label: 'TRIANGULATION ERR',
    eq:   '\u03c3_\u03b8 = \u221a(\u03c3\u00b2_\u03b1 + \u03c3\u00b2_\u03b2)',
    live: (conf: number, noise: number) => [
      `\u03c3_\u03b8 = ${(0.0241 - conf * 0.0001 + noise * 0.002).toFixed(4)}\u00b0`,
      `\u03b4r = \u00b1${Math.max(8, (182 - conf * 1.6 + noise * 12)).toFixed(0)} km`,
      `SNR  = ${(14.2 + conf * 0.08 + noise * 0.6).toFixed(1)} dB`,
    ],
  },
  {
    label: 'FLUX CROSS-SECTION',
    eq:   '\u03a6 = \u222b\u222b J\u20d7 \u00b7 dA\u20d7',
    live: (conf: number, noise: number) => [
      `\u03a6 = ${(3.18 + noise * 0.22).toFixed(4)} \u00d7 10\u2079 W/m\u00b2`,
      `\u03c3_eff = ${(6.44 + noise * 0.11).toFixed(2)} \u00d7 10\u2076 km\u00b2`,
      `\u03bb_col = ${(0.872 - conf * 0.002 + noise * 0.01).toFixed(3)}`,
    ],
  },
  {
    label: 'INTERCEPT WINDOW',
    eq:   '\u03b8_w = arccos(v\u20d7\u00b7r\u0302 / |v|)',
    live: (conf: number, noise: number) => [
      `\u03b8_w   = ${(23.4 + noise * 5.2).toFixed(2)}\u00b0`,
      `\u0394t_w  = ${Math.max(1.2, (18.6 - conf * 0.12 + noise * 1.1)).toFixed(1)} s`,
      `P_hit  = ${Math.min(99.9, conf + noise * 3).toFixed(1)} %`,
    ],
  },
] as const;
const ASTEROID_R    = 44;   // visual radius of the asteroid
const COUNTDOWN_S   = 3;
const RESULTS_S     = 1.8;
const PAUSE_S       = 0.5;  // inter-reticle pause
const CLUSTER_RETICLES_PER_TARGET = 3;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ---- Component ---------------------------------------------------

export function PreInterceptionScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const hitSfxRef = useRef<HTMLAudioElement | null>(null);
  const offeredWeaponMods = useGameStore((s) => s.offeredWeaponMods);
  const selectedWeaponModId = useGameStore((s) => s.selectedWeaponModId);
  const selectWeaponMod = useGameStore((s) => s.selectWeaponMod);
  const trainingModeActive = useGameStore((s) => s.trainingModeActive);
  const preInterceptTutorialActive = useGameStore((s) => s.preInterceptTutorialActive);
  const completePreInterceptTutorial = useGameStore((s) => s.completePreInterceptTutorial);
  const [tutorialStep, setTutorialStep] = useState<0 | 1 | 2 | 3>(0);
  const tutorialStepRef = useRef<0 | 1 | 2 | 3>(0);

  const anim = useRef<AnimState>({
    stars: [],
    asteroids: [],
    activeTargetIndex: 0,
    clusterStormActive: false,
    reticlesPerTarget: CLUSTER_RETICLES_PER_TARGET,
    reticlesUsedOnTarget: 0,
    reticleCount: 3,
    currentReticleIndex: 0,
    reticleX: -80,
    reticleY: 0,
    reticleSpeedPx: 280,
    reticleTime: 0,
    reticleDriftAmp: 0,
    reticleDriftFreq: 0,
    reticleDriftPhase: 0,
    reticleSpeedPulse: 0,
    reticleSpeedPulseFreq: 0,
    reticleSpeedPulsePhase: 0,
    reticleVelX: 0,
    reticleVelY: 0,
    reticlePattern: 'direct',
    reticlePatternAmp: 0,
    reticlePatternFreq: 0,
    reticlePatternPhase: 0,
    reticlePatternLabel: 'DIRECT',
    reticleJammerActive: false,
    currentHitRadius: BASE_HIT_RADIUS,
    currentReticleVerticalTolerance: 20,
    baseHitRadius: BASE_HIT_RADIUS,
    baseReticleVerticalTolerance: 20,
    hitRadius: BASE_HIT_RADIUS,
    reticleVerticalTolerance: 20,
    difficulty: 0,
    reticleActive: false, reticleResolved: false,
    playerPressed: false, pauseTimer: 0,
    hits: 0,
    streak: 0,
    bestStreak: 0,
    precisionSum: 0,
    lastTimestamp: 0,
    countdownRemaining: COUNTDOWN_S, countdownPhase: true, lastCountdownDisplay: COUNTDOWN_S,
    resultsTimer: 0, resultsPhase: false,
    flashTimer: 0, flashType: null,
    minSpeed: 240, maxSpeed: 340,
    transitionPhase: false, transitionTimer: 0,
    transitionAccuracy: 0, transitionLines: [],
    triTime: 0, triConfidence: 0, triEquationTimer: 0,
    triEquationIdx: 0, triUpdateTimer: 0,
    ringAngles: [0, 2.1, 4.2],
    ringTime: 0,
    ringLockedCount: 0,
    ringShakeTimer: 0,
  });

  const [uiState, setUiState] = useState<UiState>({
    phase: 'countdown',
    hitsDisplay: 0, totalDisplay: 3,
    countdownValue: COUNTDOWN_S,
    accuracy: 0,
    streakDisplay: 0,
    bestStreakDisplay: 0,
    patternLabel: 'DIRECT',
    jammerActive: false,
    flashResult: null,
    triAngle1: 0, triAngle2: 0, triAngle3: 0,
    triBearing: 0, triRangeKm: 4800,
    triConfidence: 0, triEquationIdx: 0,
    triNoise: 0,
    triLockA: false, triLockB: false, triLockC: false,
  });

  useEffect(() => {
    const enabled = trainingModeActive && preInterceptTutorialActive;
    const nextStep: 0 | 1 | 2 | 3 = enabled ? 1 : 0;
    tutorialStepRef.current = nextStep;
    setTutorialStep(nextStep);
  }, [trainingModeActive, preInterceptTutorialActive]);

  useEffect(() => {
    const audio = new Audio(targetLockSfx);
    audio.preload = 'auto';
    audio.volume = applySfxVolume(0.55);
    hitSfxRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      hitSfxRef.current = null;
    };
  }, []);

  // ---- Initialization -------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = (canvas.width  = window.innerWidth);
    const H = (canvas.height = window.innerHeight);

    const store = useGameStore.getState();
    const requireWeaponModSelection = store.offeredWeaponMods.length > 0 && !store.selectedWeaponModId;
    const level = store.level;
    const sourceAsteroids = store.asteroids.length > 0 ? store.asteroids : [{
      id: level * 9973 + 31,
      health: 240,
      maxHealth: 240,
      rotationSpeed: 0.6,
      traits: [],
      weakPoints: [{ angle: 0, arcWidth: 0.5, critMultiplier: 2 }],
      radius: 84,
      fragmentBias: 0,
      asteroidClass: 'standard',
      variant: 'none',
      adaptedTo: null,
      phaseShifted: false,
      clusterIds: [],
      hasFractured: false,
      magneticDriftRad: 0,
    } satisfies AsteroidState];
    const clusterStormActive = store.clusterStormActive && sourceAsteroids.length > 1;
    const reticleCount = clusterStormActive
      ? sourceAsteroids.length * CLUSTER_RETICLES_PER_TARGET
      : Math.min(7, 3 + Math.floor(level / 5));
    const difficulty = clamp(level / 30, 0, 1);
    const slowPct = Math.max(0, Math.min(40, store.consumeReticleSlowBonus?.() ?? 0));
    const slowMul = Math.max(0.45, 1 - slowPct / 100);
    const speedBoost = 1 + difficulty * 0.15 + (clusterStormActive ? 0.06 : 0);
    const minSpeed = Math.min(240 + level * 4, 400) * slowMul * speedBoost;
    const maxSpeed = Math.min(320 + level * 6, 480) * slowMul * speedBoost;
    const hitRadiusBase = BASE_HIT_RADIUS - Math.floor(level / 6) * 2 - (clusterStormActive ? 4 : 0);
    const hitRadius = Math.max(30, Math.round(hitRadiusBase * (1 + slowPct / 250)));
    const reticleVerticalTolerance = Math.max(14, Math.round(hitRadius * 0.45));

    const stars: Star[] = Array.from({ length: 130 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.5 + Math.random() * 1.5,
      brightness: 0.25 + Math.random() * 0.75,
      speed: 45 + Math.random() * 240,
    }));

    const a = anim.current;
    a.stars = stars;
    a.asteroids = layoutPreInterceptTargets(sourceAsteroids, W, H);
    a.activeTargetIndex = 0;
    a.clusterStormActive = clusterStormActive;
    a.reticlesPerTarget = CLUSTER_RETICLES_PER_TARGET;
    a.reticlesUsedOnTarget = 0;
    a.reticleCount = reticleCount;
    a.currentReticleIndex = 0;
    a.reticleX = -80;
    a.reticleY = H * 0.5;
    a.reticleSpeedPx = minSpeed + Math.random() * (maxSpeed - minSpeed);
    a.reticleTime = 0;
    a.reticleDriftAmp = 0;
    a.reticleDriftFreq = 0;
    a.reticleDriftPhase = 0;
    a.reticleSpeedPulse = 0;
    a.reticleSpeedPulseFreq = 0;
    a.reticleSpeedPulsePhase = 0;
    a.reticleVelX = 0;
    a.reticleVelY = 0;
    a.reticlePattern = 'direct';
    a.reticlePatternAmp = 0;
    a.reticlePatternFreq = 0;
    a.reticlePatternPhase = 0;
    a.reticlePatternLabel = 'DIRECT';
    a.reticleJammerActive = false;
    a.currentHitRadius = hitRadius;
    a.currentReticleVerticalTolerance = reticleVerticalTolerance;
    a.baseHitRadius = hitRadius;
    a.baseReticleVerticalTolerance = reticleVerticalTolerance;
    a.hitRadius = hitRadius;
    a.reticleVerticalTolerance = reticleVerticalTolerance;
    a.difficulty = difficulty;
    a.reticleActive = false;
    a.reticleResolved = false;
    a.playerPressed = false;
    a.pauseTimer = 0;
    a.hits = 0;
    a.streak = 0;
    a.bestStreak = 0;
    a.precisionSum = 0;
    a.countdownRemaining = COUNTDOWN_S;
    a.countdownPhase = !requireWeaponModSelection;
    a.lastCountdownDisplay = COUNTDOWN_S;
    a.resultsTimer = 0;
    a.resultsPhase = false;
    a.flashTimer = 0;
    a.flashType = null;
    a.minSpeed = minSpeed;
    a.maxSpeed = maxSpeed;
    a.transitionPhase = false;
    a.transitionTimer = 0;
    a.transitionAccuracy = 0;
    a.transitionLines = [];
    a.triTime = 0;
    a.triConfidence = 0;
    a.triEquationTimer = 0;
    a.triEquationIdx = 0;
    a.triUpdateTimer = 0;
    a.ringAngles = [0, 2.1, 4.2];
    a.ringTime = 0;
    a.ringLockedCount = 0;
    a.ringShakeTimer = 0;
    a.lastTimestamp = performance.now();

    setUiState({
      phase: 'countdown',
      hitsDisplay: 0,
      totalDisplay: reticleCount,
      countdownValue: COUNTDOWN_S,
      accuracy: 0,
      streakDisplay: 0,
      bestStreakDisplay: 0,
      patternLabel: 'DIRECT',
      jammerActive: false,
      flashResult: null,
      triAngle1: 0, triAngle2: 0, triAngle3: 0,
      triBearing: 0, triRangeKm: 4800,
      triConfidence: 0, triEquationIdx: 0,
      triNoise: 0,
      triLockA: false, triLockB: false, triLockC: false,
    });

    // ---- RAF loop -----------------------------------------------
    const tick = (timestamp: number) => {
      const a = anim.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;

      const rawDelta = (timestamp - a.lastTimestamp) / 1000;
      const delta = Math.min(rawDelta, 0.1); // cap at 100 ms to survive tab-blur pauses
      a.lastTimestamp = timestamp;

      const W = canvas.width;
      const H = canvas.height;

      // Starfield drift to sell fast movement through space.
      for (const star of a.stars) {
        star.x -= star.speed * delta;
        if (star.x < -8) {
          star.x = W + 8;
          star.y = Math.random() * H;
        }
      }

      // ── Update ─────────────────────────────────────────────
      const tutorialPaused = tutorialStepRef.current === 1;
      if (tutorialPaused) {
        drawFrame(ctx, W, H, a);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (a.countdownPhase) {
        a.countdownRemaining -= delta;
        const display = Math.ceil(Math.max(0, a.countdownRemaining));
        if (display !== a.lastCountdownDisplay) {
          a.lastCountdownDisplay = display;
          setUiState((prev) => ({ ...prev, countdownValue: display }));
        }
        if (a.countdownRemaining <= 0) {
          a.countdownPhase = false;
          spawnReticle(a, W, H);
          setUiState((prev) => ({
            ...prev,
            phase: 'playing',
            patternLabel: a.reticlePatternLabel,
            jammerActive: a.reticleJammerActive,
          }));
        }

      } else if (a.resultsPhase && !a.transitionPhase) {
        a.resultsTimer -= delta;
        if (a.resultsTimer <= 0) {
          // Enter speed-lines transition before finalizeInterception
          a.transitionAccuracy = computeFinalAccuracy(a);
          a.transitionPhase = true;
          a.transitionTimer = 0;
          a.transitionLines = buildTransitionLines(W, H);
          setUiState((prev) => ({ ...prev, phase: 'transition' }));
        }

      } else if (a.transitionPhase) {
        a.transitionTimer += delta;
        // Advance speed lines
        const fullRange = H + W * TRANS_SLOPE + 200;
        for (const line of a.transitionLines) {
          line.b += line.speed * delta;
          if (line.b > H + 100) line.b -= fullRange;
        }
        if (a.transitionTimer >= 2.0) {
          useGameStore.getState().finalizeInterception(a.transitionAccuracy);
          return; // stop RAF
        }

      } else {
        // Playing
        for (const asteroid of a.asteroids) {
          asteroid.prevX = asteroid.x;
          asteroid.prevY = asteroid.y;
          asteroid.sinePhase += delta * (Math.PI * 2 / 2.9);
          asteroid.driftPhase += delta * 2.8;
          asteroid.driftPhase2 += delta * 5.2;
          asteroid.x += asteroid.flowVelX * delta;
          asteroid.y += asteroid.flowVelY * delta;
          asteroid.x += Math.sin(asteroid.driftPhase2 * 0.55) * 10 * delta;
          asteroid.y += Math.cos(asteroid.driftPhase2 * 0.38) * 7 * delta;
          if (asteroid.x <= asteroid.flowMinX) {
            asteroid.x = asteroid.flowMinX;
            asteroid.flowVelX = Math.abs(asteroid.flowVelX);
          } else if (asteroid.x >= asteroid.flowMaxX) {
            asteroid.x = asteroid.flowMaxX;
            asteroid.flowVelX = -Math.abs(asteroid.flowVelX);
          }
          if (asteroid.y <= asteroid.flowMinY) {
            asteroid.y = asteroid.flowMinY;
            asteroid.flowVelY = Math.abs(asteroid.flowVelY);
          } else if (asteroid.y >= asteroid.flowMaxY) {
            asteroid.y = asteroid.flowMaxY;
            asteroid.flowVelY = -Math.abs(asteroid.flowVelY);
          }
          asteroid.rotation += delta * (1.1 + Math.abs(Math.sin(asteroid.driftPhase2)) * 1.5);
        }

        // ── Ring orbit animation ──────────────────────────────
        const RING_SPIN = [1.1, -0.7, 1.45] as const;
        a.ringTime += delta;
        const shakeMul = a.ringShakeTimer > 0 ? 5.0 : 1.0;
        for (let i = 0; i < 3; i++) {
          // Locked rings (gold) spin very slowly; unlocked spin fast when shaking
          const locked = i >= (3 - a.ringLockedCount); // outermost locks first
          a.ringAngles[i] += RING_SPIN[i] * (locked ? 0.06 : shakeMul) * delta;
        }
        if (a.ringShakeTimer > 0) a.ringShakeTimer -= delta;

        // Flash decay
        if (a.flashTimer > 0) {
          a.flashTimer -= delta;
          if (a.flashTimer <= 0) {
            a.flashType = null;
            setUiState((prev) => ({ ...prev, flashResult: null }));
          }
        }

        if (a.reticleActive) {
          // Move reticle
          a.reticleTime += delta;
          const speedPulse =
            1 + Math.sin(a.reticleTime * a.reticleSpeedPulseFreq + a.reticleSpeedPulsePhase) * a.reticleSpeedPulse;
          a.reticleX += a.reticleVelX * speedPulse * delta;
          a.reticleY += a.reticleVelY * speedPulse * delta;
          const lateral = computeReticlePatternOffset(a);
          if (lateral !== 0) {
            const len = Math.max(1, Math.hypot(a.reticleVelX, a.reticleVelY));
            const nx = -a.reticleVelY / len;
            const ny = a.reticleVelX / len;
            a.reticleX += nx * lateral * delta;
            a.reticleY += ny * lateral * delta;
          }

          // Exit check
          const exited =
            a.reticleX > W + 100
            || a.reticleX < -100
            || a.reticleY > H + 100
            || a.reticleY < -100;
          if (exited) {
            if (!a.reticleResolved) {
              // Auto-miss
              a.streak = 0;
              a.flashType = 'miss';
              a.flashTimer = 0.35;
              a.ringShakeTimer = 0.65;
              setUiState((prev) => ({ ...prev, flashResult: 'miss', streakDisplay: 0 }));
            }
            a.reticleActive = false;
            a.pauseTimer = PAUSE_S;
          }

        } else if (a.pauseTimer > 0) {
          a.pauseTimer -= delta;
          if (a.pauseTimer <= 0) {
            a.currentReticleIndex++;
            if (a.clusterStormActive) {
              a.reticlesUsedOnTarget += 1;
              if (
                a.reticlesUsedOnTarget >= a.reticlesPerTarget &&
                a.activeTargetIndex < a.asteroids.length - 1
              ) {
                a.activeTargetIndex += 1;
                a.reticlesUsedOnTarget = 0;
              }
            }
            if (a.currentReticleIndex >= a.reticleCount) {
              // All done — results phase
              a.resultsPhase = true;
              a.resultsTimer = RESULTS_S;
              const accuracy = computeFinalAccuracy(a);
              setUiState((prev) => ({
                ...prev,
                phase: 'results',
                accuracy,
                hitsDisplay: a.hits,
                streakDisplay: a.streak,
                bestStreakDisplay: a.bestStreak,
              }));
            } else {
              spawnReticle(a, W, H);
              setUiState((prev) => ({
                ...prev,
                patternLabel: a.reticlePatternLabel,
                jammerActive: a.reticleJammerActive,
              }));
            }
          }
        }

        // ── Triangulation system update ─────────────────────────
        a.triTime += delta;
        a.triEquationTimer += delta;
        if (a.triEquationTimer >= 2.8) {
          a.triEquationTimer = 0;
          a.triEquationIdx = (a.triEquationIdx + 1) % TRI_EQUATIONS.length;
        }
        const triTarget = getActiveTargetAsteroid(a);
        if (triTarget) {
          const proximity = a.reticleActive
            ? Math.max(0, 1 - Math.abs(a.reticleX - triTarget.x) / (W * 0.45))
            : a.triConfidence;
          const goalConf = clamp(
            0.1 + proximity * 0.55 + (a.hits / Math.max(1, a.reticleCount)) * 0.35,
            0, 1,
          );
          a.triConfidence += (goalConf - a.triConfidence) * delta * 2.0;
        }
        a.triUpdateTimer -= delta;
        if (a.triUpdateTimer <= 0) {
          a.triUpdateTimer = 0.15;
          const t = triTarget ?? (a.asteroids[0] ?? null);
          if (t) {
            const sA = { x: 80, y: 60 };
            const sB = { x: W - 80, y: 60 };
            const sC = { x: W * 0.5, y: H - 50 };
            const ang1 = ((Math.atan2(t.y - sA.y, t.x - sA.x) * 180 / Math.PI) + 360) % 360;
            const ang2 = ((Math.atan2(t.y - sB.y, t.x - sB.x) * 180 / Math.PI) + 360) % 360;
            const ang3 = ((Math.atan2(t.y - sC.y, t.x - sC.x) * 180 / Math.PI) + 360) % 360;
            const brg  = ((Math.atan2(t.x - W * 0.5, -(t.y - H * 0.5)) * 180 / Math.PI) + 360) % 360;
            const rng  = Math.max(200, 4800 - a.hits * 640 - a.triConfidence * 1400 + (Math.random() - 0.5) * 90);
            const conf = Math.round(a.triConfidence * 100);
            setUiState((prev) => ({
              ...prev,
              triAngle1: ang1,
              triAngle2: ang2,
              triAngle3: ang3,
              triBearing: brg,
              triRangeKm: rng,
              triConfidence: conf,
              triEquationIdx: a.triEquationIdx,
              triNoise: Math.random(),
              triLockA: a.hits > 0 || a.triConfidence > 0.48,
              triLockB: a.hits > 1 || a.triConfidence > 0.66,
              triLockC: a.hits > 2 || a.triConfidence > 0.84,
            }));
          }
        }
      }

      // ── Draw ───────────────────────────────────────────────
      drawFrame(ctx, W, H, a);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    // Resize handler
    const onResize = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width  = window.innerWidth;
      canvasRef.current.height = window.innerHeight;
      const current = anim.current;
      current.asteroids = relayoutPreInterceptTargets(current.asteroids, window.innerWidth, window.innerHeight);
      current.activeTargetIndex = Math.min(current.activeTargetIndex, Math.max(0, current.asteroids.length - 1));
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- SPACE key handler ----------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();

      if (tutorialStepRef.current === 1) {
        tutorialStepRef.current = 2;
        setTutorialStep(2);
        return;
      }

      const a = anim.current;
      if (a.countdownPhase || a.resultsPhase) return;
      if (!a.reticleActive || a.reticleResolved || a.playerPressed) return;

      a.playerPressed = true;
      a.reticleResolved = true;

      const target = getActiveTargetAsteroid(a);
      const targetX = target?.x ?? 0;
      const targetY = target?.y ?? 0;
      const isHit =
        Math.abs(a.reticleX - targetX) <= a.currentHitRadius
        && Math.abs(a.reticleY - targetY) <= a.currentReticleVerticalTolerance;

      if (isHit) {
        a.hits++;
        a.streak += 1;
        a.bestStreak = Math.max(a.bestStreak, a.streak);
        const precisionX = Math.abs(a.reticleX - targetX) / Math.max(1, a.currentHitRadius);
        const precisionY = Math.abs(a.reticleY - targetY) / Math.max(1, a.currentReticleVerticalTolerance);
        const precision = clamp(1 - (precisionX * 0.7 + precisionY * 0.3), 0, 1);
        a.precisionSum += precision;
        a.flashType = 'hit';
        a.flashTimer = 0.38;
        a.ringLockedCount = Math.min(3, a.ringLockedCount + 1);
        a.ringShakeTimer = 0;
        const sfx = hitSfxRef.current;
        if (sfx) {
          sfx.currentTime = 0;
          void sfx.play().catch(() => {});
        }
        if (tutorialStepRef.current === 2) {
          tutorialStepRef.current = 3;
          setTutorialStep(3);
          completePreInterceptTutorial();
        }
      } else {
        a.streak = 0;
        a.flashType = 'miss';
        a.flashTimer = 0.38;
        a.ringShakeTimer = 0.65;
      }

      a.reticleActive = false;
      a.pauseTimer = PAUSE_S;

      setUiState((prev) => ({
        ...prev,
        hitsDisplay: a.hits,
        streakDisplay: a.streak,
        bestStreakDisplay: a.bestStreak,
        flashResult: isHit ? 'hit' : 'miss',
      }));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [completePreInterceptTutorial]);

  useEffect(() => {
    if (!selectedWeaponModId) return;
    const a = anim.current;
    if (a.countdownPhase || a.reticleActive || a.currentReticleIndex > 0) return;
    a.countdownRemaining = COUNTDOWN_S;
    a.lastCountdownDisplay = COUNTDOWN_S;
    a.countdownPhase = true;
    setUiState((prev) => ({
      ...prev,
      phase: 'countdown',
      countdownValue: COUNTDOWN_S,
      streakDisplay: 0,
      bestStreakDisplay: 0,
      patternLabel: 'DIRECT',
      jammerActive: false,
    }));
  }, [selectedWeaponModId]);

  // ---- Render ---------------------------------------------------
  const barPct = uiState.totalDisplay > 0
    ? (uiState.hitsDisplay / uiState.totalDisplay) * 100
    : 0;
  const waitingForModSelection = offeredWeaponMods.length > 0 && !selectedWeaponModId;

  const accuracyColor =
    uiState.accuracy >= 0.7 ? '#00ff88'
    : uiState.accuracy >= 0.4 ? '#ffaa00'
    : '#ff4444';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      background: '#060a14',
      zIndex: 160,
    }}>
      {/* Canvas — full screen */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, display: 'block' }}
      />
      {tutorialStep === 1 && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          background: 'rgba(2,8,18,0.66)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div className="tutorial-gold-target" style={{
            border: '1px solid #3f6b8f',
            borderRadius: 10,
            background: 'rgba(7,16,29,0.95)',
            padding: '14px 18px',
            maxWidth: 520,
            textAlign: 'center',
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            <div style={{ color: '#9fdcff', fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, marginBottom: 8 }}>
              PRE-INTERCEPTION TRAINING
            </div>
            <div style={{ color: '#9ab7d0', fontSize: 12, lineHeight: 1.5 }}>
              Step 1: Press <span style={{ color: '#00ffcc' }}>SPACE</span> to arm target-tracking.
            </div>
          </div>
        </div>
      )}
      {tutorialStep === 2 && (
        <div style={{
          position: 'absolute',
          left: '50%',
          top: 18,
          transform: 'translateX(-50%)',
          zIndex: 4,
          border: '1px solid #3f6b8f',
          borderRadius: 8,
          background: 'rgba(7,16,29,0.9)',
          padding: '8px 12px',
          color: '#9fdcff',
          fontSize: 11,
          fontFamily: 'Share Tech Mono, monospace',
          letterSpacing: 1,
          pointerEvents: 'none',
        }}>
          Step 2: Press SPACE when reticle aligns with asteroid.
        </div>
      )}
      {tutorialStep === 2 && (
        <div
          className="tutorial-gold-target-soft"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(44vw, 420px)',
            height: 'min(44vw, 420px)',
            borderRadius: '50%',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />
      )}
      {uiState.phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            backgroundImage: `
              linear-gradient(rgba(76, 164, 220, 0.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(76, 164, 220, 0.14) 1px, transparent 1px),
              linear-gradient(rgba(118, 214, 255, 0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(118, 214, 255, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '88px 88px, 88px 88px, 22px 22px, 22px 22px',
            backgroundPosition: '-1px -1px, -1px -1px, -1px -1px, -1px -1px',
            boxShadow: 'inset 0 0 120px rgba(2, 7, 18, 0.78)',
          }}
        />
      )}

      {/* ── Progress bar — top strip ── */}
      {uiState.phase !== 'countdown' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 5,
          background: '#060a14',
          zIndex: 1,
        }}>
          <div style={{
            height: '100%',
            width: `${barPct}%`,
            background: '#00ffcc',
            transition: 'width 0.2s ease',
            boxShadow: '0 0 8px #00ffcc88',
          }} />
        </div>
      )}

      {waitingForModSelection && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          background: 'rgba(2,7,16,0.72)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{
            width: 'min(720px, 94vw)',
            border: '1px solid #2a4a68',
            borderRadius: 10,
            background: 'rgba(6,12,22,0.96)',
            padding: '16px 18px',
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            <div style={{ color: '#8ed4ff', fontFamily: 'Orbitron, sans-serif', letterSpacing: 2, marginBottom: 8 }}>
              WEAPON MOD DRAFT
            </div>
            <div style={{ color: '#7ea4c4', fontSize: 12, marginBottom: 12 }}>
              Choose one mission mod before lock-on starts.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              {offeredWeaponMods.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => selectWeaponMod(mod.id)}
                  style={{
                    textAlign: 'left',
                    background: 'rgba(8,20,34,0.7)',
                    border: '1px solid #2f6289',
                    color: '#9fd7ff',
                    borderRadius: 8,
                    padding: '10px 11px',
                    cursor: 'pointer',
                    fontFamily: 'Share Tech Mono, monospace',
                  }}
                >
                  <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: 1.2, marginBottom: 6 }}>
                    {mod.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#86abc9', lineHeight: 1.45 }}>
                    {mod.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Playing HUD ── */}
      {uiState.phase === 'playing' && (
        <div style={{
          position: 'absolute', top: 14, left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          fontFamily: 'Share Tech Mono, monospace',
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          <div style={{ color: '#ff2266', fontSize: 10, letterSpacing: 4, marginBottom: 4 }}>
            PRE-INTERCEPTION TARGETING
          </div>
          <div style={{ color: '#445566', fontSize: 11 }}>
            RETICLE {anim.current.currentReticleIndex + 1} / {uiState.totalDisplay}
            &nbsp;·&nbsp;
            HITS: <span style={{ color: '#00ffcc' }}>{uiState.hitsDisplay}</span>
            &nbsp;·&nbsp;
            STREAK: <span style={{ color: uiState.streakDisplay >= 2 ? '#ffe06a' : '#8aa0b6' }}>{uiState.streakDisplay}</span>
            {anim.current.clusterStormActive && (
              <>
                &nbsp;·&nbsp;
                TARGET: <span style={{ color: '#ffdd55' }}>
                  {Math.min(anim.current.activeTargetIndex + 1, anim.current.asteroids.length)}
                </span>/{anim.current.asteroids.length}
              </>
            )}
          </div>
          <div style={{ color: '#6f8da6', fontSize: 10, letterSpacing: 2, marginTop: 4 }}>
            TRACK MODE:&nbsp;
            <span style={{ color: uiState.jammerActive ? '#ff7f6e' : '#8fd7ff' }}>
              {uiState.patternLabel}
            </span>
          </div>
          {anim.current.clusterStormActive && (
            <div style={{ color: '#ffdd55', fontSize: 10, letterSpacing: 2, marginTop: 4 }}>
              CLUSTER STORM ACTIVE
            </div>
          )}
        </div>
      )}

      {/* ── SPACE prompt — bottom center ── */}
      {uiState.phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          fontFamily: 'Share Tech Mono, monospace',
          zIndex: 1,
        }}>
          <div style={{
            color: '#334455',
            fontSize: 12,
            letterSpacing: 3,
            border: '1px solid #223344',
            padding: '6px 20px',
            borderRadius: 4,
            background: 'rgba(0,0,0,0.45)',
          }}>
            PRESS <span style={{
              color: '#00ffcc',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 12,
            }}>SPACE</span> WHEN ALIGNED
          </div>
        </div>
      )}

      {/* ── Triangulation Matrix — left panel ── */}
      {uiState.phase === 'playing' && (
        <div style={{
          position: 'absolute', left: 16, top: 80,
          width: 210,
          height: 252,
          background: 'rgba(4,10,24,0.82)',
          border: '1px solid #1a3344',
          borderRadius: 4,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 10,
          color: '#445566',
          pointerEvents: 'none',
          zIndex: 1,
          letterSpacing: 0.5,
        }}>
          <div style={{ color: '#ff2266', letterSpacing: 3, marginBottom: 8, fontSize: 9 }}>
            TRIANGULATION MATRIX
          </div>

          {/* Stations */}
          {(['α','β','γ'] as const).map((label, i) => {
            const lock = [uiState.triLockA, uiState.triLockB, uiState.triLockC][i];
            const angle = [uiState.triAngle1, uiState.triAngle2, uiState.triAngle3][i];
            return (
              <div key={label} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#556677' }}>STATION {label}</span>
                  <span style={{
                    color: lock ? '#00ffcc' : '#223344',
                    fontSize: 8,
                    border: `1px solid ${lock ? '#00ffcc44' : '#1a2233'}`,
                    padding: '1px 5px',
                    borderRadius: 2,
                  }}>
                    {lock ? 'LOCK\u2713' : 'SEEK\u2026'}
                  </span>
                </div>
                {lock && (
                  <div style={{ color: '#334d5c', marginTop: 2, paddingLeft: 4 }}>
                    θ = <span style={{ color: '#4488aa' }}>{angle.toFixed(1)}°</span>
                    &nbsp;&nbsp;el = <span style={{ color: '#4488aa' }}>
                      {(30 + i * 14 + uiState.triNoise * 3).toFixed(1)}°
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid #1a2a3a', margin: '6px 0' }} />

          {/* Computed bearing / range */}
          <div style={{ marginBottom: 3 }}>
            Δθ_αβ = <span style={{ color: '#3a6688' }}>
              {Math.abs(uiState.triAngle1 - uiState.triAngle2).toFixed(1)}°
            </span>
          </div>
          <div style={{ marginBottom: 3 }}>
            BEARING&nbsp;&nbsp;<span style={{ color: '#3a6688' }}>
              {uiState.triBearing.toFixed(0)}°
            </span>
          </div>
          <div>
            RANGE&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#3a6688' }}>
              {uiState.triRangeKm.toFixed(0)} km
            </span>
          </div>

          <div style={{ borderTop: '1px solid #1a2a3a', margin: '6px 0' }} />

          {/* Lock progress */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 9 }}>LOCKS</span>
            {[uiState.triLockA, uiState.triLockB, uiState.triLockC].map((l, i) => (
              <div key={i} style={{
                width: 18, height: 8,
                background: l ? '#00ffcc' : '#0d1e2a',
                border: `1px solid ${l ? '#00ffcc88' : '#1a2a3a'}`,
                borderRadius: 2,
                boxShadow: l ? '0 0 6px #00ffcc66' : 'none',
              }} />
            ))}
            <span style={{ color: '#445566', marginLeft: 2 }}>
              {[uiState.triLockA, uiState.triLockB, uiState.triLockC].filter(Boolean).length}/3
            </span>
          </div>
        </div>
      )}

      {/* ── Impact Vector Calc — right panel ── */}
      {uiState.phase === 'playing' && (() => {
        const eq = TRI_EQUATIONS[uiState.triEquationIdx];
        const liveVals = eq.live(uiState.triConfidence, uiState.triNoise);
        const confPct = uiState.triConfidence;
        const filledBlocks = Math.round(confPct / 10);
        const confBar = '\u2588'.repeat(filledBlocks) + '\u2591'.repeat(10 - filledBlocks);
        const confColor = confPct >= 70 ? '#00ff88' : confPct >= 40 ? '#ffaa00' : '#ff4444';
        return (
          <div style={{
            position: 'absolute', right: 16, top: 80,
            width: 210,
            height: 252,
            background: 'rgba(4,10,24,0.82)',
            border: '1px solid #1a3344',
            borderRadius: 4,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 10,
            color: '#445566',
            pointerEvents: 'none',
            zIndex: 1,
            letterSpacing: 0.5,
          }}>
            <div style={{ color: '#ff2266', letterSpacing: 3, marginBottom: 8, fontSize: 9 }}>
              IMPACT VECTOR CALC
            </div>

            {/* Equation label */}
            <div style={{ color: '#2a4a5a', fontSize: 8, letterSpacing: 2, marginBottom: 4 }}>
              [{eq.label}]
            </div>

            {/* Main equation */}
            <div style={{
              color: '#3a7a99',
              fontSize: 11,
              marginBottom: 8,
              fontStyle: 'italic',
              letterSpacing: 0,
            }}>
              {eq.eq}
            </div>

            {/* Live values */}
            {liveVals.map((v, i) => (
              <div key={i} style={{ color: '#3a6688', marginBottom: 3, paddingLeft: 4 }}>
                {v}
              </div>
            ))}

            <div style={{ borderTop: '1px solid #1a2a3a', margin: '8px 0' }} />

            {/* Confidence bar */}
            <div style={{ marginBottom: 4, fontSize: 9, color: '#334455', letterSpacing: 2 }}>
              SOLVE CONFIDENCE
            </div>
            <div style={{ color: confColor, fontSize: 10, letterSpacing: 0 }}>
              {confBar} <span style={{ fontSize: 11 }}>{confPct}%</span>
            </div>

            <div style={{ borderTop: '1px solid #1a2a3a', margin: '8px 0' }} />

            {/* Pseudo sensor noise */}
            <div style={{ fontSize: 8, color: '#223344', lineHeight: 1.6 }}>
              <div>Σ_noise  = {(uiState.triNoise * 0.0041 + 0.0012).toFixed(5)}</div>
              <div>ε_frame  = {(uiState.triNoise * 1.3 + 0.4).toFixed(4)} ms</div>
              <div>SNR_db    = {(12.4 + uiState.triConfidence * 0.06 + uiState.triNoise * 0.8).toFixed(2)}</div>
            </div>
          </div>
        );
      })()}

      {/* ── Hit / Miss feedback text ── */}
      {uiState.flashResult && (
        <div style={{
          position: 'absolute',
          top: '44%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 30,
          fontWeight: 700,
          color: uiState.flashResult === 'hit' ? '#00ff88' : '#ff2244',
          textShadow: uiState.flashResult === 'hit'
            ? '0 0 22px #00ff8888'
            : '0 0 22px #ff224488',
          pointerEvents: 'none',
          letterSpacing: 4,
          zIndex: 2,
        }}>
          {uiState.flashResult === 'hit' ? 'TARGET LOCKED' : 'MISS'}
        </div>
      )}

      {/* ── Countdown overlay ── */}
      {uiState.phase === 'countdown' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 2,
        }}>
          <div style={{
            color: '#445566',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 11,
            letterSpacing: 5,
            marginBottom: 18,
          }}>
            {anim.current.clusterStormActive ? 'CLUSTER STORM TARGETING ONLINE' : 'TARGETING SYSTEMS ONLINE'}
          </div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 100,
            color: '#00ffcc',
            textShadow: '0 0 40px #00ffcc99, 0 0 80px #00ffcc44',
            lineHeight: 1,
          }}>
            {uiState.countdownValue}
          </div>
        </div>
      )}

      {/* ── Results overlay (hidden once transition starts) ── */}
      {uiState.phase === 'results' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.52)',
          pointerEvents: 'none', zIndex: 2,
        }}>
          <div style={{
            color: '#445566',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 11,
            letterSpacing: 5,
            marginBottom: 14,
          }}>
            TARGETING COMPLETE
          </div>
          <div style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 68,
            color: accuracyColor,
            textShadow: `0 0 30px ${accuracyColor}88`,
            lineHeight: 1,
          }}>
            {Math.round(uiState.accuracy * 100)}%
          </div>
          <div style={{
            marginTop: 14,
            color: '#556677',
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: 13,
          }}>
            {uiState.hitsDisplay} / {uiState.totalDisplay} targets locked
          </div>
          <div style={{
            marginTop: 7,
            color: '#5b6f84',
            fontSize: 11,
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            BEST STREAK: <span style={{ color: '#ffe07a' }}>{uiState.bestStreakDisplay}</span>
          </div>
          <div style={{
            marginTop: 8,
            color: '#334455',
            fontSize: 11,
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            IMPACT TIMER: <span style={{ color: accuracyColor }}>
              {Math.round(45 + uiState.accuracy * 45)}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Helpers outside component (stable references, no closure capture) ----

function spawnReticle(a: AnimState, W: number, H: number) {
  const target = getActiveTargetAsteroid(a);
  const targetX = target?.x ?? W * 0.5;
  const targetY = target?.y ?? H * 0.5;
  const progress = a.reticleCount > 1 ? a.currentReticleIndex / (a.reticleCount - 1) : 0;
  const rampDifficulty = clamp(a.difficulty + progress * 0.38 + (a.clusterStormActive ? 0.08 : 0), 0, 1.25);
  const roll = Math.random();
  let reticlePattern: ReticlePattern = 'direct';
  if (rampDifficulty >= 0.22) {
    if (roll < 0.28) reticlePattern = 'direct';
    else if (roll < 0.62) reticlePattern = 'zigzag';
    else if (roll < 0.86) reticlePattern = 'sweep';
    else reticlePattern = 'burst';
  }
  if (a.currentReticleIndex > 0 && a.currentReticleIndex % 4 === 0 && reticlePattern === 'direct') {
    reticlePattern = Math.random() < 0.5 ? 'zigzag' : 'sweep';
  }
  const speedMul =
    1
    + progress * 0.24
    + (reticlePattern === 'burst' ? 0.14 : 0)
    + (reticlePattern === 'zigzag' ? 0.05 : 0);
  const patternAmp =
    reticlePattern === 'zigzag' ? 84 + rampDifficulty * 74
    : reticlePattern === 'sweep' ? 58 + rampDifficulty * 44
    : reticlePattern === 'burst' ? 38 + rampDifficulty * 34
    : 0;
  const patternFreq =
    reticlePattern === 'zigzag' ? 7.4 + rampDifficulty * 2.4
    : reticlePattern === 'sweep' ? 3.2 + rampDifficulty * 1.2
    : reticlePattern === 'burst' ? 11.4 + rampDifficulty * 3.2
    : 0;
  const reticleJammerActive = rampDifficulty > 0.46 && Math.random() < (0.18 + rampDifficulty * 0.18);
  const windowScaleBase =
    reticlePattern === 'burst' ? 0.88
    : reticlePattern === 'zigzag' ? 0.93
    : reticlePattern === 'sweep' ? 0.95
    : 1;
  const windowScale = reticleJammerActive ? windowScaleBase * 0.8 : windowScaleBase;
  const spawn = createReticleSpawn(
    W,
    H,
    a.minSpeed * speedMul,
    a.maxSpeed * speedMul,
    rampDifficulty,
    targetX,
    targetY,
  );
  a.reticleX = spawn.reticleX;
  a.reticleY = spawn.reticleY;
  a.reticleTime = 0;
  a.reticleSpeedPx = spawn.reticleSpeedPx;
  a.reticleDriftAmp = spawn.reticleDriftAmp;
  a.reticleDriftFreq = spawn.reticleDriftFreq;
  a.reticleDriftPhase = spawn.reticleDriftPhase;
  a.reticleSpeedPulse = spawn.reticleSpeedPulse;
  a.reticleSpeedPulseFreq = spawn.reticleSpeedPulseFreq;
  a.reticleSpeedPulsePhase = spawn.reticleSpeedPulsePhase;
  a.reticleVelX = spawn.reticleVelX;
  a.reticleVelY = spawn.reticleVelY;
  a.reticlePattern = reticlePattern;
  a.reticlePatternAmp = patternAmp;
  a.reticlePatternFreq = patternFreq;
  a.reticlePatternPhase = Math.random() * Math.PI * 2;
  a.reticleJammerActive = reticleJammerActive;
  a.reticlePatternLabel =
    `${reticlePattern.toUpperCase()}${reticleJammerActive ? ' + JAMMER' : ''}`;
  a.currentHitRadius = Math.max(18, Math.round(a.baseHitRadius * (1 - progress * 0.12) * windowScale));
  a.currentReticleVerticalTolerance = Math.max(
    10,
    Math.round(a.baseReticleVerticalTolerance * (1 - progress * 0.1) * windowScale),
  );
  a.reticleActive = true;
  a.reticleResolved = false;
  a.playerPressed = false;
}

function getActiveTargetAsteroid(a: AnimState): PreInterceptTarget | null {
  return getActivePreInterceptTarget(a.asteroids, a.activeTargetIndex);
}

function computeReticlePatternOffset(a: AnimState): number {
  if (a.reticlePattern === 'direct' || a.reticlePatternAmp <= 0 || a.reticlePatternFreq <= 0) return 0;
  const t = a.reticleTime;
  if (a.reticlePattern === 'zigzag') {
    const tri = (2 / Math.PI) * Math.asin(Math.sin(t * a.reticlePatternFreq + a.reticlePatternPhase));
    return tri * a.reticlePatternAmp;
  }
  if (a.reticlePattern === 'sweep') {
    return Math.sin(t * a.reticlePatternFreq + a.reticlePatternPhase) * a.reticlePatternAmp;
  }
  const burstGate = Math.max(0, Math.sin(t * (a.reticlePatternFreq * 0.5) + a.reticlePatternPhase));
  return Math.sin(t * a.reticlePatternFreq + a.reticlePatternPhase) * a.reticlePatternAmp * burstGate;
}

function computeFinalAccuracy(a: AnimState): number {
  const baseAccuracy = a.reticleCount > 0 ? a.hits / a.reticleCount : 0;
  const precisionAvg = a.hits > 0 ? a.precisionSum / a.hits : 0;
  const streakFactor = a.reticleCount > 0 ? Math.min(1, a.bestStreak / Math.max(2, Math.ceil(a.reticleCount * 0.42))) : 0;
  const comboBonus = streakFactor * 0.08;
  return clamp(baseAccuracy * 0.78 + precisionAvg * 0.22 + comboBonus, 0, 1);
}

// ---- Speed-lines transition constants ---------------------------

// Slope of the speed lines (screen-space: y increases downward).
// 0.7 ≈ 35° from horizontal, matching the reference image.
const TRANS_SLOPE = 0.7;
const TRANS_DURATION = 2.0; // seconds

const LINE_COLORS = [
  { color: '#ff00cc', glow: '#ff00cc' }, // hot magenta
  { color: '#ffff00', glow: '#ffff88' }, // yellow
  { color: '#ff4400', glow: '#ff6600' }, // orange-red
  { color: '#ffffff', glow: '#ffffff' }, // white
  { color: '#ff0077', glow: '#ff0077' }, // deep pink
  { color: '#bb00ff', glow: '#cc44ff' }, // purple
  { color: '#ff8800', glow: '#ffaa22' }, // amber
  { color: '#ffffcc', glow: '#ffff99' }, // pale yellow
];

function buildTransitionLines(W: number, H: number): TransitionLine[] {
  const lines: TransitionLine[] = [];
  const fullRange = H + W * TRANS_SLOPE + 200;
  // Spread initial positions so the screen is covered from frame 1
  for (let i = 0; i < 55; i++) {
    const c = LINE_COLORS[Math.floor(Math.random() * LINE_COLORS.length)];
    lines.push({
      b: -W * TRANS_SLOPE - 100 + Math.random() * fullRange,
      speed: 320 + Math.random() * 680,  // 320–1000 px/s
      width: Math.random() < 0.6 ? 1 + Math.random() * 2 : 4 + Math.random() * 6,
      color: c.color,
      glowColor: c.glow,
      alpha: 0.55 + Math.random() * 0.45,
    });
  }
  return lines;
}

function drawTransition(ctx: CanvasRenderingContext2D, W: number, H: number, a: AnimState) {
  const t = Math.min(a.transitionTimer / TRANS_DURATION, 1);

  // Background fades from near-white flash at t=0 to deep black by t=0.25
  const bgWhite = Math.max(0, 1 - t * 5);        // 1→0 over first 0.2 s
  const bgAlpha = Math.max(0.92, 1 - t * 0.08);  // stays very dark after flash
  ctx.fillStyle = bgWhite > 0
    ? `rgb(${Math.round(bgWhite * 255)},${Math.round(bgWhite * 255)},${Math.round(bgWhite * 255)})`
    : '#05080f';
  ctx.fillRect(0, 0, W, H);

  // Overall brightness envelope: ramp in, sustain, ramp out
  const envelope =
    t < 0.1 ? t / 0.1
    : t > 0.8 ? (1 - t) / 0.2
    : 1;

  // Draw each speed line
  for (const line of a.transitionLines) {
    const x1 = -120;
    const y1 = TRANS_SLOPE * x1 + line.b;
    const x2 = W + 120;
    const y2 = TRANS_SLOPE * x2 + line.b;

    const alpha = line.alpha * envelope * (1 - bgWhite * 0.8);
    if (alpha <= 0) continue;

    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);

    // Glow pass (thick, low opacity)
    ctx.shadowColor = line.glowColor;
    ctx.shadowBlur  = line.width * 5;
    ctx.strokeStyle = line.glowColor;
    ctx.lineWidth   = line.width * 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Core pass (sharp, full color)
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = line.color;
    ctx.lineWidth   = line.width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
  }

  // Additive white leading edge at start
  if (bgWhite > 0) {
    ctx.fillStyle = `rgba(255,255,255,${bgWhite * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---- Normal frame draw ------------------------------------------

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  a: AnimState,
) {
  // Speed-lines transition overrides normal drawing
  if (a.transitionPhase) {
    drawTransition(ctx, W, H, a);
    return;
  }

  // ── Layer 1: Background ──────────────────────────────────
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, W, H);

  // ── Layer 2: Starfield ───────────────────────────────────
  for (const star of a.stars) {
    ctx.globalAlpha = star.brightness;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.7, star.r * 0.9);
    ctx.beginPath();
    ctx.moveTo(star.x + star.speed * 0.02, star.y);
    ctx.lineTo(star.x, star.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Layer 2b: Triangulation station markers + lines ──────
  drawTriangulationOverlay(ctx, W, H, a);

  // ── Layer 3: Asteroid ────────────────────────────────────
  if (!a.resultsPhase) {
    const progressZoom = a.reticleCount > 0 ? (a.hits / a.reticleCount) * 0.95 : 0;
    const hitPulse = a.flashType === 'hit' ? (Math.max(0, a.flashTimer) / 0.38) * 0.45 : 0;
    const asteroidScale = Math.min(1.85, 0.44 + progressZoom + hitPulse);
    for (let i = 0; i < a.asteroids.length; i++) {
      const asteroid = a.asteroids[i];
      const isActive = i === a.activeTargetIndex;
      const perTargetScale = isActive ? asteroidScale : asteroidScale * 0.9;
      drawTargetAsteroid(ctx, asteroid, isActive && a.clusterStormActive, perTargetScale);
    }
  }

  // ── Layer 4: Hit-window guide ────────────────────────────
  if (!a.countdownPhase && !a.resultsPhase && a.reticleActive) {
    const target = getActiveTargetAsteroid(a);
    if (target) {
      const ay = target.y;
      const ax = target.x;
      ctx.save();
      ctx.strokeStyle = a.reticleJammerActive ? 'rgba(255,110,92,0.2)' : 'rgba(0,255,204,0.13)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      const hitRadius = a.currentHitRadius;
      const vTol = a.currentReticleVerticalTolerance;
      // Left boundary
      ctx.beginPath();
      ctx.moveTo(ax - hitRadius, ay - vTol);
      ctx.lineTo(ax - hitRadius, ay + vTol);
      ctx.stroke();
      // Right boundary
      ctx.beginPath();
      ctx.moveTo(ax + hitRadius, ay - vTol);
      ctx.lineTo(ax + hitRadius, ay + vTol);
      ctx.stroke();
      // Top/bottom boundary
      ctx.beginPath();
      ctx.moveTo(ax - hitRadius, ay - vTol);
      ctx.lineTo(ax + hitRadius, ay - vTol);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax - hitRadius, ay + vTol);
      ctx.lineTo(ax + hitRadius, ay + vTol);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ── Layer 4b: Orbit rings ────────────────────────────────
  drawOrbitRings(ctx, W, H, a);

  // ── Layer 5: Reticle ─────────────────────────────────────
  if (!a.countdownPhase && !a.resultsPhase && a.reticleActive) {
    const target = getActiveTargetAsteroid(a);
    const ry = a.reticleY;
    const rx = a.reticleX;
    const targetX = target?.x ?? W * 0.5;
    const targetY = target?.y ?? H * 0.5;
    const inWindow =
      Math.abs(rx - targetX) <= a.currentHitRadius
      && Math.abs(ry - targetY) <= a.currentReticleVerticalTolerance;

    // Size pulses: two overlapping sine waves for erratic feel
    const sizePulse =
      Math.sin(a.reticleTime * 11.3 + 0.0) * 0.18
      + Math.sin(a.reticleTime * 17.7 + 1.2) * 0.09
      + Math.sin(a.reticleTime * 6.1  + 2.8) * 0.06;
    const rScale = 1 + sizePulse;
    const outerR = 28 * rScale;
    const innerR = 18 * rScale;
    const color  = inWindow ? '#00ffcc' : (a.reticleJammerActive ? '#ff6f56' : '#ff8800');

    ctx.save();
    ctx.translate(rx, ry);

    if (inWindow) {
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur  = 18;
    }

    // Outer ring
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs — 4 stubs
    ctx.lineWidth = 1.5;
    const stubs: [number, number, number, number][] = [
      [0, -(outerR + 10), 0, -(outerR - 4)],   // top
      [0,  outerR - 4,    0,  outerR + 10],     // bottom
      [-(outerR + 10), 0, -(outerR - 4), 0],    // left
      [ outerR - 4,    0,  outerR + 10,  0],    // right
    ];
    for (const [x1, y1, x2, y2] of stubs) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Centre dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Layer 6: Hit/miss flash overlay ─────────────────────
  if (a.flashTimer > 0 && a.flashType) {
    const alpha = (a.flashTimer / 0.38) * 0.16;
    ctx.fillStyle = a.flashType === 'hit'
      ? `rgba(0,255,136,${alpha})`
      : `rgba(255,34,34,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawTargetAsteroid(
  ctx: CanvasRenderingContext2D,
  asteroid: PreInterceptTarget,
  activeGlow: boolean,
  scale: number,
) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);
  ctx.scale(scale, scale);

  const R = asteroid.radius;
  const profile = asteroid.profile;
  const pal = asteroid.palette;
  const baseHex = numToHexColor(pal.body);
  const rimHex = numToHexColor(pal.rim);
  const craterHex = numToHexColor(pal.crater);

  // Shadow beneath
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(6, 10, R * 0.9, R * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (activeGlow) {
    ctx.shadowColor = 'rgba(255,228,90,0.9)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(255,220,60,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const bodyGrad = ctx.createRadialGradient(-R * 0.35, -R * 0.3, R * 0.1, 0, 0, R * 1.05);
  bodyGrad.addColorStop(0, shiftHex(baseHex, 40));
  bodyGrad.addColorStop(0.55, baseHex);
  bodyGrad.addColorStop(1, shiftHex(baseHex, -72));
  ctx.fillStyle = bodyGrad;

  if (profile && profile.outline.length > 2) {
    ctx.beginPath();
    ctx.moveTo(profile.outline[0].x, profile.outline[0].y);
    for (let i = 1; i < profile.outline.length; i++) {
      ctx.lineTo(profile.outline[i].x, profile.outline[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shiftHex(rimHex, 16);
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shiftHex(rimHex, 16);
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const crater of profile?.craters ?? []) {
    const dist = Math.sqrt(crater.x * crater.x + crater.y * crater.y);
    if (dist + crater.radius > R * 0.95) continue;
    ctx.fillStyle = shiftHex(craterHex, -24);
    ctx.beginPath();
    ctx.arc(crater.x, crater.y, crater.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shiftHex(rimHex, 8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(
      crater.x - crater.radius * 0.2,
      crater.y - crater.radius * 0.2,
      crater.radius * 0.7,
      Math.PI * 1.1,
      Math.PI * 1.9
    );
    ctx.stroke();
  }

  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#8fb0c9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-R * 0.22, -R * 0.22, R * 0.6, Math.PI * 1.05, Math.PI * 1.85);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Orbit rings -------------------------------------------------

const RING_CFG = [
  { r: 72,  dashOn: 10, dashOff:  7, width: 2.5 },
  { r: 100, dashOn: 15, dashOff: 10, width: 2.0 },
  { r: 130, dashOn:  8, dashOff: 12, width: 1.5 },
] as const;

/**
 * Returns the offset of the ring center relative to the asteroid.
 * Ring 0 -> figure-8 (Lissajous 1:2)
 * Ring 1 -> vertical figure-8 (Lissajous 2:1, rotated)
 * Ring 2 -> X cross pattern (combined Lissajous)
 */
function ringOffset(i: number, t: number): { ox: number; oy: number } {
  switch (i) {
    case 0: // figure-8 horizontal
      return { ox: 28 * Math.sin(t * 2.4), oy: 16 * Math.sin(t * 4.8) };
    case 1: // figure-8 vertical (transposed)
      return { ox: 16 * Math.sin(t * 4.2), oy: 30 * Math.sin(t * 2.1 + 0.6) };
    default: // X cross - two diagonal figure-8s combined at +-45 deg
      return {
        ox: 20 * Math.sin(t * 3.0 + Math.PI / 4) + 10 * Math.cos(t * 6.0),
        oy: 20 * Math.cos(t * 3.0 - Math.PI / 4) + 10 * Math.sin(t * 6.0),
      };
  }
}

function drawOrbitRings(
  ctx: CanvasRenderingContext2D,
  _W: number,
  _H: number,
  a: AnimState,
) {
  if (a.countdownPhase || a.resultsPhase || a.transitionPhase) return;
  const target = getActiveTargetAsteroid(a);
  if (!target) return;

  const shaking = a.ringShakeTimer > 0;
  // Shake amplitude fades as timer runs down
  const shakeAmt = shaking ? 40 * Math.min(1, a.ringShakeTimer / 0.3) : 0;

  for (let i = 0; i < 3; i++) {
    const cfg = RING_CFG[i];

    // Outermost ring locks first: ring 2 locked when lockedCount>=1, ring 1 >=2, ring 0 >=3
    const locked = i >= (3 - a.ringLockedCount);

    // Compute offset: pattern for unlocked, zero for locked
    let ox = 0, oy = 0;
    if (!locked) {
      const off = ringOffset(i, a.ringTime);
      ox = off.ox;
      oy = off.oy;
    }

    // Shake: each ring shakes with independent random displacement
    if (shaking && !locked) {
      ox += (Math.random() - 0.5) * shakeAmt * (1.0 + i * 0.5);
      oy += (Math.random() - 0.5) * shakeAmt * (1.0 + i * 0.4);
    }

    const cx = target.x + ox;
    const cy = target.y + oy;

    const color     = locked ? '#ffd700' : shaking ? '#ff1a3a' : '#00ccff';
    const glowColor = locked ? '#ffaa00' : shaking ? '#ff0022' : '#00bbff';
    const alpha     = locked ? 0.92 : shaking ? 0.88 : 0.52;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a.ringAngles[i]);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth   = cfg.width + (locked ? 1.0 : 0);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = locked ? 22 : shaking ? 20 : 9;
    ctx.setLineDash([cfg.dashOn, cfg.dashOff]);
    ctx.beginPath();
    ctx.arc(0, 0, cfg.r, 0, Math.PI * 2);
    ctx.stroke();

    // Wide soft glow halo on locked / shaking
    if (locked || shaking) {
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth   = cfg.width * 5;
      ctx.shadowBlur  = 0;
      ctx.setLineDash([cfg.dashOn * 2, cfg.dashOff * 2]);
      ctx.beginPath();
      ctx.arc(0, 0, cfg.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }
}
const TRI_STATION_POSITIONS = (W: number, H: number) => [
  { x: 80,       y: 60      }, // α — top-left
  { x: W - 80,   y: 60      }, // β — top-right
  { x: W * 0.5,  y: H - 50  }, // γ — bottom-center
];

const TRI_LABELS = ['\u03b1', '\u03b2', '\u03b3']; // α, β, γ

function drawHexMarker(ctx: CanvasRenderingContext2D, x: number, y: number, locked: boolean) {
  const r = 9;
  ctx.save();
  ctx.translate(x, y);
  const col = locked ? '#00ffcc' : '#334466';
  const glow = locked ? '#00ffcc88' : 'transparent';
  ctx.shadowColor = glow;
  ctx.shadowBlur  = locked ? 10 : 0;
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.stroke();
  // Centre dot
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawTriangulationOverlay(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  a: AnimState,
) {
  if (a.countdownPhase || a.resultsPhase || a.transitionPhase) return;
  const target = getActiveTargetAsteroid(a);
  if (!target) return;

  const stations = TRI_STATION_POSITIONS(W, H);
  const locks = [
    a.hits > 0 || a.triConfidence > 0.48,
    a.hits > 1 || a.triConfidence > 0.66,
    a.hits > 2 || a.triConfidence > 0.84,
  ];

  // Draw dashed lines from each station to the asteroid
  for (let i = 0; i < 3; i++) {
    const s = stations[i];
    const locked = locks[i];
    ctx.save();
    ctx.globalAlpha = locked ? 0.30 : 0.12;
    ctx.strokeStyle = locked ? '#00ffcc' : '#2244aa';
    ctx.lineWidth   = locked ? 1.2 : 0.8;
    ctx.setLineDash(locked ? [6, 5] : [3, 7]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small angle arc at station
    if (locked) {
      const angleToTarget = Math.atan2(target.y - s.y, target.x - s.x);
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22, angleToTarget - 0.22, angleToTarget + 0.22);
      ctx.stroke();
    }

    ctx.restore();

    // Station label
    ctx.save();
    ctx.font = '9px Share Tech Mono, monospace';
    ctx.fillStyle = locked ? '#00ffcc' : '#334466';
    ctx.globalAlpha = locked ? 0.85 : 0.45;
    ctx.fillText(TRI_LABELS[i], s.x - 3, s.y + 22);
    ctx.restore();

    drawHexMarker(ctx, s.x, s.y, locked);
  }

  // Draw the triangulation triangle (connecting station to station) when 2+ locked
  const lockedCount = locks.filter(Boolean).length;
  if (lockedCount >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 0.7;
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const s = stations[i];
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function numToHexColor(value: number): string {
  const v = Math.max(0, Math.min(0xffffff, value | 0));
  return `#${v.toString(16).padStart(6, '0')}`;
}

function shiftHex(hex: string, delta: number): string {
  const raw = hex.replace('#', '');
  const num = parseInt(raw, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (num & 0xff) + delta));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
