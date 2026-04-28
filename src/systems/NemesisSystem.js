// src/systems/NemesisSystem.js

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export const STATION_UPGRADES = [
  {
    id: 'offense_grid',
    path: 'Offensive Grid',
    title: 'Weapons Grid',
    desc: 'Laser arrays, missile swarms, and interceptor drones.',
    maxLevel: 12,
    baseCost: 220,
    costScale: 1.33,
  },
  {
    id: 'defense_matrix',
    path: 'Defensive Systems',
    title: 'Shield Matrix',
    desc: 'Shield domes, plating, and anti-projectile fields.',
    maxLevel: 12,
    baseCost: 220,
    costScale: 1.33,
  },
  {
    id: 'tactical_core',
    path: 'Tactical AI Core',
    title: 'Adaptive AI Core',
    desc: 'Improves auto-decision making and strategy counters.',
    maxLevel: 12,
    baseCost: 260,
    costScale: 1.35,
  },
  {
    id: 'support_wing',
    path: 'Support Systems',
    title: 'Support Wing',
    desc: 'Repair drones, resource output, reinforcement gates.',
    maxLevel: 12,
    baseCost: 200,
    costScale: 1.31,
  },
];

const PERSONALITIES = ['Aggressive', 'Tactical', 'Vengeful'];
const ATTACK_STYLES = ['swarm', 'siege', 'raider'];

function randomChoice(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length)];
}

export function createInitialCommanders() {
  return [
    {
      id: 'cmdr-kael',
      name: 'Commander Kael Vorn',
      personality: 'Aggressive',
      preferredStyle: 'swarm',
      vendetta: 0,
      strength: 1,
      taunt: 'Your borders are weak, pilot.',
    },
    {
      id: 'cmdr-nyra',
      name: 'Admiral Nyra Hex',
      personality: 'Tactical',
      preferredStyle: 'siege',
      vendetta: 0,
      strength: 1,
      taunt: 'I mapped your patterns already.',
    },
    {
      id: 'cmdr-rath',
      name: 'Warlord Rath Exile',
      personality: 'Vengeful',
      preferredStyle: 'raider',
      vendetta: 0,
      strength: 1,
      taunt: 'I do not forget defeat.',
    },
  ];
}

export function createInitialEnemyMemory() {
  return {
    dash: 0,
    pulse: 0,
    drone: 0,
  };
}

export function createTerritory(galaxyId, systemNumber) {
  return {
    key: `${galaxyId}:${systemNumber}`,
    galaxyId,
    systemNumber,
    threat: 1,
    stability: 100,
    hardened: 0,
    defended: 0,
    losses: 0,
    underAttack: false,
    lastOutcome: null,
  };
}

export function mergePlayerCombatMemory(memory, summary = {}) {
  const usage = summary.abilityUsage || {};
  return {
    dash: clamp((memory.dash || 0) * 0.82 + (usage.dash || 0) * 0.18, 0, 100),
    pulse: clamp((memory.pulse || 0) * 0.82 + (usage.pulse || 0) * 0.18, 0, 100),
    drone: clamp((memory.drone || 0) * 0.82 + (usage.drone || 0) * 0.18, 0, 100),
  };
}

export function getStationUpgradeById(id) {
  return STATION_UPGRADES.find((u) => u.id === id) || null;
}

export function getStationUpgradeCost(id, currentLevel = 0) {
  const upgrade = getStationUpgradeById(id);
  if (!upgrade) return null;
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costScale, Math.max(0, currentLevel)));
}

function getDefensePower(stationLevels, territory) {
  const offense = stationLevels.offense_grid || 0;
  const defense = stationLevels.defense_matrix || 0;
  const ai = stationLevels.tactical_core || 0;
  const support = stationLevels.support_wing || 0;

  return (
    offense * 15 +
    defense * 14 +
    ai * 12 +
    support * 11 +
    territory.hardened * 7 +
    territory.stability * 0.35
  );
}

function inferEnemyCounterStyle(memory, commander) {
  const ordered = [
    { k: 'dash', style: 'interceptor' },
    { k: 'pulse', style: 'dispersion' },
    { k: 'drone', style: 'ecm' },
  ].sort((a, b) => (memory[b.k] || 0) - (memory[a.k] || 0));

  if ((memory[ordered[0].k] || 0) > 7) return ordered[0].style;
  return commander.preferredStyle;
}

function matchupBonus(attackStyle, stationLevels) {
  const offense = stationLevels.offense_grid || 0;
  const defense = stationLevels.defense_matrix || 0;
  const ai = stationLevels.tactical_core || 0;
  const support = stationLevels.support_wing || 0;

  if (attackStyle === 'swarm') return defense * 2 + offense * 0.8;
  if (attackStyle === 'siege') return offense * 1.9 + ai * 1.2;
  if (attackStyle === 'raider') return support * 1.5 + ai * 1.4;
  if (attackStyle === 'interceptor') return ai * 1.8 + support * 1.1;
  if (attackStyle === 'dispersion') return offense * 1.1 + defense * 1.3;
  if (attackStyle === 'ecm') return support * 1.6 + ai * 1.2;
  return ai;
}

