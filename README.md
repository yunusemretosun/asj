# ARKENVEIL: SIGILS & JOURNEYS (`asj`)

A 3D dark-fantasy Action-RPG built with **Three.js**, **Vite**, and **Vanilla ES Modules** (zero external asset dependencies — all 3D characters, monsters, weapons, dungeon architecture, VFX, and WebAudio sound effects are generated procedurally).

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build
```

> **Windows PowerShell Note:** If PowerShell execution policy blocks `npm.ps1`, use `npm.cmd install`, `npm.cmd run dev`, and `npm.cmd run build`.

---

## Controls

| Input | Action |
| :--- | :--- |
| **`W` `A` `S` `D` / Arrow Keys** | Move Hero |
| **Left Click / `J`** | 4-Stage Melee Attack Combo |
| **Right Click / `K`** | Shield Block / Timed Parry |
| **`Space`** | Dodge Roll (with invulnerability frames) |
| **`Shift` (hold)** | Raise shield (shield equipped) or walk slowly; never interrupts skills |
| **`1` – `5`** | Cast Active Battle Skills |
| **`6` – `9`** | Use Quick-Slot Potions |
| **`E` / `F`** | Interact with NPCs, Chests, Portals, Shrines |
| **`C`** | Hero Attributes & Derived Stats Menu |
| **`B` / `I`** | Inventory & Equipment Menu |
| **`K`** | Skill Tree Menu |
| **`O`** | Composing & Item Synthesis Station |
| **`Q`** | Quest Log |
| **`M`** | Dungeon Floor Teleport Menu |
| **`F5`** | Quick Save |
| **`Esc`** | Close Active Menu |

---

## Continuing with AI Agents (Claude, Gemini, Codex, Cursor, Multi-Agent Swarms)

This repository includes structured handoff files so any AI model or multi-agent team can pick up right where the last session left off without wasting context tokens:

1. **[`CLAUDE.md`](./CLAUDE.md)** — Automatic entry point for Claude Code / Claude Desktop.
2. **[`AGENTS.md`](./AGENTS.md)** — Economical context rules and multi-agent parallel ownership boundaries.
3. **[`SESSION.md`](./SESSION.md)** — Current verified snapshot, completed work, and next priorities.
4. **[`docs/CONTINUATION.md`](./docs/CONTINUATION.md)** — Module map, `gameContext` contract, and architectural invariants.
