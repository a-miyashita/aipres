# Session Specification

## Overview

A session is a working directory. Running `aipres` in a directory produces a session tied to that directory — no separate session management commands are needed.

---

## Data Layout

### Project data (per working directory)

```
<working-dir>/
├── slides.json        # SlideModel (theme, revealOptions, slides)
├── chat.json          # Message[] (LLM conversation history)
├── presentation.html  # rendered output
└── theme/             # project-local theme (optional)
    ├── theme.json
    └── custom.css
```

- `slides.json` and `chat.json` are created automatically on first write.
- `theme/` is optional and never created automatically.
- All files can be committed to version control or added to `.gitignore`.

### Global data (`~/.aipres/`)

```
~/.aipres/
├── config.json        # user configuration (mode 0600)
├── credentials.json   # API keys (mode 0600)
└── themes/            # globally installed user themes
    └── <name>/
        ├── theme.json
        └── custom.css
```

---

## CLI: `-w, --work-dir <path>`

All session-related commands accept `-w <path>` to override the working directory.

```
aipres            [-w <path>] [--port <n>]
aipres chat       [-w <path>]
aipres preview    [-w <path>] [--port <n>]
aipres export     [-w <path>] [file] [--open]
aipres reset      [-w <path>] [--force]
aipres theme edit [-w <path>] [--port <n>] [--force]
aipres theme list [-w <path>]
aipres theme new  [-w <path>] <name-or-path>
```

- `<path>` is resolved to an absolute path via `path.resolve()`.
- Default: `process.cwd()`.
- Exits with an error if the path does not exist or is not a directory.

---

## Startup Behaviour

1. Resolve `workDir` from `-w` or `process.cwd()`.
2. Load `<workDir>/slides.json`. If absent or corrupt, start with an empty `SlideModel`.
3. Load `<workDir>/chat.json`. If absent or corrupt, start with an empty `Message[]`.
4. If resuming (files exist and are non-empty), print:
   ```
   Resuming session: N exchange(s), M slide(s).
   ```

---

## State Persistence

All writes use atomic rename (`.tmp` → final path) for crash safety.

- `saveState(model, workDir)` → `<workDir>/slides.json`
- `saveSession(messages, workDir)` → `<workDir>/chat.json`

---

## Preview Server and File Watcher

- The chokidar watcher watches `<workDir>/slides.json`.
- On change: reload state → update in-memory server model → broadcast `{type:"reload"}` to connected browsers.

---

## Setup Check

`needsSetup()` checks for `~/.aipres/config.json`. If absent, the first-run setup wizard runs before the chat loop starts.

---

## Image Resolution

Relative image paths in user messages (e.g. `./photo.png`, `@./chart.png`) are resolved against `workDir`. This ensures `-w <path>` behaves consistently with the project directory.

---

## Error Cases

| Condition | Behaviour |
|---|---|
| `-w <path>` does not exist | Exit 1: `error: working directory '<path>' does not exist` |
| `-w <path>` is a file | Exit 1: `error: '<path>' is not a directory` |
| `slides.json` is corrupt | Silently start with empty `SlideModel` |
| `chat.json` is corrupt | Silently start with empty `Message[]` |
| Theme path in `slides.json` does not exist | Warning printed; fall back to built-in default |
