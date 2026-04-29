// src/screens/MenuScreen.js

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image } from 'react-native';

const { width, height } = Dimensions.get('window');
const MENU_TITLE_IMAGE = require('../../main menu title.png');
const BATTLE_BACKGROUND_IMAGE = require('../../battle background.png');

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
      <Image source={BATTLE_BACKGROUND_IMAGE} resizeMode="cover" style={styles.battleBg} />
      <View style={styles.focusOverlay} />

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
  battleBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  focusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,10,20,0.34)',
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  titleSub: {
    color: 'rgba(196,230,255,0.9)',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 5,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
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
    color: 'rgba(182,241,255,0.95)',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 7,
    textShadowOffset: { width: 0, height: 1 },
  },
  tagDivider: {
    width: 40,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 8,
  },
  tagSub: {
    color: 'rgba(232,240,255,0.95)',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
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
    backgroundColor: 'rgba(6,12,25,0.92)',
  },
  abilityChipIcon: {
    fontSize: 10,
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    color: '#F0F8FF',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  abilityChipLabel: {
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },

  startBtn: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 4,
  },
  startBtnInner: {
    borderWidth: 2,
    borderColor: '#67F3FF',
    borderRadius: 4,
    paddingHorizontal: 48,
    paddingVertical: 16,
    backgroundColor: 'rgba(4,18,36,0.6)',
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
    color: 'rgba(230,238,255,0.85)',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 5,
    textShadowOffset: { width: 0, height: 1 },
  },
});
