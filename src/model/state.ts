import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import type { SlideModel } from './types.js';
import { SlideModelSchema } from './types.js';
import type { Message } from '../llm/provider.js';

export const DEFAULT_MODEL: SlideModel = {
  version: '1.0',
  theme: 'default',
  revealOptions: {
    transition: 'slide',
    slideNumber: true,
    controls: true,
    progress: true,
    hash: true,
  },
  slides: [],
};

// --- Path helpers ---

export function getSlidesPath(workDir: string): string {
  return path.join(workDir, 'slides.json');
}

export function getChatPath(workDir: string): string {
  return path.join(workDir, 'chat.json');
}

// --- State (slides) ---

export async function loadState(workDir: string): Promise<SlideModel> {
  try {
    const content = await fs.readFile(getSlidesPath(workDir), 'utf-8');
    const data = JSON.parse(content);
    const result = SlideModelSchema.safeParse(data);
    if (result.success) return result.data as SlideModel;
    return { ...DEFAULT_MODEL };
  } catch {
    return { ...DEFAULT_MODEL };
  }
}

export async function saveState(model: SlideModel, workDir: string): Promise<void> {
  const slidesPath = getSlidesPath(workDir);
  const tmpPath = slidesPath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(model, null, 2), 'utf-8');
  await fs.rename(tmpPath, slidesPath);
}

export async function resetState(workDir: string): Promise<void> {
  await saveState({ ...DEFAULT_MODEL }, workDir);
}

// --- Session (chat history) ---

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(z.record(z.unknown()))]),
});

export async function loadSession(workDir: string): Promise<Message[]> {
  try {
    const content = await fs.readFile(getChatPath(workDir), 'utf-8');
    const data = JSON.parse(content);
    const result = z.array(MessageSchema).safeParse(data);
    if (result.success) return result.data as Message[];
    return [];
  } catch {
    return [];
  }
}

export async function saveSession(messages: Message[], workDir: string): Promise<void> {
  const chatPath = getChatPath(workDir);
  const tmpPath = chatPath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(messages, null, 2), 'utf-8');
  await fs.rename(tmpPath, chatPath);
}

export async function resetSession(workDir: string): Promise<void> {
  await saveSession([], workDir);
}
