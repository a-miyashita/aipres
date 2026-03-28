# Specification: Directory-Based Sessions

**Status:** Draft
**Date:** 2026-03-28
**ADR:** [ADR-0012](../adr/0012-directory-based-sessions.md)

---

## Overview

Session data (slides and chat history) is stored directly in the **working directory** — no hidden subdirectory, no separate config file. The working directory defaults to `process.cwd()` and can be overridden with a global `-w` option.

---

## Data Layout

### Project data (per working directory)

```
<working-dir>/             # working directory IS the session
├── slides.json            # SlideModel (theme, revealOptions, slides)
├── chat.json              # Message[]
├── presentation.html      # rendered output
└── theme/                 # project-local theme (optional)
    ├── theme.json
    └── custom.css
```

- `slides.json` and `chat.json` are created automatically on first write.
- `theme/` is optional and never created automatically.
- All files can be committed to version control or added to `.gitignore`.

### Global data (unchanged)

```
~/.aipres/
├── config.json       # user configuration
├── credentials.json  # API keys (mode 0600)
└── themes/           # global user-installed themes
    └── <name>/
        ├── theme.json
        └── custom.css
```

---

## CLI Changes

### Global option: `-w, --work-dir <path>`

Added to the root Commander command. Accepted by all subcommands that operate on session data.

```
aipres [-w <path>] [options]
aipres chat [-w <path>] [options]
aipres preview [-w <path>] [options]
aipres export [-w <path>] [file]
aipres reset [-w <path>] [--force]
```

- `<path>` is resolved as an absolute path using `path.resolve(path)`.
- Default: `process.cwd()`.
- Error if the path does not exist or is not a directory.

### Removed options and commands

| Removed | Replacement |
|---------|-------------|
| `--pres NAME` on `aipres`, `aipres chat`, `aipres preview` | `-w <path>` |
| `aipres pres new <name>` | `mkdir <dir> && aipres -w <dir>` |
| `aipres pres list` | `ls` / directory listing |
| `aipres pres switch <name>` | open a new terminal, `cd <dir>` |
| `aipres pres rename <old> <new>` | `mv` |
| `aipres pres delete <name>` | `rm slides.json chat.json` |

### Removed slash commands in chat

| Removed | Replacement |
|---------|-------------|
| `/pres` | — |
| `/pres list` | — |
| `/pres new <name>` | — |
| `/pres switch <name>` | — |

---

## Startup Behaviour

1. Resolve `workDir` from `-w` option or `process.cwd()`.
2. Validate `workDir` is an existing directory; exit with an error message if not.
3. Load `slides.json` from `<workDir>/slides.json`. If absent, start with an empty `SlideModel`.
4. Load `chat.json` from `<workDir>/chat.json`. If absent, start with an empty `Message[]`.
5. Print on startup (if resuming):

   ```
   Resuming session in <workDir>: N exchange(s), M slide(s).
   ```

   If the working directory equals `process.cwd()`, print only `.`:

   ```
   Resuming session in .: N exchange(s), M slide(s).
   ```

---

## State Persistence

- `saveState(model, workDir)` writes `<workDir>/slides.json` atomically (`.tmp` → rename).
- `saveSession(messages, workDir)` writes `<workDir>/chat.json` atomically.

---

## Preview and Watcher

- The chokidar watcher watches `<workDir>/slides.json`.
- The dynamic session-switching callback in `start.ts` is removed (no session switching).

---

## Setup Check

`needsSetup()` checks for the existence of `~/.aipres/config.json` (not `~/.aipres/`). This prevents re-triggering the setup wizard for existing users who have a `~/.aipres/` directory.

---

## Image Resolution

`resolveImageRefs(input, workDir)` receives the resolved `workDir` instead of hard-coding `process.cwd()`. This ensures that when `-w <path>` is used, relative image references like `./photo.png` are resolved against the specified working directory.

---

## Theme Resolution

The `theme` field in `slides.json` accepts either a **name** or a **path**:

- **Path** — value starts with `./`, `../`, or `/`: resolved relative to `workDir` (or as absolute) and loaded directly as a theme directory.
- **Name** — any other value: looked up first in `~/.aipres/themes/<name>/`, then in Reveal.js built-ins.

