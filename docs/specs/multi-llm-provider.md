# Specification: Multi-LLM Provider Support

**Status:** Draft
**Date:** 2026-03-22
**Related ADR:** ADR-0011

---

## Overview

aipres will support multiple LLM backends via a two-class provider model:

- **`AnthropicProvider`** — existing implementation, unchanged
- **`OpenAICompatibleProvider`** — new implementation covering OpenAI, GitHub Copilot, Codex, and local LLMs (Ollama, llama.cpp)

Provider selection is controlled by a `provider` field in `llm` config.

---

## Supported Providers

| Provider value | Description | Default model | Requires API key |
|---|---|---|---|
| `anthropic` | Anthropic Claude (existing) | `claude-sonnet-4-5` | Yes (`ANTHROPIC_API_KEY`) |
| `openai` | OpenAI Chat Completions API | `gpt-4o` | Yes (`OPENAI_API_KEY`) |
| `copilot` | GitHub Copilot API | `gpt-4o` | Yes (`GITHUB_TOKEN`) |
| `local` | OpenAI-compatible local endpoint (Ollama default) | `llama3.1` | No |

`codex` is **not** a separate provider value. OpenAI Codex models (e.g. `o4-mini`, `codex-mini-latest`) are accessed via `provider: 'openai'` with the corresponding `model` value.

---

## Configuration Schema Changes

### New fields in `Config.llm`

```typescript
interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'copilot' | 'local';  // NEW — default: 'anthropic'
  model: string;
  language: string;
  baseUrl?: string;    // NEW — optional, used by 'local' and custom 'openai' endpoints
}
```

### Default values

```json
{
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "language": "ja"
  }
}
```

### Environment variable overrides

| Variable | Overrides |
|---|---|
| `AIPRES_PROVIDER` | `llm.provider` |
| `AIPRES_MODEL` | `llm.model` |
| `AIPRES_BASE_URL` | `llm.baseUrl` |
| `AIPRES_LANGUAGE` | `llm.language` |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GITHUB_TOKEN` | GitHub Copilot token |

### Example configurations

**OpenAI GPT-4o:**
```json
{ "llm": { "provider": "openai", "model": "gpt-4o" } }
```

**GitHub Copilot:**
```json
{ "llm": { "provider": "copilot", "model": "gpt-4o" } }
```

**Ollama (local default):**
```json
{ "llm": { "provider": "local", "model": "llama3.1" } }
```

**Ollama on non-default port:**
```json
{ "llm": { "provider": "local", "model": "qwen2.5:14b", "baseUrl": "http://localhost:11434/v1" } }
```

**llama.cpp server:**
```json
{ "llm": { "provider": "local", "model": "qwen2.5-14b-instruct", "baseUrl": "http://localhost:8080/v1" } }
```

**Custom OpenAI-compatible cloud endpoint:**
```json
{ "llm": { "provider": "openai", "model": "my-model", "baseUrl": "https://my-llm-gateway.internal/v1" } }
```

---

## API Key Management

The existing `keychain.ts` stores API keys per-provider. New provider keys are stored alongside the existing `anthropic` key:

| Provider | Keychain key | Env var override |
|---|---|---|
| `anthropic` | `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `openai` | `OPENAI_API_KEY` |
| `copilot` | `copilot` | `GITHUB_TOKEN` |
| `local` | — (no key needed) | — |

