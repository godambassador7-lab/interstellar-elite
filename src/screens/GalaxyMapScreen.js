// src/screens/GalaxyMapScreen.js

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import { GALAXIES, QUADRANT_DEFS } from '../utils/constants';
import { PART_TYPES, getMetaUpgradePartCost } from '../systems/MetaUpgradeSystem';
import ConquestScreen from './ConquestScreen';
import { getStationUpgradeCost } from '../systems/NemesisSystem';

const LOGICAL_MAP_WIDTH = 2400;
const LOGICAL_MAP_HEIGHT = 1400;
const MAP_REPEAT_X = 1;
const PINCH_SENSITIVITY = 0.96;
const UNIVERSE_MAP_IMAGE = Platform.OS === 'web'
  ? require('../../universe map (1)-web.jpg')
  : require('../../universe map (1).png');
const ZOOM_MAX = 1.05;
const NODE_MIN_SPACING = 72;
let MAP_ASSET = {};
try {
  MAP_ASSET = typeof Image.resolveAssetSource === 'function'
    ? (Image.resolveAssetSource(UNIVERSE_MAP_IMAGE) || {})
    : {};
} catch (_) {
  MAP_ASSET = {};
}
const BASE_MAP_WIDTH = MAP_ASSET.width || LOGICAL_MAP_WIDTH;
const BASE_MAP_HEIGHT = MAP_ASSET.height || LOGICAL_MAP_HEIGHT;
const MAP_SCALE_X = BASE_MAP_WIDTH / LOGICAL_MAP_WIDTH;
const MAP_SCALE_Y = BASE_MAP_HEIGHT / LOGICAL_MAP_HEIGHT;
const MAP_WIDTH = BASE_MAP_WIDTH * MAP_REPEAT_X;
const MAP_HEIGHT = BASE_MAP_HEIGHT;

const BG_STARS = Array.from({ length: 180 }, (_, i) => ({
  id: i,
  x: Math.random() * MAP_WIDTH,
  y: Math.random() * MAP_HEIGHT,
  size: 0.8 + Math.random() * 2.1,
  opacity: 0.2 + Math.random() * 0.7,
}));


function DoubleChevronArrow({ left, top, scale = 1, color = '#33D6FF', rotation = 0 }) {
  const w = 116 * scale;
  const h = 116 * scale;
  const t = Math.max(2, 5 * scale);
  const line = (x, y, width, height, rotate) => (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        backgroundColor: color,
        borderRadius: t,
        transform: [{ rotate: `${rotate}deg` }],
      }}
    />
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top,
        width: w,
        height: h,
        opacity: 0.95,
        transform: [{ rotate: `${rotation}deg` }],
      }}
    >
      {line(w * 0.1, h * 0.2, w * 0.42, t, -28)}
      {line(w * 0.48, h * 0.2, w * 0.42, t, 28)}
      {line(w * 0.1, h * 0.46, w * 0.42, t, -28)}
      {line(w * 0.48, h * 0.46, w * 0.42, t, 28)}
    </View>
  );
}

function formatWarCredits(value) {
  const n = Math.max(0, Number(value) || 0);
  if (n < 1000) return `${Math.floor(n)}`;
  const units = [
    { s: 1e15, u: 'Q' },
    { s: 1e12, u: 'T' },
    { s: 1e9, u: 'B' },
    { s: 1e6, u: 'M' },
    { s: 1e3, u: 'K' },
  ];
  for (const unit of units) {
    if (n >= unit.s) {
      const scaled = n / unit.s;
      const text = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2);
      return `${text.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}${unit.u}`;
    }
  }
  return `${Math.floor(n)}`;
}

const PART_LABELS = {
  mech: 'MECH',
  plasma: 'PLASMA',
  void: 'VOID',
  bio: 'BIO',
};

