// src/components/AbilityButton.js

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function AbilityButton({ icon, label, cooldownPct, active, onPress, color, size = 56 }) {
  const isReady = cooldownPct <= 0;
  const displayColor = active ? '#FFFFFF' : isReady ? color : 'rgba(120,130,150,0.58)';
  const readyPct = Math.max(0, Math.min(1, 1 - cooldownPct));

  const q = readyPct * 4;
  const topFill = Math.min(1, q);
  const rightFill = Math.min(1, Math.max(0, q - 1));
  const bottomFill = Math.min(1, Math.max(0, q - 2));
  const leftFill = Math.min(1, Math.max(0, q - 3));

  const trackSize = size - 6;

  return (
    <TouchableOpacity
      onPressIn={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
      pressRetentionOffset={{ top: 18, left: 18, right: 18, bottom: 18 }}
      style={[styles.container, { width: size, height: size }]}
    >
      <View
        style={[
          styles.bg,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: active ? '#FFFFFF' : 'rgba(62,72,96,0.84)',
            borderWidth: 1.2,
            backgroundColor: active ? `${color}33` : isReady ? `${color}1A` : 'rgba(8,11,18,0.82)',
          },
        ]}
      >
        {!isReady && !active && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: size * (1 - cooldownPct),
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderBottomLeftRadius: size / 2,
              borderBottomRightRadius: size / 2,
              borderTopLeftRadius: cooldownPct < 0.1 ? size / 2 : 0,
              borderTopRightRadius: cooldownPct < 0.1 ? size / 2 : 0,
            }}
          />
        )}

        <View style={[styles.borderTrack, { width: trackSize, top: 3 }]}>
          <View style={[styles.borderFill, { backgroundColor: color, width: trackSize * topFill }]} />
        </View>
        <View style={[styles.borderTrackV, { height: trackSize, right: 3 }]}>
          <View style={[styles.borderFillV, { backgroundColor: color, height: trackSize * rightFill }]} />
        </View>
        <View style={[styles.borderTrack, { width: trackSize, bottom: 3, transform: [{ rotate: '180deg' }] }]}>
          <View style={[styles.borderFill, { backgroundColor: color, width: trackSize * bottomFill }]} />
        </View>
        <View style={[styles.borderTrackV, { height: trackSize, left: 3, bottom: 3, transform: [{ rotate: '180deg' }] }]}>
          <View style={[styles.borderFillV, { backgroundColor: color, height: trackSize * leftFill }]} />
        </View>

        <Text style={[styles.icon, { color: displayColor, fontSize: size * 0.36 }]}>{icon}</Text>

        {active && (
          <View
            style={{
              position: 'absolute',
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              borderWidth: 2,
              borderColor: '#FFFFFF',
              opacity: 0.6,
            }}
          />
        )}
      </View>

      {label && <Text style={[styles.label, { color: isReady ? color : '#4B5166' }]}>{label}</Text>}

      {isReady && !active && (
        <View
          style={{
            position: 'absolute',
            width: size * 0.2,
            height: size * 0.2,
            borderRadius: size * 0.1,
            backgroundColor: color,
            top: 2,
            right: 2,
            opacity: 0.9,
          }}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#83C8FF',
    shadowRadius: 8,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 0 },
  },
  borderTrack: {
    position: 'absolute',
    height: 2,
    backgroundColor: 'rgba(72,86,110,0.45)',
    left: 3,
    overflow: 'hidden',
    borderRadius: 1,
  },
  borderFill: {
    height: '100%',
  },
  borderTrackV: {
    position: 'absolute',
    width: 2,
    backgroundColor: 'rgba(72,86,110,0.45)',
    top: 3,
    overflow: 'hidden',
    borderRadius: 1,
  },
  borderFillV: {
    width: '100%',
  },
  icon: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontFamily: 'Courier New',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 7,
    marginTop: 2,
    letterSpacing: 1,
    fontFamily: 'Courier New',
  },
});
