import OpenAI from 'openai';
import type { LLMProvider, Message, LLMResponse, Tool, ToolUse } from './provider.js';
import { ApiError } from '../utils/errors.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toOpenAITools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema as OpenAI.FunctionParameters,
    },
  }));
}

/**
 * Convert canonical Anthropic-style Message[] to OpenAI ChatCompletionMessageParam[].
 *
 * Canonical format uses ContentBlock[] with typed blocks (text, tool_use, tool_result).
 * OpenAI format splits these across different message structures:
 *   - tool_use blocks → tool_calls[] on an assistant message
 *   - tool_result blocks → separate {role: 'tool'} messages
 */
function toOpenAIMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam);
      continue;
    }

    if (msg.role === 'assistant') {
      let textContent = '';
      const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          textContent += block.text;
        } else if (block.type === 'tool_use' && block.id && block.name) {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }

      const assistantMsg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: textContent || null,
      };
      if (toolCalls.length > 0) {
        assistantMsg.tool_calls = toolCalls;
      }
      result.push(assistantMsg);
    } else {
      // role === 'user': may contain tool_result blocks (returned after tool execution)
      // Each tool_result becomes a separate role:'tool' message.
      // Any remaining text blocks become a single role:'user' message.
      const textBlocks: string[] = [];

      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          const b = block as unknown as Record<string, unknown>;
          const toolCallId = typeof b['tool_use_id'] === 'string' ? b['tool_use_id'] : '';
          const content = typeof b['content'] === 'string' ? b['content'] : '';
          result.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content,
          });
        } else if (block.type === 'text' && block.text) {
          textBlocks.push(block.text);
        }
      }

      if (textBlocks.length > 0) {
        result.push({ role: 'user', content: textBlocks.join('\n') });
      }
    }
  }

  return result;
}

export class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string, baseUrl: string) {
    this.client = new OpenAI({
      apiKey: apiKey || 'no-key',
      baseURL: baseUrl,
    });
    this.model = model;
  }

  async chat(
    systemPrompt: string,
    messages: Message[],
    tools: Tool[]
  ): Promise<LLMResponse> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await sleep(delay);
      }

      try {
        return await this.doChat(systemPrompt, messages, tools);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries - 1) {
          process.stderr.write(`\nRetrying (${attempt + 1}/${maxRetries - 1})...\n`);
        }
      }
    }

    throw new ApiError(`API call failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private async doChat(
    systemPrompt: string,
    messages: Message[],
    tools: Tool[]
  ): Promise<LLMResponse> {
    const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...toOpenAIMessages(messages),
    ];

    const stream = await this.client.chat.completions.stream({
      model: this.model,
      messages: openAIMessages,
      tools: toOpenAITools(tools),
      tool_choice: 'auto',
      max_tokens: 4096,
    });

    let fullText = '';
    // tool_calls accumulator: index → {id, name, argumentsJson}
    const pendingToolCalls: Record<number, { id: string; name: string; argumentsJson: string }> = {};

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      if (delta.content) {
        process.stdout.write(delta.content);
        fullText += delta.content;
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!pendingToolCalls[idx]) {
            pendingToolCalls[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', argumentsJson: '' };
          }
          if (tc.id) {
            pendingToolCalls[idx].id = tc.id;
          }
          if (tc.function?.name) {
            pendingToolCalls[idx].name += tc.function.name;
          }
          if (tc.function?.arguments) {
            pendingToolCalls[idx].argumentsJson += tc.function.arguments;
          }
        }
      }
    }

    if (fullText) {
      process.stdout.write('\n');
    }

    const toolUses: ToolUse[] = Object.values(pendingToolCalls).map(tc => {
      let input: unknown = {};
      try {
        input = JSON.parse(tc.argumentsJson || '{}');
      } catch {
        // malformed JSON: leave input as empty object; dispatcher will surface an error to the LLM
      }
      return { id: tc.id, name: tc.name, input };
    });

    return { text: fullText, toolUses };
  }
}
