import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../config/config.js';
import { needsSetup, runSetupWizard } from '../config/setup.js';
import { loadState, saveState, resetState, loadSession, saveSession, resetSession } from '../model/state.js';
import { AnthropicProvider } from '../llm/anthropic.js';
import { buildSystemPrompt } from '../llm/tools.js';
import { runToolUseLoop } from '../llm/dispatcher.js';
import { writeHtml } from '../renderer/html.js';
import { logger } from '../utils/logger.js';
import type { Message } from '../llm/provider.js';
import { resolveImageRefs, buildMultimodalMessage } from './image-resolver.js';

function divider(label: string, color: (s: string) => string): string {
  const width = process.stdout.columns || 80;
  const prefix = `── ${label} `;
  const line = '─'.repeat(Math.max(0, width - prefix.length));
  return color(`\n${prefix}${line}\n`);
}

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
  const messages: Message[] = await loadSession();

  console.log(chalk.green('\nWelcome to aipres chat!'));
  console.log(chalk.dim('Type your message, or /help for commands. Ctrl-C to quit.\n'));

  if (messages.length > 0) {
    logger.info(`Resuming session: ${messages.filter(m => m.role === 'user').length} exchange(s), ${model.slides.length} slide(s).`);
  } else if (model.slides.length > 0) {
    logger.info(`${model.slides.length} slide(s) loaded.`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise<void>((resolve) => {
    const prompt = () => {
      process.stdout.write(divider('You', chalk.bold.blue));
      rl.question(chalk.blue('> '), async (input) => {
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
            await resetSession();
            model = await loadState();
            messages.length = 0;
            logger.success('Slides and conversation history reset.');
            prompt();
            return;
          }

          if (cmd === '/export') {
            const file = parts[1] ?? config.export.defaultFile;
            const spinner = ora({ text: 'Exporting...', discardStdin: false }).start();
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
        const imageRefs = await resolveImageRefs(input, process.cwd());
        if (imageRefs.length > 0) {
          messages.push({ role: 'user', content: buildMultimodalMessage(input, imageRefs) });
        } else {
          messages.push({ role: 'user', content: input });
        }

        const spinner = ora({ text: chalk.dim('Thinking...'), spinner: 'dots', discardStdin: false }).start();

        try {
          spinner.stop();
          process.stdout.write(divider('Assistant', chalk.bold.green));

          const result = await runToolUseLoop(systemPrompt, messages, model, provider);
          model = result.updatedModel;

          // Update messages (runToolUseLoop already appended to the array copy)
          // We need to sync back
          messages.length = 0;
          messages.push(...result.messages);

          await saveState(model);
          await saveSession(messages);

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
      resolve();
    });

    rl.on('SIGINT', () => {
      rl.close();
    });

    prompt();
  });
}
