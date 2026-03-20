import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  listSessions,
  createSession,
  setActiveSession,
  clearActiveSession,
  sessionExists,
  deleteSession,
  renameSession,
  loadActiveSession,
  validateSessionName,
} from '../model/state.js';

export async function cmdPressList(): Promise<void> {
  const sessions = await listSessions();
  if (sessions.length === 0) {
    console.log(chalk.dim('No presentations found.'));
    return;
  }
  console.log(chalk.cyan('\n── Presentations ──'));
  for (const s of sessions) {
    const marker = s.active ? chalk.green('* ') : '  ';
    const count = `${s.slideCount} slide${s.slideCount !== 1 ? 's' : ''}`;
    console.log(`${marker}${s.name} ${chalk.dim(`(${count})`)}`);
  }
  console.log(chalk.cyan('────────────────────\n'));
}

export async function cmdPresNew(name: string): Promise<void> {
  const err = validateSessionName(name);
  if (err) {
    console.error(chalk.red(`Invalid name: ${err}`));
    process.exit(1);
  }
  if (await sessionExists(name)) {
    console.error(chalk.red(`Presentation "${name}" already exists.`));
    process.exit(1);
  }
  await createSession(name);
  await setActiveSession(name);
  console.log(chalk.green(`Created and switched to: ${name}`));
}

export async function cmdPresSwitch(name: string): Promise<void> {
  if (!(await sessionExists(name))) {
    console.error(chalk.red(`Presentation "${name}" not found.`));
    process.exit(1);
  }
  await setActiveSession(name);
  console.log(chalk.green(`Switched to: ${name}`));
}

export async function cmdPresRename(oldName: string, newName: string): Promise<void> {
  if (!(await sessionExists(oldName))) {
    console.error(chalk.red(`Presentation "${oldName}" not found.`));
    process.exit(1);
  }
  const err = validateSessionName(newName);
  if (err) {
    console.error(chalk.red(`Invalid name: ${err}`));
    process.exit(1);
  }
  if (await sessionExists(newName)) {
    console.error(chalk.red(`Presentation "${newName}" already exists.`));
    process.exit(1);
  }
  await renameSession(oldName, newName);
  const active = await loadActiveSession();
  if (active === oldName) await setActiveSession(newName);
  console.log(chalk.green(`Renamed "${oldName}" → "${newName}"`));
}

export async function cmdPresDelete(name: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!(await sessionExists(name))) {
    console.error(chalk.red(`Presentation "${name}" not found.`));
    process.exit(1);
  }

  if (!opts.force) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: `Delete presentation "${name}"? This cannot be undone.`,
      default: false,
    }]);
    if (!confirmed) {
      console.log(chalk.dim('Cancelled.'));
      return;
    }
  }

  const active = await loadActiveSession();
  await deleteSession(name);

  if (active === name) {
    // Clear .active; next aipres invocation will auto-create untitled
    await clearActiveSession();
    console.log(chalk.green(`Deleted: ${name}`) + chalk.dim(' (no active presentation — run aipres to create one)'));
  } else {
    console.log(chalk.green(`Deleted: ${name}`));
  }
}
