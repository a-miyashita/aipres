# aipres

Chat with Claude to build [Reveal.js](https://revealjs.com/) presentations — output is a single self-contained HTML file.

## Install

```bash
npm install -g aipres
```

Node.js 20+ required.

## Quick start

```bash
# Set your Anthropic API key
aipres config set llm.apiKey sk-ant-...

# Start chatting (with live preview)
aipres
```

```
> Make a 5-slide presentation about the history of the internet
> Add a two-column slide comparing IPv4 and IPv6
> Change the transition to fade
> /export
```

## Commands

| Command | Description |
|---|---|
| `aipres` | Start chat with live preview server |
| `aipres chat` | Start interactive chat (no preview server) |
| `aipres preview` | Live preview in browser with hot reload |
| `aipres export [file]` | Export to `presentation.html` |
| `aipres theme list` | List installed themes |
| `aipres theme add <path>` | Import a theme directory |
| `aipres theme new <name>` | Create a new theme |
| `aipres theme edit` | Edit current theme with LLM assistance |
| `aipres theme delete <name>` | Delete a theme |
| `aipres reset` | Clear current slides |
| `aipres config list` | Show all settings |
| `aipres config get <key>` | Get a setting value |
| `aipres config set <key> <value>` | Change a setting |
| `aipres config reset` | Reset all settings to defaults |

Most commands accept `-w <path>` / `--work-dir <path>` to specify the session directory (defaults to the current directory).

### Chat slash commands

| Command | Description |
|---|---|
| `/export [file]` | Export current slides |
| `/summary` | List current slides |
| `/reload` | Reload slides from disk (pick up external edits) |
| `/reset` | Clear slides |
| `/help` | Show available commands |
| `/quit` | End session |

## Configuration

```bash
aipres config set llm.provider  anthropic       # LLM provider (anthropic, openai, copilot, local)
aipres config set llm.apiKey    sk-ant-...       # API key for the selected provider
aipres config set llm.model     claude-opus-4-6  # Model name
aipres config set llm.language  en               # Response language (BCP 47)
aipres config set preview.port  3000             # Preview server port
```

The API key is stored in `~/.aipres/credentials.json` with mode `0600` (owner-readable only).

### Environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (overrides stored key) |
| `OPENAI_API_KEY` | OpenAI API key |
| `GITHUB_TOKEN` | GitHub Copilot token |
| `AIPRES_PROVIDER` | LLM provider override |
| `AIPRES_MODEL` | Model override |
| `AIPRES_LANGUAGE` | Language override |
| `AIPRES_BASE_URL` | Custom API base URL override |

### LLM providers

| Provider | `llm.provider` | API key source |
|---|---|---|
| Anthropic (default) | `anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` | `OPENAI_API_KEY` |
| GitHub Copilot | `copilot` | `GITHUB_TOKEN` |
| Local (Ollama etc.) | `local` | none required |

For OpenAI-compatible endpoints, set `llm.baseUrl` to the API base URL.

## Themes

Themes live in `~/.aipres/themes/`. A theme directory contains:

```
my-theme/
├── theme.json   # theme metadata
└── custom.css   # custom styles
```

```bash
aipres theme new my-theme          # create a new theme
aipres theme edit                  # edit the current theme interactively
aipres theme add ./my-theme        # import an existing theme directory
aipres config set theme my-theme   # switch to a theme
```

## License

MIT
