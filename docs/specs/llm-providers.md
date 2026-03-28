# LLM Providers Specification

## Supported Providers

| `llm.provider` value | Description | Default model |
|---|---|---|
| `anthropic` *(default)* | Anthropic Claude | `claude-sonnet-4-5` |
| `openai` | OpenAI Chat Completions API | `gpt-4o` |
| `copilot` | GitHub Copilot API | `gpt-4o` |
| `local` | OpenAI-compatible local endpoint (e.g. Ollama) | `llama3.1` |

`openai` also covers OpenAI Codex models (e.g. `o4-mini`) — set `llm.model` to the desired model name.

---

## Configuration

### Config schema (`~/.aipres/config.json`)

```typescript
interface LLMConfig {
  provider: 'anthropic' | 'openai' | 'copilot' | 'local';
  model: string;
  language: string;   // BCP 47 locale, e.g. "en", "ja"
  baseUrl?: string;   // custom API base URL (required for some local setups)
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

| Variable | Config key overridden |
|---|---|
| `AIPRES_PROVIDER` | `llm.provider` |
| `AIPRES_MODEL` | `llm.model` |
| `AIPRES_BASE_URL` | `llm.baseUrl` |
| `AIPRES_LANGUAGE` | `llm.language` |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GITHUB_TOKEN` | GitHub Copilot token |

### Example configurations

```jsonc
// OpenAI GPT-4o
{ "llm": { "provider": "openai", "model": "gpt-4o" } }

// GitHub Copilot
{ "llm": { "provider": "copilot", "model": "gpt-4o" } }

// Ollama with default settings
{ "llm": { "provider": "local", "model": "llama3.1" } }

// Ollama on non-default port
{ "llm": { "provider": "local", "model": "qwen2.5:14b", "baseUrl": "http://localhost:11434/v1" } }

// Custom OpenAI-compatible endpoint
{ "llm": { "provider": "openai", "model": "my-model", "baseUrl": "https://my-gateway.internal/v1" } }
```

---

## API Key Management

API keys are stored per-provider in `~/.aipres/credentials.json` (mode 0600).

| Provider | Keychain key | Environment variable |
|---|---|---|
| `anthropic` | `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `openai` | `OPENAI_API_KEY` |
| `copilot` | `copilot` | `GITHUB_TOKEN` |
| `local` | — (no key needed) | — |

`aipres config set llm.apiKey <value>` stores the key under the currently active provider's keychain entry.

---

## Provider Factory (`src/llm/factory.ts`)

`createProvider(config)` instantiates the correct class:

| `provider` | Class | `baseUrl` default |
|---|---|---|
| `anthropic` | `AnthropicProvider` | — |
| `openai` | `OpenAICompatibleProvider` | `https://api.openai.com/v1` |
| `copilot` | `OpenAICompatibleProvider` | `https://api.githubcopilot.com` |
| `local` | `OpenAICompatibleProvider` | `http://localhost:11434/v1` |

---

## `AnthropicProvider`

- Uses `client.messages.stream()` for streaming responses
- Streams text tokens to `process.stdout` in real time
- Retry: 3 attempts, exponential backoff (1s, 2s)

---

## `OpenAICompatibleProvider`

Covers `openai`, `copilot`, and `local`. Uses the `openai` npm package (≥ 4.0).

### Tool schema conversion

Internal `Tool` uses Anthropic's `input_schema` field. Converted to OpenAI format before each call:

```typescript
// Internal → OpenAI
{ type: 'function', function: { name, description, parameters: tool.input_schema } }
```

### Message format conversion

| Internal `ContentBlock.type` | OpenAI equivalent |
|---|---|
| `text` (user) | `content: string` on user message |
| `image` | Not supported — throws `UnsupportedFeatureError` |
| `text` (assistant) | `content: string` on assistant message |
| `tool_use` (assistant) | `tool_calls[]` on assistant message |
| `tool_result` (user) | `{ role: 'tool', tool_call_id, content }` message |

Multi-content assistant messages (text + tool_use) are collapsed into one OpenAI message with both `content` and `tool_calls`.

### Streaming

Uses `openai.chat.completions.stream()`. Text deltas are written to `process.stdout`. Tool call argument chunks are accumulated and parsed as JSON after the stream ends.

### Retry

3 attempts, exponential backoff (1s, 2s). Throws `ApiError` on exhaustion.

### Finish reason

`finish_reason: 'length'` logs a warning and returns the partial response.

---

## Local LLM Requirements

Local models must support **native function/tool calling** via the OpenAI-compatible API. aipres does not implement prompt-engineering fallbacks for models that lack this.

### Compatible models (Ollama)

| Model | Minimum size | Tool calling |
|---|---|---|
| `llama3.1` | 8B | ✅ |
| `llama3.2` | 3B | ✅ |
| `qwen2.5` | 7B | ✅ |
| `mistral-nemo` | — | ✅ |
| `phi4` | — | ✅ |
| `deepseek-r1` | 8B | ✅ (varies by quantization) |
| `gemma3` | — | ✅ (experimental) |

If a model returns no tool calls when expected, the tool-use loop terminates with the text response. This is not a hard error.

---

## Setup Wizard (`src/config/setup.ts`)

The first-run wizard (triggered when `~/.aipres/config.json` is absent) prompts:

1. **Provider selection** — Anthropic / OpenAI / GitHub Copilot / Local (Ollama)
2. **Provider-specific inputs:**
   - Anthropic: API key
   - OpenAI: API key, optional model override
   - Copilot: GitHub token
   - Local: base URL (default `http://localhost:11434/v1`), model name

---

## Feature Parity

| Feature | Anthropic | OpenAI | Copilot | Local |
|---|---|---|---|---|
| Tool calling | ✅ | ✅ | ✅ | ✅ (model-dependent) |
| Streaming text | ✅ | ✅ | ✅ | ✅ |
| Image input | ✅ | ❌ | ❌ | ❌ |
| Retry logic | ✅ | ✅ | ✅ | ✅ |

Image input is Anthropic-only. Non-Anthropic providers throw `UnsupportedFeatureError` when image blocks are present in the message.
