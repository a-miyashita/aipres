import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { listThemes, addTheme, createTheme, createThemeAt, isThemePath, deleteTheme } from '../theme/manager.js';
import { loadState, saveState } from '../model/state.js';
import { logger } from '../utils/logger.js';
export { runThemeEdit } from './theme-editor.js';

export async function runThemeList(opts: { workDir: string }): Promise<void> {
  const themes = await listThemes();
  const model = await loadState(opts.workDir);
  const current = model.theme;

  if (themes.length === 0) {
    logger.info('No themes installed. Run setup or add a theme with: aipres theme add <path>');
    return;
  }

  console.log('\nInstalled themes:');
  for (const theme of themes) {
    const marker = theme.name === current ? ' (current)' : '';
    console.log(`  ${theme.name}${marker} - ${theme.displayName}: ${theme.description}`);
  }
  console.log('');
}

export async function runThemeAdd(themePath: string): Promise<void> {
  try {
    await addTheme(themePath);
    logger.success(`Theme added from ${themePath}`);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function runThemeNew(name: string, opts: { workDir: string }): Promise<void> {
  try {
    if (isThemePath(name)) {
      const dirPath = path.resolve(opts.workDir, name);
      await createThemeAt(dirPath);
      const model = await loadState(opts.workDir);
      await saveState({ ...model, theme: name }, opts.workDir);
      logger.success(`Theme created at ${name}/`);
      logger.dim(`slides.json updated: "theme": "${name}"`);
      logger.dim(`Run: aipres theme edit to start customising`);
    } else {
      await createTheme(name);
      logger.success(`Theme "${name}" created. Edit it with: aipres theme edit`);
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

export async function runThemeDelete(name: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Delete theme "${name}"? This cannot be undone.`,
      default: false,
    }]);
    if (!confirmed) {
      console.log(chalk.dim('Cancelled.'));
      return;
    }
  }

  try {
    await deleteTheme(name);
    logger.success(`Theme "${name}" deleted.`);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
