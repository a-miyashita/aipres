import { resetState, resetSession } from '../model/state.js';
import { logger } from '../utils/logger.js';

export async function runReset(opts: { force?: boolean; workDir: string }): Promise<void> {
  if (!opts.force) {
    const { default: inquirer } = await import('inquirer');
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Reset all slides? This cannot be undone.',
        default: false,
      },
    ]);
    if (!confirm) {
      logger.info('Cancelled.');
      return;
    }
  }

  await resetState(opts.workDir);
  await resetSession(opts.workDir);
  logger.success('Slides reset to empty.');
}
