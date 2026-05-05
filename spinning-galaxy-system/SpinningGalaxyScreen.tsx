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

const ARM_TINTS = ['#f4f7ff', '#d9deff', '#9fb4ff', '#8ec2ff', '#b887ff', '#ffd08d'];
const DUST_TINTS = ['#89a7ff', '#7fd2ff', '#b29bff', '#ffc38a', '#9be5ff', '#9aa7ff'];

export default function SpinningGalaxyScreen({ galaxyId = 'demo', systemCount = 24, height = 320, systems = [] }) {
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

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -300, marginTop: -160, width: 600, height: 320, borderRadius: 999, backgroundColor: 'rgba(84,106,212,0.10)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -252, marginTop: -120, width: 504, height: 240, borderRadius: 999, backgroundColor: 'rgba(118,86,214,0.10)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -214, marginTop: -92, width: 428, height: 184, borderRadius: 999, backgroundColor: 'rgba(82,143,255,0.08)' }} />

      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ perspective: 900 }, { rotateX: '18deg' }, { rotateZ: galaxyRotate }, { scale: 1.02 }],
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
                  backgroundColor: p.z > 0 ? ARM_TINTS[p.armIndex % ARM_TINTS.length] : '#7f95ea',
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
                  backgroundColor: p.z > 0 ? DUST_TINTS[(p.armIndex + 1) % DUST_TINTS.length] : '#7f8fda',
                  opacity: Math.min(1, p.opacity * 0.105 * boost),
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
                backgroundColor: '#8fa6ff',
                opacity: p.opacity * 0.07,
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

      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -150, marginTop: -150, width: 300, height: 300, borderRadius: 999, backgroundColor: 'rgba(96,116,235,0.06)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -126, marginTop: -126, width: 252, height: 252, borderRadius: 999, backgroundColor: 'rgba(125,98,238,0.08)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -104, marginTop: -104, width: 208, height: 208, borderRadius: 999, backgroundColor: 'rgba(255,168,82,0.10)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -86, marginTop: -86, width: 172, height: 172, borderRadius: 999, backgroundColor: 'rgba(255,198,100,0.14)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -70, marginTop: -70, width: 140, height: 140, borderRadius: 999, backgroundColor: 'rgba(255,222,154,0.22)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -56, marginTop: -56, width: 112, height: 112, borderRadius: 999, backgroundColor: 'rgba(255,238,192,0.32)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -42, marginTop: -42, width: 84, height: 84, borderRadius: 999, backgroundColor: 'rgba(255,248,224,0.47)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -30, marginTop: -30, width: 60, height: 60, borderRadius: 999, backgroundColor: 'rgba(255,252,240,0.66)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -18, marginTop: -18, width: 36, height: 36, borderRadius: 999, backgroundColor: 'rgba(255,255,252,0.9)', opacity: pulseGlow, transform: [{ scale: pulseScale }] }} />
      <Animated.View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -58, marginTop: -22, width: 116, height: 44, borderRadius: 999, borderWidth: 1.1, borderColor: 'rgba(255,232,182,0.44)', opacity: 0.45, transform: [{ rotate: ringRotate }] }} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.12)' }} />
    </View>
  );
}
