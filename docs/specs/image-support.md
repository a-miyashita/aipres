# Image Support Specification

## Overview

Enable images in slides via two mechanisms:

1. **Specified images** — User provides an existing image file (by path reference)
2. **Generated images** — LLM generates SVG markup written directly into content fields

Both mechanisms also support a third use case: **visual interpretation** — the LLM sees the image content and uses it as input to compose slide content, without necessarily embedding the image itself.

---

## 1. Specified Images

### 1.1 Input Detection

The chat loop (`src/cli/chat.ts`) scans incoming user messages for image file references **before** sending to the LLM.

Two syntaxes are supported:

**Pattern A: `@path` reference (explicit)**

```
@./screenshots/chart.png
@/absolute/path/to/logo.svg
```

The `@` prefix makes intent unambiguous. Recommended when the user deliberately wants to reference a file.

**Pattern B: Bare file path (drag-and-drop)**

```
/Users/alice/Downloads/diagram.png
./assets/photo.jpg
```

Most terminal emulators paste the file path as text when a file is dragged onto the terminal window. aipres detects these automatically based on file extension.

**Supported extensions:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`

Detection rules:
- Path must resolve to an existing, readable file
- Relative paths are resolved against the current working directory
- Bare paths must appear as a token (surrounded by whitespace or at message boundaries) to avoid false positives

### 1.2 Multimodal Message Construction

When image file references are detected, the message sent to the LLM is constructed as a `ContentBlock[]` array containing both the image data and the original text:

```
[image block: base64-encoded file contents]
[text block:  original message text + path annotation]
```

Example — user types `"このグラフをスライドに追加して @./charts/q4.png"`:

```typescript
content: [
  {
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: '<base64-encoded file contents>',
    },
  },
  {
    type: 'text',
    text: 'このグラフをスライドに追加して @./charts/q4.png\n[Image resolved: /home/alice/project/charts/q4.png (image/png)]',
  },
]
```

**Why both image block and path annotation?**

- The **image block** enables the LLM to visually see the content, which is essential for interpretation use cases ("このラフデザインをもとにスライドを作って") and helps with embedding decisions.
- The **path annotation** in the text block gives the LLM a concrete path string to use in `imageUrl` or `<img src>` within tool call arguments. The LLM cannot reproduce the raw base64 string, so it needs the path reference.

When multiple images are referenced in a single message, one image block is prepended per image, followed by a single text block containing all annotations.

Messages with no image references continue to be sent as plain strings (unchanged behavior).

### 1.3 Embedding Targets

Images can be placed in two ways:

**A. `imageUrl` field** (dedicated image layout — raster and external URLs only)

Use the `image` slide layout with `imageUrl` set to the resolved absolute path. The renderer converts local paths to base64 data URLs automatically.

```json
{
  "layout": "image",
  "title": "Q4 Results",
  "imageUrl": "/home/alice/project/charts/q4.png"
}
```

**B. Inline `<img>` in content fields** (within body text)

An `<img>` tag within `body`, `leftCol`, or `rightCol` is permitted by the HTML subset spec. The same base64 conversion applies.

```html
<p>以下のグラフを参照：</p>
<img src="/home/alice/project/charts/q4.png" alt="Q4 Revenue Chart" width="600">
```

### 1.4 Visual Interpretation (No Embedding)

The multimodal approach also enables cases where the image is used as **input** rather than embedded content:

- "このラフデザインをもとにスライドを作って" → LLM reads the sketch and generates slides matching the layout intent. The original image is not embedded.
- "このスクリーンショットの内容を整理してプレゼンにして" → LLM reads text from a screenshot and structures it as slide content.

No special handling is needed; the same multimodal message construction covers all cases. The LLM decides whether to embed or interpret based on the user's instruction.

### 1.5 LLM Instructions (System Prompt)

The system prompt must explain to the LLM:
- The meaning of `[Image resolved: <path> (<mime>)]` annotations
- When to embed the image (use the path in `imageUrl` or `<img>`) vs. use it as interpretation input only
- Layout selection: `image` layout (`imageUrl`) for full-slide raster/external images; inline `<img>` in `body` for raster images that accompany text; inline `<svg>` in `body` for generated vector content

---

## 2. Generated Images (SVG)

### 2.1 Inline SVG in Content Fields

The LLM writes SVG markup directly into `body`, `leftCol`, or `rightCol` as a block element. No separate tool or conversion step is required.

**Use cases:**
- Simple diagrams (flowcharts, org charts, process flows)
- Bar/pie charts and basic data visualizations
- Icons and decorative shapes
- Infographic elements
- Slide decorations and backgrounds

**Example:**

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">
  <rect x="10" y="10" width="380" height="180" rx="8" fill="#e8f0fe" stroke="#4285f4" stroke-width="2"/>
  <text x="200" y="105" text-anchor="middle" font-size="24" font-weight="bold" fill="#1a73e8">aipres</text>
</svg>
```

