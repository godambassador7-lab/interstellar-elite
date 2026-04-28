// src/components/HUD.js

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SCREEN } from '../utils/constants';
import { AbilityButton } from './AbilityButton';

export function HUD({
  playerHp,
  playerMaxHp,
  playerShield = 0,
  playerMaxShield = 50,
  score,
  totalDamage,
  combo,
  abilities,
  onDash,
  onPulse,
  onDrone,
  onQuantum,
  onPhase,
  gameTime,
  currentWave,
  maxWaves,
  waveRemaining,
}) {
  const hpPct     = playerHp / playerMaxHp;
  const hpColor   = hpPct > 0.5 ? COLORS.healthBar : hpPct > 0.25 ? '#FFB02E' : COLORS.healthLow;
  const shieldPct = playerMaxShield > 0 ? Math.max(0, Math.min(1, playerShield / playerMaxShield)) : 0;

  const dashCdPct = abilities.dash.cooldownRemaining / abilities.dash.maxCooldown;
  const pulseCdPct = abilities.pulse.cooldownRemaining / abilities.pulse.maxCooldown;
  const droneCdPct = abilities.drone.cooldownRemaining / abilities.drone.maxCooldown;
  const quantumCdPct = abilities.quantum
    ? abilities.quantum.cooldownRemaining / abilities.quantum.maxCooldown
    : 1;
  const phaseCdPct = abilities.phase
    ? abilities.phase.cooldownRemaining / abilities.phase.maxCooldown
    : 1;

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);
  const mult = 1 + Math.floor(combo / 5);

  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.hpSection}>
          {/* Hull HP row */}
          <View style={styles.barRow}>
            <Text style={styles.hpLabel}>HULL</Text>
            <View style={styles.hpTrack}>
              <View style={[styles.hpFill, { width: `${hpPct * 100}%`, backgroundColor: hpColor }]} />
              {[25, 50, 75].map((pct) => (
                <View key={pct} style={[styles.hpSeg, { left: `${pct}%` }]} />
              ))}
            </View>
            <Text style={[styles.hpNum, { color: hpColor }]}>{Math.ceil(playerHp)}</Text>
          </View>
          {/* Shield row */}
          <View style={styles.barRow}>
            <Text style={styles.shieldLabel}>SHLD</Text>
            <View style={styles.shieldTrack}>
              <View style={[styles.shieldFill, { width: `${shieldPct * 100}%` }]} />
            </View>
            <Text style={styles.shieldNum}>{Math.ceil(playerShield)}</Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <Text style={styles.scoreNum}>{score.toLocaleString()}</Text>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.damageLabel}>DMG {Math.round(totalDamage || 0).toLocaleString()}</Text>
        </View>

        <View style={styles.timerSection}>
          <Text style={styles.timerText}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Text>
          <Text style={styles.timerLabel}>TIME</Text>
        </View>
      </View>

      <View style={styles.waveStrip} pointerEvents="none">
        <Text style={styles.waveText}>WAVE {currentWave}/{maxWaves}</Text>
        <Text style={styles.waveRemainingText}>ENEMIES LEFT {waveRemaining}</Text>
      </View>

      {combo >= 2 && (
        <View style={styles.comboContainer} pointerEvents="none">
          <Text style={[styles.comboNum, { fontSize: Math.min(48, 24 + combo) }]}>{combo}x</Text>
          <Text style={styles.comboLabel}>COMBO</Text>
          {mult > 1 && <Text style={styles.multLabel}>x{mult} SCORE</Text>}
        </View>
      )}

      <View style={styles.abilityRow}>
        <View style={styles.abilityItem}>
          <AbilityButton
            icon="D"
            label="DASH"
            cooldownPct={dashCdPct}
            active={abilities.dash.active}
            onPress={onDash}
            color="#30FFB5"
            size={58}
          />
        </View>

        <View style={styles.abilityItem}>
          <AbilityButton
            icon="P"
            label="PULSE"
            cooldownPct={pulseCdPct}
            active={abilities.pulse.active}
            onPress={onPulse}
            color="#FF7A2E"
            size={58}
          />
        </View>

        <View style={styles.abilityItem}>
          <AbilityButton
            icon="O"
            label="ORBIT"
            cooldownPct={droneCdPct}
            active={abilities.drone.active}
            onPress={onDrone}
            color="#B46CFF"
            size={58}
          />
        </View>

        {abilities.quantum?.unlocked && (
          <View style={styles.abilityItem}>
            <AbilityButton
              icon="Q"
              label="Q-SLASH"
              cooldownPct={quantumCdPct}
              active={abilities.quantum.active}
              onPress={onQuantum}
              color="#4AA8FF"
              size={58}
            />
          </View>
        )}

        <View style={styles.abilityItem}>
          <AbilityButton
            icon="F"
            label="PHASE"
            cooldownPct={phaseCdPct}
            active={abilities.phase?.active}
            onPress={onPhase}
            color="#7FD9FF"
            size={58}
          />
        </View>
      </View>

      {hpPct < 0.25 && <View style={styles.dangerBorder} pointerEvents="none" />}
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  hpSection: {
    flex: 1,
    flexDirection: 'column',
    gap: 3,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hpLabel: {
    color: 'rgba(120,246,190,0.82)',
    fontSize: 8,
    fontFamily: 'Courier New',
    letterSpacing: 1,
    width: 28,
  },
  shieldLabel: {
    color: 'rgba(82,216,255,0.82)',
    fontSize: 8,
    fontFamily: 'Courier New',
    letterSpacing: 1,
    width: 28,
  },
  shieldTrack: {
    flex: 1,
    height: 7,
    backgroundColor: 'rgba(8,24,36,0.78)',
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(82,216,255,0.35)',
    overflow: 'hidden',
  },
  shieldFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#52D8FF',
    shadowColor: '#52D8FF',
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  shieldNum: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#52D8FF',
    width: 28,
    textAlign: 'right',
  },
  hpTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(8,20,18,0.78)',
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(120,246,190,0.35)',
    overflow: 'hidden',
    position: 'relative',
  },
  hpFill: {
    height: '100%',
    borderRadius: 5,
    shadowColor: COLORS.healthBar,
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  hpSeg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  hpNum: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    width: 28,
    textAlign: 'right',
  },

  scoreSection: {
    alignItems: 'center',
    minWidth: 80,
  },
  scoreNum: {
    color: COLORS.scoreColor,
    fontFamily: 'Courier New',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: COLORS.scoreColor,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  scoreLabel: {
    color: 'rgba(127,242,255,0.6)',
    fontFamily: 'Courier New',
    fontSize: 7,
    letterSpacing: 2,
  },
  damageLabel: {
    marginTop: 2,
    color: 'rgba(255,190,136,0.78)',
    fontFamily: 'Courier New',
    fontSize: 8,
    letterSpacing: 1,
  },

  timerSection: {
    alignItems: 'flex-end',
    width: 50,
  },
  timerText: {
    color: 'rgba(186,201,228,0.88)',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timerLabel: {
    color: 'rgba(186,201,228,0.45)',
    fontFamily: 'Courier New',
    fontSize: 7,
    letterSpacing: 1,
  },

  waveStrip: {
    position: 'absolute',
    top: 84,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  waveText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1.8,
  },
  waveRemainingText: {
    marginTop: 2,
    color: 'rgba(190,211,236,0.72)',
    fontFamily: 'Courier New',
    fontSize: 8,
    letterSpacing: 1.2,
  },

  comboContainer: {
    position: 'absolute',
    top: SCREEN.height * 0.16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  comboNum: {
    color: COLORS.comboColor,
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    textShadowColor: COLORS.comboColor,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  comboLabel: {
    color: 'rgba(255,193,58,0.72)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 3,
  },
  multLabel: {
    color: '#FF6A7A',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 2,
  },

  abilityRow: {
    position: 'absolute',
    bottom: 110,
    right: 16,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
  },
  abilityItem: {
    alignItems: 'center',
  },

  dangerBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: 'rgba(255,79,98,0.42)',
    pointerEvents: 'none',
  },
});
