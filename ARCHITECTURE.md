---
tags: [architecture, JavaScript_Working_Flow]
---

## 1. Stack
- Vanilla JavaScript, HTML5, CSS3 — no frameworks (README.md: "Technologies").
- No build tools, no dependencies, no package manager (README.md: "No build tools or dependencies required").
- No manifest file present at repo root or one level down (checked for package.json / go.mod / pyproject.toml / Cargo.toml — none found).

## 2. Directory map

| Path | What lives there |
|---|---|
| index.html | Page layout: control bar, examples bar, editor panel, all visualization panels, script includes |
| style.css | Styling for all panels and animations |
| README.md | Project overview, features, usage, structure |
| js/ | All JavaScript modules |
| js/stack.js | Call Stack data structure |
| js/queue.js | Queue data structure (callback queue + microtask queue) |
| js/engine.js | JavaScript engine simulation logic |
| js/ui.js | DOM manipulation and rendering |
| js/main.js | App initialization and event wiring |

## 3. Diagram

```mermaid
flowchart TD
  index.html --> style.css
  index.html --> stack.js
  index.html --> queue.js
  index.html --> engine.js
  index.html --> ui.js
  index.html --> main.js
  stack.js --> engine.js
  queue.js --> engine.js
  engine.js --> main.js
  ui.js --> main.js
```

## 4. Component index
- [[index.html]]
- [[style.css]]
- [[stack.js]]
- [[queue.js]]
- [[engine.js]]
- [[ui.js]]
- [[main.js]]

## 5. Entry points
- Dev: open `index.html` directly in a browser — no dev server (README.md: "How to Use" → "Open index.html in a web browser").
- Prod: same static file, no build/deploy step observed — `REPO_ROOT/index.html`.
- Script load order (index.html lines 173-177): `js/stack.js` → `js/queue.js` → `js/engine.js` → `js/ui.js` → `js/main.js`.

## 6. Conventions (observed only)
- Plain `<script src="js/...">` tags in `index.html`, no bundler or module system observed.
- JS filenames are lowercase, single-word, responsibility-named: `stack.js`, `queue.js`, `engine.js`, `ui.js`, `main.js` (README.md project-structure block).
- One global stylesheet `style.css`, linked once in `<head>` (index.html line 7).
- DOM element ids use kebab-case: `btn-run`, `call-stack`, `event-loop`, `microtask-queue`, `callback-queue` (index.html).
- Buttons/panels follow class conventions `btn btn-*` and `panel *-panel` (index.html).
- Example buttons carry a `data-example` attribute (`sync`, `async-timeout`, `promise`, `async-await`, `mixed`) (index.html lines 39-43).
- Error handling: TODO: verify — not observable from index.html/README.md alone.

## 7. Where things go
- Add a built-in code example: add a button with `data-example="<name>"` in `index.html` (examples-bar) + wire its source in `js/main.js`.
- Add/change a visualization panel: add `.panel` markup in `index.html` + styling in `style.css` + render/update logic in `js/ui.js`.
- Add a new runtime data structure: new `js/<name>.js` (or extend `js/queue.js`) + include `<script>` tag in `index.html` + integrate into `js/engine.js`.
- Change event-loop / simulation behavior: `js/engine.js` (uses `js/stack.js` and `js/queue.js`).
- Change controls (Run/Pause/Step/Reset/Speed): `.controls-bar` markup in `index.html` + event wiring in `js/main.js` + styling in `style.css`.
