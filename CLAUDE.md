# CLAUDE.md

## Documentation

All documentation should be written in English.

- `docs/manifesto.md` — project vision and philosophy
- `docs/architecture.md` — technical architecture and module map
- `docs/specs` — Specifications
- `docs/plans` — Implemetation plans 
- `docs/adr/` — Architecture decision records; ADR (why decisions were made)

## Project Workflow

With exceptions for minor bug fixes, all development follows a two-phase process: design followed by implementation. When in doubt, always proceed in design-then-implementation order.

### Design Phase

- Enter the design phase when instructed to "perform design work."
- Before beginning design, check `architecture.md` and `manifesto.md`
- Before making a significant architectural decision, check `docs/adr/` for prior decisions
- The design phase's primary objectives are to create:
  - Specifications
  - Implementation plans
  - ADR, when making a new architectural decision
    - Note no ADR should be changed in `Approved` state
- During the design phase, only the following activities are permitted:
  - Creating or updating documentation files
  - No coding is allowed during this phase

### Implementation Phase

- Enter the implementation phase when instructed to "perform implementation work."
- Before beginning design, change the status of ADR created in design phase to Approved
- In the implementation phase, thoroughly review both the specifications and implementation plans, then proceed with coding based on their contents.
- Once all tasks outlined in the implementation plan have been completed, delete the plan document.

## Guidelines

- `ora` spinners in chat context must use `discardStdin: false` (prevents stdin from being paused between prompts).
- Do not implement features that depend on `body` being Markdown — that field is being migrated to HTML subset. See `docs/rich-text-spec.md`.
