# Rich Text Specification — `body` HTML Subset

**Status: Implemented** (v0.2)

This document defines the format that replaces Markdown in the `body`, `leftCol`, `rightCol`, `notes`, `title`, and `subtitle` fields of the `Slide` model.

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

All text fields remain `string` in TypeScript and JSON. The string content is an HTML-subset fragment — **not a full document**, just the inner content of the relevant element.

```json
{
  "title": "YoY growth: <span data-size=\"lg\" data-color=\"accent\">+47%</span>",
  "body": "<p>Revenue grew consistently across all regions.</p><ul><li>APAC: +62%</li><li>EMEA: +41%</li></ul>"
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

## Field Rules

### `body`, `leftCol`, `rightCol`, `notes`

Both block and inline elements are allowed (see full lists below).

### `title`, `subtitle`

**Inline elements only.** Block elements (`<p>`, `<ul>`, `<h3>`, etc.) are forbidden. These fields map to `<h1>` / `<h2>` / `<p>` elements whose block structure is fixed by the layout template.

```html
<!-- ✅ valid title -->
"title": "Revenue: <span data-size=\"lg\" data-color=\"accent\">$4.2B</span>"

<!-- ❌ invalid — block element in title -->
"title": "<p>Revenue</p>"
```

---

## Allowed Elements

### Block Elements (body / leftCol / rightCol / notes only)

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
| `<table>` | Table | — |
| `<thead>`, `<tbody>`, `<tfoot>` | Table sections | — |
| `<tr>` | Table row | — |
| `<th>` | Header cell | `colspan`, `rowspan`, `data-align` |
| `<td>` | Data cell | `colspan`, `rowspan`, `data-align` |
| `<hr>` | Horizontal rule | — |
| `<svg>` | Inline SVG graphic | See [SVG Allowlist](#svg-allowlist) below |

> **Note:** `<h1>` and `<h2>` are reserved for slide layout templates and must not appear in any content field.

### Inline Elements (all fields)

| Element | Purpose | Allowed Attributes |
|---------|---------|-------------------|
| `<strong>` / `<b>` | Bold | — |
| `<em>` / `<i>` | Italic | — |
| `<u>` | Underline | — |
| `<s>` / `<del>` | Strikethrough | — |
| `<code>` | Inline code | `class` (`language-*`) |
| `<sup>` | Superscript | — |
| `<sub>` | Subscript | — |
| `<mark>` | Highlight (default yellow) | — |
| `<a>` | Link | `href` only (`http://`, `https://`, or `#`) |
| `<span>` | Formatting container | See `data-*` attributes below |
| `<img>` | Image | `src`, `alt`, `width`, `height` |
| `<br>` | Line break | — |

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

Sets the text color.

**Preferred: named palette colors** (theme-aware — resolves to CSS custom properties defined by the active theme):

| Name | Semantic meaning |
|------|-----------------|
| `accent` | Theme primary accent color |
| `muted` | Subdued / de-emphasized text |
| `danger` | Red / warning |
| `success` | Green / positive |
| `warning` | Amber / caution |
| `info` | Blue / informational |

