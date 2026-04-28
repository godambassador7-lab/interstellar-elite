// src/components/UpgradeScreen.js

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export function UpgradeScreen({ choices, score, onSelect }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(choices.map(() => new Animated.Value(0.6))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ...scaleAnims.map((a, i) =>
        Animated.spring(a, {
          toValue: 1,
          tension: 80,
          friction: 10,
          delay: i * 80,
          useNativeDriver: true,
        })
      ),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Background grid effect */}
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.gridLine, {
            top: (height / 8) * i, left: 0, right: 0, height: 0.5,
          }]} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.gridLine, {
            left: (width / 6) * i, top: 0, bottom: 0, width: 0.5,
          }]} />
        ))}
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>ENHANCEMENT PROTOCOL</Text>
        <Text style={styles.scoreText}>SCORE: {score.toLocaleString()}</Text>
        <Text style={styles.subtitle}>SELECT UPGRADE</Text>

        <View style={styles.cardsRow}>
          {choices.map((upgrade, i) => (
            <Animated.View key={upgrade.id} style={{ transform: [{ scale: scaleAnims[i] }] }}>
              <TouchableOpacity
                style={[styles.card, { borderColor: upgrade.color }]}
                onPress={() => onSelect(upgrade.id)}
                activeOpacity={0.8}
              >
                {/* Glow corner */}
                <View style={[styles.cardGlow, { backgroundColor: upgrade.color }]} />

                <Text style={[styles.cardIcon, { textShadowColor: upgrade.color }]}>
                  {upgrade.icon}
                </Text>
                <Text style={[styles.cardTitle, { color: upgrade.color }]}>
                  {upgrade.title}
                </Text>
                <Text style={styles.cardDesc}>{upgrade.desc}</Text>

                {/* Bottom bar */}
                <View style={[styles.cardBar, { backgroundColor: upgrade.color }]} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.hint}>Tap to select and continue</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(4,7,14,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  grid: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(86,170,255,0.12)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  title: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowColor: '#67F3FF',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
    marginBottom: 4,
  },
  scoreText: {
    color: 'rgba(127,242,255,0.64)',
    fontFamily: 'Courier New',
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 20,
  },
  subtitle: {
    color: 'rgba(200,215,236,0.66)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 4,
    marginBottom: 24,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  card: {
    width: 100,
    backgroundColor: 'rgba(8,12,22,0.92)',
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  cardGlow: {
    position: 'absolute',
    top: 0, right: 0,
    width: 30, height: 30,
    borderBottomLeftRadius: 30,
    opacity: 0.2,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  cardTitle: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  cardDesc: {
    color: 'rgba(196,208,225,0.78)',
    fontFamily: 'Courier New',
    fontSize: 8,
    textAlign: 'center',
    lineHeight: 12,
    marginBottom: 10,
  },
  cardBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 2.5,
    opacity: 0.8,
  },
  hint: {
    color: 'rgba(202,219,242,0.38)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 24,
  },
});
