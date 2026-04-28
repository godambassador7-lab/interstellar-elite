// src/screens/MenuScreen.js

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image } from 'react-native';

const { width, height } = Dimensions.get('window');
const MENU_TITLE_IMAGE = require('../../main menu title.png');

const STARS = Array.from({ length: 60 }, () => ({
  x: Math.random() * width,
  y: Math.random() * height,
  size: 0.8 + Math.random() * 2,
  opacity: 0.15 + Math.random() * 0.7,
}));

export default function MenuScreen({ onStart }) {
  const titleScale = useRef(new Animated.Value(0.7)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(titleScale, { toValue: 1, tension: 50, friction: 10, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.nebulaA} />
      <View style={styles.nebulaB} />
      <View style={styles.nebulaC} />

      {STARS.map((star, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#FFFFFF',
            opacity: star.opacity,
          }}
        />
      ))}

      <View style={styles.horizon} />

      <Animated.View style={[styles.titleBlock, { opacity: titleOpacity, transform: [{ scale: titleScale }] }]}>
        <Text style={styles.titleSub}>MOBILIZED COMBAT SERIES</Text>
        <Image source={MENU_TITLE_IMAGE} resizeMode="contain" style={styles.titleImage} />
        <View style={styles.titleLine} />
      </Animated.View>

      <Animated.View style={[styles.tagBlock, { opacity: subtitleOpacity }]}> 
        <Text style={styles.tag}>SLASH | COMBO | SURVIVE</Text>
        <View style={styles.tagDivider} />
        <Text style={styles.tagSub}>Destroy enemy fleets. Build your combo. Upgrade your ship.</Text>
      </Animated.View>

      <Animated.View style={[styles.abilitiesRow, { opacity: subtitleOpacity }]}> 
        {[
          { icon: 'DSH', label: 'DASH SLASH', color: '#30FFB5' },
          { icon: 'PLS', label: 'ENERGY PULSE', color: '#FF7A2E' },
          { icon: 'ORB', label: 'DRONE ORBIT', color: '#B46CFF' },
        ].map((a) => (
          <View key={a.label} style={[styles.abilityChip, { borderColor: a.color }]}> 
            <Text style={styles.abilityChipIcon}>{a.icon}</Text>
            <Text style={[styles.abilityChipLabel, { color: a.color }]}>{a.label}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={{ opacity: btnOpacity, transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.8}>
          <View style={styles.startBtnInner}>
            <Text style={styles.startText}>LAUNCH MISSION</Text>
          </View>
          <View style={styles.startBtnGlowTop} />
          <View style={styles.startBtnGlowBottom} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.Text style={[styles.hint, { opacity: subtitleOpacity }]}> 
        Use joystick to move | Abilities activate on tap
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  nebulaA: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -40,
    left: -80,
    backgroundColor: 'rgba(178,80,255,0.14)',
  },
  nebulaB: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    bottom: 40,
    right: -60,
    backgroundColor: 'rgba(34,214,255,0.1)',
  },
  nebulaC: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    bottom: -40,
    left: 40,
    backgroundColor: 'rgba(255,84,102,0.08)',
  },
  horizon: {
    position: 'absolute',
    bottom: height * 0.3,
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(103,243,255,0.2)',
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  titleSub: {
    color: 'rgba(152,195,255,0.5)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 5,
    marginBottom: 8,
  },
  titleImage: {
    width: '100%',
    maxWidth: 420,
    height: 160,
  },
  titleLine: {
    width: 120,
    height: 2,
    backgroundColor: '#67F3FF',
    marginTop: 8,
    opacity: 0.6,
    shadowColor: '#67F3FF',
    shadowRadius: 8,
    shadowOpacity: 1,
  },

  tagBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  tag: {
    color: 'rgba(139,231,255,0.62)',
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 4,
    marginBottom: 8,
  },
  tagDivider: {
    width: 40,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 8,
  },
  tagSub: {
    color: 'rgba(183,201,225,0.62)',
    fontFamily: 'Courier New',
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.5,
  },

  abilitiesRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
  },
  abilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(7,12,22,0.8)',
  },
  abilityChipIcon: {
    fontSize: 9,
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    color: '#D7EBFF',
    letterSpacing: 0.8,
  },
  abilityChipLabel: {
    fontFamily: 'Courier New',
    fontSize: 8,
    letterSpacing: 1,
  },

  startBtn: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  startBtnInner: {
    borderWidth: 1.5,
    borderColor: '#67F3FF',
    borderRadius: 4,
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: 'rgba(103,243,255,0.09)',
  },
  startText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 5,
    textShadowColor: '#67F3FF',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  startBtnGlowTop: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: '#67F3FF',
    opacity: 0.65,
  },
  startBtnGlowBottom: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 1,
    backgroundColor: '#67F3FF',
    opacity: 0.4,
  },

  hint: {
    color: 'rgba(202,219,242,0.33)',
    fontFamily: 'Courier New',
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 20,
    textAlign: 'center',
  },
});
