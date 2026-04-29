// src/components/GameCanvas.js
// Uses React Native's Canvas via a custom drawing approach with Animated + absolute positioning

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, Animated, Text, Image } from 'react-native';
import { SCREEN, COLORS, PLAYER, ABILITIES } from '../utils/constants';

const PLAYER_SHIP_SPRITE = require('../../user ship1.png');
const ENEMY_SPRITES = {
  flagship: [
    require('../../Enemy Fighter Pack/Flag ship/flag ship 1.png'),
    require('../../Enemy Fighter Pack/Flag ship/flagship 2.png'),
    require('../../Enemy Fighter Pack/Flag ship/flagship 3.png'),
  ],
  destroyer: [
    require('../../Enemy Fighter Pack/Destroyers/destroyer1.png'),
    require('../../Enemy Fighter Pack/Destroyers/destroyer2.png'),
    require('../../Enemy Fighter Pack/Destroyers/destroyer 3.png'),
  ],
  interceptor: [
    require('../../Enemy Fighter Pack/Interceptors/Interceptor 1.png'),
    require('../../Enemy Fighter Pack/Interceptors/Interceptor 2.png'),
    require('../../Enemy Fighter Pack/Interceptors/Interceptor 3.png'),
  ],
  fighter: [
    require('../../Enemy Fighter Pack/Small fighers/small fighter 1.png'),
    require('../../Enemy Fighter Pack/Small fighers/small fighter 2.png'),
    require('../../Enemy Fighter Pack/Small fighers/small fighter 3.png'),
  ],
};

// Star field - static background stars
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: Math.random() * SCREEN.width,
  y: Math.random() * SCREEN.height,
  size: 0.5 + Math.random() * 1.5,
  opacity: 0.2 + Math.random() * 0.6,
  twinkleSpeed: 0.3 + Math.random() * 1.5,
  twinkleOffset: Math.random() * Math.PI * 2,
}));

// A single rendered frame drawn as React Native View elements.
// For optimal performance we use a flat list of absolutely positioned views
// managed imperatively via refs.

