// src/systems/MetaUpgradeSystem.js

export const PART_TYPES = ['mech', 'plasma', 'void', 'bio'];

export const META_UPGRADES = [
  {
    id: 'hull_plating',
    title: 'Hull Plating',
    desc: '+8 max hull per level.',
    partType: 'mech',
    faction: 'Aegis Forge',
    maxLevel: 8,
    baseCost: 240,
    costScale: 1.4,
    applyLevel: (player) => {
      player.maxHp += 8;
      player.hp = Math.min(player.maxHp, player.hp + 8);
    },
  },
  {
    id: 'weapon_core',
    title: 'Weapon Core',
    desc: '+8% damage per level.',
    partType: 'plasma',
    faction: 'Crimson Corsairs',
    maxLevel: 10,
    baseCost: 280,
    costScale: 1.42,
    applyLevel: (player) => {
      player.damageMultiplier = (player.damageMultiplier || 1) * 1.08;
    },
  },
  {
    id: 'thruster_grid',
    title: 'Thruster Grid',
    desc: '+5% move speed per level.',
    partType: 'void',
    faction: 'Void Phantoms',
    maxLevel: 8,
    baseCost: 220,
    costScale: 1.38,
    applyLevel: (player) => {
      player.speed *= 1.05;
    },
  },
  {
    id: 'reactor_tuning',
    title: 'Reactor Tuning',
    desc: '-5% ability cooldowns per level.',
    partType: 'plasma',
    faction: 'Crimson Corsairs',
    maxLevel: 8,
    baseCost: 320,
    costScale: 1.45,
    applyLevel: (player, abilities) => {
      abilities.dash.maxCooldown *= 0.95;
      abilities.pulse.maxCooldown *= 0.95;
      abilities.drone.maxCooldown *= 0.95;
      abilities.dash.cooldownRemaining = Math.min(abilities.dash.cooldownRemaining, abilities.dash.maxCooldown);
      abilities.pulse.cooldownRemaining = Math.min(abilities.pulse.cooldownRemaining, abilities.pulse.maxCooldown);
      abilities.drone.cooldownRemaining = Math.min(abilities.drone.cooldownRemaining, abilities.drone.maxCooldown);
    },
  },
  {
    id: 'targeting_array',
    title: 'Targeting Array',
    desc: '+6% attack range per level.',
    partType: 'bio',
    faction: 'Verdant Swarm',
    maxLevel: 8,
    baseCost: 260,
    costScale: 1.4,
    applyLevel: (player) => {
      player.attackRange *= 1.06;
    },
  },
];

export function getMetaUpgradeById(id) {
  return META_UPGRADES.find((u) => u.id === id) || null;
}

export function getMetaUpgradeCost(id, currentLevel = 0) {
  const upgrade = getMetaUpgradeById(id);
  if (!upgrade) return null;
  const level = Math.max(0, currentLevel);
  return Math.round(upgrade.baseCost * Math.pow(upgrade.costScale, level));
}

export function getMetaUpgradePartCost(id, currentLevel = 0) {
  const creditCost = getMetaUpgradeCost(id, currentLevel);
  if (creditCost === null) return null;
  return Math.max(4, Math.round(creditCost / 55));
}

export function applyMetaUpgrades(player, abilities, owned = {}) {
  for (const upgrade of META_UPGRADES) {
    const levels = Math.max(0, Math.min(upgrade.maxLevel, owned[upgrade.id] || 0));
    for (let i = 0; i < levels; i++) {
      upgrade.applyLevel(player, abilities);
    }
  }
}
