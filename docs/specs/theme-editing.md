# Theme Editing Specification

## Overview

Enable LLM-assisted theme creation and editing via a dedicated theme editing mode. Users enter the mode with `aipres theme edit <name>`, which starts a preview server showing built-in sample slides rendered with the target theme, and a chat loop where the LLM can modify the theme's CSS, palette, and base theme in response to natural language instructions.

---

## 1. New CLI Commands

### `aipres theme new <name-or-path> [-w <workDir>]`

Creates a new user theme based on the built-in `default` theme.

**Global theme** (name without path separators, e.g. `my-theme`):
- Validates `<name>` against `^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$`
- Creates `~/.aipres/themes/<name>/theme.json` and `custom.css`
- Errors if a theme with that name already exists

**Project-local theme** (path starting with `./`, `../`, or `/`, e.g. `./theme`):
- Creates the theme directory and files at the resolved path (relative to `workDir`)
- Errors if the target directory already exists
- Updates `slides.json` in `workDir`: sets `"theme"` to the given path string (e.g. `"./theme"`)
- If `slides.json` is absent, creates it with default model and the new theme value

Does **not** automatically enter edit mode; the user runs `aipres theme edit` separately.

### `aipres theme edit [-w <workDir>]`

Enters theme editing mode for the theme currently set in `slides.json`.

- Reads the `theme` field from `slides.json` in `workDir`
- **Built-in theme**: errors and suggests `aipres theme new <name>` to create a custom copy
- **Global theme** (name-based, no `--force`): shows a three-choice prompt:
  1. **Copy to `./theme/` and edit locally** — copies the global theme into `<workDir>/theme/`, updates `slides.json` to `"theme": "./theme"`, then enters edit mode targeting the local copy
  2. **Edit the global theme** — edits in place in `~/.aipres/themes/<name>/` (affects all projects)
  3. **Cancel** — exits without changes
  `--force` skips the prompt and defaults to global edit
- **Path-based theme** (`./theme`, `../shared/corp`, etc.): directly enters edit mode on the resolved directory, no confirmation needed
- Starts the preview server on the configured port (default 3000) serving the sample slides (see §3) rendered with the target theme
- Starts the interactive chat loop with the theme editing system prompt (see §4)
- On exit (`/quit`, `/exit`, Ctrl-C), preview server is shut down and the final theme state on disk is the persisted result

### `aipres theme delete <name>`

Deletes a user-installed theme.

- Errors if the theme does not exist or is a built-in (built-ins cannot be deleted)
- Prompts for confirmation unless `--force` is passed
- If the deleted theme is the active theme of any presentation, that is not automatically changed (the presentation will fall back to the built-in `default` on next render)

---

## 2. Theme File Layout

No changes to the existing layout:

```
~/.aipres/themes/<name>/
├── theme.json     { name, displayName, description, baseTheme, customCss, assets, palette? }
└── custom.css
```

`theme new` initialises `theme.json` with:
```json
{
  "name": "<name>",
  "displayName": "<name>",
  "description": "",
  "baseTheme": "black",
  "customCss": "custom.css",
  "assets": []
}
```
And copies the default `custom.css` content.

---

## 3. Sample Slides

A fixed set of built-in sample slides is defined in `src/theme/samples.ts` as a `SlideModel`. These slides are used exclusively in theme editing mode.

The sample set covers all five layouts:

| # | Layout | Purpose |
|---|--------|---------|
| 1 | `title` | Title + subtitle typography |
| 2 | `content` | Bullet list, inline formatting |
| 3 | `two-column` | Column balance and spacing |
| 4 | `image` | Image layout with caption (uses an inline SVG placeholder) |
| 5 | `blank` | Free content: headings, paragraph, code |

The same sample slide content is described textually in the LLM system prompt (§4.1) so that user references like "the title on the first slide" or "the bullet list on slide 2" are unambiguous.

---

## 4. Chat Loop

### 4.1 System Prompt

The theme editing system prompt includes:

