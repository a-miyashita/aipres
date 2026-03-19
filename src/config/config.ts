import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { Config, ResolvedConfig } from '../model/types.js';
import { ConfigSchema } from '../model/types.js';
import { getApiKey, setApiKey } from './keychain.js';

export const DEFAULT_CONFIG: Config = {
  llm: {
    model: 'claude-opus-4-5',
    language: 'ja',
  },
  preview: {
    port: 3000,
    autoOpen: true,
  },
  export: {
    defaultFile: './presentation.html',
  },
};

export function getConfigPath(): string {
  return path.join(os.homedir(), '.aipres', 'config.json');
}

export async function ensurePresoDirs(): Promise<void> {
  const base = path.join(os.homedir(), '.aipres');
  await fs.mkdir(path.join(base, 'state'), { recursive: true });
  await fs.mkdir(path.join(base, 'themes'), { recursive: true });
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (srcVal !== undefined) {
      if (
        typeof srcVal === 'object' &&
        srcVal !== null &&
        !Array.isArray(srcVal) &&
        typeof tgtVal === 'object' &&
        tgtVal !== null &&
        !Array.isArray(tgtVal)
      ) {
        result[key] = deepMerge(tgtVal as object, srcVal as object) as T[keyof T];
      } else {
        result[key] = srcVal as T[keyof T];
      }
    }
  }
  return result;
}

async function loadConfigFile(): Promise<Partial<Config>> {
  try {
    const content = await fs.readFile(getConfigPath(), 'utf-8');
    const data = JSON.parse(content);
    const result = ConfigSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    return data as Partial<Config>;
  } catch {
    return {};
  }
}

export async function loadConfig(): Promise<ResolvedConfig> {
  const fileConfig = await loadConfigFile();
  let merged = deepMerge(DEFAULT_CONFIG, fileConfig as Partial<Config>);

  // Apply environment variables
  if (process.env['PRESO_LANGUAGE']) {
    merged = deepMerge(merged, { llm: { ...merged.llm, language: process.env['PRESO_LANGUAGE'] } });
  }
  if (process.env['PRESO_MODEL']) {
    merged = deepMerge(merged, { llm: { ...merged.llm, model: process.env['PRESO_MODEL'] } });
  }

  // Resolve API key: env var > keychain
  let apiKey = '';
  if (process.env['ANTHROPIC_API_KEY']) {
    apiKey = process.env['ANTHROPIC_API_KEY'];
  } else {
    const keychainKey = await getApiKey('anthropic');
    if (keychainKey) {
      apiKey = keychainKey;
    }
  }

  return {
    ...merged,
    llm: {
      ...merged.llm,
      apiKey,
    },
  };
}

export async function saveConfig(partial: Partial<Config>): Promise<void> {
  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  const current = await loadConfigFile();
  const merged = deepMerge(DEFAULT_CONFIG, deepMerge(current as Config, partial as Config));

  await fs.writeFile(configPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

function getNestedValue(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, keys: string[], value: unknown): void {
  const last = keys[keys.length - 1];
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[last] = value;
}

export async function getConfigValue(key: string): Promise<unknown> {
  const keys = key.split('.');
  if (keys[0] === 'llm' && keys[1] === 'apiKey') {
    const config = await loadConfig();
    return config.llm.apiKey;
  }
  const config = await loadConfig();
  return getNestedValue(config, keys);
}

export async function setConfigValue(key: string, value: unknown): Promise<void> {
  const keys = key.split('.');
  if (keys[0] === 'llm' && keys[1] === 'apiKey') {
    await setApiKey('anthropic', String(value));
    return;
  }

  const configPath = getConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  const current = await loadConfigFile();
  const asObj = current as Record<string, unknown>;
  setNestedValue(asObj, keys, value);

  const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, asObj) as unknown as Config;
  await fs.writeFile(configPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
}