```
slides.json theme value   → resolution
────────────────────────────────────────────────
"black"                   → built-in "black"
"mycorp"                  → ~/.aipres/themes/mycorp/
"./theme"                 → <workDir>/theme/
"../shared/corp"          → <repo-root>/shared/corp/
"/opt/themes/brand"       → absolute path
```

The LLM sets the theme via the `set_theme` tool, which writes to `slides.json`. The LLM can set both names and paths.

### `aipres theme edit`

```
aipres theme edit [-w <path>] [--port <n>] [--force]
```

`aipres theme edit` no longer takes a theme name argument. It reads `slides.json.theme` from `workDir` and resolves the theme type:

| Theme type | Condition | Behaviour |
|------------|-----------|-----------|
| **Built-in** | name matches a Reveal.js built-in and no global theme with that name exists | Error — cannot edit |
| **Global** | name resolves to `~/.aipres/themes/<name>/` | Warning + confirmation, then editor |
| **Path** | value is path-like (`./`, `../`, `/`) | Editor opens directly |

**Built-in error message:**
```
error: built-in themes cannot be edited.
To create a custom theme: aipres theme new <name>
Then set it as the active theme (e.g. tell the LLM: "use the <name> theme").
```

**Global theme warning (shown before entering editor):**
```
⚠  "<name>" is a global theme (~/.aipres/themes/<name>/).
   Changes will affect all presentations that use this theme.
   Continue? [y/N]
```

Pass `--force` to skip the confirmation prompt (for scripted use).

**Edge cases:**

| Condition | Behaviour |
|-----------|-----------|
| `slides.json` does not exist in `workDir` | Error: `no slides.json found in <workDir>. Run aipres first.` |
| Path-based theme: directory does not exist | Error: `theme directory '<path>' does not exist` |
| Global theme: directory does not exist | Error: `theme '<name>' not found. Create it with: aipres theme new <name>` |

### `aipres theme new`, `aipres theme add`, `aipres theme list`

`aipres theme new` and `aipres theme add` always create/install into `~/.aipres/themes/` (global). To use a project-local theme:
1. Run `aipres theme new <name>` to create a scaffold in `~/.aipres/themes/<name>/`
2. Copy or move it to `<workDir>/theme/`
3. Set `theme: "./theme"` in `slides.json` (or tell the LLM: "use the theme at ./theme")

`aipres theme list [-w <path>]` shows all available themes with scope labels:

```
path     ./theme        Project local theme
global   mycorp         Corporate branding
built-in black          (built-in)
built-in white          (built-in)
...
```

The `path` label appears for any theme whose value in `slides.json` is path-like.

### Monorepo example

```
my-repo/
├── shared/
│   └── corp-theme/        ← shared theme (committed to the repo)
│       ├── theme.json
│       └── custom.css
├── project-a/
│   ├── slides.json        ← { "theme": "../shared/corp-theme", ... }
│   └── chat.json
└── project-b/
    ├── slides.json        ← { "theme": "../shared/corp-theme", ... }
    └── chat.json
```

---

## Migration

- `~/.aipres/sessions/` directories are left in place; aipres no longer reads or writes them.
- No automatic migration is provided. Users who want to continue work from a named session can manually copy files:

  ```sh
  cp ~/.aipres/sessions/<name>/slides.json <project-dir>/slides.json
  cp ~/.aipres/sessions/<name>/chat.json   <project-dir>/chat.json
  ```

- `state.ts` no longer exports `migrateFromV1IfNeeded`, `loadActiveSession`, `setActiveSession`, or session path helpers (`getSessionsDir`, `getActivePath`, `getSessionDir`).

---

## Error Cases

| Condition | Behaviour |
|-----------|-----------|
| `-w <path>` does not exist | Exit 1: `error: working directory '<path>' does not exist` |
| `-w <path>` is a file, not a directory | Exit 1: `error: '<path>' is not a directory` |
| `theme` path in `slides.json` does not exist | Warning printed; fall back to built-in default |
| `slides.json` is corrupt | Silently start with empty `SlideModel` |
| `chat.json` is corrupt | Silently start with empty `Message[]` |
