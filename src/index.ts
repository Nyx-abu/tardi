#!/usr/bin/env node
import { Command } from 'commander';
import { runTests } from './runner';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { intro } from '@clack/prompts';
import chalk from 'chalk';

const program = new Command();

program
  .name('tardi')
  .description('Testing framework for non-deterministic AI agents (Survive the extremes!)')
  .version('1.0.0');

program
  .command('run')
  .description('Run a suite of agent tests')
  .argument('<path>', 'Path to the test configuration file (YAML)')
  .option('-e, --export <path>', 'Export results to a JSON file')
  .action(async (path, options) => {
    try {
      console.clear();
      const logo = figlet.textSync('TARDI', { font: 'Slant' });
      console.log(gradient.pastel.multiline(logo));
      
      intro(chalk.bgCyan.black(' tardi-cli v1.0.0 '));

      await runTests(path, options.export);
    } catch (error: any) {
      console.error(`\n❌ Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
