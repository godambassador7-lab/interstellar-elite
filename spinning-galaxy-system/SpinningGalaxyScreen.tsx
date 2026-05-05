import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
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

  const [timeMs, setTimeMs] = useState(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const simTimeRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const tick = (t) => {
      if (!mounted) return;
      if (!lastTickRef.current) lastTickRef.current = t;
      const rawDelta = t - lastTickRef.current;
      lastTickRef.current = t;
      const delta = Math.max(0, Math.min(24, rawDelta));
      // Sim time runs slower than wall time and clamps frame jumps for smoother motion.
      simTimeRef.current += delta * 0.72;
      setTimeMs(simTimeRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      lastTickRef.current = 0;
      simTimeRef.current = 0;
    };
  }, [galaxyId]);

  const frame = useMemo(() => projectOrbitalFrame(model, timeMs), [model, timeMs]);

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

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -250, marginTop: -95, width: 500, height: 190, borderRadius: 999, backgroundColor: 'rgba(102,136,188,0.09)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -220, marginTop: -74, width: 440, height: 148, borderRadius: 999, backgroundColor: 'rgba(145,176,225,0.07)' }} />

      {[28, 38, 50].map((r, i) => (
        <View
          key={`ring-${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -r,
            marginTop: -(r * 0.34),
            width: r * 2,
            height: r * 0.68,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(150,175,210,0.08)',
          }}
        />
      ))}

      <View style={{ position: 'absolute', inset: 0 }}>
        {frame.arms.map((p) => (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 1.6 * p.scale,
              height: 1.6 * p.scale,
              borderRadius: 99,
              backgroundColor: p.z > 0 ? '#F2F7FF' : '#BFD8FF',
              opacity: p.opacity * (0.34 + (1 - Math.abs(p.y - 50) / 60) * 0.36),
            }}
          />
        ))}
      </View>

      <View style={{ position: 'absolute', inset: 0 }}>
        {frame.lanes.map((p) => (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 9 * p.scale,
              height: 2.8 * p.scale,
              borderRadius: 999,
              backgroundColor: 'rgba(10,16,28,0.95)',
              opacity: p.opacity * 0.14,
            }}
          />
        ))}
      </View>

      <View style={{ position: 'absolute', inset: 0 }}>
        {frame.dust.map((p) => (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 14 * p.scale,
              height: 4 * p.scale,
              borderRadius: 999,
              backgroundColor: p.z > 0 ? '#DCEBFF' : '#9AB7DF',
              opacity: p.opacity * 0.1,
            }}
          />
        ))}
      </View>

      <View style={{ position: 'absolute', inset: 0 }}>
        {frame.halo.map((p) => (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 5.5 * p.scale,
              height: 2.2 * p.scale,
              borderRadius: 999,
              backgroundColor: '#BED2F2',
              opacity: p.opacity * 0.06,
            }}
          />
        ))}
      </View>

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -78, marginTop: -33, width: 156, height: 66, borderRadius: 999, backgroundColor: 'rgba(255,175,84,0.16)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -58, marginTop: -26, width: 116, height: 52, borderRadius: 999, backgroundColor: 'rgba(255,220,164,0.24)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -42, marginTop: -19, width: 84, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,247,222,0.34)' }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -28, marginTop: -13, width: 56, height: 26, borderRadius: 999, backgroundColor: 'rgba(255,255,248,0.45)' }} />

      <View style={{ position: 'absolute', inset: 0 }}>
        {frame.systems.map((s) => {
          const color = s.conquered ? NODE_COLORS.conquered : (NODE_COLORS[s.partType] || NODE_COLORS.default);
          const dot = 4.2 + s.scale * 4.4;
          const glow = dot * 2.0;
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
                  opacity: s.opacity * 0.21,
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
                  opacity: s.opacity,
                }}
              />
            </View>
          );
        })}
      </View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.12)' }} />
    </View>
  );
}
