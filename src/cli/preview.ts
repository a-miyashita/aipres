import { loadConfig } from '../config/config.js';
import { loadState, ensureActiveSession, getSlidesPath } from '../model/state.js';
import { createServer } from '../preview/server.js';
import { startWatcher } from '../preview/watcher.js';
import { logger } from '../utils/logger.js';

export async function runPreview(opts: { port?: number } = {}): Promise<void> {
  const config = await loadConfig();
  const port = opts.port ?? config.preview.port;

  const activeName = await ensureActiveSession();
  const model = await loadState(activeName);

  const server = createServer(model, config, port);

  server.listen(port, () => {
    logger.success(`Preview server running at http://localhost:${port}`);
    logger.dim('Watching for changes... Press Ctrl-C to stop.');
  });

  startWatcher(getSlidesPath(activeName));

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
