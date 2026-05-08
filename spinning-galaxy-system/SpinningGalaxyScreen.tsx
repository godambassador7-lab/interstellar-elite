import React, { useMemo } from 'react';
import { View, Platform, Image } from 'react-native';
import { buildOrbitalGalaxyModel, projectOrbitalFrame } from './spinningGalaxyEngine';

const NODE_COLORS = {
  conquered: '#63FF9E',
  MECH: '#8DFF9F',
  PLASMA: '#64D7FF',
  VOID: '#C488FF',
  BIO: '#FFD26B',
  default: '#FFE26D',
};
const GALAXY_STATIC_BG = require('../inline_image_preview.jpg');

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

      <View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ scale: 1.01 }],
        }}
      >
      <View
        style={{
          position: 'absolute',
          inset: 0,
          transform: [{ rotateZ: '0deg' }],
          ...(Platform.OS === 'web' ? { willChange: 'transform, opacity' } : null),
        }}
      >
        <Image
          source={GALAXY_STATIC_BG}
          resizeMode="cover"
          style={{ position: 'absolute', left: '4%', top: '4%', width: '92%', height: '92%', borderRadius: 999, opacity: 0.82 }}
        />
        

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
                  <View
                    style={{
                      position: 'absolute',
                      left: -(beaconRing - dot) / 2,
                      top: -(beaconRing - dot) / 2,
                      width: beaconRing,
                      height: beaconRing,
                      borderRadius: 999,
                      borderWidth: 1.3,
                      borderColor: `${color}DD`,
                      opacity: 0.85,
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
      </View>
      </View>

      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -78, marginTop: -78, width: 156, height: 156, borderRadius: 999, backgroundColor: 'rgba(255,168,80,0.105)', opacity: 0.92 }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -62, marginTop: -62, width: 124, height: 124, borderRadius: 999, backgroundColor: 'rgba(255,206,138,0.165)', opacity: 0.94 }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -48, marginTop: -48, width: 96, height: 96, borderRadius: 999, backgroundColor: 'rgba(255,238,194,0.265)', opacity: 0.96 }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -35, marginTop: -35, width: 70, height: 70, borderRadius: 999, backgroundColor: 'rgba(255,248,226,0.39)', opacity: 0.98 }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: 999, backgroundColor: 'rgba(255,253,244,0.62)', opacity: 1 }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -16, marginTop: -16, width: 32, height: 32, borderRadius: 999, backgroundColor: 'rgba(255,255,252,0.88)', opacity: 1 }} />
      <View style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -48, marginTop: -18, width: 96, height: 36, borderRadius: 999, borderWidth: 1.1, borderColor: 'rgba(255,232,182,0.34)', opacity: 0.36 }} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(103,243,255,0.12)' }} />
    </View>
  );
}