export function useShakeOffset(screenShake) {
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;

  const applyShake = useCallback((magnitude) => {
    if (magnitude < 0.5) return;
    shakeX.setValue((Math.random() - 0.5) * magnitude * 2);
    shakeY.setValue((Math.random() - 0.5) * magnitude * 2);
    Animated.parallel([
      Animated.spring(shakeX, { toValue: 0, tension: 200, friction: 8, useNativeDriver: true }),
      Animated.spring(shakeY, { toValue: 0, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [shakeX, shakeY]);

  return { shakeX, shakeY, applyShake };
}

// Player ship component - rendered as geometric shapes
export function PlayerShip({ x, y, hitFlash, attackFlash, facingAngle = 0, dashActive, isMoving = false, time = 0 }) {
  const size = PLAYER.SIZE;
  const flamePulse = 0.78 + 0.22 * Math.sin(time * 24);

  return (
    <View style={{ position: 'absolute', left: x - size, top: y - size, width: size * 2, height: size * 2 }}>
      <View style={{
        position: 'absolute',
        left: size * 0.1,
        top: size * 0.1,
        width: size * 1.8,
        height: size * 1.8,
        borderRadius: size * 0.9,
        backgroundColor: COLORS.playerGlow,
        opacity: dashActive ? 0.34 : 0.2,
      }} />

      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, transform: [{ rotate: `${facingAngle}deg` }] }}>
        {isMoving && (
          <>
            <View style={{
              position: 'absolute',
              left: size * 0.72,
              top: size * 1.62,
              width: size * 0.26,
              height: size * 0.66 * flamePulse,
              borderRadius: size * 0.13,
              backgroundColor: 'rgba(117,236,255,0.95)',
              shadowColor: '#6EEFFF',
              shadowOpacity: 1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }} />
            <View style={{
              position: 'absolute',
              left: size * 1.02,
              top: size * 1.62,
              width: size * 0.26,
              height: size * 0.66 * flamePulse,
              borderRadius: size * 0.13,
              backgroundColor: 'rgba(68,196,255,0.95)',
              shadowColor: '#49C6FF',
              shadowOpacity: 1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            }} />
          </>
        )}
        <Image
          source={PLAYER_SHIP_SPRITE}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: size * 2,
            height: size * 2,
            opacity: hitFlash > 0 ? 0.62 : 1,
            tintColor: hitFlash > 0 ? '#FF6A7A' : undefined,
          }}
        />
      </View>

      {attackFlash > 0 && (
        <View style={{
          position: 'absolute',
          left: -size * 0.2,
          top: -size * 0.2,
          width: size * 2.4,
          height: size * 2.4,
          borderRadius: size * 1.2,
          borderWidth: 1.6,
          borderColor: '#67F3FF',
          opacity: attackFlash / 9,
        }} />
      )}
    </View>
  );
}

// Enemy ship component
export function EnemyShip({ enemy }) {
  const { x, y, size, color, glow, type, hp, maxHp, hitFlash, facingAngle = 0 } = enemy;
  const flashColor = hitFlash > 0 ? '#FFFFFF' : (enemy.isLastFlagship ? '#FF2A2A' : color);
  const hpPct = hp / maxHp;
  const classKey = enemy.isNemesis ? 'flagship' : type === 'heavy' ? 'destroyer' : type === 'elite' ? 'interceptor' : 'fighter';
  const spritePool = ENEMY_SPRITES[classKey];
  const enemyId = String(enemy.id || '');
  const spriteSeed = enemyId.split('').reduce((acc, ch) => ((acc * 31) + ch.charCodeAt(0)) >>> 0, 7);
  const sprite = spritePool[spriteSeed % spritePool.length];
  const scaleByClass = classKey === 'flagship' ? 7.0 : classKey === 'destroyer' ? 3.15 : classKey === 'interceptor' ? 5.4 : 2.3;
  const shipBox = size * scaleByClass;
  const showHpBar = classKey === 'destroyer' || classKey === 'flagship';
  const enemySpeed = Math.hypot(enemy.vx || 0, enemy.vy || 0);
  const moving = enemySpeed > 8;
  const t = (enemy.gameTime || 0) * 22 + (enemy.id?.length || 0);
  const pulse = 0.75 + 0.25 * Math.sin(t);
  const warmFlame = classKey === 'destroyer' || classKey === 'fighter';
  const rearThrustersOnSide = classKey === 'destroyer' || classKey === 'flagship';
  const shipAngle = (classKey === 'destroyer' || classKey === 'flagship') ? facingAngle - 90 : facingAngle;

  return (
    <View style={{ position: 'absolute', left: x - shipBox / 2, top: y - shipBox / 2, width: shipBox, height: shipBox }}>
      {/* Glow */}
      <View style={{
        position: 'absolute',
        left: shipBox * 0.08, top: shipBox * 0.08,
        width: shipBox * 0.84, height: shipBox * 0.84,
        borderRadius: shipBox * 0.42,
        backgroundColor: flashColor,
        opacity: hitFlash > 0 ? 0.5 : (enemy.isLastFlagship ? 0.34 : 0.12),
        shadowColor: enemy.isLastFlagship ? '#FF1C1C' : flashColor,
        shadowOpacity: enemy.isLastFlagship ? 0.95 : 0.4,
        shadowRadius: enemy.isLastFlagship ? 20 : 7,
        shadowOffset: { width: 0, height: 0 },
      }} />

      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, transform: [{ rotate: `${shipAngle}deg` }] }}>
        {moving && (
          <>
            <View style={{
              position: 'absolute',
              left: rearThrustersOnSide ? shipBox * 0.14 : shipBox * 0.41,
              top: rearThrustersOnSide ? shipBox * 0.44 : shipBox * 0.82,
              width: rearThrustersOnSide ? shipBox * 0.18 * pulse : shipBox * 0.08,
              height: rearThrustersOnSide ? shipBox * 0.08 : shipBox * 0.2 * pulse,
              borderRadius: shipBox * 0.04,
              backgroundColor: warmFlame ? 'rgba(255,130,62,0.95)' : 'rgba(117,236,255,0.95)',
              shadowColor: warmFlame ? '#FF7E36' : '#6EEFFF',
              shadowOpacity: 0.95,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 0 },
            }} />
            <View style={{
              position: 'absolute',
              left: rearThrustersOnSide ? shipBox * 0.14 : shipBox * 0.51,
              top: rearThrustersOnSide ? shipBox * 0.54 : shipBox * 0.82,
              width: rearThrustersOnSide ? shipBox * 0.18 * pulse : shipBox * 0.08,
              height: rearThrustersOnSide ? shipBox * 0.08 : shipBox * 0.2 * pulse,
              borderRadius: shipBox * 0.04,
              backgroundColor: warmFlame ? 'rgba(255,84,52,0.95)' : 'rgba(79,188,255,0.95)',
              shadowColor: warmFlame ? '#FF5538' : '#49C6FF',
              shadowOpacity: 0.95,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 0 },
            }} />
          </>
        )}
        <Image
          source={sprite}
          resizeMode="contain"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: shipBox,
            height: shipBox,
            opacity: hitFlash > 0 ? 0.65 : 1,
            tintColor: hitFlash > 0 ? '#FFFFFF' : (enemy.isLastFlagship ? '#FF7676' : undefined),
          }}
        />
      </View>
      {showHpBar && (
        <View style={{
          position: 'absolute',
          left: shipBox * 0.14,
          top: shipBox * 0.96,
          width: shipBox * 0.72,
          height: 3,
          backgroundColor: '#333',
          borderRadius: 2,
        }}>
          <View style={{
            width: `${hpPct * 100}%`,
            height: '100%',
            backgroundColor: hpPct > 0.5 ? '#FF4444' : '#FF8800',
            borderRadius: 2,
          }} />
        </View>
      )}
    </View>
  );
}

