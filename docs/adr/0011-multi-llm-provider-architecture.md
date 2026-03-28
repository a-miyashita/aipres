# ADR-0011: Multi-LLM Provider Architecture

**Status:** Approved
**Date:** 2026-03-22

---

## Context

aipres currently supports only Anthropic Claude as its LLM backend. The `LLMProvider` interface in `src/llm/provider.ts` was designed for extensibility, but no second implementation exists.

The requirements are:

- **Required:** Local LLM support (Ollama / llama.cpp server)
- **Desired:** OpenAI API, GitHub Copilot API, Codex

The core challenge is that aipres depends heavily on **tool calling** (function calling): all slide mutations are performed via 7 discrete tools, not by parsing free-form text. Any provider must reliably support structured tool calls with multi-turn history.

A secondary challenge is message format: the internal `Message[]` history uses Anthropic-style `ContentBlock[]` (with `tool_use`, `tool_result` blocks). OpenAI-compatible APIs use a different format (`tool_calls` array on the assistant message; separate `role: 'tool'` messages for results).

---

## Options Considered

### Option A — Per-Provider Classes (one class per service)

Implement `AnthropicProvider`, `OpenAIProvider`, `CopilotProvider`, `CodexProvider`, `OllamaProvider` as separate classes.

**Pros:** Each class can handle service-specific quirks (auth headers, retry logic, model constraints).

**Cons:** OpenAI, Copilot, Codex, and Ollama all expose the same OpenAI-compatible REST API. Creating four separate classes for four services that differ only in `baseUrl` and auth header duplicates substantial code with no architectural benefit.

### Option B — Two-class model: AnthropicProvider + OpenAICompatibleProvider

Keep `AnthropicProvider` and add a single parameterized `OpenAICompatibleProvider` that accepts `baseUrl`, `apiKey`, and `model`. All OpenAI-compatible providers (OpenAI, Copilot, Codex, Ollama, llama.cpp) are expressed as different configurations of this one class.

**Pros:** DRY. The OpenAI Chat Completions API has become a de-facto standard; local LLM runtimes (Ollama ≥0.1.9, llama.cpp server ≥b3000) expose it without modification. A single class covers the interface across the entire space.

**Cons:** "OpenAI-compatible" is an interface specification, not a behavioral guarantee. Tool calling reliability, streaming chunk structure, and JSON schema enforcement vary significantly between providers and models — particularly for local LLMs. `OpenAICompatibleProvider` cannot fully normalize all divergences; some combinations of provider and model will produce degraded or broken behavior. This is an accepted limitation documented in the Consequences section.

### Option C — LLM Proxy (LiteLLM / Ollama as universal adapter)

Require users to run a local OpenAI-compatible proxy that translates all backends. aipres implements only one provider.

**Pros:** Maximum simplicity in aipres code.

**Cons:** Mandatory external runtime dependency. Breaks the tool's zero-setup-friction philosophy. Unacceptable for a first-class local LLM experience.

### Option D — Plugin system (dynamic provider registration)

A registry where providers are discovered from `~/.aipres/providers/` or `node_modules/aipres-provider-*`.

**Pros:** Infinite extensibility.

**Cons:** Significant engineering overhead for a feature set that can be covered by two well-defined classes. Premature abstraction.

---

## Decision

**Option B — Two-class model: `AnthropicProvider` + `OpenAICompatibleProvider`.**

A new `provider` field is added to `llm` config. A factory function (`createProvider`) instantiates the correct class based on this field. The internal `Message[]` format remains the canonical Anthropic-style representation; `OpenAICompatibleProvider` translates to and from OpenAI format at the boundary.

Provider-to-config mapping:

| User intent | `provider` | `baseUrl` (if non-default) |
|---|---|---|
| Anthropic Claude | `anthropic` | — |
| OpenAI GPT | `openai` | — |
| GitHub Copilot | `copilot` | — |
| OpenAI Codex (o4-mini etc.) | `openai` | — (same API, different model) |
| Ollama (local) | `local` | `http://localhost:11434/v1` (default) |
| llama.cpp server | `local` | `http://localhost:8080/v1` |
| Any OpenAI-compatible endpoint | `openai` | custom URL |

---

## Rationale

### Anthropic-style ContentBlock as canonical internal format

Anthropic's message format is strictly more expressive than OpenAI's:

- Content is a typed union (`text`, `tool_use`, `tool_result`, `image`) — each block carries its own semantics
- Tool calls and results are first-class content blocks, co-located with text in the same message
- Multiple content blocks of different types per message are natively supported

In contrast, OpenAI's format requires:

- Overloading assistant messages with a separate `tool_calls` array alongside a `content` string
- Splitting tool results into separate `role: 'tool'` messages, fragmenting what is logically a single exchange
- Implicit structural relationships encoded across multiple message objects

Anthropic-style `ContentBlock[]` is therefore the canonical internal representation, and `OpenAICompatibleProvider` treats OpenAI's format as a *projection* of this richer model. The lossy direction (Anthropic → OpenAI) is localized entirely within the provider class; `dispatcher.ts` and the rest of the system operate exclusively in the canonical format.

### OpenAI-compatible format as the secondary implementation surface

