# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Project Name:** `asj` (**ARKENVEIL: SIGILS & JOURNEYS**)
- **Tech Stack:** Three.js (`^0.170.0`), Vite (`^6.0.0`), Vanilla ES Modules, WebAudio procedural SFX.
- **Build & Test Status:**
  - `npm test` (`node tests/run_tests.mjs`) -> **ALL 398 CHECKS PASSED**
  - `npm run build` (`vite build`) -> **27 modules transformed, 0 errors**

## Completed Work
1. **Milestone 1 — Classes & Sets (`c810817`):**
   - `src/systems/classes.js`: 4 permanent classes (**Knight** sword/mace+shield, **Axeman** 2H axe, **Wizard** staff/MATK, **Archer** bow/DEX), appearance options, and `canClassUse` equipment locks.
   - Title screen + 3 save slots + class select + designer with live 3D preview (`src/ui/characterCreation.js`, `src/engine/heroPreview.js`), wired in `src/main.js` (`runTitleScreen`).
   - 12-skill tree per class (`skills.js`), 32 class sets (`<class>_<1..8>` in `inventory.js`) with 2/3/4(/5)-piece bonuses, and `floorMonsterLevel` scaling (floors 1–15 -> monster levels 1–52).
2. **Milestone 2 — Alchemy, Seals, Imbues & Chains (`ff4dfcf`, `5f261a8`):**
   - `src/systems/mechanics.js`: ALCHEMY, SEALS (`star`/`moon`/`sun`), STATUS (`burn`, `freeze`, `chill`, `shock`, `poison`, `stun`, `bleed`), IMBUE, skill timing phases (`prep`/`release`/`recover`), and 3-segment chain skills.
3. **Milestone 3 — Silk-Road Village, Tomb Dungeons, Puzzles & Atmosphere (`7308fc3`):**
   - `src/world/villageBuilder.js`: Walled Silk-Road town surrounded by an outer forest/field grove. Minimap shows only the 6 interactive NPCs.
   - `src/world/dungeonDecor.js` + `dungeonGenerator.js`: 5 tomb themes, special rooms (`vault`, `shrine`, `processional`, `trap_gallery`), bell & rotating-statue puzzles, and pooled PointLights.
4. **Milestone 4 — Weather, Boss Arena Telegraphs, Sleeping Packs & Test Harness (`349e38c`):**
   - Weather particle system (`rain`, `snow`, `embers`, `petals`, `spores`), boss arena telegraph decals (`spawnBossTelegraph`), and pack wake-up AI (`wakePack()`).
