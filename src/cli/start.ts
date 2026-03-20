import { loadConfig } from '../config/config.js';
import { loadState } from '../model/state.js';
import { createServer } from '../preview/server.js';
import { startWatcher } from '../preview/watcher.js';
import { logger } from '../utils/logger.js';
import { runChat } from './chat.js';

export async function runStart(opts: { port?: number } = {}): Promise<void> {
  const config = await loadConfig();
  const port = opts.port ?? config.preview.port;
  const model = await loadState();

  const server = createServer(model, config, port);

  server.listen(port, () => {
    logger.success(`Preview server running at http://localhost:${port}`);
  });

  startWatcher();

  if (config.preview.autoOpen) {
    const { default: open } = await import('open');
    await open(`http://localhost:${port}`);
  }

  await runChat();
}
