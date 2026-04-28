// src/systems/UpgradeSystem.js

export const ALL_UPGRADES = [
  {
    id: 'damage_up',
    icon: '⚔',
    title: '+25% Damage',
    desc: 'All attacks hit harder.',
    color: '#FF4444',
    apply: (player) => { player.damageMultiplier = (player.damageMultiplier || 1) * 1.25; },
  },
  {
    id: 'attack_speed',
    icon: '⚡',
    title: '+30% Attack Speed',
    desc: 'Strike faster, chain more combos.',
    color: '#FFD700',
    apply: (player) => { player.attackRate = Math.max(60, player.attackRate * 0.7); },
  },
  {
    id: 'move_speed',
    icon: '🚀',
    title: '+20% Move Speed',
    desc: 'Slice through enemy formations.',
    color: '#00CCFF',
    apply: (player, abilities) => { player.speed = player.speed * 1.2; },
  },
  {
    id: 'attack_range',
    icon: '🎯',
    title: '+35% Attack Range',
    desc: 'Reach enemies across a wider arc.',
    color: '#FF88FF',
    apply: (player) => { player.attackRange = player.attackRange * 1.35; },
  },
  {
    id: 'dash_cooldown',
    icon: '💨',
    title: 'Dash Recharge -35%',
    desc: 'Dash Slash refreshes much faster.',
    color: '#00FFAA',
    apply: (player, abilities) => { abilities.dash.maxCooldown = abilities.dash.maxCooldown * 0.65; },
  },
  {
    id: 'pulse_power',
    icon: '💥',
    title: '+40% Pulse Damage',
    desc: 'Energy Pulse annihilates clusters.',
    color: '#FF6600',
    apply: (player, abilities) => { abilities.pulse.damageMult = (abilities.pulse.damageMult || 1) * 1.4; },
  },
  {
    id: 'drone_count',
    icon: '🌀',
    title: '+1 Orbit Drone',
    desc: 'An extra drone joins your orbit.',
    color: '#CC44FF',
    apply: (player, abilities) => {
      abilities.drone.count = Math.min((abilities.drone.count || 2) + 1, 5);
    },
  },
  {
    id: 'drone_speed',
    icon: '🔄',
    title: 'Drone Overdrive',
    desc: 'Drones orbit 50% faster.',
    color: '#AA22FF',
    apply: (player, abilities) => { abilities.drone.speedMult = (abilities.drone.speedMult || 1) * 1.5; },
  },
  {
    id: 'health_restore',
    icon: '❤',
    title: 'Emergency Repair',
    desc: 'Restore 40 hull integrity.',
    color: '#FF4488',
    apply: (player) => { player.hp = Math.min(player.maxHp, player.hp + 40); },
  },
  {
    id: 'max_health',
    icon: '🛡',
    title: '+25 Max Hull',
    desc: 'Reinforce hull plating permanently.',
    color: '#44FFAA',
    apply: (player) => { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 15); },
  },
  {
    id: 'pulse_cooldown',
    icon: '⭕',
    title: 'Pulse Recharge -30%',
    desc: 'Energy Pulse available more often.',
    color: '#FF8833',
    apply: (player, abilities) => { abilities.pulse.maxCooldown = abilities.pulse.maxCooldown * 0.7; },
  },
  {
    id: 'combo_extend',
    icon: '🔥',
    title: 'Combo Window +1s',
    desc: 'Harder to break your kill streak.',
    color: '#FFCC00',
    apply: (player) => { player.comboWindowBonus = (player.comboWindowBonus || 0) + 1000; },
  },
];

/**
 * Pick 3 random distinct upgrades.
 */
export function pickUpgradeChoices() {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Apply selected upgrade to mutable game state.
 */
export function applyUpgrade(upgradeId, player, abilities) {
  const upgrade = ALL_UPGRADES.find(u => u.id === upgradeId);
  if (upgrade) {
    upgrade.apply(player, abilities);
  }
}
