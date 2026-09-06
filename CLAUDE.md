# CLAUDE.md

## Build / test / lint
- None found — no package.json (or go.mod/pyproject.toml/Cargo.toml) at repo root.
- Run by opening `index.html` directly in a browser (README.md: "How to Use").

## Rules
- No build tools or dependencies (README.md: "No build tools or dependencies required") — keep it vanilla HTML/CSS/JS, do not add a bundler or framework.
- Scripts are loaded as plain `<script>` tags in a fixed order in `index.html` (stack.js, queue.js, engine.js, ui.js, main.js) — preserve this order if adding/reordering scripts.

## Read first
1. README.md — project overview, features, structure
2. index.html — page structure, panel/element ids, script load order
3. js/main.js — app initialization and event wiring

Architecture: see ARCHITECTURE.md — read before structural changes
