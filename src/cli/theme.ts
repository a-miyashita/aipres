import { listThemes, addTheme } from '../theme/manager.js';
import { loadState } from '../model/state.js';
import { logger } from '../utils/logger.js';

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
