import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { ThemeDefinition } from '../model/types.js';
import { DEFAULT_THEME_JSON, DEFAULT_THEME_CSS, BUILTIN_THEMES } from './defaults.js';
import { ThemeError } from '../utils/errors.js';

export function getThemesDir(): string {
  return path.join(os.homedir(), '.aipres', 'themes');
}

export async function listThemes(): Promise<ThemeDefinition[]> {
  const themesDir = getThemesDir();
  const installedNames = new Set<string>();
  const installed: ThemeDefinition[] = [];

  try {
    const entries = await fs.readdir(themesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const theme = await loadInstalledTheme(entry.name);
          installed.push(theme);
          installedNames.add(theme.name);
        } catch {
          // Skip invalid themes
        }
      }
    }
  } catch {
    // No themes directory yet
  }

  // Merge: installed themes override built-ins with the same name
  const builtins = BUILTIN_THEMES.filter(t => !installedNames.has(t.name));
  return [...installed, ...builtins];
}

async function loadInstalledTheme(name: string): Promise<ThemeDefinition> {
  const themeDir = path.join(getThemesDir(), name);
  const themeJsonPath = path.join(themeDir, 'theme.json');
  const content = await fs.readFile(themeJsonPath, 'utf-8');
  return JSON.parse(content) as ThemeDefinition;
}

export async function loadTheme(name: string): Promise<ThemeDefinition> {
  try {
    return await loadInstalledTheme(name);
  } catch {
    // Fall back to built-in themes
    const builtin = BUILTIN_THEMES.find(t => t.name === name);
    if (builtin) return builtin;
    throw new ThemeError(`Theme "${name}" not found. Use "aipres theme list" to see available themes.`);
  }
}

export async function addTheme(sourcePath: string): Promise<void> {
  const absSource = path.resolve(sourcePath);
  const themeJsonPath = path.join(absSource, 'theme.json');

  try {
    await fs.access(themeJsonPath);
  } catch {
    throw new ThemeError(`No theme.json found in ${sourcePath}`);
  }

  const themeDef = JSON.parse(await fs.readFile(themeJsonPath, 'utf-8')) as ThemeDefinition;
  const destDir = path.join(getThemesDir(), themeDef.name);
  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(absSource, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      await fs.copyFile(
        path.join(absSource, entry.name),
        path.join(destDir, entry.name)
      );
    }
  }
}

export async function ensureDefaultTheme(): Promise<void> {
  const themesDir = getThemesDir();
  const defaultDir = path.join(themesDir, 'default');
  await fs.mkdir(defaultDir, { recursive: true });

  const themeJsonPath = path.join(defaultDir, 'theme.json');
  const csspath = path.join(defaultDir, 'custom.css');

  try {
    await fs.access(themeJsonPath);
  } catch {
    await fs.writeFile(themeJsonPath, JSON.stringify(DEFAULT_THEME_JSON, null, 2), 'utf-8');
  }

  try {
    await fs.access(csspath);
  } catch {
    await fs.writeFile(csspath, DEFAULT_THEME_CSS, 'utf-8');
  }
}