// Particle component
export function Particle({ p }) {
  const opacity = p.life / p.maxLife;
  const scale = p.type === 'explosion' ? 0.5 + opacity * 0.5 : 1;
  return (
    <View style={{
      position: 'absolute',
      left: p.x - p.size / 2,
      top: p.y - p.size / 2,
      width: p.size,
      height: p.size,
      borderRadius: p.size / 2,
      backgroundColor: p.color,
      opacity: opacity * (p.type === 'explosion' ? 0.9 : 0.7),
      transform: [{ scale }],
    }} />
  );
}

// Dash trail
export function DashTrail({ trail }) {
  return (
    <>
      {trail.map(t => (
        <View key={t.id} style={{
          position: 'absolute',
          left: t.x - 8,
          top: t.y - 8,
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: COLORS.playerGlow,
          opacity: (t.life / t.maxLife) * 0.5,
        }} />
      ))}
    </>
  );
}

// Pulse ring effect
export function PulseRing({ x, y, active, elapsed }) {
  if (!active) return null;
  const progress = elapsed / ABILITIES.PULSE.DURATION;
  const radius = ABILITIES.PULSE.RADIUS * progress;
  const opacity = 1 - progress;
  return (
    <View style={{
      position: 'absolute',
      left: x - radius,
      top: y - radius,
      width: radius * 2,
      height: radius * 2,
      borderRadius: radius,
      borderWidth: 5.5,
      borderColor: '#73F0FF',
      backgroundColor: `rgba(115,240,255,${opacity * 0.14})`,
      shadowColor: '#73F0FF',
      shadowOpacity: 0.9,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      opacity,
    }} />
  );
}

