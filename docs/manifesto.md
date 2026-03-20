# aipres — Project Manifesto

## Vision

**Create any business presentation through natural language alone — no GUI, no manual editing.**

aipres lets you describe what you want in plain language and receive a complete, well-designed Reveal.js presentation. The conversation is the interface. The slides are the output.

## The Problem We're Solving

Modern presentation tools (PowerPoint, Google Slides, Keynote) require the user to perform every action manually: click, drag, type, format, arrange. This is time-consuming, interrupts thinking, and produces inconsistent results. More importantly, the raw materials for a presentation — documents, data, meeting notes, files on your computer — are scattered and must be manually synthesized.

LLMs can do all of this synthesis automatically, but existing tools require the user to copy-paste into a GUI and then re-edit by hand.

## Core Philosophy

### 1. Conversation-Only Interaction

The user should never need to directly edit a slide. Every change — adding slides, adjusting text size, changing the theme, reordering content — is expressed as a natural language request and executed by the LLM.

This is not a feature constraint. It is the design. Direct editing would undermine the core value: letting the LLM handle structure, layout, and formatting decisions while the user focuses on content and intent.

### 2. Local-First, Filesystem-Aware

A presentation is never made from nothing. It is synthesized from existing information: documents, reports, spreadsheets, code, notes. aipres is a CLI tool so that it can access the local filesystem without restriction — just like Claude Code.

Users should be able to say:
- "Read the files in `~/projects/Q4-report/` and create a summary presentation."
- "Turn this CSV into a data slide with key takeaways."
- "Combine the spec doc and the meeting notes into a 10-slide proposal."

No file upload dialog. No copy-paste. Just a path.

### 3. Business-Grade Expressiveness

The output must be presentation-ready for real business contexts: investor decks, internal reports, technical proposals, training materials. This requires the full expressiveness of tools like Google Slides:

- Rich inline text formatting (size, color, weight, emphasis)
- Tables, code blocks, images
- Consistent visual themes
- Speaker notes
- Smooth transitions

Markdown alone is insufficient for this goal. The content model must support the same level of formatting control that a human would use in a GUI tool.

### 4. LLM as the Only Editor

The data model and the LLM tool interface are co-designed. Every capability exposed in the data model must be expressible through a natural language request. If the LLM cannot reliably generate it, it should not be in the model.

This constraint shapes every design decision:
- Formats must be ones the LLM generates reliably (HTML subset over bespoke AST)
- Tool schemas must be clear and unambiguous
- Field names and values must be self-documenting

## Target Users

- **Individual contributors** who need to produce professional presentations quickly from their own materials
- **Teams** that want consistent, repeatable presentation workflows
- **Developers and technical writers** who are comfortable with a CLI and prefer to work without leaving the terminal

## Non-Goals

- A WYSIWYG editor or GUI overlay
- Real-time collaborative editing
- Replacing Reveal.js (we build on top of it)
- Supporting presentation formats other than HTML/Reveal.js (for now)
- Cloud sync or hosted service

## Why CLI?

The CLI is not a limitation — it is the reason the tool can be genuinely useful:

1. **Filesystem access**: Read any file on the machine without upload friction.
2. **Composability**: Pipe into other tools, run in CI, script repetitive tasks.
3. **No installation overhead**: `npx aipres` or a global install, nothing more.
4. **Claude Code symmetry**: Users already familiar with Claude Code will understand the interaction model immediately.

## Long-Term Goal

Full parity with Google Slides' expressiveness, delivered entirely through natural language. Every formatting option, layout choice, and visual decision that a designer would make manually should be achievable by describing it in a sentence.
