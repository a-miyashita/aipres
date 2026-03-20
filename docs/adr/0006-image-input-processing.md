# ADR-0006: Image Input Processing via Path Detection and Multimodal Messages

**Status:** Approved
**Date:** 2026-03-20

---

## Context

Users want to add local image files to slides and, in some cases, have the LLM visually interpret an image to generate slide content. Three use cases must be addressed:

1. **Embed** — "この画像をスライドに入れて" — User wants an image placed into a slide.
2. **Interpret** — "このラフデザインをもとにスライドを作って" — User wants the LLM to read a sketch or mockup and generate slides accordingly.
3. **Mixed** — Both embedding and interpretation in a single message.

The two most natural ways to reference files in a CLI are:
- **Drag-and-drop** — Most terminal emulators paste the file path as plain text when a file is dragged onto the window.
- **`@path` syntax** — Explicit file reference, familiar from Claude Code and other CLI tools.

An early design considered text annotation only (appending `[Image resolved: /path]` to the message). This approach is sufficient for the **embed** use case — the LLM knows the path and can use it in tool calls. However, it is insufficient for **interpret**: the LLM cannot see the image and therefore cannot derive layout, content, or intent from it.

Passing image data as multimodal content blocks covers both use cases without requiring the caller to distinguish between them. The `AnthropicProvider` already casts `ContentBlock[]` as `Anthropic.ContentBlockParam[]` (see `anthropic.ts:55`), so multimodal messages are forwarded to the API without implementation changes in the provider.

---

## Decision

When image file path references are detected in a user message, do two things:

1. **Read the file** and construct an image content block (`type: "image"`, `source.type: "base64"`) containing the base64-encoded file data.
2. **Annotate the text** — append `[Image resolved: /abs/path (mime)]` to the message text so the LLM has a concrete path string for use in `imageUrl` or `<img src>` tool call arguments.

Send the message to the LLM as a `ContentBlock[]` array: image block(s) first, then the text block with the original message and annotations.

Image files are **not copied** to a cache directory. The original absolute path is used in annotations.

---

## Implementation

A new module `src/cli/image-resolver.ts` performs detection, file reading, and message construction.

Message structure when images are present:

```typescript
[
  { type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } },
  { type: 'text',  text: 'original message\n[Image resolved: /abs/path (image/png)]' },
]
```

The `ContentBlock` interface in `src/llm/provider.ts` gains a `source?` field to represent image blocks. `AnthropicProvider` requires no other changes.

Messages with no image references continue to be sent as plain strings (no change to existing behavior).

---

## Consequences

**Positive:**
- Works with any terminal that pastes file paths on D&D (the common case)
- LLM can visually interpret images (sketches, mockups, screenshots, charts)
- LLM also receives the resolved path, enabling reliable `imageUrl`/`<img>` tool call generation
- No special handling needed to distinguish "embed" from "interpret" — the LLM decides based on the user's instruction
- No file duplication; minimal storage impact beyond the in-memory base64 payload

**Negative:**
- Each image reference causes a file read and base64 encoding at message-send time; large images increase API payload size and token cost
- Files must exist at the time the message is sent (path is validated immediately)
- Does not support clipboard image data without a file path (no file path → no detection)

---

## Alternatives Considered

**Text annotation only (no multimodal)**
Sufficient for embedding, but the LLM cannot visually interpret images. Ruled out because it does not support the "rough design → slides" use case.

**Terminal-level multimodal input interception**
Would require aipres to receive binary image data directly from the terminal via escape sequences or a modified readline. Not supported by the standard readline API; platform-specific and fragile. This ADR avoids that complexity entirely — aipres reads the file itself after detecting the path.

**Copy files to `~/.aipres/images/` cache**
Unnecessary — the renderer already handles any absolute local path. Copying would waste storage and add complexity without benefit.

**Pre-flight LLM query to determine intent before sending image data**
Ask the LLM in a separate round-trip whether it needs to see the image data or only the path (e.g., "The user referenced an image. Do you need its contents, or is the file path sufficient?"), then send either a multimodal or text-only message based on the answer.

This avoids sending image data when the LLM only needs the path, but the costs outweigh the benefit:
- Every message containing an image reference incurs an extra API call and the associated latency and cost, even for simple embedding requests.
- The pre-flight response must be parsed deterministically; natural language answers are ambiguous, so a structured output or tool call would be needed, adding further complexity to the chat loop.
- Even for embedding use cases, having the LLM see the image is beneficial — it can make better layout and alt-text decisions. The marginal cost of including the image data is therefore worthwhile regardless of intent.

Ruled out in favour of always sending multimodal messages when images are detected.

**Require `@path` syntax only**
Worse UX for drag-and-drop users, who expect the pasted path to work. Supporting bare path detection costs little and covers the common case.
