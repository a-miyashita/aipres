import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import type { Tool } from './provider.js';
import type { ThemeDefinition } from '../model/types.js';
import type { Message, LLMProvider } from './provider.js';
import { broadcast } from '../preview/server.js';

export type ThemeToolName = 'update_css' | 'set_base_theme' | 'set_palette';

export const THEME_TOOLS: Tool[] = [
  {
    name: 'update_css',
    description: 'Replace the full custom CSS of the theme. Write complete, valid CSS.',
    input_schema: {
      type: 'object',
      properties: {
        css: { type: 'string', description: 'Complete new CSS content for custom.css' },
      },
      required: ['css'],
    },
  },
  {
    name: 'set_base_theme',
    description: 'Change the Reveal.js base theme that the custom CSS builds on.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          enum: [
            'black', 'white', 'league', 'beige', 'sky', 'night', 'serif',
            'simple', 'solarized', 'blood', 'moon', 'dracula',
            'black-contrast', 'white-contrast',
          ],
          description: 'Reveal.js built-in theme name',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'set_palette',
    description: 'Update palette colors. Partial updates are allowed — only provide the keys you want to change.',
    input_schema: {
      type: 'object',
      properties: {
        palette: {
          type: 'object',
          description: 'Palette color overrides (hex values, e.g. "#3b82f6")',
          properties: {
            accent:  { type: 'string' },
            muted:   { type: 'string' },
            danger:  { type: 'string' },
            success: { type: 'string' },
            warning: { type: 'string' },
            info:    { type: 'string' },
          },
        },
      },
      required: ['palette'],
    },
  },
];

const LOCALE_NAMES: Record<string, string> = {
  ja: 'Japanese',
  en: 'English',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  fr: 'French',
  de: 'German',
  ko: 'Korean',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
};

export function buildThemeSystemPrompt(language: string, sampleDescription: string): string {
  const langName = LOCALE_NAMES[language] ?? `the language identified by locale code "${language}"`;

  return `You are a Reveal.js theme designer working inside aipres.
Your job is to help the user create and refine a custom presentation theme through natural language.
All theme changes MUST be made through tool calls. Never output raw CSS directly.
Always respond in ${langName}.

## Theme structure

A theme consists of three parts:
1. **base theme** — a Reveal.js built-in theme that provides the foundational CSS variables and reset styles. Available: black, white, league, beige, sky, night, serif, simple, solarized, blood, moon, dracula, black-contrast, white-contrast.
2. **custom CSS** — a CSS file layered on top of the base theme. This is where you do most of your work.
3. **palette** — six named semantic colors (accent, muted, danger, success, warning, info) stored in theme.json. The renderer generates \`--color-palette-*\` CSS custom properties from these and applies them across all slides.

## Key Reveal.js CSS variables (set by the base theme)

\`\`\`
--r-background-color   page background
--r-main-color         default body text color
--r-main-font          body font stack
--r-main-font-size     base font size (typically 40–42px)
--r-heading-color      h1/h2/h3 color
--r-heading-font       heading font stack
--r-heading-font-weight
--r-heading-letter-spacing
--r-link-color
--r-selection-background-color
\`\`\`

Override these in custom CSS using \`:root { --r-main-color: #fff; }\` or by targeting Reveal.js selectors directly.

## Palette custom properties (always available)

\`\`\`
--color-palette-accent
--color-palette-muted
--color-palette-danger
--color-palette-success
--color-palette-warning
--color-palette-info
\`\`\`

Use these in custom CSS for consistent semantic colors:
\`background: var(--color-palette-accent)\`

## Key Reveal.js selectors

\`\`\`
.reveal                    root container
.reveal-viewport           outermost wrapper (use for background)
.reveal .slides section    each slide
.reveal h1, h2, h3         headings
.reveal p, ul, ol, li      body content
.reveal .content           content wrapper div
.reveal .columns           two-column flex container
.reveal .columns > div     each column
.reveal .slide-image       image layout <img>
.reveal .slides section.title-slide   title layout slide
.reveal .progress          progress bar
.reveal .controls button   navigation arrows
.reveal .slide-number      slide number indicator
\`\`\`

## Sample slides in the preview

${sampleDescription}

When the user says "the title on slide 1" or "the bullet list looks too small", use this information to identify the correct CSS selectors to adjust.

## Tools

- **update_css** — replace the entire custom.css content. Always write complete, valid CSS (not just a diff).
- **set_base_theme** — change the Reveal.js base theme. Do this when the user wants a fundamentally different look (e.g. dark vs light background). Changing the base theme resets Reveal.js variable defaults.
- **set_palette** — update one or more of the six semantic palette colors. Use this when the user asks to change accent, highlight, or status colors.

After each change the browser preview reloads automatically. Briefly describe what you changed.`;
}

