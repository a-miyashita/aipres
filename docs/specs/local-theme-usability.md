# Local Theme Usability Improvements — Specification

## Overview

Two complementary improvements to make project-local theme workflows first-class:

1. **`theme new` accepts a path** — `aipres theme new ./theme` creates a local theme directly in the project directory and updates `slides.json` automatically.
2. **`theme edit` offers localization** — when editing a global (name-based) theme, a new option copies it into the project first and updates `slides.json`, so subsequent edits are project-local.

---

## 1. `theme new` path support

### Changed signature

```
aipres theme new <name-or-path> [-w <workDir>]
```

| Argument | Behaviour |
|---|---|
| `my-theme` (no path separators) | **Unchanged.** Creates `~/.aipres/themes/my-theme/`. |
| `./theme`, `../shared/corp`, `/abs/path` | **New.** Creates theme files at the resolved directory. Updates `slides.json`. |

Path detection uses `isThemePath()` (already in `src/theme/manager.ts`): values that start with `./`, `../`, or `/`.

### Path creation behaviour

1. Resolve the path relative to `workDir` (using `path.resolve(workDir, arg)`).
2. Error if the resolved directory already exists.
3. Create the directory with `theme.json` and `custom.css` (same defaults as global `theme new`).
4. Load `slides.json` from `workDir` (or start from `DEFAULT_MODEL` if absent); set `model.theme` to the original argument string (e.g. `"./theme"`); save.
5. Print success message:
   ```
   ✔  Theme created at ./theme/
      slides.json updated: "theme": "./theme"
      Run: aipres theme edit to start customising
   ```

### `-w` option

`theme new` gains `-w, --work-dir <path>` (same pattern as other commands). Required to resolve path-based names and to locate `slides.json`. Defaults to `process.cwd()`.

### Validation

- Path-based names skip the `THEME_NAME_PATTERN` regex (it only applies to global names).
- The resolved path must not already exist.
- Parent directories are created with `{ recursive: true }`.

---

## 2. `theme edit` — localization option

### Current flow (global theme)

```
⚠  "my-theme" is a global theme…
? Continue editing the global theme?  (Y/n)
```

### New flow (global theme)

Replace the yes/no prompt with a three-choice list:

```
⚠  "my-theme" is a global theme stored in ~/.aipres/themes/my-theme/
   Editing it will affect all projects that use this theme.

? What would you like to do?
❯ Copy to ./theme/ and edit locally (this project only)
  Edit the global theme (affects all projects that use it)
  Cancel
```

#### Option: "Copy to ./theme/ and edit locally"

1. Error if `<workDir>/theme/` already exists (it may be an unrelated directory).
2. Copy all files from `~/.aipres/themes/<name>/` to `<workDir>/theme/`.
3. Load `slides.json`; set `model.theme` to `"./theme"`; save.
4. Print:
   ```
   ✔  Theme copied to ./theme/
      slides.json updated: "theme": "./theme"
   ```
5. Continue into theme editing mode, targeting `<workDir>/theme/` as `themeDir`.

#### Option: "Edit the global theme"

Existing behaviour, unchanged.

#### Option: "Cancel"

Existing behaviour, unchanged.

### `--force` flag

`--force` skips the new prompt and falls through to global edit, preserving the original scripting behaviour.

---

## 3. Edge cases

| Scenario | Behaviour |
|---|---|
| `theme new ./theme` and `<workDir>/theme/` already exists | Error: `"./theme" already exists. Choose a different path or delete it first.` |
| `theme edit` "copy to ./theme/" and `<workDir>/theme/` already exists | Error: `./theme/ already exists. Delete it first or switch to it with: aipres config set theme ./theme` |
| `slides.json` absent when `theme new ./theme` runs | Create theme directory; write a default `slides.json` with `"theme": "./theme"`. |
| `theme new ./theme` — `slides.json` already has a different theme | Overwrite the `theme` field. The new local theme takes over. |

---

## 4. Files changed

| File | Change |
|---|---|
| `src/theme/manager.ts` | Add `createThemeAt(dirPath)` (creates files at arbitrary path); add `copyThemeDir(srcDir, destDir)` |
| `src/cli/theme.ts` | Update `runThemeNew` to detect path vs name and pass `workDir` |
| `src/cli/theme-editor.ts` | Replace yes/no prompt with three-choice list; handle copy-and-edit flow |
| `bin/aipres.ts` | Add `-w` option to `theme new` subcommand |
| `docs/specs/theme-editing.md` | Update `theme new` signature and behaviour sections |
| `docs/architecture.md` | Update `src/cli/theme-editor.ts` description |
