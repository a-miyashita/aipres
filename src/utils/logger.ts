import chalk from 'chalk';

export const logger = {
  info(msg: string): void {
    console.log(chalk.blue('ℹ') + ' ' + msg);
  },
  success(msg: string): void {
    console.log(chalk.green('✔') + ' ' + msg);
  },
  warn(msg: string): void {
    console.warn(chalk.yellow('⚠') + ' ' + chalk.yellow(msg));
  },
  error(msg: string): void {
    console.error(chalk.red('✖') + ' ' + chalk.red(msg));
  },
  dim(msg: string): void {
    console.log(chalk.dim(msg));
  },
};
