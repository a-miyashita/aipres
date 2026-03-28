import { loadConfig } from '../config/config.js';
import { loadState, getSlidesPath } from '../model/state.js';
import { createServer } from '../preview/server.js';
import { startWatcher } from '../preview/watcher.js';
import { logger } from '../utils/logger.js';

export async function runPreview(opts: { port?: number; workDir: string }): Promise<void> {
  const config = await loadConfig();
  const port = opts.port ?? config.preview.port;
  const { workDir } = opts;

  const model = await loadState(workDir);

  const server = createServer(model, config, port, workDir);

  server.listen(port, () => {
    logger.success(`Preview server running at http://localhost:${port}`);
    logger.dim('Watching for changes... Press Ctrl-C to stop.');
  });

  startWatcher(getSlidesPath(workDir));

  if (config.preview.autoOpen) {
    const { default: open } = await import('open');
    await open(`http://localhost:${port}`);
  }

  process.on('SIGINT', () => {
    server.close(() => {
      logger.info('Preview server stopped.');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
