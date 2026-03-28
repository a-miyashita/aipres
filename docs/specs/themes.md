# Themes Specification

## Overview

A theme controls the visual appearance of the presentation. The `theme` field in `slides.json` identifies the active theme as either a **name** or a **path**.

| Type | How referenced | Where stored |
|---|---|---|
| Built-in | Name (e.g. `"black"`) | Bundled with Reveal.js |
| Global user theme | Name (e.g. `"mycorp"`) | `~/.aipres/themes/<name>/` |
| Project-local theme | Path (e.g. `"./theme"`) | Any directory, typically `<workDir>/theme/` |

---

## Theme Directory Structure

```
<theme-dir>/
├── theme.json
└── custom.css
```

### `theme.json` fields

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Internal identifier |
| `displayName` | `string` | Human-readable name |
| `description` | `string` | Short description |
| `baseTheme` | `string` | Reveal.js built-in to layer on top of (e.g. `"black"`) |
| `customCss` | `string` | Filename of the CSS file (e.g. `"custom.css"`) |
| `assets` | `string[]` | Additional asset filenames |
| `palette?` | `object` | Six semantic color names (see below) |

### Palette

Defines six semantic color names as hex values:

```json
{
  "accent":  "#e94560",
  "muted":   "#9e9e9e",
  "danger":  "#ff5555",
  "success": "#50fa7b",
  "warning": "#ffb86c",
  "info":    "#8be9fd"
}
```

The renderer injects these as CSS custom properties (`--color-palette-accent`, etc.) into every rendered page.

---

## Name vs Path Resolution

The `theme` field in `slides.json` accepts either a name or a path.

**Path** — value starts with `./`, `../`, or `/`:
- Resolved relative to `workDir` (or used as-is if absolute)
- Loaded directly from the resolved directory

**Name** — any other value:
1. Look up `~/.aipres/themes/<name>/` (global user theme)
2. Fall back to Reveal.js built-ins

```
"black"              → built-in "black"
"mycorp"             → ~/.aipres/themes/mycorp/
"./theme"            → <workDir>/theme/
"../shared/corp"     → resolved relative to workDir
"/opt/themes/brand"  → absolute path
```

User-installed global themes with the same name as a built-in take precedence.

### Monorepo example

```
my-repo/
├── shared/
│   └── corp-theme/     ← shared theme (committed to repo)
│       ├── theme.json
│       └── custom.css
├── project-a/
│   └── slides.json     ← { "theme": "../shared/corp-theme", ... }
└── project-b/
    └── slides.json     ← { "theme": "../shared/corp-theme", ... }
```

---

## Built-in Themes

14 Reveal.js themes are available without installation:

`black`, `white`, `league`, `beige`, `sky`, `night`, `serif`, `simple`, `solarized`, `blood`, `moon`, `dracula`, `black-contrast`, `white-contrast`

Built-in themes cannot be edited or deleted. Create a custom copy with `aipres theme new <name>`.

---

## CLI Commands

### `aipres theme new <name-or-path> [-w <workDir>]`

Creates a new theme based on the built-in default.

**Global theme** (name without path separators, e.g. `my-theme`):
- Validates name against `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$`
- Creates `~/.aipres/themes/<name>/theme.json` and `custom.css`
- Errors if a theme with that name already exists

**Project-local theme** (path starting with `./`, `../`, or `/`, e.g. `./theme`):
- Resolves path relative to `workDir`
- Creates `theme.json` and `custom.css` at the resolved directory
- Errors if the target directory already exists
- Updates `slides.json` in `workDir`: sets `"theme"` to the given path string
- If `slides.json` is absent, creates it with an empty `SlideModel` and the new theme value

Does not automatically enter edit mode.

### `aipres theme add <path>`

Imports an existing theme directory into `~/.aipres/themes/`.

- Reads `theme.json` from the source directory to determine the theme name
- Copies all files (non-recursive) into `~/.aipres/themes/<name>/`
- Errors if `theme.json` is missing from the source

### `aipres theme list [-w <workDir>]`

Lists all available themes (global user themes + built-ins). The theme currently set in `slides.json` is marked `(current)`.

### `aipres theme delete <name>`

Deletes a globally installed user theme from `~/.aipres/themes/<name>/`.

- Errors if the theme is a built-in (built-ins cannot be deleted)
- Errors if the named theme does not exist
- Prompts for confirmation unless `--force` is passed
- Does not automatically update any `slides.json` that referenced the deleted theme

### `aipres theme edit [-w <workDir>] [--port <n>] [--force]`

Opens LLM-assisted theme editing mode for the theme currently set in `slides.json`.

