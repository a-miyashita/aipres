# ADR-0005: Color System Design and Title Field Inline-Only Rule

**Status**: Accepted
**Date**: 2026-03

## Context

While specifying the HTML subset for slide content fields (see ADR-0003 and `docs/rich-text-spec.md`), two related design questions arose:

1. **How should named colors work?** The `data-color` attribute needs named values (e.g. `accent`, `danger`) that are theme-aware, but the mechanism for defining what those names resolve to was unspecified.

2. **Should hex color codes be allowed?** Allowing arbitrary `#rrggbb` values gives flexibility but risks color overuse — a known bad practice in business presentations.

3. **Should `title` and `subtitle` accept block-level HTML?** These fields map to `<h1>` / `<h2>` elements whose block structure is fixed by the layout template. Allowing block elements inside them would conflict with the template structure.

## Decisions

### 1. Fixed palette of six semantic color names

The color system uses a fixed set of six semantic names: `accent`, `muted`, `danger`, `success`, `warning`, `info`. These names are always available regardless of theme.

Each theme defines the concrete color values for these names in `theme.json` under a `palette` key:

```json
"palette": {
  "accent":  "#e94560",
  "muted":   "#888888",
  "danger":  "#cc0000",
  "success": "#008800",
  "warning": "#ff8800",
  "info":    "#0088cc"
}
```

The renderer generates CSS custom properties (`--color-palette-accent`, `--color-palette-muted`, etc.) from `theme.palette` at render time and injects them as a `<style>` block, so switching themes automatically updates all palette-colored text.

**Why a fixed set rather than theme-defined names?**
The LLM must know which color names are available without reading the current theme at prompt-construction time. A fixed set can be written statically into the system prompt. If themes could define arbitrary names, the system prompt would need to be dynamically rebuilt on every theme change, and the LLM's behavior would be less predictable.

### 2. Hex values allowed as a brand color exception only

The sanitizer accepts `data-color="#rrggbb"` values (they are not stripped). However, the LLM is instructed never to choose hex on its own judgment.

The LLM color selection policy (encoded in the system prompt) is:
1. If the user provides an explicit color code or brand color → use hex.
2. If the user describes intent ("red", "highlight the risk") → select the best palette name.
3. If the right palette name is ambiguous → ask the user.

**Why not ban hex entirely?**
Business presentations legitimately require exact brand colors (corporate identity guidelines specify hex values). Blocking hex would make the tool unusable for this common case.

**Why not allow hex freely?**
Over-coloring is a well-known bad practice in presentations. If the LLM can freely choose hex values, it tends to produce varied colors that clash with the theme and undermine visual consistency. Restricting hex to explicit user instructions keeps the LLM aligned with good design practice while still supporting the legitimate use case.

### 3. `title` and `subtitle` fields: inline elements only

`title` and `subtitle` map to fixed block elements (`<h1>`, `<h2>`, `<p>`) defined by the layout templates. Allowing block elements inside these fields would produce invalid nesting (e.g. `<h1><p>...</p></h1>`).

These fields accept the same inline elements as `body` (including `<span>` with `data-*` attributes), but block elements are forbidden and stripped by the sanitizer.

This means a user can still say "make the word 'urgent' red in the title" — it is handled with `<span data-color="danger">urgent</span>` inside the title string.

## Alternatives Considered

**Theme-defined palette names**
Themes could define any color names they choose (e.g. `"brand-primary"`, `"brand-secondary"`). Rejected because it makes the system prompt dynamic and LLM behavior unpredictable across theme changes.

**Palette names only, no hex**
Cleaner, but blocks legitimate brand color use cases. Rejected.

**Free hex (no restriction)**
Maximum flexibility. Rejected because it encourages color overuse and breaks theme consistency. The LLM tends to hallucinate "good-looking" colors that conflict with the theme.

**Allow block elements in `title`**
No clear benefit; produces invalid HTML nesting. Rejected.

## Consequences

- `ThemeDefinition` in `types.ts` gains an optional `palette` field (six keys). Themes without `palette` simply omit the CSS var injection.
- The default theme and all built-in Reveal.js themes ship with `palette` definitions.
- The renderer generates `:root` CSS custom properties from `theme.palette` before inlining the theme CSS.
- The system prompt grows slightly to include the palette name list and color selection policy.
- Hex support requires a JavaScript pass at render time to apply `data-color="#..."` as inline styles (CSS cannot read attribute values as color natively).
