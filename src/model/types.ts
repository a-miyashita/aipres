import { z } from 'zod';

export type SlideLayout = 'title' | 'content' | 'two-column' | 'image' | 'blank';

export interface Slide {
  id: string;
  layout: SlideLayout;
  /** Slide title. May contain inline HTML elements only (no block elements). */
  title?: string;
  /** Slide subtitle. May contain inline HTML elements only (no block elements). */
  subtitle?: string;
  /** Slide body content as an HTML fragment. Use allowed block and inline elements only. */
  body?: string;
  /** Left column content as an HTML fragment (for two-column layout). */
  leftCol?: string;
  /** Right column content as an HTML fragment (for two-column layout). */
  rightCol?: string;
  imageUrl?: string;
  /** Speaker notes as an HTML fragment. */
  notes?: string;
}

export interface RevealOptions {
  transition?: 'none' | 'fade' | 'slide' | 'convex' | 'concave' | 'zoom';
  slideNumber?: boolean | 'c/t' | 'h/v' | 'h.v';
  controls?: boolean;
  progress?: boolean;
  hash?: boolean;
  [key: string]: unknown;
}

export interface SlideModel {
  version: string;
  theme: string;
  revealOptions: RevealOptions;
  slides: Slide[];
}

export interface ThemeDefinition {
  name: string;
  displayName: string;
  description: string;
  baseTheme: string;
  customCss: string;
  assets: string[];
  palette?: {
    accent: string;
    muted: string;
    danger: string;
    success: string;
    warning: string;
    info: string;
  };
}

export type LLMProvider = 'anthropic' | 'openai' | 'copilot' | 'local';

export interface Config {
  llm: {
    provider: LLMProvider;
    model: string;
    language: string;
    baseUrl?: string;
  };
  preview: {
    port: number;
    autoOpen: boolean;
  };
  export: {
    defaultFile?: string;
  };
}

export interface ResolvedConfig extends Config {
  llm: Config['llm'] & {
    apiKey: string;
  };
}

export interface SessionInfo {
  name: string;
  slideCount: number;
  active: boolean;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Zod schemas
export const SlideSchema = z.object({
  id: z.string(),
  layout: z.enum(['title', 'content', 'two-column', 'image', 'blank']),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  leftCol: z.string().optional(),
  rightCol: z.string().optional(),
  imageUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const RevealOptionsSchema = z.object({
  transition: z.enum(['none', 'fade', 'slide', 'convex', 'concave', 'zoom']).optional(),
  slideNumber: z.union([z.boolean(), z.enum(['c/t', 'h/v', 'h.v'])]).optional(),
  controls: z.boolean().optional(),
  progress: z.boolean().optional(),
  hash: z.boolean().optional(),
}).passthrough();

export const SlideModelSchema = z.object({
  version: z.string(),
  theme: z.string(),
  revealOptions: RevealOptionsSchema,
  slides: z.array(SlideSchema),
});

export const ConfigSchema = z.object({
  llm: z.object({
    provider: z.enum(['anthropic', 'openai', 'copilot', 'local']).default('anthropic'),
    model: z.string(),
    language: z.string(),
    baseUrl: z.string().optional(),
  }),
  preview: z.object({
    port: z.number(),
    autoOpen: z.boolean(),
  }),
  export: z.object({
    defaultFile: z.string().optional(),
  }),
});
