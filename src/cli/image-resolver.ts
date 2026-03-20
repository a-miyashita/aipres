import * as fs from 'fs/promises';
import * as path from 'path';
import type { ContentBlock } from '../llm/provider.js';
import { logger } from '../utils/logger.js';

export interface ImageRef {
  syntax: '@path' | 'bare';
  raw: string;      // text as found in message
  path: string;     // resolved absolute path
  mimeType: string; // e.g. "image/png"
  data: string;     // base64-encoded file contents
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function extToMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Detect @path and bare file path references to image files in a message string.
 * Resolves each to an absolute path, reads the file, and returns ImageRef objects.
 * Files that cannot be read are silently skipped with a warning.
 */
export async function resolveImageRefs(text: string, cwd: string): Promise<ImageRef[]> {
  const refs: ImageRef[] = [];
  const seen = new Set<string>();

  async function tryAdd(rawPath: string, raw: string, syntax: '@path' | 'bare'): Promise<void> {
    const absPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd, rawPath);
    if (seen.has(absPath)) return;
    seen.add(absPath);
    try {
      await fs.stat(absPath);
      const buf = await fs.readFile(absPath);
      refs.push({ syntax, raw, path: absPath, mimeType: extToMime(absPath), data: buf.toString('base64') });
    } catch {
      logger.warn(`Image not found or unreadable: ${absPath}`);
    }
  }

  // Pattern A: @path references
  const atPattern = /(?:^|\s)@([^\s]+\.(?:jpe?g|png|gif|webp|svg))/gi;
  let m: RegExpExecArray | null;
  while ((m = atPattern.exec(text)) !== null) {
    await tryAdd(m[1], m[0].trim(), '@path');
  }

  // Pattern B: bare file path references (absolute or relative starting with ./ or ../)
  const barePattern = /(?:^|\s)((?:\/|\.\/|\.\.\/)[^\s]+\.(?:jpe?g|png|gif|webp|svg))/gi;
  while ((m = barePattern.exec(text)) !== null) {
    await tryAdd(m[1], m[0].trim(), 'bare');
  }

  return refs;
}

/**
 * Build a multimodal ContentBlock[] from a message and its resolved image refs.
 * Structure: [image block, ...], [text block with original message + path annotations]
 */
export function buildMultimodalMessage(original: string, refs: ImageRef[]): ContentBlock[] {
  const imageBlocks: ContentBlock[] = refs.map(ref => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: ref.mimeType,
      data: ref.data,
    },
  }));

  const annotations = refs
    .map(ref => `[Image resolved: ${ref.path} (${ref.mimeType})]`)
    .join('\n');

  const textBlock: ContentBlock = {
    type: 'text',
    text: `${original}\n${annotations}`,
  };

  return [...imageBlocks, textBlock];
}
