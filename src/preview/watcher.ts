import chokidar from 'chokidar';
import { getStatePath, loadState } from '../model/state.js';
import { broadcast, updateServerModel } from './server.js';

export function startWatcher(): void {
  const statePath = getStatePath();

  const watcher = chokidar.watch(statePath, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', async () => {
    try {
      const model = await loadState();
      updateServerModel(model);
      broadcast({ type: 'reload' });
    } catch {
      // Ignore errors during hot reload
    }
  });
}
