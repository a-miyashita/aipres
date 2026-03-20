# Multi-Session Specification

## Overview

Allow users to maintain multiple independent presentations simultaneously. Each presentation lives in a named **session**. Sessions can be created, switched, renamed, and deleted — both from the CLI and from within the chat loop.

---

## 1. Session Model

A session contains:
- **name** — user-defined identifier
- **slides** — `SlideModel` (the presentation content)
- **messages** — `Message[]` (the LLM chat history)

Sessions are independent: switching sessions replaces both the slide model and the conversation history in the active chat.

---

## 2. Storage Layout

```
~/.aipres/sessions/
├── .active           # plain text: name of the active session
└── <name>/
    ├── slides.json   # SlideModel (was ~/.aipres/state/current.json)
    └── chat.json     # Message[]  (was ~/.aipres/state/session.json)
```

The old `~/.aipres/state/` directory is superseded. See §8 for migration.

---

## 3. Session Name Rules

- Pattern: `/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/`
- Must begin with an alphanumeric character
- May contain letters, digits, hyphens, underscores
- Case-sensitive; max 64 characters
- Initial default session name: `untitled`

---

## 4. CLI Commands — `aipres pres`

The primary subcommand is `pres`. `presentation` is a full-length alias for users who prefer it; both are always available.

| Command | Description |
|---------|-------------|
| `aipres pres list` | List all presentations with slide counts and active marker |
| `aipres pres new <name>` | Create a new presentation and make it active |
| `aipres pres switch <name>` | Switch the active presentation |
| `aipres pres rename <old> <new>` | Rename a presentation |
| `aipres pres delete <name>` | Delete a presentation (prompts for confirmation) |

`aipres pres new` immediately activates the new presentation so the user can start working on it without a separate `switch` step.

`aipres pres delete` allows deleting any presentation including the last one. If no presentations remain after deletion, the next `aipres` invocation automatically creates a fresh `untitled` presentation.

### Optional pres flag on main command

```
aipres [--pres <name>]
aipres chat [--pres <name>]
```

Starts the chat (and preview, if applicable) using the specified session, making it active. Useful for quickly jumping to a session from a shell alias or script.

---

## 5. In-Chat Slash Commands

| Command | Description |
|---------|-------------|
| `/pres` | Show current presentation name and slide count |
| `/pres list` | List all presentations with slide counts |
| `/pres new <name>` | Create a new presentation and switch to it immediately |
| `/pres switch <name>` | Switch to an existing presentation |

Session switching within a running chat session:
1. Saves the current session (slides + messages)
2. Loads the new session's slides and messages
3. Updates `.active`
4. Triggers the preview server watcher to follow the new session's `slides.json`
5. The chat loop continues with the new session's conversation history

---

## 6. Output File Default

The default HTML export path changes from `./presentation.html` to `./<session-name>.html`.

### Config key `export.defaultFile`

- Type changes from `string` (required) to `string | undefined` (optional)
- If set in `~/.aipres/config.json`: the configured value is used as-is for all sessions
- If not set (default): the active session name determines the output path

```
active session "q4-review"  →  ./q4-review.html
active session "onboarding" →  ./onboarding.html
```

Users who want a fixed output path can still set `export.defaultFile` explicitly.

---

## 7. Preview Server and Watcher

The file watcher (`src/preview/watcher.ts`) currently watches a hardcoded path. It must be updated to accept a configurable path, and support switching the watched path when a session switch happens within a running `aipres start`.

**Approach:** `startWatcher(path)` accepts an initial path. When a session switch occurs in `chat.ts`, it calls an `onSessionSwitch(newName)` callback provided by `start.ts`. The callback updates the chokidar watcher (`watcher.unwatch(oldPath); watcher.add(newPath)`).

No changes to the preview server itself (`server.ts`) are needed — it already receives model updates via `updateServerModel()`.

---

## 8. Auto-Create on Empty State

If `aipres` is started and no presentations exist (`.active` is absent or the referenced directory is missing), a fresh `untitled` presentation is created automatically before entering the chat. No user action is required.

This also covers the case where the user has deleted all presentations: the next invocation silently recovers.

## 9. Migration from v0.2.x

On first startup after upgrading, `state.ts` detects the presence of the old `~/.aipres/state/` directory:

1. Create `~/.aipres/sessions/untitled/`
2. Copy `~/.aipres/state/current.json` → `~/.aipres/sessions/untitled/slides.json` (if it exists)
3. Copy `~/.aipres/state/session.json` → `~/.aipres/sessions/untitled/chat.json` (if it exists)
4. Write `untitled` to `~/.aipres/sessions/.active`
5. Leave the old `state/` files in place (do not delete — safe rollback)

Migration runs once. It is skipped if `~/.aipres/sessions/.active` already exists.

---

## 9. Module Changes Summary

| Module | Change |
|--------|--------|
| `src/model/state.ts` | Replace path functions with session-aware equivalents; add session CRUD; add migration |
| `src/model/types.ts` | Add `SessionInfo` type; make `Config.export.defaultFile` optional |
| `src/preview/watcher.ts` | Accept `slidesPath` parameter; support dynamic path switching |
| `src/cli/start.ts` | Pass `slidesPath` to watcher; wire `onSessionSwitch` callback from `runChat` |
| `src/cli/chat.ts` | Add `/session` slash commands; accept `onSessionSwitch` callback in options |
| `src/cli/session.ts` | New: implements `aipres pres` subcommand handlers |
| `bin/aipres.ts` | Register `pres` command (+ `presentation` alias) with subcommands; add `--pres` flag to main commands |
| `src/config/config.ts` | Update default for `export.defaultFile` (now optional) |
