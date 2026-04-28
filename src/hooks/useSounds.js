// src/hooks/useSounds.js
// Sound system stub — structure ready for expo-av or react-native-sound integration

import { useRef, useCallback } from 'react';

/**
 * Sound event types used throughout the game.
 * Replace each stub with actual audio loading via expo-av when adding assets:
 *
 *   import { Audio } from 'expo-av';
 *   const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/laser.mp3'));
 *   await sound.playAsync();
 */
const SOUND_IDS = {
  LASER: 'laser',
  EXPLOSION: 'explosion',
  EXPLOSION_HEAVY: 'explosion_heavy',
  DASH: 'dash',
  PULSE: 'pulse',
  DRONE_START: 'drone_start',
  HIT_PLAYER: 'hit_player',
  UPGRADE: 'upgrade',
  COMBO_2X: 'combo_2x',
  COMBO_5X: 'combo_5x',
  COMBO_10X: 'combo_10x',
  GAME_OVER: 'game_over',
};

export function useSounds() {
  const soundsLoaded = useRef(false);
  const soundMap = useRef({});

  // Load all sounds (call once on game init)
  const loadSounds = useCallback(async () => {
    // TODO: load audio files here
    // Example:
    // const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/laser.mp3'));
    // soundMap.current[SOUND_IDS.LASER] = sound;
    soundsLoaded.current = true;
  }, []);

  // Play a sound by ID
  const play = useCallback((soundId, options = {}) => {
    if (!soundsLoaded.current) return;
    const sound = soundMap.current[soundId];
    if (!sound) return;
    // sound.replayAsync();
  }, []);

  // Convenience wrappers
  const playLaser = useCallback(() => play(SOUND_IDS.LASER), [play]);
  const playExplosion = useCallback((heavy = false) =>
    play(heavy ? SOUND_IDS.EXPLOSION_HEAVY : SOUND_IDS.EXPLOSION), [play]);
  const playDash = useCallback(() => play(SOUND_IDS.DASH), [play]);
  const playPulse = useCallback(() => play(SOUND_IDS.PULSE), [play]);
  const playDroneStart = useCallback(() => play(SOUND_IDS.DRONE_START), [play]);
  const playHitPlayer = useCallback(() => play(SOUND_IDS.HIT_PLAYER), [play]);
  const playUpgrade = useCallback(() => play(SOUND_IDS.UPGRADE), [play]);
  const playCombo = useCallback((comboCount) => {
    if (comboCount >= 10) play(SOUND_IDS.COMBO_10X);
    else if (comboCount >= 5) play(SOUND_IDS.COMBO_5X);
    else if (comboCount >= 2) play(SOUND_IDS.COMBO_2X);
  }, [play]);
  const playGameOver = useCallback(() => play(SOUND_IDS.GAME_OVER), [play]);

  // Unload all sounds (call on unmount)
  const unloadSounds = useCallback(async () => {
    for (const sound of Object.values(soundMap.current)) {
      try { await sound.unloadAsync(); } catch (e) {}
    }
    soundMap.current = {};
    soundsLoaded.current = false;
  }, []);

  return {
    loadSounds,
    unloadSounds,
    playLaser,
    playExplosion,
    playDash,
    playPulse,
    playDroneStart,
    playHitPlayer,
    playUpgrade,
    playCombo,
    playGameOver,
  };
}
