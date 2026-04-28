// App.js

import React, { useMemo, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import MenuScreen from './src/screens/MenuScreen';
import GalaxyMapScreen from './src/screens/GalaxyMapScreen';
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

export default function App() {
  const [screen, setScreen] = useState('menu'); // menu | map | game | defense_prep | defense
  const [selectedGalaxy, setSelectedGalaxy] = useState(GALAXIES[0]);
  const [selectedSystemNumber, setSelectedSystemNumber] = useState(1);
  const [selectedDefenseTerritory, setSelectedDefenseTerritory] = useState(null);
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

  const handleSelectGalaxy = (galaxy) => {
    const idx = GALAXIES.findIndex((g) => g.id === galaxy.id);
    if (idx < 0 || idx > unlockedGalaxyIndex) return;

    const completed = completedSystemsByGalaxy[idx] || 0;
    const nextSystem = Math.min(galaxy.systems, completed + 1);

    setSelectedGalaxy(galaxy);
    setSelectedSystemNumber(nextSystem);
    setScreen('game');
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
    const idx = GALAXIES.findIndex((g) => g.id === galaxyId);
    if (idx < 0) {
      setScreen('map');
      return;
    }

    const systemNumber = summary.systemNumber || 1;

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
        summary: `${galaxyId.toUpperCase()}-${systemNumber} captured. +${creditsEarned} credits`,
      },
      ...nemesis.events,
    ];
    setDefenseEvents((prev) => [...newEvents, ...prev].slice(0, 24));

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

      {screen === 'menu' && <MenuScreen onStart={() => setScreen('map')} />}

      {screen === 'map' && (
        <GalaxyMapScreen
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
          onBack={() => setScreen('menu')}
          onDefendStation={handleDefendStation}
        />
      )}

      {screen === 'game' && (
        <GameScreen
          galaxy={selectedGalaxy}
          systemNumber={selectedSystemNumber}
          metaUpgrades={ownedMetaUpgrades}
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000008',
  },
});