Keys are set via `aipres config set llm.apiKey <value>` (stores under the active provider's keychain key). The `loadConfig()` function resolves the API key based on the active `provider`.

---

## Provider Factory

A new `createProvider(config: ResolvedConfig): LLMProvider` function in `src/llm/factory.ts` instantiates the correct class:

```
provider = 'anthropic'  →  new AnthropicProvider(apiKey, model)
provider = 'openai'     →  new OpenAICompatibleProvider(apiKey, model, baseUrl ?? DEFAULT_OPENAI_BASE_URL)
provider = 'copilot'    →  new OpenAICompatibleProvider(apiKey, model, COPILOT_BASE_URL)
provider = 'local'      →  new OpenAICompatibleProvider('', model, baseUrl ?? DEFAULT_OLLAMA_BASE_URL)
```

Default base URLs:

| Provider | Default `baseUrl` |
|---|---|
| `openai` | `https://api.openai.com/v1` |
| `copilot` | `https://api.githubcopilot.com` |
| `local` | `http://localhost:11434/v1` |

---

## `OpenAICompatibleProvider` Behaviour

### Constructor

```typescript
class OpenAICompatibleProvider implements LLMProvider {
  constructor(apiKey: string, model: string, baseUrl: string)
}
```

Uses the `openai` npm package (`openai` ≥ 4.0). The `baseUrl` is passed to `new OpenAI({ baseURL: baseUrl, apiKey })`.

### Tool schema conversion

The internal `Tool` interface uses Anthropic's `input_schema` field. `OpenAICompatibleProvider` converts each tool to OpenAI format before the API call:

```typescript
// Internal Tool → OpenAI ChatCompletionTool
{
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  }
}
```

### Message format conversion

The internal `Message[]` uses Anthropic-style `ContentBlock[]`. `OpenAICompatibleProvider` converts inbound messages to OpenAI format before sending, and never modifies the canonical `Message[]` held by `dispatcher.ts`.

Conversion rules:

| Internal `ContentBlock.type` | OpenAI equivalent |
|---|---|
| `text` (in user message) | `content: string` on user message |
| `image` (`source` block) | Not supported (throws `UnsupportedFeatureError`) |
| `text` (in assistant message) | `content: string` on assistant message |
| `tool_use` (in assistant message) | Merged into `tool_calls[]` on the same assistant message |
| `tool_result` (in user message) | Converted to separate `{role: 'tool', tool_call_id, content}` message |

Multi-content assistant messages (text + tool_use blocks) are collapsed into one OpenAI assistant message with both `content` and `tool_calls`.

### Streaming

Uses `openai.chat.completions.stream()`. Text delta events (`chunk.choices[0].delta.content`) are written to `process.stdout` in real time. Tool call argument chunks (`chunk.choices[0].delta.tool_calls`) are accumulated until the stream ends, then parsed as JSON.

### Retry logic

Mirrors `AnthropicProvider`: 3 attempts, exponential backoff (1s, 2s). On exhaustion, throws `ApiError`.

### Finish reason handling

If the API returns `finish_reason: 'length'`, logs a warning to stderr and returns the partial response (consistent with current Anthropic behaviour for truncated responses).

---

## Local LLM Requirements

Local models must support **native function/tool calling** via the OpenAI-compatible API. aipres does not implement prompt-engineering fallbacks for models that lack this capability.

### Minimum compatible models (Ollama)

| Model | Min version | Tool calling |
|---|---|---|
| `llama3.1` | 8B or larger | ✅ |
| `llama3.2` | 3B or larger | ✅ |
| `qwen2.5` | 7B or larger | ✅ |
| `mistral` | `mistral-nemo` or larger | ✅ |
| `phi4` | — | ✅ |
| `deepseek-r1` | 8B or larger | ✅ (varies by quant) |
| `gemma3` | — | ✅ (experimental) |

Models not in this list may or may not support tool calling. The user is responsible for verifying compatibility.

### Error on missing tool support

If the API response contains no `tool_calls` when tool calls were expected (i.e., the model produced text only when it should have used a tool), `OpenAICompatibleProvider` returns the response as-is. The tool-use loop in `dispatcher.ts` will naturally terminate with no tool executions. This is not treated as a hard error — the user will see the model's text response and can proceed.

If the API returns an error indicating tools are unsupported (HTTP 400 with specific error codes), the provider throws a descriptive `ApiError` recommending a compatible model.

---

## Setup Wizard Changes (`setup.ts`)

The first-run wizard gains a provider selection step:

1. "Which LLM provider would you like to use?" — choices: Anthropic, OpenAI, GitHub Copilot, Local (Ollama)
2. Depending on selection:
   - Anthropic: prompt for `ANTHROPIC_API_KEY`
   - OpenAI: prompt for `OPENAI_API_KEY` and optional model override
   - Copilot: prompt for `GITHUB_TOKEN`
   - Local: prompt for base URL (default: `http://localhost:11434/v1`) and model name

---

## `aipres config` Changes

The following config keys become valid:

| Key | Example value |
|---|---|
| `llm.provider` | `local` |
| `llm.model` | `qwen2.5:14b` |
| `llm.baseUrl` | `http://localhost:11434/v1` |
| `llm.language` | `en` |
| `llm.apiKey` | *(stored in keychain for active provider)* |

---

## Feature Parity Limitations

| Feature | Anthropic | OpenAI | Copilot | Local |
|---|---|---|---|---|
| Tool calling | ✅ | ✅ | ✅ | ✅ (model-dependent) |
| Streaming text | ✅ | ✅ | ✅ | ✅ |
| Image input | ✅ | ❌ (future) | ❌ (future) | ❌ (future) |
| Retry logic | ✅ | ✅ | ✅ | ✅ |

Image input (`/image` command) is currently Anthropic-only. This limitation is documented in the UI when a non-Anthropic provider is active. Vision support for OpenAI-compatible providers is deferred to a future release.

---

## Package Dependencies

One new runtime dependency is added:

```json
"openai": "^4.0.0"
```

The `@anthropic-ai/sdk` dependency is retained for the Anthropic provider.

No new dependencies are required for local LLM support (Ollama exposes an HTTP API; the `openai` SDK handles the protocol).
