# Rich Text Specification — `body` HTML Subset

**Status: DRAFT — not yet implemented**

This document defines the format that replaces Markdown in the `body`, `leftCol`, `rightCol`, and `notes` fields of the `Slide` model.

## Motivation

The current `body: string` field uses Markdown, which cannot express:

- Inline text size (`"make '70% increase' larger"`)
- Text color
- Text alignment per paragraph
- Tables with merged cells
- Arbitrary emphasis combinations

The goal is Google Slides-level inline formatting expressible through natural language requests to the LLM.

## Design Decisions

### HTML subset, not a custom AST

The LLM interface is an HTML-subset string. Rationale:

1. **LLMs are fluent in HTML.** Training data includes enormous amounts of HTML. Generation is reliable and token-efficient compared to a bespoke JSON AST.
2. **Existing tooling.** HTML parsers (`parse5`), sanitizers (`sanitize-html`), and renderers (browsers, Reveal.js) are battle-tested.
3. **Direct inlinability.** Reveal.js `<section>` content is HTML — no intermediate serialization step.
4. **Future-proof.** Adding new formatting capabilities means adding tags/attributes to the allowlist, not redesigning the schema.

### Storage format

`body` (and related fields) remain `string` in TypeScript and JSON. The string content is an HTML-subset fragment — **not a full document**, just the inner content of a slide's content area.

```json
{
  "body": "<p>YoY growth was <span data-size=\"large\"><strong>70% up</strong></span> this quarter.</p><ul><li>Strategy A</li><li>Strategy B</li></ul>"
}
```

This keeps the JSON schema stable (no type change) while upgrading content semantics.

### LLM interface = storage format

The LLM writes HTML subset directly into tool call arguments. The server sanitizes against the allowlist before storing. There is no intermediate "compact notation" that gets parsed into HTML — the LLM writes HTML directly.

Token cost analysis for typical slide body content (3–5 sentences + bullet list):
- Markdown: ~40–80 tokens
- HTML subset: ~55–110 tokens (≈1.4× overhead)

This overhead is acceptable given the expressiveness gained. Slide bodies are short; the cumulative cost over a 20-slide session is manageable.

---

## Allowed Elements

### Block Elements

| Element | Purpose | Allowed Attributes |
|---------|---------|-------------------|
| `<p>` | Paragraph | `data-align` |
| `<ul>` | Unordered list | — |
| `<ol>` | Ordered list | `type` (`1`, `a`, `A`, `i`, `I`) |
| `<li>` | List item | — |
| `<h3>` | Sub-heading (level 3) | — |
| `<h4>` | Sub-heading (level 4) | — |
| `<blockquote>` | Pull quote / callout | — |
| `<pre>` | Preformatted block | — |
| `<code>` | Code (inline or block) | `class` (for language hint, e.g. `language-python`) |
| `<table>` | Table | — |
| `<thead>`, `<tbody>`, `<tfoot>` | Table sections | — |
| `<tr>` | Table row | — |
| `<th>` | Header cell | `colspan`, `rowspan`, `data-align` |
| `<td>` | Data cell | `colspan`, `rowspan`, `data-align` |
| `<hr>` | Horizontal rule | — |
| `<br>` | Line break | — |

> **Note:** `<h1>` and `<h2>` are reserved for slide `title` fields and must not appear in `body`.

### Inline Elements

| Element | Purpose | Allowed Attributes |
|---------|---------|-------------------|
| `<strong>` / `<b>` | Bold | — |
| `<em>` / `<i>` | Italic | — |
| `<u>` | Underline | — |
| `<s>` / `<del>` | Strikethrough | — |
| `<code>` | Inline code | — |
| `<sup>` | Superscript | — |
| `<sub>` | Subscript | — |
| `<mark>` | Highlight (default yellow) | — |
| `<a>` | Link | `href` only (must be `http://`, `https://`, or `#`) |
| `<span>` | Generic inline container | See `data-*` attributes below |
| `<img>` | Inline image | `src`, `alt`, `width`, `height` |

---

## `data-*` Attributes on `<span>`

`<span>` is the primary mechanism for applying visual formatting that has no semantic HTML equivalent.

### `data-size`

Controls the font size of the enclosed text relative to the slide's base size.

| Value | Approximate size |
|-------|-----------------|
| `xs` | 0.6× base |
| `sm` | 0.8× base |
| `lg` | 1.3× base |
| `xl` | 1.6× base |
| `2xl` | 2× base |

