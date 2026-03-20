import * as fs from 'fs/promises';
import chokidar from 'chokidar';
import { SlideModelSchema } from '../model/types.js';
import { broadcast, updateServerModel } from './server.js';

export function startWatcher(slidesPath: string): import('chokidar').FSWatcher {
  const watcher = chokidar.watch(slidesPath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', async (changedPath) => {
    try {
      const content = await fs.readFile(changedPath, 'utf-8');
      const data = JSON.parse(content);
      const result = SlideModelSchema.safeParse(data);
      if (result.success) {
        updateServerModel(result.data);
        broadcast({ type: 'reload' });
      }
    } catch {
      // Ignore errors during hot reload
    }
  });

  return watcher;
}
