import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_CONFIG, ensurePresoDirs, saveConfig } from './config.js';
import { setApiKey } from './keychain.js';
import { ensureDefaultTheme } from '../theme/manager.js';
import { logger } from '../utils/logger.js';

export async function needsSetup(): Promise<boolean> {
  const presoDir = path.join(os.homedir(), '.aipres');
  try {
    await fs.access(presoDir);
    return false;
  } catch {
    return true;
  }
}

export async function runSetupWizard(): Promise<void> {
  const { default: inquirer } = await import('inquirer');

  console.log('');
  console.log('Welcome to aipres!');
  console.log("Let's set up your configuration.");
  console.log('');

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: 'Anthropic API key:',
      mask: '*',
    },
    {
      type: 'input',
      name: 'language',
      message: 'Response language (BCP 47, e.g. en, ja, zh-CN):',
      default: DEFAULT_CONFIG.llm.language,
    },
    {
      type: 'number',
      name: 'port',
      message: 'Preview server port:',
      default: DEFAULT_CONFIG.preview.port,
    },
  ]);

  await ensurePresoDirs();

  await saveConfig({
    llm: {
      model: DEFAULT_CONFIG.llm.model,
      language: (answers['language'] as string) || DEFAULT_CONFIG.llm.language,
    },
    preview: {
      port: (answers['port'] as number) || DEFAULT_CONFIG.preview.port,
      autoOpen: DEFAULT_CONFIG.preview.autoOpen,
    },
    export: DEFAULT_CONFIG.export,
  });

  if (answers['apiKey']) {
    await setApiKey('anthropic', answers['apiKey'] as string);
  }

  await ensureDefaultTheme();

  logger.success('Configuration saved to ~/.aipres/config.json');
  logger.success('Default theme installed to ~/.aipres/themes/default/');
  logger.success('Setup complete! Run `aipres chat` to start.');
  console.log('');
}
