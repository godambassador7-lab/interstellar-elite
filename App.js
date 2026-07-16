// App.js

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StatusBar, StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Asset } from 'expo-asset';

import MenuScreen from './src/screens/MenuScreen';
import IntroStoryScreen from './src/screens/IntroStoryScreen';
import UniverseMapScreen from './src/screens/UniverseMapScreen';
import GameScreen from './src/screens/GameScreen';
import StationDefenseScreen from './src/screens/StationDefenseScreen';
import DefensePrepScreen from './src/screens/DefensePrepScreen';
import { GALAXIES } from './src/utils/constants';
import {
  META_UPGRADES,
  PART_TYPES,
  getMetaUpgradeById,
  getMetaUpgradePartCost,
} from './src/systems/MetaUpgradeSystem';
import {
  STATION_UPGRADES,
  createInitialCommanders,
  createInitialEnemyMemory,
  createTerritory,
  mergePlayerCombatMemory,
  getStationUpgradeById,
  getStationUpgradeCost,
  simulateNemesisTurn,
} from './src/systems/NemesisSystem';

const CORE_ASSETS = [
  require('./ChatGPT Image Apr 25, 2026, 09_38_15 PM.png'),
  require('./main menu title.png'),
  require('./battle background.png'),
  require('./universe map.png'),
  require('./user ship1.png'),
];

const WARM_ASSETS = [
  require('./Enemy Fighter Pack/Destroyers/destroyer 3.png'),
  require('./Enemy Fighter Pack/Destroyers/destroyer1.png'),
  require('./Enemy Fighter Pack/Destroyers/destroyer2.png'),
  require('./Enemy Fighter Pack/Flag ship/flag ship 1.png'),
  require('./Enemy Fighter Pack/Flag ship/flagship 2.png'),
  require('./Enemy Fighter Pack/Flag ship/flagship 3.png'),
  require('./Enemy Fighter Pack/Interceptors/Interceptor 1.png'),
  require('./Enemy Fighter Pack/Interceptors/Interceptor 2.png'),
  require('./Enemy Fighter Pack/Interceptors/Interceptor 3.png'),
  require('./Enemy Fighter Pack/Small fighers/small fighter 1.png'),
  require('./Enemy Fighter Pack/Small fighers/small fighter 2.png'),
  require('./Enemy Fighter Pack/Small fighers/small fighter 3.png'),
];

