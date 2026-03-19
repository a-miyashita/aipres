import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../config/config.js';
import { needsSetup, runSetupWizard } from '../config/setup.js';
import { loadState, saveState, resetState } from '../model/state.js';
import { AnthropicProvider } from '../llm/anthropic.js';
import { buildSystemPrompt } from '../llm/tools.js';
import { runToolUseLoop } from '../llm/dispatcher.js';
import { writeHtml } from '../renderer/html.js';
import { logger } from '../utils/logger.js';
import type { Message } from '../llm/provider.js';

function printHelp(): void {
  console.log(chalk.cyan('\nAvailable commands:'));
  console.log('  /quit, /exit    - End the session');
  console.log('  /reset          - Reset slides to empty');
  console.log('  /export [file]  - Export to HTML file');
  console.log('  /summary        - Show current slide list');
  console.log('  /help           - Show this help');
  console.log('');
}

export async function runChat(): Promise<void> {
  // Check setup
  if (await needsSetup()) {
    await runSetupWizard();
  }

  const config = await loadConfig();

  if (!config.llm.apiKey) {
    logger.error('API key not configured. Run: aipres config set llm.apiKey <your-key>');
    process.exit(1);
  }

  let model = await loadState();

  const provider = new AnthropicProvider(config.llm.apiKey, config.llm.model);

  const systemPrompt = buildSystemPrompt(config.llm.language);
  const messages: Message[] = [];

  console.log(chalk.green('\nWelcome to aipres chat!'));
  console.log(chalk.dim('Type your message, or /help for commands. Ctrl-C to quit.\n'));

  if (model.slides.length > 0) {
    logger.info(`Resuming session with ${model.slides.length} slide(s).`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = () => {
    rl.question(chalk.bold.blue('you> '), async (input) => {
      input = input.trim();

      if (!input) {
        prompt();
        return;
      }

      // Slash commands
      if (input.startsWith('/')) {
        const parts = input.split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (cmd === '/quit' || cmd === '/exit') {
          console.log(chalk.dim('\nSession ended. Slides saved.'));
          rl.close();
          return;
        }

        if (cmd === '/reset') {
          await resetState();
          model = await loadState();
          logger.success('Slides reset to empty.');
          prompt();
          return;
        }

        if (cmd === '/export') {
          const file = parts[1] ?? config.export.defaultFile;
          const spinner = ora('Exporting...').start();
          try {
            await writeHtml(model, file, config);
            spinner.succeed(`Exported to ${file}`);
          } catch (err) {
            spinner.fail(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
          }
          prompt();
          return;
        }

        if (cmd === '/summary') {
          if (model.slides.length === 0) {
            logger.info('No slides yet.');
          } else {
            console.log(chalk.cyan('\n── Slide Summary ──'));
            model.slides.forEach((slide, i) => {
              const title = slide.title ? `: ${slide.title}` : '';
              console.log(`  [${i}] ${slide.layout}${title}`);
            });
            console.log(chalk.cyan('──────────────────\n'));
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

      // Normal message — send to LLM
      messages.push({ role: 'user', content: input });

      const spinner = ora({ text: chalk.dim('Thinking...'), spinner: 'dots' }).start();

      try {
        spinner.stop();
        process.stdout.write(chalk.bold.green('assistant> '));

        const result = await runToolUseLoop(systemPrompt, messages, model, provider);
        model = result.updatedModel;

        // Update messages (runToolUseLoop already appended to the array copy)
        // We need to sync back
        messages.length = 0;
        messages.push(...result.messages);

        await saveState(model);

        // Regenerate HTML silently
        try {
          await writeHtml(model, config.export.defaultFile, config);
        } catch {
          // Ignore HTML generation errors
        }

      } catch (err) {
        spinner.fail(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }

      prompt();
    });
  };

  rl.on('close', () => {
    console.log(chalk.dim('\nSession ended. Slides saved.'));
    process.exit(0);
  });

  rl.on('SIGINT', () => {
    console.log(chalk.dim('\nSession ended. Slides saved.'));
    process.exit(0);
  });

  prompt();
}
