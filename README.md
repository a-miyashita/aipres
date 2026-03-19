# aipres

Chat with Claude to build [Reveal.js](https://revealjs.com/) presentations — output is a single self-contained HTML file.

```bash
npm install -g aipres
aipres config set llm.apiKey sk-ant-...
aipres chat
```

## Features

- **Chat-driven** — describe slides in natural language; Claude handles the structure
- **Tool Use** — Claude operates slides via typed tools, never raw HTML output
- **Single-file output** — Reveal.js JS/CSS inlined, no external dependencies at runtime
- **Hot reload preview** — `aipres preview` watches for changes and refreshes the browser
- **Session persistence** — slides are saved to `~/.aipres/state/current.json` between sessions
- **Multilingual** — set `llm.language` to any BCP 47 locale code
- **Secure credential storage** — API key stored in `~/.aipres/credentials.json` (mode `0600`, owner-readable only)

## Commands

| Command | Description |
|---|---|
| `aipres chat` | Start interactive chat session |
| `aipres preview [--port n]` | Live preview with hot reload |
| `aipres export [file] [--open]` | Export to HTML |
| `aipres theme list` | List installed themes |
| `aipres theme add <path>` | Import a theme directory |
| `aipres reset [--force]` | Clear current slides |
| `aipres config list` | Show all settings |
| `aipres config get <key>` | Get a setting (dot notation) |
| `aipres config set <key> <value>` | Change a setting |
| `aipres config reset [--force]` | Reset config to defaults |

## Architecture

```
bin/aipres.ts          CLI entry point (Commander)
src/
  cli/               One file per subcommand
  llm/
    tools.ts         7 Tool Use definitions + buildSystemPrompt()
    anthropic.ts     Streaming provider with retry
    dispatcher.ts    Tool call → model operation loop
  model/
    types.ts         SlideModel, Slide, Result<T>, Zod schemas
    operations.ts    Pure functions: addSlide, updateSlide, …
    state.ts         Atomic JSON persistence (~/.aipres/state/)
  renderer/
    html.ts          SlideModel → self-contained HTML
    templates.ts     Per-layout <section> generators
    assets.ts        Inline reveal.js / CSS / Base64 images
  config/
    config.ts        Priority-ordered config loading
    keychain.ts      credential store (~/.aipres/credentials.json, mode 0600)
    setup.ts         First-run wizard
  preview/
    server.ts        HTTP + WebSocket server
    watcher.ts       chokidar file watcher
  theme/
    manager.ts       Theme discovery and import
assets/themes/default/ Bundled default theme
```

### LLM tool loop

```
User input
  └─> Claude API (streaming, Tool Use)
        └─> tool_use blocks
              └─> dispatchTool() → operations.ts (pure)
                    └─> tool_result → Claude API
                          └─> final text response
                                └─> saveState() + renderPresentation()
```

### Tool Use tools

| Tool | Description |
|---|---|
| `add_slide` | Add slide at end or at index |
| `update_slide` | Patch fields of an existing slide |
| `delete_slide` | Remove a slide by index |
| `reorder_slides` | Move slide from → to |
| `set_theme` | Switch active theme |
| `set_reveal_option` | Set any Reveal.js init option |
| `show_summary` | Print slide list to terminal |

## Development setup

```bash
git clone https://github.com/<you>/aipres
cd aipres
npm install
npm link                  # registers `aipres` command locally

# Run without building
npm run dev -- chat

# Build
npm run build

# Test
npm test
```

Requires Node.js 20+. No native addons — pure JavaScript/TypeScript throughout.

## Publishing

Tagging triggers the GitHub Actions publish workflow:

```bash
npm version patch
git push origin main --tags
```

`README.npm.md` is swapped in as `README.md` during `npm pack` via `prepack`/`postpack` hooks, so the npm package page shows a user-focused README while this file stays developer-focused on GitHub.

To set up publishing, add an `NPM_TOKEN` secret to the GitHub repository (`Settings > Secrets and variables > Actions`). Generate the token at [npmjs.com](https://www.npmjs.com) under `Access Tokens > Granular Access Token`.

## Configuration reference

| Key | Type | Default | Description |
|---|---|---|---|
| `llm.provider` | string | `anthropic` | LLM provider |
| `llm.model` | string | `claude-opus-4-6` | Model name |
| `llm.language` | string | `ja` | Response language (BCP 47) |
| `preview.port` | number | `3000` | Preview server port |
| `preview.autoOpen` | boolean | `true` | Open browser on preview start |
| `export.defaultFile` | string | `./presentation.html` | Default export path |

API key is stored in `~/.aipres/credentials.json` (mode `0600`) separately from `config.json`. Override with `ANTHROPIC_API_KEY` env var.

## Themes

```
~/.aipres/themes/
└── my-theme/
    ├── theme.json    { name, displayName, baseTheme, customCss, assets }
    └── custom.css
```

```bash
aipres theme add ./my-theme
```

Images listed in `assets` are Base64-inlined into the exported HTML.

## License

MIT
