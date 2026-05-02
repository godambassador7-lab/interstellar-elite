// src/screens/ConquestScreen.js

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { QUADRANT_DEFS } from '../utils/constants';
const SPACE_STATION_SPRITE = require('../../space station.png');

// Threat level 1-5 mapped from raw 0-10 scale
const THREAT_COLORS = ['#44FF88', '#52D8FF', '#FFC13A', '#FF7A2E', '#FF3D3D'];
const THREAT_LABELS = ['SAFE', 'ELEV', 'MOD', 'HIGH', 'CRIT'];
const REWARD_PART_TYPES = ['MECH', 'PLASMA', 'VOID', 'BIO'];
const REWARD_TYPE_COLORS = {
  MECH: '#8DFF9F',
  PLASMA: '#64D7FF',
  VOID: '#C488FF',
  BIO: '#FFD26B',
};

function getThreatLevel(raw) {
  if (raw < 2) return 0;
  if (raw < 4) return 1;
  if (raw < 6) return 2;
  if (raw < 8) return 3;
  return 4;
}

function StatCard({ label, value, color }) {
  return (
    <View style={card.root}>
      <Text style={[card.value, { color }]}>{value}</Text>
      <Text style={card.label}>{label}</Text>
    </View>
  );
}

const card = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103,243,255,0.18)',
    borderRadius: 5,
    paddingVertical: 8,
    backgroundColor: 'rgba(8,14,26,0.9)',
    marginHorizontal: 2,
  },
  value: {
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 0.4,
  },
  label: {
    fontFamily: 'Courier New',
    fontSize: 7,
    color: 'rgba(170,200,230,0.6)',
    letterSpacing: 0.9,
    marginTop: 2,
  },
});

