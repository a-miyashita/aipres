# CLAUDE.md

## Documentation

- `docs/manifesto.md` — project vision and philosophy
- `docs/architecture.md` — technical architecture and module map
- `docs/rich-text-spec.md` — HTML subset spec for slide body content (pending implementation)
- `docs/adr/` — Architecture Decision Records (why decisions were made)

Read `docs/architecture.md` first to understand the codebase.

## Guidelines

- **Before making a significant architectural decision, check `docs/adr/` for prior decisions.** If you make a new significant decision, record it as a new ADR.
- All documentation is written in English.
- `ora` spinners in chat context must use `discardStdin: false` (prevents stdin from being paused between prompts).
- Do not implement features that depend on `body` being Markdown — that field is being migrated to HTML subset. See `docs/rich-text-spec.md`.
