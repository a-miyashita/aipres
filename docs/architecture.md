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
│   aipres [-w]      aipres chat [-w]    aipres preview [-w]  │
│   (start.ts)       (chat.ts)           (preview.ts)         │
└───────────────────────────┬─────────────────────────────────┘
                            │ workDir (default: cwd)
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌─────────────┐ ┌───────────────┐
    │  LLM Layer   │ │ Model Layer │ │ Preview Layer │
    │  (src/llm/)  │ │ (src/model/)│ │ (src/preview/)│
    └──────┬───────┘ └──────┬──────┘ └───────┬───────┘
           │  tool calls    │ state           │ WebSocket
           │  ─────────────▶│                 │ broadcast
           │                │ JSON files      │
           │         ┌──────▼──────┐          │
           │         │  workDir/   │          │
           │         │ slides.json │──────────┘
           │         │  chat.json  │  (chokidar watch)
           │         └─────────────┘
           │
    ┌──────▼───────────────────────────────────────────┐
    │               Renderer  (src/renderer/)           │
    │   SlideModel → section HTML → full Reveal.js page │
    └──────────────────────────────────────────────────┘
```

## Module Map

### `bin/aipres.ts`
Commander.js entry point. Defines all CLI commands and wires them to `src/cli/*` handlers. Uses `parseAsync()` so async action handlers are properly awaited. Exposes `-w, --work-dir <path>` on all session-related commands; resolves it via `resolveWorkDir()` which validates the path exists and is a directory (defaults to `process.cwd()`).

### `src/cli/`

| File | Command | Responsibility |
|------|---------|----------------|
| `start.ts` | `aipres` | Starts preview server + file watcher + chat loop. Shuts down server/watcher when chat exits. |
| `chat.ts` | `aipres chat` | Interactive REPL. Loads session history, runs the LLM tool-use loop, saves state/session after each turn. Handles slash commands (`/reload`, `/reset`, `/export`, `/summary`). |
| `preview.ts` | `aipres preview` | Preview-only server with SIGINT handler for graceful shutdown. |
| `export.ts` | `aipres export` | One-shot HTML render to file. |
| `config.ts` | `aipres config *` | Config CRUD via dot-notation keys. |
| `theme.ts` | `aipres theme *` | Theme listing, import, creation, and deletion handlers. |
| `theme-editor.ts` | `aipres theme edit` | LLM-assisted theme editing mode: reads current theme from `slides.json`, classifies as built-in (error), global (warning + confirm), or path-based (direct edit); preview server with sample slides, snapshot-based `/reset`. |
| `reset.ts` | `aipres reset` | Clears slide state and chat history with confirmation. |

### `src/llm/`

**`provider.ts`** — Abstract interfaces: `LLMProvider`, `Message`, `Tool`, `LLMResponse`, `ContentBlock`, `ToolUse`.

**`anthropic.ts`** — `AnthropicProvider` implementation:
- Uses `client.messages.stream()` for streaming responses
- Parses both `text_delta` and `input_json_delta` events in the same `for await` loop
- Retry logic: 3 attempts, exponential backoff (1s, 2s)
- Writes streamed text directly to `process.stdout` for real-time display

**`openai-compatible.ts`** — `OpenAICompatibleProvider` implementation:
- Covers OpenAI, GitHub Copilot, and local LLMs (Ollama, llama.cpp) via the OpenAI Chat Completions API
- Accepts `baseUrl` to point at any OpenAI-compatible endpoint
- Converts canonical `ContentBlock[]` messages to OpenAI format (`tool_calls` / `role: 'tool'`) internally
- Same streaming + retry behaviour as `AnthropicProvider`

**`factory.ts`** — `createProvider(config: ResolvedConfig): LLMProvider`:
- Instantiates the correct provider class based on `config.llm.provider`
- Default base URLs: OpenAI → `api.openai.com/v1`, Copilot → `api.githubcopilot.com`, Local → `localhost:11434/v1`

**`theme-tools.ts`** — Theme editing tool definitions and system prompt:
- Exports `THEME_TOOLS: Tool[]` (3 tools: `update_css`, `set_base_theme`, `set_palette`)
- `buildThemeSystemPrompt(language, sampleDescription)` — theme-specific system prompt including Reveal.js CSS variable reference and sample slide descriptions
- `dispatchThemeTool()` — async dispatcher: writes CSS/theme.json to disk
- `runThemeToolUseLoop()` — same pattern as `runToolUseLoop` but for theme tools; calls `broadcast({ type: 'reload' })` after each tool execution

**`tools.ts`** — Slide editing tool definitions and system prompt:
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
- Slide state: `<workDir>/slides.json`
- Chat history: `<workDir>/chat.json`
- All writes use atomic rename (`.tmp` → final path) for crash safety
- `loadState(workDir)` / `saveState(model, workDir)` — slide CRUD
- `loadSession(workDir)` / `saveSession(messages, workDir)` — chat history CRUD

### `src/renderer/`

**`html.ts`** — Assembles the final HTML document:
1. Load theme JSON + CSS (installed theme or built-in fallback)
2. Load Reveal.js JS and CSS from `node_modules/reveal.js`
3. Render each slide via `templates.ts` (async, `Promise.all`)
4. Inject palette CSS vars from `theme.palette` as a separate `<style>` block
5. Inline everything into a single self-contained HTML file
6. Optionally inject WebSocket hot-reload script

**`templates.ts`** — Per-layout HTML renderers. All render functions are async; content fields are processed via `sanitizer.ts`.

**`sanitizer.ts`** — HTML subset sanitizer and content dispatcher:
- `sanitizeBlock(html)` — strips disallowed tags/attributes from block content (body, leftCol, rightCol, notes)
- `sanitizeInline(html)` — same for inline-only content (title, subtitle)
- `renderContent(text, mode)` — detects content type: if `text` contains `<`, treats as HTML subset and sanitizes; otherwise falls back to `marked` for legacy Markdown
- Local `<img src>` paths are converted to base64 data URLs; missing files fall back to `src=""`

**`assets.ts`** — Reads Reveal.js bundles from `node_modules`, handles image base64 encoding.

### `src/config/`

**`config.ts`** — Three-level merge: defaults ← `~/.aipres/config.json` ← env vars (`AIPRES_MODEL`, `AIPRES_LANGUAGE`, `ANTHROPIC_API_KEY`).

**`keychain.ts`** — API key stored separately in `~/.aipres/credentials.json` (mode 0600). Provides `getApiKey` / `setApiKey` / `deleteApiKey`.

**`setup.ts`** — First-run wizard (runs when `~/.aipres/config.json` doesn't exist). Uses `inquirer` for interactive prompts. Supports Anthropic, OpenAI, GitHub Copilot, and local LLM providers.

### `src/preview/`

**`server.ts`** — HTTP server (renders current slide HTML) + WebSocket server (sends `{type:"reload"}` to connected browsers). Keeps `model` in memory; updated by the watcher.

**`watcher.ts`** — chokidar watcher on `<workDir>/slides.json`. On change: reload state → update server model → broadcast reload. Returns the `FSWatcher` so callers can close it on exit.

### `src/theme/`

**`samples.ts`** — Fixed `SAMPLE_SLIDES: SlideModel` covering all five layouts, used as the preview content in theme editing mode. Also exports `buildSampleDescription()` for injection into the theme editing system prompt.

Theme directory structure:
```
~/.aipres/themes/<name>/      ← global user themes
├── theme.json    { name, displayName, description, baseTheme, customCss, assets, palette? }
└── custom.css

<any-path>/                   ← project-local themes (referenced by path in slides.json)
├── theme.json
└── custom.css
```

The `theme` field in `slides.json` accepts either a **name** (`"default"`, `"black"`) or a **path** (`"./theme"`, `"../shared/theme"`). Path values are resolved relative to `workDir`. Name values are looked up in `~/.aipres/themes/<name>/` first, then in built-in Reveal.js themes.

`baseTheme` maps to a Reveal.js built-in theme (black, white, league, etc.).

`palette` defines six semantic color names (`accent`, `muted`, `danger`, `success`, `warning`, `info`) as hex values. The renderer generates `--color-palette-*` CSS custom properties from this field and injects them into every rendered page, so `data-color="accent"` etc. always reflect the active theme.

**`loadTheme(value, workDir)`** returns `{ def: ThemeDefinition; dir: string | null }`. `dir` is `null` for built-in themes (no writable directory). `isThemePath(value)` returns `true` if the value starts with `/`, `./`, or `../`.

**Built-in themes** — 14 Reveal.js themes (black, white, league, beige, sky, night, serif, simple, solarized, blood, moon, dracula, black-contrast, white-contrast) are available without installation. `loadTheme()` falls back to these when no matching directory exists under `~/.aipres/themes/`. Built-in themes use `SHARED_LAYOUT_CSS` (structural rules only) so Reveal.js theme colors are preserved; the `black` built-in shares the same full dark CSS as the `default` theme. User-installed themes with the same name take precedence over built-ins.

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

### Theme Editing Tools (available only in `aipres theme edit`)

| Tool | Purpose | Key Inputs |
|------|---------|-----------|
| `update_css` | Replace full custom.css | `css` |
| `set_base_theme` | Change Reveal.js base theme | `name` |
| `set_palette` | Update palette colors (partial) | `palette` (object with any of: accent, muted, danger, success, warning, info) |

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
6. saveState(model, workDir) → <workDir>/slides.json  (atomic)
7. saveSession(messages, workDir) → <workDir>/chat.json  (atomic)
8. writeHtml(model, ..., config, workDir) → presentation.html  (silent, errors ignored)
9. (if preview running) watcher detects current.json change
   → updateServerModel() → broadcast({type:'reload'})
   → browser reloads
```

## Rich Text Content Fields

All text content fields (`body`, `leftCol`, `rightCol`, `notes`, `title`, `subtitle`) accept an HTML subset string. The LLM writes HTML directly into tool call arguments; the server sanitizes against an allowlist before rendering.

Legacy Markdown in existing `state/current.json` files is detected by the absence of `<` and rendered via `marked` as a transparent fallback.

See `docs/rich-text-spec.md` for the full element/attribute allowlist, palette color system, and LLM instructions.

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `llm.provider` | `anthropic` | LLM provider: `anthropic`, `openai`, `copilot`, or `local` |
| `llm.model` | `claude-sonnet-4-5` | Model ID (provider-specific) |
| `llm.language` | `ja` | BCP 47 locale for LLM responses |
| `llm.baseUrl` | *(provider default)* | API base URL; required for `local`, optional for `openai` |
| `preview.port` | `3000` | HTTP/WS server port |
| `preview.autoOpen` | `true` | Auto-open browser on start |
| `export.defaultFile` | `./presentation.html` | Default export path |

Environment variable overrides: `AIPRES_PROVIDER`, `AIPRES_MODEL`, `AIPRES_BASE_URL`, `AIPRES_LANGUAGE`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GITHUB_TOKEN`.
