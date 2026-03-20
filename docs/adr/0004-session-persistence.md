# ADR-0004: Persist Chat Session History Across Restarts

**Status**: Accepted
**Date**: 2026-03

## Context

The LLM maintains context through the `messages` array (conversation history). In the initial implementation, this array was initialized to `[]` on every startup. Restarting the CLI discarded all prior conversation context, meaning the LLM had no memory of previously created slides even though the slide data (`current.json`) persisted.

A user who adds slides in one session and then restarts to continue building the presentation would find that the LLM has no recollection of what was discussed, requiring repetitive re-explanation.

## Decision

Persist the `messages` array to `~/.aipres/state/session.json` after each LLM turn, and reload it on startup.

- `saveSession(messages)` is called alongside `saveState(model)` after every turn.
- `loadSession()` is called at the start of `runChat()`, replacing the `[]` initialization.
- The `/reset` slash command clears both the slide state and the session history.
- On startup, if a prior session exists, the user sees: `Resuming session: N exchange(s), M slide(s).`

## Alternatives Considered

**No persistence (original behavior)**
- Simple. No state to manage for the session.
- Breaks the user experience for any multi-session workflow.
- Rejected.

**Summarize history on restart**
- On startup, if old messages exist, send them to the LLM with a "summarize what we discussed" prompt, then use the summary as the initial context.
- Reduces token cost for long sessions.
- Adds latency at startup and risks losing detail in the summary.
- Considered as a future optimization for very long sessions, not the initial approach.

**Full persistence (chosen)**
- Exact conversation history restored on restart.
- LLM has complete context; no information loss.
- Token cost increases with session length, but for typical presentation-building sessions (20–50 exchanges) this is manageable with the Sonnet model.
- Simple to implement and reason about.

## Consequences

- Session history accumulates indefinitely until `/reset` is run. For very long sessions, input token costs grow. A future optimization could truncate or summarize old history automatically.
- `session.json` is stored alongside `current.json` in `~/.aipres/state/`. The two files are treated as a unit — `/reset` clears both.
- Session format is validated with a Zod schema on load; a corrupt or outdated session file silently falls back to an empty history.
