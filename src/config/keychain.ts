/**
 * Credential store for API keys.
 *
 * Stores secrets in ~/.aipres/credentials.json with mode 0600.
 * This is the same approach used by the AWS CLI, GitHub CLI, and others —
 * OS keychain integration requires native bindings, so we use a
 * permission-restricted file instead.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

function getCredentialsPath(): string {
  return path.join(os.homedir(), '.aipres', 'credentials.json');
}

async function readStore(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(getCredentialsPath(), 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, string>): Promise<void> {
  const p = getCredentialsPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  // Write atomically and restrict permissions to owner-only
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
  await fs.rename(tmp, p);
}

export async function getApiKey(provider: string): Promise<string | null> {
  const store = await readStore();
  return store[provider] ?? null;
}

export async function setApiKey(provider: string, key: string): Promise<void> {
  const store = await readStore();
  store[provider] = key;
  await writeStore(store);
}

export async function deleteApiKey(provider: string): Promise<void> {
  const store = await readStore();
  delete store[provider];
  await writeStore(store);
}
