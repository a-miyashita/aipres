# aipres — Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User (Terminal)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ natural language
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     CLI Layer  (bin/aipres.ts)               │
│   aipres           aipres chat      aipres preview           │
│   (start.ts)       (chat.ts)        (preview.ts)            │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌─────────────┐ ┌───────────────┐
    │  LLM Layer   │ │ Model Layer │ │ Preview Layer │
    │  (src/llm/)  │ │ (src/model/)│ │ (src/preview/)│
    └──────┬───────┘ └──────┬──────┘ └───────┬───────┘
           │  tool calls    │ state           │ WebSocket
           │  ─────────────▶│                 │ broadcast
           │                │ JSON file       │
           │         ┌──────▼──────┐          │
           │         │ ~/.aipres/  │          │
           │         │ state/      │──────────┘
           │         │ current.json│  (chokidar watch)
           │         └─────────────┘
           │
    ┌──────▼───────────────────────────────────────────┐
    │               Renderer  (src/renderer/)           │
    │   SlideModel → section HTML → full Reveal.js page │
    └──────────────────────────────────────────────────┘
```

## Module Map

### `bin/aipres.ts`
Commander.js entry point. Defines all CLI commands and wires them to `src/cli/*` handlers. Uses `parseAsync()` so async action handlers are properly awaited.

### `src/cli/`

| File | Command | Responsibility |
|------|---------|----------------|
| `start.ts` | `aipres` | Starts preview server + file watcher + chat loop. Shuts down server/watcher when chat exits. |
| `chat.ts` | `aipres chat` | Interactive REPL. Loads session history, runs the LLM tool-use loop, saves state/session after each turn. Handles slash commands. |
| `preview.ts` | `aipres preview` | Preview-only server with SIGINT handler for graceful shutdown. |
| `export.ts` | `aipres export` | One-shot HTML render to file. |
| `config.ts` | `aipres config *` | Config CRUD via dot-notation keys. |
| `theme.ts` | `aipres theme *` | Theme listing and import. |
| `reset.ts` | `aipres reset` | Clears slide state with confirmation. |

### `src/llm/`

**`provider.ts`** — Abstract interfaces: `LLMProvider`, `Message`, `Tool`, `LLMResponse`, `ContentBlock`, `ToolUse`.

**`anthropic.ts`** — `AnthropicProvider` implementation:
- Uses `client.messages.stream()` for streaming responses
- Parses both `text_delta` and `input_json_delta` events in the same `for await` loop
- Retry logic: 3 attempts, exponential backoff (1s, 2s)
- Writes streamed text directly to `process.stdout` for real-time display

**`tools.ts`** — Tool definitions and system prompt:
- Exports `TOOLS: Tool[]` (7 tools, see below)
- `buildSystemPrompt(language)` returns a localized system prompt that includes the slide model structure, tool documentation, and formatting rules
- Supports 11 locale codes (BCP 47)

**`dispatcher.ts`** — Tool-use loop:
```
provider.chat() → response with tool_uses
  → for each tool_use: dispatchTool() → Result<SlideModel>
  → format tool_results
  → provider.chat() again with tool_results
  → repeat until response.toolUses.length === 0
```

### `src/model/`

**`types.ts`** — Core types and Zod schemas:
- `SlideModel`, `Slide`, `SlideLayout`, `RevealOptions`
- `Config`, `ResolvedConfig`, `ThemeDefinition`
- `Result<T>` — discriminated union for operation results

**`operations.ts`** — Pure, immutable slide mutations. All return `Result<SlideModel>`:
- `addSlide`, `updateSlide`, `deleteSlide`, `reorderSlides`, `setTheme`, `setRevealOption`

**`state.ts`** — Persistence layer:
- Slide state: `~/.aipres/state/current.json`
- Session history: `~/.aipres/state/session.json`
- All writes use atomic rename (`.tmp` → final path) for crash safety

### `src/renderer/`

**`html.ts`** — Assembles the final HTML document:
1. Load theme JSON + CSS from `~/.aipres/themes/<name>/`
2. Load Reveal.js JS and CSS from `node_modules/reveal.js`
3. Render each slide via `templates.ts`
4. Inline everything into a single self-contained HTML file
5. Optionally inject WebSocket hot-reload script

**`templates.ts`** — Per-layout HTML renderers. Currently uses `marked` to convert `body` (Markdown string) to HTML. **This is the layer that will change when the rich-text migration is complete.**

**`assets.ts`** — Reads Reveal.js bundles from `node_modules`, handles image base64 encoding.

### `src/config/`

**`config.ts`** — Three-level merge: defaults ← `~/.aipres/config.json` ← env vars (`PRESO_MODEL`, `PRESO_LANGUAGE`, `ANTHROPIC_API_KEY`).

**`keychain.ts`** — API key stored separately in `~/.aipres/credentials.json` (mode 0600). Provides `getApiKey` / `setApiKey` / `deleteApiKey`.

**`setup.ts`** — First-run wizard (runs when `~/.aipres/` doesn't exist). Uses `inquirer` for interactive prompts.

### `src/preview/`

**`server.ts`** — HTTP server (renders current slide HTML) + WebSocket server (sends `{type:"reload"}` to connected browsers). Keeps `model` in memory; updated by the watcher.

**`watcher.ts`** — chokidar watcher on `~/.aipres/state/current.json`. On change: reload state → update server model → broadcast reload. Returns the `FSWatcher` so callers can close it on exit.

### `src/theme/`

Theme directory structure:
```
~/.aipres/themes/<name>/
├── theme.json    { name, displayName, description, baseTheme, customCss, assets }
└── custom.css
```

`baseTheme` maps to a Reveal.js built-in theme (black, white, league, etc.).

## LLM Tools

| Tool | Purpose | Key Inputs |
|------|---------|-----------|
| `add_slide` | Append or insert a slide | `layout` (required), `title`, `subtitle`, `body`, `leftCol`, `rightCol`, `imageUrl`, `notes`, `insertAt` |
| `update_slide` | Patch fields of an existing slide | `index`, `patch` (partial Slide) |
| `delete_slide` | Remove a slide by index | `index` |
| `reorder_slides` | Move a slide to a new position | `from`, `to` |
| `set_theme` | Change the active theme | `theme` (name string) |
| `set_reveal_option` | Set any Reveal.js init option | `key`, `value` |
| `show_summary` | Print slide list in terminal | — |

## Data Flow: One Chat Turn

```
1. User types message → pushed to messages[]
2. spinner.stop() → print "── Assistant ──" divider
3. runToolUseLoop(systemPrompt, messages, model, provider)
   a. provider.chat() → streaming response
      - text tokens → process.stdout (real-time)
      - tool_use blocks → collected
   b. for each tool_use:
      - dispatchTool() → operations.ts → new SlideModel
   c. tool results → pushed to messages[]
   d. if tool_uses.length > 0 → go to (a) with updated messages
4. model = result.updatedModel
5. messages synced from result.messages
6. saveState(model) → ~/.aipres/state/current.json  (atomic)
7. saveSession(messages) → ~/.aipres/state/session.json  (atomic)
8. writeHtml(model) → ./presentation.html  (silent, errors ignored)
9. (if preview running) watcher detects current.json change
   → updateServerModel() → broadcast({type:'reload'})
   → browser reloads
```

## Pending: Rich Text Migration

The `body` field on `Slide` is currently a Markdown string rendered via `marked`. This will be migrated to an HTML subset to support Google Slides-level inline formatting.

**Impact when implemented:**
- `types.ts`: `body` type annotation changes (or stays `string` with content semantics change)
- `templates.ts`: replace `marked.parse()` with an HTML sanitizer/passthrough
- `tools.ts`: update `input_schema` for `add_slide` / `update_slide` to document the HTML subset format
- `llm/tools.ts`: update system prompt to instruct the LLM to write HTML subset instead of Markdown

See `docs/rich-text-spec.md` for the full specification.

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `llm.model` | `claude-sonnet-4-5` | Anthropic model ID |
| `llm.language` | `ja` | BCP 47 locale for LLM responses |
| `preview.port` | `3000` | HTTP/WS server port |
| `preview.autoOpen` | `true` | Auto-open browser on start |
| `export.defaultFile` | `./presentation.html` | Default export path |
