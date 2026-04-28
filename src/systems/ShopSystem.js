// src/systems/ShopSystem.js

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function weightedPickUnique(pool, count, getWeight) {
  const source = [...pool];
  const picked = [];

  while (source.length > 0 && picked.length < count) {
    let total = 0;
    for (const item of source) total += Math.max(0.001, getWeight(item));

    let roll = Math.random() * total;
    let index = 0;
    for (; index < source.length; index++) {
      roll -= Math.max(0.001, getWeight(source[index]));
      if (roll <= 0) break;
    }

    const chosenIndex = Math.min(index, source.length - 1);
    picked.push(source[chosenIndex]);
    source.splice(chosenIndex, 1);
  }

  return picked;
}

export const SHOP_OFFERS = [
  {
    id: 'repair_nanites',
    title: 'Repair Nanites',
    category: 'Powerup',
    tier: 'basic',
    baseWeight: 2.4,
    cost: 220,
    desc: 'Restore 45 hull integrity.',
    apply: (player) => {
      player.hp = Math.min(player.maxHp, player.hp + 45);
    },
  },
  {
    id: 'shield_matrix',
    title: 'Shield Matrix',
    category: 'Powerup',
    tier: 'basic',
    baseWeight: 2.1,
    cost: 300,
    desc: '+22 max hull and restore 16 hull.',
    apply: (player) => {
      player.maxHp += 22;
      player.hp = Math.min(player.maxHp, player.hp + 16);
    },
  },
  {
    id: 'overclock_core',
    title: 'Overclock Core',
    category: 'Powerup',
    tier: 'advanced',
    baseWeight: 1.2,
    cost: 360,
    desc: '+20% weapon damage.',
    apply: (player) => {
      player.damageMultiplier = (player.damageMultiplier || 1) * 1.2;
    },
  },
  {
    id: 'weapon_splitter',
    title: 'Splitter Cannons',
    category: 'Weapon',
    tier: 'high',
    baseWeight: 0.48,
    cost: 480,
    desc: 'Auto attacks hit +1 additional target.',
    apply: (player) => {
      player.attackTargets = clamp((player.attackTargets || 1) + 1, 1, 4);
    },
  },
  {
    id: 'weapon_hyperblade',
    title: 'Hyperblade Array',
    category: 'Weapon',
    tier: 'high',
    baseWeight: 0.42,
    cost: 520,
    desc: '+22% attack speed and +12% range.',
    apply: (player) => {
      player.attackRate = Math.max(55, player.attackRate * 0.78);
      player.attackRange *= 1.12;
    },
  },
  {
    id: 'cooldown_suite',
    title: 'Cooldown Suite',
    category: 'Utility',
    tier: 'advanced',
    baseWeight: 1.0,
    cost: 390,
    desc: '-18% cooldowns for all abilities.',
    apply: (player, abilities) => {
      abilities.dash.maxCooldown *= 0.82;
      abilities.pulse.maxCooldown *= 0.82;
      abilities.drone.maxCooldown *= 0.82;
      abilities.dash.cooldownRemaining = Math.min(abilities.dash.cooldownRemaining, abilities.dash.maxCooldown);
      abilities.pulse.cooldownRemaining = Math.min(abilities.pulse.cooldownRemaining, abilities.pulse.maxCooldown);
      abilities.drone.cooldownRemaining = Math.min(abilities.drone.cooldownRemaining, abilities.drone.maxCooldown);
    },
  },
  {
    id: 'drone_forge',
    title: 'Drone Forge',
    category: 'Weapon',
    tier: 'advanced',
    baseWeight: 0.95,
    cost: 430,
    desc: '+1 orbit drone and +12% drone spin speed.',
    apply: (player, abilities) => {
      abilities.drone.count = clamp((abilities.drone.count || 2) + 1, 1, 6);
      abilities.drone.speedMult = (abilities.drone.speedMult || 1) * 1.12;
    },
  },
];

export function randomShopInterval() {
  return 3 + Math.floor(Math.random() * 3); // 3..5
}

export function getSystemDiscountMultiplier(systemNumber = 1) {
  const n = Math.max(1, systemNumber);
  if (n <= 6) return 0.68;
  if (n <= 12) return 0.76;
  if (n <= 20) return 0.86;
  if (n <= 30) return 0.94;
  return 1;
}

export function getOfferPrice(offer, systemNumber = 1, threat = 1, currentWave = 1) {
  const discount = getSystemDiscountMultiplier(systemNumber);
  const t = Math.max(1, Number(threat) || 1);
  const w = Math.max(1, Number(currentWave) || 1);
  const s = Math.max(1, Number(systemNumber) || 1);

  const threatInflation = Math.max(0, t - 1) * 0.22;
  const waveInflation = Math.max(0, w - 5) * 0.035;
  const depthInflation = Math.max(0, s - 12) * 0.008;
  const inflation = Math.min(2.8, 1 + threatInflation + waveInflation + depthInflation);

  return Math.max(80, Math.round(offer.cost * discount * inflation));
}

export function pickShopOffers({
  count = 3,
  systemNumber = 1,
  threat = 1,
  currentWave = 1,
  guaranteeWeaponSlot = true,
} = {}) {
  const effectiveCount = Math.max(1, count);

  const tierFactor = {
    basic: 1.6,
    advanced: 0.95,
    high: 0.45,
  };

  const weightFn = (offer) => (offer.baseWeight || 1) * (tierFactor[offer.tier] || 1);

  let chosen = [];

  if (guaranteeWeaponSlot) {
    const weapons = SHOP_OFFERS.filter((o) => o.category === 'Weapon');
    const [weaponPick] = weightedPickUnique(weapons, 1, weightFn);
    if (weaponPick) chosen.push(weaponPick);
  }

  const remainingPool = SHOP_OFFERS.filter((offer) => !chosen.some((c) => c.id === offer.id));
  const otherPicks = weightedPickUnique(remainingPool, Math.max(0, effectiveCount - chosen.length), weightFn);
  chosen = [...chosen, ...otherPicks];

  return chosen.map((offer) => ({
    ...offer,
    price: getOfferPrice(offer, systemNumber, threat, currentWave),
  }));
}

export function applyShopOffer(offerId, player, abilities) {
  const offer = SHOP_OFFERS.find((o) => o.id === offerId);
  if (!offer) return null;
  offer.apply(player, abilities);
  return offer;
}

export function getShopOffer(offerId) {
  return SHOP_OFFERS.find((o) => o.id === offerId) || null;
}
