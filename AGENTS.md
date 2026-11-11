# ASJ (ARKENVEIL: SIGILS & JOURNEYS) — Agent & Multi-Agent Guidelines

## Continuation and Economical Context

- **Start here:** Read `SESSION.md`, `git status --short`, and `git log -2 --oneline` first.
  Notes describe a verified snapshot, not proof of unchanged current code.
- **On-demand architecture map:** Read `docs/CONTINUATION.md` when you need the module map, `gameContext` contract, invariants, or multi-agent shard boundaries.
- **Avoid context bloat:**
  - Do **not** read `src/data/extracted_data.json` (12,500+ lines) or `docs/REA_ANALYSIS.md` in full at startup. Query specific keys/lines only when needed.
  - Do **not** scan `node_modules/` or `dist/`.
- **Preserve existing work:** Inspect relevant implementation before editing; do not rebuild completed systems from scratch.
- **Verification:** Run `npm.cmd run build` (on Windows PowerShell) after code changes to verify clean ES module bundling with Vite.
- **At handoff:** Update `SESSION.md` in place (source revision, build freshness, changes made, verification results, limitations, and next actions). Keep `SESSION.md` concise (under ~500 words) and do not append raw conversation transcripts.

## Multi-Agent / Parallel Worker Ownership Boundaries

When running multiple agents in parallel (e.g., Claude subagents, Antigravity Swarm, Cursor background agents), split work strictly by directory/module ownership so workers never edit the same file simultaneously:

| Role / Shard | Owned Files | Responsibility |
| :--- | :--- | :--- |
| **`coordinator`** | `src/main.js`, `index.html`, `package.json`, `SESSION.md` | Bootstrap wiring, `gameContext` contract, zone transitions, final integration & build check |
| **`engine-3d`** | `src/engine/renderer.js`, `src/engine/models3d.js`, `src/engine/playerController.js` | Three.js scene, lighting, camera, VFX particles, procedural 3D meshes, hero movement/combat input, WebAudio SFX |
| **`rpg-systems`** | `src/systems/gameState.js`, `src/systems/inventory.js`, `src/systems/skills.js`, `src/systems/quests.js` | Pure logic RPG state, leveling/stats, equipment/composing/shops, active/passive skill trees, quests & NPC dialogues |
| **`world-ai`** | `src/world/dungeonGenerator.js`, `src/world/enemyAI.js` | Oakhaven Village hub, procedural multi-floor dungeons, traps/chests/portals, monster & boss AI/telegraphs |
| **`ui-hud`** | `src/ui/hud.js`, `src/ui/menus.js`, `src/ui/styles.css` | DOM/CSS overlay HUD, minimap, boss bar, floating combat text, and modal RPG menus (`C`, `B/I`, `K`, `O`, `Q`, `M`) |
