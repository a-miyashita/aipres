# ADR-0001: CLI Over GUI

**Status**: Accepted
**Date**: 2026-03

## Context

aipres needs a user interface. The primary alternatives are a CLI (terminal), a web-based GUI, or a desktop app. The core product proposition is that users create presentations through natural language conversation with an LLM — with no direct slide editing required.

A key requirement is the ability to read files from the local filesystem without friction (e.g., "read the documents in `~/projects/Q4-report/` and synthesize a presentation"). This is a first-class use case because real presentations are always synthesized from existing materials.

## Decision

Adopt a CLI as the sole interface, modeled after Claude Code.

## Alternatives Considered

**Web-based GUI**
- Would require a file upload mechanism for local documents, which adds friction and breaks the "just give me a path" workflow.
- Browser security sandbox prevents direct filesystem access.
- Substantially more development effort (frontend framework, auth, hosting).
- Rejected.

**Desktop app (Electron / Tauri)**
- Full filesystem access possible.
- However, it introduces packaging complexity, auto-update machinery, and OS-specific testing burden.
- The target user (developer, technical writer, power user) is already comfortable with a terminal.
- Rejected for now; not ruled out for a future GUI layer built on top of the CLI core.

**CLI (chosen)**
- Full, unrestricted filesystem access.
- Composable with other tools (scripts, CI pipelines, piping).
- Zero-friction install: `npm install -g aipres` or `npx aipres`.
- The interaction model (chat loop in terminal) is already familiar to Claude Code users.
- The presentation output is a self-contained HTML file — no GUI needed to consume the result.

## Consequences

- The tool is best suited for users comfortable with a terminal. It is not aimed at non-technical users (at least in this phase).
- A future GUI layer (e.g., Electron app wrapping the CLI core) remains possible and is not architecturally excluded.
- The chat loop design (`readline`-based REPL with slash commands) follows directly from this decision.
