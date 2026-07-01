#!/usr/bin/env node
import { Command } from 'commander';
import { runTests } from './runner';

const program = new Command();

program
  .name('agent-harness')
  .description('Testing framework for non-deterministic AI agents')
  .version('1.0.0');

program
  .command('run')
  .description('Run a suite of agent tests')
  .argument('<path>', 'Path to the test configuration file')
  .option('-i, --iterations <number>', 'Number of times to run each test', '10')
  .action(async (path, options) => {
    console.log(`Starting agent-harness...`);
    console.log(`Target: ${path}`);
    console.log(`Iterations: ${options.iterations}`);
    await runTests(path, parseInt(options.iterations, 10));
  });

program.parse();
