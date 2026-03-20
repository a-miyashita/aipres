# ADR-0007: Inline `<svg>` as Generated Image Format

**Status:** Approved
**Date:** 2026-03-20

---

## Context

Users may want AI-generated visual content (diagrams, charts, icons) in slides. Two approaches were evaluated for how to store and render LLM-generated SVG:

1. **Inline `<svg>`** — The LLM writes SVG markup directly into a content field (`body`, `leftCol`, `rightCol`). The sanitizer allows `<svg>` and its child elements under a defined allowlist. The rendered HTML contains the SVG inline in the `<section>`.

2. **SVG as data URL in `<img>`** — A dedicated `embed_svg` tool accepts SVG markup from the LLM, base64-encodes it, and returns a `data:image/svg+xml;base64,...` URL. The LLM then places this URL in `imageUrl` or `<img src>`.

---

## Decision

Use inline `<svg>` embedded directly in content fields (`body`, `leftCol`, `rightCol`).

---

## Rationale

**Inline `<svg>` is better on every practical dimension relevant to this project:**

- **No separate tool required.** The LLM writes SVG markup directly into body content. The `embed_svg` tool (and the extra LLM round-trip it requires) is unnecessary.
- **JSON readability and editability.** SVG markup in `current.json` is human-readable and diff-friendly. A data URL blob is opaque — it cannot be inspected, edited, or processed by external tools without first decoding it.
- **Storage efficiency.** Base64 encoding adds ~33% overhead. Raw SVG markup is smaller.
- **Rendering fidelity.** Inline SVG has full access to the document's CSS (font-family, custom properties) and renders with better fidelity than sandboxed `<img>`.
- **Animation.** `<animate>` and `<animateTransform>` work in inline SVG. They do not execute inside `<img src="data:...">`.

The additional cost of inline `<svg>` is the sanitizer allowlist expansion. This is a one-time implementation cost and does not affect the ongoing developer or user experience.

**`imageUrl` scope:** The `image` layout's `imageUrl` field remains dedicated to raster images and external URLs. LLM-generated SVG is placed in content fields (`body` etc.) rather than `imageUrl`. For a full-slide SVG, the LLM uses the `blank` or `content` layout with the SVG in `body`.

---

## Consequences

**Positive:**
- LLM writes SVG directly — no `embed_svg` tool, no extra round-trip
- SVG is readable and editable in JSON with standard tools
- Animation via `<animate>` / `<animateTransform>` works
- CSS inheritance from the Reveal.js theme (fonts, custom properties)
- No base64 overhead

**Negative:**
- Sanitizer allowlist must cover SVG elements and attributes (significant expansion; see spec)
- No sandboxing — security relies on the allowlist being correct; `<script>` and `<foreignObject>` must be explicitly blocked
- Full-slide SVG requires using `blank` or `content` layout rather than the dedicated `image` layout (minor UX trade-off)

---

## Alternatives Considered

**SVG as data URL in `<img>` (initial design)**
The `embed_svg` tool converts SVG markup to a base64 data URL; the LLM places the data URL in `imageUrl` or `<img src>`. This avoids any sanitizer expansion and leverages the existing `<img>` pipeline.

Ruled out for three reasons:
1. Requires a dedicated tool and an extra LLM tool-use round-trip for every generated image.
2. The resulting JSON contains an opaque base64 blob — unreadable, not diff-friendly, requires decode before editing.
3. Animation and CSS inheritance do not work when SVG is loaded via `<img>`.
