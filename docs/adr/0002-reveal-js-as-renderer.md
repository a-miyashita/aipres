# ADR-0002: Reveal.js as the Presentation Renderer

**Status**: Accepted
**Date**: 2026-03

## Context

aipres generates presentation output. We need to choose the target format and rendering engine. The output must be shareable, visually polished, and self-contained (no server required to view).

## Decision

Use Reveal.js as the rendering engine. Output is a single self-contained HTML file with all assets (Reveal.js JS/CSS, theme CSS, images as base64) inlined.

## Alternatives Considered

**PPTX (PowerPoint format)**
- Universally accepted in business contexts.
- Libraries like `pptxgenjs` allow programmatic generation.
- However, PPTX is a binary/ZIP format with a complex schema. Mapping a structured slide model to PPTX layout fidelity reliably is difficult.
- No live preview in the browser; requires PowerPoint or LibreOffice to view.
- Rejected as primary format (could be a future export target).

**PDF**
- Good for static distribution.
- No interactivity (no speaker notes view, no transitions, no live reload during editing).
- Rejected as primary format.

**Reveal.js (chosen)**
- HTML/CSS/JS — fully controllable by code, no binary format parsing.
- Excellent in-browser presentation experience: keyboard navigation, speaker notes, transitions, fullscreen, PDF export built-in.
- Self-contained single-file output: the entire presentation is one `.html` file that opens in any browser.
- Theming via CSS — straightforward to customize.
- The `<section>` tag structure maps cleanly to a slide data model.
- Hot reload via WebSocket injection is trivial to implement.
- Open source, well-maintained, npm-installable (no CDN dependency).

**Impress.js / other HTML presentation frameworks**
- Less polished ecosystem than Reveal.js.
- Reveal.js has become the de facto standard for code/technical presentations and is widely recognized.
- Rejected in favor of Reveal.js.

## Consequences

- Output format is HTML only (for now). Export to PPTX or PDF is a potential future feature.
- Theme system must produce CSS compatible with Reveal.js's structure and base themes.
- The `revealOptions` field on `SlideModel` passes arbitrary config directly to `Reveal.initialize()`, giving users access to the full Reveal.js API through natural language requests.
- Inlining assets makes the file self-contained but large for image-heavy presentations. This is an acceptable trade-off for shareability.
