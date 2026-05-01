# No-Blur Universe Map System

This package turns your universe map into a zoomable tile pyramid.

## What is included

- `/assets/universe/tiles/` — pre-generated 512px map tiles
- `/assets/universe/manifest.json` — tile metadata
- `index.html` — instant browser demo
- `NoBlurUniverseMap.jsx` — React Native / Expo component starter

## Best setup for Interstellar Elite

Use this as the **galaxy strategy map**:

1. Zoomed out = full cosmic map
2. Mid zoom = sector level
3. Deep zoom = system nodes
4. Tap a system = enter battle map
5. Flagship destroyed = fade into larger escape map

## Why this avoids blur

A single image gets stretched. This system swaps in higher-detail tiles as zoom increases.

## Original source dimensions

- Width: 12288
- Height: 7080

## Highest generated tile level

- Level 4: 12288 x 7080
- Tile size: 512 x 512