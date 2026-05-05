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

export default function SpinningGalaxyScreen({ galaxyId = 'demo', systemCount = 24, height = 320, systems = [] }) {
  const model = useMemo(
    () => buildOrbitalGalaxyModel(String(galaxyId), systemCount, systems),
    [galaxyId, systemCount, systems]
  );

  // Pre-project once, then rotate via native-driver transforms for smooth motion.
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
        duration: prefersReducedMotion ? 720000 : 280000,
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
        Animated.timing(corePulseAnim, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(corePulseAnim, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [corePulseAnim, galaxyId]);

  const galaxyRotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = corePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1.025] });
  const pulseGlow = corePulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const ringRotate = corePulseAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '12deg'] });

  const coreBoost = (x, y, strength = 1) => {
    const dx = x - 50;
    const dy = y - 50;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, 1 - dist / 24));
    return 1 + t * 0.55 * strength;
  };

  return (
    <View style={{ width: '100%', height, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.32)', backgroundColor: '#02060D', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: '#02070f' }} />

      {Array.from({ length: 120 }).map((_, i) => {
        const x = ((i * 137.3) % 10000) / 100;
        const y = ((i * 89.1) % 10000) / 100;
        const size = 0.5 + (i % 4) * 0.35;
        const opacity = 0.08 + (i % 6) * 0.025;
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
              backgroundColor: '#D8E8FF',
            }}
          />
        );
      })}

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -260, marginTop: -110, width: 520, height: 220, borderRadius: 999, backgroundColor: 'rgba(102,136,188,0.08)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -228, marginTop: -84, width: 456, height: 168, borderRadius: 999, backgroundColor: 'rgba(145,176,225,0.06)' }} />

      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ perspective: 900 }, { rotateX: '62deg' }, { rotateZ: galaxyRotate }, { scale: 1.015 }],
          ...(Platform.OS === 'web' ? { willChange: 'transform, opacity' } : null),
        }}
      >
        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.arms.map((p) => {
            const boost = coreBoost(p.x, p.y, 0.7);
            return (
              <View
                key={p.id}
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: 1.55 * p.scale,
                  height: 1.55 * p.scale,
                  borderRadius: 99,
                  backgroundColor: p.z > 0 ? '#F2F7FF' : '#BFD8FF',
                  opacity: Math.min(1, p.opacity * (0.32 + (1 - Math.abs(p.y - 50) / 60) * 0.34) * boost),
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
                width: 8.6 * p.scale,
                height: 2.6 * p.scale,
                borderRadius: 999,
                backgroundColor: 'rgba(10,16,28,0.95)',
                opacity: Math.max(0.035, p.opacity * 0.12),
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
                  width: 13.5 * p.scale,
                  height: 3.9 * p.scale,
                  borderRadius: 999,
                  backgroundColor: p.z > 0 ? '#DCEBFF' : '#9AB7DF',
                  opacity: Math.min(1, p.opacity * 0.09 * boost),
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
                width: 5.2 * p.scale,
                height: 2.1 * p.scale,
                borderRadius: 999,
                backgroundColor: '#BED2F2',
                opacity: p.opacity * 0.052,
              }}
            />
          ))}
        </View>

        <View style={{ position: 'absolute', inset: 0 }}>
          {frame.systems.map((s) => {
            const color = s.conquered ? NODE_COLORS.conquered : (NODE_COLORS[s.partType] || NODE_COLORS.default);
            const boost = coreBoost(s.x, s.y, 0.8);
            const dot = (4.1 + s.scale * 4.2) * Math.min(1.16, boost);
            const glow = dot * 1.95;
            return (
              <View key={s.id} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, marginLeft: -dot / 2, marginTop: -dot / 2 }}>
                <View
                  style={{
                    position: 'absolute',
                    left: -(glow - dot) / 2,
                    top: -(glow - dot) / 2,
                    width: glow,
                    height: glow,
                    borderRadius: 999,
                    backgroundColor: color,
                    opacity: Math.min(1, s.opacity * 0.2 * boost),
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

      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -132, marginTop: -132, width: 264, height: 264, borderRadius: 999, backgroundColor: 'rgba(78,118,198,0.055)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -118, marginTop: -118, width: 236, height: 236, borderRadius: 999, backgroundColor: 'rgba(108,148,225,0.075)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -104, marginTop: -104, width: 208, height: 208, borderRadius: 999, backgroundColor: 'rgba(138,176,242,0.085)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -90, marginTop: -90, width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(255,170,82,0.11)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -78, marginTop: -78, width: 156, height: 156, borderRadius: 999, backgroundColor: 'rgba(255,188,96,0.14)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -66, marginTop: -66, width: 132, height: 132, borderRadius: 999, backgroundColor: 'rgba(255,206,118,0.18)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -56, marginTop: -56, width: 112, height: 112, borderRadius: 999, backgroundColor: 'rgba(255,224,152,0.24)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -46, marginTop: -46, width: 92, height: 92, borderRadius: 999, backgroundColor: 'rgba(255,238,190,0.31)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -36, marginTop: -36, width: 72, height: 72, borderRadius: 999, backgroundColor: 'rgba(255,247,218,0.45)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -27, marginTop: -27, width: 54, height: 54, borderRadius: 999, backgroundColor: 'rgba(255,252,238,0.62)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -18, marginTop: -18, width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(255,255,250,0.84)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -10, marginTop: -10, width: 20, height: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.98)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -58, marginTop: -22, width: 116, height: 44, borderRadius: 999, borderWidth: 1.1, borderColor: 'rgba(255,232,182,0.44)', opacity: 0.45, transform: [{ rotate: ringRotate }] }} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.12)' }} />
    </View>
  );
}
