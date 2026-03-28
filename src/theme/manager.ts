import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { ThemeDefinition } from '../model/types.js';
import { DEFAULT_THEME_JSON, DEFAULT_THEME_CSS, BUILTIN_THEMES } from './defaults.js';
import { ThemeError } from '../utils/errors.js';

const THEME_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$/;

export interface LoadedTheme {
  def: ThemeDefinition;
  /** Absolute path to the theme directory. null for built-in themes that have no directory. */
  dir: string | null;
}

export function getThemesDir(): string {
  return path.join(os.homedir(), '.aipres', 'themes');
}

/** Returns true if the value should be treated as a filesystem path rather than a theme name. */
export function isThemePath(value: string): boolean {
  return path.isAbsolute(value) || value.startsWith('./') || value.startsWith('../');
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

async function loadThemeFromDir(dir: string): Promise<ThemeDefinition> {
  const themeJsonPath = path.join(dir, 'theme.json');
  const content = await fs.readFile(themeJsonPath, 'utf-8');
  return JSON.parse(content) as ThemeDefinition;
}

/**
 * Load a theme by value (name or path) and return the definition with its directory.
 * - Path (starts with ./, ../, or /): resolved relative to workDir and loaded directly.
 * - Name: looked up in ~/.aipres/themes/<name>/, then in Reveal.js built-ins.
 */
export async function loadTheme(value: string, workDir: string): Promise<LoadedTheme> {
  if (isThemePath(value)) {
    const dir = path.resolve(workDir, value);
    try {
      const def = await loadThemeFromDir(dir);
      return { def, dir };
    } catch {
      throw new ThemeError(`Theme directory "${dir}" not found or missing theme.json.`);
    }
  }

  // Name-based: try global user theme first
  const globalDir = path.join(getThemesDir(), value);
  try {
    const def = await loadInstalledTheme(value);
    return { def, dir: globalDir };
  } catch {
    // Fall through to built-ins
  }

  const builtin = BUILTIN_THEMES.find(t => t.name === value);
  if (builtin) return { def: builtin, dir: null };

  throw new ThemeError(`Theme "${value}" not found. Use "aipres theme list" to see available themes.`);
}

export function validateThemeName(name: string): string | null {
  if (!THEME_NAME_PATTERN.test(name)) {
    return 'Name must start with a letter or digit and contain only letters, digits, hyphens, and underscores (max 64 characters).';
  }
  return null;
}

export async function createTheme(name: string): Promise<void> {
  const err = validateThemeName(name);
  if (err) throw new ThemeError(err);

  const themeDir = path.join(getThemesDir(), name);
  try {
    await fs.stat(themeDir);
    throw new ThemeError(`Theme "${name}" already exists.`);
  } catch (e) {
    if (e instanceof ThemeError) throw e;
    // Directory does not exist — proceed
  }

  await fs.mkdir(themeDir, { recursive: true });

  const themeDef: ThemeDefinition = {
    ...DEFAULT_THEME_JSON,
    name,
    displayName: name,
    description: '',
  };
  await fs.writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(themeDef, null, 2), 'utf-8');
  await fs.writeFile(path.join(themeDir, 'custom.css'), DEFAULT_THEME_CSS, 'utf-8');
}

export async function deleteTheme(name: string): Promise<void> {
  if (BUILTIN_THEMES.some(t => t.name === name)) {
    throw new ThemeError(`"${name}" is a built-in theme and cannot be deleted.`);
  }
  const themeDir = path.join(getThemesDir(), name);
  try {
    await fs.stat(themeDir);
  } catch {
    throw new ThemeError(`Theme "${name}" not found.`);
  }
  await fs.rm(themeDir, { recursive: true, force: true });
}

export async function createThemeAt(dirPath: string): Promise<void> {
  try {
    await fs.stat(dirPath);
    throw new ThemeError(`"${dirPath}" already exists. Choose a different path or delete it first.`);
  } catch (e) {
    if (e instanceof ThemeError) throw e;
    // Directory does not exist — proceed
  }

  await fs.mkdir(dirPath, { recursive: true });

  const name = path.basename(dirPath);
  const themeDef: ThemeDefinition = {
    ...DEFAULT_THEME_JSON,
    name,
    displayName: name,
    description: '',
  };
  await fs.writeFile(path.join(dirPath, 'theme.json'), JSON.stringify(themeDef, null, 2), 'utf-8');
  await fs.writeFile(path.join(dirPath, 'custom.css'), DEFAULT_THEME_CSS, 'utf-8');
}

export async function copyThemeDir(srcDir: string, destDir: string): Promise<void> {
  try {
    await fs.stat(destDir);
    throw new ThemeError(`"${destDir}" already exists.`);
  } catch (e) {
    if (e instanceof ThemeError) throw e;
    // Directory does not exist — proceed
  }

  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      await fs.copyFile(
        path.join(srcDir, entry.name),
        path.join(destDir, entry.name)
      );
    }
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