Reads the `theme` field from `<workDir>/slides.json` and classifies the theme:

| Theme type | Condition | Behaviour |
|---|---|---|
| **Built-in** | Name matches a built-in and no global theme with that name exists | Error — cannot edit. Suggests `aipres theme new <name>`. |
| **Global** | Name resolves to `~/.aipres/themes/<name>/` | Shows three-choice prompt (see below) |
| **Path-based** | Value starts with `./`, `../`, or `/` | Directly enters edit mode on the resolved directory |

**Three-choice prompt for global themes:**

```
⚠  "my-theme" is a global theme stored in ~/.aipres/themes/my-theme/
   Editing it will affect all projects that use this theme.

? What would you like to do?
❯ Copy to ./theme/ and edit locally (this project only)
  Edit the global theme (affects all projects that use it)
  Cancel
```

- **Copy to `./theme/` and edit locally**: copies all files from `~/.aipres/themes/<name>/` to `<workDir>/theme/`, updates `slides.json` to `"theme": "./theme"`, then enters edit mode targeting the local copy. Errors if `<workDir>/theme/` already exists.
- **Edit the global theme**: enters edit mode on `~/.aipres/themes/<name>/` directly.
- **Cancel**: exits without changes.

`--force` skips the prompt and defaults to global edit.

---

## Theme Editor

### Preview server

`aipres theme edit` starts a preview server (default port 3000). The preview shows the actual slides from `slides.json` (with the theme under edit applied). If `slides.json` has no slides, it falls back to fixed sample slides (`src/theme/samples.ts`).

The browser auto-opens if `preview.autoOpen` is enabled. The server shuts down on exit.

### Sample slides (`src/theme/samples.ts`)

Five fixed slides covering all layouts, used as fallback preview content:

| # | Layout | Purpose |
|---|---|---|
| 1 | `title` | Title + subtitle typography |
| 2 | `content` | Bullet list, inline formatting |
| 3 | `two-column` | Column balance and spacing |
| 4 | `image` | Image layout with SVG placeholder |
| 5 | `blank` | Headings, paragraph, code block |

The same content is described textually in the LLM system prompt, so user references like "the title on slide 1" are unambiguous.

### Chat loop

The theme editor runs its own chat loop, separate from the presentation chat. Chat history is kept in memory only (not persisted to disk).

**System prompt contents:**
1. Role: CSS / Reveal.js theme designer
2. Theme structure (`baseTheme`, `customCss`, `palette` fields)
3. Reveal.js CSS variables (`--r-background-color`, `--r-main-font`, etc.)
4. Palette system (six semantic names → `--color-palette-*` CSS variables)
5. Sample slide content (textual description)
6. Tool usage instructions
7. Language instruction (from `config.llm.language`)

**Slash commands:**

| Command | Action |
|---|---|
| `/quit`, `/exit` | End session, shut down preview |
| `/reset` | Restore theme files to the state at session start (in-memory snapshot) |
| `/help` | Show available commands |

### Live preview

When an LLM tool executes:
1. Writes changes to `theme.json` and/or `custom.css` on disk
2. Calls `broadcast({ type: 'reload' })` on the preview server's WebSocket
3. Browser reloads; the server re-reads theme CSS from disk

No file watcher is needed in theme edit mode — all changes come through LLM tools.

---

## LLM Tools (Theme Editor Only)

These tools are available only inside `aipres theme edit`, not in the normal chat loop.

### `update_css`

Replaces the entire content of `custom.css`.

```json
{
  "name": "update_css",
  "description": "Replace the full custom CSS of the theme.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "css": { "type": "string", "description": "Complete new CSS content" }
    },
    "required": ["css"]
  }
}
```

### `set_base_theme`

Changes the Reveal.js base theme (updates `baseTheme` in `theme.json`).

```json
{
  "name": "set_base_theme",
  "description": "Change the Reveal.js base theme.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "enum": ["black","white","league","beige","sky","night","serif","simple",
                 "solarized","blood","moon","dracula","black-contrast","white-contrast"]
      }
    },
    "required": ["name"]
  }
}
```

### `set_palette`

Updates `palette` in `theme.json` (partial update — only provided keys are changed).

```json
{
  "name": "set_palette",
  "description": "Update the theme palette colors (partial update allowed).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "palette": {
        "type": "object",
        "properties": {
          "accent":  { "type": "string" },
          "muted":   { "type": "string" },
          "danger":  { "type": "string" },
          "success": { "type": "string" },
          "warning": { "type": "string" },
          "info":    { "type": "string" }
        }
      }
    },
    "required": ["palette"]
  }
}
```
