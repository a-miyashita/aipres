import chalk from 'chalk';
import type { SlideModel } from '../model/types.js';
import type { Message, LLMProvider } from './provider.js';
import type { ToolName } from './tools.js';
import { TOOLS, buildSystemPrompt } from './tools.js';
import {
  addSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  setTheme,
  setRevealOption,
  type AddSlideInput,
} from '../model/operations.js';

function formatSummary(model: SlideModel): string {
  if (model.slides.length === 0) {
    return 'No slides yet.';
  }
  const lines = model.slides.map((slide, i) => {
    const title = slide.title ? `: ${slide.title}` : '';
    return `  [${i}] ${slide.layout}${title}`;
  });
  return `Current slides (${model.slides.length} total):\n${lines.join('\n')}`;
}

export function dispatchTool(
  toolName: ToolName,
  input: unknown,
  model: SlideModel
): { result: string; updatedModel: SlideModel } {
  const inp = input as Record<string, unknown>;

  try {
    switch (toolName) {
      case 'add_slide': {
        const r = addSlide(model, inp as unknown as AddSlideInput);
        if (!r.ok) return { result: `Error: ${r.error}`, updatedModel: model };
        return { result: `Slide added successfully. Total slides: ${r.value.slides.length}`, updatedModel: r.value };
      }

      case 'update_slide': {
        const index = inp['index'] as number;
        const patch = inp['patch'] as Parameters<typeof updateSlide>[2];
        const r = updateSlide(model, index, patch);
        if (!r.ok) return { result: `Error: ${r.error}`, updatedModel: model };
        return { result: `Slide ${index} updated successfully.`, updatedModel: r.value };
      }

      case 'delete_slide': {
        const index = inp['index'] as number;
        const r = deleteSlide(model, index);
        if (!r.ok) return { result: `Error: ${r.error}`, updatedModel: model };
        return { result: `Slide ${index} deleted. Remaining slides: ${r.value.slides.length}`, updatedModel: r.value };
      }

      case 'reorder_slides': {
        const from = inp['from'] as number;
        const to = inp['to'] as number;
        const r = reorderSlides(model, from, to);
        if (!r.ok) return { result: `Error: ${r.error}`, updatedModel: model };
        return { result: `Slide moved from position ${from} to ${to}.`, updatedModel: r.value };
      }

      case 'set_theme': {
        const theme = inp['theme'] as string;
        const r = setTheme(model, theme);
        if (!r.ok) return { result: `Error: ${r.error}`, updatedModel: model };
        return { result: `Theme set to "${theme}".`, updatedModel: r.value };
      }

      case 'set_reveal_option': {
        const key = inp['key'] as string;
        const value = inp['value'];
        const r = setRevealOption(model, key, value);
        if (!r.ok) return { result: `Error: ${r.error}`, updatedModel: model };
        return { result: `Reveal option "${key}" set to ${JSON.stringify(value)}.`, updatedModel: r.value };
      }

      case 'show_summary': {
        const summary = formatSummary(model);
        console.log('\n' + chalk.cyan('── Slide Summary ──'));
        console.log(summary);
        console.log(chalk.cyan('──────────────────') + '\n');
        return { result: summary, updatedModel: model };
      }

      default:
        return { result: `Unknown tool: ${toolName}`, updatedModel: model };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { result: `Error executing ${toolName}: ${msg}`, updatedModel: model };
  }
}

export async function runToolUseLoop(
  systemPrompt: string,
  messages: Message[],
  model: SlideModel,
  provider: LLMProvider
): Promise<{ updatedModel: SlideModel; messages: Message[] }> {
  let currentModel = model;
  let currentMessages = [...messages];

  let response = await provider.chat(systemPrompt, currentMessages, TOOLS);

  // Append assistant message
  const assistantContent: import('./provider.js').ContentBlock[] = [];
  if (response.text) {
    assistantContent.push({ type: 'text', text: response.text });
  }
  for (const tu of response.toolUses) {
    assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
  }
  currentMessages.push({ role: 'assistant', content: assistantContent });

  // Process tool uses in a loop
  while (response.toolUses.length > 0) {
    const toolResults: import('./provider.js').ContentBlock[] = [];

    for (const toolUse of response.toolUses) {
      const { result, updatedModel } = dispatchTool(
        toolUse.name as ToolName,
        toolUse.input,
        currentModel
      );
      currentModel = updatedModel;

      toolResults.push({
        type: 'tool_result',
        // Note: for Anthropic API compatibility we need tool_use_id
        ...(toolUse.id ? { tool_use_id: toolUse.id } : {}),
        content: result,
      } as import('./provider.js').ContentBlock);
    }

    currentMessages.push({ role: 'user', content: toolResults });

    response = await provider.chat(systemPrompt, currentMessages, TOOLS);

    const nextAssistantContent: import('./provider.js').ContentBlock[] = [];
    if (response.text) {
      nextAssistantContent.push({ type: 'text', text: response.text });
    }
    for (const tu of response.toolUses) {
      nextAssistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
    }
    currentMessages.push({ role: 'assistant', content: nextAssistantContent });
  }

  return { updatedModel: currentModel, messages: currentMessages };
}