export default function GalaxyMapScreen({
  unlockedGalaxyIndex,
  completedSystemsByGalaxy,
  warCredits,
  shipParts,
  shipPartsByType,
  ownedMetaUpgrades,
  metaUpgradeCatalog,
  stationUpgradeCatalog,
  stationUpgrades,
  territories,
  defenseEvents,
  onBuyMetaUpgrade,
  onBuyStationUpgrade,
  onSelectGalaxy,
  onBack,
  onDefendStation,
}) {
  const [zoom, setZoom] = useState(1);
  const [lockCurrentGalaxy, setLockCurrentGalaxy] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [conquestGalaxy, setConquestGalaxy] = useState(null);
  const [isPinching, setIsPinching] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const activeBeaconAnim = useRef(new Animated.Value(0)).current;
  const outerScrollRef = useRef(null);
  const innerScrollRef = useRef(null);
  const scrollXRef = useRef(0);
  const scrollYRef = useRef(0);
  const zoomRef = useRef(1);
  const didInitZoomRef = useRef(false);
  const pinchRafRef = useRef(null);
  const pendingPinchRef = useRef(null);
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startZoom: 1,
    startCenterContentX: 0,
    startCenterContentY: 0,
    startMapX: 0,
    startMapY: 0,
  });

  const zoomMin = useMemo(() => {
    if (!viewport.width || !viewport.height) return 0.42;
    const fitX = viewport.width / MAP_WIDTH;
    const fitY = viewport.height / MAP_HEIGHT;
    return Math.max(0.12, Math.min(fitX, fitY));
  }, [viewport.width, viewport.height]);

  useEffect(() => {
    setZoom((z) => Math.max(zoomMin, Math.min(ZOOM_MAX, z)));
  }, [zoomMin]);
  useEffect(() => {
    if (didInitZoomRef.current) return;
    if (!viewport.width || !viewport.height) return;
    setZoom(zoomMin);
    didInitZoomRef.current = true;
  }, [zoomMin, viewport.width, viewport.height]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(activeBeaconAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(activeBeaconAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeBeaconAnim]);

  const scaledWidth = Math.round(MAP_WIDTH * zoom);
  const scaledHeight = Math.round(MAP_HEIGHT * zoom);
  const contentWidth = Math.max(scaledWidth, viewport.width || 0);
  const contentHeight = Math.max(scaledHeight, viewport.height || 0);

  const avgThreat = useMemo(() => {
    const values = Object.values(territories || {});
    if (!values.length) return 0;
    return values.reduce((acc, t) => acc + (t.threat || 0), 0) / values.length;
  }, [territories]);

  const baseGalaxies = useMemo(
    () =>
      GALAXIES.map((g, index) => {
        const completedSystems = completedSystemsByGalaxy?.[index] || 0;
        return {
          ...g,
          index,
          unlocked: index <= unlockedGalaxyIndex,
          completedSystems,
          galaxyComplete: completedSystems >= g.systems,
        };
      }),
    [unlockedGalaxyIndex, completedSystemsByGalaxy]
  );
  const galaxies = useMemo(() => {
    const next = baseGalaxies.map((g) => ({ ...g }));
    const margin = 52;
    for (let iter = 0; iter < 16; iter++) {
      for (let i = 0; i < next.length; i++) {
        for (let j = i + 1; j < next.length; j++) {
          const a = next[i];
          const b = next[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt((dx * dx) + (dy * dy)) || 0.0001;
          if (dist >= NODE_MIN_SPACING) continue;
          const push = ((NODE_MIN_SPACING - dist) / 2) * 0.95;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
      for (const g of next) {
        g.x = Math.max(margin, Math.min(LOGICAL_MAP_WIDTH - margin, g.x));
        g.y = Math.max(margin, Math.min(LOGICAL_MAP_HEIGHT - margin, g.y));
      }
    }
    return next;
  }, [baseGalaxies]);

  const activeQuadrantId = useMemo(() => {
    const idx = Math.max(0, Math.min(unlockedGalaxyIndex, GALAXIES.length - 1));
    return GALAXIES[idx]?.quadrant || QUADRANT_DEFS[0]?.id;
  }, [unlockedGalaxyIndex]);
  const activeGalaxyId = useMemo(() => {
    const idx = Math.max(0, Math.min(unlockedGalaxyIndex, GALAXIES.length - 1));
    return GALAXIES[idx]?.id;
  }, [unlockedGalaxyIndex]);
  const activeGalaxy = useMemo(
    () => galaxies.find((g) => g.id === activeGalaxyId) || null,
    [galaxies, activeGalaxyId]
  );

  const organicBoundaries = useMemo(() => {
    const pointsV = [];
    const pointsH = [];
    const vStep = 24;
    const hStep = 24;
    const ampV = 44;
    const ampH = 40;
    const jitterV = Array.from({ length: Math.ceil(LOGICAL_MAP_HEIGHT / vStep) + 2 }, (_, i) => Math.sin(i * 3.11) * 10 + Math.cos(i * 1.73) * 6);
    const jitterH = Array.from({ length: Math.ceil(LOGICAL_MAP_WIDTH / hStep) + 2 }, (_, i) => Math.sin(i * 2.67) * 9 + Math.cos(i * 1.39) * 7);
    for (let y = 0; y <= LOGICAL_MAP_HEIGHT; y += vStep) {
      const idx = Math.floor(y / vStep);
      const x = 1200
        + Math.sin(y * 0.0105) * ampV
        + Math.sin(y * 0.034) * (ampV * 0.48)
        + jitterV[idx];
      pointsV.push({ x, y });
    }
    for (let x = 0; x <= LOGICAL_MAP_WIDTH; x += hStep) {
      const idx = Math.floor(x / hStep);
      const y = 700
        + Math.sin(x * 0.0096) * ampH
        + Math.sin(x * 0.0305) * (ampH * 0.52)
        + jitterH[idx];
      pointsH.push({ x, y });
    }
    return { pointsV, pointsH };
  }, []);

  const ownedLinks = useMemo(() => {
    const owned = galaxies
      .filter((g) => g.completedSystems > 0)
      .sort((a, b) => a.index - b.index);
    const links = [];
    for (let i = 1; i < owned.length; i++) {
      links.push({ from: owned[i - 1], to: owned[i] });
    }
    return links;
  }, [galaxies]);

  const expansionArrow = useMemo(() => {
    if (!galaxies.length) {
      return { mapX: LOGICAL_MAP_WIDTH * 0.9, mapY: LOGICAL_MAP_HEIGHT * 0.5, rotation: 90 };
    }

    const xs = galaxies.map((g) => g.x);
    const ys = galaxies.map((g) => g.y);
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(LOGICAL_MAP_WIDTH, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(LOGICAL_MAP_HEIGHT, Math.max(...ys));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const spaces = [
      { dir: 'left', value: minX },
      { dir: 'right', value: LOGICAL_MAP_WIDTH - maxX },
      { dir: 'up', value: minY },
      { dir: 'down', value: LOGICAL_MAP_HEIGHT - maxY },
    ];
    spaces.sort((a, b) => b.value - a.value);
    const winner = spaces[0]?.dir || 'right';

    if (winner === 'left') return { mapX: Math.max(96, minX - 120), mapY: centerY, rotation: -90 };
    if (winner === 'up') return { mapX: centerX, mapY: Math.max(96, minY - 120), rotation: 0 };
    if (winner === 'down') return { mapX: centerX, mapY: Math.min(LOGICAL_MAP_HEIGHT - 96, maxY + 120), rotation: 180 };
    return { mapX: Math.min(LOGICAL_MAP_WIDTH - 96, maxX + 120), mapY: centerY, rotation: 90 };
  }, [galaxies]);

  const clampScroll = useCallback((x, y, targetZoom) => {
    const nextWidth = MAP_WIDTH * targetZoom;
    const nextHeight = MAP_HEIGHT * targetZoom;
    const maxX = Math.max(0, nextWidth - viewport.width);
    const maxY = Math.max(0, nextHeight - viewport.height);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    };
  }, [viewport.width, viewport.height]);

  const getCenteredScrollForGalaxy = useCallback((galaxy, targetZoom) => {
    if (!galaxy || !viewport.width || !viewport.height) return null;
    const targetX = galaxy.x * MAP_SCALE_X * targetZoom - viewport.width / 2;
    const targetY = galaxy.y * MAP_SCALE_Y * targetZoom - viewport.height / 2;
    return clampScroll(targetX, targetY, targetZoom);
  }, [clampScroll, viewport.width, viewport.height]);

  const centerOnCurrentGalaxy = useCallback((targetZoom = zoomRef.current, animated = false) => {
    if (!activeGalaxy) return;
    const centered = getCenteredScrollForGalaxy(activeGalaxy, targetZoom);
    if (!centered) return;
    scrollXRef.current = centered.x;
    scrollYRef.current = centered.y;
    outerScrollRef.current?.scrollTo?.({ x: centered.x, animated });
    innerScrollRef.current?.scrollTo?.({ y: centered.y, animated });
  }, [activeGalaxy, getCenteredScrollForGalaxy]);

  const pinchMetrics = useCallback((touches) => {
    if (!touches || touches.length < 2) return null;
    const t0 = touches[0];
    const t1 = touches[1];
    const dx = t1.pageX - t0.pageX;
    const dy = t1.pageY - t0.pageY;
    return {
      distance: Math.sqrt(dx * dx + dy * dy),
      centerContentX: (t0.locationX + t1.locationX) / 2,
      centerContentY: (t0.locationY + t1.locationY) / 2,
    };
  }, []);

  const flushPinchFrame = useCallback(() => {
    const next = pendingPinchRef.current;
    pinchRafRef.current = null;
    if (!next) return;
    pendingPinchRef.current = null;
    if (Math.abs(next.zoom - zoomRef.current) < 0.0007) return;
    zoomRef.current = next.zoom;
    setZoom(next.zoom);
    scrollXRef.current = next.scrollX;
    scrollYRef.current = next.scrollY;
    outerScrollRef.current?.scrollTo?.({ x: next.scrollX, animated: false });
    innerScrollRef.current?.scrollTo?.({ y: next.scrollY, animated: false });
  }, []);

  const schedulePinchFrame = useCallback((nextZoom, nextScrollX, nextScrollY) => {
    pendingPinchRef.current = { zoom: nextZoom, scrollX: nextScrollX, scrollY: nextScrollY };
    if (pinchRafRef.current) return;
    pinchRafRef.current = requestAnimationFrame(flushPinchFrame);
  }, [flushPinchFrame]);

  const beginPinch = useCallback((touches) => {
    const p = pinchMetrics(touches);
    if (!p || p.distance < 6) return false;
    const currentZoom = zoomRef.current;
    pinchRef.current = {
      active: true,
      startDistance: p.distance,
      startZoom: currentZoom,
      startCenterContentX: p.centerContentX,
      startCenterContentY: p.centerContentY,
      startMapX: p.centerContentX / currentZoom,
      startMapY: p.centerContentY / currentZoom,
    };
    setIsPinching(true);
    return true;
  }, [pinchMetrics]);

  const handleFullView = useCallback(() => {
    const unlocked = galaxies.filter((g) => g.unlocked);
    if (!unlocked.length) {
      setZoom(zoomMin);
      return;
    }

    const padding = 220;
    const xs = unlocked.map((g) => g.x);
    const ys = unlocked.map((g) => g.y);
    const minX = Math.max(0, Math.min(...xs) - padding);
    const maxX = Math.min(LOGICAL_MAP_WIDTH, Math.max(...xs) + padding);
    const minY = Math.max(0, Math.min(...ys) - padding);
    const maxY = Math.min(LOGICAL_MAP_HEIGHT, Math.max(...ys) + padding);

    const { width, height } = Dimensions.get('window');
    const viewportW = Math.max(280, width - 24);
    const viewportH = Math.max(320, height - 300);
    const targetZoom = Math.max(
      zoomMin,
      Math.min(
        ZOOM_MAX,
        viewportW / Math.max(1, (maxX - minX) * MAP_SCALE_X),
        viewportH / Math.max(1, (maxY - minY) * MAP_SCALE_Y)
      )
    );

    setZoom(targetZoom);

    requestAnimationFrame(() => {
      const centerX = ((minX + maxX) / 2) * MAP_SCALE_X * targetZoom;
      const centerY = ((minY + maxY) / 2) * MAP_SCALE_Y * targetZoom;
      const scrollX = Math.max(0, centerX - viewportW / 2);
      const scrollY = Math.max(0, centerY - viewportH / 2);
      outerScrollRef.current?.scrollTo?.({ x: scrollX, animated: true });
      innerScrollRef.current?.scrollTo?.({ y: scrollY, animated: true });
    });
  }, [galaxies, zoomMin]);

  const onMapResponderGrant = useCallback((e) => {
    const touches = e?.nativeEvent?.touches || [];
    if (touches.length >= 2) beginPinch(touches);
  }, [beginPinch]);

  const onMapResponderMove = useCallback((e) => {
    const touches = e?.nativeEvent?.touches || [];
    if (touches.length < 2) return;

    if (!pinchRef.current.active) {
      if (!beginPinch(touches)) return;
    }

    const p = pinchMetrics(touches);
    if (!p || pinchRef.current.startDistance < 6) return;

    const rawRatio = p.distance / pinchRef.current.startDistance;
    const ratio = Math.max(0.15, 1 + (rawRatio - 1) * PINCH_SENSITIVITY);
    const nextZoom = Math.max(zoomMin, Math.min(ZOOM_MAX, pinchRef.current.startZoom * ratio));

    let clamped;
    if (lockCurrentGalaxy && activeGalaxy) {
      clamped = getCenteredScrollForGalaxy(activeGalaxy, nextZoom) || clampScroll(0, 0, nextZoom);
    } else {
      const anchorViewportX = p.centerContentX - scrollXRef.current;
      const anchorViewportY = p.centerContentY - scrollYRef.current;
      const nextScrollX = pinchRef.current.startMapX * nextZoom - anchorViewportX;
      const nextScrollY = pinchRef.current.startMapY * nextZoom - anchorViewportY;
      clamped = clampScroll(nextScrollX, nextScrollY, nextZoom);
    }
    schedulePinchFrame(nextZoom, clamped.x, clamped.y);
  }, [activeGalaxy, beginPinch, clampScroll, getCenteredScrollForGalaxy, lockCurrentGalaxy, pinchMetrics, schedulePinchFrame, zoomMin]);

  const endPinch = useCallback(() => {
    if (!pinchRef.current.active) return;
    pinchRef.current.active = false;
    if (pinchRafRef.current) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = null;
    }
    flushPinchFrame();
    setIsPinching(false);
  }, [flushPinchFrame]);

  const focusGalaxyById = useCallback((galaxyId) => {
    if (!galaxyId) return;
    const g = galaxies.find((item) => item.id === galaxyId);
    if (!g) return;
    const targetZoom = Math.max(zoomMin, Math.min(ZOOM_MAX, 2.15));
    setZoom(targetZoom);
    requestAnimationFrame(() => {
      const targetX = g.x * MAP_SCALE_X * targetZoom - viewport.width / 2;
      const targetY = g.y * MAP_SCALE_Y * targetZoom - viewport.height / 2;
      const maxX = Math.max(0, MAP_WIDTH * targetZoom - viewport.width);
      const maxY = Math.max(0, MAP_HEIGHT * targetZoom - viewport.height);
      const scrollX = Math.max(0, Math.min(maxX, targetX));
      const scrollY = Math.max(0, Math.min(maxY, targetY));
      outerScrollRef.current?.scrollTo?.({ x: scrollX, animated: true });
      innerScrollRef.current?.scrollTo?.({ y: scrollY, animated: true });
    });
  }, [galaxies, viewport.height, viewport.width, zoomMin]);

  useEffect(() => {
    if (!lockCurrentGalaxy) return;
    centerOnCurrentGalaxy(zoomRef.current, false);
  }, [lockCurrentGalaxy, zoom, viewport.width, viewport.height, activeGalaxyId, centerOnCurrentGalaxy]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <Text style={styles.backBtnText}>BACK</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            OBSERVABLE UNIVERSE MAP
          </Text>
        </View>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.overviewBtn} onPress={handleFullView} activeOpacity={0.8}>
            <Text style={styles.overviewBtnText}>FULL VIEW</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.lockBtn, lockCurrentGalaxy && styles.lockBtnActive]}
            onPress={() => {
              const next = !lockCurrentGalaxy;
              setLockCurrentGalaxy(next);
              if (next) centerOnCurrentGalaxy(zoomRef.current, true);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.lockBtnText, lockCurrentGalaxy && styles.lockBtnTextActive]}>
              CURRENT GALAXY {lockCurrentGalaxy ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.storeBtn} onPress={() => setShowStore(true)} activeOpacity={0.8}>
            <Text style={styles.storeBtnText}>STORE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.max(zoomMin, z - 0.15))}
            activeOpacity={0.8}
          >
            <Text style={styles.zoomBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.zoomReadout}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.15))}
            activeOpacity={0.8}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.subtitle}>Clear systems to unlock deeper galaxies.</Text>
      </View>
      <View style={styles.infoRow2}>
        <Text style={styles.creditTopText}>WAR CREDITS {formatWarCredits(warCredits)}</Text>
        <Text style={styles.partsTopText}>SHIP PARTS {formatWarCredits(shipParts)}</Text>
        <Text style={styles.partsBreakdown}>
          {PART_TYPES.map((k) => `${PART_LABELS[k]} ${formatWarCredits(shipPartsByType?.[k] || 0)}`).join('  |  ')}
        </Text>
        <Text style={styles.threatText}>GALACTIC THREAT {avgThreat.toFixed(1)} / 10</Text>
      </View>
      <View style={styles.quadLegend}>
        {QUADRANT_DEFS.map((q) => (
          <View key={q.id} style={styles.quadLegendItem}>
            <View style={[styles.quadLegendDot, { backgroundColor: q.accent }]} />
            <Text style={[styles.quadLegendText, { color: q.accent }]}>{q.label} {q.rank}</Text>
          </View>
        ))}
      </View>

      <View
        style={styles.mapViewport}
        onLayout={(e) => {
          const { x, y, width, height } = e.nativeEvent.layout;
          setViewport({ x, y, width, height });
        }}
      >
        <ScrollView
          ref={outerScrollRef}
          horizontal
          scrollEnabled={!isPinching && !lockCurrentGalaxy}
          onScroll={(e) => { scrollXRef.current = e.nativeEvent.contentOffset.x; }}
          scrollEventThrottle={8}
          style={styles.outerScroll}
          contentContainerStyle={[styles.outerScrollContent, { width: contentWidth }]}
        >
          <ScrollView
            ref={innerScrollRef}
            scrollEnabled={!isPinching && !lockCurrentGalaxy}
            onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={8}
            style={styles.innerScroll}
            contentContainerStyle={{
              width: contentWidth,
              height: contentHeight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={[styles.mapCanvas, { width: scaledWidth, height: scaledHeight }]}
              onStartShouldSetResponderCapture={(e) => (e?.nativeEvent?.touches?.length || 0) >= 2}
              onMoveShouldSetResponderCapture={(e) => (e?.nativeEvent?.touches?.length || 0) >= 2}
              onResponderGrant={onMapResponderGrant}
              onResponderMove={onMapResponderMove}
              onResponderRelease={endPinch}
              onResponderTerminate={endPinch}
            >
            <Image
              source={UNIVERSE_MAP_IMAGE}
              style={[styles.mapImage, { left: 0, top: 0, width: BASE_MAP_WIDTH * zoom, height: BASE_MAP_HEIGHT * zoom }]}
              resizeMode="cover"
            />
            <DoubleChevronArrow
              left={expansionArrow.mapX * MAP_SCALE_X * zoom - 58}
              top={expansionArrow.mapY * MAP_SCALE_Y * zoom - 58}
              scale={Math.max(0.8, zoom * 0.9)}
              color="#2FD8FF"
              rotation={expansionArrow.rotation}
            />

            {/* Quadron background tints */}
            {QUADRANT_DEFS.map((q) => (
              <View
                key={`qbg-${q.id}`}
                style={{
                  position: 'absolute',
                  left: q.x1 * MAP_SCALE_X * zoom,
                  top: q.y1 * MAP_SCALE_Y * zoom,
                  width: (q.x2 - q.x1) * MAP_SCALE_X * zoom,
                  height: (q.y2 - q.y1) * MAP_SCALE_Y * zoom,
                  backgroundColor: q.bgColor,
                }}
              />
            ))}

            {/* Organic quadrant boundaries */}
            {organicBoundaries.pointsV.map((p, i) => {
              if (i === 0) return null;
              const prev = organicBoundaries.pointsV[i - 1];
              const x1 = prev.x * MAP_SCALE_X * zoom;
              const y1 = prev.y * MAP_SCALE_Y * zoom;
              const x2 = p.x * MAP_SCALE_X * zoom;
              const y2 = p.y * MAP_SCALE_Y * zoom;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              return (
                <View key={`ov-${i}`} pointerEvents="none">
                  <View
                    style={{
                      position: 'absolute',
                      left: midX - len / 2,
                      top: midY - 1.9,
                      width: len,
                      height: 3.8,
                      borderRadius: 2,
                      backgroundColor: 'rgba(173,245,255,0.26)',
                      shadowColor: '#DDFBFF',
                      shadowOpacity: 0.85,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: midX - len / 2,
                      top: midY - 0.55,
                      width: len,
                      height: 1.1,
                      borderRadius: 1,
                      backgroundColor: 'rgba(228,251,255,0.92)',
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                </View>
              );
            })}
            {organicBoundaries.pointsH.map((p, i) => {
              if (i === 0) return null;
              const prev = organicBoundaries.pointsH[i - 1];
              const x1 = prev.x * MAP_SCALE_X * zoom;
              const y1 = prev.y * MAP_SCALE_Y * zoom;
              const x2 = p.x * MAP_SCALE_X * zoom;
              const y2 = p.y * MAP_SCALE_Y * zoom;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              return (
                <View key={`oh-${i}`} pointerEvents="none">
                  <View
                    style={{
                      position: 'absolute',
                      left: midX - len / 2,
                      top: midY - 1.9,
                      width: len,
                      height: 3.8,
                      borderRadius: 2,
                      backgroundColor: 'rgba(173,245,255,0.26)',
                      shadowColor: '#DDFBFF',
                      shadowOpacity: 0.85,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 0 },
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: midX - len / 2,
                      top: midY - 0.55,
                      width: len,
                      height: 1.1,
                      borderRadius: 1,
                      backgroundColor: 'rgba(228,251,255,0.92)',
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                </View>
              );
            })}

            {/* Straight active-quad borders removed: glow is now on organic separators */}

            {BG_STARS.map((s) => (
              <View
                key={s.id}
                style={{
                  position: 'absolute',
                  left: s.x * zoom,
                  top: s.y * zoom,
                  width: s.size,
                  height: s.size,
                  borderRadius: s.size / 2,
                  opacity: s.opacity,
                  backgroundColor: '#D7EEFF',
                }}
              />
            ))}

            {ownedLinks.map((link, idx) => {
              const x1 = link.from.x * MAP_SCALE_X * zoom;
              const y1 = link.from.y * MAP_SCALE_Y * zoom;
              const x2 = link.to.x * MAP_SCALE_X * zoom;
              const y2 = link.to.y * MAP_SCALE_Y * zoom;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const lineThickness = Math.max(1.2, 1.7 * zoom);
              return (
                <View key={`owned-link-${idx}`} pointerEvents="none">
                  <View
                    style={{
                      position: 'absolute',
                      left: midX - len / 2,
                      top: midY - lineThickness / 2,
                      width: len,
                      height: lineThickness,
                      borderRadius: lineThickness / 2,
                      backgroundColor: 'rgba(103,243,255,0.52)',
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: midX - len / 2,
                      top: midY - 0.35,
                      width: len,
                      height: 0.7,
                      borderRadius: 1,
                      backgroundColor: 'rgba(171,252,255,0.72)',
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                </View>
              );
            })}

            {/* Quadron corner labels */}
            {QUADRANT_DEFS.map((q) => (
              <Text
                key={`qlbl-${q.id}`}
                style={{
                  position: 'absolute',
                  left: (q.x1 + 24) * MAP_SCALE_X * zoom,
                  top: (q.y1 + 18) * MAP_SCALE_Y * zoom,
                  color: q.accent,
                  opacity: 0.42,
                  fontFamily: 'Courier New',
                  fontWeight: 'bold',
                  fontSize: Math.max(7, Math.round(20 * zoom)),
                  letterSpacing: 2,
                }}
              >
                {q.label}
              </Text>
            ))}

            {galaxies.map((g) => {
              const x  = g.x * MAP_SCALE_X * zoom;
              const y  = g.y * MAP_SCALE_Y * zoom;
              const sz = (g.unlocked ? 22 : 18) * zoom;
              const isActiveGalaxy = g.id === activeGalaxyId;
              const beaconScaleOuter = activeBeaconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1.55],
              });
              const beaconOpacityOuter = activeBeaconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.5, 0.08],
              });
              const beaconScaleInner = activeBeaconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.78, 1.2],
              });
              const beaconOpacityInner = activeBeaconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.42, 0.12],
              });

              return (
                <View key={g.id}>
                  {isActiveGalaxy && g.unlocked && (
                    <>
                      <Animated.View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          left: x - sz * 1.32,
                          top: y - sz * 1.32,
                          width: sz * 2.64,
                          height: sz * 2.64,
                          borderRadius: sz * 1.32,
                          borderWidth: Math.max(1.5, 2.2 * zoom),
                          borderColor: '#33E7FF',
                          opacity: beaconOpacityOuter,
                          transform: [{ scale: beaconScaleOuter }],
                        }}
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          left: x - sz * 1.02,
                          top: y - sz * 1.02,
                          width: sz * 2.04,
                          height: sz * 2.04,
                          borderRadius: sz * 1.02,
                          borderWidth: Math.max(1, 1.5 * zoom),
                          borderColor: '#86F6FF',
                          opacity: beaconOpacityInner,
                          transform: [{ scale: beaconScaleInner }],
                        }}
                      />
                    </>
                  )}
                  <TouchableOpacity
                    activeOpacity={g.unlocked ? 0.8 : 1}
                    disabled={!g.unlocked}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => setConquestGalaxy(g)}
                    onLongPress={() => onSelectGalaxy(g)}
                    delayLongPress={420}
                    style={{
                      position: 'absolute',
                      left: x - sz / 2,
                      top: y - sz / 2,
                      width: sz,
                      height: sz,
                      borderRadius: sz / 2,
                      borderWidth: g.unlocked ? 1.5 : 1,
                      borderColor: g.unlocked ? g.accent : 'rgba(145,160,185,0.3)',
                      backgroundColor: g.unlocked
                        ? (g.galaxyComplete ? `${g.accent}55` : `${g.accent}22`)
                        : 'rgba(14,18,28,0.85)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: sz * 0.4,
                        height: sz * 0.4,
                        borderRadius: (sz * 0.4) / 2,
                        backgroundColor: g.unlocked ? g.accent : 'rgba(145,160,185,0.35)',
                        opacity: g.galaxyComplete ? 1 : 0.75,
                      }}
                    />
                  </TouchableOpacity>

                  {zoom > 0.75 && g.unlocked && (
                    <View style={{ position: 'absolute', left: x - 40, top: y + sz * 0.6 + 2, width: 80 }}>
                      <Text style={[styles.galaxyName, { color: '#C8E8FF', fontSize: 7 }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                      {zoom > 1.1 && (
                        <Text style={[styles.galaxyMeta, { fontSize: 7 }]} numberOfLines={1}>
                          {g.galaxyComplete ? 'DONE' : `${g.completedSystems}/${g.systems}`}
                        </Text>
                      )}
                      {zoom > 1.4 && g.completedSystems > 0 && (
                        <Text style={[styles.galaxyMeta, { fontSize: 6, color: 'rgba(150,180,215,0.45)' }]} numberOfLines={1}>
                          hold: conquest
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      <View style={styles.eventPanel}>
        <Text style={styles.eventTitle}>NEMESIS FEED</Text>
        <ScrollView style={styles.eventScroll}>
          {(defenseEvents || []).slice(0, 6).map((ev, i) => (
            <TouchableOpacity
              key={`${ev.type}-${i}`}
              activeOpacity={ev.galaxyId ? 0.75 : 1}
              disabled={!ev.galaxyId}
              onPress={() => focusGalaxyById(ev.galaxyId)}
            >
              <Text style={[styles.eventLine, ev.galaxyId && styles.eventLineLink]}>
                {ev.type === 'system_lost' ? 'ALERT' : ev.type === 'defense_win' ? 'DEFENSE' : ev.type === 'defense_loss' ? 'BREACH' : 'WAR'}: {ev.summary}
              </Text>
            </TouchableOpacity>
          ))}
          {(!defenseEvents || defenseEvents.length === 0) && (
            <Text style={styles.eventLine}>No recent conflicts. The frontier is quiet.</Text>
          )}
        </ScrollView>
      </View>

      {showStore && (
        <View style={styles.storeOverlay}>
          <View style={styles.storePanel}>
            <View style={styles.storeHeader}>
              <Text style={styles.storeTitle}>MAP UPGRADE STORE</Text>
              <Text style={styles.storeCredits}>WAR CREDITS {formatWarCredits(warCredits)}</Text>
              <Text style={styles.storeParts}>SHIP PARTS {formatWarCredits(shipParts)}</Text>
              <Text style={styles.storePartsBreakdown}>
                {PART_TYPES.map((k) => `${PART_LABELS[k]} ${formatWarCredits(shipPartsByType?.[k] || 0)}`).join('  |  ')}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Pilot Core Upgrades</Text>
            <ScrollView style={styles.storeList} contentContainerStyle={{ paddingBottom: 8 }}>
              {PART_TYPES.map((partType) => {
                const group = metaUpgradeCatalog.filter((u) => (u.partType || 'mech') === partType);
                if (!group.length) return null;

                return (
                  <View key={`group-${partType}`}>
                    <Text style={styles.subSectionTitle}>{PART_LABELS[partType]} TECH TREE</Text>
                    {group.map((u) => {
                      const level = ownedMetaUpgrades?.[u.id] || 0;
                      const isMax = level >= u.maxLevel;
                      const cost = getMetaUpgradePartCost(u.id, level) || 0;
                      const canBuy = !isMax && (shipPartsByType?.[partType] || 0) >= cost;

                      return (
                        <View key={u.id} style={styles.storeItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.storeItemTitle}>{u.title}</Text>
                            <Text style={styles.storeItemDesc}>{u.desc}</Text>
                            <Text style={styles.storeItemMeta}>LV {level}/{u.maxLevel}  |  {PART_LABELS[partType]}</Text>
                          </View>

                          <View style={styles.storeItemRight}>
                            <Text style={styles.storeCost}>{isMax ? 'MAX' : `${cost.toLocaleString()} ${PART_LABELS[partType]}`}</Text>
                            <TouchableOpacity
                              style={[styles.buyBtn, (!canBuy || isMax) && styles.buyBtnDisabled]}
                              activeOpacity={canBuy ? 0.85 : 1}
                              disabled={!canBuy || isMax}
                              onPress={() => onBuyMetaUpgrade?.(u.id)}
                            >
                              <Text style={[styles.buyBtnText, (!canBuy || isMax) && styles.buyBtnTextDisabled]}>
                                {isMax ? 'MAXED' : canBuy ? 'BUY' : 'LOCKED'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              <Text style={styles.sectionTitle}>Defense Station Upgrades</Text>

              {stationUpgradeCatalog.map((u) => {
                const level = stationUpgrades?.[u.id] || 0;
                const isMax = level >= u.maxLevel;
                const cost = getStationUpgradeCost(u.id, level) || 0;
                const canBuy = !isMax && warCredits >= cost;

                return (
                  <View key={u.id} style={styles.storeItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.storeItemTitle}>{u.path}</Text>
                      <Text style={styles.storeItemDesc}>{u.title}: {u.desc}</Text>
                      <Text style={styles.storeItemMeta}>LV {level}/{u.maxLevel}</Text>
                    </View>

                    <View style={styles.storeItemRight}>
                      <Text style={styles.storeCost}>{isMax ? 'MAX' : cost.toLocaleString()}</Text>
                      <TouchableOpacity
                        style={[styles.buyBtn, (!canBuy || isMax) && styles.buyBtnDisabled]}
                        activeOpacity={canBuy ? 0.85 : 1}
                        disabled={!canBuy || isMax}
                        onPress={() => onBuyStationUpgrade?.(u.id)}
                      >
                        <Text style={[styles.buyBtnText, (!canBuy || isMax) && styles.buyBtnTextDisabled]}>
                          {isMax ? 'MAXED' : canBuy ? 'BUY' : 'LOCKED'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.8} onPress={() => setShowStore(false)}>
              <Text style={styles.closeBtnText}>CLOSE STORE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {conquestGalaxy && (
        <ConquestScreen
          galaxy={conquestGalaxy}
          territories={territories}
          completedSystems={conquestGalaxy.completedSystems}
          onClose={() => setConquestGalaxy(null)}
          onDefendStation={onDefendStation}
          onLaunchSystem={(systemNumber) => {
            onSelectGalaxy?.(conquestGalaxy, systemNumber);
            setConquestGalaxy(null);
          }}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  container: {
    flex: 1,
    backgroundColor: '#05070F',
    paddingTop: 6,
  },
  topBar: {
    paddingHorizontal: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 2,
    flex: 1,
    textAlign: 'center',
    marginRight: 44,
  },
  infoRow: {
    paddingHorizontal: 14,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  infoRow2: {
    paddingHorizontal: 14,
    marginTop: 4,
    marginBottom: 8,
    alignItems: 'center',
  },
  subtitle: {
    color: 'rgba(197,214,236,0.66)',
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 0.8,
    flexShrink: 1,
    paddingRight: 8,
  },
  creditText: {
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 'auto',
  },
  threatText: {
    color: 'rgba(255,127,127,0.88)',
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: 'bold',
    marginTop: 4,
  },
  creditTopText: {
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.1,
    textAlign: 'center',
  },
  partsTopText: {
    color: '#79D8FF',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
  },
  partsBreakdown: {
    marginTop: 3,
    color: 'rgba(169,212,240,0.78)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  backBtn: {
    borderWidth: 1,
    borderColor: '#67F3FF',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(103,243,255,0.1)',
  },
  backBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  overviewBtn: {
    borderWidth: 1,
    borderColor: '#67F3FF',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(103,243,255,0.12)',
  },
  overviewBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  lockBtn: {
    borderWidth: 1,
    borderColor: 'rgba(121,216,255,0.6)',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(41,107,145,0.15)',
  },
  lockBtnActive: {
    borderColor: '#6CF7FF',
    backgroundColor: 'rgba(54,182,205,0.24)',
  },
  lockBtnText: {
    color: '#9DDFFF',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.7,
  },
  lockBtnTextActive: {
    color: '#BDFDFF',
  },
  storeBtn: {
    borderWidth: 1,
    borderColor: '#FFC13A',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,193,58,0.12)',
  },
  storeBtnText: {
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  zoomBtn: {
    width: 24,
    height: 24,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#67F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(103,243,255,0.09)',
  },
  zoomBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: -1,
  },
  zoomReadout: {
    color: '#B7DDF8',
    fontFamily: 'Courier New',
    fontSize: 10,
    width: 46,
    textAlign: 'center',
  },
  mapViewport: {
    flex: 1,
  },
  outerScroll: {
    flex: 1,
  },
  outerScrollContent: {
    minWidth: '100%',
  },
  innerScroll: {
    flex: 1,
  },
  mapCanvas: {
    backgroundColor: '#060A14',
    overflow: 'hidden',
  },
  mapImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  quadLegend: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 14,
    flexWrap: 'wrap',
  },
  quadLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  quadLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  quadLegendText: {
    fontFamily: 'Courier New',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  galaxyName: {
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  galaxyMeta: {
    color: 'rgba(166,190,220,0.75)',
    fontFamily: 'Courier New',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 2,
  },
  lockText: {
    position: 'absolute',
    bottom: -16,
    color: '#8A97AB',
    fontFamily: 'Courier New',
    fontSize: 7,
    letterSpacing: 0.8,
  },

  eventPanel: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(103,243,255,0.22)',
    backgroundColor: 'rgba(8,12,22,0.96)',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    maxHeight: 130,
  },
  eventTitle: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  eventScroll: {
    flexGrow: 0,
  },
  eventLine: {
    color: 'rgba(188,206,230,0.86)',
    fontFamily: 'Courier New',
    fontSize: 8,
    lineHeight: 13,
    marginBottom: 4,
  },
  eventLineLink: {
    color: '#7FD9FF',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(127,217,255,0.65)',
  },

  storeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,8,14,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 300,
  },
  storePanel: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: 'rgba(103,243,255,0.36)',
    borderRadius: 8,
    backgroundColor: 'rgba(9,14,24,0.96)',
    padding: 12,
  },
  storeHeader: {
    marginBottom: 8,
  },
  storeTitle: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.4,
  },
  storeCredits: {
    marginTop: 4,
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  storeParts: {
    marginTop: 2,
    color: '#79D8FF',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  storePartsBreakdown: {
    marginTop: 2,
    color: 'rgba(169,212,240,0.78)',
    fontFamily: 'Courier New',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  sectionTitle: {
    color: 'rgba(127,242,255,0.9)',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 6,
  },
  subSectionTitle: {
    color: '#9ADFFF',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 5,
  },
  storeList: {
    maxHeight: 520,
  },
  storeItem: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(103,243,255,0.2)',
    borderRadius: 6,
    backgroundColor: 'rgba(13,20,33,0.9)',
    padding: 10,
    marginBottom: 8,
  },
  storeItemTitle: {
    color: '#EAF6FF',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.6,
  },
  storeItemDesc: {
    marginTop: 4,
    color: 'rgba(190,210,234,0.82)',
    fontFamily: 'Courier New',
    fontSize: 9,
    lineHeight: 13,
  },
  storeItemMeta: {
    marginTop: 6,
    color: 'rgba(127,242,255,0.72)',
    fontFamily: 'Courier New',
    fontSize: 9,
  },
  storeItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 86,
  },
  storeCost: {
    color: '#FFC13A',
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: 'bold',
  },
  buyBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#30FFB5',
    borderRadius: 4,
    backgroundColor: 'rgba(48,255,181,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  buyBtnDisabled: {
    borderColor: 'rgba(132,148,173,0.55)',
    backgroundColor: 'rgba(67,77,94,0.32)',
  },
  buyBtnText: {
    color: '#30FFB5',
    fontFamily: 'Courier New',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  buyBtnTextDisabled: {
    color: 'rgba(180,196,219,0.68)',
  },
  closeBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#67F3FF',
    borderRadius: 4,
    alignItems: 'center',
    paddingVertical: 10,
  },
  closeBtnText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