1. **Role and task** — the LLM is a CSS / Reveal.js theme designer
2. **Theme structure** — explanation of `theme.json` fields (`baseTheme`, `customCss`, `palette`)
3. **Available Reveal.js CSS variables** — key variables like `--r-background-color`, `--r-main-font`, `--r-heading-color`, etc.
4. **Palette system** — the six semantic names (`accent`, `muted`, `danger`, `success`, `warning`, `info`) and the generated CSS custom properties (`--color-palette-*`)
5. **Sample slide content** — a textual description of each sample slide's content (layout, title, body text) so the LLM can correlate user feedback with specific elements
6. **Tool usage instructions** — when to use each tool and the expected argument format
7. **Language instruction** — same locale as the presentation chat (from `config.llm.language`)

### 4.2 In-Memory Chat History

Messages are kept in a `Message[]` array for the duration of the session. They are **not** written to disk. This provides enough context for "undo that last change" style instructions while keeping theme storage simple.

### 4.3 Slash Commands

| Command | Action |
|---------|--------|
| `/quit`, `/exit` | End session, shut down preview |
| `/reset` | Restore theme to the state it had when the session started (in-memory snapshot taken at session open) |
| `/help` | Show available commands and tools |

No `/pres` or `/export` commands are available in theme editing mode.

### 4.4 Tool Execution and Live Preview

When the LLM calls a theme tool:

1. The tool applies the change to the theme files on disk (`theme.json` and/or `custom.css`)
2. The tool calls `broadcast({ type: 'reload' })` on the preview server's WebSocket
3. The browser reloads; `renderPresentation` re-reads the theme CSS from disk, picking up the change

No file watcher is needed for LLM-driven changes. The preview server's `renderPresentation` reads theme CSS on every request, so disk writes by the tool are immediately reflected on reload.

---

## 5. LLM Tools

Three tools are available in theme editing mode. These are **separate** from the slide editing tools and are not available in the normal chat loop.

### `update_css`

Replaces the entire content of the theme's `custom.css`.

```typescript
{
  name: 'update_css',
  description: 'Replace the full custom CSS of the theme.',
  inputSchema: {
    type: 'object',
    properties: {
      css: { type: 'string', description: 'Complete new CSS content' },
    },
    required: ['css'],
  },
}
```

### `set_base_theme`

Changes the Reveal.js base theme.

```typescript
{
  name: 'set_base_theme',
  description: 'Change the Reveal.js base theme.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        enum: ['black','white','league','beige','sky','night','serif','simple',
               'solarized','blood','moon','dracula','black-contrast','white-contrast'],
      },
    },
    required: ['name'],
  },
}
```

### `set_palette`

Updates the palette (partial update supported — only provided keys are changed).

```typescript
{
  name: 'set_palette',
  description: 'Update the theme palette colors (partial update allowed).',
  inputSchema: {
    type: 'object',
    properties: {
      palette: {
        type: 'object',
        properties: {
          accent:  { type: 'string', description: 'Hex color, e.g. "#3b82f6"' },
          muted:   { type: 'string' },
          danger:  { type: 'string' },
          success: { type: 'string' },
          warning: { type: 'string' },
          info:    { type: 'string' },
        },
      },
    },
    required: ['palette'],
  },
}
```

---

## 6. Preview Server

The existing `createServer` and WebSocket infrastructure is reused unchanged. `renderPresentation` is called with:
- the sample `SlideModel` (from `src/theme/samples.ts`) with `model.theme` set to the target theme name
- standard `ResolvedConfig`

No watcher is started (LLM tools trigger reload directly via `broadcast`).

---

## 7. Summary of File Changes

| File | Change |
|------|--------|
| `src/theme/samples.ts` | New: fixed sample `SlideModel` for theme preview |
| `src/theme/manager.ts` | Add `createTheme(name)`, `deleteTheme(name)` |
| `src/llm/theme-tools.ts` | New: `THEME_TOOLS` array + `buildThemeSystemPrompt(language)` |
| `src/cli/theme-editor.ts` | New: `runThemeEdit(name, opts)` — chat loop + preview server |
| `src/cli/theme.ts` | Add `runThemeNew`, `runThemeEdit`, `runThemeDelete` handlers |
| `bin/aipres.ts` | Register `theme new`, `theme edit`, `theme delete` subcommands |
| `docs/architecture.md` | Update module map and LLM tools table |
