import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_CONFIG, ensurePresoDirs, saveConfig } from './config.js';
import { setApiKey } from './keychain.js';
import { ensureDefaultTheme } from '../theme/manager.js';
import { logger } from '../utils/logger.js';
import type { LLMProvider } from '../model/types.js';

export async function needsSetup(): Promise<boolean> {
  const configPath = path.join(os.homedir(), '.aipres', 'config.json');
  try {
    await fs.access(configPath);
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

  // Step 1: provider selection
  const { provider } = await inquirer.prompt<{ provider: LLMProvider }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Which LLM provider would you like to use?',
      choices: [
        { name: 'Anthropic Claude (recommended)', value: 'anthropic' },
        { name: 'OpenAI (GPT-4o, o4-mini, ...)', value: 'openai' },
        { name: 'GitHub Copilot', value: 'copilot' },
        { name: 'Local LLM (Ollama / llama.cpp)', value: 'local' },
      ],
      default: 'anthropic',
    },
  ]);

  // Step 2: provider-specific prompts
  let apiKey = '';
  let model = '';
  let baseUrl: string | undefined;

  if (provider === 'anthropic') {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Anthropic API key:',
        mask: '*',
      },
    ]);
    apiKey = (answers['apiKey'] as string) || '';
    model = DEFAULT_CONFIG.llm.model; // claude-sonnet-4-5

  } else if (provider === 'openai') {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'OpenAI API key:',
        mask: '*',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: 'gpt-4o',
      },
    ]);
    apiKey = (answers['apiKey'] as string) || '';
    model = (answers['model'] as string) || 'gpt-4o';

  } else if (provider === 'copilot') {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'GitHub token (with Copilot access):',
        mask: '*',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: 'gpt-4o',
      },
    ]);
    apiKey = (answers['apiKey'] as string) || '';
    model = (answers['model'] as string) || 'gpt-4o';

  } else {
    // local
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'API base URL (Ollama default: http://localhost:11434/v1):',
        default: 'http://localhost:11434/v1',
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name (e.g. llama3.1, qwen2.5:14b):',
        default: 'llama3.1',
      },
    ]);
    baseUrl = (answers['baseUrl'] as string) || 'http://localhost:11434/v1';
    model = (answers['model'] as string) || 'llama3.1';
  }

  // Step 3: common settings
  const commonAnswers = await inquirer.prompt([
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
      provider,
      model,
      language: (commonAnswers['language'] as string) || DEFAULT_CONFIG.llm.language,
      ...(baseUrl ? { baseUrl } : {}),
    },
    preview: {
      port: (commonAnswers['port'] as number) || DEFAULT_CONFIG.preview.port,
      autoOpen: DEFAULT_CONFIG.preview.autoOpen,
    },
    export: DEFAULT_CONFIG.export,
  });

  if (apiKey) {
    const keychainKey = provider === 'copilot' ? 'copilot' : provider === 'openai' ? 'openai' : 'anthropic';
    await setApiKey(keychainKey, apiKey);
  }

  await ensureDefaultTheme();

  logger.success('Configuration saved to ~/.aipres/config.json');
  logger.success('Default theme installed to ~/.aipres/themes/default/');

  if (provider === 'local') {
    logger.success(`Setup complete! Make sure Ollama is running with: ollama run ${model}`);
  } else {
    logger.success('Setup complete! Run `aipres chat` to start.');
  }
  console.log('');
}
