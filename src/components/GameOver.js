// src/components/GameOver.js

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

export function GameOver({ score, combo, gameTime, onRestart }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(-40)).current;

  const minutes = Math.floor(gameTime / 60);
  const seconds = Math.floor(gameTime % 60);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(titleAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        <Animated.Text style={[styles.title, { transform: [{ translateY: titleAnim }] }]}>
          SYSTEM OFFLINE
        </Animated.Text>
        <Text style={styles.subtitle}>PILOT ELIMINATED</Text>

        <View style={styles.divider} />

        <View style={styles.statsBlock}>
          <StatRow label="FINAL SCORE" value={score.toLocaleString()} color="#00FFFF" large />
          <StatRow label="PEAK COMBO" value={`${combo}x`} color="#FFD700" />
          <StatRow label="SURVIVAL TIME" value={`${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`} color="#00FF88" />
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.restartBtn} onPress={onRestart} activeOpacity={0.8}>
          <Text style={styles.restartText}>REBOOT SYSTEM</Text>
          <View style={styles.restartGlow} />
        </TouchableOpacity>

        {/* Scan line effect */}
        <View style={styles.scanlines} pointerEvents="none" />
      </View>
    </Animated.View>
  );
}

function StatRow({ label, value, color, large }) {
  return (
    <View style={goStyles.row}>
      <Text style={goStyles.label}>{label}</Text>
      <Text style={[goStyles.value, { color, fontSize: large ? 22 : 16 }]}>{value}</Text>
    </View>
  );
}

const goStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    color: 'rgba(170,192,220,0.7)',
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 2,
  },
  value: {
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(4,7,14,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  content: {
    width: '80%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    color: '#FF4F62',
    fontFamily: 'Courier New',
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowColor: '#FF4F62',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255,133,145,0.52)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 5,
    marginBottom: 28,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(103,243,255,0.2)',
    marginVertical: 16,
  },
  statsBlock: {
    width: '100%',
  },
  restartBtn: {
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#67F3FF',
    borderRadius: 4,
    paddingHorizontal: 40,
    paddingVertical: 14,
    backgroundColor: 'rgba(103,243,255,0.09)',
    position: 'relative',
    overflow: 'hidden',
  },
  restartText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  restartGlow: {
    position: 'absolute',
    top: 0, left: '25%', right: '25%', height: 1,
    backgroundColor: '#67F3FF',
    opacity: 0.6,
  },
  scanlines: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.02,
  },
});
