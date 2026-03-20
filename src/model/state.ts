import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
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

export function getStatePath(): string {
  return path.join(os.homedir(), '.aipres', 'state', 'current.json');
}

export async function loadState(): Promise<SlideModel> {
  const statePath = getStatePath();
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const data = JSON.parse(content);
    const result = SlideModelSchema.safeParse(data);
    if (result.success) {
      return result.data as SlideModel;
    }
    return { ...DEFAULT_MODEL };
  } catch {
    return { ...DEFAULT_MODEL };
  }
}

export async function saveState(model: SlideModel): Promise<void> {
  const statePath = getStatePath();
  const dir = path.dirname(statePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = statePath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(model, null, 2), 'utf-8');
  await fs.rename(tmpPath, statePath);
}

export async function resetState(): Promise<void> {
  await saveState({ ...DEFAULT_MODEL });
}

// --- Session (chat history) ---

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(z.record(z.unknown()))]),
});

export function getSessionPath(): string {
  return path.join(os.homedir(), '.aipres', 'state', 'session.json');
}

export async function loadSession(): Promise<Message[]> {
  const sessionPath = getSessionPath();
  try {
    const content = await fs.readFile(sessionPath, 'utf-8');
    const data = JSON.parse(content);
    const result = z.array(MessageSchema).safeParse(data);
    if (result.success) {
      return result.data as Message[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveSession(messages: Message[]): Promise<void> {
  const sessionPath = getSessionPath();
  const dir = path.dirname(sessionPath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = sessionPath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(messages, null, 2), 'utf-8');
  await fs.rename(tmpPath, sessionPath);
}

export async function resetSession(): Promise<void> {
  await saveSession([]);
}
