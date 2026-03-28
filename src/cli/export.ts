import * as path from 'path';
import { loadConfig } from '../config/config.js';
import { loadState } from '../model/state.js';
import { writeHtml } from '../renderer/html.js';
import { logger } from '../utils/logger.js';

export async function runExport(
  file?: string,
  opts: { open?: boolean; workDir: string } = { workDir: process.cwd() }
): Promise<void> {
  const config = await loadConfig();
  const { workDir } = opts;
  const outputFile = file ?? config.export.defaultFile ?? path.join(workDir, 'presentation.html');

  logger.info(`Loading slides...`);
  const model = await loadState(workDir);

  logger.info(`Rendering presentation...`);
  await writeHtml(model, outputFile, config, workDir);

  logger.success(`Exported to ${outputFile}`);

  if (opts.open) {
    const { default: open } = await import('open');
    await open(outputFile);
  }
}
