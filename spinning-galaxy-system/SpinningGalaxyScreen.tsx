import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { buildOrbitalGalaxyModel, projectOrbitalFrame } from './spinningGalaxyEngine';

const NODE_COLORS = {
  conquered: '#63FF9E',
  MECH: '#8DFF9F',
  PLASMA: '#64D7FF',
  VOID: '#C488FF',
  BIO: '#FFD26B',
  default: '#FFE26D',
};

const ARM_TINTS = ['#fff2d1', '#ffd692', '#dce4ff', '#9eb8ff', '#6d8eff', '#4f69df'];
const DUST_TINTS = ['#1a1a3e', '#22274f', '#25306a', '#2f3d8a', '#3b4da7', '#5068c5'];
const ARM_DEBUG_TINTS = ['#ff8f8f', '#ffd88f', '#ecff8f', '#8fffd3', '#8fc7ff', '#d58fff'];
const SHOW_ARM_DEBUG = false;

export default function SpinningGalaxyScreen({
  galaxyId = 'demo',
  systemCount = 24,
  height = 320,
  systems = [],
  highlightedSystemNumber = null,
}: {
  galaxyId?: string;
  systemCount?: number;
  height?: number;
  systems?: Array<{ systemNumber: number; conquered?: boolean; partType?: 'MECH' | 'PLASMA' | 'VOID' | 'BIO' }>;
  highlightedSystemNumber?: number | null;
}) {
  const model = useMemo(
    () => buildOrbitalGalaxyModel(String(galaxyId), systemCount, systems),
    [galaxyId, systemCount, systems]
  );

  const frame = useMemo(() => projectOrbitalFrame(model, 0), [model]);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const corePulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    rotateAnim.setValue(0);
    const prefersReducedMotion =
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: prefersReducedMotion ? 1200000 : 640000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotateAnim, galaxyId]);

  useEffect(() => {
    corePulseAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(corePulseAnim, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(corePulseAnim, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [corePulseAnim, galaxyId]);

  const galaxyRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = corePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.99, 1.02] });
  const pulseGlow = corePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const ringRotate = corePulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '9deg'] });

  const coreBoost = (x, y, strength = 1) => {
    const dx = x - 50;
    const dy = y - 50;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, 1 - dist / 24));
    return 1 + t * 0.55 * strength;
  };

  return (
    <View style={{ width: '100%', height, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.32)', backgroundColor: '#040716', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: '#040716' }} />

      {Array.from({ length: 140 }).map((_, i) => {
        const x = ((i * 137.3) % 10000) / 100;
        const y = ((i * 89.1) % 10000) / 100;
        const size = 0.5 + (i % 4) * 0.36;
        const opacity = 0.07 + (i % 7) * 0.02;
        return (
          <View
            key={`bg-${i}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: 99,
              opacity,
              backgroundColor: i % 5 === 0 ? '#8ba0ff' : '#d7e6ff',
            }}
          />
        );
      })}

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -250, marginTop: -176, width: 500, height: 352, borderRadius: 999, backgroundColor: 'rgba(74,94,212,0.038)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -210, marginTop: -146, width: 420, height: 292, borderRadius: 999, backgroundColor: 'rgba(98,84,188,0.032)' }} />

      <View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ perspective: 900 }, { rotateX: '24deg' }, { rotateY: '-6deg' }, { scale: 1.01 }],
        }}
      >
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ rotateZ: galaxyRotate }],
          ...(Platform.OS === 'web' ? { willChange: 'transform, opacity' } : null),
        }}
      >
        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.arms.map((p) => {
            const boost = coreBoost(p.x, p.y, 0.72);
            return (
              <View
                key={p.id}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: 1.65 * p.scale,
                  height: 1.65 * p.scale,
                  borderRadius: 99,
                  backgroundColor: SHOW_ARM_DEBUG
                    ? ARM_DEBUG_TINTS[p.armIndex % ARM_DEBUG_TINTS.length]
                    : ARM_TINTS[p.armIndex % ARM_TINTS.length],
                  opacity: Math.min(1, p.opacity * (0.38 + (1 - Math.abs(p.y - 50) / 60) * 0.40) * boost),
                }}
              />
            );
          })}
        </View>

        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.lanes.map((p) => (
            <View
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 10.2 * p.scale,
                height: 3.1 * p.scale,
                borderRadius: 999,
                backgroundColor: 'rgba(9,13,24,0.95)',
                opacity: Math.max(0.035, p.opacity * 0.135),
              }}
            />
          ))}
        </View>

        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.dust.map((p) => {
            const boost = coreBoost(p.x, p.y, 1);
            return (
              <View
                key={p.id}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: 15.2 * p.scale,
                  height: 4.4 * p.scale,
                  borderRadius: 999,
                  backgroundColor: SHOW_ARM_DEBUG
                    ? ARM_DEBUG_TINTS[p.armIndex % ARM_DEBUG_TINTS.length]
                    : DUST_TINTS[(p.armIndex + 1) % DUST_TINTS.length],
                  opacity: Math.min(1, p.opacity * 0.088 * boost),
                }}
              />
            );
          })}
        </View>

        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.halo.map((p) => (
            <View
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 6.1 * p.scale,
                height: 2.3 * p.scale,
                borderRadius: 999,
                backgroundColor: '#7f96ff',
                opacity: p.opacity * 0.058,
              }}
            />
          ))}
        </View>

        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.systems.map((s) => {
            const color = s.conquered ? NODE_COLORS.conquered : (NODE_COLORS[s.partType] || NODE_COLORS.default);
            const isHighlighted = highlightedSystemNumber === s.systemNumber;
            const boost = coreBoost(s.x, s.y, 0.8);
            const dot = (4.1 + s.scale * 4.2) * Math.min(1.16, boost) * (isHighlighted ? 1.24 : 1);
            const glow = dot * (isHighlighted ? 3.2 : 1.95);
            const beaconRing = dot * 4.7;
            return (
              <View key={s.id} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, marginLeft: -dot / 2, marginTop: -dot / 2 }}>
                {isHighlighted ? (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: -(beaconRing - dot) / 2,
                      top: -(beaconRing - dot) / 2,
                      width: beaconRing,
                      height: beaconRing,
                      borderRadius: 999,
                      borderWidth: 1.3,
                      borderColor: `${color}DD`,
                      opacity: pulseGlow,
                      transform: [{ scale: pulseScale }],
                    }}
                  />
                ) : null}
                <View
                  style={{
                    position: 'absolute',
                    left: -(glow - dot) / 2,
                    top: -(glow - dot) / 2,
                    width: glow,
                    height: glow,
                    borderRadius: 999,
                    backgroundColor: color,
                    opacity: Math.min(1, s.opacity * (isHighlighted ? 0.5 : 0.2) * boost),
                  }}
                />
                <View
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: 999,
                    borderWidth: 0.9,
                    borderColor: `${color}D9`,
                    backgroundColor: color,
                    opacity: Math.min(1, s.opacity * boost),
                  }}
                />
              </View>
            );
          })}
        </View>
      </Animated.View>
      </View>

      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -120, marginTop: -120, width: 240, height: 240, borderRadius: 999, backgroundColor: 'rgba(56,76,188,0.042)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -98, marginTop: -98, width: 196, height: 196, borderRadius: 999, backgroundColor: 'rgba(102,92,206,0.055)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -78, marginTop: -78, width: 156, height: 156, borderRadius: 999, backgroundColor: 'rgba(255,168,80,0.105)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -62, marginTop: -62, width: 124, height: 124, borderRadius: 999, backgroundColor: 'rgba(255,206,138,0.165)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -48, marginTop: -48, width: 96, height: 96, borderRadius: 999, backgroundColor: 'rgba(255,238,194,0.265)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -35, marginTop: -35, width: 70, height: 70, borderRadius: 999, backgroundColor: 'rgba(255,248,226,0.39)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: 999, backgroundColor: 'rgba(255,253,244,0.62)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -16, marginTop: -16, width: 32, height: 32, borderRadius: 999, backgroundColor: 'rgba(255,255,252,0.88)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -48, marginTop: -18, width: 96, height: 36, borderRadius: 999, borderWidth: 1.1, borderColor: 'rgba(255,232,182,0.34)', opacity: 0.36, transform: [{ rotate: ringRotate }] }} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.12)' }} />
    </View>
  );
}
