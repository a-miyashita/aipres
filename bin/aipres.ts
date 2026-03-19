#!/usr/bin/env node
import { Command } from 'commander';
import { runChat } from '../src/cli/chat.js';
import { runExport } from '../src/cli/export.js';
import { runPreview } from '../src/cli/preview.js';
import { runThemeList, runThemeAdd } from '../src/cli/theme.js';
import { runConfigList, runConfigGet, runConfigSet, runConfigReset } from '../src/cli/config.js';
import { runReset } from '../src/cli/reset.js';

const program = new Command();

program
  .name('aipres')
  .description('LLM-powered interactive Reveal.js presentation builder')
  .version('0.1.0');

// preso chat
program
  .command('chat')
  .description('Start interactive chat to build a presentation')
  .action(async () => {
    await runChat();
  });

// preso preview
program
  .command('preview')
  .description('Start live preview server with hot reload')
  .option('--port <n>', 'Port number', (v) => parseInt(v, 10))
  .action(async (opts) => {
    await runPreview({ port: opts.port });
  });

// preso export
program
  .command('export [file]')
  .description('Export presentation to HTML file')
  .option('--open', 'Open in browser after export')
  .action(async (file, opts) => {
    await runExport(file, { open: opts.open });
  });

// preso theme
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

// preso config
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

// preso reset
program
  .command('reset')
  .description('Reset current slides to empty')
  .option('--force', 'Skip confirmation')
  .action(async (opts) => {
    await runReset({ force: opts.force });
  });

program.parse(process.argv);