async function writeThemeJson(themeDir: string, def: ThemeDefinition): Promise<void> {
  await fs.writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(def, null, 2), 'utf-8');
}

export async function dispatchThemeTool(
  toolName: ThemeToolName,
  input: unknown,
  themeDir: string,
  themeDef: ThemeDefinition
): Promise<{ result: string; updatedDef: ThemeDefinition }> {
  const inp = input as Record<string, unknown>;

  try {
    switch (toolName) {
      case 'update_css': {
        const css = inp['css'] as string;
        const cssPath = path.join(themeDir, themeDef.customCss || 'custom.css');
        await fs.writeFile(cssPath, css, 'utf-8');
        return { result: 'CSS updated successfully.', updatedDef: themeDef };
      }

      case 'set_base_theme': {
        const name = inp['name'] as string;
        const newDef = { ...themeDef, baseTheme: name };
        await writeThemeJson(themeDir, newDef);
        return { result: `Base theme set to "${name}".`, updatedDef: newDef };
      }

      case 'set_palette': {
        const partial = inp['palette'] as Partial<NonNullable<ThemeDefinition['palette']>>;
        const existing = themeDef.palette ?? {
          accent: '#3b82f6', muted: '#6b7280', danger: '#dc2626',
          success: '#16a34a', warning: '#d97706', info: '#0284c7',
        };
        const newPalette = { ...existing, ...partial } as NonNullable<ThemeDefinition['palette']>;
        const newDef = { ...themeDef, palette: newPalette };
        await writeThemeJson(themeDir, newDef);
        return { result: 'Palette updated.', updatedDef: newDef };
      }

      default:
        return { result: `Unknown tool: ${toolName}`, updatedDef: themeDef };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { result: `Error executing ${toolName}: ${msg}`, updatedDef: themeDef };
  }
}

export async function runThemeToolUseLoop(
  systemPrompt: string,
  messages: Message[],
  themeDef: ThemeDefinition,
  themeDir: string,
  provider: LLMProvider
): Promise<{ updatedDef: ThemeDefinition; messages: Message[] }> {
  let currentDef = themeDef;
  let currentMessages = [...messages];

  let response = await provider.chat(systemPrompt, currentMessages, THEME_TOOLS);

  const assistantContent: import('./provider.js').ContentBlock[] = [];
  if (response.text) assistantContent.push({ type: 'text', text: response.text });
  for (const tu of response.toolUses) {
    assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
  }
  currentMessages.push({ role: 'assistant', content: assistantContent });

  while (response.toolUses.length > 0) {
    const toolResults: import('./provider.js').ContentBlock[] = [];

    for (const toolUse of response.toolUses) {
      const { result, updatedDef } = await dispatchThemeTool(
        toolUse.name as ThemeToolName,
        toolUse.input,
        themeDir,
        currentDef
      );
      currentDef = updatedDef;
      broadcast({ type: 'reload' });

      console.log(chalk.dim(`  [tool: ${toolUse.name}] ${result}`));

      toolResults.push({
        type: 'tool_result',
        ...(toolUse.id ? { tool_use_id: toolUse.id } : {}),
        content: result,
      } as import('./provider.js').ContentBlock);
    }

    currentMessages.push({ role: 'user', content: toolResults });

    response = await provider.chat(systemPrompt, currentMessages, THEME_TOOLS);

    const nextContent: import('./provider.js').ContentBlock[] = [];
    if (response.text) nextContent.push({ type: 'text', text: response.text });
    for (const tu of response.toolUses) {
      nextContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
    }
    currentMessages.push({ role: 'assistant', content: nextContent });
  }

  return { updatedDef: currentDef, messages: currentMessages };
}
