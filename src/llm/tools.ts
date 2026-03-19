import type { Tool } from './provider.js';

export type ToolName =
  | 'add_slide'
  | 'update_slide'
  | 'delete_slide'
  | 'reorder_slides'
  | 'set_theme'
  | 'set_reveal_option'
  | 'show_summary';

export const TOOLS: Tool[] = [
  {
    name: 'add_slide',
    description: 'Add a new slide to the presentation at the end or at a specified position.',
    input_schema: {
      type: 'object',
      properties: {
        layout: {
          type: 'string',
          enum: ['title', 'content', 'two-column', 'image', 'blank'],
          description: 'The layout type for the slide',
        },
        title: { type: 'string', description: 'Slide title' },
        subtitle: { type: 'string', description: 'Slide subtitle (for title layout)' },
        body: { type: 'string', description: 'Slide body content in Markdown' },
        leftCol: { type: 'string', description: 'Left column content in Markdown (for two-column layout)' },
        rightCol: { type: 'string', description: 'Right column content in Markdown (for two-column layout)' },
        imageUrl: { type: 'string', description: 'Image URL or path (for image layout)' },
        notes: { type: 'string', description: 'Speaker notes in Markdown' },
        insertAt: {
          type: 'number',
          description: 'Position to insert the slide (0-based). Omit to append at end.',
        },
      },
      required: ['layout'],
    },
  },
  {
    name: 'update_slide',
    description: 'Update fields of an existing slide by index.',
    input_schema: {
      type: 'object',
      properties: {
        index: {
          type: 'number',
          description: 'The 0-based index of the slide to update',
        },
        patch: {
          type: 'object',
          description: 'Fields to update (title, subtitle, body, leftCol, rightCol, imageUrl, notes)',
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string' },
            body: { type: 'string' },
            leftCol: { type: 'string' },
            rightCol: { type: 'string' },
            imageUrl: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
      required: ['index', 'patch'],
    },
  },
  {
    name: 'delete_slide',
    description: 'Delete a slide by index.',
    input_schema: {
      type: 'object',
      properties: {
        index: {
          type: 'number',
          description: 'The 0-based index of the slide to delete',
        },
      },
      required: ['index'],
    },
  },
  {
    name: 'reorder_slides',
    description: 'Move a slide from one position to another.',
    input_schema: {
      type: 'object',
      properties: {
        from: {
          type: 'number',
          description: 'The 0-based index of the slide to move',
        },
        to: {
          type: 'number',
          description: 'The 0-based index of the destination position',
        },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'set_theme',
    description: 'Change the presentation theme.',
    input_schema: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          description: 'Theme name (directory name under ~/.aipres/themes/)',
        },
      },
      required: ['theme'],
    },
  },
  {
    name: 'set_reveal_option',
    description: 'Set a Reveal.js initialization option.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The Reveal.js option key (e.g., transition, slideNumber, controls)',
        },
        value: {
          description: 'The value to set',
        },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'show_summary',
    description: 'Display the current list of slides in the terminal.',
    input_schema: {
      type: 'object',
      properties: {},
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

export function buildSystemPrompt(language: string): string {
  const langName = LOCALE_NAMES[language]
    ?? `the language identified by locale code "${language}"`;

  return `You are a presentation creation assistant.
Work with the user through conversation to create and edit slides using the available tools.

Rules:
- All slide changes MUST be made through tool calls. Never output raw HTML directly.
- You may call multiple tools in a single turn to create or edit multiple slides at once.
- After making changes, briefly summarize what was done (e.g., "Added 3 slides about X.").
- Use show_summary proactively to keep track of the current slide state.
- Always respond in ${langName}.`;
}
