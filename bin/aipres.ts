#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { statSync } from 'fs';
import { Command } from 'commander';
import { runStart } from '../src/cli/start.js';
import { runChat } from '../src/cli/chat.js';
import { runExport } from '../src/cli/export.js';
import { runPreview } from '../src/cli/preview.js';
import { runThemeList, runThemeAdd, runThemeNew, runThemeEdit, runThemeDelete } from '../src/cli/theme.js';
import { runConfigList, runConfigGet, runConfigSet, runConfigReset } from '../src/cli/config.js';
import { runReset } from '../src/cli/reset.js';

const _dir = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(_dir, '../package.json'), 'utf-8')) as { version: string };

function resolveWorkDir(raw?: string): string {
  if (!raw) return process.cwd();
  const abs = resolve(raw);
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    console.error(`error: working directory '${abs}' does not exist`);
    process.exit(1);
  }
  if (!stat.isDirectory()) {
    console.error(`error: '${abs}' is not a directory`);
    process.exit(1);
  }
  return abs;
}

const program = new Command();

program
  .name('aipres')
  .description('LLM-powered interactive Reveal.js presentation builder')
  .version(version)
  .option('-w, --work-dir <path>', 'Working directory (session directory)')
  .option('--port <n>', 'Port number for preview server', (v) => parseInt(v, 10))
  .action(async (opts) => {
    await runStart({ port: opts.port, workDir: resolveWorkDir(opts.workDir) });
  });

// aipres chat (headless / CI)
program
  .command('chat')
  .description('Start interactive chat without preview server')
  .option('-w, --work-dir <path>', 'Working directory (session directory)')
  .action(async (opts) => {
    await runChat({ workDir: resolveWorkDir(opts.workDir) });
  });

// aipres preview
program
  .command('preview')
  .description('Start live preview server with hot reload')
  .option('-w, --work-dir <path>', 'Working directory (session directory)')
  .option('--port <n>', 'Port number', (v) => parseInt(v, 10))
  .action(async (opts) => {
    await runPreview({ port: opts.port, workDir: resolveWorkDir(opts.workDir) });
  });

// aipres export
program
  .command('export [file]')
  .description('Export presentation to HTML file')
  .option('-w, --work-dir <path>', 'Working directory (session directory)')
  .option('--open', 'Open in browser after export')
  .action(async (file, opts) => {
    await runExport(file, { open: opts.open, workDir: resolveWorkDir(opts.workDir) });
  });

// aipres theme
const themeCmd = program.command('theme').description('Manage themes');

themeCmd
  .command('list')
  .description('List available themes')
  .option('-w, --work-dir <path>', 'Working directory (for current theme detection)')
  .action(async (opts) => {
    await runThemeList({ workDir: resolveWorkDir(opts.workDir) });
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
  .command('edit')
  .description('Edit the current presentation theme with LLM assistance')
  .option('-w, --work-dir <path>', 'Working directory (session directory)')
  .option('--port <n>', 'Port number for preview server', (v) => parseInt(v, 10))
  .option('--force', 'Skip confirmation for global theme edits')
  .action(async (opts) => {
    await runThemeEdit({ workDir: resolveWorkDir(opts.workDir), port: opts.port, force: opts.force });
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
  .option('-w, --work-dir <path>', 'Working directory (session directory)')
  .option('--force', 'Skip confirmation')
  .action(async (opts) => {
    await runReset({ force: opts.force, workDir: resolveWorkDir(opts.workDir) });
  });

(async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
