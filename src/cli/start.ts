import { loadConfig } from '../config/config.js';
import {
  loadState,
  migrateFromV1IfNeeded,
  ensureActiveSession,
  setActiveSession,
  sessionExists,
  createSession,
  getSlidesPath,
} from '../model/state.js';
import { createServer } from '../preview/server.js';
import { startWatcher } from '../preview/watcher.js';
import { logger } from '../utils/logger.js';
import { runChat } from './chat.js';

export async function runStart(opts: { port?: number; pres?: string } = {}): Promise<void> {
  const config = await loadConfig();
  const port = opts.port ?? config.preview.port;

  await migrateFromV1IfNeeded();

  let activeName: string;
  if (opts.pres) {
    if (!(await sessionExists(opts.pres))) {
      await createSession(opts.pres);
    }
    await setActiveSession(opts.pres);
    activeName = opts.pres;
  } else {
    activeName = await ensureActiveSession();
  }

  const model = await loadState(activeName);

  const server = createServer(model, config, port);

  server.listen(port, () => {
    logger.success(`Preview server running at http://localhost:${port}`);
  });

  let currentSlidesPath = getSlidesPath(activeName);
  const watcher = startWatcher(currentSlidesPath);

  if (config.preview.autoOpen) {
    const { default: open } = await import('open');
    await open(`http://localhost:${port}`);
  }

  await runChat({
    presName: activeName,
    onSessionSwitch(newName, newSlidesPath) {
      watcher.unwatch(currentSlidesPath);
      watcher.add(newSlidesPath);
      currentSlidesPath = newSlidesPath;
    },
  });

  await watcher.close();
  server.close();
}
