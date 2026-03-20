import { loadConfig } from '../config/config.js';
import { loadState, ensureActiveSession } from '../model/state.js';
import { writeHtml } from '../renderer/html.js';
import { logger } from '../utils/logger.js';

export async function runExport(
  file?: string,
  opts: { open?: boolean } = {}
): Promise<void> {
  const config = await loadConfig();
  const activeName = await ensureActiveSession();
  const outputFile = file ?? config.export.defaultFile ?? `./${activeName}.html`;

  logger.info(`Loading slides...`);
  const model = await loadState(activeName);

  logger.info(`Rendering presentation...`);
  await writeHtml(model, outputFile, config);

  logger.success(`Exported to ${outputFile}`);

  if (opts.open) {
    const { default: open } = await import('open');
    await open(outputFile);
  }
}
