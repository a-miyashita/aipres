# ADR-0003: HTML Subset for Slide Body Content

**Status**: Accepted
**Date**: 2026-03

## Context

The `body` field on `Slide` (and related fields `leftCol`, `rightCol`, `notes`) holds the textual content of a slide. The current implementation stores this as a Markdown string, rendered via `marked` at HTML generation time.

The project goal is Google Slides-level expressiveness delivered through natural language. A user must be able to say things like:

- "Make '70% increase' larger and red"
- "Center-align this paragraph"
- "Add a table comparing Q3 and Q4"

Markdown cannot express inline text size, color, or alignment. These capabilities require a richer content model.

The key constraints are:
1. **LLM reliability**: The LLM must generate the format consistently and correctly.
2. **Token efficiency**: The format appears in both LLM input (conversation history) and output (tool call arguments). Verbose formats compound costs over a long session.
3. **Expressiveness**: Must eventually cover all formatting capabilities of Google Slides.
4. **Safety**: Free HTML would allow injection of arbitrary scripts or styles.

## Decision

Replace Markdown with a **sanitized HTML subset** for content fields.

- `body` (and `leftCol`, `rightCol`, `notes`) remain `string` typed in the data model — no structural schema change.
- The content of these strings changes from Markdown to an HTML fragment conforming to the allowlist defined in `docs/rich-text-spec.md`.
- A sanitizer (`sanitize-html` library) enforces the allowlist on write, stripping any disallowed elements or attributes before storage.
- The LLM is instructed via the system prompt to write HTML subset, not Markdown.

## Alternatives Considered

**Keep Markdown, add custom inline syntax**
e.g., `[70% increase]{size=large, color=red}`

- Preserves the compact token footprint of Markdown.
- However, LLM output with custom syntax is unreliable. The LLM occasionally invents variations (`{large}`, `{size: large}`, `[[large]]`), requiring fragile parsing with fallback handling.
- The syntax would need to grow to cover all Google Slides features, becoming an undocumented sub-language that the LLM must learn from the system prompt alone.
- Rejected.

**Structured JSON AST (e.g., Slate.js / ProseMirror schema)**
```json
{"type":"paragraph","children":[
  {"text":"Revenue grew "},
  {"text":"47%","size":"large","color":"accent"}
]}
```
- Maximally structured; trivial to manipulate programmatically.
- Significantly more verbose than HTML. For a typical 3-sentence paragraph with one emphasized span, JSON AST uses ~3–4× more tokens than equivalent HTML.
- Conversation history accumulates over a session; the cost multiplies.
- LLMs generate HTML more reliably than custom JSON schemas (HTML is ubiquitous in training data).
- Rejected.

**Free HTML**
- Maximum expressiveness.
- Unacceptable: allows `<script>`, inline `style` with arbitrary CSS, `onclick` handlers. A malicious or hallucinated LLM response could inject executable code into the exported HTML file.
- Rejected.

**HTML subset (chosen)**
- LLMs are extensively trained on HTML and generate it reliably.
- Allowlist-based sanitization enforces safety without complex parsing.
- Token overhead vs Markdown is ~1.4× for typical slide content — acceptable.
- Extending expressiveness in the future means adding items to the allowlist, not redesigning the format.
- Maps directly to Reveal.js `<section>` inner content — no intermediate serialization.
- `data-*` attributes handle formatting that has no semantic HTML equivalent (text size, color, highlight).

## Consequences

- **Breaking change for `body` content**: Existing states using Markdown will need a legacy fallback path. Detection heuristic: if `body` contains no `<` characters, treat as Markdown (legacy); otherwise treat as HTML subset.
- **Dependency added**: `sanitize-html` (npm).
- **New file**: `src/renderer/sanitizer.ts` wrapping `sanitize-html` with the project allowlist.
- **System prompt updated**: LLM instructed to write HTML subset, with examples of correct usage.
- **Theme CSS updated**: `data-size`, `data-color`, `data-highlight`, `data-align` attributes need corresponding CSS rules in the default theme (and documented for custom themes).
- **Not yet implemented**: This ADR is accepted but implementation is pending. See `docs/rich-text-spec.md` for the full specification and implementation checklist.
