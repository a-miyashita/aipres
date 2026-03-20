import inquirer from 'inquirer';
import chalk from 'chalk';
import { listThemes, addTheme, createTheme, deleteTheme } from '../theme/manager.js';
import { loadState } from '../model/state.js';
import { logger } from '../utils/logger.js';
export { runThemeEdit } from './theme-editor.js';

export async function runThemeList(): Promise<void> {
  const themes = await listThemes();
  const model = await loadState();
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

export async function runThemeNew(name: string): Promise<void> {
  try {
    await createTheme(name);
    logger.success(`Theme "${name}" created. Edit it with: aipres theme edit ${name}`);
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
