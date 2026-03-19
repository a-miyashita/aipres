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

# Start chatting
aipres chat
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
| `aipres chat` | Start interactive chat session |
| `aipres preview` | Live preview in browser with hot reload |
| `aipres export [file]` | Export to `presentation.html` |
| `aipres theme list` | List installed themes |
| `aipres theme add <path>` | Import a theme directory |
| `aipres reset` | Clear current slides |
| `aipres config list` | Show all settings |
| `aipres config set <key> <value>` | Change a setting |

### Chat slash commands

| Command | Description |
|---|---|
| `/export [file]` | Export current slides |
| `/preview` | Open preview server |
| `/summary` | List current slides |
| `/reset` | Clear slides |
| `/help` | Show available commands |
| `/quit` | End session |

## Configuration

```bash
aipres config set llm.apiKey    sk-ant-...     # Anthropic API key
aipres config set llm.model     claude-opus-4-6 # Model
aipres config set llm.language  en              # Response language (BCP 47)
aipres config set preview.port  3000            # Preview server port
```

The API key is stored in `~/.aipres/credentials.json` with mode `0600` (owner-readable only).
Set `ANTHROPIC_API_KEY` as an environment variable to override.

## Themes

Themes live in `~/.aipres/themes/`. A theme directory contains:

```
my-theme/
├── theme.json   # theme metadata
└── custom.css   # custom styles
```

```bash
aipres theme add ./my-theme
aipres config set theme my-theme   # switch to it in chat
```

## License

MIT
