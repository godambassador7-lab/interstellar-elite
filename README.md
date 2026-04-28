# INTERSTELLAR ELITE
### Fast-paced mobile space hack-and-slash — React Native / Expo

---

## Quick Start

```bash
npm install
npx expo start
```

Run on device with **Expo Go** or launch in iOS/Android simulator.

---

## Project Structure

```
interstellar-elite/
├── App.js                          # Root — menu ↔ game navigation
├── src/
│   ├── utils/
│   │   ├── constants.js            # All tunable game values
│   │   └── mathUtils.js            # Vector math, UID, spawn helpers
│   ├── systems/
│   │   ├── CombatSystem.js         # Auto-attack, ability hits, combo, particles
│   │   ├── SpawnSystem.js          # Enemy spawning + all movement AI
│   │   ├── PlayerSystem.js         # Physics, velocity, all 3 ability state machines
│   │   └── UpgradeSystem.js        # 12 upgrades, apply logic
│   ├── components/
│   │   ├── GameCanvas.js           # All rendered game entities (player, enemies, FX)
│   │   ├── VirtualJoystick.js      # PanResponder joystick
│   │   ├── AbilityButton.js        # Cooldown ring + ready indicator
│   │   ├── HUD.js                  # HP bar, score, combo, ability row
│   │   ├── UpgradeScreen.js        # Animated 3-card upgrade selection
│   │   ├── GameOver.js             # Score/time stats + restart
│   │   ├── Player.js               # Re-export for modular access
│   │   └── Enemy.js                # Re-export for modular access
│   ├── screens/
│   │   ├── GameScreen.js           # Main game loop, state, rendering
│   │   └── MenuScreen.js           # Animated title + ability preview
│   └── hooks/
│       ├── useSounds.js            # Audio stub (ready for expo-av)
│       └── useGameLoop.js          # Reusable RAF loop hook
```

---

## Gameplay

| Control | Action |
|---|---|
| Left joystick | Move ship |
| 💨 DASH | Burst forward through enemies (2.8s cooldown) |
| 💥 PULSE | AoE explosion around ship (5s cooldown) |
| 🌀 DRONE | Orbit drones deal continuous damage (8s cooldown, lasts 6s) |

**Combo system:** Kill enemies quickly to build your combo. Every 5 kills = +1 score multiplier. Combo resets if you go 2.8 seconds without a kill.

**Upgrades:** At 150, 400, 800, 1400, 2200, and 3200 score, the game pauses and presents 3 random upgrade choices.

---

## Enemy Types

| Enemy | HP | Speed | Behavior |
|---|---|---|---|
| 🟢 Swarm | 22 | Fast | Direct chase, spawns in clusters |
| 🔴 Heavy | 90 | Slow | Relentless approach, shows HP bar |
| 🟣 Elite | 55 | Very fast | Zig-zag + burst charge pattern |

Spawn rates and enemy type ratios scale continuously over time.

---

## Upgrades Available

- ⚔ +25% Damage
- ⚡ +30% Attack Speed
- 🚀 +20% Move Speed
- 🎯 +35% Attack Range
- 💨 Dash Recharge -35%
- 💥 +40% Pulse Damage
- 🌀 +1 Orbit Drone (max 5)
- 🔄 Drone Overdrive (+50% orbit speed)
- ❤ Emergency Repair (+40 HP)
- 🛡 +25 Max Hull
- ⭕ Pulse Recharge -30%
- 🔥 Combo Window +1s

---

## Technical Notes

**Game loop architecture:** `requestAnimationFrame` drives all simulation. Mutable game state lives in a `useRef` to avoid re-render overhead. Only a flattened snapshot is pushed to React state once per frame for rendering.

**Physics:** Velocity-based movement with per-frame friction exponent. Wall bouncing. Dash injects a burst force vector.

**Particles:** Fully simulated — position, velocity, friction, lifetime. Explosion particles use enemy color; hit sparks use lighter variants.

**Screen shake:** Spring-animated `Animated.Value` pair, driven imperatively on heavy hits.

**Haptics:** Medium impact on dash, heavy on pulse, success notification on drone/upgrade.

---

## Adding Sounds

See `src/hooks/useSounds.js` — all 12 sound events are defined and wired. Add `expo-av`:

```bash
npx expo install expo-av
```

Then drop `.mp3` files into `assets/sounds/` and uncomment the load logic in `useSounds.js`.

---

*Built for mobile. Feels fast. Combo hard.*
