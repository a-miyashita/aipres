import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { z } from 'zod';
import type { SlideModel, SessionInfo } from './types.js';
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

const SESSION_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;

// --- Path helpers ---

export function getSessionsDir(): string {
  return path.join(os.homedir(), '.aipres', 'sessions');
}

export function getActivePath(): string {
  return path.join(getSessionsDir(), '.active');
}

export function getSessionDir(name: string): string {
  return path.join(getSessionsDir(), name);
}

export function getSlidesPath(name: string): string {
  return path.join(getSessionDir(name), 'slides.json');
}

export function getChatPath(name: string): string {
  return path.join(getSessionDir(name), 'chat.json');
}

// Legacy paths — kept for migration only
export function getStatePath(): string {
  return path.join(os.homedir(), '.aipres', 'state', 'current.json');
}

export function getSessionPath(): string {
  return path.join(os.homedir(), '.aipres', 'state', 'session.json');
}

// --- Validation ---

export function validateSessionName(name: string): string | null {
  if (!SESSION_NAME_PATTERN.test(name)) {
    return 'Name must start with a letter or digit and contain only letters, digits, hyphens, and underscores (max 64 characters).';
  }
  return null;
}

// --- Session management ---

export async function loadActiveSession(): Promise<string> {
  try {
    const name = (await fs.readFile(getActivePath(), 'utf-8')).trim();
    return name || 'untitled';
  } catch {
    return 'untitled';
  }
}

export async function setActiveSession(name: string): Promise<void> {
  await fs.mkdir(getSessionsDir(), { recursive: true });
  await fs.writeFile(getActivePath(), name, 'utf-8');
}

export async function clearActiveSession(): Promise<void> {
  try {
    await fs.unlink(getActivePath());
  } catch {
    // Ignore if already absent
  }
}

export async function sessionExists(name: string): Promise<boolean> {
  try {
    await fs.stat(getSessionDir(name));
    return true;
  } catch {
    return false;
  }
}

export async function createSession(name: string): Promise<void> {
  const dir = getSessionDir(name);
  await fs.mkdir(dir, { recursive: true });

  const slidesPath = getSlidesPath(name);
  try { await fs.stat(slidesPath); } catch {
    await fs.writeFile(slidesPath, JSON.stringify(DEFAULT_MODEL, null, 2), 'utf-8');
  }

  const chatPath = getChatPath(name);
  try { await fs.stat(chatPath); } catch {
    await fs.writeFile(chatPath, '[]', 'utf-8');
  }
}

export async function deleteSession(name: string): Promise<void> {
  await fs.rm(getSessionDir(name), { recursive: true, force: true });
}

export async function renameSession(oldName: string, newName: string): Promise<void> {
  await fs.rename(getSessionDir(oldName), getSessionDir(newName));
}

export async function listSessions(): Promise<SessionInfo[]> {
  const dir = getSessionsDir();
  const activeName = await loadActiveSession();

  let entries: string[] = [];
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    entries = dirents
      .filter(d => d.isDirectory() && !d.name.startsWith('.'))
      .map(d => d.name)
      .sort();
  } catch {
    return [];
  }

  const infos: SessionInfo[] = [];
  for (const name of entries) {
    let slideCount = 0;
    try {
      const content = await fs.readFile(getSlidesPath(name), 'utf-8');
      const data = JSON.parse(content);
      slideCount = Array.isArray(data?.slides) ? data.slides.length : 0;
    } catch { /* ignore */ }
    infos.push({ name, slideCount, active: name === activeName });
  }
  return infos;
}

/**
 * Ensure a valid active session exists.
 * If .active is missing or points to a non-existent directory,
 * create and activate a fresh 'untitled' session.
 * Returns the resolved active session name.
 */
export async function ensureActiveSession(): Promise<string> {
  const name = await loadActiveSession();
  if (await sessionExists(name)) {
    return name;
  }
  await createSession('untitled');
  await setActiveSession('untitled');
  return 'untitled';
}

// --- State (slides) ---

export async function loadState(name?: string): Promise<SlideModel> {
  const sessionName = name ?? await loadActiveSession();
  try {
    const content = await fs.readFile(getSlidesPath(sessionName), 'utf-8');
    const data = JSON.parse(content);
    const result = SlideModelSchema.safeParse(data);
    if (result.success) return result.data as SlideModel;
    return { ...DEFAULT_MODEL };
  } catch {
    return { ...DEFAULT_MODEL };
  }
}

export async function saveState(model: SlideModel, name?: string): Promise<void> {
  const sessionName = name ?? await loadActiveSession();
  const slidesPath = getSlidesPath(sessionName);
  await fs.mkdir(path.dirname(slidesPath), { recursive: true });
  const tmpPath = slidesPath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(model, null, 2), 'utf-8');
  await fs.rename(tmpPath, slidesPath);
}

export async function resetState(name?: string): Promise<void> {
  await saveState({ ...DEFAULT_MODEL }, name);
}

// --- Session (chat history) ---

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(z.record(z.unknown()))]),
});

export async function loadSession(name?: string): Promise<Message[]> {
  const sessionName = name ?? await loadActiveSession();
  try {
    const content = await fs.readFile(getChatPath(sessionName), 'utf-8');
    const data = JSON.parse(content);
    const result = z.array(MessageSchema).safeParse(data);
    if (result.success) return result.data as Message[];
    return [];
  } catch {
    return [];
  }
}

export async function saveSession(messages: Message[], name?: string): Promise<void> {
  const sessionName = name ?? await loadActiveSession();
  const chatPath = getChatPath(sessionName);
  await fs.mkdir(path.dirname(chatPath), { recursive: true });
  const tmpPath = chatPath + '.tmp';
  await fs.writeFile(tmpPath, JSON.stringify(messages, null, 2), 'utf-8');
  await fs.rename(tmpPath, chatPath);
}

export async function resetSession(name?: string): Promise<void> {
  await saveSession([], name);
}

// --- Migration from v0.2.x ---

export async function migrateFromV1IfNeeded(): Promise<void> {
  // Already migrated if .active exists
  try {
    await fs.stat(getActivePath());
    return;
  } catch { /* proceed */ }

  await createSession('untitled');

  try {
    const content = await fs.readFile(getStatePath(), 'utf-8');
    await fs.writeFile(getSlidesPath('untitled'), content, 'utf-8');
  } catch { /* no old slides */ }

  try {
    const content = await fs.readFile(getSessionPath(), 'utf-8');
    await fs.writeFile(getChatPath('untitled'), content, 'utf-8');
  } catch { /* no old chat */ }

  await setActiveSession('untitled');
}
