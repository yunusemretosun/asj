# CLAUDE.md — ARKENVEIL: SIGILS & JOURNEYS (`asj`)

This repository is configured for seamless cross-model and multi-agent continuation (Claude Code, Claude Desktop, Gemini/Antigravity, OpenAI Codex, Cursor).

## Startup Checklist for Claude

1. Read **`AGENTS.md`** for economical context rules and multi-agent ownership boundaries.
2. Read **`SESSION.md`** for the latest verified project state, recent changes, and next priorities.
3. Run `git status --short` and `git log -2 --oneline` to confirm working tree state.
4. Consult **`docs/CONTINUATION.md`** when you need the file map, shared `gameContext` interface, invariants, or build commands.

## Quick Commands (Windows / PowerShell & Bash)

```powershell
# Install dependencies (only if node_modules is missing)
npm.cmd install

# Start Vite development server (HMR)
npm.cmd run dev

# Verify production bundle (must pass with 0 errors before handoff)
npm.cmd run build
```

## Key Guardrails

- **Never read `src/data/extracted_data.json` in full** (12.5k lines); read targeted line ranges or search specific keys if needed.
- **Respect module boundaries:** `src/systems/*` is pure logic (no Three.js or DOM imports); `src/ui/*` communicates through the normalized host adapter in `src/ui/hud.js`; `src/main.js` owns the shared `gameContext`.
- **Before finishing your session:** Run `npm.cmd run build` and update **`SESSION.md`** in place so the next developer or AI model can continue immediately.
