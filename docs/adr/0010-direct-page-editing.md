# ADR-0010: Direct Page Editing in CLI — Not Implemented

**Status:** Accepted
**Date:** 2026-03-21

---

## Context

LLM round-trips for small, deterministic corrections (typo fixes, single bullet point deletions) generate measurable API cost and latency with no generative value. The question was whether to add a direct, LLM-free editing path to aipres.

The scope was defined as "all strings" — meaning both plain-text fields (`title`, `subtitle`, `notes`) and HTML-fragment fields with potential inline markup (`body`, `leftCol`, `rightCol`). A complete solution must handle both.

---

## Options Considered

### A — Plain-text slash command (inline CLI)

Slash commands operate on fields and `<li>` items by index. Values are plain text: HTML-escaped on input, tags stripped on display.

**Limitation:** Inline markup (e.g., `<strong>154%</strong>増加`) is permanently discarded on edit. The interface cannot express or preserve any rich text formatting, making it incomplete against the full scope.

### B — Raw HTML slash command (inline CLI, HTML-aware)

Same structure as A, but accepts raw HTML as input. Shows the current inner HTML before the prompt so the user can see what they are editing.

**Limitation:** Typing HTML in a readline prompt offers no cursor movement beyond the current line, no syntax highlighting, and no undo. Workable for trivial tag changes; substantially worse than the LLM workflow for anything complex.

### C — $EDITOR integration

`/edit <page> item <n>` writes the current inner HTML to a temp file, opens `$EDITOR`, and re-reads the file on exit. Same pattern as `git commit`, `crontab -e`.

**Limitation:** Every item edit requires an editor round-trip. Plain-text items suffer disproportionate friction. Two sub-interfaces (inline for text fields, $EDITOR for HTML items) add cognitive load without eliminating ambiguity.

### D — Browser editing panel in preview server

Adds an editing sidebar or inline `contenteditable` to the existing preview server. The browser POSTs changes to a new local endpoint; the server updates the model and broadcasts a hot-reload.

**Limitation:** Turns the preview server from a read-only render/broadcast pipeline into a bidirectional editing server. The UI surface (sidebar, form fields, contenteditable behaviour across browsers) requires significant front-end engineering. Cost-benefit is unfavourable.

### E — VSCode extension

A separate extension uses the aipres library (`src/model/`, `src/renderer/`, `src/llm/`) directly. Provides a Webview-based visual editor alongside the LLM chat flow.

---

## Decision

**None of the above will be implemented in this CLI.** Direct page editing is out of scope for aipres as a CLI tool.

---

## Rationale

### The slash command surface is insufficient

Options A–C all use the chat REPL's slash command interface. Evaluating them together reveals a fundamental mismatch: the readline prompt is the wrong editing surface for structured HTML content. Each option either loses information (A), degrades UX compared to the LLM (B), or adds two parallel interfaces with different friction profiles (C). Adding substantial complexity to the CLI without a commensurate improvement in user experience is not consistent with the tool's design philosophy.

### The manifesto's position was correct

The manifesto states: "The user should never need to directly edit a slide. Direct editing would undermine the core value: letting the LLM handle structure, layout, and formatting decisions while the user focuses on content and intent."

This was originally read as an aspiration that might be relaxed for micro-corrections. On deeper analysis, it holds. The problem with micro-corrections via the LLM is a cost and latency problem, not an interaction model problem. Solving it by degrading the interaction model — asking users to type HTML into a terminal or navigate a multi-level slash command tree — trades one friction for another.

### The right solution is a VSCode extension

The library structure (`src/model/`, `src/renderer/`) is cleanly separated from the CLI layer and already suitable for reuse. A VSCode extension can:

- Render the presentation in a Webview panel with live preview
- Provide click-to-edit fields with full keyboard editing and undo
- Integrate the LLM chat flow in a sidebar panel
- Eliminate the API round-trip for plain-text corrections without degrading the rich-text editing experience

This is the correct surface for fine-grained editing, and it does not require compromising the CLI's interaction model.

### Option D (browser panel) has unfavourable cost-benefit

The browser editing panel is architecturally appealing but requires non-trivial front-end engineering for a UI surface that lives inside the preview server. The preview server's current responsibility is deliberately narrow (render and broadcast). Expanding it into an editing surface changes that boundary significantly. The VSCode extension is the better investment if a visual editing surface is the goal.

---

## Consequences

- The aipres CLI interaction model remains conversation-only. The manifesto is upheld without qualification.
- Users who need fine-grained direct editing should use the LLM (accepting the current cost/latency) until a VSCode extension is available.
- A future VSCode extension using the aipres library is the recommended path for rich direct editing. The library's module boundaries (`src/model/`, `src/renderer/`) should be maintained as clean, CLI-independent interfaces to facilitate this.
- The cost/latency problem for micro-corrections may be partially addressed by improving LLM prompt efficiency or model selection, independent of this decision.