function chooseCommander(commanders, rnd = Math.random) {
  const weighted = [...commanders].sort((a, b) => (b.vendetta + b.strength) - (a.vendetta + a.strength));
  if (rnd() < 0.62) return weighted[0];
  return randomChoice(commanders, rnd);
}

export function simulateNemesisTurn({
  territories,
  stationLevels,
  commanders,
  enemyMemory,
  rnd = Math.random,
}) {
  const nextTerritories = { ...territories };
  const nextCommanders = commanders.map((c) => ({ ...c }));
  const events = [];
  let warCreditsDelta = 0;
  const systemLosses = [];

  const territoryList = Object.values(nextTerritories);

  for (const territory of territoryList) {
    territory.underAttack = false;

    // Passive pressure climbs over time if not stabilized.
    const passiveRise = territory.stability < 65 ? 0.7 : 0.35;
    territory.threat = clamp(territory.threat + passiveRise, 0, 10);

    const commander = chooseCommander(nextCommanders, rnd);
    const attackChance = clamp(
      0.11 + territory.threat * 0.065 + commander.vendetta * 0.03 + commander.strength * 0.02,
      0,
      0.88
    );

    if (rnd() > attackChance) {
      continue;
    }

    territory.underAttack = true;
    const style = inferEnemyCounterStyle(enemyMemory, commander);
    const defensePower = getDefensePower(stationLevels, territory);
    const matchup = matchupBonus(style, stationLevels);

    const enemyPower =
      95 +
      territory.systemNumber * 2.4 +
      territory.threat * 16 +
      commander.strength * 24 +
      commander.vendetta * 18;

    const randomSwing = (rnd() - 0.5) * 48;
    const outcomeScore = defensePower + matchup + randomSwing - enemyPower;

    const criticalEvent = rnd() < 0.12;
    const criticalShift = criticalEvent ? (rnd() < 0.5 ? -38 : 34) : 0;

    const finalScore = outcomeScore + criticalShift;
    const win = finalScore >= 0;

    if (win) {
      territory.defended += 1;
      territory.hardened = clamp(territory.hardened + 1, 0, 20);
      territory.stability = clamp(territory.stability + 8, 0, 100);
      territory.threat = clamp(territory.threat - 2.3, 0, 10);
      territory.lastOutcome = 'defended';
      const reward = 70 + territory.hardened * 8 + Math.round(commander.strength * 12);
      warCreditsDelta += reward;

      commander.vendetta = clamp(commander.vendetta + 0.9, 0, 8);
      commander.strength = clamp(commander.strength + 0.22, 1, 12);

      events.push({
        type: 'defense_win',
        commanderId: commander.id,
        commanderName: commander.name,
        galaxyId: territory.galaxyId,
        systemNumber: territory.systemNumber,
        style,
        criticalEvent,
        summary: `${territory.galaxyId.toUpperCase()}-${territory.systemNumber} held against ${commander.name}.`,
        taunt: commander.taunt,
        reward,
      });
    } else {
      territory.losses += 1;
      territory.hardened = clamp(territory.hardened - 1, 0, 20);
      territory.stability = clamp(territory.stability - (criticalEvent ? 34 : 22), 0, 100);
      territory.threat = clamp(territory.threat + 2.5, 0, 10);
      territory.lastOutcome = 'breached';

      commander.vendetta = clamp(commander.vendetta + 1.5, 0, 10);
      commander.strength = clamp(commander.strength + 0.45, 1, 14);

      const penalty = 40 + Math.round(commander.vendetta * 6);
      warCreditsDelta -= penalty;

      const lost = territory.stability <= 0;
      if (lost) {
        systemLosses.push({ galaxyId: territory.galaxyId, systemNumber: territory.systemNumber });
        delete nextTerritories[territory.key];
      }

      events.push({
        type: lost ? 'system_lost' : 'defense_loss',
        commanderId: commander.id,
        commanderName: commander.name,
        galaxyId: territory.galaxyId,
        systemNumber: territory.systemNumber,
        style,
        criticalEvent,
        summary: lost
          ? `${territory.galaxyId.toUpperCase()}-${territory.systemNumber} fell to ${commander.name}.`
          : `${territory.galaxyId.toUpperCase()}-${territory.systemNumber} was breached by ${commander.name}.`,
        taunt: commander.taunt,
        penalty,
      });
    }
  }

  return {
    territories: nextTerritories,
    commanders: nextCommanders,
    events,
    warCreditsDelta,
    systemLosses,
  };
}
