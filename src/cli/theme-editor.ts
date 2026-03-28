import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../config/config.js';
import { needsSetup, runSetupWizard } from '../config/setup.js';
import { loadTheme, isThemePath } from '../theme/manager.js';
import { loadState } from '../model/state.js';
import { SAMPLE_SLIDES, buildSampleDescription } from '../theme/samples.js';
import { createProvider } from '../llm/factory.js';
import {
  buildThemeSystemPrompt,
  runThemeToolUseLoop,
} from '../llm/theme-tools.js';
import { createServer } from '../preview/server.js';
import { logger } from '../utils/logger.js';
import type { Message } from '../llm/provider.js';
import type { ThemeDefinition } from '../model/types.js';

function divider(label: string, color: (s: string) => string): string {
  const width = process.stdout.columns || 80;
  const prefix = `── ${label} `;
  const line = '─'.repeat(Math.max(0, width - prefix.length));
  return color(`\n${prefix}${line}\n`);
}

function printHelp(): void {
  console.log(chalk.cyan('\nAvailable commands:'));
  console.log('  /quit, /exit  - End the session');
  console.log('  /reset        - Restore theme to the state at session start');
  console.log('  /help         - Show this help');
  console.log('');
}

async function readThemeFiles(themeDir: string, def: ThemeDefinition): Promise<{ json: string; css: string }> {
  const jsonStr = JSON.stringify(def, null, 2);
  let css = '';
  if (def.customCss) {
    try {
      css = await fs.readFile(path.join(themeDir, def.customCss), 'utf-8');
    } catch { /* leave empty */ }
  }
  return { json: jsonStr, css };
}

async function restoreThemeFiles(themeDir: string, snapshot: { json: string; css: string }, cssFilename: string): Promise<ThemeDefinition> {
  await fs.writeFile(path.join(themeDir, 'theme.json'), snapshot.json, 'utf-8');
  if (cssFilename) {
    await fs.writeFile(path.join(themeDir, cssFilename), snapshot.css, 'utf-8');
  }
  return JSON.parse(snapshot.json) as ThemeDefinition;
}

export async function runThemeEdit(opts: { workDir: string; port?: number; force?: boolean }): Promise<void> {
  if (await needsSetup()) {
    await runSetupWizard();
  }

  const config = await loadConfig();

  if (!config.llm.apiKey && config.llm.provider !== 'local') {
    logger.error('API key not configured. Run: aipres config set llm.apiKey <your-key>');
    process.exit(1);
  }

  const { workDir } = opts;

  // Read current theme from slides.json
  const model = await loadState(workDir);
  const themeValue = model.theme;

  // Load theme to classify it
  let loaded;
  try {
    loaded = await loadTheme(themeValue, workDir);
  } catch (err) {
    logger.error(`Theme "${themeValue}" not found: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const { def: themeDef, dir: themeDir } = loaded;

  // Built-in theme (no directory) — cannot edit
  if (themeDir === null) {
    logger.error(`"${themeValue}" is a built-in theme and cannot be edited directly.`);
    logger.error(`Create a custom copy with: aipres theme new <name>`);
    logger.error(`Then set it in your slides.json: "theme": "<name>"`);
    process.exit(1);
  }

  // Global theme (name-based, not a path) — warn before editing
  if (!isThemePath(themeValue) && !opts.force) {
    logger.warn(`"${themeValue}" is a global theme stored in ~/.aipres/themes/${themeValue}/`);
    logger.warn('Editing it will affect all projects that use this theme.');
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Continue editing the global theme?',
        default: false,
      },
    ]);
    if (!confirm) {
      logger.info('Cancelled. To edit a project-local theme, set "theme" to a path like "./theme" in slides.json.');
      return;
    }
  }

  const port = opts.port ?? config.preview.port;
  const sampleModel = { ...SAMPLE_SLIDES, theme: themeValue };

  const server = createServer(sampleModel, config, port);
  server.listen(port, () => {
    logger.success(`Preview server running at http://localhost:${port}`);
    logger.dim('Showing sample slides with the current theme.');
  });

  if (config.preview.autoOpen) {
    const { default: open } = await import('open');
    await open(`http://localhost:${port}`);
  }

  // Take snapshot for /reset
  let currentDef = themeDef;
  const snapshot = await readThemeFiles(themeDir, currentDef);
  const cssFilename = currentDef.customCss || 'custom.css';

  const systemPrompt = buildThemeSystemPrompt(config.llm.language, buildSampleDescription());
  const provider = createProvider(config);
  const messages: Message[] = [];

  const displayName = isThemePath(themeValue) ? themeValue : currentDef.displayName ?? currentDef.name;
  console.log(chalk.green(`\nTheme editor: ${displayName}`));
  console.log(chalk.dim('Describe the look you want. Type /help for commands. Ctrl-C to quit.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  await new Promise<void>((resolve) => {
    const prompt = () => {
      process.stdout.write(divider('You', chalk.bold.blue));
      rl.question(chalk.blue('> '), async (input) => {
        input = input.trim();

        if (!input) {
          prompt();
          return;
        }

        if (input.startsWith('/')) {
          const cmd = input.split(/\s+/)[0].toLowerCase();

          if (cmd === '/quit' || cmd === '/exit') {
            console.log(chalk.dim('\nTheme editor closed.'));
            rl.close();
            return;
          }

          if (cmd === '/reset') {
            const spinner = ora({ text: 'Restoring...', discardStdin: false }).start();
            try {
              currentDef = await restoreThemeFiles(themeDir, snapshot, cssFilename);
              messages.length = 0;
              const { broadcast } = await import('../preview/server.js');
              broadcast({ type: 'reload' });
              spinner.succeed('Theme restored to session-start state.');
            } catch (err) {
              spinner.fail(`Restore failed: ${err instanceof Error ? err.message : String(err)}`);
            }
            prompt();
            return;
          }

          if (cmd === '/help') {
            printHelp();
            prompt();
            return;
          }

          logger.warn(`Unknown command: ${cmd}. Type /help for help.`);
          prompt();
          return;
        }

        messages.push({ role: 'user', content: input });

        const spinner = ora({ text: chalk.dim('Thinking...'), spinner: 'dots', discardStdin: false }).start();

        try {
          spinner.stop();
          process.stdout.write(divider('Assistant', chalk.bold.green));

          const result = await runThemeToolUseLoop(systemPrompt, messages, currentDef, themeDir, provider);
          currentDef = result.updatedDef;
          messages.length = 0;
          messages.push(...result.messages);
        } catch (err) {
          spinner.fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }

        prompt();
      });
    };

    rl.on('close', () => {
      console.log(chalk.dim('\nTheme editor closed.'));
      resolve();
    });

    rl.on('SIGINT', () => {
      rl.close();
    });

    prompt();
  });

  server.close();
}
