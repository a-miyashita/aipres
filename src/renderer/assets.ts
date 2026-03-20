import * as fs from 'fs/promises';
import * as path from 'path';
import { createRequire } from 'module';
import type { ThemeDefinition } from '../model/types.js';

const require = createRequire(import.meta.url);

function getRevealBase(): string {
  try {
    const revealPkg = require.resolve('reveal.js/package.json');
    return path.dirname(revealPkg);
  } catch {
    // fallback
    return path.resolve('node_modules/reveal.js');
  }
}

export function loadRevealJs(): string {
  const p = path.join(getRevealBase(), 'dist', 'reveal.js');
  // Synchronous read for simplicity in template building
  const { readFileSync } = require('fs');
  try {
    return readFileSync(p, 'utf-8') as string;
  } catch {
    return '/* reveal.js not found */';
  }
}

export function loadRevealCss(): string {
  const p = path.join(getRevealBase(), 'dist', 'reveal.css');
  const { readFileSync } = require('fs');
  try {
    return readFileSync(p, 'utf-8') as string;
  } catch {
    return '/* reveal.css not found */';
  }
}

export function loadRevealThemeCss(baseTheme: string): string {
  const p = path.join(getRevealBase(), 'dist', 'theme', `${baseTheme}.css`);
  const { readFileSync } = require('fs');
  try {
    return readFileSync(p, 'utf-8') as string;
  } catch {
    // Try black as fallback
    const fallback = path.join(getRevealBase(), 'dist', 'theme', 'black.css');
    try {
      return readFileSync(fallback, 'utf-8') as string;
    } catch {
      return '/* theme css not found */';
    }
  }
}

export async function encodeImageToBase64(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  };
  const mime = mimeMap[ext] ?? 'application/octet-stream';
  const data = await fs.readFile(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

async function inlineCssImageUrls(css: string, baseDir: string): Promise<string> {
  const urlPattern = /url\(\s*(['"]?)(?!data:|https?:|\/\/)((?:\.\.?\/|[^'")\s])[^'")\s]*)\1\s*\)/g;
  const matches = [...css.matchAll(urlPattern)];
  if (matches.length === 0) return css;

  let result = css;
  for (const match of matches) {
    const [full, , rawPath] = match;
    const absPath = path.resolve(baseDir, rawPath);
    try {
      const dataUrl = await encodeImageToBase64(absPath);
      result = result.replace(full, `url("${dataUrl}")`);
    } catch {
      // Leave unresolvable URLs as-is
    }
  }
  return result;
}

export async function loadThemeCss(themeDef: ThemeDefinition, themeDir: string): Promise<string> {
  if (!themeDef.customCss) return '';
  const cssPath = path.join(themeDir, themeDef.customCss);
  try {
    const css = await fs.readFile(cssPath, 'utf-8');
    return await inlineCssImageUrls(css, themeDir);
  } catch {
    return '';
  }
}
