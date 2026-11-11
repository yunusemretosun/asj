# On-Demand Implementation & Multi-Agent Map (`docs/CONTINUATION.md`)

Read `SESSION.md` first. Open only the files relevant to your current task.

## 1. File & Module Map

| Area / Shard | Files | Key Exports & Responsibilities |
| :--- | :--- | :--- |
| **Bootstrap & Coordinator** | `src/main.js`, `index.html` | Initializes all subsystems, builds shared `gameContext`, wires `enterFloor(n)` / `returnToVillage()`, runs 60fps `animate()` loop, exposes `window.__ASJ_GAME__`. |
| **3D Renderer & VFX** | `src/engine/renderer.js` | `createRenderer(container)` — Three.js scene, renderer, follow camera, environment themes (`village`, `cave`, `crypt`, `forest`, `lava`, `abyss`), slash arcs, hit sparks, level-up pillar, auras. |
| **Procedural 3D Models** | `src/engine/models3d.js` | `models3d`, `createHeroMesh` — Procedural Three.js geometry/materials for the hero (with equipment sync), village NPCs, monsters, bosses, chests, portals, shrines, and props. |
| **Player & Audio** | `src/engine/playerController.js` | `PlayerController`, `SoundFX` — WASD movement, dash/dodge-roll (`Space`/`Shift`), 4-stage melee combo (`J`/LMB), block/parry (`K`/RMB), skill hotbar (`1`–`5`), potions (`6`–`9`), interact (`E`/`F`), WebAudio procedural SFX. |
| **Core RPG State** | `src/systems/gameState.js` | `createGame({ data })`, `calcDamage`, `SAVE_PREFIX` (`asj-save-`) — Hero progression, attributes (`str`, `dex`, `int`, `lck`), derived stats, buffs, stamina, death/revive, `localStorage` save/load. |
| **Inventory & Composing** | `src/systems/inventory.js` | `Inventory`, `ITEM_BASES`, `generateItem`, `rollLoot` — 8 equipment tiers (`Crude`..`Arkenveil`), rarities, bag/stash/shop, elemental crystal & stone Composing/synthesis system. |
| **Skills System** | `src/systems/skills.js` | `SkillSystem`, `SKILL_DEFS`, `BASIC_COMBO` — Active Battle skills & Passive skills, SP costs, cooldowns, hotbar assignment. |
| **Quests & Dialogue** | `src/systems/quests.js` | `QuestSystem`, `QUEST_DEFS`, `NPC_DEFS` — Main & side quests, kill/collect/floor/talk objectives, NPC dialogue state machine & rewards. |
| **World & Dungeons** | `src/world/dungeonGenerator.js` | `createDungeonGenerator(ctx, models3d, data)` — Oakhaven Village hub (`loadVillageHub`), procedural multi-floor dungeons (`generateFloor`), room sectors, minimap data, interactables (`interact`). |
| **Enemy & Boss AI** | `src/world/enemyAI.js` | `createEnemyManager(ctx, models3d, data)` — Monster catalog, level scaling, patrol/chase/attack/telegraph AI, elite modifiers, boss phases, loot & EXP drops on death. |
| **HUD & Host Adapter** | `src/ui/hud.js` | `HUD`, `createHUD`, `createHost` — Normalizes `gameContext` for UI, renders HP/SP/Stamina/EXP bars, 2D canvas minimap, boss bar, zone banners, floating combat text, and toasts. |
| **Interactive Menus** | `src/ui/menus.js`, `src/ui/styles.css` | `MenuManager`, `createMenus` — Modal windows for Hero (`C`), Inventory (`B`/`I`), Skills (`K`), Compose (`O`), Quests (`Q`), Dungeon Floors (`M`), Shop, Storage, and NPC Dialogue. |
| **Static Reference Data** | `src/data/extracted_data.json`, `docs/REA_ANALYSIS.md` | Static RPG reference tables & localization strings. **Do not load in full into LLM context; query specific lines/keys on demand.** |

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
