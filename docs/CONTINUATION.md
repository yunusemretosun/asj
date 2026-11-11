# On-Demand Implementation & Multi-Agent Map (`docs/CONTINUATION.md`)

Read `SESSION.md` first. Open only the files relevant to your current task.

## 1. File & Module Map

| Area / Shard | Files | Key Exports & Responsibilities |
| :--- | :--- | :--- |
| **Bootstrap & Coordinator** | `src/main.js`, `index.html`, `src/systems/classes.js`, `src/systems/mechanics.js` | Initializes subsystems, runs title screen (`runTitleScreen`), builds shared `gameContext`, owns class & mechanics contracts. |
| **3D Renderer & VFX** | `src/engine/renderer.js`, `src/engine/heroPreview.js` | `createRenderer(container)`, `createHeroPreview(canvas)` — Three.js scene, follow camera, themes, `applyAtmosphere`, `setWeather`, `spawnBossTelegraph`, slash arcs, particles. |
| **Procedural 3D Models** | `src/engine/models3d.js` | `models3d`, `createHeroMesh` — Procedural Three.js geometry/materials for classed heroes (`setLook`), set-tier armor & weapon glow, NPCs, monsters, bosses, and props. |
| **Player & Audio** | `src/engine/playerController.js` | `PlayerController`, `SoundFX` — WASD movement, dodge-roll, melee/bow/staff attacks, `prep->release->recover` skill phases, 3-segment chains, imbue visuals, WebAudio SFX. |
| **Core RPG State** | `src/systems/gameState.js` | `createGame({ data })`, `calcDamage`, `SAVE_PREFIX` (`asj-save-`) — Classed hero progression, attributes (`str`, `dex`, `int`, `lck`), derived stats, buffs, `localStorage` save/load. |
| **Inventory & Alchemy** | `src/systems/inventory.js` | `Inventory`, `ITEM_BASES`, `SETS`, `floorMonsterLevel` — 8 equipment tiers, 32 class sets, Star/Moon/Sun seals, crystal composing & +1..+10 Alchemy system. |
| **Skills System** | `src/systems/skills.js` | `SkillSystem`, `SKILL_DEFS`, `BASIC_COMBO` — 48 class skills (12 per class: Knight, Axeman, Wizard, Archer), imbues, chains, and passives. |
| **Quests & Dialogue** | `src/systems/quests.js` | `QuestSystem`, `QUEST_DEFS`, `NPC_DEFS` — Main & side quests, kill/collect/floor/talk objectives, NPC dialogue state machine & rewards. |
| **World & Dungeons** | `src/world/dungeonGenerator.js`, `src/world/villageBuilder.js`, `src/world/dungeonDecor.js` | Silk-Road Village hub & outer forest grove (`buildVillage`), 15-floor procedural tomb dungeons (`generateFloor`), instanced decor, bell/statue puzzles, `bossArena`. |
| **Enemy & Boss AI** | `src/world/enemyAI.js` | `createEnemyManager`, `AI_STATE` — Monster catalog, sleeping monster packs (`packId`, `wakePack`), status effects (`applyStatus`), elite affixes, boss phases & `bossArena` telegraphs. |
| **HUD & Menus** | `src/ui/hud.js`, `src/ui/menus.js`, `src/ui/characterCreation.js`, `src/ui/styles.css` | `HUD`, `MenuManager`, `openCharacterCreation` — Title/character creation screen, HUD, minimap, Alchemy/Compose (`O`), Skills (`K`), Inventory (`B`/`I`), Quests (`Q`), Map (`M`). |
| **Automated Tests** | `tests/run_tests.mjs` | Headless Node test suite (`npm.cmd test`) — 138 checks covering classes, sets, alchemy, village, all 15 dungeon floors, sleeping packs, boss telegraphs, and statuses. |

---

## 2. Shared `gameContext` Contract (`src/main.js`)

All subsystems communicate through `gameContext` (also accessible in browser devtools as `window.__ASJ_GAME__`):

```js
const gameContext = {
  data: extractedData,
  renderer,          // from createRenderer()
  scene: renderer.scene,
  models3d,          // procedural mesh factory
  gameState,         // core RPG state (also aliased as gameContext.game)
  inventory: gameState.inventory,
  skills: gameState.skills,
  quests: gameState.quests,
  dungeon,           // from createDungeonGenerator() (also aliased as gameContext.world)
  enemyManager,      // from createEnemyManager() (also aliased as gameContext.enemies)
  player,            // PlayerController instance
  hud,               // HUD instance
  menus,             // MenuManager instance
  sound: player.sound,
  enterFloor(floorNum),
  returnToVillage()
};
```

---

## 3. Architectural Invariants

1. **Pure Logic RPG Systems (`src/systems/*`):**
   - Modules in `src/systems/` must remain pure JavaScript logic with zero DOM or `three` imports so they can be tested or reused headlessly.
2. **Input Pause on Modal Open:**
   - Whenever `menus.isAnyMenuOpen()` is `true`, `player.inputEnabled` is set to `false` so clicking inside inventory/shop/dialogue never triggers 3D attacks or movement.
3. **Save Prefix & Compatibility:**
   - Saves use `SAVE_PREFIX = 'asj-save-'` in `localStorage` (slots `0`, `1`, `2`). Quick-save is bound to `F5` and the HUD Save button.
4. **World Material Readability:**
   - After loading the village hub or generating a dungeon floor, `renderer.brightenWorldMaterials(dungeon.rootGroup || renderer.scene)` ensures dungeon floors and walls remain vivid and readable under dynamic lighting.

---

## 4. Multi-Agent Parallel Workflow Guide

When spawning multiple agents (e.g., Claude Code subagents or Antigravity Swarm):
- Give each worker `workspace: "share"` (or isolated branch) and assign files strictly from a single row of the **Multi-Agent Ownership Table** in `AGENTS.md`.
- Have workers verify their changes with `npm.cmd run build` before reporting completion.
- The coordinator merges changes, runs a final `npm.cmd run build`, and updates `SESSION.md`.