### 2.2 Full-Slide SVG

For a slide whose primary content is a generated SVG, the LLM uses the `blank` or `content` layout with the SVG in `body`. The `image` layout's `imageUrl` field is reserved for raster and external URL images.

```json
{
  "layout": "blank",
  "body": "<svg xmlns=\"...\" viewBox=\"0 0 800 600\" width=\"100%\" height=\"100%\">...</svg>",
  "notes": "Diagram showing the system architecture."
}
```

### 2.3 Raster Image Generation (Out of Scope)

PNG and other raster formats require an external image generation API. Deferred and out of scope for the current version. The architecture must not preclude future extension.

---

## 3. Data Model

**No changes to `Slide` or `SlideModel` are required.**

`imageUrl` remains a URL-only field (http/https, local path, or `data:` URL). SVG generated by the LLM goes in content fields, not `imageUrl`.

### `imageUrl` URL handling

| URL type | Handling |
|----------|----------|
| `http://`, `https://` | Pass through |
| `data:` | Pass through |
| Local file path | Convert to base64 data URL (existing behavior) |
| Invalid/missing | Fallback to `src=""` with warning (existing behavior) |

---

## 4. Type Changes: `src/llm/provider.ts`

`ContentBlock` must be extended to represent image source blocks:

```typescript
export interface ContentBlock {
  type: string;
  text?: string;
  source?: {            // new: for image blocks
    type: string;       // "base64"
    media_type: string; // e.g. "image/png"
    data: string;       // base64-encoded file contents
  };
  id?: string;
  name?: string;
  input?: unknown;
}
```

`AnthropicProvider` already casts `ContentBlock[]` as `Anthropic.ContentBlockParam[]` (line 55 of `anthropic.ts`), so no changes to the provider implementation are required.

---

## 5. New Module: `src/cli/image-resolver.ts`

```typescript
interface ImageRef {
  syntax: '@path' | 'bare';
  raw: string;      // text as found in message
  path: string;     // resolved absolute path
  mimeType: string; // e.g. "image/png"
  data: string;     // base64-encoded file contents
}

// Detect and resolve all image references in a message string
async function resolveImageRefs(text: string, cwd: string): Promise<ImageRef[]>

// Build ContentBlock[]:
//   [image block per ref, ..., text block with original text + annotations]
function buildMultimodalMessage(original: string, refs: ImageRef[]): ContentBlock[]
```

---

## 6. HTML Subset Changes

`<svg>` is added as a block element in `body`, `leftCol`, and `rightCol`. See `docs/specs/rich-text.md` for the full SVG allowlist.

---

## 7. Renderer Changes

### `src/renderer/sanitizer.ts`

- Add `<svg>` and SVG child elements to the sanitizer allowlist (see rich-text spec)
- Confirm `data:` URLs in `<img src>` are already allowed; add passthrough if missing

### `src/renderer/templates.ts`

- Confirm `imageUrl` with `data:` scheme passes through without re-encoding

---

## 8. Summary of Changes

| Area | Change |
|------|--------|
| `src/llm/provider.ts` | Add `source?` field to `ContentBlock` for image blocks |
| `src/cli/image-resolver.ts` | New module: path detection, resolution, multimodal message builder |
| `src/cli/chat.ts` | Build `ContentBlock[]` message when images are detected |
| `src/llm/tools.ts` | Add image and SVG usage instructions to system prompt |
| `src/renderer/sanitizer.ts` | Add SVG element/attribute allowlist; confirm `data:` passthrough |
| `src/renderer/templates.ts` | Confirm `data:` URL passthrough in `imageUrl` rendering |
| `docs/specs/rich-text.md` | Add `<svg>` block element and SVG allowlist |
