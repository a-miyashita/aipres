import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, Message, LLMResponse, Tool, ContentBlock, ToolUse } from './provider.js';
import { ApiError } from '../utils/errors.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
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
    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      return { role: m.role, content: m.content as Anthropic.ContentBlockParam[] };
    });

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages as Anthropic.MessageParam[],
      tools: tools as Anthropic.Tool[],
    });

    let fullText = '';
    const toolUses: ToolUse[] = [];
    const pendingToolUse: Record<string, { id: string; name: string; inputJson: string }> = {};

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          // text block starting
        } else if (event.content_block.type === 'tool_use') {
          pendingToolUse[event.index] = {
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: '',
          };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          process.stdout.write(event.delta.text);
          fullText += event.delta.text;
        } else if (event.delta.type === 'input_json_delta') {
          const pending = pendingToolUse[event.index];
          if (pending) {
            pending.inputJson += event.delta.partial_json;
          }
        }
      } else if (event.type === 'content_block_stop') {
        const pending = pendingToolUse[event.index];
        if (pending) {
          try {
            const input = JSON.parse(pending.inputJson || '{}');
            toolUses.push({
              id: pending.id,
              name: pending.name,
              input,
            });
          } catch {
            toolUses.push({
              id: pending.id,
              name: pending.name,
              input: {},
            });
          }
          delete pendingToolUse[event.index];
        }
      }
    }

    if (fullText) {
      process.stdout.write('\n');
    }

    return { text: fullText, toolUses };
  }
}
