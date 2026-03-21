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
        title: { type: 'string', description: 'Slide title. May contain inline HTML elements only (no block elements).' },
        subtitle: { type: 'string', description: 'Slide subtitle. May contain inline HTML elements only (no block elements).' },
        body: { type: 'string', description: 'Slide body content as an HTML fragment. Supports block elements, inline elements, and <svg> for generated vector graphics.' },
        leftCol: { type: 'string', description: 'Left column content as an HTML fragment (for two-column layout). Supports <svg>.' },
        rightCol: { type: 'string', description: 'Right column content as an HTML fragment (for two-column layout). Supports <svg>.' },
        imageUrl: { type: 'string', description: 'URL or local file path to a raster or external image (for image layout). Do not place SVG markup here — use body with <svg> instead.' },
        notes: { type: 'string', description: 'Speaker notes as an HTML fragment.' },
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
- After making changes, briefly summarize what was done in plain text (e.g., "Added 3 slides about X.").
- Use show_summary proactively to keep track of the current slide state.
- Always respond in ${langName}.
- In conversational text (outside tool calls), use plain text only. Do NOT use Markdown syntax (##, **, *, -, > etc.). Plain sentences only.

Tool call format:
- update_slide: "patch" must be a JSON object containing only the fields to change — NOT a string.
  Correct:   { "index": 1, "patch": { "body": "<ul><li>item</li></ul>" } }
  Incorrect: { "index": 1, "patch": "<parameter name=\\"body\\">..." }

Content fields (body, leftCol, rightCol, notes) must be written as HTML fragments
using only the allowed element subset. Do not use Markdown.

The title and subtitle fields also accept inline HTML elements only —
no block elements (<p>, <ul>, etc.).

Do not use <h1> or <h2> anywhere in content fields.

For inline formatting:
- Bold: <strong>, italic: <em>
- Font size: <span data-size="xs|sm|lg|xl|2xl">
- Text color: <span data-color="PALETTE_NAME"> using palette names below
- Highlight: <span data-highlight="PALETTE_NAME">
- Alignment: <p data-align="left|center|right|justify">

Available palette colors: accent, muted, danger, success, warning, info
Choose the palette name that best matches the user's intent and the active theme.
Only use a hex value (data-color="#rrggbb") when the user explicitly provides
a specific brand color or color code. Never choose hex on your own.
If the right color is unclear, ask the user.

Always write well-formed HTML. Void elements (<br>, <hr>, <img>) must be
self-closed. Do not leave unclosed tags.

## Images

### Specified images (user-provided)
When the user's message contains [Image resolved: /path/to/file (mime)] annotations:
- You can see the image content — use it to understand layout, colors, and structure.
- To embed the image in a slide: use the resolved path in imageUrl (image layout, raster files only) or <img src="/path/to/file" alt="..."> (inline in body).
- To use the image as a design reference only (e.g. "このラフをもとに作って"): read its visual content and generate slides accordingly without embedding the original file, unless the user explicitly asks to include it.

Layout selection for raster images:
- imageUrl + image layout → full-slide image
- <img> inline in body/leftCol/rightCol → image alongside text

### Generated SVG
Write SVG markup directly into body, leftCol, or rightCol — no special tool is needed.
- Always include xmlns="http://www.w3.org/2000/svg", viewBox, width, and height on the root <svg> element.
- Use width="100%" for full-width diagrams; use explicit pixel dimensions for icons and decorations.
- For a full-slide SVG: use blank layout and place the SVG in body.
- Do not put SVG markup in imageUrl — that field is for raster images and URLs only.
- Keep SVGs simple and legible at slide dimensions.`;
}