// Drone orbit renderers
export function DroneOrbit({ positions, active }) {
  if (!active || !positions.length) return null;
  return (
    <>
      {positions.map((pos, i) => (
        <View key={i} style={{
          position: 'absolute',
          left: pos.x - 8, top: pos.y - 8,
          width: 16, height: 16,
          borderRadius: 8,
          backgroundColor: '#B46CFF',
          shadowColor: '#B46CFF',
          shadowRadius: 8, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }}>
          <View style={{
            position: 'absolute', left: 4, top: 4, width: 8, height: 8,
            borderRadius: 4, backgroundColor: '#FFFFFF', opacity: 0.8,
          }} />
        </View>
      ))}
    </>
  );
}

// Star field background
export function StarField({ time, cameraX = 0, cameraY = 0 }) {
  return (
    <>
      {STARS.map((star, i) => (
        (() => {
          const driftX = time * (3 + star.twinkleSpeed * 4) + cameraX * 0.12;
          const driftY = time * (1.5 + star.twinkleSpeed * 2.2) + cameraY * 0.1;
          const x = ((star.x - driftX) % SCREEN.width + SCREEN.width) % SCREEN.width;
          const y = ((star.y - driftY) % SCREEN.height + SCREEN.height) % SCREEN.height;
          return (
        <View key={i} style={{
          position: 'absolute',
          left: x - star.size / 2,
          top: y - star.size / 2,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: i % 7 === 0 ? '#74E9FF' : i % 11 === 0 ? '#D291FF' : '#FFFFFF',
          opacity: star.opacity * (0.7 + 0.3 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset)),
        }} />
          );
        })()
      ))}
    </>
  );
}

// Attack range indicator
export function AttackRangeIndicator({ x, y, range }) {
  return (
    <View style={{
      position: 'absolute',
      left: x - range, top: y - range,
      width: range * 2, height: range * 2,
      borderRadius: range,
      borderWidth: 0.5,
      borderColor: 'rgba(103,243,255,0.18)',
      backgroundColor: 'transparent',
    }} />
  );
}

export function QuantumPickup({ x, y, active }) {
  if (!active) return null;
  return (
    <View style={{
      position: 'absolute',
      left: x - 22,
      top: y - 22,
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: '#4AA8FF',
      backgroundColor: 'rgba(74,168,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#4AA8FF',
      shadowRadius: 14,
      shadowOpacity: 0.8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 7,
    }}>
      <View style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#8BDAFF',
      }} />
    </View>
  );
}

export function QuantumSwipeTrail({ trail }) {
  if (!trail?.length) return null;
  return (
    <>
      {trail.map((seg) => {
        const dx = seg.toX - seg.fromX;
        const dy = seg.toY - seg.fromY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={seg.id}
            style={{
              position: 'absolute',
              left: seg.fromX,
              top: seg.fromY - 2,
              width: Math.max(2, len),
              height: 4,
              borderRadius: 2,
              backgroundColor: '#7EE9FF',
              opacity: seg.opacity,
              transform: [{ rotate: `${angle}deg` }],
              shadowColor: '#7EE9FF',
              shadowRadius: 8,
              shadowOpacity: 0.8,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </>
  );
}

export function DamageNumbers({ numbers }) {
  if (!numbers?.length) return null;
  return (
    <>
      {numbers.map((n) => (
        (() => {
          const isCritical = !!n.critical;
          const color = isCritical ? '#FF7A2E' : '#FFFFFF';
          const shadow = isCritical ? '#FF5C1F' : '#7FD9FF';
          return (
        <Text
          key={n.id}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y,
            color,
            fontFamily: 'Courier New',
            fontSize: isCritical ? 14 : 12,
            fontWeight: 'bold',
            textShadowColor: shadow,
            textShadowRadius: 6,
            textShadowOffset: { width: 0, height: 0 },
            opacity: n.opacity ?? 1,
          }}
        >
          -{n.value}
        </Text>
          );
        })()
      ))}
    </>
  );
}
