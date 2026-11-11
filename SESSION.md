# Session State — ASJ (ARKENVEIL: SIGILS & JOURNEYS)

## Current Snapshot
- **Project Name:** `asj` (**ARKENVEIL: SIGILS & JOURNEYS**)
- **Project Path:** `C:/Users/yunus/Projects/asj`
- **Tech Stack:** Three.js (`^0.170.0`), Vite (`^6.0.0`), Vanilla ES Modules, WebAudio API procedural synthesizer
- **Build Status:** Verified clean (`npm.cmd run build` -> `dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js` built in ~1.5s, 0 errors)

## Completed Work
1. **Rebranding to `asj` / `ARKENVEIL: SIGILS & JOURNEYS`:**
   - Renamed project directory from `arcuz-2-3d` to `asj` and updated `package.json`, `package-lock.json`, and `index.html`.
   - Updated in-game HUD zone/title banner (`src/ui/hud.js`), endgame equipment tier & uniques (`Arkenveil Blade`, `Aegis of Arkenveil`, `Crown of Arkenveil`, `Arkenveil Battleplate`, `Boots of Arkenveil`, `Heart of Arkenveil`, `Seal of Arkenveil`, `Eye of Arkenveil` in `src/systems/inventory.js`), ultimate skill (`Arkenveil Judgment` in `src/systems/skills.js`), quest/dialogue strings (`src/systems/quests.js`, `src/data/extracted_data.json`), save key prefix (`asj-save-` in `src/systems/gameState.js`), and global debug handle (`window.__ASJ_GAME__` in `src/main.js`).
2. **Core 3D Action-RPG Architecture:**
   - **3D Engine (`src/engine/`):** Isometric/3D follow camera with screen-shake, dynamic lighting & theme fog (`renderer.js`), procedural 3D articulated meshes for Hero, NPCs, 14+ monster/boss archetypes, weapons, and props (`models3d.js`), WASD + mouse/keyboard 4-hit combo, dodge-roll, shield block/parry, skill casting, and procedural WebAudio SFX (`playerController.js`).
   - **RPG Systems (`src/systems/`):** Hero leveling, attributes (`STR`, `DEX`, `INT`, `LCK`), derived combat math, buffs, and `localStorage` save/load (`gameState.js`); 8 equipment tiers, rarities, crystal/stone composing & upgrading (`inventory.js`); Battle & Passive skill trees (`skills.js`); 15+ main/side quests and NPC dialogues (`quests.js`).
   - **World & AI (`src/world/`):** Oakhaven Village hub + multi-floor procedural dungeon generator (`dungeonGenerator.js`), monster AI state machines, elite affixes, and multi-phase bosses (`enemyAI.js`).
   - **UI & Menus (`src/ui/`):** Real-time HUD, canvas minimap, boss bar, floating combat text (`hud.js`), and draggable/interactive modal menus for Hero (`C`), Bag (`B`/`I`), Skills (`K`), Compose (`O`), Quests (`Q`), Map (`M`), Shop, Storage, and Dialogue (`menus.js`, `styles.css`).
3. **Cross-Model & Multi-Agent Continuation Setup:**
   - Added `AGENTS.md`, `CLAUDE.md`, `SESSION.md`, `docs/CONTINUATION.md`, `README.md`, and `.gitignore`.

## Known Limitations & Next Actions
- **Next Priorities (Ready for single-agent or multi-agent work):**
  - Add an optional Main Title / Save Slot selection overlay screen on startup (`ARKENVEIL: SIGILS & JOURNEYS`).
  - Expand dungeon floor visual themes, boss unique mechanics, or weapon dual-wield/archery animations.
  - Add automated headless unit tests for `src/systems/*` combat/composing math if desired.
