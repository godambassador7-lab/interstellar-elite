import React, { useMemo, useRef, useEffect } from 'react';
import { View, Animated } from 'react-native';
import { buildSideViewGalaxyModel } from './spinningGalaxyEngine';

const DEFAULT_NODE_COLORS = {
  conquered: '#63FF9E',
  MECH: '#8DFF9F',
  PLASMA: '#64D7FF',
  VOID: '#C488FF',
  BIO: '#FFD26B',
  default: '#FFE26D',
};

type NodeDatum = {
  systemNumber: number;
  conquered?: boolean;
  partType?: 'MECH' | 'PLASMA' | 'VOID' | 'BIO';
};

export default function SpinningGalaxyScreen({
  galaxyId = 'demo',
  systemCount = 24,
  height = 320,
  systems = [],
}: {
  galaxyId?: string;
  systemCount?: number;
  height?: number;
  systems?: NodeDatum[];
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const wobbleAnim = useRef(new Animated.Value(0)).current;

  const model = useMemo(
    () => buildSideViewGalaxyModel(String(galaxyId), systemCount),
    [galaxyId, systemCount]
  );
  const systemMetaByNumber = useMemo(
    () => new Map((systems || []).map((s) => [Number(s.systemNumber), s])),
    [systems]
  );

  useEffect(() => {
    spinAnim.setValue(0);
    const loop = Animated.loop(Animated.timing(spinAnim, { toValue: 1, duration: 145000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  useEffect(() => {
    wobbleAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobbleAnim, { toValue: 1, duration: 7600, useNativeDriver: true }),
        Animated.timing(wobbleAnim, { toValue: 0, duration: 7600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [wobbleAnim]);

  const driftX = wobbleAnim.interpolate({ inputRange: [0, 1], outputRange: [-2.5, 2.5] });
  const driftY = wobbleAnim.interpolate({ inputRange: [0, 1], outputRange: [1.5, -1.5] });
  const wobbleX = wobbleAnim.interpolate({ inputRange: [0, 1], outputRange: ['71deg', '76deg'] });
  const wobbleY = wobbleAnim.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
  const shimmerOpacity = spinAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.22, 0.36, 0.22] });

  return (
    <View style={{ width: '100%', height, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.32)', backgroundColor: '#02060D', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: '#020710' }} />
      {Array.from({ length: 95 }).map((_, i) => {
        const x = ((i * 137.5) % 10000) / 100;
        const y = ((i * 91.7) % 10000) / 100;
        const size = 0.6 + (i % 5) * 0.32;
        const opacity = 0.08 + (i % 7) * 0.022;
        return (
          <View
            key={`bg-${i}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: '#D8E8FF',
              opacity,
            }}
          />
        );
      })}
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ translateX: driftX }, { translateY: driftY }, { perspective: 760 }, { rotateX: wobbleX }, { rotateY: wobbleY }, { scale: 1.02 }],
        }}
      >
        <Animated.View style={{ position: 'absolute', inset: 0 }}>
          {model.starsFar.map((s) => (
            <View
              key={s.id}
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: 1.1 * s.scale,
                height: 1.1 * s.scale,
                borderRadius: 99,
                opacity: s.opacity * 0.46,
                backgroundColor: '#BCD5F7',
              }}
            />
          ))}
        </Animated.View>
        <Animated.View style={{ position: 'absolute', inset: 0 }}>
          {model.dust.map((d) => (
            <View
              key={d.id}
              style={{
                position: 'absolute',
                left: `${d.x}%`,
                top: `${d.y}%`,
                width: 16 * d.scale,
                height: 6 * d.scale,
                borderRadius: 999,
                opacity: d.opacity * 0.14,
                backgroundColor: '#99B4DA',
              }}
            />
          ))}
        </Animated.View>
        <Animated.View style={{ position: 'absolute', inset: 0 }}>
          {model.starsNear.map((s) => (
            <View
              key={s.id}
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: 1.3 * s.scale,
                height: 1.3 * s.scale,
                borderRadius: 99,
                opacity: s.opacity * 0.6,
                backgroundColor: '#EAF4FF',
              }}
            />
          ))}
        </Animated.View>
      </Animated.View>

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -175, marginTop: -44, width: 350, height: 88, borderRadius: 999, backgroundColor: 'rgba(255,210,145,0.08)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -145, marginTop: -34, width: 290, height: 68, borderRadius: 999, backgroundColor: 'rgba(255,189,122,0.12)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -102, marginTop: -24, width: 204, height: 48, borderRadius: 999, backgroundColor: 'rgba(255,170,92,0.2)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -70, marginTop: -18, width: 140, height: 36, borderRadius: 999, backgroundColor: 'rgba(255,241,210,0.24)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -44, marginTop: -12, width: 88, height: 24, borderRadius: 999, backgroundColor: 'rgba(255,255,242,0.29)' }} />
      <Animated.View style={{ position: 'absolute', inset: 0, opacity: shimmerOpacity }}>
        <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -130, marginTop: -26, width: 260, height: 52, borderRadius: 999, backgroundColor: 'rgba(255,232,180,0.2)' }} />
      </Animated.View>

      <View style={{ position: 'absolute', inset: 0 }}>
        {model.systems.map((n) => {
          const meta = systemMetaByNumber.get(n.systemNumber);
          const partType = meta?.partType || 'default';
          const color = meta?.conquered
            ? DEFAULT_NODE_COLORS.conquered
            : (DEFAULT_NODE_COLORS as any)[partType] || DEFAULT_NODE_COLORS.default;
          const farT = (n.z + 1) * 0.5;
          const dotSize = 4 + n.scale * 4.8;
          const glowSize = dotSize * 1.95;
          return (
            <View key={n.id} style={{ position: 'absolute', left: `${n.x}%`, top: `${n.y}%`, marginLeft: -dotSize / 2, marginTop: -dotSize / 2 }}>
              <View
                style={{
                  position: 'absolute',
                  left: -(glowSize - dotSize) / 2,
                  top: -(glowSize - dotSize) / 2,
                  width: glowSize,
                  height: glowSize,
                  borderRadius: 999,
                  backgroundColor: color,
                  opacity: 0.1 + farT * 0.24,
                }}
              />
              <View
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: 999,
                  borderWidth: 0.8,
                  borderColor: `${color}CC`,
                  backgroundColor: color,
                  opacity: n.opacity,
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.12)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(8,13,22,0.06)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 2, marginTop: -1, backgroundColor: 'rgba(255,214,154,0.06)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 18, marginTop: -9, backgroundColor: 'rgba(255,205,130,0.03)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
        {Array.from({ length: 48 }).map((_, i) => {
          const x = ((i * 181.3) % 10000) / 100;
          const y = ((i * 149.7) % 10000) / 100;
          const w = 12 + (i % 9) * 5;
          const h = 4 + (i % 4) * 1.2;
          return (
            <View
              key={`h-${i}`}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                width: w,
                height: h,
                borderRadius: 999,
                backgroundColor: 'rgba(130,150,185,0.045)',
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
