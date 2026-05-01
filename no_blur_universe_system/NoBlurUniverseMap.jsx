import React, { useMemo, useState } from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import manifest from "../assets/universe/manifest.json";

/**
 * NoBlurUniverseMap
 *
 * Drop this component into your React Native / Expo app.
 *
 * Install:
 * npm install react-native-gesture-handler react-native-reanimated
 *
 * Expo:
 * npx expo install react-native-gesture-handler react-native-reanimated
 *
 * Important:
 * Put this in babel.config.js:
 * plugins: ["react-native-reanimated/plugin"]
 *
 * How it works:
 * - The map is split into 512px tiles at multiple zoom levels.
 * - At low zoom, it loads fewer low-res tiles.
 * - As the user zooms in, it swaps to higher-detail tiles.
 * - This avoids the “one giant blurry stretched image” problem.
 */

const TILE_SIZE = manifest.tileSize;
const LEVEL_COUNT = Object.keys(manifest.levels).length;

function getTileSource(z, x, y) {
  // Metro bundler cannot dynamically require unknown paths.
  // For production, use remote tiles from CDN, or generate this mapping automatically.
  // This demo uses a predictable URI for Expo web / dev server if assets are served statically.
  return { uri: `asset:/universe/tiles/${z}/${x}_${y}.jpg` };
}

function chooseZoomLevel(scale) {
  if (scale < 1.35) return 0;
  if (scale < 2.1) return 1;
  if (scale < 3.4) return 2;
  if (scale < 5.2) return 3;
  return Math.min(4, LEVEL_COUNT - 1);
}

export default function NoBlurUniverseMap() {
  const screen = Dimensions.get("window");
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const [zoomLevel, setZoomLevel] = useState(0);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      const nextScale = Math.max(1, Math.min(savedScale.value * event.scale, 6));
      scale.value = nextScale;
      runOnJS(setZoomLevel)(chooseZoomLevel(nextScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      tx.value = savedTx.value + event.translationX;
      ty.value = savedTy.value + event.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 3;
      scale.value = withTiming(next);
      savedScale.value = next;
      runOnJS(setZoomLevel)(chooseZoomLevel(next));
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const level = manifest.levels[String(zoomLevel)];

  const tiles = useMemo(() => {
    const arr = [];
    for (let y = 0; y < level.rows; y++) {
      for (let x = 0; x < level.cols; x++) {
        arr.push({ x, y, key: `${zoomLevel}-${x}-${y}` });
      }
    }
    return arr;
  }, [zoomLevel, level.rows, level.cols]);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            styles.map,
            {
              width: level.width,
              height: level.height,
              left: (screen.width - level.width) / 2,
              top: (screen.height - level.height) / 2,
            },
            animatedStyle,
          ]}
        >
          {tiles.map((tile) => (
            <Image
              key={tile.key}
              source={getTileSource(zoomLevel, tile.x, tile.y)}
              style={{
                position: "absolute",
                left: tile.x * TILE_SIZE,
                top: tile.y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
              }}
              resizeMode="cover"
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#02030a",
  },
  map: {
    position: "absolute",
  },
});