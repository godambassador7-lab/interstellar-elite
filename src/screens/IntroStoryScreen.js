import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function IntroStoryScreen({ onContinue }) {
  const [typedChars, setTypedChars] = useState(0);
  const [starDrift, setStarDrift] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const stars = useMemo(
    () => Array.from({ length: 72 }, (_, i) => ({
      id: `intro-star-${i}`,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.2,
      speed: 0.15 + Math.random() * 0.55,
      opacity: 0.25 + Math.random() * 0.65,
    })),
    []
  );
  const fullText = useMemo(() => (
`The universe is failing.

Every empire chased stronger weapons. Every rupture weakened space-time. Your warnings were ignored until stolen shield technology became the next generation of planet-killers.

Now the collapse has a name:

THE GREAT CRITICAL MASS

You are the Celestial Engineer. Your Stabilization Network is the only system that can keep reality intact.

The mission is simple:

Secure fractured systems.
Strip catastrophic weapons from enemy fleets.
Expand the network before the universe tears itself apart.

The deeper record is fragmented. More of it will unlock as you reclaim the map.`
  ), []);

  useEffect(() => {
    setTypedChars(0);
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 480, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= fullText.length) return prev;
        return Math.min(fullText.length, prev + 1);
      });
    }, 38);
    return () => clearInterval(interval);
  }, [fullText]);
  useEffect(() => {
    const id = setInterval(() => setStarDrift((v) => (v + 0.6) % 120), 40);
    return () => clearInterval(id);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: fade,
              transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}
        >
          CELESTIAL ENGINEER DOSSIER
        </Animated.Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View pointerEvents="none" style={styles.starLayer}>
            {stars.map((s) => (
              <View
                key={s.id}
                style={[
                  styles.star,
                  {
                    left: `${s.x}%`,
                    top: `${((s.y + starDrift * s.speed) % 120) - 10}%`,
                    width: s.size,
                    height: s.size,
                    opacity: s.opacity,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.text}>{fullText.slice(0, typedChars)}</Text>
        </ScrollView>
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={onContinue}>
          <Text style={styles.buttonText}>BEGIN MISSION</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#03060D' },
  root: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 26,
    backgroundColor: 'rgba(3,6,13,0.98)',
  },
  title: {
    color: '#9ED9FF',
    fontFamily: 'Courier New',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 14,
  },
  scroll: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(130,197,238,0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(7,12,24,0.84)',
  },
  content: { paddingHorizontal: 16, paddingVertical: 14 },
  starLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  text: {
    color: '#FFFFFF',
    fontFamily: 'Courier New',
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.35,
    fontWeight: 'bold',
  },
  button: {
    marginTop: 14,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#6ED8FF',
    borderRadius: 8,
    backgroundColor: 'rgba(71,181,255,0.18)',
    paddingHorizontal: 26,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#C7EDFF',
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1.1,
  },
});
