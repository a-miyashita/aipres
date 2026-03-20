# ADR-0009: LLM-Assisted Theme Editing

**Status:** Accepted
**Date:** 2026-03-20

---

## Context

aipres currently supports themes as static CSS + `theme.json` bundles installed via `aipres theme add <path>`. There is no way to create or iterate on a theme from within the tool. Users who want a custom look must write CSS externally and manually install it.

The goal is to allow users to design and refine themes through natural language with the LLM, while previewing changes live in the browser.

Four approaches were evaluated.

---

## Options Considered

### A — Dedicated theme editing mode

`aipres theme edit <name>` launches a separate chat loop with a theme-specific system prompt, theme-specific LLM tools (`update_css`, `set_palette`, `set_base_theme`), and a preview server showing built-in sample slides rendered with the current theme. Chat history is kept in memory for the duration of the session but not persisted to disk.

### B — Add theme editing tools to the existing chat loop

Theme editing tools (`apply_theme`, `update_theme_css`, `set_palette`) are added to the existing slide editing tool set. Users can edit slides and theme in the same conversation.

### C — Slash commands only (no LLM editing)

`/theme list`, `/theme switch <name>`, `/theme new <name>` are added as slash commands inside the chat loop. Theme CSS editing is left to external editors. LLM is not involved in theme design.

### D — Theme as an independent session (with persistent chat history)

Same as A, but theme-specific chat history is persisted per theme (analogous to presentation sessions). Each `aipres theme edit <name>` resumes the previous conversation.

---

## Decision

**Option A**, with the clarification that chat history is **not** persisted to disk.

---

## Rationale

### Why mode switching (A) over tool addition (B)

Theme design and slide content are fundamentally different tasks. Theme design requires a specialized system prompt (CSS constructs, Reveal.js CSS variables, palette schema) and a different preview context (sample slides, not the user's presentation). Mixing the two in a single chat loop would bloat the system prompt and confuse the LLM about which kind of output is expected.

### Why not persistent chat history (A over D)

Theme editing conversations are naturally short and goal-directed: the user describes a look, the LLM generates CSS, the user refines it. Unlike presentations (which are built up over many sessions), a theme reaches a stable state quickly. Persisting history adds storage management overhead with minimal benefit. Within a single `aipres theme edit` session, in-memory history is sufficient to support "revert that last change"-style instructions.

### Why not slash commands only (A over C)

The primary value proposition is LLM-assisted design. Slash commands alone do not allow the LLM to generate or modify CSS, which is the core requirement.

### Sample slides as shared context

The preview server shows fixed built-in sample slides (covering all five layouts). These same slides are described textually in the LLM's system prompt. This ensures that when a user says "make the title larger" or "the bullet points on the second slide are too small", the LLM knows exactly which element and slide they are referring to.

---

## Consequences

**Positive:**
- Clean separation of concerns: theme editing has its own system prompt, tools, and preview
- No persistent state to manage for the chat history
- Preview gives immediate visual feedback on LLM-generated CSS

**Negative:**
- A second chat loop implementation is needed (`src/cli/theme-editor.ts`) — similar to `chat.ts` but cannot be fully reused due to different tools and model context
- "Where am I?" is a new concern: the user must know they are in theme editing mode, not presentation editing mode

---

## Alternatives Reconsidered

**Shared chat loop (B)** is left as a possible future enhancement — for example, a `/theme <instruction>` slash command could forward a natural language instruction to a lightweight theme editing call without entering full theme edit mode. This would not replace A but could complement it for quick one-off adjustments.
