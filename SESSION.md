# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Branch:** `main` (pushed to `origin/main`).
- **Build & Checks:** `node tests/run_tests.mjs` -> **ALL 981 CHECKS PASSED**; `npm run build` (`vite build`) -> **clean** (`30 modules`, `3.71s`; `vendor-three` chunk).

## Done This Session
- **Mob Choppiness & Frame-Pacing Fluidity Pass:**
  - **[src/world/enemyAI.js](src/world/enemyAI.js):** Removed 15Hz `animDt` throttling on visible `22–38m` mobs (all rendered mobs now step animations at 60Hz); restored `castShadow` cleanly when re-entering `<= 38m`; validated `patrolTarget` against `world.isWalkable` + stuck detection; added `lerpAngle` smooth facing during `PATROL` and `_returningHome`; capped deferred hydration and dead-mob disposal to `1` per frame.
  - **[src/engine/models3d.js](src/engine/models3d.js):** Fixed monster `'walk'` foot-sliding (`WALK` preference + `0.65` `timeScale` fallback on `RUN`); cached `guardUpperArmBone` once; replaced recursive `mountModel.updateMatrixWorld(true)` with `saddleBone.updateWorldMatrix(true, false)`.
  - **[src/engine/renderer.js](src/engine/renderer.js), [src/main.js](src/main.js):** Removed 30/60Hz alternating shadow-map skip (uniform every-frame shadow updates); switched camera follow to frame-rate-invariant `1 - Math.exp(-9.5 * dt)`; exposed `updateCamera()` and called it before `dungeon.update` / `enemyManager.update` to eliminate 1-frame camera/frustum/healthbar lag; precompiled shaders on `enterFloor` / `enterChallenge`.
  - **[src/world/dungeonGenerator.js](src/world/dungeonGenerator.js), [src/ui/hud.js](src/ui/hud.js):** Eliminated 60Hz empty array allocations in `pickupNearbyLoot`; cached `getMinimapData` static room list; throttled `_updatePrompt` to ~10Hz / >0.25m move; switched `_updateChallengeBanner` to in-place `textContent`; coarsened minimap `camKey`.
- **SRO Music & Audio Settings (`2c62fcd`), Startup/Char-Flash/Combat Perf & Fixes (`df9effe`):**
  - 17 `.ogg` tracks in `public/assets/sro/music/`, dual-deck crossfading `MusicManager`, `F10` Audio Settings + `Shift+M` mute, boot splash & loading overlay, atomic hero GLB visibility, pooled VFX/projectiles/status rings, Axeman offhand axe & melee skill poise fixes.

## Verification Contract
Run `node tests/run_tests.mjs && npm run build`. Ask user before `git push` unless requested.