export default function App() {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [availableViewport, setAvailableViewport] = useState({ width: viewportWidth, height: viewportHeight });
  const [coreAssetsReady, setCoreAssetsReady] = useState(false);
  const [assetLoadPct, setAssetLoadPct] = useState(0);
  const logoPulse = useRef(new Animated.Value(0)).current;
  const loadScan = useRef(new Animated.Value(0)).current;
  const [screen, setScreen] = useState('menu'); // menu | intro | map | game | defense_prep | defense
  const [selectedGalaxy, setSelectedGalaxy] = useState(GALAXIES[0]);
  const [runProfile, setRunProfile] = useState('combat');
  const [selectedSystemNumber, setSelectedSystemNumber] = useState(1);
  const [selectedForceGiganautOnly, setSelectedForceGiganautOnly] = useState(false);
  const [selectedForceGiganautAfterWavesNoDetonation, setSelectedForceGiganautAfterWavesNoDetonation] = useState(false);
  const [selectedDefenseTerritory, setSelectedDefenseTerritory] = useState(null);
  const [autoOpenGalaxyId, setAutoOpenGalaxyId] = useState(null);
  const [selectedDefenseDoctrine, setSelectedDefenseDoctrine] = useState('fortress');
  const [warCredits, setWarCredits] = useState(0);
  const [shipPartsByType, setShipPartsByType] = useState({
    mech: 0,
    plasma: 0,
    void: 0,
    bio: 0,
  });
  const [doctrineUsage, setDoctrineUsage] = useState({
    fortress: 0,
    sniper_grid: 0,
    swarm_control: 0,
    scavenger: 0,
  });
  const [ownedMetaUpgrades, setOwnedMetaUpgrades] = useState({});
  const [stationUpgrades, setStationUpgrades] = useState({
    offense_grid: 0,
    defense_matrix: 0,
    tactical_core: 0,
    support_wing: 0,
  });
  const [completedSystemsByGalaxy, setCompletedSystemsByGalaxy] = useState(GALAXIES.map(() => 0));
  const [territories, setTerritories] = useState({});
  const [enemyMemory, setEnemyMemory] = useState(createInitialEnemyMemory());
  const [nemesisCommanders, setNemesisCommanders] = useState(createInitialCommanders());
  const [defenseEvents, setDefenseEvents] = useState([]);
  const [flawlessSystemsStreak, setFlawlessSystemsStreak] = useState(0);
  const [giganautFirstPickTestPending, setGiganautFirstPickTestPending] = useState(false);
  const [specialScenario, setSpecialScenario] = useState(null); // null | singularity | meganaut | armageddon
  const [specialProgress, setSpecialProgress] = useState({
    singularityComplete: false,
    meganautComplete: false,
    armageddonComplete: false,
  });
  const [quadrantAbilityUnlocks, setQuadrantAbilityUnlocks] = useState({
    bayron: false,
    crimson: false,
    watupi: false,
    ultra316: false,
  });
  const shouldRotateForMobileWeb =
    Platform.OS === 'web' && viewportHeight > viewportWidth && Math.min(viewportWidth, viewportHeight) <= 820;
  const landscapeFrameStyle = shouldRotateForMobileWeb
    ? {
        // Use the root's measured content box. On iOS this excludes the notch,
        // home indicator and browser chrome via the CSS safe-area padding.
        width: availableViewport.height,
        height: availableViewport.width,
        flex: 0,
        transform: [{ rotate: '90deg' }],
      }
    : null;

  const requestLandscapePlayback = async () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (_) {
      // Fullscreen is optional and browser-dependent.
    }

    try {
      await window.screen?.orientation?.lock?.('landscape');
    } catch (_) {
      // Orientation lock usually requires fullscreen and is not supported everywhere.
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadCoreAssets = async () => {
      const assets = [...CORE_ASSETS, ...WARM_ASSETS];
      const total = assets.length;
      let loaded = 0;
      try {
        for (const mod of assets) {
          try {
            // Load one by one so we can surface a real percentage.
            await Asset.fromModule(mod).downloadAsync();
          } catch (_) {
            // Non-fatal per asset.
          } finally {
            loaded += 1;
            if (!cancelled) {
              const pct = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
              setAssetLoadPct(pct);
            }
          }
        }
      } catch (_) {
        // Non-fatal: app still runs with on-demand asset loading.
      } finally {
        if (!cancelled) {
          setAssetLoadPct(100);
          setCoreAssetsReady(true);
        }
      }
    };

    loadCoreAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const logoLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const scanLoop = Animated.loop(
      Animated.timing(loadScan, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    logoLoop.start();
    scanLoop.start();

    return () => {
      logoLoop.stop();
      scanLoop.stop();
    };
  }, [loadScan, logoPulse]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
      bodyMargin: body.style.margin,
      rootHeight: root?.style.height ?? '',
      rootOverflow: root?.style.overflow ?? '',
    };

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'none';
    body.style.margin = '0';

    if (root) {
      root.style.height = '100dvh';
      root.style.overflow = 'hidden';
    }

    const scrollbarStyleId = 'interstellar-scrollbar-theme';
    let scrollbarStyle = document.getElementById(scrollbarStyleId);
    if (!scrollbarStyle) {
      scrollbarStyle = document.createElement('style');
      scrollbarStyle.id = scrollbarStyleId;
      scrollbarStyle.textContent = `
        *::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        *::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        *::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(22, 22, 24, 0.82) 0%,
            rgba(6, 6, 8, 0.72) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 10px;
          box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.08), 0 0 10px rgba(0, 0, 0, 0.45);
        }
        *::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            180deg,
            rgba(34, 34, 36, 0.9) 0%,
            rgba(10, 10, 12, 0.8) 100%
          );
        }
        * {
          scrollbar-color: rgba(22, 22, 24, 0.85) rgba(0, 0, 0, 0.24);
          scrollbar-width: thin;
        }
      `;
      document.head.appendChild(scrollbarStyle);
    }

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.touchAction = prev.bodyTouchAction;
      body.style.margin = prev.bodyMargin;
      if (root) {
        root.style.height = prev.rootHeight;
        root.style.overflow = prev.rootOverflow;
      }
      const nextScrollbarStyle = document.getElementById(scrollbarStyleId);
      if (nextScrollbarStyle) nextScrollbarStyle.remove();
    };
  }, []);

  const unlockedGalaxyIndex = useMemo(() => {
    let unlocked = 0;
    for (let i = 0; i < GALAXIES.length - 1; i++) {
      if (completedSystemsByGalaxy[i] >= GALAXIES[i].systems) {
        unlocked = i + 1;
      } else {
        break;
      }
    }
    return unlocked;
  }, [completedSystemsByGalaxy]);

  const meteorUnlocked = useMemo(() => {
    const thirdQuadrantStart = GALAXIES.findIndex((g) => g.quadrant === 'watupi');
    if (thirdQuadrantStart < 0) return false;
    return unlockedGalaxyIndex >= thirdQuadrantStart;
  }, [unlockedGalaxyIndex]);

  const completedByQuadrant = useMemo(() => {
    const out = { bayron: false, crimson: false, watupi: false, ultra316: false };
    for (const q of Object.keys(out)) {
      const idxs = GALAXIES.map((g, i) => ({ g, i })).filter(({ g }) => g.quadrant === q);
      out[q] = idxs.length > 0 && idxs.every(({ g, i }) => (completedSystemsByGalaxy[i] || 0) >= g.systems);
    }
    return out;
  }, [completedSystemsByGalaxy]);
  const completedQuadrantCount = useMemo(
    () => Object.values(completedByQuadrant).filter(Boolean).length,
    [completedByQuadrant]
  );
  useEffect(() => {
    setQuadrantAbilityUnlocks((prev) => ({
      bayron: prev.bayron || completedByQuadrant.bayron,
      crimson: prev.crimson || completedByQuadrant.crimson,
      watupi: prev.watupi || completedByQuadrant.watupi,
      ultra316: prev.ultra316 || completedByQuadrant.ultra316,
    }));
  }, [completedByQuadrant]);

  const shipParts = useMemo(
    () => PART_TYPES.reduce((sum, k) => sum + (shipPartsByType[k] || 0), 0),
    [shipPartsByType]
  );

  const adaptiveCounterStyle = useMemo(() => {
    const top = Object.entries(doctrineUsage || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'fortress';
    if (top === 'fortress') return 'siege';
    if (top === 'sniper_grid') return 'raider';
    if (top === 'swarm_control') return 'interceptor';
    if (top === 'scavenger') return 'hunter-killer';
    return 'balanced';
  }, [doctrineUsage]);

  const handleSelectGalaxy = (galaxy, systemNumberOverride = null) => {
    const idx = GALAXIES.findIndex((g) => g.id === galaxy.id);
    if (idx < 0 || idx > unlockedGalaxyIndex) return;

    const completed = completedSystemsByGalaxy[idx] || 0;
    const nextSystem = Number.isFinite(systemNumberOverride)
      ? Math.max(1, Math.min(galaxy.systems, Math.floor(systemNumberOverride)))
      : Math.min(galaxy.systems, completed + 1);
    const territoryKey = `${galaxy.id}:${nextSystem}`;
    const replayLocked =
      Number.isFinite(systemNumberOverride) &&
      nextSystem <= completed &&
      !!territories[territoryKey];
    // Captured systems are locked from replay; only re-open if the station was later destroyed.
    if (replayLocked) return;
    if (!specialProgress.singularityComplete && completedQuadrantCount >= 2) {
      setSpecialScenario('singularity');
      setSelectedGalaxy(galaxy);
      setSelectedSystemNumber(nextSystem);
      setSelectedForceGiganautOnly(false);
      setSelectedForceGiganautAfterWavesNoDetonation(false);
      setScreen('game');
      return;
    }
    if (!specialProgress.meganautComplete && completedQuadrantCount >= 3) {
      setSpecialScenario('meganaut');
      setSelectedGalaxy(galaxy);
      setSelectedSystemNumber(nextSystem);
      setSelectedForceGiganautOnly(false);
      setSelectedForceGiganautAfterWavesNoDetonation(false);
      setScreen('game');
      return;
    }
    if (!specialProgress.armageddonComplete && completedQuadrantCount >= 4) {
      setSpecialScenario('armageddon');
      setSelectedGalaxy(galaxy);
      setSelectedSystemNumber(nextSystem);
      setSelectedForceGiganautOnly(false);
      setSelectedForceGiganautAfterWavesNoDetonation(false);
      setScreen('game');
      return;
    }
    const isLastSystemInGalaxy = nextSystem >= galaxy.systems;
    const rollGiganautFromFlawless = flawlessSystemsStreak >= 10 && Math.random() < 0.25;
    const forceGiganautOnly = isLastSystemInGalaxy || rollGiganautFromFlawless;
    const forceGiganautAfterWavesNoDetonation = giganautFirstPickTestPending;

    setSelectedGalaxy(galaxy);
    setSpecialScenario(null);
    setSelectedSystemNumber(nextSystem);
    setSelectedForceGiganautOnly(forceGiganautOnly);
    setSelectedForceGiganautAfterWavesNoDetonation(forceGiganautAfterWavesNoDetonation);
    if (giganautFirstPickTestPending) setGiganautFirstPickTestPending(false);
    setAutoOpenGalaxyId(galaxy.id);
    setScreen('game');
  };

  const handleNodeLongPressDefense = (galaxy) => {
    if (!galaxy?.id) return;
    const idx = GALAXIES.findIndex((g) => g.id === galaxy.id);
    if (idx < 0 || idx > unlockedGalaxyIndex) return;

    const galaxyTerritories = Object.values(territories || {}).filter((t) => t.galaxyId === galaxy.id);
    const preferred =
      galaxyTerritories.find((t) => t.underAttack) ||
      galaxyTerritories[0] ||
      createTerritory(galaxy.id, Math.max(1, Math.min(galaxy.systems || 1, (completedSystemsByGalaxy[idx] || 0) + 1)));

    setSelectedDefenseTerritory(preferred);
    setScreen('defense_prep');
  };

  const applySystemLosses = (losses = []) => {
    if (!losses.length) return;
    setCompletedSystemsByGalaxy((prev) => {
      const next = [...prev];
      for (const loss of losses) {
        const idx = GALAXIES.findIndex((g) => g.id === loss.galaxyId);
        if (idx >= 0) next[idx] = Math.max(0, next[idx] - 1);
      }
      return next;
    });
  };

  const handleSystemComplete = (galaxyId, summary = {}) => {
    if (summary.specialScenario) {
      const mode = summary.specialScenario;
      if (mode === 'singularity') {
        setSpecialProgress((p) => ({ ...p, singularityComplete: true }));
        setDefenseEvents((prev) => ([
          {
            type: 'special_victory',
            galaxyId,
            systemNumber: summary.systemNumber || 1,
            summary: 'SINGULARITY BATTLE WON. Space-time rupture stabilized.',
          },
          ...prev,
        ].slice(0, 24)));
      } else if (mode === 'meganaut') {
        setSpecialProgress((p) => ({ ...p, meganautComplete: true }));
        setDefenseEvents((prev) => ([
          {
            type: 'special_victory',
            galaxyId,
            systemNumber: summary.systemNumber || 1,
            summary: 'MEGANAUT BATTLE WON. Planet-class flagship destroyed.',
          },
          ...prev,
        ].slice(0, 24)));
      } else if (mode === 'armageddon') {
        setSpecialProgress((p) => ({ ...p, armageddonComplete: true }));
        setDefenseEvents((prev) => ([
          {
            type: 'special_victory',
            galaxyId,
            systemNumber: summary.systemNumber || 1,
            summary: 'UNIVERSAL ARMAGEDDON SURVIVED. Giganaut command secured.',
          },
          ...prev,
        ].slice(0, 24)));
      }
      setSpecialScenario(null);
      setScreen('map');
      return;
    }
    const idx = GALAXIES.findIndex((g) => g.id === galaxyId);
    if (idx < 0) {
      setScreen('map');
      return;
    }

    const systemNumber = summary.systemNumber || 1;
    const wasFlawless = !!summary.flawless;
    setFlawlessSystemsStreak((prev) => (wasFlawless ? prev + 1 : 0));

    setCompletedSystemsByGalaxy((prev) => {
      const next = [...prev];
      next[idx] = Math.min(GALAXIES[idx].systems, next[idx] + 1);
      return next;
    });

    const score = Math.max(0, summary.score || 0);
    const waves = Math.max(1, summary.waves || 1);
    const creditsEarned = Math.max(120, Math.round(score * 0.14 + waves * 36));

    const territoryKey = `${galaxyId}:${systemNumber}`;
    const nextTerritories = {
      ...territories,
      [territoryKey]: territories[territoryKey] || createTerritory(galaxyId, systemNumber),
    };

    const updatedMemory = mergePlayerCombatMemory(enemyMemory, summary);
    const nemesis = simulateNemesisTurn({
      territories: nextTerritories,
      stationLevels: stationUpgrades,
      commanders: nemesisCommanders,
      enemyMemory: updatedMemory,
    });

    setEnemyMemory(updatedMemory);
    setNemesisCommanders(nemesis.commanders);
    setTerritories(nemesis.territories);
    setWarCredits((prev) => Math.max(0, prev + creditsEarned + nemesis.warCreditsDelta));
    applySystemLosses(nemesis.systemLosses);

    const newEvents = [
      {
        type: 'system_victory',
        galaxyId,
        systemNumber,
        summary: `${galaxyId.toUpperCase()}-${systemNumber} captured. +${creditsEarned} credits${wasFlawless ? ' | FLAWLESS' : ''}${summary.giganautEncounter ? ' | GIGANAUT' : ''}`,
      },
      ...nemesis.events,
    ];
    setDefenseEvents((prev) => [...newEvents, ...prev].slice(0, 24));
    setAutoOpenGalaxyId(galaxyId);
    setScreen('map');
  };

  const handleBuyMetaUpgrade = (upgradeId) => {
    const upgrade = getMetaUpgradeById(upgradeId);
    if (!upgrade) return false;

    const currentLevel = ownedMetaUpgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) return false;

    const partType = upgrade.partType || 'mech';
    const cost = getMetaUpgradePartCost(upgradeId, currentLevel);
    if (cost === null || (shipPartsByType[partType] || 0) < cost) return false;

    setShipPartsByType((prev) => ({
      ...prev,
      [partType]: Math.max(0, (prev[partType] || 0) - cost),
    }));
    setOwnedMetaUpgrades((prev) => ({
      ...prev,
      [upgradeId]: currentLevel + 1,
    }));
    return true;
  };

  const handleDefendStation = (territory) => {
    setSelectedDefenseTerritory(territory);
    setScreen('defense_prep');
  };

  const handleStartDefense = (doctrine) => {
    setSelectedDefenseDoctrine(doctrine || 'fortress');
    setScreen('defense');
  };

  const handleDefenseComplete = ({
    victory,
    score,
    kills,
    salvageParts = 0,
    salvageByType = {},
    doctrineUsed,
  }) => {
    if (!selectedDefenseTerritory) { setScreen('map'); return; }
    const key = selectedDefenseTerritory.key;

    if (salvageParts > 0 || Object.keys(salvageByType).length > 0) {
      setShipPartsByType((prev) => {
        const next = { ...prev };
        for (const type of PART_TYPES) {
          const gain = Math.max(0, Math.round(salvageByType[type] || 0));
          if (gain > 0) next[type] = (next[type] || 0) + gain;
        }
        return next;
      });
    }

    if (doctrineUsed) {
      setDoctrineUsage((prev) => ({
        ...prev,
        [doctrineUsed]: (prev[doctrineUsed] || 0) + 1,
      }));
    }

    if (victory) {
      const creditsGained = Math.max(60, Math.round(score * 0.08 + kills * 12));
      setWarCredits((wc) => Math.max(0, wc + creditsGained));
    }

    setTerritories((prev) => {
      const t = prev[key];
      if (!t) return prev;
      return {
        ...prev,
        [key]: {
          ...t,
          underAttack: false,
          defended: (t.defended || 0) + (victory ? 1 : 0),
          losses:   (t.losses   || 0) + (victory ? 0 : 1),
          stability: Math.max(0, Math.min(100, (t.stability || 50) + (victory ? 15 : -20))),
          lastOutcome: victory ? 'defended' : 'breached',
        },
      };
    });
    setScreen('map');
  };

  const handleBuyStationUpgrade = (upgradeId) => {
    const upgrade = getStationUpgradeById(upgradeId);
    if (!upgrade) return false;

    const currentLevel = stationUpgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) return false;

    const cost = getStationUpgradeCost(upgradeId, currentLevel);
    if (cost === null || warCredits < cost) return false;

    setWarCredits((prev) => prev - cost);
    setStationUpgrades((prev) => ({
      ...prev,
      [upgradeId]: currentLevel + 1,
    }));
    return true;
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
      <View
        style={styles.viewportShell}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) setAvailableViewport({ width, height });
        }}
      >
        <View style={[styles.landscapeFrame, landscapeFrameStyle]}>

          {!coreAssetsReady && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingStarfield} />
              <Animated.View
                style={[
                  styles.loadingLogoWrap,
                  {
                    transform: [
                      {
                        scale: logoPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.018],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Image
                  source={require('./ChatGPT Image Apr 25, 2026, 09_38_15 PM.png')}
                  resizeMode="contain"
                  style={styles.loadingLogo}
                />
              </Animated.View>
              <Text style={styles.loadingText}>INITIALIZING JUMP DRIVE</Text>
              <View style={styles.loadingBarTrack}>
                <View style={[styles.loadingBarFill, { width: `${assetLoadPct}%` }]} />
                <Animated.View
                  style={[
                    styles.loadingBarScan,
                    {
                      transform: [
                        {
                          translateX: loadScan.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-48, 280],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
              <Text style={styles.loadingPctText}>{assetLoadPct}%</Text>
            </View>
          )}

          {coreAssetsReady && (
            <>
              {screen === 'menu' && (
                <MenuScreen
                  onStart={(profile) => {
                    requestLandscapePlayback();
                    setRunProfile(profile || 'combat');
                    setScreen('intro');
                  }}
                />
              )}

              {screen === 'intro' && (
                <IntroStoryScreen
                  onContinue={() => {
                    setScreen('map');
                  }}
                />
              )}

              {screen === 'map' && (
                <UniverseMapScreen
                  unlockedGalaxyIndex={unlockedGalaxyIndex}
                  completedSystemsByGalaxy={completedSystemsByGalaxy}
                  warCredits={warCredits}
                  ownedMetaUpgrades={ownedMetaUpgrades}
                  shipParts={shipParts}
                  shipPartsByType={shipPartsByType}
                  metaUpgradeCatalog={META_UPGRADES}
                  stationUpgradeCatalog={STATION_UPGRADES}
                  stationUpgrades={stationUpgrades}
                  territories={territories}
                  defenseEvents={defenseEvents}
                  onBuyMetaUpgrade={handleBuyMetaUpgrade}
                  onBuyStationUpgrade={handleBuyStationUpgrade}
                  onSelectGalaxy={handleSelectGalaxy}
                  onNodeLongPressDefense={handleNodeLongPressDefense}
                  autoOpenGalaxyId={autoOpenGalaxyId}
                  onAutoOpenGalaxyHandled={() => setAutoOpenGalaxyId(null)}
                  onBack={() => setScreen('menu')}
                  onDefendStation={handleDefendStation}
                />
              )}

              {screen === 'game' && (
                <GameScreen
                  galaxy={selectedGalaxy}
                  systemNumber={selectedSystemNumber}
                  showIntroStory={false}
                  onIntroStoryComplete={() => {}}
                  specialScenario={specialScenario}
                  quadrantAbilityUnlocks={quadrantAbilityUnlocks}
                  forceGiganautOnly={selectedForceGiganautOnly}
                  forceGiganautAfterWavesNoDetonation={selectedForceGiganautAfterWavesNoDetonation}
                  metaUpgrades={ownedMetaUpgrades}
                  meteorUnlocked={meteorUnlocked}
                  runProfile={runProfile}
                  onSystemComplete={handleSystemComplete}
                  onMainMenu={() => setScreen('menu')}
                />
              )}

              {screen === 'defense_prep' && (
                <DefensePrepScreen
                  territory={selectedDefenseTerritory}
                  defaultDoctrine={selectedDefenseDoctrine}
                  enemyCounterStyle={adaptiveCounterStyle}
                  onBack={() => setScreen('map')}
                  onStartDefense={handleStartDefense}
                />
              )}

              {screen === 'defense' && (
                <StationDefenseScreen
                  territory={selectedDefenseTerritory}
                  stationUpgrades={stationUpgrades}
                  doctrine={selectedDefenseDoctrine}
                  enemyCounterStyle={adaptiveCounterStyle}
                  onDefenseComplete={handleDefenseComplete}
                  onMainMenu={() => setScreen('menu')}
                />
              )}
            </>
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000008',
  },
  viewportShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000008',
    overflow: 'hidden',
  },
  landscapeFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000008',
    overflow: 'hidden',
  },
  loadingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000008',
    overflow: 'hidden',
    paddingHorizontal: 28,
  },
  loadingStarfield: {
    position: 'absolute',
    top: -120,
    left: -80,
    right: -80,
    bottom: -120,
    backgroundColor: '#020716',
    borderColor: 'rgba(93, 244, 255, 0.08)',
    borderWidth: 1,
  },
  loadingLogoWrap: {
    width: '100%',
    maxWidth: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingLogo: {
    width: '100%',
    height: '100%',
  },
  loadingText: {
    color: '#67F3FF',
    fontFamily: 'Courier New',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 3,
    textShadowColor: 'rgba(103, 243, 255, 0.85)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  loadingBarTrack: {
    width: '100%',
    maxWidth: 320,
    height: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(103, 243, 255, 0.55)',
    backgroundColor: 'rgba(0, 8, 22, 0.84)',
    overflow: 'hidden',
    shadowColor: '#67F3FF',
    shadowOpacity: 0.75,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: '#67F3FF',
    shadowColor: '#67F3FF',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  loadingBarScan: {
    position: 'absolute',
    top: -3,
    width: 48,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    opacity: 0.72,
  },
  loadingPctText: {
    marginTop: 10,
    color: '#BEEFFF',
    fontFamily: 'Courier New',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1.2,
  },
});