5. **Milestone 5 & Curated Silkroad Online Asset Integration (this session):**
   - **5-Orb Berserk (Hwan) Mode (`mechanics.js`, `gameState.js`, `playerController.js`, `hud.js`):** 5-orb gauge filled by kills; `Tab`/`R` or HUD click unleashes 20s crimson lightning aura (`2.0x` damage, `1.38x` move speed, `1.3x` attack speed).
   - **Nemesis System (`gameState.js`, `enemyAI.js`, `hud.js`):** Non-boss killer promotes to ranked Nemesis on that floor; slaying it refunds lost gold + 2.5x EXP.
   - **Jade Mist Hot Springs (`villageBuilder.js`, `gameState.js`, `hud.js`):** Steaming bathhouse at `(-16, -14)` restores HP/MP and grants Rested EXP (+100% combat EXP).
   - **Boss Fury & Elemental Aegis (`enemyAI.js`, `hud.js`):** 90s Fury countdown and 3 Elemental Aegis shield crystals at 55% HP (80% damage reduction until shattered).
   - **Silkroad Reference Assets, Rigged Equipment, Dual-Wield Axes & Mob/Boss Roster (`public/assets/sro/*`, `classes.js`, `inventory.js`, `skills.js`, `menus.js`, `models3d.js`, `villageBuilder.js`, `dungeonDecor.js`, `enemyAI.js`):**
     - **Authentic Silkroad Character & Skinned Equipment Rigging:** Characters load `chinaman_warrior.glb` (Knight), `europeman_adventurer.glb` + `dual_axe_anims.glb` (Axeman), `chinaman_scholar.glb` (Wizard), and `chinaman_adventurer.glb` (Archer) with `SkeletonUtils.clone` and `THREE.AnimationMixer` (`STAND1`, `WALK`, `RUN`, `ATTACK1..3`, `DAMAGE1`, `DIE1`), plus spiky Hwan hair (`chinaman_hwan_hair.glb`) in Berserk mode. Fixed sanitized bone name lookup (`Bip01_R_HandMid`, `Bip01_L_Hand`, `Bip01_Neck1`, `Bip01_Head`) and bind-pose world rotation cancellation (`bindQuat.invert()`) so all weapons, shields, cloth shoulder pads, and Hwan hair render visibly in real-time. Equipped armor/clothes/helm/gloves/boots (`{heavy,light,clothes}_{01..04}_{ba,sa,la,ha,aa,fa}.glb`) bind directly to the hero skeleton with degree progression (`Tier 0 -> 01`, `Tier 1 -> 02`, `Tier 2 -> 03`, `Tier 3+ -> 04`), per-item rarity/seal/plus tint & glow (`applyGLBArmorLook`), and real-time unequip removal.
     - **Axeman European Dual-Wield Axes:** Axemen use `europeman_adventurer.glb` + European dual-axe combat animations (`dual_axe_anims.glb`), can equip two axes (`weapon` + `shield` offhand slot), start with dual axes in `grantStarterKit('axeman')`, and visually mount 3D European battle axes (`createEuropeanAxeMesh`, `axe_01..04`) on both `Bip01_R_HandMid` and `Bip01_L_Hand` with matching `axe_01..04.png` icons.
     - **Town Character Strolling & Monster/Boss Grounding + High Boss SOS Drop Rate:** Town characters stand flush on the village plaza (`y = 0.08`), stroll calmly using `WALK` (`stroll`), and pause in `STAND1` idle for 4.5–9.5s at each waypoint. Bosses and monsters automatically compensate for `STAND1` root-bone Y drops (`(bindRootY - rootBone.position.y) * scale`) so they never sink into the ground. Boss `rollSeal` multiplier increased to `15x` and `rollLoot` guarantees at least 1 SOS/SOM/SOSun sealed equipment drop per Boss kill.
     - **Silkroad Mastery & Skill Mapping:** Mapped Knight -> **Bicheon**, Axeman -> **Heuksal + Fire Force**, Wizard -> **Cold / Lightning / Fire Force**, Archer -> **Pacheon** with all 32 skills matched to authentic Silkroad skill icons (`/assets/sro/icons/skills/*.png`), `sroCode`s, and 3D skill ground indicators (`spawnSkillIndicator`).
     - **Curated Silkroad Mobs & Unique Bosses:** Added 18 Silkroad mobs (`mangyang`, `bigeye_ghost`, `gyo_weasel`, `water_ghost`, `stone_ghost`, `tombstone_ghost`, `yeoha`, `bandit`, `bandit_archer`, `tiger`, `white_tiger`, `blue_tiger`, `chakji`, `ghost_bug`, `devil_bug`, `hyungno`, `earth_ghost`, `gunpowder_ghost`) and 5 Unique Bosses (**Tiger Girl**, **Black Tiger Bandit Leader**, **Earth Taoist King**, **Blue Tiger Sovereign**, **Hyeongcheon the Immortal**) across Floors 1–15 with `THREE.AnimationMixer` animations.
     - **Normalized Gate & Environment Scaling + Performance Optimization:** Fixed village walking chair bug (`town/elder_m.glb`, `m01..m03.glb`, `w01..w02.glb`, `guard_spear.glb`, `guard_bow.glb`), normalized `cj_portal.glb`, `cj_jang_gate_dragon.glb`, `cj_portal_stone.glb`, `cj3_lion01.glb`, `cj_streetstall.glb`, and Silkroad 3D trees (`tre_maple01.glb`, `tre_pine01.glb`, `tre_willow01.glb`) to ground level (`min.y = 0`), rendered all non-gold item drops as Silkroad treasure chests (`drop_ch_equip*.glb`, `drop_ch_acc*.glb`, `drop_archemy.glb`), and eliminated per-clone material duplication and excessive shadow casting.
     - Replaced obsolete composing/upgrade tabs and crystals/stones with the authentic Silkroad Reinforcement Alchemy Workshop (`alcm_window_reinforcement.png` + 4×4 animated prepare/success/fail sprite sheets).