**Exception: hex values** (`#rrggbb` or `#rgb`) are accepted by the sanitizer but the LLM must only use them when the user explicitly specifies a brand color or exact color code. See [LLM Color Selection Policy](#llm-color-selection-policy) below.

Example:
```html
<span data-color="danger">Risk:</span> delivery may slip by 2 weeks.
```

### `data-highlight`

Background highlight color for the enclosed text. Accepts the same palette names as `data-color`, and hex values under the same restriction.

Example:
```html
Key finding: <span data-highlight="warning">margins are under pressure</span>.
```

### `data-weight`

| Value | Effect |
|-------|--------|
| `bold` | font-weight: bold (prefer `<strong>` when semantic) |
| `normal` | Resets inherited bold |

### Attributes may be combined

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

## Color Palette and Themes

Each theme defines the concrete color values for the six palette names in `theme.json`:

```json
{
  "name": "corporate",
  "baseTheme": "white",
  "palette": {
    "accent":  "#0066cc",
    "muted":   "#888888",
    "danger":  "#cc0000",
    "success": "#008800",
    "warning": "#ff8800",
    "info":    "#0088cc"
  }
}
```

The renderer outputs these as CSS custom properties on `:root`, and the theme CSS (or default CSS) maps `data-color` / `data-highlight` to those properties:

```css
:root {
  --color-accent:  #0066cc;
  --color-muted:   #888888;
  --color-danger:  #cc0000;
  --color-success: #008800;
  --color-warning: #ff8800;
  --color-info:    #0088cc;
}
[data-color="accent"]       { color: var(--color-accent); }
[data-color="muted"]        { color: var(--color-muted); }
[data-color="danger"]       { color: var(--color-danger); }
[data-color="success"]      { color: var(--color-success); }
[data-color="warning"]      { color: var(--color-warning); }
[data-color="info"]         { color: var(--color-info); }
[data-highlight="accent"]   { background-color: var(--color-accent); }
/* ... etc */
[data-color^="#"]           { color: attr(data-color); } /* hex fallback — see note */
```

> **Note on hex rendering:** CSS does not natively support `color: attr(data-color)`. Hex values will require a small JavaScript pass at render time (or a PostCSS plugin) to convert `data-color="#ff6b35"` into inline styles. Implementation details are deferred.

---

## LLM Color Selection Policy

The system prompt instructs the LLM to follow this decision tree when applying color:

1. **Does the user specify an exact color code (e.g. "#003087", "Pantone 286")?**
   → Use `data-color="#003087"` (hex). This is the brand color exception.

2. **Does the user describe a color by intent (e.g. "red", "highlight the risk", "emphasize")?**
   → Select the best-matching palette name (`danger` for red/risk, `accent` for general emphasis, etc.), taking the active theme into account.

3. **Is the right palette color ambiguous?**
   → Ask the user: *"Should I use the theme's accent color, or did you have a specific color in mind?"*

**The LLM must never choose a hex color on its own judgment.** Using hex without an explicit user instruction undermines theme consistency and risks color overuse.

---

## SVG Allowlist

`<svg>` is a block element permitted in `body`, `leftCol`, `rightCol`, and `notes`. It is **not** permitted in `title` or `subtitle`.

### Allowed SVG Elements

| Element | Purpose |
|---------|---------|
| `<svg>` | Root element |
| `<g>` | Group |
| `<defs>` | Reusable definitions |
| `<symbol>` | Reusable symbol |
| `<use>` | Reference to `<symbol>` or other element |
| `<path>` | Arbitrary path |
| `<rect>` | Rectangle |
| `<circle>` | Circle |
| `<ellipse>` | Ellipse |
| `<line>` | Line segment |
| `<polyline>` | Open polygon |
| `<polygon>` | Closed polygon |
| `<text>` | SVG text |
| `<tspan>` | Text span within `<text>` |
| `<linearGradient>` | Linear gradient definition |
| `<radialGradient>` | Radial gradient definition |
| `<stop>` | Gradient stop |
| `<clipPath>` | Clipping path definition |
| `<mask>` | Mask definition |
| `<image>` | Embedded image (see src rules below) |
| `<animate>` | Property animation |
| `<animateTransform>` | Transform animation |
| `<animateMotion>` | Motion path animation |

**Always stripped inside SVG:** `<script>`, `<foreignObject>`, `on*` event handler attributes.

### Allowed SVG Attributes

**Structural / root:**
`xmlns`, `xmlns:xlink`, `viewBox`, `preserveAspectRatio`, `width`, `height`, `x`, `y`

**Shape geometry:**
`d`, `cx`, `cy`, `r`, `rx`, `ry`, `x1`, `y1`, `x2`, `y2`, `points`

**Presentation:**
`fill`, `fill-opacity`, `fill-rule`, `stroke`, `stroke-width`, `stroke-dasharray`, `stroke-dashoffset`, `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`, `stroke-opacity`, `opacity`, `color`

**Text:**
`text-anchor`, `dominant-baseline`, `font-family`, `font-size`, `font-weight`, `font-style`, `letter-spacing`, `word-spacing`

**Transform and layout:**
`transform`, `clip-path`, `mask`, `clip-rule`

**Reference and identity:**
`id` *(allowed within SVG elements for `<use>` references, despite the global `id` ban)*, `href`, `xlink:href`

**Gradient:**
`gradientUnits`, `gradientTransform`, `spreadMethod`, `offset`, `stop-color`, `stop-opacity`, `fx`, `fy`

**Clip / mask:**
`clipPathUnits`

**Animation:**
`attributeName`, `from`, `to`, `by`, `dur`, `repeatCount`, `values`, `keyTimes`, `keySplines`, `calcMode`, `additive`, `accumulate`, `begin`, `end`, `type`, `path`

### `<image>` `href` Rules (within SVG)

Same rules as `<img src>` in the HTML subset:
- `http://` / `https://` — passed through
- Local file paths — converted to base64 data URL
- `data:` — passed through

### LLM Instructions for SVG

- Write SVG directly into content fields (`body`, `leftCol`, `rightCol`) — no separate tool is needed
- Always include `xmlns="http://www.w3.org/2000/svg"`, `viewBox`, `width`, and `height` on the root `<svg>` element
- Use `width="100%"` for full-width SVGs within a slide; specify explicit pixel dimensions for icons and decorative elements
- Keep generated SVGs legible at slide size — avoid dense detail that shrinks to illegibility
- For a full-slide SVG, use the `blank` or `content` layout and place the SVG in `body`
- The `image` layout's `imageUrl` is for raster images and external URLs only; do not place SVG markup in `imageUrl`

---

## Image Handling

The `src` attribute of `<img>` within content fields follows these rules:

- **HTTP/HTTPS URLs**: passed through as-is.
- **Local file paths** (absolute or relative): the sanitizer resolves the path and converts the image to a base64 data URL (`data:image/png;base64,...`) before storing, so the exported HTML remains self-contained.
- **Paths that cannot be resolved** (file not found, permission denied): the `src` is replaced with an empty string and a warning is logged; the `alt` text is preserved.

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

The following guidance will be added to the system prompt:

```
Content fields (body, leftCol, rightCol, notes) must be written as HTML fragments
using only the allowed element subset. Do not use Markdown.

The title and subtitle fields also accept inline HTML elements only —
no block elements (<p>, <ul>, etc.).

Do not use <h1> or <h2> anywhere in content fields.

For inline formatting:
- Bold: <strong>, italic: <em>
- Font size: <span data-size="xs|sm|lg|xl|2xl">
- Text color: <span data-color="PALETTE_NAME"> using palette names below
- Highlight: <span data-highlight="PALETTE_NAME">
- Alignment: <p data-align="left|center|right|justify">

Available palette colors: accent, muted, danger, success, warning, info
Choose the palette name that best matches the user's intent and the active theme.
Only use a hex value (data-color="#rrggbb") when the user explicitly provides
a specific brand color or color code. Never choose hex on your own.
If the right color is unclear, ask the user.

Always write well-formed HTML. Void elements (<br>, <hr>, <img>) must be
self-closed. Do not leave unclosed tags.
```

---

## Legacy Markdown Fallback

Existing `slides.json` files may contain Markdown in content fields (from versions prior to the HTML subset). At render time, fields are detected by content type:

- Value contains `<` → treated as HTML subset, sanitized via allowlist
- Value contains no `<` → treated as legacy Markdown, rendered via `marked`

This detection is transparent and requires no user action.