The OpenAI Chat Completions API is supported natively by Ollama, llama.cpp, Jan, LM Studio, vLLM, and many cloud providers. Implementing `OpenAICompatibleProvider` against the `openai` npm SDK gains support for all of these through a single class. This is why the non-Anthropic providers are grouped under one implementation rather than given individual classes.

### Tool calling is a hard requirement

aipres uses tool calling for every slide mutation. Providers that do not support structured function calls cannot participate in the main chat loop. For local LLMs, this means:

- **Ollama:** supported for models with native tool support (Llama 3.1+, Qwen 2.5, Mistral Nemo). The `ollama list` output can guide model selection.
- **llama.cpp server:** supported when compiled with grammar/JSON schema support and using a compatible model.

Models without reliable tool calling support are **not compatible** with aipres. The spec documents the minimum model requirements and the error message surfaced when tool calling is absent.

### Message format translation is fully encapsulated

`dispatcher.ts` builds message history using the canonical `ContentBlock[]` format. `OpenAICompatibleProvider.chat()` translates this internally:

- `{type: 'tool_use', id, name, input}` → `tool_calls` entry on assistant message
- `{type: 'tool_result', tool_use_id, content}` → `{role: 'tool', tool_call_id, content}` message

No changes to `dispatcher.ts` are required. The translation boundary is entirely inside the provider class.

### Streaming token output is preserved

The current `AnthropicProvider` streams text tokens to `process.stdout` during `doChat()`. `OpenAICompatibleProvider` implements the same streaming behavior using the `openai` SDK's `stream()` API, maintaining the real-time terminal output that is central to the UX.

### Scope of divergence handling within OpenAICompatibleProvider

"OpenAI-compatible" specifies an interface, not identical behavior. Known divergences between providers and local models include:

| Divergence | Source | Handling |
|---|---|---|
| `finish_reason` absent or null | Some local runtimes | Tolerated; treated as `'stop'` |
| `tool_calls` delivered as a single chunk instead of streamed deltas | Some Ollama versions | Handled; `openai` SDK normalizes this |
| Unparseable or empty `function.arguments` JSON | Small/undertrained models | Caught at parse; tool dispatch receives `{}` and returns an error result to the LLM |
| Schema non-enforcement (model ignores `required` fields) | Local models, no API-level validation | Not handled; results in tool dispatch errors visible to the LLM in the next turn |
| Model emits only text when tools are expected | Incompatible models | Not handled; the tool-use loop terminates with no slide changes |

**Acceptable divergence (handled within `OpenAICompatibleProvider`):** Structural variations in streaming, missing metadata fields, JSON parse failures on tool arguments.

**Unacceptable divergence (not handled; warrants a separate class or explicit non-support):** Fundamentally different auth mechanisms beyond `Authorization: Bearer`, custom wire protocols, or models requiring prompt-engineering fallbacks to simulate tool calling.

The rule for future maintainers: if a provider divergence can be handled with a small conditional (< ~20 lines, no new state), it belongs in `OpenAICompatibleProvider`. If it requires a distinct behavioral path or protocol, it warrants a new class or an explicit entry in the unsupported list below.

### Provider and model compatibility matrix

| Provider / Model | Tool calling | Notes |
|---|---|---|
| Anthropic Claude (all) | ✅ Reliable | Canonical provider |
| OpenAI GPT-4o, GPT-4.1 | ✅ Reliable | — |
| OpenAI o1 / o3 / o4-mini | ⚠️ Varies | Reasoning models may behave differently under tool use; test before use |
| GitHub Copilot (gpt-4o backend) | ✅ Reliable | — |
| Ollama + llama3.1 (8B+) | ✅ Generally reliable | Recommended minimum for local use |
| Ollama + llama3.2 (3B) | ⚠️ Unreliable | Small model; frequent multi-tool failures |
| Ollama + qwen2.5 (7B+) | ✅ Generally reliable | — |
| Ollama + mistral-nemo | ✅ Generally reliable | — |
| Ollama + phi4 | ✅ Generally reliable | — |
| Ollama + deepseek-r1 | ⚠️ Mixed | Thinking-token output may interfere with tool argument parsing |
| Ollama + gemma3 | ⚠️ Experimental | Tool calling support not yet stable |
| Any model < 7B parameters | ❌ Not recommended | Tool calling quality too low for reliable slide editing |
| llama.cpp server | Same as model matrix above | Behavior follows the loaded model, not the runtime |

---

## Consequences

- A new `provider` field (`'anthropic' | 'openai' | 'copilot' | 'local'`) is added to `Config.llm`.
- A new optional `baseUrl` field is added to `Config.llm` (used by `local` and custom `openai` configs).
- The `credentials.json` keychain gains support for multiple provider keys (`openai`, `copilot`).
- The first-run setup wizard (`setup.ts`) is updated to prompt for provider selection.
- `architecture.md` and `README.md` are updated to document the new configuration keys.
- Local LLM support requires no API key; `AIPRES_BASE_URL` env var overrides `baseUrl`.
- Image input (base64 `source` blocks) is **not supported** for OpenAI-compatible providers in this release; a future ADR will address vision input normalization.
- The `/reload` command will re-read config from disk, allowing mid-session provider or model changes without restarting.