export default function ConquestScreen({
  galaxy,
  territories,
  completedSystems,
  onClose,
  onDefendStation,
  onLaunchSystem,
}) {
  const qDef   = QUADRANT_DEFS.find((q) => q.id === galaxy.quadrant);
  const qColor = qDef?.accent || '#67F3FF';

  // All territory entries for this specific galaxy, sorted by system number
  const gTerritories = useMemo(
    () =>
      Object.values(territories || {})
        .filter((t) => t.galaxyId === galaxy.id)
        .sort((a, b) => a.systemNumber - b.systemNumber),
    [territories, galaxy.id]
  );

  const totalHeld      = gTerritories.length;
  const avgRaw         = totalHeld > 0
    ? gTerritories.reduce((s, t) => s + (t.threat || 0), 0) / totalHeld
    : 0;
  const totalDefended  = gTerritories.reduce((s, t) => s + (t.defended || 0), 0);
  const totalBreaches  = gTerritories.reduce((s, t) => s + (t.losses || 0), 0);
  const underAttackCnt = gTerritories.filter((t) => t.underAttack).length;
  const fillPct        = galaxy.systems > 0 ? Math.min(1, completedSystems / galaxy.systems) : 0;
  const driftAnim = useRef(new Animated.Value(0)).current;

  // Count systems at each threat tier (indices 0–4 = levels 1–5)
  const tierCounts = [0, 0, 0, 0, 0];
  gTerritories.forEach((t) => { tierCounts[getThreatLevel(t.threat)]++; });
  const driftStars = useMemo(() => {
    let seed = 0;
    const key = String(galaxy?.id || 'galaxy');
    for (let i = 0; i < key.length; i++) seed = ((seed * 31) + key.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0xFFFFFFFF;
    };
    return Array.from({ length: 80 }, (_, i) => ({
      id: `drift-${i}`,
      left: `${(rand() * 100).toFixed(3)}%`,
      top: `${(rand() * 100).toFixed(3)}%`,
      size: 0.8 + rand() * 2.4,
      opacity: 0.12 + rand() * 0.42,
    }));
  }, [galaxy?.id]);

  useEffect(() => {
    driftAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(driftAnim, { toValue: 1, duration: 14000, useNativeDriver: true }),
        Animated.timing(driftAnim, { toValue: 0, duration: 14000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [driftAnim, galaxy?.id]);
  const driftTranslateX = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
  const driftTranslateY = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [3, -3] });
  const galaxyStars = useMemo(() => {
    let seed = 0;
    const key = String(galaxy?.id || 'galaxy-cloud');
    for (let i = 0; i < key.length; i++) seed = ((seed * 39) + key.charCodeAt(i)) >>> 0;
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0xFFFFFFFF;
    };
    const palette = ['#FFFFFF', '#CFE8FF', '#89C7FF', '#FFB58E', '#FFD96C', '#FF8E8E'];
    const count = 420;
    const stars = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const rNorm = Math.pow(rand(), 0.58);
      const rx = 42 * rNorm;
      const ry = 24 * rNorm;
      stars.push({
        id: `gs-${i}`,
        x: 50 + Math.cos(a) * rx + (rand() - 0.5) * 3,
        y: 50 + Math.sin(a) * ry + (rand() - 0.5) * 2.2,
        size: 0.7 + rand() * 2.3,
        opacity: 0.2 + rand() * 0.75,
        color: palette[Math.floor(rand() * palette.length)],
      });
    }
    return stars;
  }, [galaxy?.id]);
  const systemTargets = useMemo(() => {
    const held = new Set(gTerritories.map((t) => Number(t.systemNumber)));
    const bySystem = new Map(gTerritories.map((t) => [Number(t.systemNumber), t]));
    const systems = [];
    const key = String(galaxy?.id || 'rewards');
    for (let i = 1; i <= (galaxy?.systems || 0); i++) {
      let seed = 0;
      const tag = `${key}:${i}`;
      for (let c = 0; c < tag.length; c++) seed = ((seed * 37) + tag.charCodeAt(c)) >>> 0;
      const rand = () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 0xFFFFFFFF;
      };
      const difficulty = Math.max(1, Math.min(10, Math.floor((i / Math.max(1, galaxy.systems)) * 10) + Math.floor(rand() * 3)));
      const creditReward = Math.floor(120 + difficulty * 70 + rand() * 180);
      const partType = REWARD_PART_TYPES[Math.floor(rand() * REWARD_PART_TYPES.length)];
      const partReward = 1 + Math.floor(rand() * Math.max(2, Math.ceil(difficulty / 2)));
      const territory = bySystem.get(i);
      systems.push({
        systemNumber: i,
        difficulty,
        creditReward,
        partType,
        partReward,
        conquered: held.has(i),
        underAttack: Boolean(territory?.underAttack),
        threat: territory?.threat ?? null,
      });
    }
    systems.sort((a, b) => a.systemNumber - b.systemNumber);
    return systems;
  }, [gTerritories, galaxy?.id, galaxy?.systems]);

  return (
    <View style={styles.overlay}>
      {/* Tappable backdrop to dismiss */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={[styles.panel, { borderColor: qColor + '55' }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.driftLayer, { transform: [{ translateX: driftTranslateX }, { translateY: driftTranslateY }] }]}
        >
          {driftStars.map((s) => (
            <View
              key={s.id}
              style={{
                position: 'absolute',
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                borderRadius: s.size / 2,
                opacity: s.opacity,
                backgroundColor: '#CFE6FF',
              }}
            />
          ))}
        </Animated.View>

        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={[styles.qBadge, { borderColor: qColor, backgroundColor: qColor + '18' }]}>
            <Text style={[styles.qBadgeText, { color: qColor }]}>{qDef?.label ?? ''}</Text>
          </View>
          <Text style={[styles.galaxyTitle, { color: qColor }]} numberOfLines={1}>
            {galaxy.name}
          </Text>
          <TouchableOpacity style={styles.xBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.xBtnText}>X</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subInfo}>
          THREAT {galaxy.threat.toFixed(2)}  ·  {galaxy.systems} SYSTEMS  ·  WAVES {galaxy.waves}
        </Text>

        {/* ── Progress bar ────────────────────────────────── */}
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>SYSTEMS CONTROLLED</Text>
          <Text style={[styles.progressCount, { color: qColor }]}>
            {completedSystems} / {galaxy.systems}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${fillPct * 100}%`, backgroundColor: qColor }]}
          />
        </View>

        {/* ── Stat cards ──────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard label="HELD"      value={totalHeld}            color="#DDF2FF" />
          <StatCard label="AVG THREAT" value={avgRaw.toFixed(1)}   color={THREAT_COLORS[getThreatLevel(avgRaw)]} />
          <StatCard label="DEFENSES"  value={totalDefended}        color="#44FF88" />
          <StatCard label="BREACHES"  value={totalBreaches}        color="#FF3D3D" />
        </View>

        <View style={styles.liveMapWrap}>
          <Text style={styles.liveMapTitle}>LIVE GALAXY VIEW</Text>
          <View style={[styles.liveMapFrame, { borderColor: qColor + '5c' }]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.orbFloatLayer,
                { transform: [{ translateX: driftTranslateX }, { translateY: driftTranslateY }] },
              ]}
            >
              <Animated.View pointerEvents="none" style={styles.ringStarsLayer}>
                {galaxyStars.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      position: 'absolute',
                      left: `${s.x}%`,
                      top: `${s.y}%`,
                      width: s.size,
                      height: s.size,
                      borderRadius: s.size / 2,
                      opacity: s.opacity,
                      backgroundColor: s.color,
                    }}
                  />
                ))}
              </Animated.View>
              <View style={styles.orbHaloOuter} />
              <View style={styles.orbHaloMid} />
              <View style={styles.orbAccretionDisk} />
              <View style={styles.orbShadowOuter} />
              <View style={styles.orbCoreBlack} />
            </Animated.View>
          </View>
        </View>

        <View style={styles.targetsWrap}>
          <View style={styles.targetsHeader}>
            <Text style={styles.targetsTitle}>UNCONQUERED TARGETS</Text>
            <Text style={styles.targetsCount}>{systemTargets.length} SYSTEMS</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetsList}>
            {systemTargets.map((t) => (
              <TouchableOpacity
                key={`target-${t.systemNumber}`}
                style={[
                  styles.targetCard,
                  {
                    borderColor: `${(REWARD_TYPE_COLORS[t.partType] || '#FFE26D')}AA`,
                    backgroundColor: `${(REWARD_TYPE_COLORS[t.partType] || '#FFE26D')}22`,
                  },
                ]}
                activeOpacity={0.82}
                onPress={() => {
                  if (onLaunchSystem) onLaunchSystem(t.systemNumber);
                }}
              >
                <Text style={styles.targetSystem}>SYS-{String(t.systemNumber).padStart(3, '0')}</Text>
                <Text style={styles.targetDifficulty}>DIFF {t.difficulty}/10</Text>
                <Text style={[styles.targetReward, { color: t.conquered ? '#63FF9E' : '#FFE26D' }]}>
                  {t.conquered ? 'CONQUERED' : 'UNCONQUERED'}
                  {t.underAttack ? '  UNDER ATTACK' : ''}
                </Text>
                <Text style={styles.targetReward}>+{t.creditReward} CREDITS</Text>
                <Text style={[styles.targetReward, { color: REWARD_TYPE_COLORS[t.partType] || '#FFF2AE' }]}>
                  +{t.partReward} {t.partType}
                </Text>
                {typeof t.threat === 'number' && (
                  <Text style={styles.targetReward}>THREAT {t.threat.toFixed(1)}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Attack alert ────────────────────────────────── */}
        {underAttackCnt > 0 && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>
              ALERT  {underAttackCnt} SYSTEM{underAttackCnt > 1 ? 'S' : ''} UNDER ATTACK
            </Text>
          </View>
        )}

        {/* ── Threat distribution chart ────────────────────── */}
        <View style={styles.distContainer}>
          <Text style={styles.distTitle}>THREAT DISTRIBUTION</Text>
          <View style={styles.distRow}>
            {THREAT_COLORS.map((color, lvl) => {
              const barH = totalHeld > 0
                ? Math.max(4, Math.round((tierCounts[lvl] / totalHeld) * 48))
                : 4;
              return (
                <View key={lvl} style={styles.distItem}>
                  <Text style={[styles.distCount, { color }]}>{tierCounts[lvl]}</Text>
                  <View style={[styles.distBar, { height: barH, backgroundColor: color }]} />
                  <View style={[styles.distLevelBadge, { borderColor: color + '66', backgroundColor: color + '14' }]}>
                    <Text style={[styles.distLevelText, { color }]}>T{lvl + 1}</Text>
                  </View>
                  <Text style={[styles.distLevelLabel, { color: color + 'aa' }]}>
                    {THREAT_LABELS[lvl]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Systems list ────────────────────────────────── */}
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>CONQUERED SYSTEMS</Text>
          <Text style={styles.listCount}>{totalHeld} ACTIVE TERRITORIES</Text>
        </View>

        {totalHeld === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No territories secured.</Text>
            <Text style={styles.emptySubText}>
              Conquer systems in this galaxy to build your hold.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.systemsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {/* Column headings */}
            <View style={styles.colHeadRow}>
              <Text style={[styles.colHead, { width: 62 }]}>SYSTEM</Text>
              <Text style={[styles.colHead, { width: 30 }]}>STN</Text>
              <Text style={[styles.colHead, { width: 28 }]}>LVL</Text>
              <Text style={[styles.colHead, { flex: 1 }]}>STABILITY</Text>
              <Text style={[styles.colHead, { width: 36 }]}>STA%</Text>
              <Text style={[styles.colHead, { width: 46 }]}>STATUS</Text>
              <Text style={[styles.colHead, { width: 32 }]}>D/L</Text>
            </View>

            {gTerritories.map((t) => {
              const lvl       = getThreatLevel(t.threat);
              const tc        = THREAT_COLORS[lvl];
              const stabColor = t.stability > 60 ? '#44FF88'
                              : t.stability > 30 ? '#FFC13A'
                              : '#FF3D3D';
              const isAttack  = t.underAttack;
              const isBreach  = !isAttack && t.lastOutcome === 'breached';

              return (
                <View
                  key={t.key}
                  style={[
                    styles.sysRow,
                    isAttack && styles.sysRowAttack,
                    isBreach && styles.sysRowBreach,
                  ]}
                >
                  {/* System ID */}
                  <Text style={[styles.sysId, { color: qColor }]}>
                    SYS-{String(t.systemNumber).padStart(3, '0')}
                  </Text>

                  {/* Station icon */}
                  <View style={styles.stationIconCell}>
                    <Image source={SPACE_STATION_SPRITE} resizeMode="contain" style={styles.stationIcon} />
                  </View>

                  {/* Threat level badge */}
                  <View style={[styles.threatBadge, { borderColor: tc, backgroundColor: tc + '20' }]}>
                    <Text style={[styles.threatNum, { color: tc }]}>{lvl + 1}</Text>
                  </View>

                  {/* Stability bar */}
                  <View style={styles.stabTrack}>
                    <View
                      style={[
                        styles.stabFill,
                        { width: `${t.stability}%`, backgroundColor: stabColor },
                      ]}
                    />
                  </View>
                  <Text style={[styles.stabPct, { color: stabColor }]}>{t.stability}%</Text>

                  {/* Status tag */}
                  <View
                    style={[
                      styles.statusTag,
                      {
                        borderColor: isAttack ? '#FF3D3D' : isBreach ? '#FF7A2E66' : '#44FF8840',
                        backgroundColor: isAttack
                          ? 'rgba(255,61,61,0.18)'
                          : isBreach
                          ? 'rgba(255,122,46,0.14)'
                          : 'rgba(68,255,136,0.09)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isAttack ? '#FF3D3D' : isBreach ? '#FF7A2E' : '#44FF88',
                        },
                      ]}
                    >
                      {isAttack ? 'ATTACK' : isBreach ? 'BREACH' : 'SECURE'}
                    </Text>
                  </View>

                  {/* Defense / Loss tally */}
                  <View style={styles.tallyCell}>
                    <Text style={styles.tallyDef}>{t.defended}</Text>
                    <Text style={styles.tallySep}>/</Text>
                    <Text style={styles.tallyLoss}>{t.losses}</Text>
                  </View>

                  {/* DEFEND button — only on attacking systems */}
                  {isAttack && onDefendStation ? (
                    <TouchableOpacity
                      style={styles.defendBtn}
                      onPress={() => { onDefendStation(t); onClose(); }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.defendBtnText}>DEFEND</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.defendPlaceholder} />
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── Threat level legend ─────────────────────────── */}
        <View style={styles.legend}>
          {THREAT_COLORS.map((color, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendText, { color }]}>
                T{i + 1} {THREAT_LABELS[i]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 600,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,5,14,0.78)',
  },
  panel: {
    backgroundColor: 'rgba(5,8,18,0.98)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 22,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  driftLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 10,
  },
  qBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  qBadgeText: {
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  galaxyTitle: {
    flex: 1,
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 19,
    letterSpacing: 0.8,
  },
  xBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(103,243,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(103,243,255,0.08)',
  },
  xBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subInfo: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(150,180,220,0.55)',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // ── Progress ──────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressLabel: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: 'rgba(170,200,230,0.65)',
    letterSpacing: 1,
  },
  progressCount: {
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(103,243,255,0.14)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },

  // ── Stat cards ────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
  },
  liveMapWrap: {
    marginBottom: 10,
  },
  liveMapTitle: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(150,180,215,0.65)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  liveMapFrame: {
    height: 168,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#02060D',
    overflow: 'hidden',
  },
  orbFloatLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringStarsLayer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  orbHaloOuter: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 999,
    backgroundColor: 'rgba(255,198,110,0.12)',
  },
  orbHaloMid: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 999,
    backgroundColor: 'rgba(255,170,74,0.18)',
  },
  orbAccretionDisk: {
    position: 'absolute',
    width: 150,
    height: 58,
    borderRadius: 999,
    backgroundColor: 'rgba(255,188,112,0.46)',
  },
  orbShadowOuter: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 999,
    backgroundColor: 'rgba(12,14,24,0.9)',
  },
  orbCoreBlack: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#020205',
  },
  targetsWrap: {
    marginBottom: 10,
  },
  targetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  targetsTitle: {
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFE26D',
    letterSpacing: 1,
  },
  targetsCount: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(255,226,109,0.72)',
  },
  targetsList: {
    gap: 8,
    paddingRight: 8,
  },
  targetCard: {
    width: 138,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,226,109,0.52)',
    backgroundColor: 'rgba(52,42,8,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  targetSystem: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF2AE',
    letterSpacing: 0.6,
  },
  targetDifficulty: {
    marginTop: 3,
    fontFamily: 'Courier New',
    fontSize: 8,
    color: '#FFD467',
    letterSpacing: 0.6,
  },
  targetReward: {
    marginTop: 2,
    fontFamily: 'Courier New',
    fontSize: 7,
    color: 'rgba(235,225,185,0.92)',
    letterSpacing: 0.5,
  },

  // ── Alert ─────────────────────────────────────────────────
  alertBanner: {
    backgroundColor: 'rgba(255,61,61,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,61,61,0.55)',
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  alertText: {
    color: '#FF3D3D',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },

  // ── Distribution chart ────────────────────────────────────
  distContainer: {
    marginBottom: 12,
  },
  distTitle: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(150,180,215,0.55)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 80,
    backgroundColor: 'rgba(8,14,26,0.7)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(80,110,150,0.2)',
  },
  distItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  distCount: {
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
  },
  distBar: {
    width: '80%',
    borderRadius: 2,
    minHeight: 4,
  },
  distLevelBadge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  distLevelText: {
    fontFamily: 'Courier New',
    fontSize: 8,
    fontWeight: 'bold',
  },
  distLevelLabel: {
    fontFamily: 'Courier New',
    fontSize: 6,
    letterSpacing: 0.5,
  },

  // ── Systems list ──────────────────────────────────────────
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  sectionTitle: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(127,242,255,0.85)',
    letterSpacing: 1.2,
  },
  listCount: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(150,175,210,0.6)',
  },
  emptyState: {
    paddingVertical: 22,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: 'rgba(150,175,210,0.65)',
    marginBottom: 4,
  },
  emptySubText: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: 'rgba(130,155,190,0.5)',
    textAlign: 'center',
  },
  systemsList: {
    maxHeight: 200,
    marginBottom: 10,
  },
  colHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 3,
    gap: 8,
  },
  colHead: {
    fontFamily: 'Courier New',
    fontSize: 6,
    color: 'rgba(120,150,190,0.55)',
    letterSpacing: 0.8,
  },
  sysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginBottom: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(10,16,30,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(70,95,130,0.2)',
  },
  sysRowAttack: {
    borderColor: 'rgba(255,61,61,0.5)',
    backgroundColor: 'rgba(255,61,61,0.07)',
  },
  sysRowBreach: {
    borderColor: 'rgba(255,122,46,0.38)',
    backgroundColor: 'rgba(255,122,46,0.05)',
  },
  sysId: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    width: 62,
    letterSpacing: 0.4,
  },
  threatBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationIconCell: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationIcon: {
    width: 20,
    height: 20,
    opacity: 0.95,
  },
  threatNum: {
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
  },
  stabTrack: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(70,90,120,0.35)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  stabFill: {
    height: 5,
    borderRadius: 3,
  },
  stabPct: {
    fontFamily: 'Courier New',
    fontSize: 8,
    width: 36,
    textAlign: 'right',
  },
  statusTag: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    width: 46,
    alignItems: 'center',
  },
  statusText: {
    fontFamily: 'Courier New',
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
  tallyCell: {
    flexDirection: 'row',
    width: 32,
    justifyContent: 'center',
    gap: 1,
  },
  tallyDef: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: '#44FF88',
  },
  tallySep: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: 'rgba(140,165,200,0.5)',
  },
  tallyLoss: {
    fontFamily: 'Courier New',
    fontSize: 9,
    color: '#FF3D3D',
  },
  defendBtn: {
    borderWidth: 1,
    borderColor: '#FF3D3D',
    backgroundColor: 'rgba(255,61,61,0.15)',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  defendBtnText: {
    fontFamily: 'Courier New',
    fontSize: 7,
    fontWeight: 'bold',
    color: '#FF3D3D',
    letterSpacing: 0.8,
  },
  defendPlaceholder: {
    width: 42,
  },

  // ── Legend ────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(70,95,130,0.22)',
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontFamily: 'Courier New',
    fontSize: 7,
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
});
