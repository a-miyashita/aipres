import { loadConfig, getConfigValue, setConfigValue, saveConfig, DEFAULT_CONFIG } from '../config/config.js';
import { deleteApiKey } from '../config/keychain.js';
import { logger } from '../utils/logger.js';

function inferType(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;
  return value;
}

function maskApiKey(key: string | undefined): string {
  if (!key) return '(not set)';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

export async function runConfigList(): Promise<void> {
  const config = await loadConfig();

  console.log('\nCurrent configuration:');
  console.log('');
  console.log(`  llm.model            ${config.llm.model}`);
  console.log(`  llm.apiKey           ${maskApiKey(config.llm.apiKey)}`);
  console.log(`  llm.language         ${config.llm.language}`);
  console.log(`  preview.port         ${config.preview.port}`);
  console.log(`  preview.autoOpen     ${config.preview.autoOpen}`);
  console.log(`  export.defaultFile   ${config.export.defaultFile}`);
  console.log('');
}

export async function runConfigGet(key: string): Promise<void> {
  const value = await getConfigValue(key);
  if (value === undefined) {
    logger.warn(`Key "${key}" not found`);
    process.exit(1);
  }
  if (key.includes('apiKey')) {
    console.log(maskApiKey(String(value)));
  } else {
    console.log(String(value));
  }
}

export async function runConfigSet(key: string, value: string): Promise<void> {
  const typed = inferType(value);
  await setConfigValue(key, typed);
  if (key.includes('apiKey')) {
    logger.success(`${key} saved to keychain`);
  } else {
    logger.success(`${key} = ${typed}`);
  }
}

export async function runConfigReset(opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force) {
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Reset all configuration to defaults? (API key will be removed)',
        default: false,
      },
    ]);
    if (!confirm) {
      logger.info('Cancelled.');
      return;
    }
  }

  await saveConfig(DEFAULT_CONFIG);
  await deleteApiKey('anthropic');
  logger.success('Configuration reset to defaults.');
}