Example:
```html
Revenue grew by <span data-size="xl"><strong>47%</strong></span> year-over-year.
```

### `data-color`

Sets the text color. Accepts:
- Named palette values (see below)
- Hex strings: `#rrggbb` or `#rgb`

Palette names (theme-aware — actual colors depend on the active theme):

| Name | Semantic meaning |
|------|-----------------|
| `accent` | Theme primary accent color |
| `muted` | Subdued / de-emphasized text |
| `danger` | Red / warning |
| `success` | Green / positive |
| `warning` | Amber / caution |
| `info` | Blue / informational |

Example:
```html
<span data-color="danger">Risk:</span> delivery may slip by 2 weeks.
```

### `data-highlight`

Background highlight color for the enclosed text. Accepts the same palette names as `data-color`, plus `#rrggbb` hex.

Example:
```html
Key finding: <span data-highlight="warning">margins are under pressure</span>.
```

### `data-weight`

| Value | Effect |
|-------|--------|
| `bold` | font-weight: bold (prefer `<strong>` when semantic) |
| `normal` | Resets inherited bold |

### `data-size` and `data-color` may be combined

```html
<span data-size="lg" data-color="accent">Main point</span>
```

---

## Paragraph Alignment — `data-align` on `<p>`, `<th>`, `<td>`

| Value | CSS equivalent |
|-------|----------------|
| `left` | text-align: left |
| `center` | text-align: center |
| `right` | text-align: right |
| `justify` | text-align: justify |

Example:
```html
<p data-align="center"><span data-size="2xl">$4.2B</span></p>
<p data-align="center">Total addressable market</p>
```

---

## Disallowed

The following are **always stripped** by the sanitizer, regardless of context:

- `<script>`, `<style>`, `<link>`, `<meta>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`
- `on*` event handler attributes (e.g. `onclick`, `onload`)
- `style` attribute (use `data-*` instead)
- `class` attribute (except `language-*` on `<code>`)
- `id` attribute
- `href` values starting with `javascript:` or `data:`

---

## System Prompt Instructions for LLM

The following guidance will be added to the system prompt to ensure reliable LLM output:

```
Content fields (body, leftCol, rightCol, notes) must be written as HTML fragments
using only the allowed subset defined in the rich-text spec. Do not use Markdown.
Do not use <h1> or <h2> in body — those are reserved for the slide title field.

For inline formatting:
- Use <strong> for bold, <em> for italic
- Use <span data-size="lg|xl|sm|xs"> to change font size
- Use <span data-color="accent|danger|success|..."> for text color
- Use <p data-align="center"> for centered paragraphs

Always write well-formed HTML. Self-closing tags (<br>, <hr>, <img>) must be
properly closed. Do not leave unclosed tags.
```

---

## Migration from Markdown

When this spec is implemented, the following migration strategy applies:

1. **New sessions**: LLM writes HTML subset from day one (system prompt updated).
2. **Existing `state/current.json`**: On load, detect content type:
   - If `body` contains `<` tags → treat as HTML subset (already migrated or manually written)
   - If `body` contains no `<` tags → treat as Markdown, render via `marked` (legacy path)
   - Legacy path remains in `templates.ts` until all states are migrated or user runs `aipres reset`
3. **Session history**: Tool call arguments in `session.json` may contain old Markdown body values. These are re-rendered at display time, so the legacy path handles them automatically.

---

## Implementation Checklist

When implementing this spec, the following files need changes:

- [ ] `src/model/types.ts` — Add JSDoc comment noting `body` is now HTML subset (no type change needed)
- [ ] `src/renderer/templates.ts` — Replace `marked.parse(slide.body)` with sanitized HTML passthrough + legacy Markdown fallback
- [ ] `src/llm/tools.ts` — Update `input_schema` descriptions for `body`, `leftCol`, `rightCol` in `add_slide` and `update_slide` tools
- [ ] `src/llm/tools.ts` — Update `buildSystemPrompt()` with HTML subset instructions
- [ ] Add dependency: `sanitize-html` (npm) for allowlist-based sanitization
- [ ] `src/renderer/sanitizer.ts` (new file) — Wrap `sanitize-html` with the allowlist defined in this spec
- [ ] `src/theme/defaults.ts` — Add CSS for `data-size`, `data-color`, `data-highlight`, `data-align` attributes
- [ ] Tests for sanitizer (strips disallowed tags/attrs, preserves allowed ones)
