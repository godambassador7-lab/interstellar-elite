import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function IntroStoryScreen({ onContinue }) {
  const [typedChars, setTypedChars] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const fullText = useMemo(() => (
`They called you a dreamer.
A coward hiding behind shields.
A scientist afraid of real power.

For decades, the civilizations of the known universe mocked your life's work - defensive barrier systems capable of absorbing the destructive force of stars themselves. While empires raced to create larger fleets, stronger cannons, and weapons capable of tearing holes through space-time, you warned them of the inevitable consequence:

Every distortion.
Every rupture.
Every experimental superweapon.

The universe was becoming unstable.

No one listened.

Then they stole your technology.

Your shielding systems were reverse-engineered into weapons beyond imagination. Planet-killers. Singularity bombs. Temporal fractures. Entire star systems vanished in moments as governments and warlords competed for domination. Space itself began to collapse under the strain.

Now, the universe approaches what your calculations named:

THE GREAT CRITICAL MASS

The final threshold where accumulated space-time instability triggers a total universal implosion.

There is no senate left to appeal to.
No alliance powerful enough to stop the chaos.
Only one truth remains:

The galaxy cannot be trusted with this power.

You are the Celestial Engineer - the greatest scientific mind ever born - and creator of the only technology capable of stabilizing the universe. To save existence itself, you must seize control of the fractured systems before rival empires destroy reality entirely.

Your mission is no longer conquest for power.

It is conquest for survival.

Every world secured strengthens the Stabilization Network.
Every enemy defeated removes another catastrophic weapon from circulation.
Every fleet you command pushes the universe one step farther from annihilation.

Some will call you a tyrant.
Others, a savior.

History will decide.

If history survives.`
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
        return Math.min(fullText.length, prev + 18);
      });
    }, 45);
    return () => clearInterval(interval);
  }, [fullText]);

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
  text: {
    color: 'rgba(214,232,255,0.92)',
    fontFamily: 'Courier New',
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.35,
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