6. **Class Gear Pass (all 4 classes):**
   - Knight: Chinese `blade_1` (`blade_01..04` GLB) + shield + heavy armor. Wizard: European look (`europeman_adventurer.glb`) + procedural European staff (`createEuropeanStaffMesh`, `staff_01..04` + icons). Axeman: European dual axes (procedural, `createOffhandAxe`). Archer: Chinese bow + light armor.
   - `buildStarterEquipment(classId)` in `inventory.js` drives both `grantStarterKit` and the creation preview; starter armor family per class (`STARTER_ARMOR_FAMILY`).
   - `applyClassClipMap` maps RUN/ATTACK1–4/CAST1–2 to the weapon clips embedded in each class GLB (no separate `dual_axe_anims.glb` load). Combo stage 3 now reaches ATTACK3; long clips are time-scaled to the gameplay window.
   - Save repair re-applies visual metadata (old wizard `spear_*` → `staff_*`). Fixed NPC weapon glow infinite traverse.
   - Verified with a Playwright harness (local, untracked `.asj-harness/`): all classes mount their gear, 0 page/console errors, 0 missing assets.
   - Limitation: no European item models exist upstream; staff/axes are procedural.

7. **Alchemy fixes (`menus.js`, `inventory.js`):** Fuse button handler (`alchgo`) was missing; O-hotkey/NPC selection crashed (missing `_composeClick`); equipped items can now be enhanced (3D refresh via `equip` emit) with a visible block reason; each + level adds at least +1 stat; alchemy counts for the compose quest; double-click no longer cancels the fuse; result timer and history labels fixed. Verified by `.asj-harness/alchemy.mjs` (19/19).

8. **Portal fixes:** gate pavilion `cj_portal.glb` grounded by its floor slab (was floating on its buried rock shaft, scale 0.32); Waystone selector uses `cj_portal_stone.glb` + rune ring and opens the map once; dungeon return portal moved out of spawn reach (no instant bounce to town); boss rift placed clear of props, visibly sealed until the boss dies; Return Scroll loads the village once; HUD/E-key reach unified (3.0). Verified by `.asj-harness/portal.mjs`.

10. **Shift guard / slow walk (`playerController.js`, `models3d.js` `buildGuardPose`, `applyGuardArmSwing`):** Shift no longer dashes (Space still does). Holding Shift with a real shield equipped (`equipment.shield.subtype === 'shield'`) sets `block` / `block_walk` (0.38× speed): the left arm is layered with the `shield_wait` guard pose over STAND1/WALK, then swung forward (`GUARD_TUNE` yaw -1.0, pitch 0.5) so the shield sits in front of the chest. Without a shield Shift gives `walk_slow` (0.4× speed, WALK clip). While Shift is held, `_updateSkillPhase` gets no move input, so skills are not interrupted.
9. **Gear +N / seal FX (`models3d.js` `gearFxProfile`, `buildWeaponGearFx`, `buildArmorGearFx`):** +3 and above get a breathing texture-following emissive glow plus a fresnel rim (+3/4 frost, +5/6 blue, +7/8 violet, +9+ gold); +5 and above weapons get small glints running along the blade. Seals add their own particles: Star = twinkle flashes, Moon = orbiting motes, Sun = rising embers. Both combine (colors blended, +N glints halved). Armor is skinned so it only uses glow + rim (old static shells removed). Updated per frame via `root.userData.gearFx`.

## Next Actions
- Run `npm.cmd run dev` for live browser playtesting and fine-tuning combat balance or audio levels if desired.
- Optional future expansion: standalone outdoor hunting zones between village and dungeon entrances, or additional endgame trial floors (B16F+).
