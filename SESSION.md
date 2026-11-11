# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Tech Stack:** Three.js (`^0.170.0`), Vite (`^6.0.0`), Vanilla ES Modules, WebAudio procedural SFX.
- **Build Status:** `npm run build` NOT run in the last session (Node was not installed on the dev Mac). Instead every module was syntax-checked with macOS JavaScriptCore (`jsc` + `checkModuleSyntax`), imports/exports were cross-checked, and headless logic tests for `src/systems/*` passed. **First action next session: `npm install && npm run build`, then `npm run dev` and visually check the title screen, class models and combat.**

## Completed Work
1. **Milestone 1 — Classes & sets (commit `c810817`):**
   - `src/systems/classes.js`: contract for 4 permanent classes (Knight sword/mace+shield, Axeman 2H axe, Wizard staff/MATK, Archer bow/DEX), appearance options, `canClassUse` (weapons, shields and `classOnly` set gear are class-locked).
   - Title screen + 3 save slots + class select + designer with live 3D preview (`src/ui/characterCreation.js`, `src/engine/heroPreview.js`), wired in `src/main.js` (`runTitleScreen`). Legacy saves load as Knight.
   - Class hero meshes/poses (`models3d.js` `setLook`), bow weapon, projectile system and ranged/targeted-AoE skills (`playerController.js`).
   - One 12-skill tree per class (`skills.js`, filtered by class). Stat formulas rebalanced: ATK scales from the class primary attribute (DEX for archers), INT→MATK tuned to match STR→ATK.
   - 32 class sets (`<class>_<tier>`, 8 tiers × 4 classes) with 2/3/4-piece bonuses; drops match monster level; floors 1–15 map to monster levels 1–52 (`floorMonsterLevel` in `inventory.js`).
2. **Milestone 2 — mechanics (this commit; mostly complete):**
   - Contract `src/systems/mechanics.js`: ALCHEMY, SEALS, STATUS, IMBUE, skill timing, chain format.
   - Systems (done, tested): alchemy `previewAlchemy/alchemy` (elixirs `elixir_*`, `powder_1..4`, `guardian_talisman`; fail → +0, talisman → −1), seals star/moon/sun on drops, imbue skills (row 4 per class: `radiant_edge`, `ax_blood_rend`, `wz_frostfire_weave`, `ar_venom_tips`), statuses on elemental skills, 3-segment chain skills (`flame_slash`, `ax_rending_chop`, `ar_power_shot`, `wz_arcane_missiles`), descriptors carry `prep/recover/instant/chain/status`.
   - UI (done): Alchemy tab (default in `O` compose menu, 3 s fuse bar), seal badges, +7 glow, +7 banner, imbue buff icon, 5-row skill tree.
   - Engine/world (done, verified headlessly): `enemyManager.applyStatus` in `enemyAI.js`; skill phases prep→release→recover with move-to-interrupt (`playerController._updateSkillPhase`), 3-segment chains for all 4 classes, imbue weapon visuals (`_syncImbueVisual`), alchemy SFX/VFX, set-tier armor visuals + glow in `models3d.js`.
3. **Milestone 3 — environment (done, headless-verified):**
   - `src/world/villageBuilder.js`: walled Silk-Road town (curved roofs, pagoda, market, lanterns, crowd villagers, pigeons, smoke); all 6 NPCs, dungeon portal and floor selector reachable from spawn.
   - `src/world/dungeonDecor.js` + `dungeonGenerator.js`: 5 tomb themes (Mine Outskirts, Sealed Catacombs, Sunken Temple, Ember Forge, Emperor's Tomb), special rooms (vault, shrine, processional hall, trap gallery), puzzles (bell order on even floors, rotating statues on odd floors ≥3; solving opens the vault gate), boss arena (`floorData.bossArena`), instanced decor, pooled max-8 PointLights (`_updateLightBudget`). All 15 floors tested: spawn walkable, every room reachable, puzzles solvable.
   - `renderer.applyAtmosphere(floorData.atmosphere)` (called in `main.js` `enterFloor`): smooth fog/ambient/key-light blend with readability clamps, optional dust motes. Reset by `setEnvironmentTheme`.

## Known Limitations & Next Actions
- **Run `npm install && npm run build && npm run dev` first** and fix anything the bundler/browser reports; nothing has been rendered in a browser yet.
- Needs a browser check: prop scale/placement (arches, pillars, statue rows), dungeon brightness after the lower fill lights + atmosphere clamps (`brightenWorldMaterials` may over-brighten instanced decor), pooled-light popping, villager/pigeon animation, awning axis, and all class/set model visuals.
- Not done yet: weather (rain/snow/fog) and forest/field outdoor areas; boss telegraph decals using `bossArena`; monsters sleeping in packs and waking together; minimap shows no crowd villagers.
- Headless test harness lives in `/tmp/asjcheck/` (JavaScriptCore + THREE stub; not committed). Recreate or port to `tests/` with Node.
- Assets: do not import art from the Silkroad reference repo (extracted commercial assets); its design docs were used only for mechanics/ideas.
