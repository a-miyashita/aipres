# ADR-0012: Directory-Based Sessions

**Status:** Approved
**Date:** 2026-03-28

---

## Context

aipres currently stores session data (slides and chat history) in named subdirectories under `~/.aipres/sessions/`. Users select sessions by name via `--pres NAME` or the `aipres pres` subcommands.

This model has three problems:

1. **Misaligned mental model.** Users think of a presentation as belonging to a project directory, not a global name. When working in `/projects/q1-review`, the expectation is that the presentation data lives near that directory — not in a separate global namespace under `~/.aipres/`.

2. **Friction for multi-project workflows.** Users must remember to create and switch named sessions to separate work across projects. Forgetting to switch means edits land in the wrong session.

3. **No version control for presentations.** Storing slides and chat history under `~/.aipres/` puts them outside any project repository. There is no way to commit a presentation alongside the code or assets it accompanies, share it via git, or roll back to a previous version. A project-specific custom theme in `~/.aipres/themes/` faces the same problem.

The desired model: running `aipres` in a directory produces a session tied to that directory. Changing projects is just `cd`. Committing the working directory to git captures slides, chat history, and any project-local theme as a versioned artifact.

---

## Decision

Store session data directly in the **working directory**, not in `~/.aipres/sessions/` and not in a hidden subdirectory:

```
<working-dir>/            # working directory IS the session
├── slides.json           # slide model (theme, revealOptions, slides)
├── chat.json             # chat history
├── presentation.html     # rendered output
└── theme/                # project-local theme (optional)
    ├── theme.json
    └── custom.css

~/.aipres/                # global data (unchanged)
├── config.json
├── credentials.json
└── themes/
    └── <name>/
        ├── theme.json
        └── custom.css
```

The `theme` field in `slides.json` accepts either a **theme name** or a **path**:

- Name (no path separators): resolved against `~/.aipres/themes/<name>/`, then Reveal.js built-ins.
- Path (starts with `./`, `../`, or `/`): resolved relative to the working directory (or as absolute) and loaded directly.

This single field covers all theme scenarios — built-in, global user theme, project-local (`"./theme"`), and monorepo shared (`"../shared/corp-theme"`) — without a separate config file.

The working directory defaults to `process.cwd()`. A `-w <path>` / `--work-dir <path>` option on the root command allows an explicit override.

The named session system (`~/.aipres/sessions/`, `--pres`, `aipres pres` subcommands, `.active` file, `/pres` slash commands) is removed.

---

## Rationale

### Why the current directory

The current directory is the natural anchor for project-scoped tools. Users already `cd` into project directories before running build tools, linters, and version control commands. Using the same anchor for `aipres` removes a separate mental namespace.

### Why session files live directly in the working directory

Placing `slides.json` and `chat.json` directly in the working directory makes them immediately visible and accessible. Hidden directories (dot-prefixed) are conventional for tool internals that users rarely need to touch directly; presentation files and their history are the primary output of the tool and should not be hidden. Keeping them at the top level also makes them obvious candidates for version control.

### Why a global `-w` option

Most aipres commands that involve session data (`aipres`, `aipres chat`, `aipres preview`, `aipres export`, `aipres reset`) need to know the working directory. A global option on the root command avoids repeating `-w` in the definition of each subcommand while providing a consistent CLI surface.

### Why remove named sessions

With directory-based sessions, named sessions add no value — each directory already is a unique session. Keeping both systems would create two competing mental models for the same concept.

### Why global config remains in `~/.aipres/`

Config is a user preference, not project state. A user's preferred model or language applies across all projects.

### Why the `theme` field accepts both names and paths

`slides.json` is always in the LLM's context, and the LLM controls the theme via the `set_theme` tool. Keeping the theme reference in `slides.json` means the LLM can set any theme — built-in, global, project-local, or a shared path — using the same field and the same tool, with no separate config file for the user to manage. A separate `aipres.json` for path-based theme overrides was considered but rejected: it would require users to edit a JSON file directly, which is a barrier for non-technical users, and it would split theme information across two files while the LLM can only reason about one.

### Why `theme` and `revealOptions` remain in `slides.json`

Separating presentation settings (`theme`, `revealOptions`) from slide content into a distinct config file was considered on separation-of-concerns grounds: `slides.json` would become pure agent-authored content, while a config file would hold human-controlled rendering settings. However, this separation provides less value than it appears. The LLM must be able to change the theme and reveal options on behalf of users who are not comfortable editing JSON directly — this is a first-priority usability requirement. If the LLM needs to modify these settings, they must be in the LLM's context, which always contains `slides.json`. Moving them to a separate file would require injecting that file into the LLM's context while also giving the LLM tools to write back to it — the same complexity as the current design, minus the simplicity of a single file. Keeping `theme` and `revealOptions` in `slides.json` maintains a single source of truth that the LLM can read and update via the existing `set_theme` and `set_reveal_option` tools.

### Why a single `theme/` directory rather than a named `themes/<name>/` hierarchy

A project typically has one custom theme. A named subdirectory hierarchy adds indirection without adding value. A single `theme/` directory is unambiguous and referenced as `"./theme"` in `slides.json`.

---

## Consequences

**Positive:**
- Sessions are implicit: no session management commands to learn
- `slides.json`, `chat.json`, and `theme/` are all version-controllable as a unit
- Monorepo projects can share a theme by setting `theme` to a relative path — no duplication
- The LLM can set any theme (name or path) via the existing `set_theme` tool
- Working-directory semantics align with `git`, `npm`, and other project-scoped tools
- CLI surface is simplified (remove `aipres pres` subcommands and `--pres` option)

**Negative:**
- Existing `~/.aipres/sessions/` data is not automatically migrated
- Path-based theme values in `slides.json` are less portable if the relative path changes (e.g., project is moved within the repository)

**Migration:**
- `~/.aipres/sessions/` directories are left in place; aipres no longer reads or writes them
- `needsSetup()` checks for `~/.aipres/config.json` (not `~/.aipres/`) so setup is not re-triggered for existing users
- Users with existing named sessions can migrate manually: copy `slides.json` and `chat.json` into the desired project directory

---

## Alternatives Considered

**Keep named sessions alongside directory sessions**
Allow both `--pres NAME` and `-w PATH`. Avoids a breaking change but doubles the mental model complexity. Ruled out.

**Auto-detect session by walking up the directory tree (like `.git`)**
If no `slides.json` is found in the current directory, walk parent directories. Familiar but can cause surprising behaviour (editing a parent project's slides). Ruled out.

**Use the directory path as a named session key**
Hash the cwd into a session name under `~/.aipres/sessions/`. Centralized but opaque; still requires a global registry mental model. Ruled out.

**Hidden `.aipres/` subdirectory in the working directory**
Mirrors `.git/`. But presentation files are primary outputs meant to be seen, not internal tool state. Ruled out.

**Move `theme` and `revealOptions` to a per-project config file**
Separating presentation settings from slide content was considered on separation-of-concerns grounds. Ruled out: the LLM must be able to change these settings on behalf of non-technical users, so they must remain in the LLM's context (`slides.json`) regardless. See Rationale above.

**Separate `aipres.json` for path-based theme override**
A per-project config file holding `themePath`. This was explored but introduces a file that (a) users would need to edit as JSON directly, (b) the LLM cannot update via its existing tools, and (c) splits theme information across two files. Since the `theme` field in `slides.json` is already in the LLM's context and the `set_theme` tool already exists, extending the field to accept paths achieves the same result with less complexity. Ruled out.
