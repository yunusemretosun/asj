# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Project Name:** `asj` (**ARKENVEIL: SIGILS & JOURNEYS**)
- **Tech Stack:** Three.js (`^0.170.0`), Vite (`^6.0.0`), Vanilla ES Modules, WebAudio procedural SFX.
- **Build & Test Status:**
  - `npm.cmd test` (`node tests/run_tests.mjs`) -> **ALL 138 CHECKS PASSED**
  - `npm.cmd run build` (`vite build`) -> **24 modules transformed, 0 errors**

## Completed Work
1. **Milestone 1 — Classes & Sets (`c810817`):**
   - `src/systems/classes.js`: 4 permanent classes (**Knight** sword/mace+shield, **Axeman** 2H axe, **Wizard** staff/MATK, **Archer** bow/DEX), appearance options, and `canClassUse` equipment locks.
   - Title screen + 3 save slots + class select + designer with live 3D preview (`src/ui/characterCreation.js`, `src/engine/heroPreview.js`), wired in `src/main.js` (`runTitleScreen`).
   - Class hero meshes/poses (`models3d.js` `setLook`), bow weapon, projectile system and ranged/targeted-AoE skills (`playerController.js`).
   - 12-skill tree per class (`skills.js`), 32 class sets (`<class>_<1..8>` in `inventory.js`) with 2/3/4(/5)-piece bonuses, and `floorMonsterLevel` scaling (floors 1–15 -> monster levels 1–52).
2. **Milestone 2 — Alchemy, Seals, Imbues & Chains (`ff4dfcf`, `5f261a8`):**
   - `src/systems/mechanics.js`: ALCHEMY, SEALS (`star`/`moon`/`sun`), STATUS (`burn`, `freeze`, `chill`, `shock`, `poison`, `stun`, `bleed`), IMBUE, skill timing phases (`prep`/`release`/`recover`), and 3-segment chain skills.
   - Alchemy UI tab in `O` menu (`menus.js`), seal badges, +7 glow/banner, status rings & DoTs in `enemyAI.js`, and move-to-interrupt skill phases in `playerController.js`.
3. **Milestone 3 — Silk-Road Village, Tomb Dungeons, Puzzles & Atmosphere (`7308fc3`):**
   - `src/world/villageBuilder.js`: Walled Silk-Road town (pagoda, market stalls, lanterns, crowd villagers, pigeons, forge smoke) surrounded by an outer forest/field grove (pine, willow, cherry trees, boulders, and southern caravan road). Minimap shows only the 6 interactive NPCs (excludes crowd villagers).
   - `src/world/dungeonDecor.js` + `dungeonGenerator.js`: 5 tomb themes (*Mine Outskirts*, *Sealed Catacombs*, *Sunken Temple*, *Ember Forge*, *Emperor's Tomb*), special rooms (`vault`, `shrine`, `processional`, `trap_gallery`), bell & rotating-statue puzzles, and pooled PointLights.
4. **Milestone 4 — Weather, Boss Arena Telegraphs, Sleeping Packs & Test Harness (this session):**
   - **Material & Instanced Decor Protection (`renderer.js`):** `brightenWorldMaterials` now skips `InstancedMesh` and tags materials (`__brightened`) so instanced tomb/village decor is never over-brightened.
   - **Weather Particle System (`renderer.js`, `dungeonGenerator.js`):** Added `renderer.setWeather('rain' | 'snow' | 'embers' | 'petals' | 'spores' | null)` wired to `applyAtmosphere` and village/dungeon themes.
   - **Boss Arena Telegraph Decals (`renderer.js`, `enemyAI.js`):** Added `renderer.spawnBossTelegraph` using `floorData.bossArena` (`shockwave`/`nova` expanding arena discs, `charge` lane decals, `summon` circles, and arena radius clamping).
   - **Sleeping Monster Packs (`enemyAI.js`):** Room packs spawn with shared `packId` (`AI_STATE.SLEEP`); proximity or damage calls `wakePack()` so the entire pack wakes and engages together.
   - **Automated Test Suite (`tests/run_tests.mjs`):** Added 138 headless Node assertions covering classes, sets, alchemy, village reachability, all 15 dungeon floors, sleeping packs, boss telegraphs, and status effects.

## Next Actions
- Run `npm.cmd run dev` for live browser playtesting and fine-tuning combat balance or audio levels if desired.
- Optional future expansion: standalone outdoor hunting zones between village and dungeon entrances, or additional endgame trial floors (B16F+).
