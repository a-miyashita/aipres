#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Command } from 'commander';
import { runStart } from '../src/cli/start.js';
import { runChat } from '../src/cli/chat.js';
import { runExport } from '../src/cli/export.js';
import { runPreview } from '../src/cli/preview.js';
import { runThemeList, runThemeAdd, runThemeNew, runThemeEdit, runThemeDelete } from '../src/cli/theme.js';
import { runConfigList, runConfigGet, runConfigSet, runConfigReset } from '../src/cli/config.js';
import { runReset } from '../src/cli/reset.js';
import {
  cmdPressList,
  cmdPresNew,
  cmdPresSwitch,
  cmdPresRename,
  cmdPresDelete,
} from '../src/cli/session.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(_dir, '../package.json'), 'utf-8')) as { version: string };

const program = new Command();

program
  .name('aipres')
  .description('LLM-powered interactive Reveal.js presentation builder')
  .version(version)
  .option('--port <n>', 'Port number for preview server', (v) => parseInt(v, 10))
  .option('--pres <name>', 'Presentation name to use')
  .action(async (opts) => {
    await runStart({ port: opts.port, pres: opts.pres });
  });

// aipres chat (headless / CI)
program
  .command('chat')
  .description('Start interactive chat without preview server')
  .option('--pres <name>', 'Presentation name to use')
  .action(async (opts) => {
    await runChat({ presName: opts.pres });
  });

// aipres preview
program
  .command('preview')
  .description('Start live preview server with hot reload')
  .option('--port <n>', 'Port number', (v) => parseInt(v, 10))
  .action(async (opts) => {
    await runPreview({ port: opts.port });
  });

// aipres export
program
  .command('export [file]')
  .description('Export presentation to HTML file')
  .option('--open', 'Open in browser after export')
  .action(async (file, opts) => {
    await runExport(file, { open: opts.open });
  });

// aipres theme
const themeCmd = program.command('theme').description('Manage themes');

themeCmd
  .command('list')
  .description('List installed themes')
  .action(async () => {
    await runThemeList();
  });

themeCmd
  .command('add <path>')
  .description('Add a theme from a directory')
  .action(async (themePath: string) => {
    await runThemeAdd(themePath);
  });

themeCmd
  .command('new <name>')
  .description('Create a new theme based on the default')
  .action(async (name: string) => {
    await runThemeNew(name);
  });

themeCmd
  .command('edit <name>')
  .description('Edit a theme with LLM assistance')
  .option('--port <n>', 'Port number for preview server', (v) => parseInt(v, 10))
  .action(async (name: string, opts) => {
    await runThemeEdit(name, { port: opts.port });
  });

themeCmd
  .command('delete <name>')
  .description('Delete a user-installed theme')
  .option('--force', 'Skip confirmation')
  .action(async (name: string, opts) => {
    await runThemeDelete(name, { force: opts.force });
  });

// aipres config
const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('list')
  .description('Show all configuration values')
  .action(async () => {
    await runConfigList();
  });

configCmd
  .command('get <key>')
  .description('Get a configuration value (dot notation)')
  .action(async (key: string) => {
    await runConfigGet(key);
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value (dot notation)')
  .action(async (key: string, value: string) => {
    await runConfigSet(key, value);
  });

configCmd
  .command('reset')
  .description('Reset configuration to defaults')
  .option('--force', 'Skip confirmation')
  .action(async (opts) => {
    await runConfigReset({ force: opts.force });
  });

// aipres reset
program
  .command('reset')
  .description('Reset current slides to empty')
  .option('--force', 'Skip confirmation')
  .action(async (opts) => {
    await runReset({ force: opts.force });
  });

// Helper to build the pres subcommands on a given Command
function addPresSubcommands(cmd: Command): Command {
  cmd
    .command('list')
    .description('List all presentations')
    .action(async () => {
      await cmdPressList();
    });

  cmd
    .command('new <name>')
    .description('Create a new presentation and switch to it')
    .action(async (name: string) => {
      await cmdPresNew(name);
    });

  cmd
    .command('switch <name>')
    .description('Switch active presentation')
    .action(async (name: string) => {
      await cmdPresSwitch(name);
    });

  cmd
    .command('rename <old> <new>')
    .description('Rename a presentation')
    .action(async (oldName: string, newName: string) => {
      await cmdPresRename(oldName, newName);
    });

  cmd
    .command('delete <name>')
    .description('Delete a presentation')
    .option('--force', 'Skip confirmation')
    .action(async (name: string, opts) => {
      await cmdPresDelete(name, { force: opts.force });
    });

  return cmd;
}

// aipres pres
const presCmd = new Command('pres').description('Manage presentations');
addPresSubcommands(presCmd);
program.addCommand(presCmd);

// aipres presentation (alias)
const presentationCmd = new Command('presentation').description('Manage presentations');
addPresSubcommands(presentationCmd);
program.addCommand(presentationCmd);

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
