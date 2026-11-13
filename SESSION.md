# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Commit:** pending commit on `main` (village ground + dungeon floor redesign, not pushed).
- **Build & Checks:** `node tests/run_tests.mjs` -> **ALL 965 CHECKS PASSED**; `npm run build` (`vite build`) clean (only >1500 kB chunk-size warning).

## Done This Session
- **[villageBuilder.js](src/world/villageBuilder.js):**
  - Fixed stretched ~245:1 outer grass (`PlaneGeometry` rotated before `applyPlanarXZUVs` world-XZ UVs).
  - Replaced 16 brown camp discs and 4 straight dirt roads with a 256×256 CPU `DataTexture` RGBA splat map (`R`=winding wheel-rut trails, `G`=noise-feathered camps, `B`=riverbank pebbles, `A`=city mask) + `onBeforeCompile` shader (clean Node headless fallback).
  - Unified city interior (`|x|,|z|<=55.5`) to strictly two non-overlapping ground types: base floor (`c_marble_jang_01.png`, `VillageGround_base`) and roads (`cobble_road_diff.jpg`, `VillageGround_road`), removing plazas/trim/white diamond medallions and keeping `Village_curb` (`rok_stone_02.png` + `Batcher` cubic world UVs) strictly outside road edges.
  - Merged ground meshes down to 3 terrain/ground draw calls + stream meshes, and disabled `castShadow` on small/decorative `Batcher` buckets.
- **[dungeonDecor.js](src/world/dungeonDecor.js) & [dungeonGenerator.js](src/world/dungeonGenerator.js):**
  - Carved biome room shapes (`_carveBiomeRoomShapes`: chamfer/pockets for caves, 2-tile wall niches for tombs/temples, `TILE.PIT` magma channels for `flame`) while keeping >=10×10m room centers clear.
  - Updated floor/wall geometry: `dummy.scale` `1.002` (zero seam gaps), color variation `0.95–1.04`, continuous world-XZ floor UVs, no architectural wall height jitter, wall-base skirting plinths, `wallInst.castShadow = false`, and `addWallPillars` inner-corner support (`n === 2` perpendicular).
  - Replaced 5-theme decorator dispatch with `resolveSroDungeon` biome decorators (removed Qin-Shi vines, Karakoram skulls, F13–16 terracotta) and wired previously unused `public/assets/sro/dun/props/*.glb` props; removed all `cj_jang_gate_dragon` entries.
  - Oriented boss arena carpet/flanks to `_findBossRoomEntrance` (added East scan, fixed South tile offset), customized boss arenas per biome, wired `SRO_DUNGEON_PROPS[*].bossGate` in `_spawnGate`, randomized `_buildTrapGallery` `safe` lane (removed misleading cross lines), and moved shrines & challenge portals to framed perimeter wall niches.
- **[tests/run_tests.mjs](tests/run_tests.mjs):** Added suite #29 validating village splat terrain, unified road/base ground, biome props/pits, `1.002` floor scale, East boss entrance scan, niche placement, and wired boss gates.

## Remaining Open Tasks (from prior backlog)
1. **Mob attacks too ranged (`src/world/enemyAI.js`):** gate `isSkillInRange` ranged caps on `enemy.isRanged || enemy.isBoss`; audit melee vs. ranged skills & multipliers (`L1347`).
2. **Remaining runtime performance items:** `renderer.js` PointLight pool/DPR/VFX/FCT, `models3d.js` GLB merging/emissive hit-flash, `enemyAI.js` spatial hash & HP bar sharing, `hud`/UI DOM batching.

## Verification Contract
Run `node tests/run_tests.mjs && npm run build` after changes. See `docs/CONTINUATION.md` for module ownership.
