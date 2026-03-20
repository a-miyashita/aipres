import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from '../config/config.js';
import { needsSetup, runSetupWizard } from '../config/setup.js';
import {
  loadState, saveState, resetState,
  loadSession, saveSession, resetSession,
  migrateFromV1IfNeeded, ensureActiveSession,
  sessionExists, createSession, listSessions,
  setActiveSession, getSlidesPath,
  validateSessionName,
} from '../model/state.js';
import { AnthropicProvider } from '../llm/anthropic.js';
import { buildSystemPrompt } from '../llm/tools.js';
import { runToolUseLoop } from '../llm/dispatcher.js';
import { writeHtml } from '../renderer/html.js';
import { logger } from '../utils/logger.js';
import type { Message } from '../llm/provider.js';
import { resolveImageRefs, buildMultimodalMessage } from './image-resolver.js';

export interface RunChatOptions {
  presName?: string;
  onSessionSwitch?: (newName: string, newSlidesPath: string) => void;
}

function divider(label: string, color: (s: string) => string): string {
  const width = process.stdout.columns || 80;
  const prefix = `── ${label} `;
  const line = '─'.repeat(Math.max(0, width - prefix.length));
  return color(`\n${prefix}${line}\n`);
}

function printHelp(): void {
  console.log(chalk.cyan('\nAvailable commands:'));
  console.log('  /quit, /exit         - End the session');
  console.log('  /reset               - Reset slides to empty');
  console.log('  /export [file]       - Export to HTML file');
  console.log('  /summary             - Show current slide list');
  console.log('  /pres                - Show current presentation');
  console.log('  /pres list           - List all presentations');
  console.log('  /pres new <name>     - Create and switch to a new presentation');
  console.log('  /pres switch <name>  - Switch to another presentation');
  console.log('  /help                - Show this help');
  console.log('');
}

export async function runChat(opts: RunChatOptions = {}): Promise<void> {
  // Check setup
  if (await needsSetup()) {
    await runSetupWizard();
  }

  const config = await loadConfig();

  if (!config.llm.apiKey) {
    logger.error('API key not configured. Run: aipres config set llm.apiKey <your-key>');
    process.exit(1);
  }

  await migrateFromV1IfNeeded();

  let currentName: string;
  if (opts.presName) {
    if (!(await sessionExists(opts.presName))) {
      await createSession(opts.presName);
    }
    await setActiveSession(opts.presName);
    currentName = opts.presName;
  } else {
    currentName = await ensureActiveSession();
  }

  let model = await loadState(currentName);

  const provider = new AnthropicProvider(config.llm.apiKey, config.llm.model);

  const systemPrompt = buildSystemPrompt(config.llm.language);
  const messages: Message[] = await loadSession(currentName);

  console.log(chalk.green(`\nWelcome to aipres chat! [${currentName}]`));
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

  // Switch to a different presentation (shared by /pres new and /pres switch)
  async function switchPres(newName: string): Promise<void> {
    await saveState(model, currentName);
    await saveSession(messages, currentName);
    currentName = newName;
    model = await loadState(newName);
    const loaded = await loadSession(newName);
    messages.length = 0;
    messages.push(...loaded);
    await setActiveSession(newName);
    opts.onSessionSwitch?.(newName, getSlidesPath(newName));
    logger.success(`Switched to: ${newName}`);
  }

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
            await resetState(currentName);
            await resetSession(currentName);
            model = await loadState(currentName);
            messages.length = 0;
            logger.success('Slides and conversation history reset.');
            prompt();
            return;
          }

          if (cmd === '/export') {
            const file = parts[1] ?? config.export.defaultFile ?? `./${currentName}.html`;
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

          if (cmd === '/pres') {
            const sub = parts[1]?.toLowerCase();

            if (!sub) {
              logger.info(`Current presentation: ${currentName} (${model.slides.length} slide(s))`);
              prompt();
              return;
            }

            if (sub === 'list') {
              const sessions = await listSessions();
              if (sessions.length === 0) {
                console.log(chalk.dim('No presentations found.'));
              } else {
                console.log(chalk.cyan('\n── Presentations ──'));
                for (const s of sessions) {
                  const marker = s.active ? chalk.green('* ') : '  ';
                  const count = `${s.slideCount} slide${s.slideCount !== 1 ? 's' : ''}`;
                  console.log(`${marker}${s.name} ${chalk.dim(`(${count})`)}`);
                }
                console.log(chalk.cyan('────────────────────\n'));
              }
              prompt();
              return;
            }

            if (sub === 'new') {
              const name = parts[2];
              if (!name) {
                logger.warn('Usage: /pres new <name>');
                prompt();
                return;
              }
              const err = validateSessionName(name);
              if (err) {
                logger.warn(`Invalid name: ${err}`);
                prompt();
                return;
              }
              if (await sessionExists(name)) {
                logger.warn(`Presentation "${name}" already exists.`);
                prompt();
                return;
              }
              await createSession(name);
              await switchPres(name);
              prompt();
              return;
            }

            if (sub === 'switch') {
              const name = parts[2];
              if (!name) {
                logger.warn('Usage: /pres switch <name>');
                prompt();
                return;
              }
              if (!(await sessionExists(name))) {
                logger.warn(`Presentation "${name}" not found.`);
                prompt();
                return;
              }
              await switchPres(name);
              prompt();
              return;
            }

            logger.warn(`Unknown /pres subcommand: ${sub}. Try /help.`);
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

          messages.length = 0;
          messages.push(...result.messages);

          await saveState(model, currentName);
          await saveSession(messages, currentName);

          // Regenerate HTML silently
          try {
            const htmlFile = config.export.defaultFile ?? `./${currentName}.html`;
            await writeHtml(model, htmlFile, config);
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
