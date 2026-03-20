# ADR-0008: Multi-Session Storage Layout

**Status:** Accepted
**Date:** 2026-03-20

---

## Context

aipres currently supports a single presentation at a time. All state is stored in two files:
- `~/.aipres/state/current.json` — slide model
- `~/.aipres/state/session.json` — LLM chat history

Users want to work on multiple presentations in parallel and switch between them by name. Several storage and switching strategies were considered.

---

## Decision

Store each named session as a subdirectory under `~/.aipres/sessions/`:

```
~/.aipres/sessions/
├── .active           # active session name (plain text)
└── <name>/
    ├── slides.json
    └── chat.json
```

Track the active session in `.active` (a plain text file containing the session name). The preview server watcher is updated to follow the active session's `slides.json` dynamically.

---

## Rationale

### Why a directory per session

Keeping slides and chat as separate files within a session directory mirrors the existing separation (`current.json` / `session.json`) and makes each file independently readable without parsing a combined document. It also allows future additions (e.g., per-session assets or metadata) without changing the schema.

### Why `.active` as a plain text file

A single plain-text file is the simplest possible active-session pointer. It requires no parsing, is trivially writable, and survives partial failures (a corrupt `.active` can be fixed by the user with a text editor). A JSON registry was considered but adds schema overhead for what is essentially a single string.

### Dynamic watcher path vs. mirror file

Two approaches were evaluated for keeping the live preview in sync after a session switch:

**Option A (chosen): Dynamic watcher path**
`startWatcher(path)` takes the active session's `slides.json` path. When a session switch happens in `chat.ts`, it calls a callback in `start.ts`, which updates the chokidar watcher (`watcher.unwatch(old); watcher.add(new)`). One source of truth per session.

**Option B: Mirror to fixed path**
`saveState` always writes to both `sessions/<name>/slides.json` and `state/current.json`. The watcher continues to watch the fixed `current.json` path. No watcher changes needed, but creates a second copy of every slide model on every save, and the `state/` directory never fully goes away.

Option A is chosen because it avoids redundant writes and keeps `state/` as a migration artifact only. Chokidar supports `unwatch` + `add` on a live watcher, making dynamic path switching straightforward.

---

## Consequences

**Positive:**
- Clean per-session isolation: slides and history are co-located
- No redundant writes; `state/` directory becomes legacy-only after migration
- Session directories can be inspected, copied, or backed up as a unit
- Easy to extend (future: session metadata, per-session config, assets)

**Negative:**
- `start.ts` must wire a callback between `runChat` and the watcher, adding a small coupling
- Watcher path must be updated on session switch; a bug here would cause the preview to show the wrong session

**Migration:**
The old `state/current.json` and `state/session.json` are automatically migrated to `sessions/default/` on first launch. Old files are left in place to allow rollback.

---

## Alternatives Considered

**Single combined file per session (`<name>.json` containing both slides and messages)**
Simpler file layout, but loses the ability to watch only the slides file for changes (the watcher would fire on every chat turn, triggering unnecessary preview reloads). Ruled out.

**Database (SQLite)**
Would provide ACID transactions and efficient querying. Significant dependency and operational overhead for what is essentially a set of small JSON files. Ruled out.

**Named profiles via config**
Store session data under `~/.aipres/profiles/<name>/` and manage via the config system. Architecturally equivalent to the chosen design, just with different naming. No meaningful distinction.
