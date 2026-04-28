// src/components/VirtualJoystick.js

import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';

const JOYSTICK_RADIUS = 56;
const KNOB_RADIUS = 24;

export function VirtualJoystick({ onMove, style }) {
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activeTouchId = useRef(null);
  const mouseActive = useRef(false);

  const updateFromLocalPoint = (x, y) => {
    const center = JOYSTICK_RADIUS;
    const dx = x - center;
    const dy = y - center;

    const len = Math.sqrt(dx * dx + dy * dy);
    const maxLen = JOYSTICK_RADIUS;
    const norm = len > maxLen ? maxLen / len : 1;

    const clampedX = dx * norm;
    const clampedY = dy * norm;

    setKnobPos({ x: clampedX, y: clampedY });
    onMove({ dx: clampedX / maxLen, dy: clampedY / maxLen });
  };

  const resetStick = () => {
    activeTouchId.current = null;
    setKnobPos({ x: 0, y: 0 });
    onMove({ dx: 0, dy: 0 });
  };

  const findActiveTouch = (evt) => {
    const touches = evt?.nativeEvent?.touches || [];
    if (activeTouchId.current === null) return null;
    return touches.find((t) => t.identifier === activeTouchId.current) || null;
  };

  const onStart = (evt) => {
    const nativeEvt = evt?.nativeEvent || {};
    const changed = evt?.nativeEvent?.changedTouches || [];
    if (changed.length) {
      if (activeTouchId.current !== null || mouseActive.current) return;
      const t = changed[0];
      activeTouchId.current = t.identifier;
      updateFromLocalPoint(t.locationX, t.locationY);
      return;
    }

    if (mouseActive.current || activeTouchId.current !== null) return;
    mouseActive.current = true;
    updateFromLocalPoint(nativeEvt.locationX ?? JOYSTICK_RADIUS, nativeEvt.locationY ?? JOYSTICK_RADIUS);
  };

  const handleMove = (evt) => {
    const touches = evt?.nativeEvent?.touches || [];
    if (touches.length) {
      const t = findActiveTouch(evt);
      if (!t) return;
      updateFromLocalPoint(t.locationX, t.locationY);
      return;
    }

    if (!mouseActive.current) return;
    const nativeEvt = evt?.nativeEvent || {};
    updateFromLocalPoint(nativeEvt.locationX ?? JOYSTICK_RADIUS, nativeEvt.locationY ?? JOYSTICK_RADIUS);
  };

  const onEnd = (evt) => {
    const touches = evt?.nativeEvent?.touches || [];
    if (touches.length && activeTouchId.current !== null) {
      const stillActive = touches.some((t) => t.identifier === activeTouchId.current);
      if (!stillActive) resetStick();
      return;
    }
    if (mouseActive.current) {
      mouseActive.current = false;
      resetStick();
    }
  };

  const onCancel = () => {
    mouseActive.current = false;
    resetStick();
  };

  return (
    <View style={[styles.joystickArea, style]} pointerEvents="box-none">
      <View
        style={styles.base}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onStart}
        onResponderMove={handleMove}
        onResponderRelease={onEnd}
        onResponderTerminate={onCancel}
        onResponderTerminationRequest={() => false}
        onTouchStart={onStart}
        onTouchMove={handleMove}
        onTouchEnd={onEnd}
        onTouchCancel={onCancel}
      >
        <View style={styles.baseRing} />
        <View style={styles.crossH} />
        <View style={styles.crossV} />

        <View
          style={[
            styles.baseDot,
            {
              transform: [{ translateX: knobPos.x }, { translateY: knobPos.y }],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  joystickArea: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  base: {
    width: JOYSTICK_RADIUS * 2,
    height: JOYSTICK_RADIUS * 2,
    borderRadius: JOYSTICK_RADIUS,
    backgroundColor: 'rgba(103,243,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(103,243,255,0.36)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  baseRing: {
    position: 'absolute',
    width: JOYSTICK_RADIUS * 1.3,
    height: JOYSTICK_RADIUS * 1.3,
    borderRadius: JOYSTICK_RADIUS * 0.65,
    borderWidth: 0.5,
    borderColor: 'rgba(103,243,255,0.22)',
  },
  baseDot: {
    width: KNOB_RADIUS * 2,
    height: KNOB_RADIUS * 2,
    borderRadius: KNOB_RADIUS,
    backgroundColor: 'rgba(103,243,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(103,243,255,0.58)',
  },
  crossH: {
    position: 'absolute',
    width: JOYSTICK_RADIUS * 1.6,
    height: 0.5,
    backgroundColor: 'rgba(103,243,255,0.16)',
  },
  crossV: {
    position: 'absolute',
    width: 0.5,
    height: JOYSTICK_RADIUS * 1.6,
    backgroundColor: 'rgba(103,243,255,0.16)',
  },
});
