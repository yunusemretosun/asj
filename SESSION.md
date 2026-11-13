# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Branch:** `main` (unpushed commits on `main`; prior `fbb9120` + new perf/AI/lore/lotus commit).
- **Build & Checks:** `node tests/run_tests.mjs` -> **ALL 971 CHECKS PASSED**; `npm run build` (`vite build`) -> **clean** (`29 modules`, `4.38s`; only >1500 kB chunk-size warning). `grep -rn '[ğĞüÜşŞıİöÖçÇ]' index.html src/` -> 0 matches.

## Done This Session
- **Alert `'!'` Non-Spam & Tether Fix ([enemyAI.js](src/world/enemyAI.js), [main.js](src/main.js)):**
  - Fixed `enemy.alerted` -> `enemy.isAlerted` in `applyTrialScaling`; stopped re-firing `'!'` when already chasing/hit (`wasUnengaged`/`wasAlertedBefore` checks + 8s `_lastAlertAt` cooldown).
  - Fixed outskirt tether ping-pong via `_returningHome` + `_leashTimer = 3.0` + `aggroRange * 1.35` hysteresis (`leashR = 34` for Giants, `26` for normal camp mobs).
- **Full Runtime & UI Performance Refactor:**
  - **[renderer.js](src/engine/renderer.js):** Fixed 8-slot scene-resident `PointLight` pool, DPR cap `1.5`, 30 Hz `PCFShadowMap` + texel snapping + `invalidateShadows()`, `DynamicDrawUsage` weather, 128-instance `InstancedMesh` particles, swap-and-pop VFX pooling, 48-node `translate3d` FCT pool.
  - **[models3d.js](src/engine/models3d.js), [playerController.js](src/engine/playerController.js), [petController.js](src/engine/petController.js):** Non-cloning `onBeforeCompile` `uHitFlash` shader, `isSharedAsset` guards, merged/cached static props, scale-aware frustum culling, `lightweightCrowd` villagers, scratch vectors, `forEachEnemyInRange` / squared-distance queries, zero per-mob PointLights.
  - **[enemyAI.js](src/world/enemyAI.js), [dungeonGenerator.js](src/world/dungeonGenerator.js), [dungeonDecor.js](src/world/dungeonDecor.js), [villageBuilder.js](src/world/villageBuilder.js):** Deferred far-mob mesh hydration (`<=3`/frame within 48m), 38m/52m LOD+frustum culling, spatial cell grids, pooled dungeon lights, `_surfaceTexCache`, `36m` prop culling, throttled village animations.
  - **[hud.js](src/ui/hud.js), [menus.js](src/ui/menus.js), [styles.css](src/ui/styles.css), [gameState.js](src/systems/gameState.js), [skills.js](src/systems/skills.js):** GPU `scaleX`/`translate3d` updates, zero `offsetWidth` reflows, memoized HUD/`getHudSummary`/`fillSkillBar`, static minimap canvas cache, cached tooltip bounds, cleaned dialogue timers.
- **English-Only & ARKENVEIL Lore Pass:** Removed all Turkish text and player-facing Silkroad proper names (`Jangan`, `Tiger Girl`, `Uruchi`, `Isyutaru`, `Lord Yarkan`, `Demon Shaitan`, `Medusa`, `Roc`, `Mangyang`, `Bicheon/Heuksal/Pacheon`, `Silkroad`) across UI, quests, chronicles, banners, bosses, NPCs, skills, and village outskirts while keeping `/assets/sro/...` asset URLs and internal IDs functional.
- **Outskirt Camp Giant Spawn ([enemyAI.js](src/world/enemyAI.js)):** Added `OUTSKIRT_GIANT_KILL_THRESHOLD = 10` + `campKills` + `getCampKillProgress` + `_spawnCampGiant` (`spawnOnce: true`, guards double-spawn while Giant alive).
- **Pond Lotus Cutout Fix ([villageBuilder.js](src/world/villageBuilder.js), [dungeonDecor.js](src/world/dungeonDecor.js)):** Raised pond/hot-spring lotus quads above water/lily surfaces (`0.115` / `0.215`) and switched flat opaque `loadSROSprite` to alpha-cutout (`alphaTest: 0.35, depthWrite: true`).
- **[tests/run_tests.mjs](tests/run_tests.mjs):** Updated boss/mob lore assertions and added regression checks for lotus elevation, `'!'` non-spam + tether, outskirt Giant kill-threshold, `resolveCollision`, `getHudSummary`, and `fillSkillBar`.

## Remaining Open Tasks
1. **Mob attacks too ranged ([enemyAI.js](src/world/enemyAI.js)):** audit melee vs. ranged `isSkillInRange` caps (`L1347`).

## Verification Contract
Run `node tests/run_tests.mjs && npm run build`. Ask user before `git push`.
